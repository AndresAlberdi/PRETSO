#!/usr/bin/env python3
"""Ensayo 10 de OPS-06, parte A: lógica del rollback automático de producción.

Por qué existe. El rollback automático vive al final del job
`desplegar-produccion` de .github/workflows/ci-node-firebase.yml (health check →
clonar el canal «previa» sobre live → fallar en rojo) y nunca se ha disparado:
producción no tiene despliegues y staging no tiene esos pasos. Esta prueba no
reemplaza el ensayo real (parte B, workflow probar-rollback-staging.yml), pero
verifica sin red y en segundos que la LÓGICA hace lo que el runbook promete.

Cómo. Se extrae con PyYAML el `run:` REAL de los pasos del job y se ejecuta con
bash (`bash --noprofile --norc -e`, el shell por defecto de GitHub Actions en
Linux cuando el paso no declara `shell:`) con dobles de `curl`, `sleep`, `npm`,
`npx`, `firebase` y `gcloud` en un directorio temporal al frente del PATH. Los
dobles registran sus argumentos y la prueba controla sus respuestas. Las
condiciones `if:` de los pasos se evalúan con un evaluador mínimo que solo
acepta las formas presentes hoy en el workflow (si alguien cambia una condición,
la prueba falla y obliga a revisarla) y aplica la regla de GitHub: sin función
de estado, la condición lleva implícito `success()`.

Resultado que define el workflow cuando el clon de «previa» falla: el paso de
rollback termina en VERDE (código 0) y solo emite `::error::` con las
instrucciones del rollback manual; el job queda en ROJO por el paso siguiente,
«Fallar si producción no responde». Si en cambio falla la instalación de
firebase-tools dentro del paso de rollback (`set -e`), ese paso termina en rojo
y el paso «Fallar…» se omite (su `if:` lleva implícito `success()`): el job
queda en rojo igual. Ambos caminos se prueban.

Uso: python3 -m unittest discover -s tests/workflows   (desde la raíz)
     python3 tests/workflows/test_rollback_automatico.py
"""

import os
import pathlib
import re
import subprocess
import tempfile
import unittest

import yaml

RAIZ = pathlib.Path(__file__).resolve().parents[2]
WORKFLOW = RAIZ / ".github" / "workflows" / "ci-node-firebase.yml"
JOB = "desplegar-produccion"

PASO_DESPLIEGUE = "Desplegar hosting + reglas (producción)"
ID_SALUD = "salud"
PASO_ROLLBACK = 'Rollback de hosting (clonar canal "previa" sobre live)'
PASO_FALLAR = "Fallar si producción no responde"

VARS_BASE = {
    "GCP_PROJECT_ID_PROD": "pretso-prod",
    "PROD_URL": "https://pretso-prod.web.app",
}

# Dobles. Cada uno añade una línea con sus argumentos a $REGISTRO/<nombre>.log.
DOBLE_CURL = r"""#!/usr/bin/env bash
printf '%s\n' "$*" >> "$REGISTRO/curl.log"
url=""
for a in "$@"; do url="$a"; done
n=$(( $(cat "$REGISTRO/curl.n" 2>/dev/null || echo 0) + 1 ))
echo "$n" > "$REGISTRO/curl.n"
if [[ "$url" == */ ]]; then
  printf '%s' "${CURL_RAIZ:-200}"
elif (( n <= ${CURL_FALLOS_ANTES:-0} )); then
  printf '%s' "${CURL_FALLO:-500}"
else
  printf '%s' "${CURL_SALUD:-200}"
fi
"""
DOBLE_FIREBASE = r"""#!/usr/bin/env bash
printf '%s\n' "$*" >> "$REGISTRO/firebase.log"
case "$1" in
  deploy) printf '%s\n' "${SALIDA_DEPLOY:-+  Deploy complete!}"; exit "${RC_DEPLOY:-0}" ;;
  hosting:clone) exit "${RC_CLONE:-0}" ;;
  *) exit 0 ;;
esac
"""
DOBLE_NPM = r"""#!/usr/bin/env bash
printf '%s\n' "$*" >> "$REGISTRO/npm.log"
exit "${RC_NPM:-0}"
"""
DOBLE_SIMPLE = r"""#!/usr/bin/env bash
printf '%s\n' "$*" >> "$REGISTRO/{nombre}.log"
exit 0
"""


def cargar_job():
    d = yaml.safe_load(WORKFLOW.read_text(encoding="utf-8"))
    return d["jobs"][JOB]


def paso(job, *, nombre=None, id_=None):
    pasos = [
        s
        for s in job["steps"]
        if (nombre is not None and s.get("name") == nombre)
        or (id_ is not None and s.get("id") == id_)
    ]
    if len(pasos) != 1:
        raise AssertionError(
            f"se esperaba un paso {nombre or id_!r} en {JOB} y hay {len(pasos)}"
        )
    return pasos[0]


def resolver(valor, vars_):
    """Resuelve el `env:` de un paso. Solo admite `${{ a || b || 'lit' }}` con
    términos `vars.X` o literales: cualquier otra forma hace fallar la prueba."""
    valor = str(valor)
    m = re.fullmatch(r"\$\{\{\s*(.+?)\s*\}\}", valor)
    if not m:
        if "${{" in valor:
            raise AssertionError(f"expresión no admitida por la prueba: {valor}")
        return valor
    for termino in (t.strip() for t in m.group(1).split("||")):
        if re.fullmatch(r"vars\.[A-Z0-9_]+", termino):
            v = vars_.get(termino[5:], "")
        elif re.fullmatch(r"'[^']*'", termino):
            v = termino[1:-1]
        else:
            raise AssertionError(
                f"término no admitido por la prueba: {termino!r} en {valor}"
            )
        if v:
            return v
    return ""


def evaluar_if(expr, job_fallido, salidas):
    """Evalúa las únicas formas de `if:` de los pasos simulados. Regla de GitHub:
    sin función de estado (success/failure/always/cancelled) se antepone success()."""
    if expr is None:
        return not job_fallido
    expr = str(expr).strip()
    if re.search(r"\b(success|failure|always|cancelled)\s*\(", expr):
        raise AssertionError(
            f"la condición usa una función de estado; actualice la prueba: {expr}"
        )
    m = re.fullmatch(r"steps\.([\w-]+)\.outputs\.([\w-]+)\s*==\s*'([^']*)'", expr)
    if not m:
        raise AssertionError(f"condición no admitida por la prueba: {expr}")
    return (not job_fallido) and salidas.get(m.group(1), {}).get(
        m.group(2), ""
    ) == m.group(3)


class Simulacion:
    """Ejecuta los pasos desde el despliegue hasta el final del job."""

    def __init__(self, tmp, vars_, entorno_dobles):
        self.tmp = pathlib.Path(tmp)
        self.registro = self.tmp / "registro"
        self.registro.mkdir()
        binarios = self.tmp / "bin"
        binarios.mkdir()
        dobles = {"curl": DOBLE_CURL, "firebase": DOBLE_FIREBASE, "npm": DOBLE_NPM}
        for nombre in ("sleep", "npx", "gcloud"):
            dobles[nombre] = DOBLE_SIMPLE.replace("{nombre}", nombre)
        for nombre, texto in dobles.items():
            f = binarios / nombre
            f.write_text(texto, encoding="utf-8")
            f.chmod(0o755)
        self.vars = vars_
        self.base = dict(os.environ)
        self.base.update(
            PATH=f"{binarios}:{os.environ['PATH']}",
            REGISTRO=str(self.registro),
            FIREBASE_TOOLS_VERSION="15.28.1",
            GITHUB_REF_NAME="v9.9.9",
            GITHUB_RUN_ID="1",
            GITHUB_STEP_SUMMARY=str(self.tmp / "summary"),
        )
        self.base.update(entorno_dobles)
        self.resultados = {}  # nombre del paso -> "omitido" | código de salida
        self.salidas = {}  # id -> {clave: valor}
        self.texto = ""

    def ejecutar(self, job):
        nombres = [s.get("name") for s in job["steps"]]
        desde = nombres.index(PASO_DESPLIEGUE)
        fallido = False
        for s in job["steps"][desde:]:
            if not evaluar_if(s.get("if"), fallido, self.salidas):
                self.resultados[s["name"]] = "omitido"
                continue
            run = s["run"]
            if s["name"] == PASO_DESPLIEGUE:
                # El paso escribe su registro en /tmp; en la prueba va al temporal.
                assert "/tmp/despliegue.log" in run
                run = run.replace(
                    "/tmp/despliegue.log", str(self.tmp / "despliegue.log")
                )
            entorno = dict(self.base)
            entorno.update(
                {k: resolver(v, self.vars) for k, v in (s.get("env") or {}).items()}
            )
            salida = self.tmp / f"output-{len(self.resultados)}"
            salida.touch()
            entorno["GITHUB_OUTPUT"] = str(salida)
            guion = self.tmp / f"paso-{len(self.resultados)}.sh"
            guion.write_text(run, encoding="utf-8")
            r = subprocess.run(
                ["bash", "--noprofile", "--norc", "-e", str(guion)],
                cwd=self.tmp,
                capture_output=True,
                text=True,
                env=entorno,
                timeout=60,
            )
            self.texto += f"--- {s['name']} (rc={r.returncode})\n{r.stdout}{r.stderr}"
            self.resultados[s["name"]] = r.returncode
            if s.get("id"):
                pares = [
                    linea.split("=", 1)
                    for linea in salida.read_text(encoding="utf-8").splitlines()
                    if "=" in linea
                ]
                self.salidas[s["id"]] = dict(pares)
            if r.returncode != 0 and not s.get("continue-on-error"):
                fallido = True
        self.job_fallido = fallido
        return self

    def log(self, nombre):
        f = self.registro / f"{nombre}.log"
        return f.read_text(encoding="utf-8").splitlines() if f.exists() else []


def simular(vars_extra=None, **entorno_dobles):
    job = cargar_job()
    vars_ = dict(VARS_BASE, **(vars_extra or {}))
    with tempfile.TemporaryDirectory() as tmp:
        sim = Simulacion(tmp, vars_, {k: str(v) for k, v in entorno_dobles.items()})
        sim.ejecutar(job)
        sim.registros = {
            n: sim.log(n) for n in ("curl", "firebase", "npm", "sleep", "npx", "gcloud")
        }
        return sim


def clones(sim):
    return [
        linea
        for linea in sim.registros["firebase"]
        if linea.startswith("hosting:clone")
    ]


class EstructuraTest(unittest.TestCase):
    """Lo que la simulación da por hecho, comprobado sobre el workflow."""

    def setUp(self):
        self.job = cargar_job()

    def test_pasos_en_orden_y_al_final_del_job(self):
        nombres = [s.get("name") for s in self.job["steps"]]
        salud = paso(self.job, id_=ID_SALUD)["name"]
        self.assertEqual(
            nombres[-4:], [PASO_DESPLIEGUE, salud, PASO_ROLLBACK, PASO_FALLAR]
        )

    def test_ningun_paso_simulado_relaja_el_fallo_ni_cambia_de_shell(self):
        for nombre in (PASO_DESPLIEGUE, PASO_ROLLBACK, PASO_FALLAR):
            s = paso(self.job, nombre=nombre)
            self.assertNotIn("continue-on-error", s, nombre)
            self.assertNotIn("shell", s, nombre)
        s = paso(self.job, id_=ID_SALUD)
        self.assertNotIn("continue-on-error", s)
        self.assertNotIn(
            "if", s, "el health check debe correr siempre que el despliegue haya pasado"
        )

    def test_condiciones_del_rollback_y_del_fallo(self):
        for nombre in (PASO_ROLLBACK, PASO_FALLAR):
            self.assertEqual(
                paso(self.job, nombre=nombre).get("if"),
                "steps.salud.outputs.ok == 'false'",
                nombre,
            )

    def test_salida_del_job_expone_la_salud(self):
        self.assertEqual(
            self.job["outputs"]["salud_ok"], "${{ steps.salud.outputs.ok }}"
        )

    def test_health_check_usa_HEALTH_PATH_con_valor_por_defecto(self):
        env = paso(self.job, id_=ID_SALUD)["env"]
        self.assertEqual(env["RUTA_SALUD"], "${{ vars.HEALTH_PATH || '/health' }}")
        self.assertEqual(env["URL"], "${{ vars.PROD_URL }}")

    def test_sin_interpolaciones_en_los_run(self):
        for s in (
            paso(self.job, id_=ID_SALUD),
            paso(self.job, nombre=PASO_ROLLBACK),
            paso(self.job, nombre=PASO_FALLAR),
        ):
            self.assertNotIn("${{", s["run"], s["name"])


class RollbackTest(unittest.TestCase):
    def assertJobRojo(self, sim):
        self.assertTrue(sim.job_fallido, sim.texto)

    def assertJobVerde(self, sim):
        self.assertFalse(sim.job_fallido, sim.texto)

    def test_salud_ok_al_primer_intento_no_hace_rollback(self):
        sim = simular(CURL_SALUD=200)
        self.assertEqual(sim.salidas["salud"], {"ok": "true"}, sim.texto)
        self.assertEqual(len(sim.registros["curl"]), 1, sim.texto)
        self.assertEqual(sim.registros["sleep"], [])
        self.assertEqual(sim.resultados[PASO_ROLLBACK], "omitido")
        self.assertEqual(sim.resultados[PASO_FALLAR], "omitido")
        self.assertEqual(clones(sim), [])
        self.assertJobVerde(sim)

    def test_salud_se_recupera_al_tercer_intento_no_hace_rollback(self):
        sim = simular(CURL_FALLOS_ANTES=2, CURL_FALLO=503)
        self.assertEqual(sim.salidas["salud"], {"ok": "true"}, sim.texto)
        self.assertEqual(len(sim.registros["curl"]), 3)
        self.assertEqual(sim.registros["sleep"], ["15", "15"])
        self.assertEqual(clones(sim), [])
        self.assertJobVerde(sim)

    def test_diez_fallos_hacen_rollback_exacto_y_el_job_queda_en_rojo(self):
        sim = simular(CURL_SALUD=500)
        self.assertEqual(sim.salidas["salud"], {"ok": "false"}, sim.texto)
        self.assertEqual(len(sim.registros["curl"]), 10)
        self.assertEqual(sim.registros["sleep"], ["15"] * 10)
        # El health check en sí sale con 0: el rojo lo pone el paso final.
        self.assertEqual(sim.resultados[paso(cargar_job(), id_=ID_SALUD)["name"]], 0)
        self.assertIn("Producción no responde 200 tras 10 intentos", sim.texto)
        self.assertEqual(
            clones(sim),
            ["hosting:clone pretso-prod:previa pretso-prod:live --project pretso-prod"],
        )
        self.assertIn("i -g firebase-tools@15.28.1", sim.registros["npm"])
        self.assertEqual(sim.resultados[PASO_ROLLBACK], 0)
        self.assertIn("::warning::ROLLBACK ejecutado", sim.texto)
        self.assertEqual(sim.resultados[PASO_FALLAR], 1)
        self.assertJobRojo(sim)

    def test_rollback_usa_FIREBASE_SITE_ID_si_esta_definido(self):
        sim = simular({"FIREBASE_SITE_ID": "sitio-propio"}, CURL_SALUD=500)
        self.assertEqual(
            clones(sim),
            [
                "hosting:clone sitio-propio:previa sitio-propio:live --project pretso-prod"
            ],
        )
        self.assertJobRojo(sim)

    def test_404_en_la_ruta_de_salud_con_raiz_200_es_salud_ok(self):
        sim = simular(CURL_SALUD=404, CURL_RAIZ=200)
        self.assertEqual(sim.salidas["salud"], {"ok": "true"}, sim.texto)
        urls = [linea.split()[-1] for linea in sim.registros["curl"]]
        self.assertEqual(
            urls, ["https://pretso-prod.web.app/health", "https://pretso-prod.web.app/"]
        )
        self.assertEqual(clones(sim), [])
        self.assertJobVerde(sim)

    def test_404_en_la_ruta_de_salud_con_raiz_caida_hace_rollback(self):
        sim = simular(CURL_SALUD=404, CURL_RAIZ=500)
        self.assertEqual(sim.salidas["salud"], {"ok": "false"}, sim.texto)
        self.assertEqual(len(sim.registros["curl"]), 20)
        self.assertEqual(len(clones(sim)), 1)
        self.assertJobRojo(sim)

    def test_clon_fallido_paso_de_rollback_verde_con_error_y_job_en_rojo(self):
        sim = simular(CURL_SALUD=500, RC_CLONE=1)
        self.assertEqual(len(clones(sim)), 1)
        # Resultado definido por el workflow: el paso de rollback NO falla; anota
        # ::error:: con el procedimiento manual, y el rojo lo pone «Fallar…».
        self.assertEqual(sim.resultados[PASO_ROLLBACK], 0, sim.texto)
        self.assertIn("::error::Rollback automático no disponible", sim.texto)
        self.assertNotIn("::warning::ROLLBACK ejecutado", sim.texto)
        self.assertEqual(sim.resultados[PASO_FALLAR], 1)
        self.assertJobRojo(sim)

    def test_si_falla_instalar_firebase_tools_el_rollback_falla_y_el_job_queda_en_rojo(
        self,
    ):
        sim = simular(CURL_SALUD=500, RC_NPM=1)
        self.assertNotEqual(sim.resultados[PASO_ROLLBACK], 0, sim.texto)
        self.assertEqual(clones(sim), [])
        # «Fallar…» lleva implícito success(): se omite, pero el job ya está en rojo.
        self.assertEqual(sim.resultados[PASO_FALLAR], "omitido")
        self.assertJobRojo(sim)

    def test_si_el_despliegue_falla_no_hay_health_check_ni_rollback(self):
        sim = simular(
            RC_DEPLOY=1, SALIDA_DEPLOY="Error: HTTP Error: 403, permiso denegado"
        )
        self.assertNotEqual(sim.resultados[PASO_DESPLIEGUE], 0)
        self.assertEqual(
            sim.resultados[paso(cargar_job(), id_=ID_SALUD)["name"]], "omitido"
        )
        self.assertEqual(sim.resultados[PASO_ROLLBACK], "omitido")
        self.assertEqual(sim.resultados[PASO_FALLAR], "omitido")
        self.assertNotIn("salud", sim.salidas)  # salud_ok del job queda vacío
        self.assertEqual(sim.registros["curl"], [])
        self.assertEqual(clones(sim), [])
        self.assertJobRojo(sim)

    def test_despliegue_que_miente_tampoco_dispara_rollback(self):
        sim = simular(
            SALIDA_DEPLOY="Functions deploy had errors: failed to create function api\n+  Deploy complete!"
        )
        self.assertNotEqual(sim.resultados[PASO_DESPLIEGUE], 0, sim.texto)
        self.assertEqual(sim.resultados[PASO_ROLLBACK], "omitido")
        self.assertJobRojo(sim)

    def test_health_check_usa_HEALTH_PATH(self):
        sim = simular(
            {"HEALTH_PATH": "/estado.json", "PROD_URL": "https://pretso-prod.web.app/"},
            CURL_SALUD=200,
        )
        self.assertEqual(
            [linea.split()[-1] for linea in sim.registros["curl"]],
            ["https://pretso-prod.web.app/estado.json"],
        )
        self.assertIn("--max-time 15", sim.registros["curl"][0])
        self.assertJobVerde(sim)

    def test_sin_red_ni_otras_herramientas(self):
        sim = simular(CURL_SALUD=500)
        self.assertEqual(sim.registros["npx"], [])
        self.assertEqual(sim.registros["gcloud"], [])


class EvaluadorTest(unittest.TestCase):
    """Controles del propio arnés: si estos fallan, la simulación no es fiable."""

    def test_condicion_implicita_success(self):
        self.assertFalse(
            evaluar_if(
                "steps.salud.outputs.ok == 'false'", True, {"salud": {"ok": "false"}}
            )
        )
        self.assertTrue(
            evaluar_if(
                "steps.salud.outputs.ok == 'false'", False, {"salud": {"ok": "false"}}
            )
        )
        self.assertFalse(evaluar_if("steps.salud.outputs.ok == 'false'", False, {}))

    def test_rechaza_formas_desconocidas(self):
        with self.assertRaises(AssertionError):
            evaluar_if("always() && steps.salud.outputs.ok == 'false'", False, {})
        with self.assertRaises(AssertionError):
            resolver("${{ secrets.X }}", {})


if __name__ == "__main__":
    unittest.main(verbosity=2)
