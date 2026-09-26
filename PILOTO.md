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
| 3 | Gitleaks: la `apiKey` web de Firebase aparece en `src/firebase.ts`, `src/firebase-config.json` y `src/pages/UserManagement.tsx` | Falso positivo documentado | Es un identificador público por diseño; quedó una allowlist acotada y justificada en `.github/gitleaks.toml`. El control real es la Fase 4.5. Los hallazgos del historial quedaron como excepciones con vencimiento en #30 |
| 4 | El privilegio de administrador depende del correo fijo en **tres** lugares: `firestore.rules`, `src/context/AdminContext.tsx` y `functions/src/index.ts` | Deuda de diseño | La migración al custom claim (Fase 4.3) debe cubrir los tres: reglas → `request.auth.token.admin == true`; AdminContext → `getIdTokenResult().claims.admin`; función → `context.auth.token.admin === true` |
| 5 | `src/pages/UserManagement.tsx` duplica la configuración de Firebase para crear usuarios con una app secundaria | Observación | Importar la config desde `src/firebase-config.json` en lugar de duplicarla. **Cerrado en #29** (importa `firebaseConfig` de `src/firebase.ts`) |
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
| **Desviación del estándar:** `proteccion-main` con `required_approving_review_count: 0` (el estándar pide 1) | El repositorio tiene un solo colaborador y nadie puede aprobar su propio PR: con 1 aprobación ningún PR se fusionaba (medido: #20 en `REVIEW_REQUIRED`). Se conservan PR obligatorio, `compuerta-pr` con rama al día, historia lineal, solo squash y cero bypass. Decidido por Andres el 2026-09-25; el cambio lo hizo él en la interfaz de GitHub porque el clasificador de la sesión lo bloqueó. Se revierte a 1 si se suma un segundo colaborador con escritura |
| `roles/serviceusage.serviceUsageViewer` en `deploy-staging@pretso-database` y `deploy-production@pretso-prod` | Al desplegar `firestore:rules`, firebase-tools consulta si la API de Firestore está habilitada (`serviceusage.services.get`) y la SA respondía 403. Es el rol mínimo que lo resuelve: solo lectura, no habilita ni deshabilita APIs (se descartó `serviceUsageConsumer`, que añade `services.use`). Aprobado por Andres el 2026-09-25 y asignado por él en la consola de GCP. El script del estándar no lo otorga: defecto a llevar a SeguridadGeneral en su sesión |

## Jornada del 2026-09-25 — resultado real

Cierra la **Fase 3**: el despliegue automático a staging funciona de punta a punta por tubería, sin credenciales en ninguna máquina.

| Paso | Resultado medido |
|---|---|
| Ruleset `proteccion-main` a 0 aprobaciones | Verificado por API: `required_approving_review_count: 0`, el resto intacto, `bypass_actors: []` |
| #21 `fix(ci)` corepack + cabeceras | Fusionado `2cbe875`. El paso de corepack pasó; `desplegar-staging` murió después con 403 en `serviceusage.services.get` |
| Rol `serviceUsageViewer` en ambas SA | Verificado leyendo el IAM de `pretso-database` y `pretso-prod` |
| Relanzar el job de `2cbe875` | `desplegar-staging`, prueba de humo y ZAP baseline en verde |
| Bundle publicado vs. `npm run build` local | Idénticos por sha256 (`index-C68C218d.js`, `index-Cz5ny_2p.css`) |
| #22 `pretso-prod` como producción | Fusionado `82c4fb0` (no despliega a `pretso-prod`: eso exige un tag) |
| #12 y #13 (sin checks) | Cerrados con comentario |
| Dependabot #20, #19, #18, #17, #16 | Fusionados en serie, cada uno con su rama al día y CI en verde: `c40a7ce`, `3bad401`, `8dabece`, `e25e7ae`, `d298da6`. #16 tuvo conflicto en `package-lock.json` tras #17 y se regeneró con `@dependabot rebase` |
| Run de `main` en `d298da6` | Verde, con `desplegar-staging` y `dast-y-humo` |
| Sitio tras las dependencias nuevas | Sirve `index-DOscilnX.js` + `index-Cz5ny_2p.css`, idénticos por sha256 al build local de `d298da6`; `npm test`: 15 pruebas en 4 archivos, en verde |
| Alertas de Dependabot abiertas | De 30 (17 altas, 12 medias, 1 baja) a **4 medias** |
| #23 `docs(piloto)` este registro | Fusionado `b3e538c`; run de `main` en verde |
| **Copia a Google Drive rota** (Administración) | Causa medida en la consola del sitio: la CSP (`script-src 'self'`, vigente desde `37ec90e`, 2026-08-27) bloqueaba `https://accounts.google.com/gsi/client`; `window.google` quedaba sin definir y la aplicación decía «La API de Google no se cargó correctamente». No la causaron los despliegues de la jornada: `firebase.json` no cambió. El Client ID pertenece a `pretso-database` (número 48942361199) y la Drive API está habilitada |
| #24 `fix(hosting)` CSP para Google Identity Services | Fusionado `4008a94`: `https://accounts.google.com` en `script-src` y `frame-src`, nada más. Despliegue, humo y ZAP en verde; CSP nueva publicada; `google.accounts.oauth2` presente. **Andres probó la copia a Drive y funcionó** |
| #25 `feat(admin)` Client ID de Google fijo | Fusionado `9227bfb`: la aplicación trae el cliente OAuth web de `pretso-database`; un valor guardado en el navegador tiene prioridad y el cuadro vacío vuelve al fijo. `npm test`: 19 pruebas en 5 archivos (4 nuevas). Despliegue, humo y ZAP en verde; el sitio sirve `index-DBlYaXUt.js`, el mismo bundle del build local, con el Client ID dentro; en un navegador sin valor guardado la API de Google carga. **Andres probó la copia completa sin pegar el Client ID y funcionó** |

Costo de la jornada: 21 runs del pipeline (10 en PR y 11 en `main`, uno de ellos con el job de despliegue relanzado; ~10 min c/u) y 11 despliegues a `pretso-database` (uno por fusión a `main`, incluido este registro).

Pendiente de #25: cuando `pretso-prod` tenga su propio cliente OAuth, el Client ID tendrá que salir por ambiente junto con la configuración de Firebase, que hoy también está fija en `src/firebase.ts`.

## Jornada del 2026-09-26 — resultado real

Cierra el **Bloque 1** del prompt y deja `./security-local.sh` **APROBADO** por primera vez desde que se instaló el estándar.

| Paso | Resultado medido |
|---|---|
| #27 Bloque 1: `requirements.txt` y ruta del `.ods` | Fusionado `19d54db`. Con el `requirements.txt` anterior, leer el `.ods` daba `ImportError: Import odfpy failed` (reproducido). Ahora fija `firebase-admin` 7.5.0, `pandas` 3.0.6, `numpy` 2.5.3, `odfpy` 1.4.1 y las transitivas `anyio` 4.15.1 e `idna` 3.20 (osv-scanner las resolvía en versiones vulnerables). Los once scripts leen `PRETSO_ODS_PATH`, por omisión `~/Documentos/PRETSO/Hacia PRETSO rev AA 1.ods`. En venv limpio, los 8 scripts de solo lectura corren de punta a punta con **salida idéntica** en pandas 3.0.6 y 2.3.3. Los `migrate_*` no se ejecutaron: escriben en Firestore |
| #28 excepción: clave de `pretso-platform` en el historial | Fusionado `7ea2684`. `pretso-platform` está en `DELETE_REQUESTED` (verificado); Andres confirmó que esa versión no se usa más. Dos excepciones de gitleaks por huella exacta (`afb0c3d`, líneas 55 y 66), vencen el 2026-12-25. No se reescribió el historial |
| #29 `UserManagement.tsx` sin configuración duplicada | Fusionado `825f4c7`. Las dos copias eran idénticas (comparadas por hash); ahora importa `firebaseConfig` de `src/firebase.ts`. `npm test` 19/19; build servido en local sin errores; el sitio sirve `index-2C8egsrQ.js`, idéntico por sha256 al build local. Crear un usuario real no se probó (exige la sesión del administrador) |
| #30 excepción: apiKey web en el historial | Fusionado `570d571`. Tres huellas (`firebase.ts` y `firebase-config.json` con `generic-api-key`, que la lista de permitidos no cubre; `UserManagement.tsx` en `b36587d`). Vencen el 2026-12-25, para obligar a hacer la Fase 4.5 |
| `./security-local.sh` sobre `main` | **APROBADO**: 5 excepciones vigentes, 0 CRITICAL, 0 HIGH, 7 MEDIUM (`uuid` y `qs` transitivas en los `package-lock.json`; compromiso al 2026-10-26, vía Dependabot o la Fase 4.4) |

Costo de la jornada: 11 runs del pipeline (#29 corrió dos veces en PR por quedar atrasado tras #30) y 5 despliegues a `pretso-database`, incluido este registro.

Anotado, no resuelto:
- `test_ods_keys.py` busca la columna `Sigla`, que la hoja «Compañías y empleador» ya no tiene.
- En varias hojas `dropna` no descarta filas (999 donde se esperan 66): el `.ods` tiene celdas no vacías. Los `migrate_*` filtran por la columna clave, que da los recuentos correctos.
- `src/firebase-config.json` no lo importa ningún archivo del código.
- En la CI, gitleaks analiza solo los commits nuevos; el historial completo solo lo mira `./security-local.sh`.

Sigue pendiente: `production` apunta a `pretso-prod`, **que está vacío** (sin datos de Firestore ni usuarios). Un tag `vX.Y.Z` hoy publicaría la aplicación sin datos; lo único que lo impide es el revisor del Environment. No se crea ningún tag hasta migrar datos y usuarios (Bloque 5 de `Prompts/cerrar-estandar-y-pase-a-produccion.md`).
