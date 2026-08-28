# PILOTO — Adopción del estándar DevSecOps v2.0 en PRETSO

| Versión | Fecha | Repositorio | Modo |
|---|---|---|---|
| 1.0 | 2026-08-25 | github.com/AndresAlberdi/PRETSO (rama actual: `master`) | A (público, GitHub Free) |

Este documento lista, en orden, los comandos que **usted** debe ejecutar con sus credenciales. Todos los archivos del estándar ya están colocados en el proyecto; ninguno de los pasos siguientes despliega nada hasta la Fase 3, y el primer despliegue va únicamente a staging (`pretso-database`).

**Decisión de ambientes del piloto**: `pretso-database` (el proyecto Firebase actual) actúa como **staging**. El proyecto de producción `pretso-prod` se creará recién en la Fase 5. Así el pipeline completo se valida sin crear infraestructura nueva.

## Archivos añadidos o modificados (revíselos antes del commit)

| Archivo | Qué es |
|---|---|
| `.devsecops.yml` | Manifiesto del proyecto (componente `web`, node/firebase) |
| `.github/workflows/` (6) | `ci-node-firebase.yml` (adaptado: cobertura opcional, compilación de Functions), `_reusable-security.yml`, `_reusable-dast.yml`, `codeql.yml`, `scorecard.yml`, `release.yml` |
| `.github/` (8) | `dependabot.yml`, `zap-rules.tsv`, `gitleaks.toml`, `trivy.yaml`, `semgrep.yml`, `CODEOWNERS` (@AndresAlberdi), `PULL_REQUEST_TEMPLATE.md`, `devsecops.schema.json` |
| `.github/rulesets/` (2) | `main.json` y `tags.json` para aplicar con `gh api` |
| `firebase.json` | Se añadieron cabeceras de seguridad (HSTS, CSP, X-Frame-Options…) — la prueba de humo del pipeline las exige. Verifique la aplicación en el canal de vista previa del PR antes de fusionar; si la CSP bloquea algún recurso, ajústela en este archivo |
| `firestore.rules.propuesta` | Reglas endurecidas (custom claim en lugar de correo fijo). **No** reemplaza a `firestore.rules` hasta el paso 7.3 |
| `deploy.sh` | v2 del estándar (reemplaza a la v1; la v1 queda en el historial git). Ahora **bloquea** en vulnerabilidades CRITICAL/HIGH y ya no hace push a `master` |
| `security-local.sh` | Análisis de seguridad local, mismo criterio que CI |
| `CLAUDE.md`, `.claude/agents/`, `.claude/skills/` | Política ejecutable para Claude Code y sus 4 subagentes |
| `.gitignore` | Fusionado (entradas del estándar + `venv/`, `coverage/`, `.firebase/`) |
| `.pre-commit-config.yaml` | Hooks locales (gitleaks, actionlint, commits convencionales) |

## Fase 0 — Preparación local (2 min)

```bash
cd ~/.gemini/antigravity/scratch/pretso-app

# 0.0 Instalar los archivos que el asistente no puede escribir de forma remota
# (.github/, .claude/ y .pre-commit-config.yaml quedaron empaquetados en
# _estandar-devsecops/ porque el puente del escritorio protege esas rutas):
bash _estandar-devsecops/instalar.sh

chmod +x deploy.sh security-local.sh
chmod +x ~/SeguridadGeneral/03-scripts/*.sh   # si no lo hizo antes
pipx install pre-commit || pip install --user pre-commit
pre-commit install --install-hooks
```

## Fase 1 — Git y GitHub (10 min)

```bash
# 1.1 Renombrar master → main (el estándar despliega staging desde main)
git branch -m master main
git push -u origin main
gh repo edit AndresAlberdi/PRETSO --default-branch main
git push origin --delete master

# 1.2 Confirmar visibilidad pública (Modo A) — debe decir "public"
gh repo view AndresAlberdi/PRETSO --json visibility

# 1.3 Aplicar rulesets (PR obligatorio + status check compuerta-pr + protección de tags)
gh api repos/AndresAlberdi/PRETSO/rulesets --input .github/rulesets/main.json
gh api repos/AndresAlberdi/PRETSO/rulesets --input .github/rulesets/tags.json

# 1.4 Variables del repositorio
gh variable set MODO --body "A"
gh variable set GHAS_ENABLED --body "false"
gh variable set NODE_VERSION --body "22"
gh variable set COVERAGE_MIN --body "0"          # subir a 70 en el paso 6
gh variable set HEALTH_PATH --body "/"           # SPA: la raíz responde 200
gh variable set CODEQL_LENGUAJES --body "javascript-typescript"
gh variable set WORKFLOW_PRODUCCION --body "ci-node-firebase.yml"
gh variable set APROBADORES_PROD --body "AndresAlberdi"
gh variable set TAG_FIRMADO_REQUERIDO --body "false"
gh variable set FIREBASE_DEPLOY_ONLY --body "hosting,firestore:rules"
gh variable set GCP_PROJECT_ID_STAGING --body "pretso-database"
gh variable set GCP_PROJECT_ID_PROD --body "pretso-prod"
gh variable set STAGING_URL --body "https://pretso-database.web.app"
gh variable set PROD_URL --body "https://pretso-prod.web.app"

# 1.5 Environments con aprobación (repos públicos Free sí los tienen)
gh api -X PUT repos/AndresAlberdi/PRETSO/environments/staging
gh api -X PUT repos/AndresAlberdi/PRETSO/environments/production \
  -f "reviewers[][type]=User" \
  -F "reviewers[][id]=$(gh api users/AndresAlberdi --jq .id)"
```

## Fase 2 — Identidad federada hacia GCP (15 min, una sola vez)

Sin claves JSON: GitHub Actions se autenticará con Workload Identity Federation. El script es interactivo y tiene puntos de verificación.

```bash
gcloud auth login   # si no hay sesión activa
~/SeguridadGeneral/03-scripts/setup-oidc-gcp.sh
#   PROJECT_ID: pretso-database
#   GITHUB_OWNER: AndresAlberdi
#   REPO: PRETSO
#   Ambiente: staging
# El script imprime al final los DOS valores a cargar:

gh secret set GCP_WIF_PROVIDER --body "projects/NUMERO/locations/global/workloadIdentityPools/github/providers/github"
gh secret set GCP_SA_DEPLOY_STAGING --body "deploy-staging@pretso-database.iam.gserviceaccount.com"
```

Punto de verificación: `gcloud iam workload-identity-pools providers describe github --workload-identity-pool=github --location=global --project=pretso-database` responde sin error.

Nota de roles: para que el despliegue incluya reglas de Firestore, la service account necesita además de Hosting los roles `roles/firebaserules.admin` y `roles/firebase.viewer` (el script asigna el conjunto para hosting+reglas; verifíquelo en su salida).

## Fase 3 — Primer pase por el pipeline (20 min)

```bash
cd ~/.gemini/antigravity/scratch/pretso-app
git checkout -b chore/estandar-devsecops
git add -A
git commit -m "ci: adopción del estándar DevSecOps v2.0 (pipeline, manifiesto, políticas)"
git push -u origin chore/estandar-devsecops
gh pr create --fill --title "ci: adopción del estándar DevSecOps v2.0"
gh pr checks --watch     # calidad, seguridad-estatica y compuerta-pr deben quedar en verde
```

Qué esperar: `calidad` (oxlint + vitest + tsc de Functions), `seguridad-estatica` (Gitleaks, Semgrep, Trivy, npm audit, OSV informativo), CodeQL y Scorecard (por ser público), y `compuerta-pr` agregándolo todo. Si Gitleaks encuentra algo en el historial, **no** lo borre: siga `SeguridadGeneral/01-seguridad/01-gestion-de-secretos.md`, sección de respuesta ante filtración.

Al fusionar el PR (squash), el push a `main` ejecuta `desplegar-staging` (requiere la Fase 2 hecha) y luego `dast-y-humo` (ZAP baseline contra la URL de staging). Verifique la aplicación en https://pretso-database.web.app tras el despliegue: si la CSP nueva bloquea algún recurso, aparecerá en la consola del navegador; ajuste `firebase.json` y repita.

## Fase 4 — Endurecimiento del proyecto (misma semana)

```bash
# 4.1 Cobertura de pruebas real
npm i -D @vitest/coverage-v8
gh variable set COVERAGE_MIN --body "40"    # meta 70 cuando crezca la suite

# 4.2 Pruebas de reglas Firestore en el emulador
npm i -D @firebase/rules-unit-testing
# añada a package.json:  "test:rules": "vitest run tests/rules"
# (ejemplos de pruebas en SeguridadGeneral/01-seguridad/03-hardening-por-nube.md, sección Firestore)

# 4.3 Reglas endurecidas (custom claim en lugar del correo fijo)
# a) Asigne el claim admin UNA vez (con las credenciales de administrador del proyecto):
node -e '
const admin = require("firebase-admin");
admin.initializeApp({ projectId: "pretso-database" });
admin.auth().getUserByEmail("pretsodatabase@gmail.com")
  .then(u => admin.auth().setCustomUserClaims(u.uid, { admin: true }))
  .then(() => console.log("claim admin asignado"))'
# b) Pruebe las reglas propuestas en el emulador, y recién entonces:
mv firestore.rules.propuesta firestore.rules
# c) Declare las colecciones reales (estructura_datos.md) en lugar del bloque genérico.

# 4.4 Cloud Functions: subir runtime (Node 20 está en fin de soporte) y desplegarlas por CI
#   - functions/package.json → "engines": { "node": "22" }; probar en emulador
#   - Añadir roles de Functions a la SA (cloudfunctions.developer + iam.serviceAccountUser
#     sobre la SA de runtime) y entonces:
gh variable set FIREBASE_DEPLOY_ONLY --body "hosting,firestore:rules,functions"
```

## Informe de seguridad previo (análisis ya ejecutado sobre el código actual)

Corrí las herramientas del estándar sobre el código real antes de tocar el pipeline; esto es lo que el pipeline verá y lo que conviene resolver:

| # | Hallazgo | Severidad | Acción |
|---|---|---|---|
| 1 | `npm audit`: `brace-expansion` y `nanoid` (transitivas) con severidad **HIGH**; `exceljs`, `postcss`, `uuid` moderate | Bloqueante en CI | Ejecutar `npm audit fix` ANTES del primer PR (paso 3.0 abajo). `exceljs` no tiene fix publicado: si persiste como moderate no bloquea; vigilarlo vía Dependabot |
| 2 | `functions/`: 9 vulnerabilidades moderate | No bloqueante | `cd functions && npm audit fix`; se resolverán mejor al subir firebase-admin/functions en la Fase 4.4 |
| 3 | Gitleaks: la `apiKey` web de Firebase aparece en `src/firebase.ts`, `src/firebase-config.json` y `src/pages/UserManagement.tsx` | Falso positivo documentado | Es un identificador público por diseño; quedó una allowlist acotada y justificada en `.github/gitleaks.toml`. El control real es la Fase 4.5 |
| 4 | El privilegio de administrador depende del correo fijo en **tres** lugares: `firestore.rules`, `src/context/AdminContext.tsx` y `functions/src/index.ts` | Deuda de diseño | La migración al custom claim (Fase 4.3) debe cubrir los tres: reglas → `request.auth.token.admin == true`; AdminContext → `getIdTokenResult().claims.admin`; función → `context.auth.token.admin === true` |
| 5 | `src/pages/UserManagement.tsx` duplica la configuración de Firebase para crear usuarios con una app secundaria | Observación | Importar la config desde `src/firebase-config.json` en lugar de duplicarla |
| 6 | Semgrep (reglas propias del estándar): 0 hallazgos; los rulesets del registro (`p/ci`, `p/owasp-top-ten`) correrán completos en GitHub Actions | Informativo | Nada que hacer |

```bash
# Paso 3.0 (ANTES del commit de la Fase 3):
npm audit fix && npm test
cd functions && npm audit fix && npm run build && cd ..
```

```bash
# Fase 4.5 — Restringir la apiKey web en GCP (el control real del hallazgo 3):
# Consola GCP → APIs y servicios → Credenciales → Browser key:
#   - Restricción de aplicación: referentes HTTP → https://pretso-database.web.app/*,
#     https://pretso-database.firebaseapp.com/*, http://localhost:5173/*
#   - Restricción de API: Identity Toolkit API, Token Service API
# Y habilitar App Check (reCAPTCHA Enterprise) según
# SeguridadGeneral/01-seguridad/03-hardening-por-nube.md.
```

## Fase 5 — Cuando decida pasar a producción

1. Crear el proyecto `pretso-prod` (Firebase + Firestore + Hosting), repetir la Fase 2 para `production` (`GCP_SA_DEPLOY_PROD`) y actualizar `PROD_URL`.
2. En Claude Code, ejecutar `/pase-a-produccion`: recorre el checklist, produce el acta y deja preparado el tag.
3. Crear el release: `gh workflow run release.yml -f tipo=minor` → el tag `v0.1.0` dispara `desplegar-produccion`, que espera su aprobación en el Environment `production`.
4. Si el repositorio pasa a privado: seguir la transición A→B de `SeguridadGeneral/00-gobernanza/03-ambientes-modos-y-aprobaciones.md` (organización Team + Code Security/Secret Protection); las herramientas OSS del pipeline siguen funcionando igual.

## Registro de decisiones del piloto

| Decisión | Justificación |
|---|---|
| `pretso-database` = staging | Evita crear infraestructura antes de validar el pipeline; producción tendrá proyecto propio |
| `COVERAGE_MIN=0` inicial | El proyecto aún no tiene proveedor de cobertura instalado; el umbral se activa en la Fase 4.1 |
| Functions se compilan en CI pero se despliegan manualmente | El despliegue por CI requiere roles adicionales; se activa en la Fase 4.4 |
| `firestore.rules` intacto + propuesta separada | Un cambio de reglas sin asignar antes el custom claim dejaría sin escritura al administrador |
| `HEALTH_PATH=/` | SPA sin endpoint de salud; la raíz sirve como verificación de vida |
