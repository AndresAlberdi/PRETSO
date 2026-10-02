# Runbook de rollback e incidentes — PRETSO

Control OPS-04 del checklist de pase a producción (`/home/andres-alberdi/SeguridadGeneral/01-seguridad/05-checklist-pase-a-produccion.md`), adaptado de `06-rollback-e-incidentes.md` del estándar. Cubre también OPS-05 (contactos) y OPS-07 (RTO/RPO, sección 4, confirmados por Andres el 2026-10-01).

Alcance: aplicación web (React + Vite) en Firebase Hosting, reglas y datos de Firestore, Firebase Authentication, Cloud Functions (hoy hay una función antigua desplegada en `pretso-database`, véase 2.5) y configuración/IAM de dos proyectos:

| Proyecto | Papel | URL |
|---|---|---|
| `pretso-database` | Staging; hoy también el sitio en uso | `https://pretso-database.web.app` |
| `pretso-prod` | Producción (Environment `production` con revisor) | `https://pretso-prod.web.app` |

Este runbook lo mantiene el líder técnico del proyecto. Identidad con la que se ejecuta cada comando: véase la sección 2.0. Un rollback que no se ensayó no es un plan: la primera tabla dice con honestidad qué se validó y qué no.

## 0. Qué se probó y qué no

Fecha de redacción: 2026-10-01. «Validado» significa que el comando existe en la herramienta instalada (`firebase` 15.27.0, `gcloud` local; el pipeline fija `firebase-tools` 15.28.1) y que su sintaxis se comprobó con `--help`. **Solo los ensayos 3, 6, 7, 8 y 9 se ejecutaron contra `pretso-database` (staging) el 2026-10-01; el resto de los comandos no se ha ejecutado con fines de rollback.** «NO PROBADO» significa que no se ejecutó ni se pudo validar por completo.

| # | Procedimiento | Estado | Observación | Ensayo propuesto en staging (no ejecutado) |
|---|---|---|---|---|
| 1 | `firebase hosting:clone <sitio>:previa <sitio>:live` (rollback de Hosting) | Sintaxis validada; **NO PROBADO** como rollback | El mismo comando lo ejecuta el paso de rollback al final del job `desplegar-produccion` si falla el health check, pero ese camino nunca se ha disparado. Revierte solo Hosting. `previa` puede estar caducado o desactualizado (véase 2.1) | En `pretso-database`: guardar `live` en `previa`, publicar una versión marcada con un cambio visible, clonar `previa` sobre `live`, comprobar que el cambio desaparece y medir el tiempo |
| 2 | Crear y clonar el canal `previa` antes del deploy | El clon corre en cada despliegue y, con la plantilla 2.9, el plazo de `previa` se renueva a 30 días con un PATCH REST (`updateMask=ttl`) que **no se ha verificado contra el servicio real**: hay que mirar el `::warning::` en el primer despliegue; no se puede dar por validado | En staging `previa` expira el 2026-10-26 aunque se clonó el 2026-10-01 (estado previo a la plantilla 2.9, que renueva el plazo en cada despliegue). **El primer despliegue a producción no tiene versión anterior a la que volver**: el canal `live` de `pretso-prod` no tiene release, así que `hosting:clone live previa` fallará; con la plantilla 2.9 el paso emite un aviso (`::notice::`/`::warning::`) y el job sigue (el paso mantiene `continue-on-error: true`). Tras cada despliegue hay que verificar la versión de `previa` (2.1) | Comprobar `expireTime` y la versión del release de `previa` (2.1) tras un despliegue de staging real; en producción, verificarla tras el primer despliegue |
| 3 | Listar versiones y releases de Hosting con la API REST | **Ensayado el 2026-10-01 (staging)**: lecturas por API REST correctas (releases tipo DEPLOY y canal `previa`); rollback **NO PROBADO**. Detalle en la [sección 7](#7-registro-de-ensayos-ops-06) | `firebase hosting:versions:list` y `hosting:releases:list` **no existen** en `firebase` 15.27.0 (el documento del estándar los menciona); se usa la API REST | Ejecutar las dos consultas de lectura de la sección 2.1 contra `pretso-database` y confirmar que devuelven datos |
| 4 | Revertir a una versión concreta con `sites.releases.create` | **NO PROBADO** | Es el recurso para cuando `previa` no sirve (por ejemplo, tras dos despliegues seguidos) | Crear una release que apunte a una versión anterior en `pretso-database` y verificar |
| 5 | Rollback de reglas de Firestore con `git revert` + PR + despliegue | Procedimiento de git y `firebase deploy --only firestore:rules` conocido; **NO PROBADO** como rollback | El rollback automático solo revierte Hosting | Revertir en una rama un cambio trivial de reglas, fusionarlo, comprobar que staging despliega las reglas anteriores y correr `npm run test:rules` |
| 6 | Restauración de Firestore a un punto en el tiempo (`gcloud firestore databases clone --snapshot-time`) | **Ensayado el 2026-10-01 (staging)**: clon PITR de una base de 563 documentos, 12 a 14 min, recuento idéntico al origen. Detalle en la [sección 7](#7-registro-de-ensayos-ops-06) | Crea una base nueva; la base clonada hereda la protección contra borrado (2.3); hay que reconciliar y, si se decide, apuntar la aplicación a ella | Clonar `(default)` de `pretso-database` a una base `ensayo-pitr`, contar documentos por colección frente a la original, borrar la base de ensayo; medir duración |
| 7 | Restauración desde respaldo diario (`gcloud firestore databases restore --source-backup`) | **Ensayado el 2026-10-01 (staging)**: restauración desde el respaldo diario, unos 14 min, recuento idéntico (563). Detalle en la [sección 7](#7-registro-de-ensayos-ops-06) | Los respaldos están activos desde el 2026-09-30 (retención 30 días, según `ESTADO.md`) | Ídem 6 usando el respaldo más reciente de staging y una base `ensayo-respaldo` |
| 8 | Quitar el claim `admin` con `asignar_claim_admin.py --quitar --aplicar` | **Ensayado el 2026-10-01 (staging)** con una cuenta temporal: asignar y quitar el claim verificados, revocación de tokens de renovación confirmada; el script se niega a asignar el claim a una cuenta deshabilitada. Detalle en la [sección 7](#7-registro-de-ensayos-ops-06) | `--quitar` ya revoca los tokens de refresco (`revoke_refresh_tokens`) | Sin `--aplicar` en `pretso-database` (solo lectura) y luego con `--aplicar` sobre una cuenta de prueba, verificando la sesión caída |
| 9 | Deshabilitar una cuenta de servicio (`gcloud iam service-accounts disable`) | **Ensayado el 2026-10-01 (staging)** con una cuenta temporal: `disable` y `enable` correctos; la lectura inmediata puede mostrar un estado atrasado. Detalle en la [sección 7](#7-registro-de-ensayos-ops-06) | Es contención de incidente, no se ensaya en producción | Deshabilitar y volver a habilitar una cuenta de servicio de prueba en staging |
| 10 | Rollback automático dentro de `desplegar-produccion` (health check falla y clona `previa` sobre `live`) | **NO PROBADO** | Nunca se ha disparado | Reescrito: el health check y el rollback automático son los pasos finales del job `desplegar-produccion` (aprobado y autenticado); ya no hay un job `post-despliegue` con credenciales de nube (ese job solo registra el Deployment). Antes de la plantilla 2.9 el rollback no podía funcionar: `post-despliegue` se autenticaba con secretos del Environment `production` sin declarar Environment y llegaban vacíos. El rollback automático revierte **solo Hosting**. Staging no tiene ese job, de modo que **no se puede ensayar tal como está**. El ensayo 10 debe apuntar al paso de rollback dentro de `desplegar-produccion` y **sigue NO PROBADO**. Propuesta: un workflow de prueba (en una rama, con `workflow_dispatch`) que copie los pasos de health check y rollback de `desplegar-produccion` contra el sitio de staging y apunte la verificación a una URL propia del ensayo que devuelva 500, sin tocar producción y sin cambiar la variable `PROD_URL`. Requiere autorización de Andres y no se ha construido |
| 11 | Rollback completo de **producción** | **NO PROBADO** | Producción no tiene aún ningún despliegue, y el primer despliegue **no tiene versión anterior a la que volver** (el canal `live` no tiene release; véase la fila 2): hasta que exista un segundo despliegue, el rollback de Hosting en producción no es posible con `previa` y habría que publicar una versión conocida con `sites.releases.create` | Ver el criterio OPS-06: el ensayo se hace en staging con el mismo procedimiento; el primer rollback real en producción se hace con el equipo avisado |
| 12 | Cloud Functions | **Hay una función antigua desplegada en `pretso-database`** (`createReaderUser`); en `pretso-prod` no hay | La versión desplegada es anterior a la migración al claim; el pipeline no la actualiza (`FIREBASE_DEPLOY_ONLY=hosting,firestore:rules`). Decisión pendiente: retirar o redesplegar (2.5) | Tras la decisión, ensayar en staging el procedimiento elegido |

OPS-06 (prueba de rollback en staging en los últimos 90 días) **sigue en Rojo**: los ensayos 3, 6, 7, 8 y 9 se hicieron el 2026-10-01 y **faltan el 1 y el 4 (rollback de Hosting en staging, que exigen autorización aparte por tocar el sitio en uso), el 5 (rollback de reglas con `git revert`) y el 10 (rollback automático simulado)**. Se registran fecha, duración y resultado en una tabla al final de este archivo (sección 7). El seguimiento de los ensayos corresponde a OPS-06, no a OPS-04.

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

Alternativa por consola de Firebase: Hosting, «Release history», menú de la versión anterior, «Rollback» (la hace Andres si Claude no tiene acceso). Cada despliegue lleva el mensaje `producción <tag> (run <id>)` o `staging <sha> (run <id>)`, que permite identificar la versión.

Límite: Hosting no revierte reglas ni datos (secciones 2.2 y 2.3).

### 2.2 Reglas de Firestore

| Aspecto | Detalle |
|---|---|
| Qué se rompe | Lecturas o escrituras denegadas a usuarios legítimos (por ejemplo, claim `admin` ausente tras endurecer las reglas), o reglas demasiado abiertas |
| Cómo se detecta | Errores `permission-denied` en la consola del navegador o en los registros de Firestore; reporte de usuarios; `npm run test:rules` en CI antes del despliegue |
| Tiempo estimado | Unos 10 minutos de CI por ejecución más la aprobación del Environment para producción; un PR con revisión suma más. Las reglas toman efecto en segundos tras el despliegue |
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
| RTO de datos | 2 h (confirmado por Andres el 2026-10-01) | Clon PITR o restauración de respaldo a base nueva (2.3) | Medido el 2026-10-01 en staging: clon PITR y restauración de respaldo de una base de 563 documentos tardaron 12 a 14 min cada una (ensayos 6 y 7); el objetivo de 2 h sigue siendo razonable, pero con más datos hay que volver a medir |
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

Pendientes (OPS-06 sigue en **Rojo**): ensayos 1 y 4 (rollback de Hosting en staging; requieren autorización aparte de Andres por tocar el sitio en uso), 5 (rollback de reglas con `git revert`) y 10 (rollback automático simulado).
