import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
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


if __name__ == "__main__":
    unittest.main()
