# Runbook de rollback e incidentes — PRETSO

Control OPS-04 del checklist de pase a producción (`/home/andres-alberdi/SeguridadGeneral/01-seguridad/05-checklist-pase-a-produccion.md`), adaptado de `06-rollback-e-incidentes.md` del estándar. Cubre también OPS-05 (contactos) y OPS-07 (RTO/RPO) en su versión inicial.

Alcance: aplicación web (React + Vite) en Firebase Hosting, reglas y datos de Firestore, Firebase Authentication, Cloud Functions (hoy no desplegadas) y configuración/IAM de dos proyectos:

| Proyecto | Papel | URL |
|---|---|---|
| `pretso-database` | Staging; hoy también el sitio en uso | `https://pretso-database.web.app` |
| `pretso-prod` | Producción (Environment `production` con revisor) | `https://pretso-prod.web.app` |

Este runbook lo mantiene el líder técnico del proyecto. Un rollback que no se ensayó no es un plan: la primera tabla dice con honestidad qué se validó y qué no.

## 0. Qué se probó y qué no

Fecha de redacción: 2026-10-01. «Validado» significa que el comando existe en la herramienta instalada (`firebase` 15.27.0, `gcloud` local; el pipeline fija `firebase-tools` 15.28.1) y que su sintaxis se comprobó con `--help`. **Ningún comando de este runbook se ha ejecutado contra un proyecto real con fines de rollback.** «NO PROBADO» significa que no se ejecutó ni se pudo validar por completo.

| # | Procedimiento | Estado | Observación | Ensayo propuesto en staging (no ejecutado) |
|---|---|---|---|---|
| 1 | `firebase hosting:clone <sitio>:previa <sitio>:live` (rollback de Hosting) | Sintaxis validada; **NO PROBADO** como rollback | El mismo comando lo ejecuta el job `post-despliegue` si falla el health check, pero ese camino nunca se ha disparado | En `pretso-database`: guardar `live` en `previa`, publicar una versión marcada con un cambio visible, clonar `previa` sobre `live`, comprobar que el cambio desaparece y medir el tiempo |
| 2 | Crear y clonar el canal `previa` antes del deploy | Validado en CI: lo hacen los jobs `desplegar-staging` y `desplegar-produccion` (se ven en cada despliegue de staging) | En producción aún no ha corrido ningún despliegue | Revisar en un despliegue de staging real que `firebase hosting:channel:list --site pretso-database --project pretso-database` muestre `previa` actualizado |
| 3 | Listar versiones y releases de Hosting con la API REST | **NO PROBADO** | `firebase hosting:versions:list` y `hosting:releases:list` **no existen** en `firebase` 15.27.0 (el documento del estándar los menciona); se usa la API REST | Ejecutar las dos consultas de lectura de la sección 2.1 contra `pretso-database` y confirmar que devuelven datos |
| 4 | Revertir a una versión concreta con `sites.releases.create` | **NO PROBADO** | Es el recurso para cuando `previa` no sirve (por ejemplo, tras dos despliegues seguidos) | Crear una release que apunte a una versión anterior en `pretso-database` y verificar |
| 5 | Rollback de reglas de Firestore con `git revert` + PR + despliegue | Procedimiento de git y `firebase deploy --only firestore:rules` conocido; **NO PROBADO** como rollback | El rollback automático solo revierte Hosting | Revertir en una rama un cambio trivial de reglas, fusionarlo, comprobar que staging despliega las reglas anteriores y correr `npm run test:rules` |
| 6 | Restauración de Firestore a un punto en el tiempo (`gcloud firestore databases clone --snapshot-time`) | Sintaxis validada con `--help`; **NO PROBADO** | Crea una base nueva; hay que reconciliar y, si se decide, apuntar la aplicación a ella | Clonar `(default)` de `pretso-database` a una base `ensayo-pitr`, contar documentos por colección frente a la original, borrar la base de ensayo; medir duración |
| 7 | Restauración desde respaldo diario (`gcloud firestore databases restore --source-backup`) | Sintaxis validada con `--help`; **NO PROBADO** | Los respaldos están activos desde el 2026-09-30 (retención 30 días, según `ESTADO.md`) | Ídem 6 usando el respaldo más reciente de staging y una base `ensayo-respaldo` |
| 8 | Quitar el claim `admin` con `asignar_claim_admin.py --quitar --aplicar` | Sintaxis leída en el código y probada por pruebas unitarias del script; **NO PROBADO** contra un proyecto en este runbook (el script no corrió aquí: falta `firebase_admin` en este entorno) | `--quitar` ya revoca los tokens de refresco (`revoke_refresh_tokens`) | Sin `--aplicar` en `pretso-database` (solo lectura) y luego con `--aplicar` sobre una cuenta de prueba, verificando la sesión caída |
| 9 | Deshabilitar una cuenta de servicio (`gcloud iam service-accounts disable`) | Sintaxis validada con `--help`; **NO PROBADO** | Es contención de incidente, no se ensaya en producción | Deshabilitar y volver a habilitar una cuenta de servicio de prueba en staging |
| 10 | Rollback automático de `post-despliegue` (health check falla y clona `previa`) | **NO PROBADO** | Nunca se ha disparado | Provocar un fallo del health check en staging (ruta de salud inexistente con una variable de prueba) o simularlo localmente con `act`; no tocar producción |
| 11 | Rollback completo de **producción** | **NO PROBADO** | Producción no tiene aún ningún despliegue | Ver el criterio OPS-06: el ensayo se hace en staging con el mismo procedimiento; el primer rollback real en producción se hace con el equipo avisado |
| 12 | Cloud Functions | No aplica hoy | No hay Functions desplegadas (`FIREBASE_DEPLOY_ONLY` por defecto es `hosting,firestore:rules`) | Cuando se desplieguen, ensayar la sección 2.5 en staging |

OPS-06 (prueba de rollback en staging en los últimos 90 días) **sigue pendiente**: hay que ejecutar los ensayos 1, 3, 5, 6 y 7 y registrar fecha, duración y resultado en una tabla al final de este archivo (sección 7).

## 1. Quién decide, quién ejecuta

| Rol | Persona o agente | Qué hace |
|---|---|---|
| Autoriza | Andres (propietario) | Decide el rollback, la restauración y cualquier acción sobre producción; aprueba el Environment `production`; es el único con acceso a la consola de facturación |
| Opera | Claude Code (sesión principal, con el agente `deploy` para staging) | Ejecuta los comandos de este runbook tras la autorización de Andres en el chat e informa el resultado real |
| Revisa | `revisor-codigo`, `seguridad` | Revisan el PR de un `git revert` y los incidentes con implicación de seguridad |
| Aprobador del Environment `production` | Andres | Aprueba el despliegue; no existe segundo revisor independiente (desviación documentada en `PILOTO.md`) |

Reglas fijas: Claude no ejecuta nada que escriba en `pretso-prod` sin la autorización explícita de Andres en esa conversación; no usa `deploy.sh prod` ni `--forzar`; no crea tags. Las acciones de consola que exija el sistema (aprobar el Environment, ver la facturación) las hace Andres con el enlace exacto que Claude le entrega.

## 2. Rollback por componente

Variables usadas en los comandos (se definen en la sesión; no contienen secretos):

```bash
PROYECTO=pretso-prod        # o pretso-database para staging
SITIO=$PROYECTO             # el ID del sitio coincide con el proyecto
```

### 2.1 Firebase Hosting (aplicación web)

| Aspecto | Detalle |
|---|---|
| Qué se rompe | La SPA publicada no carga, muestra pantalla en blanco, falla el inicio de sesión o una pantalla clave; cabeceras CSP que bloquean recursos (`firebase.json`) |
| Cómo se detecta | Falla el job `post-despliegue` (10 intentos cada 15 s sobre `PROD_URL`, ruta `/healthz` con caída a `/` si responde 404); reporte de un usuario; revisión visual tras cada despliegue |
| Tiempo estimado | Menos de 1 minuto (el CDN cambia la versión de forma atómica) |
| Decide / ejecuta | Decide Andres; ejecuta Claude. El rollback automático del pipeline no requiere decisión |

El pipeline, antes de cada despliegue, crea el canal `previa` (30 días) y clona a él lo que está en `live`. El rollback es clonar de vuelta. Comandos:

```bash
# 1. Comprobar que el canal de respaldo existe y es reciente
firebase hosting:channel:list --site "$SITIO" --project "$PROYECTO"

# 2. ROLLBACK: restaurar a live lo que había antes del despliegue
firebase hosting:clone "$SITIO:previa" "$SITIO:live" --project "$PROYECTO"

# 3. Verificar
curl -sS -o /dev/null -w '%{http_code}\n' -L "https://$SITIO.web.app/"
```

Si el canal `previa` no sirve (hubo dos despliegues seguidos y ya contiene la versión mala), se elige una versión anterior. En `firebase` 15.27.0 no existen `hosting:versions:list` ni `hosting:releases:list`; se usa la API REST (NO PROBADO):

```bash
TOKEN=$(gcloud auth print-access-token)
# Releases recientes del sitio (cada una trae su versión y su mensaje)
curl -sS -H "Authorization: Bearer $TOKEN" \
  "https://firebasehosting.googleapis.com/v1beta1/sites/$SITIO/releases?pageSize=10"
# Publicar de nuevo una versión concreta (VERSION = nombre completo tomado de la lista anterior)
curl -sS -X POST -H "Authorization: Bearer $TOKEN" \
  "https://firebasehosting.googleapis.com/v1beta1/sites/$SITIO/releases?versionName=$VERSION"
```

Alternativa por consola de Firebase: Hosting, «Release history», menú de la versión anterior, «Rollback» (la hace Andres si Claude no tiene acceso). Cada despliegue lleva el mensaje `producción <tag> (run <id>)` o `staging <sha> (run <id>)`, que permite identificar la versión.

Límite: Hosting no revierte reglas ni datos (secciones 2.2 y 2.3).

### 2.2 Reglas de Firestore

| Aspecto | Detalle |
|---|---|
| Qué se rompe | Lecturas o escrituras denegadas a usuarios legítimos (por ejemplo, claim `admin` ausente tras endurecer las reglas), o reglas demasiado abiertas |
| Cómo se detecta | Errores `permission-denied` en la consola del navegador o en los registros de Firestore; reporte de usuarios; `npm run test:rules` en CI antes del despliegue |
| Tiempo estimado | 15 a 30 minutos (rama, PR, revisión, despliegue); las reglas toman efecto en segundos tras el despliegue |
| Decide / ejecuta | Decide Andres; ejecuta Claude con el agente `devsecops` o `implementador` y revisión de `seguridad` |

El rollback automático **solo revierte Hosting**: las reglas se despliegan en el mismo paso (`hosting,firestore:rules`) pero no se restauran. Procedimiento normal, por la rama protegida (no se hace push directo a `main`):

```bash
git switch -c fix/revertir-reglas-<fecha> origin/main
git revert --no-edit <sha-del-commit-que-cambio-las-reglas>   # el commit de squash en main
npm test && npm run lint
firebase emulators:exec --only firestore "npm run test:rules"
# PR hacia main (plantilla .github/PULL_REQUEST_TEMPLATE.md); al fusionar, staging se despliega solo.
```

Emergencia con producción rota y sin tiempo para el PR: reponer solo las reglas del tag anterior y desplegarlas a mano, con autorización explícita de Andres, y regularizar con el PR después.

```bash
git diff vX.Y.(Z-1) -- firestore.rules   # revisar qué se repone antes de desplegar
git checkout vX.Y.(Z-1) -- firestore.rules
firebase deploy --only firestore:rules --project pretso-prod --non-interactive --message "rollback de reglas a vX.Y.(Z-1)"
```

Nota de diseño: las reglas actuales exigen el claim `admin` o `reader` (lectura) y `admin` (escritura de `logs` y `users`). Antes de desplegar reglas con claims hay que asignarlos (sección 2.4); no asignarlos es la causa previsible más probable de un rollback de reglas.

### 2.3 Datos de Firestore (PITR y respaldo diario)

| Aspecto | Detalle |
|---|---|
| Qué se rompe | Documentos borrados o corrompidos por un defecto de código, una migración (`scripts/migrate_ods.py`) o un error humano |
| Cómo se detecta | Contadores de corpus distintos de lo esperado, reporte de usuarios, registros de auditoría de escrituras de Firestore (GCP-06), exportación que no coincide |
| Tiempo estimado | 30 a 120 minutos, según el tamaño de la base (NO PROBADO: depende del volumen) |
| Decide / ejecuta | Decide Andres (implica reconciliar datos y cambiar a una base nueva); ejecuta Claude |

Protecciones activas desde el 2026-09-30 en ambos proyectos: PITR con ventana de 7 días, protección contra borrado y respaldo diario con retención de 30 días.

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
3. Cambiar la aplicación a la base nueva solo con autorización de Andres: la aplicación usa la base `(default)`, de modo que implicaría un cambio de código y de despliegue, o bien exportar `$BASE_NUEVA` e importarla en `(default)` con `gcloud firestore export` e `import`. Esta decisión no está resuelta y se debe diseñar y ensayar antes de necesitarla (ensayo 6 y 7).
4. Dejar la base nueva sin borrar hasta cerrar el incidente.

Una pérdida acotada en datos de lectura (el corpus) también se puede recomponer con la exportación de la pantalla «Administración» (XML, XLSX, copia a Drive) y `scripts/migrate_ods.py`; es un segundo respaldo, no sustituye a PITR.

### 2.4 Authentication y claims

| Aspecto | Detalle |
|---|---|
| Qué se rompe | Un administrador pierde el acceso (claim ausente), una cuenta tiene privilegio indebido, el registro se reabre, o un proveedor/dominio autorizado queda mal configurado |
| Cómo se detecta | El usuario ve «sin permiso» pese a tener cuenta; lectura del claim con el script en modo solo lectura; revisión de la configuración de Authentication (`disabledUserSignup` debe seguir activo) |
| Tiempo estimado | Menos de 5 minutos por cuenta |
| Decide / ejecuta | Decide Andres; ejecuta Claude con credenciales de usuario (`gcloud auth application-default login`); el script nunca imprime identificadores ni tokens |

```bash
# Ver el cambio previsto (solo lectura)
python3 scripts/asignar_claim_admin.py --proyecto "$PROYECTO" --correo <cuenta>

# Asignar el claim (restaura el acceso de un administrador)
python3 scripts/asignar_claim_admin.py --proyecto "$PROYECTO" --correo <cuenta> --aplicar

# QUITAR el claim (cuenta comprometida o privilegio indebido): también revoca los tokens de refresco
python3 scripts/asignar_claim_admin.py --proyecto "$PROYECTO" --correo <cuenta> --quitar --aplicar
```

El script ya llama a `revoke_refresh_tokens` al quitar el claim, y verifica el resultado releyéndolo. Un token de acceso ya emitido sigue siendo válido hasta una hora (límite de Firebase), de modo que para una cuenta comprometida se deshabilita además la cuenta en la consola de Authentication (acción de Andres o de Claude con su autorización). Los códigos de salida del script son 0 (bien), 1 (error o verificación distinta) y 2 (la cuenta no existe).

Rollback de la configuración de Authentication (dominios autorizados, proveedores, registro): se revierte a mano en la consola; no está versionada. Antes de cambiar nada, anotar el valor actual en el PR o el issue.

### 2.5 Cloud Functions

Hoy **no hay Functions desplegadas**: el despliegue por defecto es `hosting,firestore:rules` (variable `FIREBASE_DEPLOY_ONLY`), y el repositorio tiene `functions/src/index.ts` sin ruta de despliegue activa en producción. No hay nada que revertir.

Cuando se desplieguen, el procedimiento será: `git revert` del cambio de `functions/` + PR + despliegue con `firebase deploy --only functions:<nombre>`; Firebase no ofrece rollback de versión de una función sin redesplegar, y el rollback automático del pipeline no las cubre. Además hay que añadir el ensayo correspondiente a la sección 0. El workflow ya detecta fallos de Functions que `firebase deploy` informa con código 0.

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
| Cuenta con privilegio indebido | Quitar el claim y revocar tokens (2.4) de inmediato | No requiere despliegue |
| Duda sobre el alcance | Contención primero (rollback o quitar acceso), análisis después | Un rollback innecesario cuesta un despliegue; uno tardío cuesta usuarios |

Antes de revertir, anotar la hora, el tag o sha afectado, el síntoma y quién autorizó. Después, abrir un issue con etiqueta `incidente` (hoy se abre a mano).

## 4. RTO y RPO objetivo (OPS-07, valores iniciales)

Corresponden al perfil «SPA en Firebase Hosting + Firestore» del estándar (con datos personales: correos de usuarios). Son objetivos propuestos para que Andres los confirme; no se han medido.

| Concepto | Objetivo | Cómo se cumple | Estado |
|---|---|---|---|
| RTO de la aplicación web | 30 min | Rollback de Hosting en menos de 1 minuto más decisión y verificación | No medido |
| RTO de datos | 2 h | Clon PITR o restauración de respaldo a base nueva (2.3) | NO PROBADO; ensayos 6 y 7 |
| RPO | 1 h como meta; técnicamente hasta 1 minuto con PITR y 24 h con el respaldo diario | PITR (7 días) y respaldo diario (30 días) | Activado el 2026-09-30; sin restauración ensayada |

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

1. Quitar el claim y revocar tokens: `python3 scripts/asignar_claim_admin.py --proyecto "$PROYECTO" --correo <cuenta> --quitar --aplicar`.
2. Deshabilitar la cuenta en Authentication si se sospecha de la persona o de su credencial.
3. Revisar en los registros de auditoría de escrituras de Firestore qué se modificó o exportó mientras tuvo el privilegio; si hay daño, sección 5.3.
4. Confirmar que el registro por correo sigue desactivado (`disabledUserSignup`) y que no hay cuentas nuevas inesperadas.
5. Con el hecho confirmado de acceso a datos personales, valorar la comunicación a los usuarios afectados (normativa de Bolivia aplicable).

### 5.3 Borrado o alteración de datos

1. Contener: quitar el acceso del autor (2.4); no restaurar sobre la base afectada.
2. Preservar evidencia: exportar la base afectada a un bucket antes de tocarla, y conservar los registros de auditoría.
3. Restaurar en una base nueva con PITR o respaldo (2.3), comparar y reconciliar.
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

Se llena al ejecutar cada ensayo de la sección 0, en staging, al menos cada 90 días.

| Fecha | Ensayo (# de la sección 0) | Duración | Resultado | Observaciones |
|---|---|---|---|---|
| — | — | — | — | Ninguno ejecutado a 2026-10-01 |
