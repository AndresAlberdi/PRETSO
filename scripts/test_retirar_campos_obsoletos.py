import os
import re
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))
import retirar_campos_obsoletos as modulo
from retirar_campos_obsoletos import CAMPOS_RETIRADOS, campos_a_borrar, recorrer


class Doc:
    def __init__(self, datos):
        self._datos = datos
        self.reference = object()

    def to_dict(self):
        return self._datos


class Lote:
    def __init__(self, registro):
        self.registro = registro
        self.pendientes = []

    def update(self, ref, cambios):
        self.pendientes.append((ref, cambios))

    def commit(self):
        self.registro.append(list(self.pendientes))
        self.pendientes = []


class BD:
    def __init__(self, colecciones):
        self.colecciones = colecciones
        self.commits = []

    def collection(self, nombre):
        docs = self.colecciones.get(nombre, [])
        return mock.Mock(stream=lambda: iter(docs))

    def batch(self):
        return Lote(self.commits)


class CamposTest(unittest.TestCase):
    def test_detecta_solo_los_presentes(self):
        self.assertEqual(campos_a_borrar({"Ingresos": 1}, ["Datos sobre normativa de manejo de caja"]), [])
        self.assertEqual(campos_a_borrar({"Datos sobre normativa de manejo de caja": ""},
                                         ["Datos sobre normativa de manejo de caja"]),
                         ["Datos sobre normativa de manejo de caja"])
        self.assertEqual(campos_a_borrar(None, ["x"]), [])

    def test_coincide_con_camposRetirados_ts(self):
        ruta = os.path.join(os.path.dirname(__file__), "..", "src", "utils", "camposRetirados.ts")
        with open(ruta, encoding="utf-8") as f:
            ts = f.read()
        nombres = set(re.findall(r"'([^']+)'", ts.split("export const CAMPOS_RETIRADOS")[1].split("};")[0]))
        nombres -= set(CAMPOS_RETIRADOS)
        self.assertEqual(nombres, {c for v in CAMPOS_RETIRADOS.values() for c in v})

    def test_no_toca_los_campos_que_se_conservan(self):
        self.assertNotIn("Ración diaria", [c for v in CAMPOS_RETIRADOS.values() for c in v])
        self.assertNotIn("Pago por representación", [c for v in CAMPOS_RETIRADOS.values() for c in v])


class RecorrerTest(unittest.TestCase):
    def datos(self):
        return {
            "manejo_de_caja": [Doc({"Ingresos": 1, "Datos sobre normativa de manejo de caja": "x"}), Doc({"Ingresos": 2})],
            "salarios": [Doc({"Ración diaria": 2, "Días de ración en un año": 365,
                              "Número de representaciones  por año ": 12})],
        }

    def test_sin_aplicar_cuenta_y_no_escribe(self):
        bd = BD(self.datos())
        r = recorrer(bd, aplicar=False)
        self.assertEqual(r["manejo_de_caja"]["afectados"], 1)
        self.assertEqual(r["manejo_de_caja"]["documentos"], 2)
        self.assertEqual(r["salarios"]["por_campo"]["Días de ración en un año"], 1)
        self.assertEqual(bd.commits, [])

    def test_aplicar_borra_solo_los_campos_retirados(self):
        bd = BD(self.datos())
        recorrer(bd, aplicar=True)
        cambios = [c for lote in bd.commits for (_, c) in lote]
        claves = {k for c in cambios for k in c}
        self.assertEqual(claves, {"Datos sobre normativa de manejo de caja", "Días de ración en un año",
                                  "Número de representaciones  por año "})
        self.assertEqual(len(cambios), 2)

    def test_lotes_de_tamano_maximo(self):
        docs = [Doc({"Datos sobre normativa de manejo de caja": "x"}) for _ in range(5)]
        bd = BD({"manejo_de_caja": docs})
        recorrer(bd, aplicar=True, tamano_lote=2)
        self.assertEqual([len(l) for l in bd.commits], [2, 2, 1])


if __name__ == "__main__":
    unittest.main()
