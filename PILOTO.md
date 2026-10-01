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
| `firestore.rules` | Reglas endurecidas (custom claim `admin` en lugar de correo fijo; lectura restringida) |
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
# a) Asigne el claim admin UNA vez. Las credenciales (ADC) salen de
#    `gcloud auth application-default login` con la cuenta del propietario;
#    no use una clave de service account (el script avisa si GOOGLE_APPLICATION_CREDENTIALS está definida).
#    Primero en modo solo lectura (no escribe; muestra el cambio previsto):
python3 scripts/asignar_claim_admin.py --proyecto pretso-database --correo pretsodatabase@gmail.com
#    Luego con --aplicar (escribe solo si hay cambio y lo verifica releyendo):
python3 scripts/asignar_claim_admin.py --proyecto pretso-database --correo pretsodatabase@gmail.com --aplicar
#    El claim no se ve hasta renovar el token: espere 1 hora o cierre y abra sesión.
#    Para revertir: `--quitar --aplicar`; los ID tokens ya emitidos conservan el privilegio
#    hasta 1 hora (las reglas no consultan revocación). El script nunca imprime uid ni credenciales.
#    Pruebas del script (venv con requirements.txt): python3 -m unittest scripts/test_asignar_claim_admin.py
#    Aún no corren en CI: la decisión de añadirlas a un workflow está pendiente
#    (la evaluará el agente devsecops).
# b) Las reglas con claim ya son `firestore.rules` y se prueban en el emulador (`npm run test:rules`).
#    ORDEN OBLIGATORIO: asigne el claim en el proyecto ANTES de que el merge despliegue estas reglas;
#    si no, nadie podrá escribir ni leer. Resuelto por el PR 3 de DAT-01 (privilegio por claim en reglas,
#    `AdminContext.tsx` y `functions/src/index.ts`).
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
| 4 | El privilegio de administrador depende del correo fijo en **tres** lugares: `firestore.rules`, `src/context/AdminContext.tsx` y `functions/src/index.ts` | Resuelto por el PR 3 de DAT-01 (nota de orden: asignar el claim en el proyecto ANTES de que el merge despliegue las reglas) | La migración al custom claim (Fase 4.3) debe cubrir los tres: reglas → `request.auth.token.admin == true`; AdminContext → `getIdTokenResult().claims.admin`; función → `context.auth.token.admin === true` |
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

## Entrega de octubre

> **El contrato no está escrito en este repositorio ni en el registro de proyectos.** Lo que sigue es lo que se **infiere** del repositorio y de lo que Andres dijo; cada fila indica su fuente. Andres lo confirma o lo corrige.

| Exigencia (inferida) | Fuente de la inferencia | Estado medido |
|---|---|---|
| Sitio en línea, estable, desplegado por tubería | Andres, 2026-09-25: «producción» es «tener el sistema arriba» (`Prompts/cerrar-estandar-y-pase-a-produccion.md`) | **Cumplido.** `pretso-database.web.app`; todos los runs de `main` en verde desde el 25/09; despliegue automático con prueba de humo y ZAP |
| El equipo de investigación consulta el corpus (compañías, salarios, indicadores, bibliografía…) | `estructura_datos.md`; el sitio muestra el proyecto de investigación Horizon MSCA 101150056 | **Funciona.** Andres inicia sesión y carga datos (28/09). Los recuentos contra el `.ods` **no se verificaron** en esta jornada |
| Administración: usuarios lectores, auditoría, exportación y respaldos | Pantalla «Administración» | **Funciona.** XML, XLSX y copia a Google Drive (probada por Andres el 25 y 26/09) |
| Seguridad según el estándar | `CLAUDE.md`, `.devsecops.yml` | `./security-local.sh` **aprobado**; apiKey web restringida (28/09); App Check **pendiente**; excepciones de gitleaks vencen el 2026-12-25 y la de `@grpc/grpc-js` el 2026-12-29 |
| Producción separada en `pretso-prod`, con datos | Andres, 2026-09-25: sigue siendo necesario «para tener un modelo robusto» | **Camino B confirmado por Andres el 2026-09-30.** Destino: el `pretso-prod` existente, todavía **vacío**, con respaldo y auditoría activos. **Pasos 1 y 3 hechos, y el 2 salvo el presupuesto** (lo crea Andres). Faltan los pasos 4 a 8. (El 30/09 se creó por error `pretso-prod-d8a68`; Andres lo borró.) |

### Qué falta, en orden de riesgo

1. ~~Respaldo automático de Firestore~~ **Hecho el 2026-09-30, con autorización de Andres, en `pretso-database` y en `pretso-prod`:** recuperación a un punto en el tiempo (PITR, ventana de 7 días), protección contra borrado y **respaldo diario con retención de 30 días**; verificado leyendo cada base y su programa de respaldo. El costo por almacenamiento queda por confirmar en la consola de facturación (DAT-04, verde en ambos proyectos).
2. ~~Decidir el camino~~ **Decidido por Andres el 2026-09-30: camino B** (producción separada). El camino A queda descartado.
3. **Camino B (con `pretso-prod`):** el plan está en `docs/produccion/plan-migracion-pretso-prod.md`. **Paso 1 hecho** (#38): la configuración de Firebase y el Client ID de Google dependen ahora del ambiente de build; antes la aplicación tenía `pretso-database` escrito fijo, y un tag habría publicado en `pretso-prod` un sitio que leía y escribía en `pretso-database`. **Sigue el paso 3** (registrar la app web en `pretso-prod`, restringir su apiKey y crear su cliente OAuth), que completa los valores vacíos de `src/environments/production/`, y después los pasos 2 y 4 a 8. Hasta entonces el build de producción de un tag o de un `workflow_dispatch` **falla a propósito**.

### Qué necesita de Andres (una palabra cada una)

- **Comprobar el sitio tras #38:** abrir https://pretso-database.web.app, iniciar sesión y cargar una pantalla con datos (yo solo verifiqué que carga y muestra el login).
- **El «sí» para el paso 3 del plan**, que son cambios de GCP: registrar la app web en `pretso-prod`, restringir su apiKey y crear su cliente OAuth.
- **Cuántos usuarios de autenticación hay** (para elegir entre recrearlos o importarlos, en el paso 5).
- **REP-03:** aceptar como «N/A justificado» el ruleset con 0 aprobaciones (un solo dueño) o dar escritura a una segunda cuenta.

## Jornada del 2026-09-29 — gobierno y dependencias

Trabajo de riesgo mínimo bajo la orden general del 2026-09-29. **Nada se fusionó ni se desplegó**: los tres PR quedan abiertos para que Andres decida cuándo, porque cada fusión redespliega `pretso-database` (el sitio en uso) con el mismo código.

### Bloque 3 — Gobierno (medido, sin tocar el ruleset)

| Control | Resultado |
|---|---|
| `proteccion-main` | Activo, **sin bypass**. Reglas: sin borrado, sin force push, historia lineal, PR obligatorio con **0 aprobaciones** (desviación de REP-03, ver más arriba), solo squash, `compuerta-pr` requerido con la rama al día |
| `proteccion-tags` | Activo, sin bypass. Los tags `v*` no se borran, no se mueven y no se actualizan |
| Environment `production` | Revisor obligatorio (AndresAlberdi); solo admite el tag `v*` |
| Environment `staging` | Sin revisores: el despliegue automático no espera aprobación |
| PR que no puede fusionarse sin `compuerta-pr` | **Evidenciado**: al empujar un commit nuevo a un PR, su estado pasó a `BLOCKED` y volvió a `CLEAN` solo cuando `compuerta-pr` terminó en verde (PR #33, 2026-09-29; y PR #22 el 2026-09-25) |
| Push directo a `main` rechazado | **No probado en vivo**, a propósito: si la protección tuviera un hueco, el intento publicaría un commit en `main` y desplegaría el sitio en uso. La evidencia es la configuración leída por API: `enforcement=active`, 0 actores con bypass y las reglas anteriores |
| REP-04 | `CODEOWNERS` existe y cubre `.github/`, `firestore.rules`, `firebase.json`, `.devsecops.yml` y los lockfiles |
| SEC-02 y SEC-03 | Ningún secreto prohibido; los de producción (`GCP_SA_DEPLOY_PROD`, `GCP_WIF_PROVIDER`) están en el Environment `production` |
| SEC-06 | Secret scanning y push protection **activados** |
| REP-07 | Squash configurado por ruleset. En los ajustes del repositorio siguen habilitados el merge commit y el rebase; el ruleset los impide, pero conviene deshabilitarlos (cambio de configuración, queda a decisión de Andres) |
| Borrado de ramas al fusionar | Activo desde el 2026-09-28 |

Hallazgos que el checklist marca como **bloqueantes** y hoy están en rojo (detalle en el plan de migración): REP-03 (0 aprobaciones), SEC-01 (falta `docs/seguridad/inventario-secretos.md`), PIP-10 (falta el workflow `probar-identidad`), DAT-01 (no hay pruebas de las reglas de Firestore en el emulador), DAT-04 (sin respaldos), OPS-04 (falta el runbook de rollback) y REP-09 (parcial: ver Bloque 4). Ninguno afecta al sitio que hoy está en línea; todos importan antes de crear el primer tag.

### Bloque 4 — Dependabot al día

- No hay PR de Dependabot abiertos. Las alertas abiertas en GitHub son 4 (todas MEDIUM): `qs` y `uuid`.
- PR #34 (abierto): cierra `qs` 6.16.0 (`functions/`, vía `express` 4.22.3 y `body-parser` 1.20.8) y `undici` 7.30.0 (raíz, solo pruebas), solo en los lockfiles. MEDIUM de `./security-local.sh`: 9 → 5. Pruebas 19/19 y ambos builds en verde.
- **No se pueden cerrar ahora** los 5 restantes (todos `uuid`, CVE-2026-41907): en la raíz lo fija `exceljs` 4.4.0, sin versión corregida; en `functions/` lo fijan `firebase-admin` 12 y librerías de Google que exigen subirlo (Fase 4.4, Node 22). Además `dependabot.yml` excluye las versiones mayores, así que Dependabot no abrirá ese PR solo. Compromiso: 2026-10-26.
- **`dependabot.yml` no cubre `pip`.** Se quitó el 2026-09-20 porque entonces no había `requirements.txt`; ahora existe y está fijado, y sin `pip` no recibirá actualizaciones (REP-09). Propuesta, no aplicada: añadir el bloque `pip` del estándar, con `directory: /`.

### Rutas absolutas en un repositorio público

`CLAUDE.md` y los agentes `deploy`, `devsecops`, `proyectos` y `seguridad` llevan rutas absolutas del equipo del propietario desde que se aplicó el estándar. El PR #33 no agrega ninguna y no las cambia (los volvería distintos de la plantilla que SeguridadGeneral compara byte a byte). Corregirlas es un PR aparte, coordinado con el estándar.

## Jornada del 2026-09-30 — cierre de los PR, respaldo y paso 1

- **Avisos nuevos rompieron la CI de `main`.** Trivy baja la base de vulnerabilidades en cada run y hoy aparecieron 18 HIGH en el `package-lock.json` (`brace-expansion`, `undici` con dos CVE nuevos y `@grpc/grpc-js`). Cualquier PR, aunque no tocara dependencias, fallaba en `seguridad-estatica`. Se corrigió con #34: `brace-expansion` 1.1.21 y 2.1.7, `undici` 7.30.0 y `qs` 6.16.0; HIGH de `./security-local.sh`: 18 → 0, MEDIUM: 9 → 5.
- **Excepción de `@grpc/grpc-js` 1.9.16** (HIGH sin parche posible: lo fija `@firebase/firestore` 4.17.2 y `firebase` 12.19.0 es la última versión). Aprobada por Andres el 2026-09-30, vence el 2026-12-29. Evidencia: no aparece en el bundle publicado, `src/` no lo importa y los avisos son del lado servidor de gRPC.
- **Fusionados con autorización de Andres, de a uno y con el CI en verde** (cada uno redesplegó `pretso-database` con el mismo código; despliegue, humo y ZAP en verde y el sitio respondió 200 en todos): #34 (`8e94ede`, dependencias y excepción), #33 (`cb6c972`, modelo por rol v1 y v2), #35 (`782e1e3`, documentación), #36 (`0764cbc`, `@grpc/grpc-js` 1.14.5 en `functions/`, tras revisar su diff), #37 (`3a324cc`, `pip` en `dependabot.yml`), #38 (`63b9a83`, paso 1 del plan), #40 (`1c4c8a4`, `oxlint`), #39 (`dcf1855`, `firebase-admin` 7.7.0, probado en un entorno limpio porque la CI no ejecuta `requirements.txt`) y #41 (`92c9cc7`, SHA de `snyk/actions`: la comparación muestra un solo commit, que cambia su `CODEOWNERS`).
- **Respaldo automático activado y verificado** en `pretso-database` y en `pretso-prod` (PITR, protección contra borrado, respaldo diario de 30 días).
- **Paso 1 del plan (#38).** Cada ambiente tiene su configuración en `src/environments/` y el alias `@entorno`, que `vite.config.ts` resuelve según el modo de build: el bundle de staging contiene `pretso-database` (3 ocurrencias) y ninguna de `pretso-prod`; el de producción, al revés (0 y 2). Staging queda idéntico a antes (mismos seis valores, comparados por hash; el bundle publicado es idéntico por sha256 al de un build local). Producción tiene `apiKey`, `appId` y el Client ID vacíos hasta el paso 3; mientras tanto la aplicación lanza un error claro al iniciar y **el build de producción de un tag o de un `workflow_dispatch` falla**. `package.json` gana `build:staging` y `build:production`, sin los cuales `./deploy.sh staging` habría construido producción. **34 pruebas** (antes 19). Pasó dos revisiones con el agente `revisor-codigo`: la primera dio NO APROBADO por dos bloqueantes reales (el squash volvía a disparar Gitleaks en el push a `main` y `deploy.sh` construía producción) y la segunda, aprobado con un ajuste (el hueco del `workflow_dispatch`); los tres se corrigieron. Desviación del plan: archivos versionados por ambiente en vez de variables del repositorio (`.gitignore` excluye `.env.*`, REP-06 los prohíbe, la apiKey web y el Client ID son públicos).
- **Camino B confirmado.** El 30/09 Andres creó por error `pretso-prod-d8a68` sin recordar que `pretso-prod` ya existía; lo borró (`DELETE_REQUESTED`). No se creó ni se cambió nada en ese proyecto. Se conserva `pretso-prod`.
- **Carpeta principal limpia.** Antes de retirar los archivos sin versionar de la v1 se comprobó, uno por uno, que ya estaban en `main` (cinco idénticos; `CLAUDE.md` y `planificador.md` eran la versión anterior) y se guardó un respaldo. Los worktrees de los PR fusionados se retiraron tras comprobar que sus commits estaban dentro de lo fusionado.
- **Sitio comprobado por Andres tras #38:** abrió https://pretso-database.web.app y lo verificó.
- **Paso 3 del plan en GCP, con autorización de Andres.** `pretso-prod`: app web «PRETSO» registrada; **apiKey restringida** (de 27 APIs y sin restricción de referente a 4 APIs y 2 referentes, sin `localhost`; verificado con seis pruebas de respuesta HTTP antes y después); **Firebase Authentication inicializado** (no lo estaba: el inicio de sesión respondía `CONFIGURATION_NOT_FOUND`) con solo correo y contraseña y dominios autorizados limitados a los dos del sitio; **API de Drive habilitada**. El inicio de sesión desde el sitio responde ahora `INVALID_LOGIN_CREDENTIALS`, igual que en `pretso-database`.
- **Configuración de producción en el código** (`src/environments/production/firebase.ts`, con la `apiKey`, el `appId` y el `storageBucket` reales). Gitleaks marca con su regla genérica cualquier `apiKey` nueva aunque sea la clave web pública, porque el repositorio usa las reglas por defecto y el permitido del estándar cubre solo `gcp-api-key`. Con la aprobación de Andres se añadió a `.github/gitleaks.toml` un permitido de la regla `generic-api-key` acotado a `src/environments/<ambiente>/firebase.ts` (probado con una clave falsa en una copia: esas dos rutas permitidas, cualquier otra ruta con una clave sigue marcada). Es un hueco del estándar y se lleva a SeguridadGeneral.
- **Incidente menor, de mi parte:** al leer la configuración de Authentication de `pretso-database` como referencia imprimí sin filtrar el bloque `hashConfig` (parámetros de hash de contraseñas del proyecto) en la salida de la sesión. No salió ningún hash de usuario ni ninguna contraseña. Se reportó a Andres para su evaluación y las lecturas posteriores filtran esos campos; pero el mismo bloque se imprimió una segunda vez el 2026-10-01 al leer la configuración de Authentication en una revisión de seguridad (solo en el transcript de la sesión, sin hashes de usuarios ni contraseñas, sin escribirse en archivos; recomendación: no compartir el transcript). **Decisión de Andres (2026-10-01): solo anotarlo; no se rota nada.**

### Estado de los controles bloqueantes del checklist al cierre del 2026-09-30

| Control | Estado | Qué lo cambió o qué falta |
|---|---|---|
| DAT-04 respaldos y PITR | **Verde** en `pretso-database` y `pretso-prod` | Activados hoy |
| REP-09 Dependabot en todos los ecosistemas | **Verde** | #37 añadió `pip`; Dependabot abrió sus primeros PR de `pip` a los pocos minutos |
| REP-03 revisores ≥ 1 en `main` | Rojo | Desviación documentada (un solo dueño); falta aceptarla como «N/A justificado» |
| SEC-01 inventario de secretos | **Verde**: inventario en [`docs/seguridad/inventario-secretos.md`](docs/seguridad/inventario-secretos.md); las verificaciones pendientes (condición de confianza WIF y roles de las cuentas de despliegue) se siguen en SEC-07 y el segundo factor en la sección 10 del inventario |
| PIP-10 workflow `probar-identidad` | **Amarillo**: workflow `probar-identidad` creado; falta el run verde en `production` (requiere el primer tag; Andres decide cómo obtener ese run) | Run verde de `probar-identidad` con `ambiente=production` |
| DAT-01 pruebas de reglas de Firestore en el emulador | **Verde** | Evidencia: run de `main` 36866213607 (sha 7648692, job `calidad`, paso «Pruebas de reglas de Firestore (emulador)» en success) y los PR #48 a #50. Pruebas en `tests/rules` (`npm run test:rules`); las reglas con claim ya son `firestore.rules`. Hallazgo: con el registro por correo abierto en Authentication cualquier persona podría leer, por eso la propuesta restringe la lectura (`admin` o `reader`; `logs` y `users` solo admin); el registro **se desactivó el 2026-10-01** en `pretso-database` y `pretso-prod` (`disabledUserSignup`, verificado leyendo la configuración); la pantalla «Gestión de usuarios» ya no puede crear cuentas desde el navegador. **Asignar el claim `admin` en `pretso-prod` es requisito del pase y acción pendiente aparte** (no forma parte de DAT-01) |
| OPS-04 runbook de rollback | **Verde** | [`docs/produccion/runbook-rollback.md`](docs/produccion/runbook-rollback.md): comandos reales y responsable por componente, con lo no probado marcado como tal. Los ensayos de rollback y restauración se siguen en OPS-06 (pendiente aparte); ninguno se ha hecho |
| OPS-06 ensayos de rollback en staging | Rojo | Ninguno ejecutado; depende de él PIP-14 (rollback automático) |
| OPS-07 RTO/RPO | Rojo | Valores propuestos en el runbook, pendientes de confirmar por Andres |
| NUB-G06 App Check en `enforce` | Rojo (sería bloqueante con datos personales) | Se enciende primero en monitoreo |

Criterio del estándar: un solo rojo bloqueante impide el pase. Rojo B, con SEC-01 ya fusionado (#51): PIP-10 (workflow `probar-identidad`), OPS-06 (ensayos de rollback: Rojo, ninguno ejecutado), OPS-07 (RTO/RPO: valores propuestos, pendientes de confirmar por Andres) y NUB-G06 (App Check; clase R, B con datos personales). PIP-14 (rollback automático, clase B) depende de OPS-06 y sigue en rojo mientras OPS-06 lo esté. SEC-01 está en **Verde** (fusionado en #51); OPS-04 y DAT-01 ya no cuentan del conjunto. Por tanto quedan **cuatro** Rojo B tras fusionar #51 (PIP-10, OPS-06, OPS-07 y NUB-G06), más PIP-14 que depende de OPS-06; antes de fusionar #51 se suma SEC-01. No afectan al sitio en línea; importan antes del primer tag.

## Jornada del 2026-09-28 — registro tardío

Esta jornada no se había anotado.

- **Fase 4.5 (apiKey web de `pretso-database`), cerrada salvo App Check.** La clave pasó de 27 APIs a 4 (`identitytoolkit`, `securetoken`, `firestore` y `firebaseappcheck`) y de 5 referentes a 3 (`pretso-database.web.app`, `pretso-database.firebaseapp.com` y `localhost:5173`). Se guardó la configuración anterior para restaurarla. Verificado con seis pruebas de respuesta HTTP antes y después (inicio de sesión y renovación de sesión desde el sitio siguen permitidos; una API quitada y un referente quitado pasan a bloqueados) y confirmado por Andres iniciando sesión y cargando datos. **App Check sigue pendiente**: se enciende primero en modo monitoreo.
- **Aviso de Firebase Hosting** (el sitio por defecto deja de crearse solo en proyectos nuevos desde el 15/10/2026): **PRETSO no tiene tarea**, porque `pretso-database` y `pretso-prod` ya tienen su sitio. Sí la tiene el script `setup-oidc-gcp.sh` del estándar, que no crea el sitio; va a SeguridadGeneral.
- **#32** (`oxlint`/dependencias de desarrollo) fusionado.

## Jornada del 2026-10-01 — paso 2 y cliente OAuth

- **Paso 2 del plan en `pretso-prod`, con autorización de Andres.** **Auditoría de escrituras de Firestore activada** (`DATA_WRITE`) y verificada leyendo de nuevo la política: los 12 roles y sus miembros, idénticos. Un primer intento con el nombre que da la guía del estándar (`firestore.googleapis.com`) fue rechazado por la API sin cambiar nada: Firestore audita bajo `datastore.googleapis.com`. Es un defecto de `03-hardening-por-nube.md` que se lleva a SeguridadGeneral.
- **Presupuesto con alertas (GCP-07, bloqueante): no se pudo crear desde la sesión.** La cuenta `alberdi.andres@gmail.com` no tiene permisos sobre la cuenta de facturación (ve el vínculo, pero no puede describirla ni listar o crear presupuestos). Lo crea Andres en la consola; los valores están en el plan. Al intentarlo, `gcloud` quiso habilitar una API en `encuentramebo-1`, un proyecto que no es de PRETSO (el proyecto por defecto de la configuración de la sesión): **no se tocó**; las consultas siguientes se atribuyeron a `pretso-prod`.
- **Cliente OAuth de Drive de `pretso-prod` creado por Andres.** Su Client ID entra en `src/environments/production/google.ts` (su número inicial coincide con el del proyecto) y la prueba que exigía el valor vacío pasa a comprobar que el cliente es de `pretso-prod` y distinto del de staging. Verificado en los bundles: el de staging lleva solo su Client ID y el de producción solo el suyo; el bundle de staging conserva el mismo hash que el publicado. No se pudo comprobar su existencia con una consulta pública (Google responde 302 igual con uno inventado): la prueba real es la copia a Drive con la sesión de Andres, tras publicar.

### Controles bloqueantes tras esta jornada

DAT-04, REP-09, GCP-06 (auditoría de escrituras de Firestore) y **REP-03** en verde; GCP-07 (presupuesto) **declarado como creado por Andres, sin verificar desde la sesión**. DAT-01 pasa a verde (run de `main` 36866213607 (sha 7648692, job `calidad`, paso «Pruebas de reglas de Firestore (emulador)» en success) y los PR #48 a #50). SEC-01: verde, fusionado en #51. OPS-04 pasa a verde con el runbook de este PR. En rojo: PIP-10, OPS-06 (ninguno de los ensayos ejecutado), OPS-07 (valores pendientes de confirmar por Andres) y NUB-G06 (App Check); PIP-14 depende de OPS-06. Quedan **cuatro** Rojo B tras fusionar #51 (**cinco** antes, con SEC-01).

### REP-03 (revisores ≥ 1 en `main`): las dos salidas

El checklist del estándar exige al menos una aprobación en los PR a `main` (control bloqueante). `main` tiene 0 desde el 2026-09-25, porque el repositorio tiene un solo colaborador y GitHub no permite aprobar el propio PR; se conservan PR obligatorio, `compuerta-pr` con la rama al día, historia lineal, solo squash y cero bypass. Antes del primer tag hay que resolverlo de una de dos formas:

- **A. Aceptarlo como «N/A justificado»**, con la desviación firmada por Andres en el acta de pase (sección «Riesgos aceptados»), y revisarla cuando entre una segunda persona. No cambia ningún flujo de trabajo. Controles compensatorios vigentes: la CI completa debe pasar (SAST, gitleaks, dependencias, humo y ZAP), sin bypass, y **producción exige tag más aprobación del Environment `production`** por una persona.
- **B. Poner el ruleset en 1 aprobación y dar acceso de escritura a una segunda cuenta** que apruebe cada PR. Cumple la letra del control, pero si esa segunda cuenta es de la misma persona **no aporta una revisión independiente**: es un trámite más en cada PR. Solo cambia la seguridad real si la cuenta es de otra persona.

**Decidido por Andres el 2026-10-01: salida B.** El ruleset `proteccion-main` pasó a **1 aprobación** (se cambió solo ese valor y se verificó leyendo de nuevo que todo lo demás quedó idéntico: sin bypass, solo squash, `compuerta-pr` con la rama al día, historia lineal) y el repositorio tiene un **segundo colaborador**, `segurolotengopy` (escritura), sin invitaciones pendientes. Esa cuenta es de la misma persona, así que cumple la letra del control pero **no es una revisión independiente**; si entra otra persona, conviene que apruebe ella.

Cómo se trabaja ahora: cada PR necesita la aprobación de `segurolotengopy`, que la sesión da con el OK de Andres para ese PR concreto, nombrándolo. Como el ruleset descarta las aprobaciones al empujar nuevos commits (`dismiss_stale_reviews_on_push`), el orden es: poner la rama al día con `main`, esperar el CI en verde, aprobar y fusionar; cualquier push posterior obliga a aprobar de nuevo.

Hoy `main` despliega sin una segunda mirada independiente el sitio en uso (`pretso-database`); cuando `pretso-prod` sea producción, ese despliegue pasa a ser de un staging de verdad y el riesgo baja.

### Usuarios de autenticación (paso 5): medido el 2026-10-01

`pretso-database` tiene **3 usuarios** de Authentication (contado sin mostrar correos ni identificadores): los 3 con contraseña, ninguno deshabilitado, ninguno con claims personalizados, todos con ingresos (el último, el 2026-10-01), creados entre el 2026-07-14 y el 2026-07-29. Con tan pocos, la recomendación del plan es **recrearlos** en `pretso-prod` y enviar a cada uno un restablecimiento de contraseña, en vez de exportar e importar los hashes. `pretso-prod` no tiene ninguno todavía, así que nadie puede iniciar sesión allí hasta crearlos.

**Decisión del 2026-10-01 (Andres):** en producción habrá **dos administradores**, `alberdi.andres@gmail.com` y `pretsodatabase@gmail.com`, y **ningún otro usuario por ahora** (los lectores se verán más adelante). El mecanismo actual por correo fijo admite solo uno, así que la migración al custom claim `admin` (Fase 4.3, que cubre reglas, `AdminContext.tsx` y `functions/src/index.ts`) pasa a ser requisito del pase, con sus pruebas en el emulador (DAT-01).

- **Presupuesto con alertas de `pretso-prod` (GCP-07):** creado por Andres el 2026-10-01 en la consola, **no verificable desde la sesión** (la cuenta de la sesión no tiene permisos sobre la cuenta de facturación).
