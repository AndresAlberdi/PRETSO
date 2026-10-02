"""Verifica, solo con lectura, que la copia de Firestore de pretso-database a pretso-prod coincide.

Compara TODOS los documentos de cada colección pedida (huella SHA-256 por
documento), una muestra aleatoria campo a campo, las colecciones de más en el
destino y las referencias entre colecciones (huérfanos). No escribe nada.
Solo imprime conteos, nombres de campo y, ante diferencias, los 8 primeros
caracteres del SHA-256 del id; nunca valores, ids completos ni datos personales.

Códigos de salida:
  0 = todo coincide;
  1 = hay diferencias (incluye una colección pedida sin documentos en el origen);
  2 = error de acceso o de lectura, o argumentos/entorno no válidos;
  3 = tipo de dato no soportado (se informa la colección y el nombre del tipo,
      nunca el valor).

Solo compara colecciones raíz; si encuentra subcolecciones, lo avisa con su
recuento (hoy no hay). Los identificadores en español siguen el precedente de
scripts/asignar_claim_admin.py (convención de los scripts del repositorio).
Estas pruebas Python (scripts/test_*.py) aún no corren en CI.

Uso:
  python3 scripts/verificar_copia_firestore.py --colecciones companias,transacciones,documentos
  python3 scripts/verificar_copia_firestore.py --colecciones companias --hora-origen 2026-10-01T12:00:00+00:00 --muestra 50 --semilla 7
"""
import argparse
import datetime
import hashlib
import json
import math
import os
import random
import re
import sys

import firebase_admin
from firebase_admin import credentials, firestore
from firebase_admin.exceptions import FirebaseError
from google.cloud.firestore_v1 import DocumentReference, GeoPoint

PROYECTOS = ["pretso-database", "pretso-prod"]
MAX_HUELLAS_LISTADAS = 20

_RE_DOC = re.compile(r"^Doc(\d+)$")
_RE_COMPANIA = re.compile(r"^(Compañía\d*|Cmp\d*)$")


# ---------------------------------------------------------------- huellas

def _fecha_rfc3339(v):
    """Fecha en UTC con nanosegundos (los datetime sin zona se toman como UTC)."""
    if v.tzinfo is None:
        v = v.replace(tzinfo=datetime.timezone.utc)
    utc = v.astimezone(datetime.timezone.utc)
    nanos = getattr(v, "nanosecond", None)
    if nanos is None or nanos // 1000 != v.microsecond:
        nanos = v.microsecond * 1000
    return utc.strftime("%Y-%m-%dT%H:%M:%S") + f".{nanos:09d}Z"


class TipoNoSoportado(TypeError):
    """Valor de un tipo que el verificador no sabe normalizar (falla cerrado)."""

    def __init__(self, tipo, coleccion=None):
        super().__init__(f"Tipo no soportado: {tipo}")
        self.tipo, self.coleccion = tipo, coleccion


def normalizar(v):
    """Forma canónica etiquetada por tipo; falla cerrado ante un tipo desconocido.

    La etiqueta evita colisiones: 1 y 1.0, o True y 1, dan formas distintas.
    """
    if isinstance(v, bool):  # bool antes que int: bool es subclase de int
        return ["b", v]
    if isinstance(v, int):
        return ["i", str(v)]
    if isinstance(v, float):
        return ["f", repr(v)]  # repr cubre nan, inf y -0.0
    if isinstance(v, str):
        return ["s", v]
    if v is None:
        return ["n"]
    if isinstance(v, datetime.datetime):
        return ["t", _fecha_rfc3339(v)]
    if isinstance(v, dict):
        return ["m", [[str(k), normalizar(v[k])] for k in sorted(v, key=str)]]
    if isinstance(v, (list, tuple)):
        return ["a", [normalizar(x) for x in v]]
    if isinstance(v, (bytes, bytearray)):
        return ["y", bytes(v).hex()]
    if isinstance(v, DocumentReference):
        return ["r", v.path]
    if isinstance(v, GeoPoint):
        return ["g", repr(v.latitude), repr(v.longitude)]
    raise TipoNoSoportado(type(v).__name__)


def huella(d):
    """SHA-256 (hex) de la forma normalizada de un valor o documento."""
    texto = json.dumps(normalizar(d), ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()


def comparar(h_origen, h_destino):
    """Compara dos {id: huella}; devuelve las listas de ids por categoría."""
    comunes = set(h_origen) & set(h_destino)
    iguales = sorted(i for i in comunes if h_origen[i] == h_destino[i])
    distintos = sorted(i for i in comunes if h_origen[i] != h_destino[i])
    return {
        "iguales": iguales,
        "distintos": distintos,
        "solo_origen": sorted(set(h_origen) - set(h_destino)),
        "solo_destino": sorted(set(h_destino) - set(h_origen)),
    }


def corto(doc_id):
    """8 primeros caracteres del SHA-256 del id (nunca el id)."""
    return hashlib.sha256(str(doc_id).encode("utf-8")).hexdigest()[:8]


def _listar_cortos(ids):
    cortos = [corto(i) for i in ids[:MAX_HUELLAS_LISTADAS]]
    extra = len(ids) - len(cortos)
    return " ".join(cortos) + (f" (y {extra} más)" if extra > 0 else "")


# ------------------------------------------------------------- referencias

_LLAVES_COMPANIA = ("Indicador de registro", "Sigla Compañía")
_RE_NUMERO = re.compile(r"^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$")


def clave_ref(v):
    """Claves candidatas de una referencia, normalizadas como la app, o None si está vacía.

    Vacío = None, "", 0 (la app usa `if (tData[docCol])`). Una cadena numérica
    recortada equivale al número (como Number(x)); además se conserva la cadena
    tal cual, porque la app también compara por texto.
    """
    if not v:
        return None
    if isinstance(v, str):
        recortada = v.strip()
        if not recortada:
            return None
        claves = []
        if _RE_NUMERO.match(recortada):
            n = float(recortada)
            if n == 0:
                return None
            claves.append(clave_valor(n))
        claves.append(("s", v))
        return tuple(claves)
    return (clave_valor(v),)


def destino_de_referencia(coleccion, campo):
    """(colección, campos-llave posibles) al que apunta `campo` de `coleccion`, o None.

    La app resuelve la compañía por `Indicador de registro` (número o texto) y,
    si no, por `Sigla Compañía` (CompaniaModal.tsx), por eso hay dos llaves.
    """
    campo = campo.rstrip()
    if coleccion == "transacciones":
        m = _RE_DOC.match(campo)
        if m and 1 <= int(m.group(1)) <= 10:
            return ("documentos", ("Doc",))
        return None
    if campo == "Transacción":
        return ("transacciones", ("Num",))
    if campo == "Sigla Compañía" and coleccion != "companias":
        return ("companias", _LLAVES_COMPANIA)
    if coleccion == "corpus_christi" and _RE_COMPANIA.match(campo):
        return ("companias", _LLAVES_COMPANIA)
    return None


def clave_valor(v):
    """Clave comparable por valor: un float entero equivale al mismo int."""
    if isinstance(v, bool):
        return ("b", v)
    if isinstance(v, int):
        return ("n", v)
    if isinstance(v, float):
        if math.isfinite(v) and v == int(v):
            return ("n", int(v))
        return ("f", repr(v))
    if isinstance(v, str):
        return ("s", v)
    return ("o", json.dumps(normalizar(v), ensure_ascii=False))


_CAMPOS_DESTINO = {("documentos", "Doc"), ("transacciones", "Num"),
                   ("companias", "Indicador de registro"),
                   ("companias", "Sigla Compañía")}


def extraer_claves(coleccion, datos):
    """Referencias y valores-llave de un documento: ([(campo, clave)], [(campo_llave, clave)])."""
    refs, llaves = [], []
    for campo, valor in datos.items():
        if valor is None:
            continue
        nombre = campo.rstrip()
        if (coleccion, nombre) in _CAMPOS_DESTINO:
            llaves.append((nombre, clave_valor(valor)))
        if destino_de_referencia(coleccion, campo) is not None:
            claves = clave_ref(valor)
            if claves is not None:
                refs.append((campo, claves))
    return refs, llaves


# ------------------------------------------------------------------ lectura

def huellas_por_campo(datos):
    return {k: huella(v) for k, v in datos.items()}


def campos_distintos(lec_o, lec_d, ids):
    """Nombres de campo cuya huella difiere, en TODOS los documentos de `ids`."""
    nombres = set()
    for i in ids:
        co, cd = lec_o["campos"][i], lec_d["campos"][i]
        nombres |= {k for k in set(co) | set(cd) if co.get(k) != cd.get(k)}
    return sorted(nombres)


def leer_coleccion(db, nombre, hora=None):
    """Lee todos los documentos: {id: huella} y los datos mínimos de referencias."""
    huellas, campos, refs, llaves = {}, {}, {}, set()
    subcolecciones = 0
    kwargs = {"read_time": hora} if hora is not None else {}
    for snap in db.collection(nombre).stream(**kwargs):
        datos = snap.to_dict() or {}
        try:
            campos[snap.id] = huellas_por_campo(datos)
        except TipoNoSoportado as e:
            raise TipoNoSoportado(e.tipo, nombre) from None
        huellas[snap.id] = huella(datos)
        r, ll = extraer_claves(nombre, datos)
        refs[snap.id] = r
        llaves.update(ll)
        subcolecciones += sum(1 for _ in snap.reference.collections())
    return {"huellas": huellas, "campos": campos, "refs": refs, "llaves": llaves,
            "subcolecciones": subcolecciones}


def comparar_muestra(db_o, db_d, nombre, ids, hora=None):
    """Comparación campo a campo. Devuelve (campos_distintos, documentos_con_diferencia, desaparecidos)."""
    campos, docs_dif, desaparecidos = set(), 0, 0
    kw = {"read_time": hora} if hora is not None else {}
    for i in ids:
        so = db_o.collection(nombre).document(i).get(**kw)
        sd = db_d.collection(nombre).document(i).get()
        if not so.exists or not sd.exists:
            desaparecidos += 1
            continue
        ho = huellas_por_campo(so.to_dict() or {})
        hd = huellas_por_campo(sd.to_dict() or {})
        dif = {k for k in set(ho) | set(hd) if ho.get(k) != hd.get(k)}
        if dif:
            docs_dif += 1
            campos |= dif
    return sorted(campos), docs_dif, desaparecidos


def huerfanos(lecturas):
    """{(colección, campo): {id}} de documentos cuya referencia no existe en el destino de la referencia."""
    resultado = {}
    for coleccion, lec in lecturas.items():
        for doc_id, refs in lec["refs"].items():
            for campo, claves in refs:
                tgt_col, tgt_campos = destino_de_referencia(coleccion, campo)
                if tgt_col not in lecturas:
                    continue
                llaves = lecturas[tgt_col]["llaves"]
                if not any((tc, k) in llaves for tc in tgt_campos for k in claves):
                    resultado.setdefault((coleccion, campo.rstrip()), set()).add(doc_id)
    return resultado


def referencias_omitidas(colecciones):
    """Referencias que no se pueden comprobar por faltar la colección de destino de la referencia."""
    faltan = set()
    for col in colecciones:
        for campo in _campos_ref_conocidos(col):
            tgt = destino_de_referencia(col, campo)
            if tgt and tgt[0] not in colecciones:
                faltan.add((col, tgt[0]))
    return sorted(faltan)


def _campos_ref_conocidos(coleccion):
    if coleccion == "transacciones":
        return [f"Doc{i}" for i in range(1, 11)]
    campos = ["Transacción", "Sigla Compañía"]
    if coleccion == "corpus_christi":
        campos += ["Compañía"] + [f"Compañía{i}" for i in range(2, 11)]
    return campos


# --------------------------------------------------------------------- CLI

def _crear_parser():
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--origen", default="pretso-database", choices=PROYECTOS)
    parser.add_argument("--destino", default="pretso-prod", choices=PROYECTOS)
    parser.add_argument("--colecciones", required=True,
                        help="Colecciones a comparar, separadas por comas.")
    parser.add_argument("--hora-origen",
                        help="Hora ISO 8601 con zona (read_time) para leer el origen en ese instante.")
    parser.add_argument("--muestra", type=int, default=20,
                        help="Documentos de la muestra campo a campo (por colección).")
    parser.add_argument("--semilla", type=int, help="Semilla de la muestra aleatoria.")
    parser.add_argument("--permitir-clave", action="store_true",
                        help="Permite usar GOOGLE_APPLICATION_CREDENTIALS (clave de cuenta de servicio).")
    return parser


def _describir_error(e):
    """Describe un error sin exponer su texto (puede traer datos sensibles)."""
    descripcion = type(e).__name__
    if isinstance(e, FirebaseError):
        descripcion += f" (código {e.code})"
    return descripcion


def _abrir_clientes(origen, destino):
    cred = credentials.ApplicationDefault()
    app_o = firebase_admin.initialize_app(cred, {"projectId": origen}, name="origen")
    app_d = firebase_admin.initialize_app(cred, {"projectId": destino}, name="destino")
    return firestore.client(app=app_o), firestore.client(app=app_d)


def _verificar(db_o, db_d, colecciones, hora, muestra, semilla):
    """Ejecuta las comprobaciones e imprime el informe. Devuelve True si hay diferencias."""
    hay_dif = False
    rng = random.Random(semilla)
    lec_o, lec_d = {}, {}

    for col in colecciones:
        lec_o[col] = leer_coleccion(db_o, col, hora)
        lec_d[col] = leer_coleccion(db_d, col)
        c = comparar(lec_o[col]["huellas"], lec_d[col]["huellas"])
        print(f"[{col}] origen={len(lec_o[col]['huellas'])} "
              f"destino={len(lec_d[col]['huellas'])} iguales={len(c['iguales'])} "
              f"distintos={len(c['distintos'])} solo_origen={len(c['solo_origen'])} "
              f"solo_destino={len(c['solo_destino'])}")
        for etiqueta in ("distintos", "solo_origen", "solo_destino"):
            if c[etiqueta]:
                hay_dif = True
                print(f"  {etiqueta} (sha256[:8] del id): {_listar_cortos(c[etiqueta])}")
        if c["distintos"]:
            print("  campos_distintos_todos="
                  f"{campos_distintos(lec_o[col], lec_d[col], c['distintos'])}")
        if not lec_o[col]["huellas"]:
            hay_dif = True
            print(f"  AVISO: la colección {col} no tiene documentos en el origen "
                  "(¿nombre mal escrito?); se cuenta como diferencia")
        for lado, lec in (("origen", lec_o[col]), ("destino", lec_d[col])):
            if lec["subcolecciones"]:
                print(f"  AVISO: {lec['subcolecciones']} subcolecciones en el {lado} "
                      f"de {col}; NO se comparan")

        comunes = sorted(set(c["iguales"]) | set(c["distintos"]))
        elegidos = rng.sample(comunes, min(muestra, len(comunes))) if muestra > 0 else []
        campos, docs_dif, desaparecidos = comparar_muestra(db_o, db_d, col, elegidos, hora)
        print(f"  muestra={len(elegidos)} con_diferencias={docs_dif} "
              f"desaparecidos={desaparecidos}"
              + (f" campos_distintos={campos}" if campos else ""))
        if docs_dif or desaparecidos:
            hay_dif = True

    no_pedidas = sorted(x.id for x in db_o.collections() if x.id not in colecciones)
    print(f"[colecciones del origen no pedidas] {len(no_pedidas)}"
          + (f": {no_pedidas}" if no_pedidas else ""))
    extras = sorted(x.id for x in db_d.collections() if x.id not in colecciones)
    print(f"[colecciones de más en el destino] {len(extras)}"
          + (f": {extras}" if extras else ""))
    if extras:
        hay_dif = True

    for col, tgt in referencias_omitidas(colecciones):
        print(f"[referencias] omitidas {col} -> {tgt}: la colección {tgt} no se pidió")
    h_o, h_d = huerfanos(lec_o), huerfanos(lec_d)
    for clave in sorted(set(h_o) | set(h_d)):
        so, sd = h_o.get(clave, set()), h_d.get(clave, set())
        coincide = so == sd
        print(f"[huérfanos] {clave[0]}.{clave[1]}: origen={len(so)} destino={len(sd)} "
              f"{'iguales' if coincide else 'DISTINTOS'}")
        if not coincide:
            hay_dif = True
            dif = sorted(so ^ sd)
            print(f"  ids con huérfano distinto (sha256[:8]): {_listar_cortos(dif)}")
    if not h_o and not h_d:
        print("[huérfanos] ninguno en origen ni en destino")
    return hay_dif


def main(argv=None):
    """Devuelve 0 si todo coincide, 1 si hay diferencias, 2 ante un error de acceso o de entorno, 3 ante un tipo no soportado."""
    parser = _crear_parser()
    args = parser.parse_args(argv)
    if args.origen == args.destino:
        parser.error("--origen y --destino no pueden ser iguales")
    colecciones = [c.strip() for c in args.colecciones.split(",") if c.strip()]
    if not colecciones:
        parser.error("--colecciones no puede estar vacía")
    if len(set(colecciones)) != len(colecciones):
        parser.error("--colecciones tiene nombres repetidos")
    if args.muestra < 0:
        parser.error("--muestra no puede ser negativa")
    hora = None
    if args.hora_origen:
        try:
            hora = datetime.datetime.fromisoformat(args.hora_origen)
        except ValueError:
            parser.error("--hora-origen debe ser una hora ISO 8601")
        if hora.tzinfo is None:
            parser.error("--hora-origen debe incluir zona horaria (por ejemplo +00:00)")
        ahora = datetime.datetime.now(datetime.timezone.utc)
        if hora > ahora:
            parser.error("--hora-origen está en el futuro")
        if (ahora - hora > datetime.timedelta(hours=1)
                and (hora.second or hora.microsecond)):
            print("Aviso: --hora-origen tiene más de 1 hora de antigüedad y no es un "
                  "minuto entero; Firestore solo acepta read_time de la última hora, "
                  "o hasta 7 días con PITR y a minuto entero.")

    if os.environ.get("FIRESTORE_EMULATOR_HOST"):
        print("Error: FIRESTORE_EMULATOR_HOST está definida; la verificación "
              "debe leer los proyectos reales")
        return 2
    if os.environ.get("GOOGLE_APPLICATION_CREDENTIALS") and not args.permitir_clave:
        print("Error: GOOGLE_APPLICATION_CREDENTIALS está definida; use "
              "credenciales de usuario (gcloud auth application-default login)")
        return 2

    try:
        db_o, db_d = _abrir_clientes(args.origen, args.destino)
        hay_dif = _verificar(db_o, db_d, colecciones, hora, args.muestra, args.semilla)
    except TipoNoSoportado as e:
        print(f"Error: tipo de dato no soportado en la colección {e.coleccion}: {e.tipo}")
        return 3
    except Exception as e:
        print(f"Error de acceso: {_describir_error(e)}")
        return 2
    print("RESULTADO: HAY DIFERENCIAS" if hay_dif else "RESULTADO: LA COPIA COINCIDE")
    return 1 if hay_dif else 0


if __name__ == "__main__":
    sys.exit(main())
