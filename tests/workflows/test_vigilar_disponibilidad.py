#!/usr/bin/env python3
"""Pruebas de .github/workflows/vigilar-disponibilidad.yml.

Por qué existe. El workflow vigila staging cada 2 horas y manda como máximo 4
correos al día por Resend «por construcción»: ese tope depende de los crons y
del `if` del job `avisar`, así que se verifica aquí (estructura y cupo), junto
con la lógica del paso `Comprobar sitios`.

Cómo. Se ejecuta el `run:` REAL del paso con bash (`bash --noprofile --norc
-eo pipefail`, el shell por defecto de Actions en Linux) y dobles de `curl`
(respuesta configurable por host y por intento) y de `sleep`. El entorno del
subproceso se construye DESDE CERO: no hereda nada de la máquina que corre la
prueba. `GITHUB_OUTPUT` y `GITHUB_STEP_SUMMARY` son archivos temporales. Los
`env:` del paso solo admiten `${{ vars.X }}`: cualquier otra forma hace fallar
la prueba y obliga a revisarla.

LÍMITE: los dobles no prueban a `curl` real ni la red; el ensayo real es la
primera ejecución manual del workflow.

Uso: python3 -m unittest discover -s tests/workflows   (desde la raíz)
"""

import json
import os
import pathlib
import re
import shutil
import subprocess
import tempfile
import unittest

import yaml

RAIZ = pathlib.Path(__file__).resolve().parents[2]
WORKFLOW = RAIZ / ".github" / "workflows" / "vigilar-disponibilidad.yml"

CRON_COMPROBACION = "17 */2 * * *"
CRON_LATIDO = "47 17 * * 1"
CRONES = [CRON_COMPROBACION, "47 1,9 * * *", "47 17 * * 0,2-6", CRON_LATIDO]

URL_STAGING = "https://staging.prueba"
URL_PROD = "https://prod.prueba"
URL_FUNCION = "https://funcion.prueba/listAccounts"
TITULO = "<html><head><title>PRETSO</title></head><body></body></html>"

SITIO = ["ok", "sin_respuesta", "http_error", "contenido", "lento", "no_vigilado"]
FUNCION = ["ok", "sin_respuesta", "respuesta_inesperada", "no_vigilado"]

# Doble de curl. Respuestas en $DOBLES/<host>/<n> con «codigo tiempo» y, si
# existe, $DOBLES/<host>/<n>.cuerpo. Sin archivo para el host: sin conexión.
# Tras el último archivo se repite el último.
DOBLE_CURL = r"""#!/usr/bin/env bash
salida=/dev/null; formato=""; url=""
while (( $# )); do
  case "$1" in
    -o) salida="$2"; shift ;;
    -w) formato="$2"; shift ;;
    -X|-H|--data|--proto|--max-redirs|--connect-timeout|--max-time) shift ;;
    -*) ;;
    *) url="$1" ;;
  esac
  shift
done
host="${url#https://}"; host="${host%%/*}"
printf '%s\n' "$url" >> "$REGISTRO/curl.log"
dir="$DOBLES/$host"
n=$(( $(cat "$dir/.contador" 2>/dev/null || echo 0) + 1 ))
[[ -d "$dir" ]] || { printf '000 0.000'; [[ "$formato" == '%{http_code}' ]] && printf '\r'; exit 7; }
mkdir -p "$dir"; echo "$n" > "$dir/.contador"
while [[ ! -f "$dir/$n" && $n -gt 1 ]]; do n=$((n-1)); done
read -r codigo tiempo < "$dir/$n"
[[ -f "$dir/$n.cuerpo" && "$salida" != /dev/null ]] && cp "$dir/$n.cuerpo" "$salida"
if [[ "$formato" == '%{http_code}' ]]; then printf '%s' "$codigo"; else printf '%s %s' "$codigo" "$tiempo"; fi
[[ "$codigo" == 000 ]] && exit 7
exit 0
"""
DOBLE_SLEEP = """#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$REGISTRO/sleep.log"
exit 0
"""
DOBLE_GH = """#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$REGISTRO/gh.log"
[[ -n "${GH_FALLA:-}" ]] && exit 1
cat "$DOBLES/gh.json"
"""


def cargar():
    return yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))


def triggers(d):
    return d[True] if True in d else d["on"]  # PyYAML lee `on` como True


def paso(d, nombre):
    for s in d["jobs"]["comprobar"]["steps"]:
        if s.get("name") == nombre:
            return s
    raise AssertionError(f"no existe el paso {nombre}")


def expandir_cron(cron):
    """Devuelve {dia_semana: {(hora, minuto), ...}} con 0=domingo. Mínimo: falla ante formas no soportadas."""
    campos = cron.split()
    if len(campos) != 5:
        raise AssertionError(f"cron no soportado: {cron}")
    minuto, horas, dom, mes, dow = campos
    if not re.fullmatch(r"[0-9]{1,2}", minuto) or dom != "*" or mes != "*":
        raise AssertionError(f"cron no soportado: {cron}")

    def lista(campo, maximo, paso_ok):
        valores = set()
        for parte in campo.split(","):
            if campo == "*":
                valores.update(range(maximo + 1))
            elif paso_ok and (m := re.fullmatch(r"\*/([0-9]+)", parte)):
                valores.update(range(0, maximo + 1, int(m.group(1))))
            elif m := re.fullmatch(r"([0-9]+)-([0-9]+)", parte):
                valores.update(range(int(m.group(1)), int(m.group(2)) + 1))
            elif re.fullmatch(r"[0-9]+", parte):
                valores.add(int(parte))
            else:
                raise AssertionError(f"cron no soportado: {cron}")
        return valores

    h = lista(horas, 23, True)
    d = lista(dow, 6, False)
    return {dia: {(hh, int(minuto)) for hh in h} for dia in d}


def entorno_base(tmp, binarios):
    """Entorno de los subprocesos, desde cero: nada de os.environ."""
    (tmp / "home").mkdir(exist_ok=True)
    return dict(
        PATH=f"{binarios}:/usr/bin:/bin",
        HOME=str(tmp / "home"),
        TMPDIR=str(tmp),
        LANG="C.UTF-8",
    )


def resolver_env(env_paso, vars_):
    """Evalúa los `env:` del paso: solo `${{ vars.X }}` o `${{ github.token }}`."""
    resultado = {}
    for nombre, valor in (env_paso or {}).items():
        if m := re.fullmatch(r"\$\{\{ vars\.(\w+) \}\}", str(valor)):
            resultado[nombre] = vars_.get(m.group(1), "")
        elif str(valor) == "${{ github.token }}":
            resultado[nombre] = "token-de-prueba"
        else:
            raise AssertionError(f"forma de env no soportada: {valor}")
    return resultado


def ejecutar_paso(nombre, vars_=None, respuestas=None, gh_json=None, extra_env=None):
    """Ejecuta el `run:` real. `respuestas`: {host: [(codigo, tiempo, cuerpo|None), ...]}."""
    d = cargar()
    p = paso(d, nombre)
    with tempfile.TemporaryDirectory() as t:
        tmp = pathlib.Path(t)
        binarios, dobles, registro = tmp / "bin", tmp / "dobles", tmp / "registro"
        for carpeta in (binarios, dobles, registro):
            carpeta.mkdir()
        for nombre_doble, texto in (("curl", DOBLE_CURL), ("sleep", DOBLE_SLEEP), ("gh", DOBLE_GH)):
            f = binarios / nombre_doble
            f.write_text(texto, encoding="utf-8")
            f.chmod(0o755)
        for host, lista in (respuestas or {}).items():
            (dobles / host).mkdir()
            for i, (codigo, tiempo, cuerpo) in enumerate(lista, 1):
                (dobles / host / str(i)).write_text(f"{codigo} {tiempo}\n", encoding="utf-8")
                if cuerpo is not None:
                    (dobles / host / f"{i}.cuerpo").write_text(cuerpo, encoding="utf-8")
        if gh_json is not None:
            (dobles / "gh.json").write_text(gh_json, encoding="utf-8")
        salida, resumen = tmp / "salida", tmp / "resumen"
        salida.write_text("")
        resumen.write_text("")
        script = tmp / "paso.sh"
        script.write_text(p["run"], encoding="utf-8")
        entorno = entorno_base(tmp, binarios)
        entorno.update(
            REGISTRO=str(registro),
            DOBLES=str(dobles),
            GITHUB_OUTPUT=str(salida),
            GITHUB_STEP_SUMMARY=str(resumen),
            GITHUB_REPOSITORY="AndresAlberdi/PRETSO",
        )
        entorno.update(resolver_env(p.get("env"), vars_ or {}))
        entorno.update(extra_env or {})
        r = subprocess.run(
            ["bash", "--noprofile", "--norc", "-eo", "pipefail", str(script)],
            env=entorno,
            capture_output=True,
            text=True,
            timeout=60,
        )
        outputs = dict(
            linea.split("=", 1) for linea in salida.read_text().splitlines() if "=" in linea
        )

        def leer(nombre_log):
            f = registro / nombre_log
            return f.read_text().splitlines() if f.exists() else []

        return dict(
            rc=r.returncode,
            out=outputs,
            stdout=r.stdout,
            stderr=r.stderr,
            resumen=resumen.read_text(),
            curl=leer("curl.log"),
            sleep=leer("sleep.log"),
            gh=leer("gh.log"),
        )


VARS = dict(
    STAGING_URL=URL_STAGING,
    PROD_URL=URL_PROD,
    VIGILAR_PRODUCCION="",
    LISTACCOUNTS_URL_STAGING="",
)


class EstructuraTest(unittest.TestCase):
    def setUp(self):
        self.d = cargar()
        self.texto = WORKFLOW.read_text(encoding="utf-8")

    def test_crones_exactos_y_dispatch_sin_inputs(self):
        on = triggers(self.d)
        self.assertEqual([c["cron"] for c in on["schedule"]], CRONES)
        self.assertEqual(set(on), {"schedule", "workflow_dispatch"})
        self.assertFalse((on["workflow_dispatch"] or {}).get("inputs"))

    def test_permisos_y_environment(self):
        self.assertEqual(self.d["permissions"], {})
        self.assertEqual(self.d["jobs"]["comprobar"]["permissions"], {"actions": "read"})
        avisar = self.d["jobs"]["avisar"]
        self.assertEqual(avisar["permissions"], {"contents": "read"})
        self.assertEqual(avisar["environment"], "avisos")
        self.assertNotIn("environment", self.d["jobs"]["comprobar"])

    def test_regla_de_dos_comprobar_sin_secretos(self):
        job = self.d["jobs"]["comprobar"]
        self.assertNotIn("secrets.", json.dumps(job))
        self.assertNotIn("RESEND", json.dumps(job))
        # El job con la clave no lee texto de terceros: solo corre el emisor.
        runs = [s.get("run", "") for s in self.d["jobs"]["avisar"]["steps"] if "run" in s]
        self.assertEqual(runs, ["node scripts/vigilancia/aviso-disponibilidad.mjs"])
        self.assertNotIn("curl", "".join(runs))

    def test_pines_por_sha_con_comentario(self):
        usos = [l for l in self.texto.splitlines() if re.match(r"\s*(- )?uses:", l)]
        self.assertTrue(usos)
        for linea in usos:
            self.assertRegex(linea, r"@[0-9a-f]{40} # ")

    def test_sin_interpolaciones_en_run(self):
        for job in self.d["jobs"].values():
            for s in job["steps"]:
                self.assertNotIn("${{", s.get("run", ""), s.get("name"))

    def test_if_de_avisar_y_sin_concurrency(self):
        cond = self.d["jobs"]["avisar"]["if"]
        self.assertIn("'17 */2 * * *'", cond)
        self.assertIn("'47 17 * * 1'", cond)
        self.assertIn("github.run_attempt == 1", cond)
        self.assertNotIn("concurrency", self.d)

    def test_sin_continue_on_error_ni_credenciales_de_nube(self):
        self.assertNotIn("continue-on-error", self.texto)
        self.assertNotIn("GCP_", self.texto)


def evaluar(expr, contexto):
    """Evaluador mínimo de expresiones de Actions: ==, !=, &&, ||, always() y contextos.

    Solo admite las formas presentes en el workflow; otra forma falla la prueba.
    """
    py = expr.replace("&&", " and ").replace("||", " or ").replace("always()", "True")
    py = re.sub(r"(?<![\w'.])((?:github|needs)\.[\w.]+)", lambda m: f"C[{m.group(1)!r}]", py)
    resto = re.sub(r"C\['[^']*'\]|'[^']*'", "", py)
    resto = re.sub(r"\b(and|or|True)\b|[0-9]|[\s()]|==|!=", "", resto)
    if resto:
        raise AssertionError(f"expresión no soportada: {expr}")
    return eval(py, {"__builtins__": {}}, {"C": contexto})  # noqa: S307 (entrada propia del repo)


class CondicionAvisarTest(unittest.TestCase):
    def setUp(self):
        self.d = cargar()
        self.cond = self.d["jobs"]["avisar"]["if"]
        self.modo = self.d["jobs"]["avisar"]["steps"][-1]["env"]["MODO"]

    def ctx(self, evento, cron="", fallo="false", result="success", intento=1, ocurrido="2026-11-09T17:47:03Z"):
        return {
            "github.event_name": evento,
            "github.event.schedule": cron,
            "github.run_attempt": intento,
            "needs.comprobar.result": result,
            "needs.comprobar.outputs.ocurrido_en": ocurrido,
            "needs.comprobar.outputs.hay_fallo": fallo,
        }

    def avisa(self, *a, **k):
        return bool(evaluar(self.cond, self.ctx(*a, **k)))

    def test_tabla_de_decision(self):
        for fallo in ("true", "false"):
            for result in ("success", "failure"):
                # La comprobación de 2 h nunca avisa.
                self.assertFalse(self.avisa("schedule", CRON_COMPROBACION, fallo, result))
                # La del lunes (latido) siempre.
                self.assertTrue(self.avisa("schedule", CRON_LATIDO, fallo, result))
                # Las otras ranuras, solo con fallo.
                for cron in ("47 1,9 * * *", "47 17 * * 0,2-6"):
                    self.assertEqual(self.avisa("schedule", cron, fallo, result), fallo == "true")
                # La prueba manual siempre.
                self.assertTrue(self.avisa("workflow_dispatch", "", fallo, result))

    def test_cancelado_nunca_y_sin_hora_nunca(self):
        for cron in CRONES:
            self.assertFalse(self.avisa("schedule", cron, "true", "cancelled"))
            self.assertFalse(self.avisa("schedule", cron, "true", "failure", ocurrido=""))
        self.assertFalse(self.avisa("workflow_dispatch", "", "false", "cancelled"))

    def test_reejecucion_no_avisa_en_schedule_pero_dispatch_si(self):
        for cron in CRONES:
            self.assertFalse(self.avisa("schedule", cron, "true", "failure", intento=2))
        self.assertTrue(self.avisa("workflow_dispatch", "", "false", "success", intento=2))

    def test_modo(self):
        def modo(evento, cron=""):
            return evaluar(self.modo.strip()[3:-2].strip(), self.ctx(evento, cron))

        self.assertEqual(modo("workflow_dispatch"), "prueba")
        self.assertEqual(modo("schedule", CRON_LATIDO), "latido")
        self.assertEqual(modo("schedule", "47 1,9 * * *"), "ranura")
        self.assertEqual(modo("schedule", CRON_COMPROBACION), "ranura")


class CupoTest(unittest.TestCase):
    def test_tres_ranuras_de_aviso_por_dia(self):
        crones = [c["cron"] for c in triggers(cargar())["schedule"]]
        por_dia = {dia: set() for dia in range(7)}
        for cron in crones:
            if cron == CRON_COMPROBACION:
                continue
            for dia, ranuras in expandir_cron(cron).items():
                por_dia[dia] |= {(cron, r) for r in ranuras}
        for dia, ranuras in por_dia.items():
            self.assertEqual(len(ranuras), 3, f"día {dia}: {sorted(ranuras)}")

    def test_la_comprobacion_no_se_cuenta_y_el_expansor_rechaza_formas_raras(self):
        self.assertEqual(len(expandir_cron(CRON_COMPROBACION)[0]), 12)
        with self.assertRaises(AssertionError):
            expandir_cron("47 17 1 * *")
        with self.assertRaises(AssertionError):
            expandir_cron("47 17 * * MON")


class ComprobarSitiosTest(unittest.TestCase):
    NOMBRE = "Comprobar sitios"

    def ejecutar(self, respuestas, **vars_):
        v = dict(VARS)
        v.update(vars_)
        return ejecutar_paso(self.NOMBRE, v, respuestas)

    def assertSalidasValidas(self, out):
        self.assertIn(out["estado_staging"], SITIO)
        self.assertIn(out["estado_produccion"], SITIO)
        self.assertIn(out["estado_funcion"], FUNCION)
        for k in ("http_staging", "http_produccion", "http_funcion"):
            self.assertRegex(out[k], r"^[0-9]{3}$", k)
        for k in ("ms_staging", "ms_produccion"):
            self.assertRegex(out[k], r"^[0-9]{1,5}$", k)
        self.assertRegex(out["ocurrido_en"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
        self.assertIn(out["hay_fallo"], ("true", "false"))

    def test_200_con_titulo_es_ok(self):
        r = self.ejecutar({"staging.prueba": [(200, "0.350", TITULO)]})
        self.assertEqual(r["rc"], 0, r["stderr"])
        self.assertSalidasValidas(r["out"])
        self.assertEqual(r["out"]["estado_staging"], "ok")
        self.assertEqual(r["out"]["ms_staging"], "350")
        self.assertEqual(r["out"]["hay_fallo"], "false")
        self.assertEqual(r["sleep"], [])
        self.assertIn("| Staging | ok | 200 | 350 |", r["resumen"])

    def test_503_tres_veces_es_http_error_con_fallo(self):
        r = self.ejecutar({"staging.prueba": [(503, "0.100", "x")]})
        self.assertEqual(r["rc"], 0, r["stderr"])
        self.assertSalidasValidas(r["out"])
        self.assertEqual(r["out"]["estado_staging"], "http_error")
        self.assertEqual(r["out"]["http_staging"], "503")
        self.assertEqual(r["out"]["hay_fallo"], "true")
        self.assertEqual(len(r["curl"]), 3)
        self.assertEqual(r["sleep"], ["20", "20"])

    def test_503_y_luego_200_es_ok_por_reintento(self):
        r = self.ejecutar(
            {"staging.prueba": [(503, "0.100", "x"), (200, "0.200", TITULO)]}
        )
        self.assertSalidasValidas(r["out"])
        self.assertEqual(r["out"]["estado_staging"], "ok")
        self.assertEqual(r["out"]["hay_fallo"], "false")
        self.assertEqual(len(r["curl"]), 2)

    def test_200_sin_titulo_es_contenido(self):
        r = self.ejecutar({"staging.prueba": [(200, "0.100", "<html>otra cosa</html>")]})
        self.assertSalidasValidas(r["out"])
        self.assertEqual(r["out"]["estado_staging"], "contenido")
        self.assertEqual(r["out"]["hay_fallo"], "true")

    def test_sin_conexion_es_sin_respuesta_con_http_000(self):
        r = self.ejecutar({})
        self.assertEqual(r["rc"], 0, r["stderr"])
        self.assertSalidasValidas(r["out"])
        self.assertEqual(r["out"]["estado_staging"], "sin_respuesta")
        self.assertEqual(r["out"]["http_staging"], "000")
        self.assertEqual(r["out"]["hay_fallo"], "true")

    def test_9_5_segundos_es_lento(self):
        r = self.ejecutar({"staging.prueba": [(200, "9.500", TITULO)]})
        self.assertSalidasValidas(r["out"])
        self.assertEqual(r["out"]["estado_staging"], "lento")
        self.assertEqual(r["out"]["ms_staging"], "9500")
        self.assertEqual(r["out"]["hay_fallo"], "true")

    def test_produccion_apagada_por_defecto(self):
        r = self.ejecutar({"staging.prueba": [(200, "0.100", TITULO)]})
        self.assertEqual(r["out"]["estado_produccion"], "no_vigilado")
        self.assertEqual(r["out"]["http_produccion"], "000")
        self.assertEqual(r["out"]["ms_produccion"], "0")
        self.assertFalse(any("prod.prueba" in l for l in r["curl"]))

    def test_produccion_activa_se_comprueba(self):
        r = self.ejecutar(
            {"staging.prueba": [(200, "0.1", TITULO)], "prod.prueba": [(404, "0.1", "x")]},
            VIGILAR_PRODUCCION="true",
        )
        self.assertSalidasValidas(r["out"])
        self.assertEqual(r["out"]["estado_produccion"], "http_error")
        self.assertEqual(r["out"]["hay_fallo"], "true")

    def test_produccion_activa_sin_prod_url_falla(self):
        r = self.ejecutar(
            {"staging.prueba": [(200, "0.1", TITULO)]}, VIGILAR_PRODUCCION="true", PROD_URL=""
        )
        self.assertNotEqual(r["rc"], 0)
        self.assertIn("::error::", r["stdout"])

    def test_funcion_con_401_es_ok(self):
        r = self.ejecutar(
            {"staging.prueba": [(200, "0.1", TITULO)], "funcion.prueba": [(401, "0.1", None)]},
            LISTACCOUNTS_URL_STAGING=URL_FUNCION,
        )
        self.assertSalidasValidas(r["out"])
        self.assertEqual(r["out"]["estado_funcion"], "ok")
        self.assertEqual(r["out"]["http_funcion"], "401")
        self.assertEqual(r["out"]["hay_fallo"], "false")

    def test_funcion_con_403_es_respuesta_inesperada(self):
        r = self.ejecutar(
            {"staging.prueba": [(200, "0.1", TITULO)], "funcion.prueba": [(403, "0.1", None)]},
            LISTACCOUNTS_URL_STAGING=URL_FUNCION,
        )
        self.assertSalidasValidas(r["out"])
        self.assertEqual(r["out"]["estado_funcion"], "respuesta_inesperada")
        self.assertEqual(r["out"]["http_funcion"], "403")
        self.assertEqual(r["out"]["hay_fallo"], "true")

    def test_funcion_sin_conexion_y_sin_url(self):
        r = self.ejecutar({"staging.prueba": [(200, "0.1", TITULO)]}, LISTACCOUNTS_URL_STAGING=URL_FUNCION)
        self.assertEqual(r["out"]["estado_funcion"], "sin_respuesta")
        self.assertEqual(r["out"]["http_funcion"], "000")
        r = self.ejecutar({"staging.prueba": [(200, "0.1", TITULO)]})
        self.assertEqual(r["out"]["estado_funcion"], "no_vigilado")
        self.assertEqual(r["out"]["http_funcion"], "000")

    def test_sin_staging_url_falla(self):
        r = self.ejecutar({}, STAGING_URL="")
        self.assertNotEqual(r["rc"], 0)
        self.assertIn("::error::", r["stdout"])

    def test_la_salida_no_imprime_cuerpos(self):
        r = self.ejecutar({"staging.prueba": [(200, "0.1", "SECRETO-EN-EL-CUERPO")]})
        self.assertNotIn("SECRETO-EN-EL-CUERPO", r["stdout"] + r["stderr"] + r["resumen"])


@unittest.skipUnless(shutil.which("jq"), "requiere jq")
class ContarEjecucionesTest(unittest.TestCase):
    NOMBRE = "Contar ejecuciones de 7 días"

    def test_cuenta_exitosas_y_fallidas(self):
        datos = json.dumps(
            [{"conclusion": "success"}] * 5 + [{"conclusion": "failure"}] * 2 + [{"conclusion": ""}, {"conclusion": "cancelled"}]
        )
        r = ejecutar_paso(self.NOMBRE, VARS, gh_json=datos)
        self.assertEqual(r["rc"], 0, r["stderr"])
        self.assertEqual(r["out"], {"ejecuciones_7d": "7", "fallidas_7d": "2"})
        self.assertIn("vigilar-disponibilidad.yml", r["gh"][0])

    def test_si_gh_falla_salen_vacios_con_aviso(self):
        r = ejecutar_paso(self.NOMBRE, VARS, gh_json="[]", extra_env={"GH_FALLA": "1"})
        self.assertEqual(r["rc"], 0, r["stderr"])
        self.assertEqual(r["out"], {"ejecuciones_7d": "", "fallidas_7d": ""})
        self.assertIn("::warning::", r["stdout"])

    def test_conteo_fuera_de_rango_sale_vacio(self):
        datos = json.dumps([{"conclusion": "success"}] * 1000)
        r = ejecutar_paso(self.NOMBRE, VARS, gh_json=datos)
        self.assertEqual(r["out"], {"ejecuciones_7d": "", "fallidas_7d": ""})


if __name__ == "__main__":
    unittest.main()
