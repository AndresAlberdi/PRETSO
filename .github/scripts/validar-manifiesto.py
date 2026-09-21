#!/usr/bin/env python3
"""Valida .devsecops.yml contra su esquema y contra lo que el esquema no puede decir.

Por qué existe: hasta el 2026-09-07 nada validaba el manifiesto. Un manifiesto
inválido se detectaba recién al fallar algo aguas abajo, o no se detectaba
nunca. La validación entró entonces en el job `preparar` de
_reusable-security.yml, escrita dentro del propio YAML; este archivo la saca de
ahí para que security-local.sh ejecute EXACTAMENTE la misma comprobación. Con
la lógica duplicada, local y CI divergen en cuanto alguien toca una de las dos
copias, que es justo el defecto que el script local existe para evitar.

Además del esquema comprueba dos cosas que un JSON Schema no puede expresar:

- `componente` de una excepción debe nombrar un `componentes[].nombre`
  declarado. El job que lee las excepciones descarta en silencio las que no
  coinciden, así que un nombre erróneo —una ruta de archivo, por ejemplo—
  desactiva la excepción sin que nadie se entere. Ocurrió en ChatbotRAG el
  2026-09-07: CI informaba «Excepciones vigentes aplicables: 0» mientras el
  informe local contaba una.
- La vigencia (`vence` - `creado`) contra los límites de la política: 90 días
  para CRITICAL/HIGH y 180 para MEDIUM. La entrada no declara severidad, así
  que solo bloquea lo que supera el techo absoluto y avisa entre 90 y 180.

Lo que NO garantiza: que las excepciones estén justificadas ni que el
`aprobado_por` sea real. Eso lo revisa una persona en el PR.

Uso:
  validar-manifiesto.py [--manifiesto RUTA] [--esquema RUTA] [--formato github|texto]

Salida: 0 válido (con avisos o sin ellos) · 1 inválido · 2 no se pudo validar
(falta el esquema o falta jsonschema/PyYAML); quien lo invoca decide si un 2
bloquea. Hoy no bloquea ni en CI ni en local, pero se informa: una validación
que no corrió no es una validación limpia.

Pruebas: 02-pipelines/pruebas-workflows/validacion_manifiesto.py
"""
import argparse
import datetime as dt
import json
import pathlib
import sys

MANIFIESTO_DEFECTO = ".devsecops.yml"
ESQUEMA_DEFECTO = ".github/devsecops.schema.json"


def main() -> int:
    p = argparse.ArgumentParser(add_help=True, description=__doc__.splitlines()[0])
    p.add_argument("--manifiesto", default=MANIFIESTO_DEFECTO)
    p.add_argument("--esquema", default=ESQUEMA_DEFECTO)
    p.add_argument("--formato", choices=("github", "texto"), default="texto",
                   help="github: anotaciones ::error/::warning file=…  · texto: legible en terminal")
    args = p.parse_args()

    gh = args.formato == "github"
    archivo = args.manifiesto

    def error(mensaje: str) -> None:
        print(f"::error file={archivo}::{mensaje}" if gh else f"[ERROR] {mensaje}")

    def aviso(mensaje: str) -> None:
        print(f"::warning file={archivo}::{mensaje}" if gh else f"[AVISO] {mensaje}")

    if not pathlib.Path(archivo).is_file():
        print(f"Sin {archivo}: nada que validar (el manifiesto es opcional).")
        return 0

    try:
        import yaml
    except ImportError:
        aviso("PyYAML no instalado: no se valida el manifiesto (pip install pyyaml).")
        return 2
    try:
        from jsonschema import Draft202012Validator
    except ImportError:
        aviso("jsonschema no instalado: no se valida el manifiesto (pip install jsonschema).")
        return 2

    if not pathlib.Path(args.esquema).is_file():
        aviso(f"Hay {archivo} pero falta {args.esquema}; no se valida. "
              "Ejecute bootstrap-repo.sh para copiarlo.")
        return 2

    try:
        with open(archivo, encoding="utf-8") as f:
            manifiesto = yaml.safe_load(f) or {}
    except yaml.YAMLError as e:
        error(f"YAML inválido: {e}")
        return 1
    with open(args.esquema, encoding="utf-8") as f:
        esquema = json.load(f)

    errores = sorted(Draft202012Validator(esquema).iter_errors(manifiesto),
                     key=lambda e: list(e.absolute_path))
    # Los fallos propios (posteriores al esquema) se cuentan aparte: mezclar
    # dicts del manifiesto dentro de `errores`, que contiene objetos
    # ValidationError, funcionaba solo porque después nadie lo recorre.
    fallos_propios = 0
    for e in errores:
        ruta = ".".join(str(x) for x in e.absolute_path) or "(raíz)"
        error(f"{ruta}: {e.message}")
        # Una fecha sin comillas es el error más frecuente y su mensaje
        # ("is not of type 'string'") no dice cómo arreglarlo.
        if isinstance(e.instance, dt.date):
            campo = e.path[-1] if e.path else "campo"
            error(f'{ruta}: entrecomille la fecha (`{campo}: "{e.instance}"`); '
                  "YAML convierte una fecha sin comillas en un objeto date.")

    excepciones = (manifiesto.get("seguridad", {}) or {}).get("excepciones", []) or []
    declarados = {c.get("nombre") for c in (manifiesto.get("componentes") or [])}
    avisos = 0

    for e in excepciones:
        comp = e.get("componente")
        if comp and comp not in declarados:
            error(f"Excepción {e.get('id')}: componente '{comp}' no está declarado en "
                  f"`componentes[].nombre` ({', '.join(sorted(n for n in declarados if n)) or 'ninguno'}). "
                  "La excepción se descartaría sin aviso; use un nombre declarado o quite el campo.")
            fallos_propios += 1

    for e in excepciones:
        try:
            creado = dt.date.fromisoformat(str(e["creado"]))
            vence = dt.date.fromisoformat(str(e["vence"]))
        except (KeyError, ValueError, TypeError):
            continue   # el esquema ya reportó lo que falte o esté mal formado
        dias = (vence - creado).days
        if dias > 180:
            error(f"Excepción {e.get('id')}: {dias} días de vigencia; "
                  "el máximo es 90 (CRITICAL/HIGH) o 180 (MEDIUM).")
            fallos_propios += 1
        elif dias > 90:
            avisos += 1
            aviso(f"Excepción {e.get('id')}: {dias} días de vigencia; "
                  "solo admisible si el hallazgo es MEDIUM (CRITICAL/HIGH: máximo 90).")

    if errores or fallos_propios:
        return 1
    if avisos:
        print(f"✓ {archivo} valida contra el esquema, con {avisos} aviso(s) de vigencia.")
    else:
        print(f"✓ {archivo} valida contra el esquema y las vigencias están dentro de límite.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
