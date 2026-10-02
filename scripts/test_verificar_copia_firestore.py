import contextlib
import datetime
import io
import os
import sys
import unittest
from unittest import mock

from firebase_admin.exceptions import PermissionDeniedError
from google.api_core.datetime_helpers import DatetimeWithNanoseconds
from google.cloud.firestore_v1 import GeoPoint

sys.path.insert(0, os.path.dirname(__file__))
import verificar_copia_firestore as m

# Valores que jamás deben aparecer en la salida.
SUBCOLS = {}
SUBCOLS_ACTIVAS = False
CENTINELA = "valor-centinela-xyz"
ID_SECRETO = "id-documento-secreto"


class NormalizarTest(unittest.TestCase):
    def test_uno_entero_y_flotante_son_distintos(self):
        self.assertNotEqual(m.huella({"a": 1}), m.huella({"a": 1.0}))

    def test_bool_y_uno_son_distintos(self):
        self.assertNotEqual(m.huella({"a": True}), m.huella({"a": 1}))
        self.assertNotEqual(m.huella({"a": False}), m.huella({"a": 0}))

    def test_orden_de_claves_no_cambia_la_huella(self):
        self.assertEqual(m.huella({"a": 1, "b": {"x": 1, "y": 2}}),
                         m.huella({"b": {"y": 2, "x": 1}, "a": 1}))

    def test_nombres_de_campo_con_espacio_final_cuentan(self):
        self.assertNotEqual(m.huella({"Encargado ": 1}), m.huella({"Encargado": 1}))

    def test_nan_es_estable(self):
        self.assertEqual(m.huella({"a": float("nan")}), m.huella({"a": float("nan")}))
        self.assertNotEqual(m.huella({"a": float("nan")}), m.huella({"a": 0.0}))

    def test_none_anidado(self):
        self.assertEqual(m.huella({"a": {"b": None}}), m.huella({"a": {"b": None}}))
        self.assertNotEqual(m.huella({"a": {"b": None}}), m.huella({"a": {}}))
        self.assertNotEqual(m.huella({"a": [None]}), m.huella({"a": ["None"]}))

    def test_tipo_desconocido_lanza_typeerror(self):
        with self.assertRaises(TypeError):
            m.huella({"a": object()})
        with self.assertRaises(TypeError):
            m.huella({"a": {1, 2}})

    def test_fecha_con_nanosegundos(self):
        a = DatetimeWithNanoseconds(2020, 1, 1, tzinfo=datetime.timezone.utc, nanosecond=123456789)
        b = DatetimeWithNanoseconds(2020, 1, 1, tzinfo=datetime.timezone.utc, nanosecond=123456790)
        self.assertNotEqual(m.huella({"f": a}), m.huella({"f": b}))
        self.assertIn("123456789Z", m._fecha_rfc3339(a))

    def test_fecha_con_nanosegundos_inconsistentes_usa_microsegundos(self):
        class Falsa(datetime.datetime):
            nanosecond = 123456789  # no concuerda con microsecond=7

        a = Falsa(2020, 1, 1, 0, 0, 0, 7, tzinfo=datetime.timezone.utc)
        self.assertTrue(m._fecha_rfc3339(a).endswith(".000007000Z"))

    def test_bytes_geopoint_y_listas(self):
        self.assertNotEqual(m.huella({"a": b"\x01"}), m.huella({"a": "01"}))
        self.assertNotEqual(m.huella({"a": GeoPoint(1, 2)}), m.huella({"a": GeoPoint(1, 3)}))
        self.assertNotEqual(m.huella([1, 2]), m.huella([2, 1]))


class CompararTest(unittest.TestCase):
    def test_categorias(self):
        c = m.comparar({"a": "1", "b": "2", "c": "3"}, {"a": "1", "b": "9", "d": "4"})
        self.assertEqual(c, {"iguales": ["a"], "distintos": ["b"],
                             "solo_origen": ["c"], "solo_destino": ["d"]})


class Snap:
    def __init__(self, id_, datos):
        self.id = id_
        self._d = datos
        self.exists = datos is not None
        self.reference = mock.Mock()
        self.reference.collections.return_value = iter(
            [object()] * (SUBCOLS.get(id_, 0) if SUBCOLS_ACTIVAS else 0))

    def to_dict(self):
        return self._d


class FakeCol:
    def __init__(self, docs, log):
        self.docs, self.log = docs, log
        self.id = None

    def stream(self, **kw):
        self.log.append(kw)
        return [Snap(i, d) for i, d in self.docs.items()]

    def document(self, i):
        col = self
        class Ref:
            def get(self, **kw):
                col.log.append(kw)
                return Snap(i, col.docs.get(i))
        return Ref()


class FakeDB:
    def __init__(self, datos):
        self.datos, self.log = datos, []

    def collection(self, n):
        return FakeCol(self.datos.get(n, {}), self.log)

    def collections(self):
        cols = []
        for n in self.datos:
            c = FakeCol({}, [])
            c.id = n
            cols.append(c)
        return cols


def ejecutar(origen, destino, argv_extra=None, colecciones="transacciones,documentos,companias"):
    db_o, db_d = FakeDB(origen), FakeDB(destino)
    argv = ["--colecciones", colecciones, "--semilla", "1"] + (argv_extra or [])
    salida = io.StringIO()
    with mock.patch.object(m, "_abrir_clientes", return_value=(db_o, db_d)), \
            mock.patch.dict(os.environ, clear=False), \
            contextlib.redirect_stdout(salida):
        os.environ.pop("FIRESTORE_EMULATOR_HOST", None)
        os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
        codigo = m.main(argv)
    return codigo, salida.getvalue(), db_o, db_d


def base():
    return {
        "companias": {ID_SECRETO: {"Indicador de registro": 1, "Nombre": CENTINELA}},
        "documentos": {"d1": {"Doc": 10, "Documento": CENTINELA}},
        "transacciones": {"t1": {"Num": 5, "Doc1": 10.0, "Doc2": None}},
    }


class MainTest(unittest.TestCase):
    def test_todo_coincide(self):
        codigo, salida, _, _ = ejecutar(base(), base())
        self.assertEqual(codigo, 0, salida)
        self.assertIn("LA COPIA COINCIDE", salida)

    def test_solo_origen_y_solo_destino(self):
        o, d = base(), base()
        o["documentos"]["d2"] = {"Doc": 11}
        d["documentos"]["d3"] = {"Doc": 12}
        codigo, salida, _, _ = ejecutar(o, d)
        self.assertEqual(codigo, 1)
        self.assertIn("solo_origen=1 solo_destino=1", salida)
        self.assertIn(m.corto("d2"), salida)
        self.assertIn(m.corto("d3"), salida)
        self.assertNotIn("d2 ", salida)

    def test_distintos_informa_nombre_de_campo(self):
        o, d = base(), base()
        d["documentos"]["d1"]["Documento"] = "otro"
        codigo, salida, _, _ = ejecutar(o, d)
        self.assertEqual(codigo, 1)
        self.assertIn("distintos=1", salida)
        self.assertIn("campos_distintos=['Documento']", salida)
        self.assertIn("campos_distintos_todos=['Documento']", salida)

    def test_campos_distintos_de_todos_los_documentos_no_solo_la_muestra(self):
        o, d = base(), base()
        for i in range(30):
            o["documentos"][f"x{i}"] = {"Doc": 100 + i, "A": 1}
            d["documentos"][f"x{i}"] = {"Doc": 100 + i, "A": 1}
        d["documentos"]["x7"]["A"] = 2
        d["documentos"]["x9"]["B"] = 2
        codigo, salida, _, _ = ejecutar(o, d, ["--muestra", "0"])
        self.assertEqual(codigo, 1)
        self.assertIn("campos_distintos_todos=['A', 'B']", salida)

    def test_huerfano_float_entero_se_compara_como_int(self):
        # Doc1=10.0 apunta a documentos.Doc=10: no es huérfano.
        codigo, salida, _, _ = ejecutar(base(), base())
        self.assertEqual(codigo, 0)
        self.assertIn("ninguno", salida)

    def test_huerfanos_iguales_en_origen_y_destino_no_son_diferencia(self):
        o, d = base(), base()
        o["transacciones"]["t1"]["Doc3"] = 99
        d["transacciones"]["t1"]["Doc3"] = 99
        codigo, salida, _, _ = ejecutar(o, d)
        self.assertEqual(codigo, 0, salida)
        self.assertIn("transacciones.Doc3: origen=1 destino=1 iguales", salida)

    def test_huerfano_nuevo_en_destino_es_diferencia(self):
        o, d = base(), base()
        d["transacciones"]["t1"]["Doc3"] = 99
        codigo, salida, _, _ = ejecutar(o, d)
        self.assertEqual(codigo, 1)
        self.assertIn("DISTINTOS", salida)

    def test_referencias_de_transaccion_y_compania(self):
        o = base()
        o["manejo_de_caja"] = {"m1": {"Transacción": 5, "Sigla Compañía": 1.0}}
        o["corpus_christi"] = {"c1": {"Compañía": 1, "Compañía2": 7, "Transacción": 6}}
        cols = "transacciones,documentos,companias,manejo_de_caja,corpus_christi"
        codigo, salida, _, _ = ejecutar(o, o, colecciones=cols)
        self.assertEqual(codigo, 0, salida)
        self.assertIn("corpus_christi.Compañía2: origen=1 destino=1 iguales", salida)
        self.assertIn("corpus_christi.Transacción: origen=1 destino=1 iguales", salida)
        self.assertNotIn("manejo_de_caja.", salida.replace("[manejo_de_caja]", ""))

    def test_colecciones_de_mas_en_el_destino(self):
        d = base()
        d["logs"] = {"l1": {"x": 1}}
        codigo, salida, _, _ = ejecutar(base(), d)
        self.assertEqual(codigo, 1)
        self.assertIn("colecciones de más en el destino] 1: ['logs']", salida)

    def test_colecciones_del_origen_no_pedidas_no_son_diferencia(self):
        o = base()
        o["logs"] = {"l1": {"x": 1}}
        d = base()
        codigo, salida, _, _ = ejecutar(o, d)
        self.assertEqual(codigo, 0, salida)
        self.assertIn("colecciones del origen no pedidas] 1: ['logs']", salida)

    def test_coleccion_pedida_vacia_en_el_origen_es_diferencia(self):
        o, d = base(), base()
        codigo, salida, _, _ = ejecutar(o, d, colecciones="transacciones,documentos,companias,salarios")
        self.assertEqual(codigo, 1)
        self.assertIn("la colección salarios no tiene documentos en el origen", salida)

    def test_subcolecciones_se_avisan(self):
        global SUBCOLS_ACTIVAS
        SUBCOLS["d1"] = 2
        SUBCOLS_ACTIVAS = True
        try:
            _, salida, _, _ = ejecutar(base(), base())
        finally:
            SUBCOLS_ACTIVAS = False
            SUBCOLS.clear()
        self.assertIn("2 subcolecciones en el origen de documentos", salida)
        self.assertIn("2 subcolecciones en el destino de documentos", salida)

    def test_tipo_no_soportado_devuelve_3_sin_valor(self):
        o = base()
        o["documentos"]["d1"]["v"] = object()
        codigo, salida, _, _ = ejecutar(o, base())
        self.assertEqual(codigo, 3)
        self.assertIn("colección documentos: object", salida)

    def test_sigla_en_texto_resuelve_por_sigla_compania(self):
        o = base()
        o["companias"]["c2"] = {"Indicador de registro": 2, "Sigla Compañía": "GA-AR"}
        o["manejo_de_caja"] = {"m1": {"Sigla Compañía": "GA-AR", "Transacción": 5}}
        cols = "transacciones,documentos,companias,manejo_de_caja"
        codigo, salida, _, _ = ejecutar(o, o, colecciones=cols)
        self.assertEqual(codigo, 0, salida)
        self.assertIn("ninguno", salida)

    def test_cadena_numerica_contra_numero_no_es_huerfano(self):
        o = base()
        o["manejo_de_caja"] = {"m1": {"Sigla Compañía": " 1 ", "Transacción": "5"}}
        o["transacciones"]["t1"]["Doc1"] = "10"
        cols = "transacciones,documentos,companias,manejo_de_caja"
        codigo, salida, _, _ = ejecutar(o, o, colecciones=cols)
        self.assertEqual(codigo, 0, salida)
        self.assertIn("ninguno", salida)

    def test_referencia_vacia_o_cero_no_cuenta(self):
        o = base()
        o["transacciones"]["t1"].update({"Doc3": "", "Doc4": 0})
        codigo, salida, _, _ = ejecutar(o, o)
        self.assertEqual(codigo, 0, salida)
        self.assertIn("ninguno", salida)

    def test_referencia_inexistente_con_cadena_es_huerfano(self):
        o = base()
        o["transacciones"]["t1"]["Doc3"] = "99"
        _, salida, _, _ = ejecutar(o, o)
        self.assertIn("transacciones.Doc3: origen=1 destino=1", salida)

    def test_campo_con_espacio_final_se_trata_como_llave(self):
        o = base()
        o["companias"] = {"c1": {"Indicador de registro ": 1}}
        o["transacciones"]["t1"]["Doc1"] = 10
        o["manejo_de_caja"] = {"m1": {"Sigla Compañía": 1}}
        cols = "transacciones,documentos,companias,manejo_de_caja"
        codigo, salida, _, _ = ejecutar(o, o, colecciones=cols)
        self.assertNotIn("manejo_de_caja.Sigla", salida)

    def test_la_salida_no_contiene_valores_ni_ids(self):
        o, d = base(), base()
        d["companias"][ID_SECRETO]["Nombre"] = "OTRO-" + CENTINELA
        o["documentos"]["id-solo-origen"] = {"Doc": 77, "Documento": CENTINELA}
        _, salida, _, _ = ejecutar(o, d)
        for prohibido in (CENTINELA, ID_SECRETO, "id-solo-origen"):
            self.assertNotIn(prohibido, salida)

    def test_error_de_permisos_devuelve_2_sin_texto(self):
        salida = io.StringIO()
        error = PermissionDeniedError("TEXTO-SENSIBLE")
        with mock.patch.object(m, "_abrir_clientes", side_effect=error), \
                contextlib.redirect_stdout(salida):
            codigo = m.main(["--colecciones", "companias"])
        self.assertEqual(codigo, 2)
        self.assertIn("PermissionDeniedError", salida.getvalue())
        self.assertNotIn("TEXTO-SENSIBLE", salida.getvalue())

    def test_hora_origen_se_pasa_solo_al_origen(self):
        codigo, _, db_o, db_d = ejecutar(
            base(), base(), ["--hora-origen", "2026-10-01T12:00:00+00:00"])
        self.assertEqual(codigo, 0)
        hora = datetime.datetime(2026, 10, 1, 12, tzinfo=datetime.timezone.utc)
        self.assertTrue(db_o.log)
        self.assertTrue(all(kw.get("read_time") == hora for kw in db_o.log))
        self.assertTrue(all("read_time" not in kw for kw in db_d.log))

    def test_hora_origen_futura_se_rechaza(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as cm:
            m.main(["--colecciones", "companias", "--hora-origen", "2999-01-01T00:00:00+00:00"])
        self.assertEqual(cm.exception.code, 2)

    def test_hora_antigua_sin_minuto_entero_avisa(self):
        _, salida, _, _ = ejecutar(base(), base(), ["--hora-origen", "2026-01-01T12:00:30+00:00"])
        self.assertIn("Aviso: --hora-origen", salida)
        _, salida, _, _ = ejecutar(base(), base(), ["--hora-origen", "2026-01-01T12:00:00+00:00"])
        self.assertNotIn("Aviso: --hora-origen", salida)

    def test_emulador_definido_devuelve_2_antes_de_abrir_clientes(self):
        salida = io.StringIO()
        with mock.patch.dict(os.environ, {"FIRESTORE_EMULATOR_HOST": "localhost:8080"}), \
                mock.patch.object(m, "_abrir_clientes") as abrir, \
                contextlib.redirect_stdout(salida):
            codigo = m.main(["--colecciones", "companias"])
        self.assertEqual(codigo, 2)
        abrir.assert_not_called()
        self.assertIn("FIRESTORE_EMULATOR_HOST está definida", salida.getvalue())

    def test_clave_de_servicio_devuelve_2_salvo_permitir_clave(self):
        entorno = {"GOOGLE_APPLICATION_CREDENTIALS": "/ruta/secreta.json"}
        salida = io.StringIO()
        with mock.patch.dict(os.environ, entorno), \
                mock.patch.object(m, "_abrir_clientes") as abrir, \
                contextlib.redirect_stdout(salida):
            os.environ.pop("FIRESTORE_EMULATOR_HOST", None)
            codigo = m.main(["--colecciones", "companias"])
        self.assertEqual(codigo, 2)
        abrir.assert_not_called()
        self.assertNotIn("secreta", salida.getvalue())
        db = FakeDB(base())
        with mock.patch.dict(os.environ, entorno), \
                mock.patch.object(m, "_abrir_clientes", return_value=(db, FakeDB(base()))), \
                contextlib.redirect_stdout(io.StringIO()):
            os.environ.pop("FIRESTORE_EMULATOR_HOST", None)
            codigo = m.main(["--colecciones", "transacciones,documentos,companias",
                             "--permitir-clave"])
        self.assertEqual(codigo, 0)

    def test_hora_origen_sin_zona_se_rechaza(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as cm:
            m.main(["--colecciones", "companias", "--hora-origen", "2026-10-01T12:00:00"])
        self.assertEqual(cm.exception.code, 2)

    def test_origen_y_destino_iguales_se_rechazan(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit) as cm:
            m.main(["--colecciones", "companias", "--origen", "pretso-prod"])
        self.assertEqual(cm.exception.code, 2)

    def test_proyecto_fuera_de_la_lista_se_rechaza(self):
        with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
            m.main(["--colecciones", "companias", "--origen", "otro"])


if __name__ == "__main__":
    unittest.main()
