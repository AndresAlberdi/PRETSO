#!/usr/bin/env bash
# ==============================================================================
# security-local.sh — Equivalente local de _reusable-security.yml
# ==============================================================================
# Versión: 2.0 | Fecha: 2026-08-24
# Documentos relacionados: 00-gobernanza/01-politica-cicd-devsecops.md (secciones 3.1, 6 y 8),
#   02-pipelines/workflows/_reusable-security.yml, 02-pipelines/config/{gitleaks.toml,semgrep.yml,trivy.yaml}
#
# Uso:
#   ./security-local.sh [--umbral HIGH|MEDIUM|LOW] [--instalar] [--ruta DIR]
#                       [--solo herr1,herr2] [--sin-historial] [--informe DIR]
#
# Ejecuta con herramientas OSS los mismos controles de la fase
# `seguridad-estatica` del pipeline: secretos (gitleaks), SAST (semgrep),
# SCA (osv-scanner, npm audit, pip-audit), IaC y Dockerfile (trivy, checkov).
# Usa los mismos archivos de configuración que CI (.github/gitleaks.toml,
# .github/semgrep.yml, .github/trivy.yaml) si existen, para que "en mi máquina pasaba" no ocurra.
#
# Excepciones (D5): igual que el job `preparar` de _reusable-security.yml, este
# script lee `seguridad.excepciones[]` de .devsecops.yml, descarta las vencidas
# y GENERA los archivos/listas de ignorado por herramienta: .trivyignore.yaml
# (trivy), .gitleaksignore (gitleaks), --skip-check (checkov), --exclude-rule
# (semgrep) y --ignore-vuln (pip-audit). Los archivos generados NUNCA se
# versionan (se añaden a .gitignore) ni se editan a mano.
#
# Resultado: informe en .security-reports/<fecha>/ (resumen.md, resumen.json y
# la salida cruda de cada herramienta) y enlace .security-reports/ultimo.
#
# Códigos de salida:
#   0  sin hallazgos por encima del umbral (o todos exceptuados)
#   1  hay hallazgos ≥ umbral no exceptuados (BLOQUEA)
#   2  uso incorrecto
#   3  error de ejecución (dependencia faltante indispensable, ruta inválida)
# ==============================================================================
set -Eeuo pipefail

readonly SCRIPT_VERSION="2.0"
readonly MANIFIESTO=".devsecops.yml"
readonly INFORMES_BASE_DEFECTO=".security-reports"
# Versiones fijadas para --instalar (mismas que usa el pipeline; actualícelas
# junto con _reusable-security.yml para conservar la paridad local/CI).
readonly GITLEAKS_VERSION="8.30.1"
readonly TRIVY_VERSION="0.70.0"
readonly OSV_SCANNER_VERSION="2.5.1"
readonly SEMGREP_VERSION="1.174.0"
readonly CHECKOV_VERSION="3.3.13"
readonly BIN_DIR="${HOME}/.local/bin"

UMBRAL="HIGH"
INSTALAR=0
RUTA="."
SOLO=""
SIN_HISTORIAL=0
INFORMES_BASE="$INFORMES_BASE_DEFECTO"
INFORME_DIR=""
declare -a FALTANTES=()
declare -a EJECUTADAS=()
STACK_NODE=0; STACK_PYTHON=0; STACK_DOCKER=0; STACK_IAC=0
# Excepciones vigentes generadas desde el manifiesto (mismos artefactos que el
# job `preparar` de _reusable-security.yml).
CHECKOV_SKIP=""      # IDs CKV_* separados por comas (checkov --skip-check)
SEMGREP_EXCLUDE=""   # "--exclude-rule id ..." (semgrep)
PIP_IGNORE=""        # "--ignore-vuln ID ..." (pip-audit)

if [[ -t 1 ]] && [[ -z "${NO_COLOR:-}" ]]; then
  C_ROJO=$'\033[31m'; C_VERDE=$'\033[32m'; C_AMARILLO=$'\033[33m'
  C_AZUL=$'\033[34m'; C_NEGRITA=$'\033[1m'; C_RESET=$'\033[0m'
else
  C_ROJO=""; C_VERDE=""; C_AMARILLO=""; C_AZUL=""; C_NEGRITA=""; C_RESET=""
fi
log_info()  { printf '%s[INFO]%s %s\n' "$C_AZUL" "$C_RESET" "$*"; }
log_ok()    { printf '%s[OK]%s   %s\n' "$C_VERDE" "$C_RESET" "$*"; }
log_warn()  { printf '%s[AVISO]%s %s\n' "$C_AMARILLO" "$C_RESET" "$*" >&2; }
log_error() { printf '%s[ERROR]%s %s\n' "$C_ROJO" "$C_RESET" "$*" >&2; }
log_seccion() { printf '\n%s--- %s ---%s\n' "$C_NEGRITA" "$*" "$C_RESET"; }
die() { local c="$1"; shift; log_error "$*"; exit "$c"; }

mostrar_ayuda() {
  cat <<EOF
security-local.sh v${SCRIPT_VERSION} — seguridad estática local (paridad con _reusable-security.yml)

Uso:
  ./security-local.sh [opciones]

Opciones:
  --umbral <HIGH|MEDIUM|LOW>  Severidad mínima que bloquea (código 1). Por defecto HIGH.
                              La política no permite relajar por debajo de HIGH; CRITICAL se rechaza.
                              Si el manifiesto declara bloquear_en con MEDIUM, ese umbral prevalece.
  --instalar                  Instala las herramientas faltantes con VERSIONES FIJADAS
                              (gitleaks v${GITLEAKS_VERSION}, trivy v${TRIVY_VERSION}, osv-scanner v${OSV_SCANNER_VERSION},
                              semgrep ${SEMGREP_VERSION}, checkov ${CHECKOV_VERSION}); binarios en ${BIN_DIR}.
                              Sin esta opción solo se informa el comando de instalación.
  --ruta <DIR>                Directorio a analizar (por defecto el actual).
  --solo <lista>              Ejecuta solo estas herramientas, separadas por coma:
                              gitleaks,semgrep,osv-scanner,trivy,checkov,npm-audit,pip-audit
  --sin-historial             gitleaks analiza solo el árbol de trabajo (no el historial git).
  --informe <DIR>             Directorio base de informes (por defecto ${INFORMES_BASE_DEFECTO}/).
  -h, --help                  Muestra esta ayuda.

Excepciones: la única fuente es ${MANIFIESTO} (seguridad.excepciones[]: id,
  herramienta, vence). Una excepción vencida vuelve a bloquear. Desde el
  manifiesto se GENERAN .trivyignore.yaml, .gitleaksignore y las listas de
  ignorado de checkov/semgrep/pip-audit (los mismos artefactos que el job
  'preparar' de _reusable-security.yml); esos archivos no se versionan ni se
  editan a mano (política, sección 8).

Códigos de salida: 0 limpio | 1 hallazgos ≥ umbral | 2 uso | 3 error de ejecución
EOF
}

analizar_argumentos() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --umbral)   [[ $# -ge 2 ]] || die 2 "--umbral requiere un valor"; UMBRAL="${2^^}"; shift ;;
      --instalar) INSTALAR=1 ;;
      --ruta)     [[ $# -ge 2 ]] || die 2 "--ruta requiere un directorio"; RUTA="$2"; shift ;;
      --solo)     [[ $# -ge 2 ]] || die 2 "--solo requiere una lista"; SOLO="$2"; shift ;;
      --sin-historial) SIN_HISTORIAL=1 ;;
      --informe)  [[ $# -ge 2 ]] || die 2 "--informe requiere un directorio"; INFORMES_BASE="$2"; shift ;;
      -h|--help)  mostrar_ayuda; exit 0 ;;
      *) log_error "Argumento no reconocido: $1"; mostrar_ayuda; exit 2 ;;
    esac
    shift
  done
  case "$UMBRAL" in
    HIGH|MEDIUM|LOW) ;;
    CRITICAL) die 2 "La política exige bloquear al menos en HIGH; --umbral CRITICAL no está permitido." ;;
    *) die 2 "Umbral inválido: $UMBRAL (use HIGH, MEDIUM o LOW)" ;;
  esac
  [[ -d "$RUTA" ]] || die 3 "La ruta no existe: $RUTA"
}

herramienta_activa() {
  # herramienta_activa <nombre>: true si no hay --solo o si el nombre está en la lista.
  [[ -z "$SOLO" ]] && return 0
  [[ ",${SOLO}," == *",$1,"* ]]
}

# ------------------------------------------------------------------------------
# Detección de stack (mismos criterios que la fase preparar del pipeline)
# ------------------------------------------------------------------------------
detectar_stack() {
  log_seccion "Detección de stack en $(cd "$RUTA" && pwd)"
  [[ -f package.json ]] && STACK_NODE=1
  [[ -f requirements.txt || -f pyproject.toml ]] && STACK_PYTHON=1
  compgen -G "Dockerfile*" >/dev/null && STACK_DOCKER=1
  if compgen -G "*.tf" >/dev/null || compgen -G "**/*.tf" >/dev/null 2>&1 \
     || [[ -d k8s || -d kubernetes || -d terraform || -d infra ]] || compgen -G "*.yaml" >/dev/null; then
    STACK_IAC=1
  fi
  log_info "node=$STACK_NODE python=$STACK_PYTHON docker=$STACK_DOCKER iac=$STACK_IAC"
}

# ------------------------------------------------------------------------------
# Excepciones vigentes: genera desde .devsecops.yml los MISMOS artefactos que el
# job `preparar` de _reusable-security.yml: .trivyignore.yaml, .gitleaksignore
# y las listas para checkov (--skip-check), semgrep (--exclude-rule) y
# pip-audit (--ignore-vuln). Los archivos generados NO se versionan.
# ------------------------------------------------------------------------------
generar_excepciones() {
  log_seccion "Excepciones vigentes desde $MANIFIESTO"
  if ! command -v python3 >/dev/null 2>&1; then
    log_warn "python3 no disponible: no se generan los archivos de excepciones (se aplican igualmente en la consolidación)"
    return 0
  fi
  local salida
  if ! salida="$(python3 - <<'PY'
import datetime as dt, pathlib, sys
try:
    import yaml
except ImportError:
    print("[AVISO] PyYAML no instalado: no se leen excepciones del manifiesto", file=sys.stderr)
    yaml = None
hoy = dt.date.today()
m = {}
if yaml and pathlib.Path(".devsecops.yml").is_file():
    with open(".devsecops.yml", encoding="utf-8") as f:
        m = yaml.safe_load(f) or {}
vigentes, trivy_vuln, trivy_misc, gitleaks = [], [], [], []
checkov, semgrep, pip = [], [], []
for e in (m.get("seguridad", {}) or {}).get("excepciones", []) or []:
    vence = e.get("vence")
    try:
        if not isinstance(vence, dt.date):
            vence = dt.date.fromisoformat(str(vence))
    except Exception:
        print(f"[AVISO] Excepción con fecha inválida descartada: {e.get('id')}", file=sys.stderr)
        continue
    if vence < hoy:
        print(f"[AVISO] Excepción vencida descartada: {e.get('id')} ({e.get('herramienta')}, venció {vence})", file=sys.stderr)
        continue
    vigentes.append(e)
    h, i = e.get("herramienta", ""), str(e.get("id", ""))
    if h == "trivy":
        destino = trivy_vuln if i.upper().startswith(("CVE-", "GHSA-")) else trivy_misc
        destino.append(f'  - id: {i}\n    statement: "{e.get("justificacion", "")} (aprobó {e.get("aprobado_por", "")})"\n    expired_at: {vence}')
    elif h == "checkov":
        checkov.append(i)
    elif h == "semgrep":
        semgrep.append(f"--exclude-rule {i}")
    elif h == "pip-audit":
        pip.append(f"--ignore-vuln {i}")
    elif h == "gitleaks":
        gitleaks.append(f"{i}  # vence {vence}: {e.get('justificacion', '')}")
pathlib.Path(".trivyignore.yaml").write_text(
    "# Generado por security-local.sh desde .devsecops.yml. NO editar ni versionar.\n"
    + "vulnerabilities:\n" + ("\n".join(trivy_vuln) + "\n" if trivy_vuln else "  []\n")
    + "misconfigurations:\n" + ("\n".join(trivy_misc) + "\n" if trivy_misc else "  []\n"), encoding="utf-8")
pathlib.Path(".gitleaksignore").write_text(
    "# Generado desde .devsecops.yml (fingerprints commit:archivo:regla:linea). NO versionar.\n"
    + "".join(l + "\n" for l in gitleaks), encoding="utf-8")
print("CHECKOV_SKIP\t" + ",".join(checkov))
print("SEMGREP_EXCLUDE\t" + " ".join(semgrep))
print("PIP_IGNORE\t" + " ".join(pip))
print(f"[INFO] Excepciones vigentes aplicables: {len(vigentes)}", file=sys.stderr)
PY
  )"; then
    log_warn "No se pudieron generar los archivos de excepciones; se continúa sin ellos"
    return 0
  fi
  local clave valor
  while IFS=$'\t' read -r clave valor; do
    case "$clave" in
      CHECKOV_SKIP)    CHECKOV_SKIP="$valor" ;;
      SEMGREP_EXCLUDE) SEMGREP_EXCLUDE="$valor" ;;
      PIP_IGNORE)      PIP_IGNORE="$valor" ;;
    esac
  done <<< "$salida"
  # Los archivos generados nunca se versionan.
  asegurar_gitignore ".trivyignore.yaml"
  asegurar_gitignore ".gitleaksignore"
  asegurar_gitignore ".trivy-cache/"
  log_ok "Generados .trivyignore.yaml y .gitleaksignore (checkov: '${CHECKOV_SKIP:-—}'; semgrep: '${SEMGREP_EXCLUDE:-—}'; pip-audit: '${PIP_IGNORE:-—}')"
}

# ------------------------------------------------------------------------------
# Inventario de herramientas
# ------------------------------------------------------------------------------
comando_instalacion() {
  # Devuelve el comando de instalación sugerido, siempre con versión fijada
  # (nunca "latest" ni repositorios añadidos sin versión).
  local herramienta="$1"
  case "$herramienta" in
    gitleaks)    echo "./security-local.sh --instalar  (binario v${GITLEAKS_VERSION} de github.com/gitleaks/gitleaks/releases)" ;;
    trivy)       echo "./security-local.sh --instalar  (binario v${TRIVY_VERSION} de github.com/aquasecurity/trivy/releases)" ;;
    osv-scanner) echo "./security-local.sh --instalar  (binario v${OSV_SCANNER_VERSION} de github.com/google/osv-scanner/releases)" ;;
    semgrep)     echo "python3 -m pip install --user 'semgrep==${SEMGREP_VERSION}'" ;;
    checkov)     echo "python3 -m pip install --user 'checkov==${CHECKOV_VERSION}'" ;;
    pip-audit)   echo "python3 -m pip install --user pip-audit" ;;
    npm)         echo "instale Node.js 22 LTS (incluye npm): https://nodejs.org" ;;
    *) echo "consulte la documentación de $herramienta" ;;
  esac
}

# descargar_binario <url> <nombre> [miembro_tar]: descarga a ${BIN_DIR} un
# binario suelto o lo extrae de un tar.gz, y lo deja ejecutable.
descargar_binario() {
  local url="$1" nombre="$2" miembro="${3:-}"
  mkdir -p "$BIN_DIR"
  if [[ -n "$miembro" ]]; then
    curl -fsSL "$url" | tar -xz -C "$BIN_DIR" "$miembro" || return 1
  else
    curl -fsSL -o "${BIN_DIR}/${nombre}" "$url" || return 1
  fi
  chmod +x "${BIN_DIR}/${nombre}"
  case ":$PATH:" in *":${BIN_DIR}:"*) ;; *) export PATH="${BIN_DIR}:${PATH}" ;; esac
}

instalar_herramienta() {
  # Instalación con versión fijada (paridad con CI). Binarios oficiales de las
  # releases de GitHub para gitleaks/trivy/osv-scanner; pip con == para el resto.
  local herramienta="$1" so arch a so_trivy rc=0
  so="$(uname -s | tr '[:upper:]' '[:lower:]')"   # linux | darwin
  arch="$(uname -m)"                              # x86_64 | aarch64 | arm64
  log_info "Instalando $herramienta (versión fijada)..."
  case "$herramienta" in
    gitleaks)
      case "$arch" in x86_64|amd64) a="x64" ;; aarch64|arm64) a="arm64" ;; *) log_warn "Arquitectura no soportada: $arch"; return 1 ;; esac
      descargar_binario "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS_VERSION}/gitleaks_${GITLEAKS_VERSION}_${so}_${a}.tar.gz" gitleaks gitleaks || rc=1 ;;
    trivy)
      case "$so" in linux) so_trivy="Linux" ;; darwin) so_trivy="macOS" ;; *) log_warn "Sistema no soportado: $so"; return 1 ;; esac
      case "$arch" in x86_64|amd64) a="64bit" ;; aarch64|arm64) a="ARM64" ;; *) log_warn "Arquitectura no soportada: $arch"; return 1 ;; esac
      descargar_binario "https://github.com/aquasecurity/trivy/releases/download/v${TRIVY_VERSION}/trivy_${TRIVY_VERSION}_${so_trivy}-${a}.tar.gz" trivy trivy || rc=1 ;;
    osv-scanner)
      case "$arch" in x86_64|amd64) a="amd64" ;; aarch64|arm64) a="arm64" ;; *) log_warn "Arquitectura no soportada: $arch"; return 1 ;; esac
      descargar_binario "https://github.com/google/osv-scanner/releases/download/v${OSV_SCANNER_VERSION}/osv-scanner_${so}_${a}" osv-scanner || rc=1 ;;
    semgrep)   python3 -m pip install --quiet --user "semgrep==${SEMGREP_VERSION}" || rc=1 ;;
    checkov)   python3 -m pip install --quiet --user "checkov==${CHECKOV_VERSION}" || rc=1 ;;
    pip-audit) python3 -m pip install --quiet --user pip-audit || rc=1 ;;
    *)
      log_warn "No hay instalación automática para $herramienta: $(comando_instalacion "$herramienta")"
      return 1 ;;
  esac
  [[ $rc -eq 0 ]] || { log_warn "La instalación de $herramienta falló"; return 1; }
  hash -r
  command -v "$herramienta" >/dev/null 2>&1
}

disponible() {
  # disponible <herramienta>: true si está en PATH; si no, la registra como faltante
  # (o la instala con --instalar).
  local herramienta="$1"
  if command -v "$herramienta" >/dev/null 2>&1; then
    return 0
  fi
  if [[ "$INSTALAR" -eq 1 ]] && instalar_herramienta "$herramienta"; then
    return 0
  fi
  FALTANTES+=("$herramienta")
  return 1
}

# ------------------------------------------------------------------------------
# Ejecución de cada herramienta (siempre con salida JSON al directorio de informe)
# ------------------------------------------------------------------------------
# registrar_ejecucion <herramienta> <json>: una herramienta cuenta como ejecutada
# solo si produjo su archivo de resultados; si no (sin red, error de reglas), se
# avisa y no se da por cubierta.
registrar_ejecucion() {
  local herramienta="$1" archivo="$2"
  if [[ -s "$archivo" ]]; then
    EJECUTADAS+=("$herramienta")
    log_ok "$herramienta completado"
  else
    log_warn "$herramienta no produjo resultados; revise ${archivo%.json}.log (¿sin red para descargar reglas/BD?)"
  fi
}

correr_gitleaks() {
  herramienta_activa gitleaks || return 0
  log_seccion "gitleaks (secretos)"
  disponible gitleaks || { log_warn "gitleaks no disponible: $(comando_instalacion gitleaks)"; return 0; }
  local -a args=(detect --source . --report-format json --report-path "$INFORME_DIR/gitleaks.json" --exit-code 0 --redact)
  [[ -f .github/gitleaks.toml ]] && args+=(--config .github/gitleaks.toml)
  { [[ "$SIN_HISTORIAL" -eq 1 ]] || ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; } && args+=(--no-git)
  gitleaks "${args[@]}" >"$INFORME_DIR/gitleaks.log" 2>&1 || log_warn "gitleaks terminó con error; revise $INFORME_DIR/gitleaks.log"
  # gitleaks no escribe el informe cuando no hay hallazgos; se normaliza a lista vacía.
  [[ -s "$INFORME_DIR/gitleaks.json" ]] || { grep -q "no leaks found" "$INFORME_DIR/gitleaks.log" 2>/dev/null && echo "[]" > "$INFORME_DIR/gitleaks.json"; }
  registrar_ejecucion gitleaks "$INFORME_DIR/gitleaks.json"
}

correr_semgrep() {
  herramienta_activa semgrep || return 0
  log_seccion "semgrep (SAST)"
  disponible semgrep || { log_warn "semgrep no disponible: $(comando_instalacion semgrep)"; return 0; }
  # Mismos rulesets que el workflow reusable; las reglas propias del proyecto en .github/semgrep.yml.
  local -a args=(scan --config p/ci --config p/owasp-top-ten --config p/secrets --json --metrics=off --quiet -o "$INFORME_DIR/semgrep.json")
  [[ -f .github/semgrep.yml ]] && args+=(--config .github/semgrep.yml)
  # Excepciones vigentes del manifiesto: "--exclude-rule id ..."
  if [[ -n "$SEMGREP_EXCLUDE" ]]; then
    local -a excl=()
    read -r -a excl <<< "$SEMGREP_EXCLUDE"
    args+=("${excl[@]}")
  fi
  semgrep "${args[@]}" . >"$INFORME_DIR/semgrep.log" 2>&1 || true   # devuelve 1 si hay hallazgos; se evalúan después
  registrar_ejecucion semgrep "$INFORME_DIR/semgrep.json"
}

correr_osv() {
  herramienta_activa osv-scanner || return 0
  log_seccion "osv-scanner (SCA multi-ecosistema)"
  disponible osv-scanner || { log_warn "osv-scanner no disponible: $(comando_instalacion osv-scanner)"; return 0; }
  osv-scanner scan --recursive --format json --output "$INFORME_DIR/osv.json" . >"$INFORME_DIR/osv.log" 2>&1 || true
  registrar_ejecucion osv-scanner "$INFORME_DIR/osv.json"
}

correr_trivy() {
  herramienta_activa trivy || return 0
  log_seccion "trivy (dependencias, IaC, Dockerfile, secretos en archivos)"
  disponible trivy || { log_warn "trivy no disponible: $(comando_instalacion trivy)"; return 0; }
  local -a args=(fs --scanners "vuln,misconfig,secret" --format json --output "$INFORME_DIR/trivy.json" --quiet)
  [[ -f .github/trivy.yaml ]] && args+=(--config .github/trivy.yaml)
  # .trivyignore.yaml se GENERA desde .devsecops.yml (mismo archivo que declara
  # ignorefile en .github/trivy.yaml); se pasa explícito por si no hay config.
  [[ -f .trivyignore.yaml ]] && args+=(--ignorefile .trivyignore.yaml)
  trivy "${args[@]}" . >"$INFORME_DIR/trivy.log" 2>&1 || log_warn "trivy terminó con error; revise $INFORME_DIR/trivy.log"
  registrar_ejecucion trivy "$INFORME_DIR/trivy.json"
}

correr_checkov() {
  herramienta_activa checkov || return 0
  [[ "$STACK_IAC" -eq 1 || "$STACK_DOCKER" -eq 1 ]] || return 0
  log_seccion "checkov (IaC y Dockerfile)"
  disponible checkov || { log_warn "checkov no disponible: $(comando_instalacion checkov)"; return 0; }
  # checkov escribe results_json.json dentro del directorio indicado.
  local -a args=(-d . --output json --output-file-path "$INFORME_DIR/checkov" --quiet --soft-fail
                 --skip-path node_modules --skip-path .venv --skip-path "$INFORMES_BASE")
  # Excepciones vigentes del manifiesto (IDs CKV_* separados por comas)
  [[ -n "$CHECKOV_SKIP" ]] && args+=(--skip-check "$CHECKOV_SKIP")
  checkov "${args[@]}" >"$INFORME_DIR/checkov.log" 2>&1 || true
  [[ -f "$INFORME_DIR/checkov/results_json.json" ]] && mv "$INFORME_DIR/checkov/results_json.json" "$INFORME_DIR/checkov.json"
  rm -rf "$INFORME_DIR/checkov"
  registrar_ejecucion checkov "$INFORME_DIR/checkov.json"
}

correr_npm_audit() {
  herramienta_activa npm-audit || return 0
  [[ "$STACK_NODE" -eq 1 ]] || return 0
  log_seccion "npm audit (SCA node)"
  disponible npm || { log_warn "npm no disponible: $(comando_instalacion npm)"; return 0; }
  [[ -f package-lock.json ]] || { log_warn "Sin package-lock.json: npm audit requiere lockfile (ejecute npm install)"; return 0; }
  npm audit --json --audit-level=none >"$INFORME_DIR/npm-audit.json" 2>"$INFORME_DIR/npm-audit.log" || true
  registrar_ejecucion npm-audit "$INFORME_DIR/npm-audit.json"
}

correr_pip_audit() {
  herramienta_activa pip-audit || return 0
  [[ "$STACK_PYTHON" -eq 1 ]] || return 0
  log_seccion "pip-audit (SCA python)"
  disponible pip-audit || { log_warn "pip-audit no disponible: $(comando_instalacion pip-audit)"; return 0; }
  local -a args=(-f json -o "$INFORME_DIR/pip-audit.json" --progress-spinner off)
  # Excepciones vigentes del manifiesto: "--ignore-vuln ID ..."
  if [[ -n "$PIP_IGNORE" ]]; then
    local -a ign=()
    read -r -a ign <<< "$PIP_IGNORE"
    args+=("${ign[@]}")
  fi
  if [[ -f requirements.txt ]]; then
    args+=(-r requirements.txt)
  else
    log_warn "Sin requirements.txt: pip-audit auditará el entorno Python activo (active el venv del proyecto)"
  fi
  pip-audit "${args[@]}" >"$INFORME_DIR/pip-audit.log" 2>&1 || true
  registrar_ejecucion pip-audit "$INFORME_DIR/pip-audit.json"
}

# ------------------------------------------------------------------------------
# Consolidación: normaliza los JSON, aplica excepciones y decide el resultado
# ------------------------------------------------------------------------------
consolidar() {
  command -v python3 >/dev/null 2>&1 || die 3 "Se requiere python3 para consolidar los informes"
  python3 - "$INFORME_DIR" "$UMBRAL" "$MANIFIESTO" "$(IFS=,; echo "${EJECUTADAS[*]:-}")" "$(IFS=,; echo "${FALTANTES[*]:-}")" <<'PY'
import datetime as dt
import json
import os
import sys

informe_dir, umbral_cli, manifiesto, ejecutadas, faltantes = sys.argv[1:6]
NIVEL = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1, "INFO": 0}
hoy = dt.date.today()


def cargar(nombre):
    ruta = os.path.join(informe_dir, nombre)
    if not os.path.isfile(ruta) or os.path.getsize(ruta) == 0:
        return None
    try:
        with open(ruta, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:  # noqa: BLE001
        print(f"[AVISO] No se pudo leer {nombre}: {e}", file=sys.stderr)
        return None


def sev_desde_cvss(valor):
    try:
        s = float(valor)
    except (TypeError, ValueError):
        return None
    if s >= 9.0:
        return "CRITICAL"
    if s >= 7.0:
        return "HIGH"
    if s >= 4.0:
        return "MEDIUM"
    return "LOW"


hallazgos = []  # dict(herramienta, id, severidad, ubicacion, titulo)
_vistos = set()


def add(herr, ident, sev, ubic, titulo):
    clave = (herr, str(ident).upper(), str(ubic))
    if clave in _vistos:  # el mismo CVE puede llegar por varios alias (PYSEC/GHSA)
        return
    _vistos.add(clave)
    sev = (sev or "MEDIUM").upper()
    if sev == "MODERATE":
        sev = "MEDIUM"
    if sev == "UNKNOWN":
        sev = "MEDIUM"
    if sev not in NIVEL:
        sev = "MEDIUM"
    hallazgos.append({"herramienta": herr, "id": str(ident), "severidad": sev,
                      "ubicacion": str(ubic), "titulo": str(titulo)[:160]})


# gitleaks: no tiene severidad; un secreto en el repositorio es siempre CRITICAL.
d = cargar("gitleaks.json")
if isinstance(d, list):
    for x in d:
        add("gitleaks", x.get("RuleID", "secreto"), "CRITICAL",
            f"{x.get('File')}:{x.get('StartLine')}", x.get("Description", "Secreto detectado"))

# semgrep: ERROR -> HIGH, WARNING -> MEDIUM, INFO -> LOW
d = cargar("semgrep.json")
if isinstance(d, dict):
    mapa = {"ERROR": "HIGH", "WARNING": "MEDIUM", "INFO": "LOW"}
    for r in d.get("results", []):
        extra = r.get("extra", {})
        add("semgrep", r.get("check_id"), mapa.get(str(extra.get("severity", "")).upper(), "MEDIUM"),
            f"{r.get('path')}:{r.get('start', {}).get('line')}", extra.get("message", ""))

# osv-scanner: severidad de database_specific, si no del CVSS máximo del grupo.
d = cargar("osv.json")
if isinstance(d, dict):
    for res in d.get("results", []):
        origen = res.get("source", {}).get("path", "")
        for p in res.get("packages", []):
            pk = p.get("package", {})
            grupos = {}
            for g in p.get("groups", []):
                for i in g.get("ids", []):
                    grupos[i] = g.get("max_severity")
            for v in p.get("vulnerabilities", []):
                sev = (v.get("database_specific") or {}).get("severity")
                if not sev:
                    sev = sev_desde_cvss(grupos.get(v.get("id")))
                aliases = [a for a in v.get("aliases", []) if a.startswith("CVE-")]
                ident = aliases[0] if aliases else v.get("id")
                add("osv-scanner", ident, sev or "MEDIUM",
                    f"{origen}:{pk.get('name')}@{pk.get('version')}", v.get("summary", ""))

# trivy fs: vulnerabilidades, misconfiguraciones y secretos.
d = cargar("trivy.json")
if isinstance(d, dict):
    for res in d.get("Results", []):
        destino = res.get("Target", "")
        for v in res.get("Vulnerabilities") or []:
            add("trivy", v.get("VulnerabilityID"), v.get("Severity"),
                f"{destino}:{v.get('PkgName')}@{v.get('InstalledVersion')}", v.get("Title", ""))
        for m in res.get("Misconfigurations") or []:
            add("trivy", m.get("ID"), m.get("Severity"), destino, m.get("Title", ""))
        for s in res.get("Secrets") or []:
            add("trivy", s.get("RuleID"), s.get("Severity", "CRITICAL"),
                f"{destino}:{s.get('StartLine')}", s.get("Title", ""))

# checkov: sin severidad sin plataforma comercial; se trata como MEDIUM (advierte,
# bloquea solo con --umbral MEDIUM). Los controles críticos de IaC los cubre trivy.
d = cargar("checkov.json")
if d is not None:
    bloques = d if isinstance(d, list) else [d]
    for b in bloques:
        for f in (b.get("results") or {}).get("failed_checks", []):
            add("checkov", f.get("check_id"), f.get("severity") or "MEDIUM",
                f"{f.get('file_path')}:{(f.get('file_line_range') or ['?'])[0]}", f.get("check", f.get("check_name", "")))

# npm audit (formato npm >= 7)
d = cargar("npm-audit.json")
if isinstance(d, dict):
    for nombre, v in (d.get("vulnerabilities") or {}).items():
        ident = nombre
        for via in v.get("via", []):
            if isinstance(via, dict) and via.get("url"):
                ident = via["url"].rsplit("/", 1)[-1]  # GHSA-xxxx
                break
        add("npm-audit", ident, v.get("severity"), f"package-lock.json:{nombre}@{v.get('range')}",
            f"{nombre} ({'fix disponible' if v.get('fixAvailable') else 'sin fix'})")

# pip-audit: sin severidad publicada -> HIGH (criterio conservador; documentado en el informe)
d = cargar("pip-audit.json")
if isinstance(d, dict):
    for dep in d.get("dependencies", []):
        for v in dep.get("vulns", []):
            aliases = [a for a in v.get("aliases", []) if a.startswith("CVE-")]
            add("pip-audit", aliases[0] if aliases else v.get("id"), "HIGH",
                f"requirements:{dep.get('name')}@{dep.get('version')}",
                f"sin severidad publicada; fix: {', '.join(v.get('fix_versions') or []) or 'ninguno'}")

# Excepciones vigentes del manifiesto
excepciones = []
umbral = umbral_cli
if os.path.isfile(manifiesto):
    try:
        import yaml  # type: ignore
        with open(manifiesto, encoding="utf-8") as f:
            m = yaml.safe_load(f) or {}
        seg = m.get("seguridad") or {}
        bloquear = [str(x).upper() for x in (seg.get("bloquear_en") or [])]
        if "MEDIUM" in bloquear and NIVEL[umbral] > NIVEL["MEDIUM"]:
            umbral = "MEDIUM"
        if "LOW" in bloquear:
            umbral = "LOW"
        for e in seg.get("excepciones") or []:
            excepciones.append(e)
    except ImportError:
        print("[AVISO] PyYAML no instalado: no se leen excepciones del manifiesto (pip install pyyaml)", file=sys.stderr)
    except Exception as e:  # noqa: BLE001
        print(f"[AVISO] No se pudo leer {manifiesto}: {e}", file=sys.stderr)

vigentes, vencidas = {}, []
for e in excepciones:
    ident = str(e.get("id", "")).upper()
    vence = e.get("vence")
    try:
        fecha = vence if isinstance(vence, dt.date) else dt.date.fromisoformat(str(vence))
    except Exception:  # noqa: BLE001
        vencidas.append((ident, "fecha 'vence' inválida"))
        continue
    if fecha < hoy:
        vencidas.append((ident, f"venció el {fecha}"))
        continue
    vigentes[ident] = e

for h in hallazgos:
    e = vigentes.get(h["id"].upper())
    herr_ok = e is not None and (not e.get("herramienta") or e.get("herramienta") == h["herramienta"])
    h["exceptuado"] = bool(herr_ok)

bloqueantes = [h for h in hallazgos if not h["exceptuado"] and NIVEL[h["severidad"]] >= NIVEL[umbral]]
conteo = {s: 0 for s in NIVEL}
for h in hallazgos:
    if not h["exceptuado"]:
        conteo[h["severidad"]] += 1

resumen = {
    "fecha": dt.datetime.now().isoformat(timespec="seconds"),
    "umbral": umbral,
    "herramientas_ejecutadas": [x for x in ejecutadas.split(",") if x],
    "herramientas_faltantes": [x for x in faltantes.split(",") if x],
    "conteo_no_exceptuados": conteo,
    "exceptuados": sum(1 for h in hallazgos if h["exceptuado"]),
    "excepciones_vencidas": vencidas,
    "bloquea": bool(bloqueantes),
    "hallazgos": hallazgos,
}
with open(os.path.join(informe_dir, "resumen.json"), "w", encoding="utf-8") as f:
    json.dump(resumen, f, ensure_ascii=False, indent=2)

orden = sorted(hallazgos, key=lambda h: (-NIVEL[h["severidad"]], h["herramienta"], h["id"]))
lineas = [f"# Informe de seguridad estática local — {resumen['fecha']}", "",
          f"Umbral de bloqueo: **{umbral}** | Resultado: **{'BLOQUEA' if bloqueantes else 'APROBADO'}**", "",
          f"Herramientas ejecutadas: {', '.join(resumen['herramientas_ejecutadas']) or 'ninguna'}  ",
          f"Herramientas faltantes: {', '.join(resumen['herramientas_faltantes']) or 'ninguna'}", "",
          "| Severidad | No exceptuados |", "|---|---|"]
lineas += [f"| {s} | {conteo[s]} |" for s in ("CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO")]
lineas += ["", f"Hallazgos exceptuados por el manifiesto: {resumen['exceptuados']}"]
if vencidas:
    lineas += ["", "**Excepciones vencidas o inválidas (vuelven a bloquear):**"] + [f"- {i}: {m}" for i, m in vencidas]
lineas += ["", "## Hallazgos", "", "| Sev. | Herramienta | ID | Ubicación | Detalle | Exc. |", "|---|---|---|---|---|---|"]
for h in orden[:500]:
    lineas.append(f"| {h['severidad']} | {h['herramienta']} | {h['id']} | {h['ubicacion']} | "
                  f"{h['titulo'].replace('|', '/')} | {'sí' if h['exceptuado'] else ''} |")
if not orden:
    lineas.append("| — | — | — | — | Sin hallazgos | |")
lineas += ["", "## Notas de interpretación", "",
           "- gitleaks no clasifica por severidad: todo secreto se trata como CRITICAL.",
           "- pip-audit no publica severidad: se trata como HIGH (conservador). Verifique el CVE y, si corresponde, registre una excepción con vencimiento.",
           "- checkov sin plataforma comercial no publica severidad: se trata como MEDIUM.",
           "- Las excepciones se gestionan solo en `.devsecops.yml` (`seguridad.excepciones`, con `vence`)."]
with open(os.path.join(informe_dir, "resumen.md"), "w", encoding="utf-8") as f:
    f.write("\n".join(lineas) + "\n")

print()
print(f"Resumen (umbral {umbral}): " + "  ".join(f"{s}={conteo[s]}" for s in ("CRITICAL", "HIGH", "MEDIUM", "LOW")) +
      f"  exceptuados={resumen['exceptuados']}")
for h in bloqueantes[:25]:
    print(f"  [{h['severidad']}] {h['herramienta']} {h['id']} — {h['ubicacion']}")
if len(bloqueantes) > 25:
    print(f"  ... y {len(bloqueantes) - 25} más (ver resumen.md)")
for i, m in vencidas:
    print(f"  [EXCEPCIÓN VENCIDA] {i}: {m}")
sys.exit(1 if bloqueantes else 0)
PY
}

# ------------------------------------------------------------------------------
# Principal
# ------------------------------------------------------------------------------
asegurar_gitignore() {
  local entrada="$1"
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0
  if [[ -f .gitignore ]] && grep -qxF "$entrada" .gitignore; then return 0; fi
  printf '%s\n' "$entrada" >> .gitignore
  log_info "Se añadió '$entrada' a .gitignore"
}

main() {
  analizar_argumentos "$@"
  cd "$RUTA"
  printf '%ssecurity-local.sh v%s — %s (umbral %s)%s\n' "$C_NEGRITA" "$SCRIPT_VERSION" "$(date '+%Y-%m-%d %H:%M:%S')" "$UMBRAL" "$C_RESET"

  INFORME_DIR="${INFORMES_BASE}/$(date +%Y%m%d-%H%M%S)"
  mkdir -p "$INFORME_DIR"
  [[ "$INFORMES_BASE" == "$INFORMES_BASE_DEFECTO" ]] && asegurar_gitignore "${INFORMES_BASE_DEFECTO}/"

  detectar_stack
  generar_excepciones
  correr_gitleaks
  correr_semgrep
  correr_osv
  correr_trivy
  correr_checkov
  correr_npm_audit
  correr_pip_audit

  # Enlace estable al último informe (deploy.sh y los agentes lo consultan).
  ln -sfn "$(basename "$INFORME_DIR")" "${INFORMES_BASE}/ultimo"

  if [[ ${#FALTANTES[@]} -gt 0 ]]; then
    log_seccion "Herramientas faltantes (no instaladas automáticamente; use --instalar)"
    local h
    for h in "${FALTANTES[@]}"; do
      printf '  %-12s %s\n' "$h" "$(comando_instalacion "$h")"
    done
    log_warn "La cobertura local es parcial; el pipeline de CI ejecuta el conjunto completo."
  fi
  if [[ ${#EJECUTADAS[@]} -eq 0 ]]; then
    log_error "No se ejecutó ninguna herramienta. Instale al menos gitleaks y semgrep (o use --instalar)."
    # Se devuelve 3 (error de ejecución) y no 0: un análisis vacío no puede aprobar un despliegue.
    consolidar >/dev/null 2>&1 || true
    exit 3
  fi

  log_seccion "Consolidación"
  local rc=0
  consolidar || rc=$?
  log_info "Informe: ${INFORME_DIR}/resumen.md (enlace: ${INFORMES_BASE}/ultimo)"
  if [[ $rc -eq 0 ]]; then
    log_ok "Sin hallazgos por encima del umbral $UMBRAL"
  else
    log_error "Hay hallazgos que bloquean (≥ umbral). Corrija o registre una excepción justificada y con vencimiento en $MANIFIESTO."
  fi
  exit "$rc"
}

main "$@"
