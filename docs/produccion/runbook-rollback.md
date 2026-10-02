# Runbook de rollback e incidentes — PRETSO

Control OPS-04 del checklist de pase a producción (`/home/andres-alberdi/SeguridadGeneral/01-seguridad/05-checklist-pase-a-produccion.md`), adaptado de `06-rollback-e-incidentes.md` del estándar. Cubre también OPS-05 (contactos) y OPS-07 (RTO/RPO, sección 4, confirmados por Andres el 2026-10-01).

Alcance: aplicación web (React + Vite) en Firebase Hosting, reglas y datos de Firestore, Firebase Authentication, Cloud Functions (hoy hay una función antigua desplegada en `pretso-database`, véase 2.5) y configuración/IAM de dos proyectos:

| Proyecto | Papel | URL |
|---|---|---|
| `pretso-database` | Staging; hoy también el sitio en uso | `https://pretso-database.web.app` |
| `pretso-prod` | Producción (Environment `production` con revisor) | `https://pretso-prod.web.app` |

Este runbook lo mantiene el líder técnico del proyecto. Identidad con la que se ejecuta cada comando: véase la sección 2.0. Un rollback que no se ensayó no es un plan: la primera tabla dice con honestidad qué se validó y qué no.

## 0. Qué se probó y qué no

Fecha de redacción: 2026-10-01. «Validado» significa que el comando existe en la herramienta instalada (`firebase` 15.27.0, `gcloud` local; el pipeline fija `firebase-tools` 15.28.1) y que su sintaxis se comprobó con `--help`. **Los ensayos 3, 6, 7, 8 y 9 se ejecutaron contra `pretso-database` (staging) el 2026-10-01, y los ensayos 1, 4, 5 y 10 (parte B) el 2026-10-02 UTC; el resto de los comandos no se ha ejecutado con fines de rollback.** «NO PROBADO» significa que no se ejecutó ni se pudo validar por completo.

| # | Procedimiento | Estado | Observación | Ensayo propuesto en staging (no ejecutado) |
|---|---|---|---|---|
| 1 | `firebase hosting:clone <sitio>:previa <sitio>:live` (rollback de Hosting) | **Ensayado el 2026-10-02 (staging)** con [`probar-rollback-staging.yml`](https://github.com/AndresAlberdi/PRETSO/actions/runs/36968272567) (SUCCESS): `hosting:clone previa → live` dejó `live = previa (65ed6c)` con HTTP 200, y `live` se restauró a la versión original (d0623a). Rollback de producción **NO PROBADO**. Detalle en la [sección 7](#7-registro-de-ensayos-ops-06) | El mismo comando lo ejecuta el paso de rollback al final del job `desplegar-produccion` si falla el health check, pero ese camino nunca se ha disparado. Revierte solo Hosting. `previa` puede estar caducado o desactualizado (véase 2.1). Aprendido el 2026-10-02: `hosting:clone` dentro del mismo sitio no crea una versión nueva, solo un release con el mismo `version.name` | En `pretso-database`: guardar `live` en `previa`, publicar una versión marcada con un cambio visible, clonar `previa` sobre `live`, comprobar que el cambio desaparece y medir el tiempo |
| 2 | Crear y clonar el canal `previa` antes del deploy | El clon corre en cada despliegue y, con la plantilla 2.9, el plazo de `previa` se renueva a 30 días con un PATCH REST (`updateMask=ttl`) que el ensayo del 2026-10-02 confirmó que **funciona en el servicio real** (`previa` expira 30 días después del último despliegue); en producción hay que mirar el `::warning::` en el primer despliegue | En staging `previa` expira el 2026-10-26 aunque se clonó el 2026-10-01 (estado previo a la plantilla 2.9, que renueva el plazo en cada despliegue). **El primer despliegue a producción no tiene versión anterior a la que volver**: el canal `live` de `pretso-prod` no tiene release, así que `hosting:clone live previa` fallará; con la plantilla 2.9 el paso emite un aviso (`::notice::`/`::warning::`) y el job sigue (el paso mantiene `continue-on-error: true`). Tras cada despliegue hay que verificar la versión de `previa` (2.1) | Comprobar `expireTime` y la versión del release de `previa` (2.1) tras un despliegue de staging real; en producción, verificarla tras el primer despliegue |
| 3 | Listar versiones y releases de Hosting con la API REST | **Ensayado el 2026-10-01 (staging)**: lecturas por API REST correctas (releases tipo DEPLOY y canal `previa`); rollback **NO PROBADO**. Detalle en la [sección 7](#7-registro-de-ensayos-ops-06) | `firebase hosting:versions:list` y `hosting:releases:list` **no existen** en `firebase` 15.27.0 (el documento del estándar los menciona); se usa la API REST | Ejecutar las dos consultas de lectura de la sección 2.1 contra `pretso-database` y confirmar que devuelven datos |
| 4 | Revertir a una versión concreta (`hosting:clone <sitio>@<versión> <sitio>:live`; la alternativa REST es `sites.releases.create`) | **Ensayado el 2026-10-02 (staging)** con el mismo [run](https://github.com/AndresAlberdi/PRETSO/actions/runs/36968272567): se usó en la restauración y `live` volvió a la versión original (d0623a) con HTTP 200. La variante REST `sites.releases.create` **no se ensayó**. Detalle en la [sección 7](#7-registro-de-ensayos-ops-06) | Es el recurso para cuando `previa` no sirve (por ejemplo, tras dos despliegues seguidos) | Crear una release que apunte a una versión anterior en `pretso-database` y verificar |
| 5 | Rollback de reglas de Firestore con `git revert` + PR + despliegue | **Ensayado el 2026-10-02 (staging)**: ida [#67](https://github.com/AndresAlberdi/PRETSO/pull/67) (cambio inocuo, solo comentarios) y vuelta [#68](https://github.com/AndresAlberdi/PRETSO/pull/68) (`git revert`); las reglas publicadas volvieron a la huella original (`313b2ee1ee9c2c1b`) en unos 10 min de punta a punta. Rollback de reglas en `pretso-prod` **NO PROBADO** (mismo procedimiento; allí las reglas llegan solo con un tag). Detalle en la [sección 7](#7-registro-de-ensayos-ops-06) | El rollback automático solo revierte Hosting | Ejecutado: cambio inocuo de reglas en `pretso-database`, fusión, `git revert` por PR, fusión y comparación de la huella SHA-256 del ruleset publicado con la del archivo; las pruebas de reglas (87) corrieron en el CI de ambos PR |
| 6 | Restauración de Firestore a un punto en el tiempo (`gcloud firestore databases clone --snapshot-time`) | **Ensayado el 2026-10-01 (staging)**: clon PITR de una base de 563 documentos, 12 a 14 min, recuento idéntico al origen. Detalle en la [sección 7](#7-registro-de-ensayos-ops-06) | Crea una base nueva; la base clonada hereda la protección contra borrado (2.3); hay que reconciliar y, si se decide, apuntar la aplicación a ella | Clonar `(default)` de `pretso-database` a una base `ensayo-pitr`, contar documentos por colección frente a la original, borrar la base de ensayo; medir duración |
| 7 | Restauración desde respaldo diario (`gcloud firestore databases restore --source-backup`) | **Ensayado el 2026-10-01 (staging)**: restauración desde el respaldo diario, unos 14 min, recuento idéntico (563). Detalle en la [sección 7](#7-registro-de-ensayos-ops-06) | Los respaldos están activos desde el 2026-09-30 (retención 30 días, según `ESTADO.md`) | Ídem 6 usando el respaldo más reciente de staging y una base `ensayo-respaldo` |
| 8 | Quitar el claim `admin` con `asignar_claim_admin.py --quitar --aplicar` | **Ensayado el 2026-10-01 (staging)** con una cuenta temporal: asignar y quitar el claim verificados, revocación de tokens de renovación confirmada; el script se niega a asignar el claim a una cuenta deshabilitada. Detalle en la [sección 7](#7-registro-de-ensayos-ops-06) | `--quitar` ya revoca los tokens de refresco (`revoke_refresh_tokens`) | Sin `--aplicar` en `pretso-database` (solo lectura) y luego con `--aplicar` sobre una cuenta de prueba, verificando la sesión caída |
| 9 | Deshabilitar una cuenta de servicio (`gcloud iam service-accounts disable`) | **Ensayado el 2026-10-01 (staging)** con una cuenta temporal: `disable` y `enable` correctos; la lectura inmediata puede mostrar un estado atrasado. Detalle en la [sección 7](#7-registro-de-ensayos-ops-06) | Es contención de incidente, no se ensaya en producción | Deshabilitar y volver a habilitar una cuenta de servicio de prueba en staging |
| 10 | Rollback automático dentro de `desplegar-produccion` (health check falla y clona `previa` sobre `live`) | **Ensayado el 2026-10-02 (staging)**, en dos partes. **Parte A, hecha: prueba automática de la lógica** (sin red, corre en CI: 48 pruebas en `calidad`). **Parte B, hecha: ensayo real del camino de clonado en staging** con [`probar-rollback-staging.yml`](https://github.com/AndresAlberdi/PRETSO/actions/runs/36968272567) (SUCCESS). **El rollback automático real en producción sigue NO PROBADO** hasta el primer despliegue (el primer despliegue no tiene versión anterior) | El health check y el rollback automático son los pasos finales del job `desplegar-produccion` (aprobado y autenticado); `post-despliegue` solo registra el Deployment. Antes de la plantilla 2.9 el rollback no podía funcionar (`post-despliegue` recibía vacíos los secretos de `production`). Revierte **solo Hosting**. Staging no tiene esos pasos | **Parte A** — `tests/workflows/test_rollback_automatico.py` (job `calidad`, paso «Pruebas de lógica de los workflows»): ejecuta el `run:` real de los pasos del job con dobles de `curl`, `firebase`, `npm` y `sleep`. Verifica: salud al primer intento sin rollback; 10 fallos → `ok=false`, un solo `hosting:clone <sitio>:previa <sitio>:live` con el sitio correcto y job en rojo; 404 en `HEALTH_PATH` con `/` en 200 → sano; despliegue fallido → ni health check ni rollback. Resultado definido si el clon falla: el paso de rollback queda **en verde** con `::error::` y las instrucciones del rollback manual, y el job queda **en rojo** por «Fallar si producción no responde». Si falla la instalación de firebase-tools dentro de ese paso, el paso queda en rojo y «Fallar…» se omite: el job queda en rojo igual. **Parte B (ejecutada el 2026-10-02)** — `.github/workflows/probar-rollback-staging.yml` (`workflow_dispatch`, `confirmar=ROLLBACK-STAGING`, Environment `staging`). Comprueba HTTP 200 y registra `live` y `previa`. Si `previa` no existe, caduca en menos de 1 h, no está FINALIZED o es igual a `live`, termina en rojo sin tocar nada. Si no, clona `previa` sobre `live`, verifica versión y HTTP 200 y restaura la versión original (`hosting:clone <sitio>@<versión> <sitio>:live`) aunque falle un paso intermedio. **Toca el sitio en uso unos minutos.** Su lógica también tiene prueba sin red (`tests/workflows/test_probar_rollback_staging.py`). Al ejecutarse con éxito cubre también el comando del ensayo 1 (cubierto el 2026-10-02) |
| 11 | Rollback completo de **producción** | **NO PROBADO** | Producción no tiene aún ningún despliegue, y el primer despliegue **no tiene versión anterior a la que volver** (el canal `live` no tiene release; véase la fila 2): hasta que exista un segundo despliegue, el rollback de Hosting en producción no es posible con `previa` y habría que publicar una versión conocida con `sites.releases.create` | Ver el criterio OPS-06: el ensayo se hace en staging con el mismo procedimiento; el primer rollback real en producción se hace con el equipo avisado. **El primer despliegue a producción es también la primera prueba positiva de la identidad de producción (SEC-07/PIP-10):** se corre `probar-identidad` con `ambiente=production` sobre el tag y se aprueba antes de aprobar el despliegue; si la autenticación falla cerrada, se revierte la condición del provider (sección 2.6) en vez de ampliar el binding |
| 12 | Cloud Functions | **Hay una función antigua desplegada en `pretso-database`** (`createReaderUser`); en `pretso-prod` no hay | La versión desplegada es anterior a la migración al claim; el pipeline no la actualiza (`FIREBASE_DEPLOY_ONLY=hosting,firestore:rules`). Decisión pendiente: retirar o redesplegar (2.5) | Tras la decisión, ensayar en staging el procedimiento elegido |

OPS-06 (prueba de rollback en staging en los últimos 90 días) está en **Verde** desde el 2026-10-02 UTC, con todos los ensayos de este runbook ejecutados en staging. Hechos: 3, 6, 7, 8 y 9 el 2026-10-01; 1, 4, 5 y 10 (parte B) el 2026-10-02 (staging); la parte A del 10 corre en CI. **Criterio:** el checklist del estándar (`05-checklist-pase-a-produccion.md`, OPS-06) pide «prueba de rollback ejecutada en staging con el procedimiento del runbook en los últimos 90 días», con registro de fecha, duración y resultado; un rollback de Hosting probado lo satisfacía en la letra; este runbook definía además el ensayo 5 (reglas), porque el rollback automático solo revierte Hosting, y ya se ejecutó. **Salvedad honesta:** el rollback de producción sigue NO PROBADO hasta el primer despliegue, y el rollback automático real en producción tampoco se ha ejercitado; tampoco se ha ensayado el rollback de reglas en `pretso-prod`. Vigencia: los ensayos del 2026-10-02 valen 90 días (hasta 2026-12-31); los del 2026-10-01 vencen el 2026-12-30. Se registran fecha, duración y resultado en la tabla de la sección 7. El seguimiento de los ensayos corresponde a OPS-06, no a OPS-04.

## 1. Quién decide, quién ejecuta

| Rol | Persona o agente | Qué hace |
|---|---|---|
| Autoriza | Andres (propietario) | Decide el rollback, la restauración y cualquier acción sobre producción; aprueba el Environment `production`; es el único con acceso a la consola de facturación |
| Opera | Claude Code (sesión principal, con el agente `deploy` para staging) | Ejecuta los comandos de este runbook tras la autorización de Andres en el chat e informa el resultado real |
| Revisa | `revisor-codigo`, `seguridad` | Revisan el PR de un `git revert` y los incidentes con implicación de seguridad |
| Aprobador del Environment `production` | Andres | Aprueba el despliegue; no existe segundo revisor independiente (desviación documentada en `PILOTO.md`) |

Reglas fijas: Claude no ejecuta nada que escriba en `pretso-prod` sin la autorización explícita de Andres en esa conversación; no usa `deploy.sh prod` ni `--forzar`; no crea tags. Las acciones de consola que exija el sistema (aprobar el Environment, ver la facturación) las hace Andres con el enlace exacto que Claude le entrega.

## 2. Rollback por componente

### 2.0 Identidad y entorno de cada comando

- `firebase` (Hosting, reglas, funciones): se ejecuta **desde la raíz del repositorio** (lee `firebase.json`). Requiere una cuenta seleccionada con `firebase login:use <cuenta>` que tenga un rol mínimo de Hosting (por ejemplo, administrador de Firebase Hosting) en el proyecto; para reglas hace falta además el rol de administrador de reglas de Firestore. **Hoy la CLI de `firebase` de esta máquina da 403 en `hosting:channel:list`**: antes de un incidente hay que dejar lista una cuenta con ese rol y comprobarla con un comando de lectura. Mientras tanto, la vía REST con `gcloud` (`curl` con `gcloud auth print-access-token`, como en 2.1) es hoy el plan B ante el 403 de la CLI de `firebase`.
- `gcloud` y `curl` a APIs de Google: con credenciales de usuario; para las APIs REST se usa el proyecto de cuota (cabecera `x-goog-user-project`).
- `scripts/asignar_claim_admin.py`: credenciales por defecto de aplicación (`gcloud auth application-default login`), con proyecto de cuota definido.
- Nada de esto lo ejecuta el pipeline salvo el paso de rollback automático al final de `desplegar-produccion` (identidad de despliegue por WIF; revierte solo Hosting). El job `post-despliegue` ya no usa credenciales de nube: solo registra el Deployment.

Variables usadas en los comandos (se definen en la sesión; no contienen secretos):

```bash
PROYECTO=pretso-prod        # o pretso-database para staging
SITIO=$PROYECTO             # el ID del sitio coincide con el proyecto
```

Nota sobre `FIREBASE_SITE_ID`: la variable no está definida en el repositorio; el pipeline usa entonces `GCP_PROJECT_ID_PROD` como ID de sitio, igual que este runbook. Si se define `FIREBASE_SITE_ID`, `SITIO` debe tomar ese valor.

### 2.1 Firebase Hosting (aplicación web)

| Aspecto | Detalle |
|---|---|
| Qué se rompe | La SPA publicada no carga, muestra pantalla en blanco, falla el inicio de sesión o una pantalla clave; cabeceras CSP que bloquean recursos (`firebase.json`) |
| Cómo se detecta | Falla el health check al final del job `desplegar-produccion` (10 intentos cada 15 s sobre `PROD_URL` más `HEALTH_PATH`, que en este repositorio vale `/`); reporte de un usuario; revisión visual tras cada despliegue. **Limitación:** por el rewrite `** -> /index.html` de `firebase.json`, casi cualquier ruta devuelve 200, de modo que el chequeo solo detecta una caída total y no una pantalla en blanco o un fallo de inicio de sesión. Es una desviación frente al «health check significativo» del estándar; mejorarlo (por ejemplo, comprobar un contenido propio de la aplicación) queda como pendiente |
| Tiempo estimado | Menos de 1 minuto (el CDN cambia la versión de forma atómica) |
| Decide / ejecuta | Decide Andres; ejecuta Claude. El rollback automático del pipeline no requiere decisión |

El pipeline, antes de cada despliegue, intenta crear el canal `previa` con `--expires 30d`, clona a él lo que está en `live` y renueva su plazo a 30 días. El rollback es clonar de vuelta. El rollback automático (al final de `desplegar-produccion`, tras el health check) revierte solo Hosting; reglas de Firestore, funciones y datos no se revierten solos.

**Advertencia sobre `previa`:** `--expires 30d` solo se aplica al **crear** el canal y `hosting:clone` no renueva la caducidad. Con la plantilla 2.9 el pipeline renueva el plazo a 30 días en cada despliegue con un PATCH REST (`PATCH sites/<sitio>/channels/previa?updateMask=ttl`), pero **ese PATCH no se ha verificado contra el servicio real**: hay que mirar el `::warning::` en el primer despliegue. Si falla, el canal conserva su plazo y, pasado este, desaparece y el rollback automático dejaría de estar disponible. En staging `previa` expira el 2026-10-26 (estado previo a la plantilla 2.9). Por eso, **antes de confiar en `previa` hay que comprobar su `expireTime` y la versión de su release** (debe ser la que estaba en `live` antes del despliegue malo). **No** se debe usar `hosting:channel:deploy --expires`: publicaría el build nuevo en `previa` y destruiría la copia de rollback. Además, **el primer despliegue a producción no deja copia de rollback**: el canal `live` de `pretso-prod` no tiene release y `hosting:clone live previa` falla; con la plantilla 2.9 el paso emite un aviso y el job sigue. Tras cada despliegue hay que verificar la versión de `previa`. Comandos:

```bash
# 1. Comprobar que el canal existe, su caducidad (expireTime) y la versión de su release.
#    `firebase hosting:channel:list` NO muestra la versión (solo ID, última release, URL y expiración)
#    y hoy da 403; se usa la lectura REST y se compara release.version.name con la lista de releases (2.1, abajo)
TOKEN=$(gcloud auth print-access-token)
curl -sS -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROYECTO" \
  "https://firebasehosting.googleapis.com/v1beta1/sites/$SITIO/channels/previa"

# 2. ROLLBACK: restaurar a live lo que había antes del despliegue
firebase hosting:clone "$SITIO:previa" "$SITIO:live" --project "$PROYECTO"

# 3. Verificar
curl -sS -o /dev/null -w '%{http_code}\n' -L "https://$SITIO.web.app/"
```

Si el canal `previa` no sirve (caducó, o hubo dos despliegues seguidos y ya contiene la versión mala), se elige una versión anterior. En `firebase` 15.27.0 no existen `hosting:versions:list` ni `hosting:releases:list`; la lista se obtiene con la API REST (NO PROBADO) y la vía principal para restaurar es la CLI: el código de `hosting:clone` de `firebase-tools` 15.27.0 acepta como origen `<sitio>@<versión>` (verificado leyendo el código instalado; **NO PROBADO** ejecutándolo):

```bash
TOKEN=$(gcloud auth print-access-token)
# Releases recientes del sitio (cada una trae su versión y su mensaje)
curl -sS -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROYECTO" \
  "https://firebasehosting.googleapis.com/v1beta1/sites/$SITIO/releases?pageSize=10"

# Vía principal: VERSION_ID es el último tramo del nombre de la versión (sites/<sitio>/versions/<VERSION_ID>)
firebase hosting:clone "$SITIO@<VERSION_ID>" "$SITIO:live" --project "$PROYECTO"

# Vía alternativa por API (NO PROBADO): publicar de nuevo una versión concreta
# (VERSION = nombre completo tomado de la lista anterior)
curl -sS -X POST -d '' -H "Authorization: Bearer $TOKEN" -H "x-goog-user-project: $PROYECTO" \
  "https://firebasehosting.googleapis.com/v1beta1/sites/$SITIO/releases?versionName=$VERSION"
```

**Ensayo 10 (`probar-rollback-staging.yml`) interrumpido a la fuerza.** El paso «Restaurar la versión original en live» corre aunque falle o se cancele un paso posterior al estado inicial, pero no corre si la ejecución se cancela a la fuerza (*force cancel*) o se pierde el runner. En ese caso `live` puede quedar sirviendo la versión de `previa` y se restaura a mano: el paso «Estado inicial (live, previa y HTTP 200)» imprime en su log el id completo de la versión original (`Versión original de live (restauración manual, runbook 2.1): <sitio>@<VERSION_ID>`). Se comprueba primero qué versión sirve `live` (lectura REST del paso 1 de arriba, cambiando `previa` por `live`); si es la de `previa`, se ejecuta `firebase hosting:clone "<sitio>@<VERSION_ID>" "<sitio>:live" --project "$PROYECTO"` con ese id completo (no con los 6 caracteres del resumen) y se verifica la versión y el HTTP 200; si es una tercera versión, alguien desplegó entretanto y no se sobrescribe sin revisarlo.

Alternativa por consola de Firebase: Hosting, «Release history», menú de la versión anterior, «Rollback» (la hace Andres si Claude no tiene acceso). Cada despliegue lleva el mensaje `producción <tag> (run <id>)` o `staging <sha> (run <id>)`, que permite identificar la versión.

Límite: Hosting no revierte reglas ni datos (secciones 2.2 y 2.3).

### 2.2 Reglas de Firestore

| Aspecto | Detalle |
|---|---|
| Qué se rompe | Lecturas o escrituras denegadas a usuarios legítimos (por ejemplo, claim `admin` ausente tras endurecer las reglas), o reglas demasiado abiertas |
| Cómo se detecta | Errores `permission-denied` en la consola del navegador o en los registros de Firestore; reporte de usuarios; `npm run test:rules` en CI antes del despliegue |
| Tiempo estimado | Medido el 2026-10-02 en staging (ensayo 5): despliegue de las reglas unos 2,5 a 3 min tras fusionar (05:27:35Z fusión de [#67](https://github.com/AndresAlberdi/PRETSO/pull/67), reglas publicadas 05:30:28Z; 05:35:57Z fusión de [#68](https://github.com/AndresAlberdi/PRETSO/pull/68), reglas publicadas 05:38:26Z), y unos 10 min de punta a punta (PR de ida abierto 05:24:37Z, reglas originales restauradas 05:38:26Z), con los dos PR ya preparados y aprobados. Producción suma la aprobación del Environment y un tag nuevo |
| Decide / ejecuta | Decide Andres; ejecuta Claude con el agente `devsecops` o `implementador` y revisión de `seguridad` |

El rollback automático **solo revierte Hosting**: las reglas se despliegan en el mismo paso (`hosting,firestore:rules`) pero no se restauran. Procedimiento normal, por la rama protegida (no se hace push directo a `main`):

```bash
git switch -c fix/revertir-reglas-<fecha> origin/main
# Un revert de un commit de squash revierte TODO el PR (por ejemplo, 7648692 cambió reglas, app y función).
# Para volver solo las reglas, se restituye ese archivo desde el commit anterior al cambio:
git checkout <sha-del-commit-que-cambio-las-reglas>^ -- firestore.rules
npm test && npm run lint
firebase emulators:exec --only firestore "npm run test:rules"
# PR hacia main (plantilla .github/PULL_REQUEST_TEMPLATE.md); al fusionar, staging se despliega solo.
```

Fusionar en `main` **solo despliega staging**. Para llevar el rollback a producción hace falta un tag `vX.Y.Z` nuevo, con aprobación del Environment `production` (lo hace Andres); es decir, otra ejecución completa de CI. Antes del primer tag este camino no aplica, porque producción aún no tiene despliegues.

Emergencia con producción rota y sin tiempo para el PR: reponer solo las reglas del tag anterior y desplegarlas a mano. **Este camino se salta el Environment y el pipeline y entra en conflicto con la regla 6 de `CLAUDE.md` y con «Andres autoriza; Claude opera»**. Por eso es una excepción que se registra en el issue de incidente (quién autorizó, hora, motivo), se hace en una rama o worktree aparte (no sobre la rama de trabajo) y, antes de ejecutarla, se verifica qué identidad tiene permiso de despliegue en `pretso-prod` (2.0). Requiere autorización explícita de Andres y se regulariza con el PR después.

```bash
git diff vX.Y.(Z-1) -- firestore.rules   # revisar qué se repone antes de desplegar
git checkout vX.Y.(Z-1) -- firestore.rules
firebase deploy --only firestore:rules --project pretso-prod --non-interactive --message "rollback de reglas a vX.Y.(Z-1)"
```

Nota de diseño: según `firestore.rules`, la escritura es solo de `admin`, en todas las colecciones; la lectura es de `admin` o `reader`, excepto `logs` y `users`, que solo lee `admin`. `logs` solo admite altas desde el cliente (autor igual al correo del token y hora del servidor); no se edita ni se borra, y la depuración de datos personales (APP-09/16) se haría con el Admin SDK, decisión pendiente de Andres.

Riesgos conocidos de la bitácora (compromiso a 30 días: 2026-10-31):

- La bitácora la escribe el navegador y es opcional: un administrador con token válido puede escribir con el SDK sin dejar registro. Solución de fondo: generarla en el servidor con una función y fijar `allow create: if false`.
- `details` guarda una copia íntegra de los registros borrados o editados. Hay que minimizarla, definir una retención y preparar un script de depuración con el Admin SDK.
- Un alta rechazada se pierde en silencio (el error solo queda en la consola del navegador). Todo administrador debe tener correo en el token. Antes de desplegar reglas con claims hay que asignarlos (sección 2.4); no asignarlos es la causa previsible más probable de un rollback de reglas.

### 2.3 Datos de Firestore (PITR y respaldo diario)

| Aspecto | Detalle |
|---|---|
| Qué se rompe | Documentos borrados o corrompidos por un defecto de código, una migración (`scripts/migrate_ods.py`) o un error humano |
| Cómo se detecta | Contadores de corpus distintos de lo esperado, reporte de usuarios, registros de auditoría de escrituras de Firestore (GCP-06; solo `DATA_WRITE`), exportación que no coincide |
| Tiempo estimado | 30 a 120 minutos, según el tamaño de la base. Medido el 2026-10-01 con una base de 563 documentos: 12 a 14 minutos por clon o restauración (sección 4); con más datos hay que volver a medir |
| Decide / ejecuta | Decide Andres (implica reconciliar datos y cambiar a una base nueva); ejecuta Claude |

Protecciones activas desde el 2026-09-30 en ambos proyectos: PITR con ventana de 7 días, protección contra borrado y respaldo diario con retención de 30 días.

**Advertencia (ensayo del 2026-10-01): la base clonada o restaurada hereda la protección contra borrado.** Para borrar una base temporal (de ensayo) hay que quitarla primero, indicando siempre `--database`: sin esa opción el comando actúa sobre `(default)`. La bandera es booleana (`--no-delete-protection`, no `=disabled`). Mientras la base se restaura, la API responde «Cannot serve requests when the database is undergoing a restore» y el borrado puede rechazarse con «in the middle of restore»: hay que reintentar hasta que se acepte.

```bash
gcloud firestore databases update --database="$BASE_NUEVA" --no-delete-protection --project "$PROYECTO"
gcloud firestore databases delete --database="$BASE_NUEVA" --project "$PROYECTO"   # reintentar si sigue «in the middle of restore»
```

**Copia entre proyectos (paso 4 del plan de migración).** El 2026-10-02 (UTC) se ensayó la copia de `pretso-database` a `pretso-prod` y ya hay una **copia de ensayo** en `pretso-prod` (563 documentos, verificada). Comandos reales usados (el bucket temporal, con acceso uniforme, sin acceso público y ciclo de vida de 1 día, se borró después):

```bash
gcloud firestore export gs://<bucket>/v1 --project=pretso-database --database='(default)' --snapshot-time=<ISO UTC, minuto entero> --collection-ids=<lista explícita de las 9 colecciones>
gcloud firestore import gs://<bucket>/v1 --project=pretso-prod --database='(default)'
python3 scripts/verificar_copia_firestore.py --colecciones <las 9> --hora-origen <la misma hora>   # solo lectura
```

Para vaciar el destino antes del volcado definitivo (o para revertir la copia): `gcloud firestore bulk-delete --project=pretso-prod --database='(default)' --collection-ids=<lista explícita de las 9>`. **Nunca** sin `--collection-ids` ni sin `--project`: el `gcloud` por defecto apunta a otro proyecto ajeno. Después, confirmar que quedó vacío. La importación sobrescribe documentos con el mismo ID y no borra los demás, por eso se vacía antes. `logs` trae correos: el bucket y la copia se tratan como datos personales (APP-09).

Regla de oro: **nunca restaurar sobre la base afectada**. Las dos formas crean una base nueva; después se compara y se decide.

```bash
BASE_NUEVA=restaurada-<AAAAMMDD>

# Ver estado de protección, PITR y programa de respaldo
gcloud firestore databases describe --database='(default)' --project "$PROYECTO"
gcloud firestore backups schedules list --database='(default)' --project "$PROYECTO"

# A) Punto en el tiempo (hasta 7 días atrás; instante anterior al daño, en UTC)
gcloud firestore databases clone \
  --source-database="projects/$PROYECTO/databases/(default)" \
  --snapshot-time=2026-MM-DDTHH:MM:00Z \
  --destination-database="$BASE_NUEVA" --project "$PROYECTO"

# B) Respaldo diario (hasta 30 días atrás)
LOCALIZACION=<ubicación que muestra "describe">
gcloud firestore backups list --location="$LOCALIZACION" --project "$PROYECTO"
gcloud firestore databases restore \
  --source-backup="projects/$PROYECTO/locations/$LOCALIZACION/backups/<ID_DEL_RESPALDO>" \
  --destination-database="$BASE_NUEVA" --project "$PROYECTO"
```

Después de restaurar:

1. Comparar el número de documentos por colección entre la base afectada y `$BASE_NUEVA`.
2. Reconciliar lo escrito entre el instante restaurado y la detección (exportar de la base afectada lo creado después y reimportarlo, o repetirlo a mano).
3. Cambiar la aplicación a la base nueva solo con autorización de Andres. La aplicación usa la base `(default)`. Hay dos caminos, ambos sin resolver y por diseñar y ensayar antes de necesitarlos (ensayos 6 y 7):
   - Apuntar la aplicación a `$BASE_NUEVA`: es un cambio de código y de despliegue. **Una base nueva no recibe `firestore.rules`**: `firebase.json` solo despliega reglas a `(default)`, de modo que habría que declarar la base nueva en `firebase.json` y desplegarle las reglas antes de abrirla; sin reglas, queda con el estado por defecto de la plataforma.
   - Exportar `$BASE_NUEVA` e importarla en `(default)`: **contradice la regla de oro** (restaura sobre la base afectada) y la importación **sobrescribe los documentos con el mismo ID sin borrar lo creado después**, de modo que no devuelve el estado exacto. Exige además un bucket privado en una ubicación compatible con la base (la base está en `nam5`, multirregión: el bucket va en la multirregión US); **ese bucket no existe hoy** y contendría datos personales (correos), por lo que hay que crearlo con acceso uniforme, sin acceso público y con autorización de Andres.
   - Alternativa para recuperar documentos puntuales: `gcloud firestore export gs://<bucket>/<prefijo> --snapshot-time=<instante> --collection-ids=<colección> --project "$PROYECTO"` (el argumento `gs://<bucket>/<prefijo>` es obligatorio; la opción existe en `gcloud firestore export --help`; instante dentro de la ventana PITR) hacia ese mismo bucket, e importar solo lo necesario. NO PROBADO.
4. Dejar la base nueva sin borrar hasta cerrar el incidente. Las bases de **ensayo** se borran al terminar el ensayo (costo y datos personales), igual que el bucket y su contenido si fue solo para el ensayo.

Una pérdida acotada en datos de lectura (el corpus) también se puede recomponer con la exportación de la pantalla «Administración» (XML, XLSX, copia a Drive) y `scripts/migrate_ods.py`; es un segundo respaldo, no sustituye a PITR.

### 2.4 Authentication y claims

| Aspecto | Detalle |
|---|---|
| Qué se rompe | Un administrador pierde el acceso (claim ausente), una cuenta tiene privilegio indebido, el registro se reabre, o un proveedor/dominio autorizado queda mal configurado |
| Cómo se detecta | El usuario ve «sin permiso» pese a tener cuenta; lectura del claim con el script en modo solo lectura; revisión de la configuración de Authentication (`disabledUserSignup` debe seguir activo) |
| Tiempo estimado | Menos de 5 minutos por cuenta |
| Decide / ejecuta | Decide Andres; ejecuta Claude con credenciales de usuario (`gcloud auth application-default login`); el script no imprime uid ni tokens, pero **sí imprime el correo** de la cuenta (no pegar su salida en issues públicos) |

```bash
# Ver el cambio previsto (solo lectura)
python3 scripts/asignar_claim_admin.py --proyecto "$PROYECTO" --correo <cuenta>

# Asignar el claim (restaura el acceso de un administrador)
python3 scripts/asignar_claim_admin.py --proyecto "$PROYECTO" --correo <cuenta> --aplicar

# QUITAR el claim (cuenta comprometida o privilegio indebido): también revoca los tokens de refresco
python3 scripts/asignar_claim_admin.py --proyecto "$PROYECTO" --correo <cuenta> --quitar --aplicar
```

El script ya llama a `revoke_refresh_tokens` al quitar el claim, y verifica el resultado releyéndolo. Un ID token ya emitido sigue siendo válido hasta una hora (límite de Firebase). Para una cuenta comprometida se deshabilita además la cuenta en la consola de Authentication (acción de Andres o de Claude con su autorización), pero eso tampoco cierra esa ventana (véanse las limitaciones abajo). Los códigos de salida del script son 0 (bien), 1 (error o verificación distinta) y 2 (la cuenta no existe).

Limitaciones que hay que conocer:

- **Ventana de hasta 1 hora.** Deshabilitar la cuenta o revocar los refresh tokens no invalida un ID token ya emitido con `admin: true`, porque las reglas no consultan la revocación. La contención inmediata exige un cambio de reglas (denegar el uid afectado, con el despliegue de 2.2) o aceptar la ventana.
- **Sin claim, no se revoca.** Si la cuenta ya no tenía el claim, el script responde «sin cambios» y no revoca sus refresh tokens; en ese caso hay que revocarlos por otra vía.
- **Hueco para `reader`.** `scripts/asignar_claim_admin.py` solo gestiona `admin`; no existe vía operativa para asignar o restituir el claim `reader` salvo la función `createReaderUser` (2.5). Si un lector pierde el acceso, hoy no hay procedimiento documentado ni probado para restituirlo sin esa función. Está declarado como hueco a resolver.

Rollback de la configuración de Authentication (dominios autorizados, proveedores, registro): se revierte a mano en la consola; no está versionada. Antes de cambiar nada, anotar el valor actual en el PR o el issue.

### 2.5 Cloud Functions

Hechos verificados el 2026-10-01 por la sesión principal (esta sesión no pudo reconfirmarlos con `firebase functions:list`, que falla por permisos, véase 2.0; la verificación es `gcloud functions list --project pretso-database`):

- En `pretso-database` **sí hay una función desplegada**, `createReaderUser`, actualizada el 2026-07-29. Es una versión antigua, anterior a la migración al claim. La versión migrada del repositorio (`functions/src/index.ts`, que exige `admin: true`) **no se despliega**, porque `FIREBASE_DEPLOY_ONLY` vale `hosting,firestore:rules`.
- En `pretso-prod` no hay funciones (la API de Cloud Functions no está habilitada).

**Decisión pendiente: retirar o redesplegar.** El agente `seguridad` debe evaluar qué comprobación de privilegio hace la versión antigua desplegada (por ejemplo, si compara un correo fijo en lugar del claim) antes de decidir. Ambas opciones solo se ejecutan con autorización de Andres:

```bash
# Opción A: retirar la función antigua de staging
firebase functions:delete createReaderUser --project pretso-database

# Opción B: redesplegar la versión migrada (desde la raíz del repositorio)
firebase deploy --only functions:createReaderUser --project pretso-database --non-interactive
```

Mientras tanto, el hueco de `reader` (2.4) depende de esta decisión. Para otras funciones futuras: `git revert` del cambio de `functions/` + PR + `firebase deploy --only functions:<nombre>`; Firebase no ofrece rollback de versión de una función sin redesplegar, y el rollback automático del pipeline no las cubre. El workflow ya detecta fallos de Functions que `firebase deploy` informa con código 0.

### 2.6 Configuración e IAM

| Aspecto | Detalle |
|---|---|
| Qué se rompe | Despliegue que no autentica (WIF o secretos mal configurados), variables del repositorio erróneas (`GCP_PROJECT_ID_PROD`, `PROD_URL`), permisos de la cuenta de servicio de despliegue |
| Cómo se detecta | Falla el paso `google-github-actions/auth` o el despliegue; el job queda bloqueado esperando al Environment |
| Tiempo estimado | 10 a 30 minutos |
| Decide / ejecuta | Decide Andres; los cambios de IAM y de rulesets los hace Andres en consola (los clasificadores de seguridad bloquean escrituras de gobierno); Claude diagnostica con lecturas |

Reglas:

- Los workflows, `.devsecops.yml` y `firebase.json` están versionados: se revierten con `git revert` + PR, igual que las reglas.
- Los secretos (`GCP_WIF_PROVIDER`, `GCP_SA_DEPLOY_PROD` en el Environment `production`) no se versionan: se vuelven a configurar por nombre. Nunca se imprime su valor.
- **El acceso a la cuenta de producción está atado al Environment.** Desde el 2026-10-02 UTC (2026-10-01 en hora de Bolivia), `deploy-production@pretso-prod` solo acepta el principal `…:environment:production`: un job sin `environment: production` (por ejemplo, un rollback manual desde un workflow nuevo o desde una rama) **no obtiene credenciales** y falla en `google-github-actions/auth`. Además (capa 2, desde las 03:16 UTC del 2026-10-02), el provider de `pretso-prod` solo acepta tokens con `environment == production` **y** ref de tag `v*`: el acceso exige Environment y tag a la vez. No es un fallo a corregir ampliando el binding: el rollback de producción por pipeline corre en un job con el Environment (y su aprobación); fuera de él, lo ejecuta Claude con la sesión de `gcloud`/`firebase` de Andres y su autorización. Detalle y advertencia sobre `setup-oidc-gcp.sh` en [`inventario-secretos.md`](../seguridad/inventario-secretos.md), sección 4.1.
- **Reversión de la condición del provider** (si `desplegar-produccion` falla cerrado por la capa 2): restablecer en el provider de `pretso-prod` el valor anterior, `assertion.repository_owner == 'AndresAlberdi'`; lo hace Andres o Claude con su autorización, y se repite la prueba negativa. Nunca se amplía el binding de la cuenta.
- Ningún rollback relaja IAM, Firestore, CORS ni CSP para «hacer que funcione».
- Para detener un despliegue en curso: cancelar el run en GitHub Actions o rechazar la aprobación del Environment (la hace Andres).

## 3. Cuándo hacer rollback y cuándo corregir hacia adelante

| Situación | Decisión | Motivo |
|---|---|---|
| El sitio no carga o el inicio de sesión no funciona y la causa no es evidente | **Rollback de Hosting ya** | Cuesta un minuto; luego se investiga con calma |
| Falla el health check del pipeline | Rollback automático; verificar que ocurrió y revisar la causa | Es el comportamiento diseñado |
| Defecto visual o funcional menor, con corrección de pocas líneas y CI en verde | Corregir hacia adelante (`fix/*` + PR) | El rollback también tardaría un PR para dejar `main` coherente |
| Reglas que bloquean a usuarios legítimos | Primero asignar los claims faltantes (2.4); si no basta, revertir reglas (2.2) | Evita revertir una mejora de seguridad innecesariamente |
| Reglas demasiado abiertas | Corregir hacia adelante de inmediato, no restaurar un estado anterior más débil, y tratar como incidente (sección 5) | El estado anterior pudo ser peor |
| Datos borrados o corrompidos | Rollback de la aplicación si la causa es código **y** restauración PITR/respaldo (2.3), en base nueva | Revertir código no devuelve datos |
| Migración a medias | Detener la migración, no restaurar sobre la base viva; evaluar clon PITR | Evita mezclar estados |
| Cuenta con privilegio indebido | Quitar el claim y revocar tokens (2.4) de inmediato; si la ventana de 1 hora es inaceptable, denegar el uid con un cambio de reglas (2.2) | Quitar el claim no requiere despliegue, pero no invalida el ID token ya emitido |
| Duda sobre el alcance | Contención primero (rollback o quitar acceso), análisis después | Un rollback innecesario cuesta un despliegue; uno tardío cuesta usuarios |

Antes de revertir, anotar la hora, el tag o sha afectado, el síntoma y quién autorizó. Después, abrir un issue con etiqueta `incidente` (hoy se abre a mano).

## 4. RTO y RPO objetivo (OPS-07, confirmados por Andres el 2026-10-01)

Corresponden al perfil «SPA + Firestore con datos personales o transaccionales» de `06-rollback-e-incidentes.md` sección 6 (hay correos de usuarios). Ese perfil fija RTO 30 min y RPO 15 min, con exportación cada 6 h, y advierte que sin uptime check con alerta (OPS-01) ningún RTO inferior a una hora es realista. Los valores de abajo fueron **confirmados por Andres el 2026-10-01** como objetivos del proyecto; se vuelven a medir cuando haya más datos y tras cada ensayo, y se revisan si cambian. **Se desvían de forma explícita** del estándar en lo siguiente: el RPO confirmado es 1 h (no 15 min) por la falta de detección y de ensayo de restauración, no por la exportación (PITR da una ventana técnica de aproximadamente 1 minuto), y el RTO de 30 min no es realista mientras OPS-01 (uptime check) no exista, ya que la detección hoy depende de un usuario o de la revisión manual.

| Concepto | Objetivo | Cómo se cumple | Estado |
|---|---|---|---|
| RTO de la aplicación web | 30 min (desvío: sin OPS-01 el estándar no considera realista menos de 1 h; confirmado por Andres el 2026-10-01) | Rollback de Hosting en menos de 1 minuto más decisión y verificación; la detección no está automatizada | No medido |
| RTO de datos | 2 h (confirmado por Andres el 2026-10-01) | Clon PITR o restauración de respaldo a base nueva (2.3) | Medido el 2026-10-01 en staging: clon PITR y restauración de respaldo de una base de 563 documentos tardaron 12 a 14 min cada una (ensayos 6 y 7); el objetivo de 2 h sigue siendo razonable, pero con más datos hay que volver a medir. Copia entre proyectos medida el 2026-10-02 (563 documentos): exportación unos 1 min, importación unos 2 a 3 min, verificación más de 5 min (por el recuento de subcolecciones documento a documento); aproximados |
| RPO | 1 h como meta, confirmada por Andres el 2026-10-01 (desvío: el estándar fija 15 min; se fija 1 h por la falta de detección y de ensayo, no por la exportación); técnicamente hasta 1 minuto con PITR y 24 h con el respaldo diario | PITR (7 días) y respaldo diario (30 días) | Activado el 2026-09-30; restauración ensayada el 2026-10-01 (recuento idéntico al origen) |

## 5. Incidentes de seguridad

Se sigue la sección 5 del estándar (`06-rollback-e-incidentes.md`): clasificar S1 a S4, contener sin destruir evidencia, erradicar, recuperar y registrar lecciones. Plantilla de informe: sección 5.4 del estándar, en un issue con etiqueta `incidente`.

### 5.1 Secreto expuesto

Aplica a: clave de cuenta de servicio, secreto del Environment, token de GitHub, credencial de Google Drive o clave del cliente OAuth. La apiKey web de Firebase es pública por diseño y está restringida por referente y API; su exposición no es un incidente por sí sola.

1. No borrar «en silencio»: avisar a Andres y abrir el issue de incidente.
2. Contener, **revocar** antes de rotar. Cuenta de servicio: `gcloud iam service-accounts disable <correo-de-la-cuenta-de-servicio> --project "$PROYECTO"`, y eliminar sus claves si las hubiera (el despliegue usa WIF, sin claves de larga duración). Secreto de GitHub: reemplazarlo y borrar el anterior.
3. Revisar la actividad de la identidad en los registros de auditoría: `gcloud logging read 'protoPayload.authenticationInfo.principalEmail="<cuenta>" AND timestamp>="<fecha>"' --project "$PROYECTO" --limit 200 --format json`.
4. Rotar todo lo que esa identidad podía leer, no solo lo filtrado.
5. Si está en el historial de git, limpiar según `/home/andres-alberdi/SeguridadGeneral/01-seguridad/01-gestion-de-secretos.md` después de rotar; las excepciones de gitleaks de `.devsecops.yml` son revisiones con fecha de vencimiento, no autorización para ignorar.
6. Volver a habilitar con la credencial nueva y verificar con un despliegue a staging.

Tiempo: contención en menos de 1 hora (S1) y rotación completa el mismo día. Decide Andres; ejecuta Claude; el valor del secreto nunca se muestra en el chat.

### 5.2 Claim `admin` comprometido o asignado por error

1. Quitar el claim y revocar tokens: `python3 scripts/asignar_claim_admin.py --proyecto "$PROYECTO" --correo <cuenta> --quitar --aplicar`. Esto **no cierra** la ventana de hasta 1 hora del ID token ya emitido (véase 2.4); para contención inmediata, desplegar un cambio de reglas que deniegue el uid, o aceptar la ventana con decisión de Andres.
2. Deshabilitar la cuenta en Authentication si se sospecha de la persona o de su credencial.
3. Revisar en los registros de auditoría qué se modificó mientras tuvo el privilegio; si hay daño, sección 5.3. **La auditoría activa es solo `DATA_WRITE`: las lecturas y exportaciones hechas desde la aplicación no quedan registradas**, de modo que el alcance de una lectura indebida no se puede reconstruir con estos registros.
4. Confirmar que el registro por correo sigue desactivado (`disabledUserSignup`) y que no hay cuentas nuevas inesperadas.
5. Con el hecho confirmado de acceso a datos personales, valorar la comunicación a los usuarios afectados (normativa de Bolivia aplicable).

### 5.3 Borrado o alteración de datos

1. Contener: quitar el acceso del autor (2.4); no restaurar sobre la base afectada.
2. Preservar evidencia: exportar la base afectada a un bucket antes de tocarla, y conservar los registros de auditoría.
3. Restaurar en una base nueva con PITR o respaldo (2.3), comparar y reconciliar. La base nueva hereda la protección contra borrado; si es temporal, para borrarla se ejecuta primero `gcloud firestore databases update --database=<base> --no-delete-protection` (siempre con `--database`, porque sin ella actúa sobre `(default)`) y se reintenta el borrado mientras la API diga «in the middle of restore» (2.3).
4. Si hay indicios de acción maliciosa, clasificar como S1 y seguir la comunicación del estándar (sección 5.3 del estándar).

## 6. Contactos y canales (OPS-05)

Roles genéricos; los datos de contacto reales se mantienen fuera del repositorio, en un lugar que no dependa del sistema comprometible, y no se escriben aquí.

| Rol | Quién | Para qué |
|---|---|---|
| Propietario y autorizador | Andres | Autorizar rollbacks, restauraciones y rotaciones; aprobar el Environment |
| Operador técnico | Claude Code (sesión principal) | Ejecutar este runbook |
| Revisión de seguridad | Agentes `seguridad` y `revisor-codigo` | Informe de hallazgos y revisión del PR |
| Proveedor de nube | Soporte de Google Cloud / Firebase | Casos de plataforma; incidentes de facturación |
| Proveedor de dominio/DNS | No aplica hoy (se usa `*.web.app`) | Se completará si se enlaza un dominio propio |
| Canal de incidentes | Issue de GitHub con etiqueta `incidente` + el chat de la sesión | Registro y cronología |

Pendiente: un segundo contacto humano de respaldo (hoy todo recae en una persona).

## 7. Registro de ensayos (OPS-06)

Se llena al ejecutar cada ensayo de la sección 0, en staging, al menos cada 90 días. Desviación del estándar: el estándar pide el registro en `docs/produccion/pruebas/`; aquí vive en esta sección por ser un solo archivo con pocos ensayos. Si crece, se traslada a esa carpeta.

| Fecha | Ensayo (# de la sección 0) | Duración | Resultado | Observaciones |
|---|---|---|---|---|
| 2026-10-01 | 3: lecturas de Hosting por API REST | No medida | OK | Releases listadas (tipo DEPLOY) y canal `previa` leído con credenciales de `gcloud` y `x-goog-user-project`. `previa` expira el 2026-10-26 y su versión coincidía con la penúltima release: confirma el defecto del plazo no renovado (fila 2). Rollback NO probado |
| 2026-10-01 | 6: clon PITR | 12 a 14 min | OK | `gcloud firestore databases clone` con `--snapshot-time=2026-10-01T15:30:00Z` hacia `ensayo-pitr`: creada a las 15:43:07Z y respondía entre 15:55 y 16:07Z. Recuento por colección idéntico al origen (bibliografia 18, companias 19, corpus_christi 21, documentos 75, indicadores 56, logs 123, manejo_de_caja 69, salarios 44, transacciones 138; total 563). Mientras se restaura la API responde «Cannot serve requests when the database is undergoing a restore». La base clonada hereda la protección contra borrado: se quitó con `--no-delete-protection` (con `--database`) y se reintentó el borrado mientras la API decía «in the middle of restore». Una base nueva no recibe `firestore.rules`. `(default)` quedó intacta (563 documentos, PITR y protección activos) |
| 2026-10-01 | 7: restauración desde respaldo diario | Unos 14 min | OK | Respaldo con snapshot 2026-10-01T14:14:59Z restaurado en `ensayo-respaldo`: creada a las 15:53:41Z, lista hacia las 16:07Z. Recuento idéntico (563). Borrada con la misma secuencia que la anterior; ambas bases temporales se borraron |
| 2026-10-01 | 8: claim `admin` | No medida | OK | Con una cuenta temporal (creada y borrada para el ensayo): `--aplicar` asignó y verificó; `--quitar --aplicar` quitó, verificó y avanzó `tokensValidAfter` (revocación de tokens de renovación confirmada). El script se niega a asignar el claim a una cuenta deshabilitada (diseñado, código de salida 1). El ID token ya emitido sigue valiendo hasta 1 h (no ensayado, documentado) |
| 2026-10-01 | 9: cuenta de servicio | No medida | OK | Cuenta temporal: `disable` y `enable` correctos. `describe` justo tras habilitar llegó a mostrar `disabled: True` (retardo de propagación): hay que verificar con reintentos (repetido con espera, `disabled` vacío = habilitada). Cuenta borrada (la lista tarda en reflejarlo) |
| 2026-10-02 | 1: clon `previa` → `live` (rollback de Hosting) | Unos 48 s el job completo (05:17:34Z a 05:18:17Z) | OK | [Run 36968272567](https://github.com/AndresAlberdi/PRETSO/actions/runs/36968272567) de `probar-rollback-staging.yml` (`--ref main`, `confirmar=ROLLBACK-STAGING`, con el «sí» de Andres). Estado inicial: `live = d0623a`, `previa = 65ed6c` (vence 2026-11-01), HTTP 200. Rollback forzado: `live = previa (65ed6c)` y HTTP 200. Comprobación independiente posterior: `live` en d0623a y sitio en HTTP 200 antes y después. Reglas de Firestore y datos intactos. Aprendido: el PATCH del plazo de `previa` funciona en el servicio real (expira 30 días tras el último despliegue); `hosting:clone` dentro del mismo sitio no crea una versión nueva, solo un release con el mismo `version.name` |
| 2026-10-02 | 4: revertir a una versión concreta (`<sitio>@<versión>`) | Dentro del mismo job (unos 48 s) | OK | Mismo run: la restauración usó `hosting:clone <sitio>@<versión> <sitio>:live`: «live restaurado a la versión original (d0623a)» y HTTP 200. La variante `sites.releases.create` no se ensayó |
| 2026-10-02 | 10, parte B: rollback con el camino real de clonado en staging | Unos 48 s | OK | Mismo run; mensaje final «OK: rollback ensayado y versión original restaurada». No es el rollback automático de `desplegar-produccion` en producción (NO PROBADO hasta el primer despliegue). La parte A (lógica, sin red) corre en CI y no se registra aquí |
| 2026-10-02 | 5: rollback de reglas de Firestore con `git revert` + PR + despliegue | Unos 10 min de punta a punta (05:24:37Z a 05:38:26Z) | OK | Con el «sí» de Andres («autorizo el ensayo 5»), que cubrió los dos PR (aprobados por `segurolotengopy`). Base: ruleset publicado en `pretso-database` con huella SHA-256(16) `313b2ee1ee9c2c1b`, idéntica a `firestore.rules`. Ida: [#67](https://github.com/AndresAlberdi/PRETSO/pull/67) (`test(reglas): cambio inocuo…`, +2 líneas de comentario, ninguna regla cambió; CI con 87 pruebas de reglas y 48 de la app en verde, Java 21), fusionado a las 05:27:35Z (commit `dec2fb8`); reglas publicadas a las 05:30:28Z (unos 3 min; run de `main` en verde con humo y ZAP): huella `7aa9bd851b84d12d`, con el comentario del ensayo, sitio HTTP 200. Vuelta: `git revert` de `dec2fb8` como [#68](https://github.com/AndresAlberdi/PRETSO/pull/68) (commit `f8cd703`), CI verde, fusionado a las 05:35:57Z; reglas publicadas a las 05:38:26Z (unos 2,5 min): huella `313b2ee1ee9c2c1b` = base, comentario ausente, HTTP 200, humo y ZAP en verde; el archivo tras el revert también `313b2ee1ee9c2c1b`. Aprendido: el despliegue de reglas tarda unos 2,5 a 3 min tras fusionar; un `git revert` deja el archivo idéntico (misma huella) y el ruleset publicado vuelve a ser idéntico en contenido; correr las pruebas de reglas en un worktree sin `npm ci` falla por dependencias (no es un fallo de reglas): la prueba válida es el CI. No se probó el rollback de reglas en `pretso-prod` |

Con el ensayo 5, todos los ensayos de la sección 0 están ejecutados en staging y OPS-06 queda en **Verde** (vigencia: 90 días, hasta 2026-12-31 para los del 2026-10-02 y 2026-12-30 para los del 2026-10-01). Siguen **NO PROBADOS**, hasta el primer despliegue: el rollback de producción, el rollback automático real en producción y el rollback de reglas en `pretso-prod` (las reglas llegan allí solo con un tag). La parte A del ensayo 10 (prueba automática de la lógica, sin red) corre en el job `calidad` y no se registra en esta tabla.
