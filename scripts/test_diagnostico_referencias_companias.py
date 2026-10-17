import contextlib
import io
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))
import diagnostico_referencias_companias as modulo
from diagnostico_referencias_companias import canon, clasificar, es_campo_corpus, norm, partes, tipo


class CanonTest(unittest.TestCase):
    def test_vacios(self):
        for v in (None, "", "  ", "None", "nan", "NaN"):
            self.assertEqual(canon(v), "")

    def test_decimales_enteros(self):
        self.assertEqual(canon(7.0), "7")
        self.assertEqual(canon("7.0"), "7")
        self.assertEqual(canon(7), "7")
        self.assertEqual(canon(0), "0")

    def test_texto_se_conserva_recortado(self):
        self.assertEqual(canon(" GA-JR "), "GA-JR")


class NormTest(unittest.TestCase):
    def test_tildes_mayusculas_y_espacios(self):
        self.assertEqual(norm("  ñandú   gómez "), "NANDU GOMEZ")


class PartesTest(unittest.TestCase):
    def test_separa_por_guion(self):
        self.assertEqual(partes("GA-AR-MR"), ["GA", "AR", "MR"])
        self.assertEqual(partes("JG"), ["JG"])

    def test_normaliza_y_descarta_vacios(self):
        self.assertEqual(partes("ga--jr "), ["GA", "JR"])
        self.assertEqual(partes(""), [])


class TipoTest(unittest.TestCase):
    def test_distingue_entero_decimal_cadena_y_nulo(self):
        self.assertEqual([tipo(v) for v in (7, 7.0, "7", None)], ["int", "float", "str", "NoneType"])


class CampoCorpusTest(unittest.TestCase):
    def test_reconoce_solo_campos_de_compania(self):
        for k in ("Compañía", "Compañía2", "Compañía10", "Cmp", "Cmp2"):
            self.assertTrue(es_campo_corpus(k), k)
        for k in ("Ciudad", "Sigla Compañía", "Compañía Principal", "Cmpx", "Compañía2\n", "Compañía٢"):
            self.assertFalse(es_campo_corpus(k), k)


class ClasificarTest(unittest.TestCase):
    def test_clasifica(self):
        nums, siglas = {"7"}, {"GA-JR"}
        self.assertEqual(clasificar(7.0, nums, siglas), "número de registro válido")
        self.assertEqual(clasificar("ga-jr", nums, siglas), "SIGLA en texto (no resuelve por número)")
        self.assertEqual(clasificar("zz", nums, siglas), "no resuelve")
        self.assertEqual(clasificar(None, nums, siglas), "vacío")


class _Doc:
    def __init__(self, datos):
        self._d = datos

    def to_dict(self):
        return self._d


class _Db:
    DATOS = {
        "companias": [
            {"Indicador de registro": 7, "Sigla Compañía": "SECRETA-AB", "Autores": "Persona X"},
            {"Indicador de registro": 7.0, "Sigla Compañía": "SECRETA-BA"},
            {"Indicador de registro": None, "Sigla Compañía": "VACIA"},
            {"Indicador de registro": None, "Sigla Compañía": "VACIA2"},
        ],
        "manejo_de_caja": [{"Sigla Compañía": "VALOR-RARO"}, {"Sigla Compañía": 7}],
        "salarios": [], "indicadores": [],
        "corpus_christi": [{"Cmp2": 7, "Compañía10": "OTRO-RARO", "Ciudad": "Potosí"}],
    }

    def collection(self, nombre):
        return mock.Mock(stream=lambda: [_Doc(d) for d in self.DATOS[nombre]])


class SalidaTest(unittest.TestCase):
    def correr(self, extra):
        fa = mock.Mock()
        fs = mock.Mock()
        fs.client.return_value = _Db()
        modulos = {"firebase_admin": fa, "firebase_admin.credentials": fa.credentials, "firebase_admin.firestore": fs}
        fa.firestore = fs
        buf = io.StringIO()
        with mock.patch.dict(sys.modules, modulos), mock.patch.dict(os.environ, {}, clear=False):
            os.environ.pop("GOOGLE_APPLICATION_CREDENTIALS", None)
            with contextlib.redirect_stdout(buf):
                codigo = modulo.main(["--proyecto", "demo"] + extra)
        self.assertEqual(codigo, 0)
        return buf.getvalue()

    def test_por_defecto_solo_conteos(self):
        salida = self.correr([])
        for dato in ("SECRETA", "VALOR-RARO", "OTRO-RARO", "Persona X"):
            self.assertNotIn(dato, salida)
        self.assertIn("«Indicador de registro» por tipo: {'int': 1, 'float': 1, 'NoneType': 2}", salida)
        self.assertIn("tipos de dato de ['Sigla Compañía']: {'str': 1, 'int': 1}", salida)
        self.assertIn("campos de compañía: {'Cmp2': 1, 'Compañía10': 1}", salida)
        self.assertIn("tipos de dato de los campos de compañía: {'int': 1, 'str': 1}", salida)

    def test_repetidos_no_cuenta_vacios(self):
        # 7 y 7.0 son el mismo número (1 repetido); los dos None no cuentan
        self.assertIn("(repetidos: 1, vacíos: 2)", self.correr([]))

    def test_con_flag_muestra_ejemplos(self):
        salida = self.correr(["--mostrar-ejemplos"])
        self.assertIn("VALOR-RARO", salida)
        self.assertIn("OTRO-RARO", salida)
        self.assertNotIn("Persona X", salida)


class MainTest(unittest.TestCase):
    def test_proyecto_es_obligatorio(self):
        with self.assertRaises(SystemExit):
            modulo.main([])

    def test_se_niega_con_credenciales_de_archivo(self):
        with mock.patch.dict(os.environ, {"GOOGLE_APPLICATION_CREDENTIALS": "/x.json"}):
            self.assertEqual(modulo.main(["--proyecto", "demo"]), 2)


if __name__ == "__main__":
    unittest.main()
