import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))
import diagnostico_referencias_companias as modulo
from diagnostico_referencias_companias import canon, norm, partes


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


class MainTest(unittest.TestCase):
    def test_proyecto_es_obligatorio(self):
        with self.assertRaises(SystemExit):
            modulo.main([])

    def test_se_niega_con_credenciales_de_archivo(self):
        with mock.patch.dict(os.environ, {"GOOGLE_APPLICATION_CREDENTIALS": "/x.json"}):
            self.assertEqual(modulo.main(["--proyecto", "demo"]), 2)


if __name__ == "__main__":
    unittest.main()
