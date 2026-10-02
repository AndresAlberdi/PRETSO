#!/usr/bin/env python3
"""Ensayo 10 de OPS-06, parte B: lógica de .github/workflows/probar-rollback-staging.yml.

Por qué existe. Ese workflow toca el sitio de staging, que hoy es el sitio en
uso: antes de lanzarlo una sola vez contra pretso-database conviene saber que,
falle lo que falle, intenta restaurar la versión original, no la pisa si
alguien desplegó entretanto, termina en rojo y no filtra el token.

Cómo. Se ejecuta el `run:` REAL de cada paso con bash (`bash --noprofile
--norc -e`, el shell por defecto de Actions) y dobles CON ESTADO de `curl`
(API REST de Hosting y URL del sitio), `firebase` (hosting:clone cambia la
versión de live), `gcloud` (token), `npm` y `sleep`. Los pasos `uses:` se dan
por correctos. Los `if:` y los `env:` se evalúan con un evaluador mínimo que
solo admite las formas presentes en el workflow: una forma nueva hace fallar la
prueba y obliga a revisarla.

LÍMITE: la forma de las respuestas de la API (release.version.name, .status,
expireTime) sigue a firebase-tools 15 (hosting-clone.js usa
channel.release.version.name), pero aquí solo hay dobles; el ensayo real es el
que lo confirma.

Uso: python3 -m unittest discover -s tests/workflows   (desde la raíz)
"""

import os
import pathlib
import re
import subprocess
import tempfile
import time
import unittest

import yaml

RAIZ = pathlib.Path(__file__).resolve().parents[2]
WORKFLOW = RAIZ / ".github" / "workflows" / "probar-rollback-staging.yml"
TOKEN = "ya29.TOKEN-DE-PRUEBA-NO-DEBE-APARECER-0123456789"
SITIO = "pretso-database"
ORIGINAL = f"sites/{SITIO}/versions/abc123original"
PREVIA = f"sites/{SITIO}/versions/def456previa"
VARS = {
    "GCP_PROJECT_ID_STAGING": SITIO,
    "GCP_PROJECT_ID_PROD": "pretso-prod",
    "STAGING_URL": "https://pretso-database.web.app",
}

DOBLE_CURL = r"""#!/usr/bin/env bash
salida=/dev/null; url=""; auth=no
while (( $# )); do
  case "$1" in
    -o) salida="$2"; shift ;;
    -w|--connect-timeout|--max-time|-X|--data) shift ;;
    -H) [[ "$2" == "Authorization: Bearer $TOKEN_ESPERADO" ]] && auth=si; shift ;;
    -*) ;;
    *) url="$1" ;;
  esac
  shift
done
printf '%s auth=%s\n' "$url" "$auth" >> "$REGISTRO/curl.log"
live="$(cat "$ESTADO/live")"
if [[ "$url" == https://firebasehosting.googleapis.com/v1beta1/sites/*/channels/* ]]; then
  [[ "$auth" == si ]] || { printf 401; exit 0; }
  canal="${url##*/}"
  if [[ "$canal" == live ]]; then
    [[ -n "${API_LIVE_FALLA:-}" ]] && { printf '{}' > "$salida"; printf 500; exit 0; }
    printf '{"name":"x/channels/live","release":{"version":{"name":"%s","status":"FINALIZED"}}}' "$live" > "$salida"
    printf 200
  elif [[ "$canal" == previa ]]; then
    [[ -f "$ESTADO/previa" ]] || { printf '{"error":{"code":404}}' > "$salida"; printf 404; exit 0; }
    printf '{"name":"x/channels/previa","expireTime":"%s","release":{"version":{"name":"%s","status":"%s"}}}' \
      "$PREVIA_VENCE" "$(cat "$ESTADO/previa")" "${PREVIA_ESTADO:-FINALIZED}" > "$salida"
    printf 200
  else
    printf 404
  fi
  exit 0
fi
# URL del sitio: el código depende de la versión servida.
if [[ "$live" == "$(cat "$ESTADO/previa" 2>/dev/null)" ]]; then printf '%s' "${HTTP_PREVIA:-200}"
elif [[ "$live" == "$VERSION_ORIGINAL" ]]; then printf '%s' "${HTTP_ORIGINAL:-200}"
else printf 200; fi
"""
DOBLE_FIREBASE = r"""#!/usr/bin/env bash
printf '%s\n' "$*" >> "$REGISTRO/firebase.log"
[[ "$1" == hosting:clone ]] || exit 0
origen="$2"
if [[ "$origen" == *:previa ]]; then
  [[ -n "${RC_CLONE_ROLLBACK:-}" ]] && { echo "Error: clone falló" >&2; exit "$RC_CLONE_ROLLBACK"; }
  cp "$ESTADO/previa" "$ESTADO/live"
  [[ -n "${TERCERA:-}" ]] && printf 'sites/%s/versions/tercera999' "${origen%%:*}" > "$ESTADO/live"
elif [[ "$origen" == *@* ]]; then
  [[ -n "${RC_CLONE_RESTAURAR:-}" ]] && { echo "Error: clone falló" >&2; exit "$RC_CLONE_RESTAURAR"; }
  printf 'sites/%s/versions/%s' "${origen%%@*}" "${origen#*@}" > "$ESTADO/live"
fi
exit 0
"""
DOBLE_GCLOUD = r"""#!/usr/bin/env bash
printf '%s\n' "$*" >> "$REGISTRO/gcloud.log"
[[ "$*" == "auth print-access-token" ]] && printf '%s\n' "$TOKEN_ESPERADO"
exit 0
"""
DOBLE_SIMPLE = """#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$REGISTRO/{nombre}.log"
exit 0
"""


def cargar():
    return yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))


class Contexto:
    def __init__(self, confirmar, vars_):
        self.confirmar = confirmar
        self.vars = vars_
        self.salidas = {}
        self.resultados = {}

    def termino(self, t):
        t = t.strip()
        m = re.fullmatch(r"inputs\.confirmar\s*==\s*'([^']*)'", t)
        if m:
            return "true" if self.confirmar == m.group(1) else "false"
        m = re.fullmatch(r"steps\.([\w-]+)\.outputs\.([\w-]+)", t)
        if m:
            return self.salidas.get(m.group(1), {}).get(m.group(2), "")
        m = re.fullmatch(r"steps\.([\w-]+)\.outcome", t)
        if m:
            return self.resultados.get(m.group(1), "")
        if re.fullmatch(r"vars\.[A-Z0-9_]+", t):
            return self.vars.get(t[5:], "")
        if re.fullmatch(r"'[^']*'", t):
            return t[1:-1]
        raise AssertionError(f"término no admitido por la prueba: {t!r}")

    def resolver(self, valor):
        valor = str(valor)
        m = re.fullmatch(r"\$\{\{\s*(.+?)\s*\}\}", valor)
        if not m:
            if "${{" in valor:
                raise AssertionError(f"expresión no admitida: {valor}")
            return valor
        for t in m.group(1).split("||"):
            v = self.termino(t)
            if v:
                return v
        return ""

    def evaluar_if(self, expr, fallido):
        if expr is None:
            return not fallido
        expr = str(expr).strip()
        if expr == "always()":
            return True
        m = re.fullmatch(
            r"always\(\)\s*&&\s*steps\.([\w-]+)\.outputs\.([\w-]+)\s*==\s*'([^']*)'",
            expr,
        )
        if m:
            return self.salidas.get(m.group(1), {}).get(m.group(2), "") == m.group(3)
        raise AssertionError(f"condición no admitida por la prueba: {expr}")


def simular(
    confirmar="ROLLBACK-STAGING",
    vars_extra=None,
    previa=PREVIA,
    live=ORIGINAL,
    vence_en=10 * 86400,
    **dobles,
):
    d = cargar()
    job = d["jobs"]["ensayo"]
    ctx = Contexto(confirmar, dict(VARS, **(vars_extra or {})))
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        registro, estado, binarios = tmp / "registro", tmp / "estado", tmp / "bin"
        for p in (registro, estado, binarios):
            p.mkdir()
        (estado / "live").write_text(live, encoding="utf-8")
        if previa is not None:
            (estado / "previa").write_text(previa, encoding="utf-8")
        textos = {
            "curl": DOBLE_CURL,
            "firebase": DOBLE_FIREBASE,
            "gcloud": DOBLE_GCLOUD,
        }
        for n in ("npm", "sleep", "npx"):
            textos[n] = DOBLE_SIMPLE.replace("{nombre}", n)
        for n, t in textos.items():
            (binarios / n).write_text(t, encoding="utf-8")
            (binarios / n).chmod(0o755)
        vence = time.strftime(
            "%Y-%m-%dT%H:%M:%S.123456Z", time.gmtime(time.time() + vence_en)
        )
        base = dict(
            os.environ,
            PATH=f"{binarios}:{os.environ['PATH']}",
            REGISTRO=str(registro),
            ESTADO=str(estado),
            TOKEN_ESPERADO=TOKEN,
            PREVIA_VENCE=vence,
            VERSION_ORIGINAL=ORIGINAL,
            FIREBASE_TOOLS_VERSION="15.28.1",
            GITHUB_STEP_SUMMARY=str(tmp / "summary"),
        )
        base.update({k: str(v) for k, v in dobles.items()})
        (tmp / "summary").touch()
        job_env = {k: ctx.resolver(v) for k, v in job["env"].items()}
        fallido, texto = False, ""
        for i, s in enumerate(job["steps"]):
            clave = s.get("id") or s["name"]
            if not ctx.evaluar_if(s.get("if"), fallido):
                ctx.resultados[clave] = "skipped"
                continue
            if "uses" in s:
                ctx.resultados[clave] = "success"
                continue
            entorno = dict(base, **job_env)
            entorno.update(
                {k: ctx.resolver(v) for k, v in (s.get("env") or {}).items()}
            )
            salida = tmp / f"output-{i}"
            salida.touch()
            entorno["GITHUB_OUTPUT"] = str(salida)
            guion = tmp / f"paso-{i}.sh"
            guion.write_text(s["run"], encoding="utf-8")
            r = subprocess.run(
                ["bash", "--noprofile", "--norc", "-e", str(guion)],
                cwd=tmp,
                capture_output=True,
                text=True,
                env=entorno,
                timeout=60,
            )
            texto += f"--- {s['name']} (rc={r.returncode})\n{r.stdout}{r.stderr}"
            ctx.resultados[clave] = "success" if r.returncode == 0 else "failure"
            if s.get("id"):
                ctx.salidas[s["id"]] = dict(
                    linea.split("=", 1)
                    for linea in salida.read_text(encoding="utf-8").splitlines()
                    if "=" in linea
                )
            if r.returncode != 0:
                fallido = True

        def log(n):
            f = registro / f"{n}.log"
            return f.read_text(encoding="utf-8").splitlines() if f.exists() else []

        class R:
            pass

        res = R()
        res.fallido, res.texto, res.ctx = fallido, texto, ctx
        res.live_final = (estado / "live").read_text(encoding="utf-8")
        res.resumen = (tmp / "summary").read_text(encoding="utf-8")
        res.curl, res.firebase, res.gcloud = log("curl"), log("firebase"), log("gcloud")
        res.clones = [
            linea for linea in res.firebase if linea.startswith("hosting:clone")
        ]
        return res


CLON_ROLLBACK = (
    f"hosting:clone {SITIO}:previa {SITIO}:live --project {SITIO} --non-interactive"
)
CLON_RESTAURAR = f"hosting:clone {SITIO}@abc123original {SITIO}:live --project {SITIO} --non-interactive"


class EstructuraTest(unittest.TestCase):
    def setUp(self):
        self.d = cargar()
        self.job = self.d["jobs"]["ensayo"]
        self.texto = WORKFLOW.read_text(encoding="utf-8")

    def test_solo_workflow_dispatch_con_confirmar(self):
        on = (
            self.d[True] if True in self.d else self.d["on"]
        )  # PyYAML lee `on` como True
        self.assertEqual(list(on), ["workflow_dispatch"])
        self.assertEqual(list(on["workflow_dispatch"]["inputs"]), ["confirmar"])

    def test_permisos_minimos_y_oidc_solo_en_el_job(self):
        self.assertEqual(self.d["permissions"], {"contents": "read"})
        self.assertEqual(
            self.job["permissions"], {"contents": "read", "id-token": "write"}
        )

    def test_environment_staging_timeout_y_concurrency(self):
        self.assertEqual(self.job["environment"]["name"], "staging")
        self.assertIn("timeout-minutes", self.job)
        self.assertEqual(
            self.job["concurrency"],
            {"group": "deploy-staging", "cancel-in-progress": False},
        )
        self.assertIn("concurrency", self.d)

    def test_nunca_produccion(self):
        self.assertNotIn("GCP_SA_DEPLOY_PROD", self.texto)
        self.assertNotIn("PROD_URL", self.texto)
        self.assertEqual(
            self.job["env"]["PROYECTO"], "${{ vars.GCP_PROJECT_ID_STAGING }}"
        )

    def test_pines_por_sha_y_sin_continue_on_error(self):
        for s in self.job["steps"]:
            if "uses" in s:
                self.assertRegex(s["uses"], r"^[\w.-]+/[\w.-]+@[0-9a-f]{40}$")
            self.assertNotIn("continue-on-error", s, s["name"])
        for linea in self.texto.splitlines():
            if re.match(r"\s*(- )?uses:", linea):
                self.assertRegex(linea, r"@[0-9a-f]{40} # v\d")

    def test_sin_interpolaciones_en_run_y_confirmar_solo_comparado(self):
        for s in self.job["steps"]:
            self.assertNotIn("${{", s.get("run", ""), s["name"])
        usos = re.findall(r"inputs\.confirmar[^}]*", self.texto)
        self.assertEqual(usos, ["inputs.confirmar == 'ROLLBACK-STAGING' "])

    def test_firebase_tools_fijado(self):
        self.assertEqual(self.d["env"]["FIREBASE_TOOLS_VERSION"], "15.28.1")

    def test_la_cabecera_avisa_que_toca_el_sitio_en_uso(self):
        self.assertIn("TOCA EL SITIO EN USO", self.texto)


class EnsayoTest(unittest.TestCase):
    def assertSinToken(self, r):
        self.assertNotIn(TOKEN, r.texto)
        self.assertNotIn(TOKEN, r.resumen)

    def test_camino_feliz_rollback_verificado_y_restaurado(self):
        r = simular()
        self.assertFalse(r.fallido, r.texto)
        self.assertEqual(r.clones, [CLON_ROLLBACK, CLON_RESTAURAR])
        self.assertEqual(r.live_final, ORIGINAL)
        self.assertIn("OK: rollback ensayado y versión original restaurada", r.resumen)
        self.assertIn("`abc123`", r.resumen)
        self.assertIn("`def456`", r.resumen)
        self.assertNotIn("abc123original", r.resumen)
        self.assertNotIn("def456previa", r.resumen)
        self.assertTrue(
            all(linea.endswith("auth=si") for linea in r.curl if "googleapis" in linea),
            r.curl,
        )
        self.assertSinToken(r)

    def test_confirmacion_distinta_no_toca_nada(self):
        for valor in (
            "",
            "rollback-staging",
            "DESPLEGAR",
            "ROLLBACK-STAGING; rm -rf /",
        ):
            r = simular(confirmar=valor)
            self.assertTrue(r.fallido, valor)
            self.assertEqual((r.curl, r.firebase, r.gcloud), ([], [], []), valor)
            self.assertEqual(
                r.ctx.resultados[
                    "Autenticar en GCP (WIF + impersonación, SA de staging)"
                ],
                "skipped",
            )

    def test_staging_igual_a_produccion_no_toca_nada(self):
        r = simular(vars_extra={"GCP_PROJECT_ID_PROD": SITIO})
        self.assertTrue(r.fallido)
        self.assertEqual((r.curl, r.firebase), ([], []))

    def assertNoTocado(self, r, mensaje):
        self.assertTrue(r.fallido, r.texto)
        self.assertIn(mensaje, r.texto)
        self.assertRegex(r.texto, r"(?i)no se (tocó|toca) nada")
        self.assertEqual(r.clones, [])
        self.assertEqual(r.live_final, ORIGINAL)
        self.assertEqual(r.ctx.resultados["restaurar"], "skipped")
        self.assertIn("NO EJECUTADO", r.resumen)
        self.assertSinToken(r)

    def test_previa_inexistente(self):
        self.assertNoTocado(simular(previa=None), "El canal 'previa' no existe")

    def test_previa_igual_a_live(self):
        self.assertNoTocado(simular(previa=ORIGINAL), "sirven la misma versión")

    def test_previa_por_caducar(self):
        self.assertNoTocado(simular(vence_en=600), "caduca en menos de una hora")

    def test_previa_no_finalizada(self):
        self.assertNoTocado(simular(PREVIA_ESTADO="ABANDONED"), "no FINALIZED")

    def test_sitio_caido_antes_del_ensayo(self):
        self.assertNoTocado(simular(HTTP_ORIGINAL=503), "responde 503 antes del ensayo")

    def test_api_de_live_falla(self):
        self.assertNoTocado(simular(API_LIVE_FALLA=1), "No se pudo leer el canal live")

    def test_clon_de_rollback_falla_restaura_sin_clonar_y_rojo(self):
        r = simular(RC_CLONE_ROLLBACK=1)
        self.assertTrue(r.fallido)
        self.assertEqual(r.clones, [CLON_ROLLBACK])
        self.assertEqual(r.ctx.resultados["restaurar"], "success", r.texto)
        self.assertIn("no hay nada que restaurar", r.texto)
        self.assertEqual(r.live_final, ORIGINAL)
        self.assertIn("FALLO durante el ensayo; versión original restaurada", r.resumen)

    def test_sitio_caido_con_previa_restaura_y_rojo(self):
        r = simular(HTTP_PREVIA=500)
        self.assertTrue(r.fallido)
        self.assertEqual(r.ctx.resultados["verificar"], "failure")
        self.assertEqual(r.clones, [CLON_ROLLBACK, CLON_RESTAURAR])
        self.assertEqual(r.live_final, ORIGINAL)
        self.assertIn("FALLO durante el ensayo; versión original restaurada", r.resumen)

    def test_tercera_version_no_se_pisa(self):
        r = simular(TERCERA=1)
        self.assertTrue(r.fallido)
        self.assertEqual(r.clones, [CLON_ROLLBACK])
        self.assertIn("tercera versión", r.texto)
        self.assertTrue(r.live_final.endswith("tercera999"))
        self.assertIn("la restauración no se completó", r.resumen)

    def test_restauracion_falla_rojo_y_lo_dice(self):
        r = simular(RC_CLONE_RESTAURAR=1)
        self.assertTrue(r.fallido)
        self.assertEqual(r.ctx.resultados["restaurar"], "failure")
        self.assertEqual(r.live_final, PREVIA)
        self.assertIn("la restauración no se completó", r.resumen)
        self.assertSinToken(r)


if __name__ == "__main__":
    unittest.main(verbosity=2)
