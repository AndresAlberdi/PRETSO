import contextlib
import io
import os
import sys
import unittest
from unittest import mock

from firebase_admin import auth
from firebase_admin.exceptions import FirebaseError

sys.path.insert(0, os.path.dirname(__file__))
import asignar_claim_admin as modulo
from asignar_claim_admin import calcular_claims


class CalcularClaimsTest(unittest.TestCase):
    def test_none_asigna_admin(self):
        self.assertEqual(calcular_claims(None, False), {"admin": True})

    def test_vacio_asigna_admin(self):
        self.assertEqual(calcular_claims({}, False), {"admin": True})

    def test_conserva_otros_claims(self):
        self.assertEqual(calcular_claims({"reader": True}, False),
                         {"reader": True, "admin": True})

    def test_quitar_borra_admin_y_conserva_el_resto(self):
        self.assertEqual(calcular_claims({"admin": True, "reader": True}, True),
                         {"reader": True})
        self.assertEqual(calcular_claims({"admin": True}, True), {})

    def test_quitar_sin_admin_es_idempotente(self):
        self.assertEqual(calcular_claims(None, True), {})

    def test_idempotencia(self):
        una = calcular_claims({"reader": True}, False)
        self.assertEqual(calcular_claims(una, False), una)

    def test_no_muta_la_entrada(self):
        entrada = {"admin": True, "reader": True}
        calcular_claims(entrada, True)
        self.assertEqual(entrada, {"admin": True, "reader": True})

    def test_admin_no_booleano_pasa_a_true(self):
        self.assertEqual(calcular_claims({"admin": 1}, False), {"admin": True})
        self.assertEqual(calcular_claims({"admin": "true"}, False),
                         {"admin": True})


def _usuario(claims=None, disabled=False, verificado=False):
    u = mock.Mock()
    u.uid = "UID-SECRETO"
    u.custom_claims = claims
    u.disabled = disabled
    u.email_verified = verificado
    u.provider_data = [mock.Mock(provider_id="google.com")]
    return u


class MainTest(unittest.TestCase):
    def setUp(self):
        self.env = mock.patch.dict(os.environ, {}, clear=False)
        self.env.start()
        os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
        patches = {
            "init": mock.patch.object(modulo.firebase_admin, "initialize_app"),
            "cred": mock.patch.object(modulo.credentials, "ApplicationDefault"),
            "get_email": mock.patch.object(auth, "get_user_by_email"),
            "set": mock.patch.object(auth, "set_custom_user_claims"),
            "get": mock.patch.object(auth, "get_user"),
            "revoke": mock.patch.object(auth, "revoke_refresh_tokens"),
        }
        self.m = {k: p.start() for k, p in patches.items()}
        self.addCleanup(mock.patch.stopall)

    def correr(self, *extra, correos=("a@x.com",)):
        argv = ["--proyecto", "pretso-database"]
        for c in correos:
            argv += ["--correo", c]
        argv += list(extra)
        salida = io.StringIO()
        with contextlib.redirect_stdout(salida):
            codigo = modulo.main(argv)
        return codigo, salida.getvalue()

    def test_sin_aplicar_no_escribe(self):
        self.m["get_email"].return_value = _usuario({})
        codigo, out = self.correr()
        self.assertEqual(codigo, 0)
        self.m["set"].assert_not_called()
        self.assertIn("(solo lectura, no se escribe)", out)
        self.assertIn("proveedores=['google.com'] verificado=False "
                      "deshabilitada=False", out)
        self.assertNotIn("UID-SECRETO", out)

    def test_aplicar_sin_cambio_no_escribe(self):
        self.m["get_email"].return_value = _usuario({"admin": True})
        codigo, out = self.correr("--aplicar")
        self.assertEqual(codigo, 0)
        self.m["set"].assert_not_called()
        self.assertIn("sin cambios; no se escribe", out)

    def test_aplicar_con_cambio_fusiona_y_verifica(self):
        self.m["get_email"].return_value = _usuario({"reader": True})
        self.m["get"].return_value = _usuario({"reader": True, "admin": True})
        codigo, out = self.correr("--aplicar")
        self.assertEqual(codigo, 0)
        self.m["set"].assert_called_once_with(
            "UID-SECRETO", {"reader": True, "admin": True})
        self.m["revoke"].assert_not_called()
        self.assertIn("verificado", out)

    def test_admin_no_booleano_se_reescribe(self):
        for previo in (1, "true"):
            with self.subTest(previo=previo):
                self.m["set"].reset_mock()
                self.m["get_email"].return_value = _usuario({"admin": previo})
                self.m["get"].return_value = _usuario({"admin": True})
                codigo, _ = self.correr("--aplicar")
                self.assertEqual(codigo, 0)
                self.m["set"].assert_called_once_with(
                    "UID-SECRETO", {"admin": True})

    def test_relectura_distinta_devuelve_1(self):
        self.m["get_email"].return_value = _usuario({})
        self.m["get"].return_value = _usuario({"admin": True, "otro": 1})
        codigo, out = self.correr("--aplicar")
        self.assertEqual(codigo, 1)
        self.assertIn("no coincide", out)

    def test_usuario_inexistente_devuelve_2(self):
        self.m["get_email"].side_effect = auth.UserNotFoundError("no existe")
        codigo, _ = self.correr("--aplicar")
        self.assertEqual(codigo, 2)

    def test_excepcion_generica_devuelve_1_sin_texto(self):
        self.m["get_email"].side_effect = RuntimeError("TOKEN-SECRETO")
        codigo, out = self.correr("--aplicar")
        self.assertEqual(codigo, 1)
        self.assertIn("RuntimeError", out)
        self.assertNotIn("TOKEN-SECRETO", out)

    def test_firebase_error_muestra_codigo_sin_texto(self):
        self.m["get_email"].side_effect = FirebaseError(
            "PERMISSION_DENIED", "DETALLE-SECRETO")
        codigo, out = self.correr()
        self.assertEqual(codigo, 1)
        self.assertIn("FirebaseError", out)
        self.assertIn("PERMISSION_DENIED", out)
        self.assertNotIn("DETALLE-SECRETO", out)

    def test_varios_correos_sigue_tras_error(self):
        self.m["get_email"].side_effect = [
            RuntimeError("x"), _usuario({"admin": True})]
        codigo, out = self.correr("--aplicar", correos=("a@x.com", "b@x.com"))
        self.assertEqual(codigo, 1)
        self.assertEqual(self.m["get_email"].call_count, 2)
        self.assertIn("b@x.com: admin actual=True", out)

    def test_codigo_2_no_se_pierde_frente_a_1(self):
        for orden in ((auth.UserNotFoundError("n"), RuntimeError("x")),
                      (RuntimeError("x"), auth.UserNotFoundError("n"))):
            with self.subTest(orden=orden):
                self.m["get_email"].side_effect = list(orden)
                codigo, _ = self.correr(correos=("a@x.com", "b@x.com"))
                self.assertEqual(codigo, 2)

    def test_quitar_aplicar_revoca_tokens(self):
        self.m["get_email"].return_value = _usuario(
            {"admin": True, "reader": True})
        self.m["get"].return_value = _usuario({"reader": True})
        codigo, _ = self.correr("--quitar", "--aplicar")
        self.assertEqual(codigo, 0)
        self.m["set"].assert_called_once_with("UID-SECRETO", {"reader": True})
        self.m["revoke"].assert_called_once_with("UID-SECRETO")

    def test_cuenta_deshabilitada_se_rechaza_al_asignar(self):
        self.m["get_email"].return_value = _usuario({}, disabled=True)
        codigo, out = self.correr("--aplicar")
        self.assertEqual(codigo, 1)
        self.assertIn("deshabilitada", out)
        self.m["set"].assert_not_called()

    def test_cuenta_deshabilitada_permite_quitar(self):
        self.m["get_email"].return_value = _usuario(
            {"admin": True}, disabled=True)
        self.m["get"].return_value = _usuario({})
        codigo, _ = self.correr("--quitar", "--aplicar")
        self.assertEqual(codigo, 0)
        self.m["set"].assert_called_once_with("UID-SECRETO", {})

    def test_cuenta_sin_verificar_se_acepta(self):
        self.m["get_email"].return_value = _usuario({}, verificado=False)
        self.m["get"].return_value = _usuario({"admin": True})
        codigo, out = self.correr("--aplicar")
        self.assertEqual(codigo, 0)
        self.assertIn("verificado=False", out)

    def test_aviso_si_hay_clave_de_servicio(self):
        self.m["get_email"].return_value = _usuario({"admin": True})
        with mock.patch.dict(os.environ, {
                "GOOGLE_APPLICATION_CREDENTIALS": "/ruta/secreta.json"}):
            _, out = self.correr()
        self.assertIn("GOOGLE_APPLICATION_CREDENTIALS", out)
        self.assertIn("gcloud auth application-default login", out)
        self.assertNotIn("/ruta/secreta.json", out)

    def test_error_al_iniciar_devuelve_1_sin_texto(self):
        self.m["init"].side_effect = ValueError("CLAVE-SECRETA")
        codigo, out = self.correr()
        self.assertEqual(codigo, 1)
        self.assertNotIn("CLAVE-SECRETA", out)


if __name__ == "__main__":
    unittest.main()
