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
| Respaldo y protección | **Activados el 2026-09-30 en `pretso-database` y en `pretso-prod`** (PITR, protección contra borrado, respaldo diario de 30 días) | `gcloud firestore databases describe` y `backups schedules describe` |

### Hallazgo que condiciona todo: la configuración de Firebase está escrita fija en el código

`src/firebase.ts` fija `projectId`, `authDomain`, `storageBucket` y `apiKey` de `pretso-database`; `src/utils/googleClientId.ts` fija el cliente OAuth de la copia a Drive; la aplicación **no lee ninguna variable de entorno** (`import.meta.env` no aparece en `src/`). El workflow construye con `--mode production`, pero ese modo no cambia nada de esa configuración.

**Consecuencia:** un tag `vX.Y.Z` desplegaría en `pretso-prod` un sitio cuya aplicación lee y escribe en `pretso-database`. El paso 1 no se puede saltar.

## 2. Pasos

Cada paso indica quién lo hace, costo, prueba y cómo se revierte. «Claude opera» siempre con el «sí» de Andres en el chat.

### Paso 1 — Configuración por ambiente en el código (PR de código, riesgo medio)
**Hecho en #38** (`63b9a83`, fusionado el 2026-09-30; el resultado medido está en ese PR y en `PILOTO.md`). Se aparta del texto original de este plan en un punto, y conviene que Andres lo sepa: en vez de variables de Vite inyectadas por el workflow, la configuración vive en **archivos versionados por ambiente** (`src/environments/staging/` y `production/`), elegidos en tiempo de build por el modo de Vite con el alias `@entorno`. Motivo: `.gitignore` excluye `.env.*`, el checklist (REP-06) prohíbe `.env` versionados, la `apiKey` web y el Client ID son públicos por diseño, y así no hace falta tocar el workflow del estándar ni escribir variables en GitHub.
- Cada bundle contiene solo la configuración de su ambiente; un modo de build desconocido falla con un error claro que lista los válidos.
- `staging`, `development` y `test` usan `pretso-database` con la misma configuración de hoy (`src/firebase-config.json`). `production` usa `pretso-prod` con los datos ya conocidos, y **`apiKey`, `appId` y el Client ID vacíos hasta el paso 3**.
- Mientras falten, `src/firebase.ts` lanza un error claro al iniciar (no cae en silencio a otro proyecto) y **el build de producción de un tag o de un `workflow_dispatch` falla** (`GITHUB_REF_TYPE=tag` o `GITHUB_EVENT_NAME=workflow_dispatch`, que define Actions; un tag de prerelease `-rc` también lo deja en rojo antes del paso 3, y es lo deseado: nada se etiqueta antes): así un tag creado antes del paso 3 no publica un sitio roto que la prueba de humo, que solo mira el código HTTP, no detectaría. En PR y en push a rama el build de producción compila, porque la CI lo ejecuta en cada run.
- `package.json` gana `build:staging` y `build:production`, que `./deploy.sh` ya prefiere; sin ellos, `./deploy.sh staging` habría construido el bundle de producción.
- **Se invierte en el paso 3:** dos pruebas de `src/__tests__/entornos.test.ts` (producción no publicable, y Client ID de producción vacío) y los cuatro valores vacíos de `src/environments/production/` (`apiKey`, `appId`, `storageBucket` y el Client ID).
- **Costo:** un PR, dos runs. Fusionarlo redespliega staging con la misma configuración de hoy. **Reversión:** `git revert`.
- Verificación adicional: la CSP de `firebase.json` no menciona proyectos concretos (`*.googleapis.com`, `*.firebaseio.com`), así que no cambia.

### Paso 2 — Endurecer `pretso-prod` antes de cargarle datos (GCP, Andres autoriza)
Controles bloqueantes del checklist para `pretso-prod`. **Hecho, salvo el presupuesto, que lo crea Andres:**
- **DAT-04 — HECHO el 2026-09-30**: respaldo programado con retención de 30 días (hay datos personales) y PITR: `gcloud firestore databases update --database='(default)' --enable-pitr --project pretso-prod` y `gcloud firestore backups schedules create --database='(default)' --recurrence=daily --retention=30d --project pretso-prod`. Protección contra borrado: `--delete-protection`.
- **NUB-G03 / GCP-06 (auditoría) — HECHO el 2026-10-01**: Data Access de **escrituras de Firestore** (`DATA_WRITE`) activado en la política del proyecto. Se añadió solo el bloque `auditConfigs`; los 12 roles y sus miembros quedaron idénticos (comparado antes y después). **Defecto de la guía del estándar:** `03-hardening-por-nube.md` indica `firestore.googleapis.com`, y la API lo rechaza (`does not exist or does not support service level configuration of Google Cloud audit logging`); Firestore registra su auditoría de datos bajo **`datastore.googleapis.com`**. Se lleva a SeguridadGeneral. Admin Activity está siempre activo. Secret Manager no se audita porque `pretso-prod` no lo usa (la API no está habilitada).
- **NUB-G05 — HECHO el 2026-09-30 (paso 3)**: dominios autorizados sin `localhost` y solo el proveedor de correo y contraseña.
- **NUB-G04 / GCP-07 (presupuesto con alertas a 50, 90 y 100 % y umbral de previsión; bloqueante) — creado por Andres el 2026-10-01 en la consola; no verificable desde la sesión.** La cuenta de la sesión (`alberdi.andres@gmail.com`) no tiene permisos sobre la cuenta de facturación (puede ver que el proyecto está vinculado, pero no describirla ni listar o crear presupuestos), y darse esos permisos no corresponde a la sesión.
- **Costo:** PITR y respaldos se cobran por almacenamiento, y los registros de acceso a datos por volumen ingerido más allá del nivel gratuito; con un corpus de este tamaño se estiman centavos al mes, **por confirmar en la consola de facturación**. **Reversión:** cada ajuste se desactiva con el mismo comando; la auditoría se retira quitando el bloque `auditConfigs` de la política.

### Paso 3 — Aplicación web y clave de `pretso-prod`
**Hecho el 2026-09-30, con autorización de Andres; el cliente OAuth lo creó él el 2026-10-01.** Resultado medido:
- **App web registrada** en `pretso-prod` («PRETSO», `appId` `1:309066922693:web:afd5bf807e672a84c64eac`). Su apiKey es la clave de navegador que el proyecto ya tenía (comprobado por hash).
- **apiKey restringida** (antes: 27 APIs y sin restricción de referente): 4 APIs (`identitytoolkit`, `securetoken`, `firestore`, `firebaseappcheck`) y solo los referentes `https://pretso-prod.web.app/*` y `https://pretso-prod.firebaseapp.com/*`, **sin `localhost`**. Se guardó la configuración anterior. Verificado con seis pruebas de respuesta HTTP antes y después: el sitio ajeno y `localhost` pasan a «referente bloqueado» (403), una API quitada a «servicio bloqueado» y las APIs del sitio siguen permitidas.
- **Firebase Authentication inicializado**, que no estaba (`identitytoolkit` respondía `CONFIGURATION_NOT_FOUND`: nadie podía iniciar sesión): solo el proveedor de correo y contraseña, MFA desactivado y dominios autorizados limitados a `pretso-prod.web.app` y `pretso-prod.firebaseapp.com` (NUB-G05). Tras eso el inicio de sesión desde el sitio responde `INVALID_LOGIN_CREDENTIALS`, igual que `pretso-database`.
- **API de Drive habilitada** en `pretso-prod`.
- **Código:** `src/environments/production/firebase.ts` lleva ya su `apiKey`, `appId` y `storageBucket`; la guarda de publicación deja de bloquear los tags. Para que gitleaks no marque esa clave pública con su regla genérica se añadió a `.github/gitleaks.toml` un permitido acotado a `src/environments/<ambiente>/firebase.ts` (aprobado por Andres el 2026-09-30; probado con una clave falsa: cualquier otra ruta con una clave sigue marcada).
- **Cliente OAuth de Drive — creado por Andres el 2026-10-01** en la consola de `pretso-prod` (Google no permite crearlo por `gcloud` ni por API). Su Client ID está en `src/environments/production/google.ts`, y su número inicial (`309066922693`) es el del proyecto `pretso-prod`. **Falta probar la copia a Drive en producción**, lo que solo puede hacerse con su sesión una vez publicado el sitio (paso 7). No se reutilizó el de `pretso-database`, para no atar el sitio a un proyecto que va a dejar de ser producción.

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
- **Medido el 2026-10-01: `pretso-database` tiene 3 usuarios**, todos con contraseña, ninguno deshabilitado ni con claims, todos con ingresos. `pretso-prod` tiene Authentication inicializado (paso 3) y **ninguno**: nadie puede iniciar sesión allí todavía.
- **Recomendado: recrearlos** en `pretso-prod` y enviar a cada uno un restablecimiento de contraseña. Con 3 usuarios es lo más simple y evita exportar un archivo con hashes de contraseña. El primer administrador no puede crearse desde la pantalla «Gestión de usuarios» (hay que haber iniciado sesión como administrador): se crea una vez en la consola de Firebase de `pretso-prod` (Authentication → Usuarios → Agregar usuario) con la contraseña que elija esa persona; con ese acceso se crean los otros dos desde la pantalla. El privilegio de administrador depende hoy del **correo**, así que el administrador debe usar en producción el mismo correo que en `pretso-database`.
- **Decisión del 2026-10-01:** los administradores son dos (`alberdi.andres@gmail.com` y `pretsodatabase@gmail.com`) y no hay otros usuarios por ahora; ambas cuentas se crean en la consola de `pretso-prod` y no se recrea ninguna de las 3 de `pretso-database`. Con dos administradores el mecanismo del correo fijo no alcanza: el claim `admin` (DAT-01) pasa a ser previo al pase, con lo que la frase siguiente sobre mantener el correo queda superada.
- Alternativa, solo si se quisiera conservar las contraseñas actuales: exportar con `firebase auth:export` e importar con `auth:import` usando los parámetros de hash (scrypt) del proyecto de origen. El archivo exportado **contiene correos y hashes de contraseña**: se guarda fuera del repositorio, con permisos restringidos, y se destruye al terminar. No compensa con 3 usuarios.
- **Claim de administrador:** asignar `admin: true` al administrador en `pretso-prod` con el Admin SDK y verificarlo leyendo el usuario. El privilegio de administrador ya no depende de un correo fijo: reglas, `src/context/AdminContext.tsx` y `functions/src/index.ts` usan el claim `admin` (migración de la Fase 4.3 de `PILOTO.md`, con pruebas de reglas en el emulador, DAT-01). Falta asignar el claim en `pretso-prod` cuando se creen las cuentas.

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
| REP-03 revisores ≥ 1 en `main` | B | **Verde** desde el 2026-10-01: ruleset en 1 aprobación y segundo colaborador (`segurolotengopy`). Cumple la letra; esa cuenta es de la misma persona, así que no es revisión independiente | — |
| SEC-01 inventario de secretos | B | **Verde**: inventario en [`docs/seguridad/inventario-secretos.md`](../seguridad/inventario-secretos.md); las verificaciones pendientes (condición de confianza WIF y roles de las cuentas de despliegue) se siguen en SEC-07 y el segundo factor en la sección 10 del inventario | — |
| PIP-10 workflow `probar-identidad` | B | **Amarillo**: workflow `probar-identidad` creado; falta el run verde en `production` (requiere el primer tag; Andres decide cómo obtener ese run) | Run verde de `probar-identidad` con `ambiente=production` |
| DAT-01 pruebas de reglas en el emulador, en CI | B | **Verde**. Evidencia: run de `main` 36866213607 (sha 7648692, job `calidad`, paso «Pruebas de reglas de Firestore (emulador)» en success) y los PR #48 a #50. Pruebas en `tests/rules` (`npm run test:rules`); las reglas con claim ya son `firestore.rules`. Hallazgo: con el registro por correo abierto en Authentication cualquier persona podría leer, por eso la propuesta restringe la lectura (`admin` o `reader`; `logs` y `users` solo admin); el registro **se desactivó el 2026-10-01** en `pretso-database` y `pretso-prod` (`disabledUserSignup`, verificado leyendo la configuración); la pantalla «Gestión de usuarios» ya no puede crear cuentas desde el navegador. | Asignar el claim `admin` en `pretso-prod` antes del despliegue: requisito del pase, acción pendiente aparte |
| DAT-04 respaldos y PITR | B | **Verde en los dos proyectos** (activados el 2026-09-30) | — |
| OPS-04 runbook de rollback | B | **Verde** ([`runbook-rollback.md`](runbook-rollback.md)): runbook con comandos reales y responsable; los ensayos se siguen en OPS-06 | Ensayar en staging la restauración PITR/respaldo y el rollback (OPS-06, pendiente aparte) |
| OPS-06 ensayos de rollback en staging | B | **Rojo** (ensayos 3, 6, 7, 8 y 9 hechos el 2026-10-01; faltan 1, 4, 5 y 10); PIP-14 (rollback automático) depende de él | Ejecutar los ensayos pendientes del runbook (1, 4, 5 y 10) |
| OPS-07 RTO/RPO | B | **Verde** ([`runbook-rollback.md`](runbook-rollback.md), sección 4): RTO de la aplicación 30 min, RTO de datos 2 h y RPO 1 h, confirmados por Andres el 2026-10-01; se vuelven a medir con más datos | Ninguna (el checklist solo exige la tabla en el runbook) |
| NUB-G06 App Check en `enforce` | R (B con datos personales) | **Rojo** (sin encender) | Monitoreo, luego bloqueo |
| REP-09 Dependabot para todos los ecosistemas | B | **Verde** (#37 añadió `pip`; Dependabot ya abrió PR de `pip`) | — |
| REP-01, REP-02, REP-04, SEC-02, SEC-03, SEC-06 | B | Verde, medido el 2026-09-29 (ver `PILOTO.md` §«Gobierno») | — |
| SEC-07 federación GCP | B | Verde según su creación del 2026-09-25; no se volvió a medir hoy | Repetir los puntos 1 a 3 de `02-identidad-federada-oidc.md` al preparar el pase |
| REP-06 sin `.env`, claves ni `tfvars` versionados | B | Verde en lo medido (no hay archivos sensibles en `git ls-files`); **no se comparó** el bloque base del `.gitignore` con el del estándar | Comparar |
| PIP-05, PIP-09, REP-05 | B | Verde: `./security-local.sh` aprobado, ZAP y humo en verde, historial con 5 excepciones vigentes | Las excepciones vencen el 2026-12-25 |

Criterio del estándar: **un solo Rojo bloqueante impide el pase.** Al 2026-10-01, con SEC-01 ya fusionado (#51), y con OPS-07 confirmado por Andres el 2026-10-01 (Verde), quedan **tres** Rojo B: PIP-10, OPS-06 (ensayos de rollback: ensayos 3, 6, 7, 8 y 9 hechos el 2026-10-01; faltan 1, 4, 5 y 10) y NUB-G06 (R, B porque hay datos personales: correos de usuarios); PIP-14 depende de OPS-06. Antes de fusionar #51 se suma SEC-01. DAT-01 y OPS-04 ya no cuentan. Es un recuento de esa fecha, no un acta: el acta la produce `/pase-a-produccion` cuando se vaya a crear un tag.

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
