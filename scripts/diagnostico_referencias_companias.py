#!/usr/bin/env python3
"""Diagnóstico de SOLO LECTURA de cómo se referencian las compañías en PRETSO.

Cuenta, por colección, cuántos registros referencian a su compañía por número de registro
(«Indicador de registro»), por sigla en texto, o por un valor que no resuelve; y revisa las
siglas de `companias` (duplicadas, siglas dobles, separadores).

Uso: python3 scripts/diagnostico_referencias_companias.py --proyecto <ID_DEL_PROYECTO>

Garantías: solo lee (stream); no escribe; no imprime autores ni otros campos de personas:
solo imprime conteos y siglas/nombres de compañía (truncados). Se niega a correr con
GOOGLE_APPLICATION_CREDENTIALS definida (usa credenciales de usuario de gcloud).
"""
import argparse
import os
import re
import sys
import unicodedata
from collections import Counter

COLECCIONES_REF = {
    "manejo_de_caja": ["Sigla Compañía"],
    "salarios": ["Sigla Compañía"],
    "indicadores": ["Sigla Compañía"],
}


def norm(v) -> str:
    s = unicodedata.normalize("NFD", str(v)).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", s).strip().upper()


def canon(v) -> str:
    """Valor de referencia canónico: None/vacío -> '', 7.0 -> '7'."""
    if v is None:
        return ""
    t = str(v).strip()
    if t in ("", "None", "nan", "NaN"):
        return ""
    if re.fullmatch(r"\d+\.0+", t):
        t = t.split(".")[0]
    return t


def partes(sigla: str):
    return [p for p in re.split(r"[^A-Z0-9]+", norm(sigla)) if p]


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--proyecto", required=True, help="ID del proyecto de Firebase (obligatorio)")
    args = parser.parse_args(argv)
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        print("Error: GOOGLE_APPLICATION_CREDENTIALS está definida; use credenciales de usuario.")
        return 2
    # Importación diferida: las funciones puras se prueban sin firebase_admin instalado.
    import firebase_admin
    from firebase_admin import credentials, firestore

    app = firebase_admin.initialize_app(credentials.ApplicationDefault(), {"projectId": args.proyecto})
    db = firestore.client(app)

    comps = [d.to_dict() for d in db.collection("companias").stream()]
    print(f"[companias] {len(comps)} documentos")
    nums = [canon(c.get("Indicador de registro")) for c in comps]
    siglas = [str(c.get("Sigla Compañía", "")).strip() for c in comps]
    set_nums = {n for n in nums if n}
    set_siglas_norm = {norm(s) for s in siglas if s}
    print(f"  números de registro distintos: {len(set_nums)}  (repetidos: {len(nums) - len(set(nums))}, vacíos: {nums.count('')})")
    print(f"  siglas distintas (normalizadas): {len(set_siglas_norm)}  (vacías: {siglas.count('')})")

    # Siglas: separadores y partes
    sep = Counter()
    n_partes = Counter()
    for s in siglas:
        for ch in s:
            if not ch.isalnum() and ch != " ":
                sep[ch] += 1
        n_partes[len(partes(s))] += 1
    print(f"  separadores usados en las siglas: {dict(sep) or 'ninguno'}")
    print(f"  siglas por número de partes: {dict(sorted(n_partes.items()))}")
    ej = [s for s in siglas if len(partes(s)) >= 2][:6]
    print(f"  ejemplos de siglas con varias partes: {ej}")

    # Duplicados exactos y por partes
    cont = Counter(norm(s) for s in siglas if s)
    dups = {k: v for k, v in cont.items() if v > 1}
    print(f"  siglas idénticas repetidas (tras normalizar): {len(dups)} -> {dict(list(dups.items())[:10])}")
    orden_distinto = Counter(tuple(sorted(partes(s))) for s in siglas if s)
    dups_orden = {k: v for k, v in orden_distinto.items() if v > 1 and len(k) > 1}
    print(f"  mismas partes en otro orden / repetidas: {len(dups_orden)} -> {[ '-'.join(k) for k in list(dups_orden)[:10]]}")
    contenidas = []
    plist = [(s, set(partes(s))) for s in siglas if s]
    for i, (a, pa) in enumerate(plist):
        for j, (b, pb) in enumerate(plist):
            if i != j and pa and pa < pb:
                contenidas.append((a, b))
    print(f"  siglas contenidas en una sigla de más partes: {len(contenidas)} -> {contenidas[:10]}")

    # Referencias en las colecciones
    print()
    for col, campos in COLECCIONES_REF.items():
        docs = [d.to_dict() for d in db.collection(col).stream()]
        cls = Counter()
        otros = Counter()
        for d in docs:
            for campo in campos:
                v = canon(d.get(campo))
                if not v:
                    cls["vacío"] += 1
                elif v in set_nums:
                    cls["número de registro válido"] += 1
                elif norm(v) in set_siglas_norm:
                    cls["SIGLA en texto (no resuelve por número)"] += 1
                else:
                    cls["no resuelve"] += 1
                    otros[v[:40]] += 1
        print(f"[{col}] {len(docs)} registros: {dict(cls)}")
        if otros:
            print(f"   valores que no resuelven (hasta 8): {list(otros.items())[:8]}")

    # Corpus Christi: campos de compañía (nombres de campo que empiezan por Compañía o Cmp)
    docs = [d.to_dict() for d in db.collection("corpus_christi").stream()]
    cls = Counter()
    otros = Counter()
    campos_vistos = Counter()
    for d in docs:
        for k, v in d.items():
            if re.match(r"^(Compañía|Cmp)", str(k)):
                campos_vistos[k] += 1
                v = canon(v)
                if not v:
                    cls["vacío"] += 1
                elif v in set_nums:
                    cls["número de registro válido"] += 1
                elif norm(v) in set_siglas_norm:
                    cls["SIGLA en texto (no resuelve por número)"] += 1
                else:
                    cls["no resuelve"] += 1
                    otros[v[:40]] += 1
    print(f"[corpus_christi] {len(docs)} registros; campos de compañía: {dict(campos_vistos)}")
    print(f"   clasificación de los valores no vacíos y vacíos: {dict(cls)}")
    if otros:
        print(f"   valores que no resuelven (hasta 8): {list(otros.items())[:8]}")

    print("\nLectura terminada. No se escribió nada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
