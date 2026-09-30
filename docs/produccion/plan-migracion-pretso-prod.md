# Plan de migración a `pretso-prod` (Bloque 5)

> **Es un plan escrito. No se ejecutó nada**: ninguna lectura de datos reales, ninguna exportación de usuarios, ningún cambio en GCP ni en GitHub. Cada paso que escriba en un proyecto de GCP o en GitHub se ejecuta solo con el «sí» de Andres en el chat.
>
> Redactado el 2026-09-29. Marco: `Prompts/cerrar-estandar-y-pase-a-produccion.md` (Bloque 5) y el checklist `01-seguridad/05-checklist-pase-a-produccion.md` del estándar. Los identificadores de control (REP-, DAT-, NUB-…) son los de ese checklist.

## 0. Decisión previa: ¿hace falta este plan?

Andres confirmó el 2026-09-30 el **camino B**: hace falta un entorno de producción separado, y el destino es el `pretso-prod` existente. Este plan se ejecuta paso a paso, cada cambio de GCP o de GitHub con su «sí». **No se crea ningún tag `v*`** hasta completar los pasos 1 a 7.

## 1. Punto de partida (medido)

| Qué | Estado | Cómo se sabe |
|---|---|---|
| `pretso-database` | Sirve el sitio y contiene el corpus real. Hoy es a la vez «staging» y producción de hecho | Es el destino de `desplegar-staging` y lo que ven los usuarios |
| `pretso-prod` | Existe, con Firebase, Firestore (`nam5`, misma región) y sitio de Hosting `pretso-prod`; **vacío**: sin datos ni usuarios | Bloque 5, hecho el 2026-09-25 |
| Federación WIF y Environment `production` | Creados; revisor obligatorio (AndresAlberdi), despliegue solo desde tags `v*`; secretos `GCP_SA_DEPLOY_PROD` y `GCP_WIF_PROVIDER` en el Environment | `gh secret list --env production` |
| Respaldo y protección | `pretso-database`: **activados el 2026-09-30** (PITR, protección contra borrado, respaldo diario de 30 días). `pretso-prod`: **desactivados** | `gcloud firestore databases describe` y `backups schedules list` |

### Hallazgo que condiciona todo: la configuración de Firebase está escrita fija en el código

`src/firebase.ts` fija `projectId`, `authDomain`, `storageBucket` y `apiKey` de `pretso-database`; `src/utils/googleClientId.ts` fija el cliente OAuth de la copia a Drive; la aplicación **no lee ninguna variable de entorno** (`import.meta.env` no aparece en `src/`). El workflow construye con `--mode production`, pero ese modo no cambia nada de esa configuración.

**Consecuencia:** un tag `vX.Y.Z` desplegaría en `pretso-prod` un sitio cuya aplicación lee y escribe en `pretso-database`. El paso 1 no se puede saltar.

## 2. Pasos

Cada paso indica quién lo hace, costo, prueba y cómo se revierte. «Claude opera» siempre con el «sí» de Andres en el chat.

### Paso 1 — Configuración por ambiente en el código (PR de código, riesgo medio)
**Hecho en el PR de la rama `feat/config-por-ambiente`** (ver ese PR para el resultado medido). Se aparta del texto original de este plan en un punto, y conviene que Andres lo sepa: en vez de variables de Vite inyectadas por el workflow, la configuración vive en **archivos versionados por ambiente** (`src/environments/staging/` y `production/`), elegidos en tiempo de build por el modo de Vite con el alias `@entorno`. Motivo: `.gitignore` excluye `.env.*`, el checklist (REP-06) prohíbe `.env` versionados, la `apiKey` web y el Client ID son públicos por diseño, y así no hace falta tocar el workflow del estándar ni escribir variables en GitHub.
- Cada bundle contiene solo la configuración de su ambiente; un modo de build desconocido falla con un error claro que lista los válidos.
- `staging`, `development` y `test` usan `pretso-database` con la misma configuración de hoy (`src/firebase-config.json`). `production` usa `pretso-prod` con los datos ya conocidos, y **`apiKey`, `appId` y el Client ID vacíos hasta el paso 3**.
- Mientras falten, `src/firebase.ts` lanza un error claro al iniciar (no cae en silencio a otro proyecto) y **el build de producción de un tag o de un `workflow_dispatch` falla** (`GITHUB_REF_TYPE=tag` o `GITHUB_EVENT_NAME=workflow_dispatch`, que define Actions; un tag de prerelease `-rc` también lo deja en rojo antes del paso 3, y es lo deseado: nada se etiqueta antes): así un tag creado antes del paso 3 no publica un sitio roto que la prueba de humo, que solo mira el código HTTP, no detectaría. En PR y en push a rama el build de producción compila, porque la CI lo ejecuta en cada run.
- `package.json` gana `build:staging` y `build:production`, que `./deploy.sh` ya prefiere; sin ellos, `./deploy.sh staging` habría construido el bundle de producción.
- **Se invierte en el paso 3:** dos pruebas de `src/__tests__/entornos.test.ts` (producción no publicable, y Client ID de producción vacío) y los cuatro valores vacíos de `src/environments/production/` (`apiKey`, `appId`, `storageBucket` y el Client ID).
- **Costo:** un PR, dos runs. Fusionarlo redespliega staging con la misma configuración de hoy. **Reversión:** `git revert`.
- Verificación adicional: la CSP de `firebase.json` no menciona proyectos concretos (`*.googleapis.com`, `*.firebaseio.com`), así que no cambia.

### Paso 2 — Endurecer `pretso-prod` antes de cargarle datos (GCP, Andres autoriza)
Controles bloqueantes del checklist que hoy están en rojo o sin medir para el proyecto nuevo:
- **DAT-04**: respaldo programado con retención de 30 días (hay datos personales) y PITR: `gcloud firestore databases update --database='(default)' --enable-pitr --project pretso-prod` y `gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=30d --project pretso-prod`. Protección contra borrado: `--delete-protection`.
- **NUB-G04**: presupuesto con alerta. **NUB-G03**: Audit Logs de escritura en Firestore.
- **NUB-G05**: en Authentication, dominios autorizados sin `localhost`, y proveedores mínimos (solo correo y contraseña).
- **Costo:** PITR y respaldos se cobran por almacenamiento; con un corpus de este tamaño se estiman centavos al mes, **por confirmar en la consola de facturación** antes de activarlos. **Reversión:** cada ajuste se desactiva con el mismo comando.

### Paso 3 — Aplicación web y clave de `pretso-prod`
- Registrar la aplicación web en `pretso-prod` (genera su `appId` y su apiKey).
- Restringir esa apiKey igual que se hizo el 2026-09-28 en `pretso-database`: referentes `https://pretso-prod.web.app/*` y `https://pretso-prod.firebaseapp.com/*`; APIs `identitytoolkit`, `securetoken`, `firestore` y `firebaseappcheck`. Se verifica con las mismas seis pruebas de respuesta HTTP.
- **Cliente OAuth de la copia a Drive:** crear uno en `pretso-prod` (con Drive API habilitada y `https://pretso-prod.web.app` como origen autorizado). No reutilizar el de `pretso-database`: ataría el sitio nuevo a un proyecto que va a dejar de ser producción.

### Paso 4 — Datos de Firestore (el paso delicado)
Diez colecciones: `companias`, `manejo_de_caja`, `salarios`, `corpus_christi`, `indicadores`, `transacciones`, `documentos`, `bibliografia`, `logs`, `users`.

- **Método recomendado: exportación e importación gestionadas de Firestore** (`gcloud firestore export` desde `pretso-database` hacia un bucket y `gcloud firestore import` en `pretso-prod`). Copia exacta: conserva identificadores y tipos de todas las colecciones. Requiere un bucket en la misma ubicación multirregión que la base (`nam5`) y permisos de exportación/importación sobre los dos proyectos: **son cambios de IAM y facturación; los aprueba y registra Andres**.
- Alternativa, si se prefiere no tocar IAM entre proyectos: script con Admin SDK que copia colección por colección. Más lento y más propenso a diferencias de tipos.
- **No usar** los `migrate_*.py` para esto: leen el `.ods`, no la base, y **escriben** en Firestore.
- **Prueba:** conteo de documentos por colección idéntico en origen y destino; muestra aleatoria de documentos comparada campo a campo; comprobación específica de fechas, números y referencias entre colecciones (`companias` ↔ `transacciones` ↔ `documentos`).
- **`logs`** contiene el correo del administrador (PII): revisar si se migra o se empieza vacío (APP-09, APP-16).
- **Ventana de corte:** congelar las escrituras en `pretso-database` durante la exportación (el corpus lo edita una persona, así que basta con avisarle).
- **Reversión:** vaciar `pretso-prod`; el origen no se toca.

### Paso 5 — Usuarios de autenticación
- Averiguar primero **cuántos usuarios hay** (no medido). Con pocos (un administrador y unos lectores), lo más simple y seguro es **recrearlos** en `pretso-prod` desde la pantalla «Gestión de usuarios» y enviar restablecimiento de contraseña a cada lector.
- Con muchos, exportar con `firebase auth:export` e importar con `auth:import` usando los parámetros de hash (scrypt) del proyecto de origen. El archivo exportado **contiene correos y hashes de contraseña**: se guarda fuera del repositorio, con permisos restringidos, y se destruye al terminar.
- **Claim de administrador:** asignar `admin: true` al administrador en `pretso-prod` con el Admin SDK y verificarlo leyendo el usuario. Hoy el privilegio de escritura depende del correo escrito fijo en `firestore.rules`, en `functions/src/index.ts` y en `src/context/AdminContext.tsx`; **este plan mantiene el mecanismo del correo** para no cambiar reglas de seguridad durante la migración. La migración al claim (Fase 4.3 de `PILOTO.md`) es un PR posterior, con pruebas de reglas en el emulador (DAT-01).

### Paso 6 — Reglas, Hosting y App Check en `pretso-prod`
- Desplegar las **mismas** `firestore.rules` que tiene `pretso-database` (DAT-02): las despliega el pipeline.
- `.firebaserc`: hoy declara solo `default: pretso-database`; añadir alias `staging` y `production`.
- **App Check:** primero en modo monitoreo; se pasa a bloqueo solo cuando las métricas muestren tráfico legítimo (NUB-G06 es bloqueante con datos personales).

### Paso 7 — Ensayo antes de mover a nadie
- Desplegar el sitio a un **canal de vista previa** de Hosting de `pretso-prod` (no al canal `live`) y probar: inicio de sesión del administrador y de un lector, lectura de cada colección, una edición y su reversión, copia a Drive con el cliente nuevo, y ZAP baseline contra la URL de la vista previa.
- Restauración real de un respaldo en un proyecto de prueba, con fecha y duración registradas (APP-13).

### Paso 8 — Corte y primer tag (Andres, nadie más)
- Andres crea el tag `vX.Y.Z` y aprueba el Environment `production`. **Ninguna sesión lo hace.**
- Verificar el run completo, el sitio en `pretso-prod.web.app` y la variable `PROD_URL`.
- Decidir qué pasa con `pretso-database.web.app`: si queda como staging, **debe vaciarse de datos reales o anonimizarse** (DAT-07: los datos de producción nunca se copian a staging sin anonimizar; hoy `pretso-database` tiene los datos reales).
- **Reversión:** el sitio anterior sigue disponible hasta que se retire; revertir es no publicar el enlace nuevo.

## 3. Controles del checklist que hoy bloquean un pase (medido el 2026-09-29)

| Control | Nivel | Estado hoy | Qué falta |
|---|---|---|---|
| REP-03 revisores ≥ 1 en `main` | B | **Rojo** (0 aprobaciones, desviación documentada en `PILOTO.md`) | Que el propietario del estándar la acepte como «N/A justificado» (un solo dueño) |
| SEC-01 inventario de secretos | B | **Rojo** (`docs/seguridad/inventario-secretos.md` no existe) | Escribirlo |
| PIP-10 workflow `probar-identidad` | B | **Rojo** (no existe) | Copiar la plantilla del estándar y correrlo para `production` |
| DAT-01 pruebas de reglas en el emulador, en CI | B | **Rojo** (no hay `test:rules` ni carpeta de pruebas) | Escribirlas y añadirlas a la CI |
| DAT-04 respaldos y PITR | B | **Verde en `pretso-database`** (activados el 2026-09-30); **Rojo en `pretso-prod`** | Paso 2 sobre `pretso-prod` |
| OPS-04 runbook de rollback | B | **Rojo** (`docs/produccion/runbook-rollback.md` no existe) | Escribirlo |
| NUB-G06 App Check en `enforce` | R (B con datos personales) | **Rojo** (sin encender) | Monitoreo, luego bloqueo |
| REP-09 Dependabot para todos los ecosistemas | B | **Parcial**: cubre `github-actions` y `npm` (raíz y `functions/`), **no `pip`**, aunque ya existe `requirements.txt` | Añadir el bloque `pip` |
| REP-01, REP-02, REP-04, SEC-02, SEC-03, SEC-06 | B | Verde, medido el 2026-09-29 (ver `PILOTO.md` §«Gobierno») | — |
| SEC-07 federación GCP | B | Verde según su creación del 2026-09-25; no se volvió a medir hoy | Repetir los puntos 1 a 3 de `02-identidad-federada-oidc.md` al preparar el pase |
| REP-06 sin `.env`, claves ni `tfvars` versionados | B | Verde en lo medido (no hay archivos sensibles en `git ls-files`); **no se comparó** el bloque base del `.gitignore` con el del estándar | Comparar |
| PIP-05, PIP-09, REP-05 | B | Verde: `./security-local.sh` aprobado, ZAP y humo en verde, historial con 5 excepciones vigentes | Las excepciones vencen el 2026-12-25 |

Criterio del estándar: **un solo Rojo bloqueante impide el pase.** Hoy hay **al menos siete** (REP-03, SEC-01, PIP-10, DAT-01, DAT-04, OPS-04 y REP-09, este último parcial), y NUB-G06 también lo sería porque hay datos personales (correos de usuarios). Es un recuento de esta jornada, no un acta: el acta la produce `/pase-a-produccion` cuando se vaya a crear un tag.

## 4. Lo que este plan no hace, y por qué
- No toca datos, usuarios, IAM, ruleset ni secretos: es un plan.
- No usa `migrate_*.py`: escriben en la base.
- No cambia el mecanismo de administrador (correo → claim) durante la migración: dos cambios de seguridad a la vez impedirían saber cuál rompió algo.
- No fija fecha: depende de la respuesta de Andres a §0 y de cuántos usuarios haya (paso 5).

## 5. Qué necesita de Andres
1. Responder a la pregunta de `PILOTO.md` §«Entrega de octubre»: ¿se necesita `pretso-prod` para el contrato?
2. Cuántos usuarios de autenticación hay y quiénes son (para elegir entre recrear e importar).
3. Autorizar, paso a paso, los cambios de GCP (respaldos, permisos de exportación e importación, aplicación web, cliente OAuth).
4. Crear el tag y aprobar el Environment, cuando llegue el momento.
