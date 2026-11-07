"""Borra de Firestore los campos que la investigación retiró (Laura Paz, 02/11/2026).

Campos: `Datos sobre normativa de manejo de caja` (manejo_de_caja) y `Días de
ración en un año`, `Número estimado de representaciones por año` y `Número de
representaciones  por año ` (salarios). Deben coincidir con
src/utils/camposRetirados.ts (una prueba lo verifica).

Sin --aplicar solo lee y cuenta los documentos afectados; no escribe nada.
Con --aplicar borra únicamente esos campos (DELETE_FIELD), no los documentos.
Nunca imprime valores de los registros. Haga antes la copia (verificar_copia_firestore.py
o una exportación) y use credenciales de usuario, no una clave.

Uso:
  python3 scripts/retirar_campos_obsoletos.py --proyecto pretso-database
  python3 scripts/retirar_campos_obsoletos.py --proyecto pretso-database --aplicar
"""
import argparse
import os
import sys

import firebase_admin
from firebase_admin import credentials, firestore

CAMPOS_RETIRADOS = {
    "manejo_de_caja": ["Datos sobre normativa de manejo de caja"],
    "salarios": [
        "Días de ración en un año",
        "Número estimado de representaciones por año",
        "Número de representaciones  por año ",
    ],
}
TAMANO_LOTE = 400


def campos_a_borrar(datos, campos):
    """Devuelve los campos de `campos` que el documento tiene (aunque estén vacíos)."""
    return [c for c in campos if c in (datos or {})]


def recorrer(db, aplicar=False, tamano_lote=TAMANO_LOTE):
    """Cuenta los documentos afectados por colección y campo; borra si `aplicar`.

    Devuelve {coleccion: {"documentos": N, "afectados": M, "por_campo": {campo: K}}}.
    """
    resumen = {}
    for coleccion, campos in CAMPOS_RETIRADOS.items():
        total = afectados = 0
        por_campo = {c: 0 for c in campos}
        lote = db.batch()
        en_lote = 0
        for doc in db.collection(coleccion).stream():
            total += 1
            presentes = campos_a_borrar(doc.to_dict(), campos)
            if not presentes:
                continue
            afectados += 1
            for c in presentes:
                por_campo[c] += 1
            if aplicar:
                lote.update(doc.reference, {c: firestore.DELETE_FIELD for c in presentes})
                en_lote += 1
                if en_lote >= tamano_lote:
                    lote.commit()
                    lote = db.batch()
                    en_lote = 0
        if aplicar and en_lote:
            lote.commit()
        resumen[coleccion] = {"documentos": total, "afectados": afectados, "por_campo": por_campo}
    return resumen


def _crear_parser():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--proyecto", required=True, choices=["pretso-database", "pretso-prod"])
    parser.add_argument("--aplicar", action="store_true",
                        help="Borra los campos; sin esta opción solo lee y cuenta.")
    return parser


def _describir_error(e):
    return type(e).__name__


def main(argv=None):
    args = _crear_parser().parse_args(argv)
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        print("Aviso: GOOGLE_APPLICATION_CREDENTIALS está definida y se usaría esa clave. "
              "Use las credenciales de usuario: `gcloud auth application-default login`.")
    try:
        firebase_admin.initialize_app(credentials.ApplicationDefault(), {"projectId": args.proyecto})
        db = firestore.client()
        resumen = recorrer(db, aplicar=args.aplicar)
    except Exception as e:
        print(f"Error: {_describir_error(e)}")
        return 1
    for coleccion, r in resumen.items():
        print(f"{coleccion}: {r['afectados']} de {r['documentos']} documentos tienen campos retirados")
        for campo, n in r["por_campo"].items():
            print(f"  - {campo!r}: {n}")
    if args.aplicar:
        despues = recorrer(db, aplicar=False)
        quedan = sum(r["afectados"] for r in despues.values())
        print(f"Verificación: quedan {quedan} documentos con campos retirados.")
        return 0 if quedan == 0 else 1
    print("(solo lectura, no se escribe)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
