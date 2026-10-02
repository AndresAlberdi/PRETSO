# Inventario de secretos de PRETSO (SEC-01)

| Versión | Fecha | Alcance | Control |
|---|---|---|---|
| 1.3 | 2026-10-02 | Repositorio `AndresAlberdi/PRETSO`, proyectos Firebase `pretso-database` (staging) y `pretso-prod` (producción) | NUB-G06 (App Check en monitoreo): site key de reCAPTCHA Enterprise (SEC-P05) y token de depuración local; mantiene SEC-01 |
| 1.2 | 2026-10-02 UTC (2026-10-01 hora de Bolivia) | Repositorio `AndresAlberdi/PRETSO`, proyectos Firebase `pretso-database` (staging) y `pretso-prod` (producción) | SEC-07 de `05-checklist-pase-a-produccion.md` (capas 1 y 2 de WIF de producción aplicadas y verificadas con dos pruebas negativas); mantiene SEC-01 |
| 1.1 | 2026-10-01 (hora de Bolivia) | Repositorio `AndresAlberdi/PRETSO`, proyectos Firebase `pretso-database` (staging) y `pretso-prod` (producción) | SEC-01 de `05-checklist-pase-a-produccion.md`; formato de la sección 2 de `01-gestion-de-secretos.md` |

Este inventario **no contiene valores**, solo metadatos. Los nombres de recurso que figuran (proyectos, cuentas de servicio, pool WIF) ya constan en el repositorio y no permiten autenticarse por sí solos: la nube solo entrega credenciales si el token OIDC de GitHub cumple la condición de confianza del provider.

Propietario de todo lo listado: **Andres Alberdi** (único propietario y administrador del repositorio y de ambos proyectos). Donde se dice «cuenta de rol» se trata de una cuenta de servicio o de una cuenta de la misma persona, no de un tercero.

## 1. Resumen

PRETSO prácticamente no tiene secretos de larga duración: el despliegue usa federación de identidad (WIF/OIDC) y la aplicación no lee ninguna variable de entorno ni credencial en tiempo de ejecución. Lo único que se guarda como secreto son **cinco identificadores de clase S3** en GitHub (cuatro hasta el 2026-10-01 (hora de Bolivia), cuando se añadió `GCP_WIF_PROVIDER_PROD`). No hay secretos S0 (prohibidos), S1 (críticos) ni S2 (tokens de terceros) en uso.

Estado del control SEC-01: **Verde**. Las verificaciones que este inventario no pudo medir (condición de confianza del provider WIF y roles de las cuentas de despliegue) se siguen en SEC-07 del plan de migración, y el segundo factor de las cuentas de GitHub en la sección 10.

## 2. Secretos de GitHub

Lectura hecha con `gh secret list` el 2026-10-01 (solo nombres y fechas).

| ID | Nombre | Clase | Propósito | Dónde vive | Consumidor | Propietario | Creación | Próxima rotación | Procedimiento de rotación |
|---|---|---|---|---|---|---|---|---|---|
| SEC-001 | `GCP_WIF_PROVIDER` | S3 | Identificar el provider WIF del pool `github` del proyecto `pretso-database` | Secreto de repositorio | `google-github-actions/auth` en los jobs de staging (`ci-node-firebase.yml`) | Andres Alberdi | 2026-09-25 | Al cambiar el pool o el proyecto | Regenerar con `setup-oidc-gcp.sh` del estándar y recargar con `gh secret set` (por la sesión, con autorización de Andres) |
| SEC-002 | `GCP_SA_DEPLOY_STAGING` | S3 | Cuenta de servicio a impersonar para desplegar a staging (`deploy-staging@pretso-database`) | Secreto de repositorio | `google-github-actions/auth` (jobs de vista previa y de staging) | Andres Alberdi | 2026-09-25 | Al cambiar la cuenta | Ídem |
| SEC-003 | `GCP_WIF_PROVIDER` (Environment `production`) | S3 | Provider WIF del proyecto `pretso-prod` | Secreto de Environment `production` | `google-github-actions/auth` en los jobs de producción (solo tras aprobación) | Andres Alberdi | 2026-09-25 | Al cambiar el pool o el proyecto | Ídem |
| SEC-004 | `GCP_SA_DEPLOY_PROD` | S3 | Cuenta de servicio a impersonar para desplegar a producción (`deploy-production@pretso-prod`) | Secreto de Environment `production` | `google-github-actions/auth` (despliegue y rollback de producción) | Andres Alberdi | 2026-09-25 | Al cambiar la cuenta | Ídem |
| SEC-005 | `GCP_WIF_PROVIDER_PROD` | S3 | Ruta del provider WIF del pool `github` de `pretso-prod` (identificador, no credencial), para la prueba negativa | Secreto de repositorio (a propósito fuera del Environment: la prueba corre sin él) | Solo `probar-identidad-negativa.yml` | Andres Alberdi | 2026-10-02 UTC (2026-10-01 en hora de Bolivia) | Al cambiar la infraestructura (pool, provider o proyecto) | Recargar con `gh secret set` (por la sesión, con autorización de Andres), sin mostrar el valor |

Notas:

- El Environment `production` tiene revisores requeridos y política de ramas/tags (verificado con `gh api .../environments`). El Environment `staging` no tiene reglas de protección, por diseño (modo A).
- Existen dos secretos distintos con el mismo nombre `GCP_WIF_PROVIDER` (uno de repositorio para staging, otro de Environment para producción); el de Environment prevalece en los jobs con `environment: production`.
- `GCP_WIF_PROVIDER_PROD` contiene la misma ruta que el `GCP_WIF_PROVIDER` del Environment `production`, pero como secreto de repositorio: así un job **sin** Environment puede intentar el intercambio y comprobar que se le niega. Conocer la ruta no da acceso (véase la sección 4).
- La barrera real no es el secreto sino la condición de confianza del provider WIF y el binding de cada cuenta de despliegue (sección 4), que restringen qué ejecuciones pueden obtener credenciales.
- No existen secretos de Dependabot ni de Codespaces (`gh secret list --app dependabot` y `--app codespaces`, vacíos).
- El Environment `staging` y el `production` no tienen variables propias.

### Secretos que los workflows referencian pero NO existen

Los workflows reutilizables del estándar admiten estos secretos de forma opcional. No están creados y el pipeline funciona sin ellos:

| Nombre | Uso en el workflow | Efecto de no existir | Decisión |
|---|---|---|---|
| `SNYK_TOKEN` | Escaneo Snyk opcional (`_reusable-security.yml`) | Snyk se omite | No se usa Snyk (S2, 180 días si se creara) |
| `GITLEAKS_LICENSE` | Licencia de gitleaks para organizaciones | No se necesita en un repositorio de cuenta personal | No aplica |
| `RELEASE_TOKEN` | PAT fine-grained opcional de `release.yml` para que el tag dispare workflows | `release.yml` usa `github.token` | No se crea sin instrucción de Andres. Si se creara: PAT fine-grained, solo `contents: write` en este repositorio, caducidad máxima 90 días, y se agrega aquí |

## 3. Variables de GitHub (no secretas)

Lectura con `gh variable list` el 2026-10-01. Son configuración; se listan para que el inventario cruce con la auditoría.

| Nombre | Creación | Contenido (clase) |
|---|---|---|
| `GCP_PROJECT_ID_STAGING` | 2026-09-25 | Id del proyecto de staging (P) |
| `GCP_PROJECT_ID_PROD` | 2026-09-25 | Id del proyecto de producción (P) |
| `STAGING_URL`, `PROD_URL` | 2026-09-25 | URL públicas de los sitios (P) |
| `APROBADORES_PROD` | 2026-09-25 | Lista de cuentas autorizadas a ejecutar el pase a producción (cuentas de rol; sin correos en este documento) |
| `WORKFLOW_PRODUCCION`, `FIREBASE_DEPLOY_ONLY`, `HEALTH_PATH`, `MODO`, `NODE_VERSION`, `CODEQL_LENGUAJES`, `GHAS_ENABLED`, `TAG_FIRMADO_REQUERIDO` | 2026-09-25 | Parámetros del pipeline |
| `COVERAGE_MIN` | 2026-09-20 | Umbral de cobertura |

`BLOQUEAR_EN`, `FIREBASE_PREVIEW`, `FIREBASE_SITE_ID` y `PYTHON_VERSION` son variables opcionales que los workflows referencian pero que no están creadas; no son secretos.

Ninguna variable contiene credenciales. Regla: si una variable llegara a contener algo sensible, se mueve a secreto y se anota aquí.

## 4. Federación WIF (despliegue sin claves)

| Proyecto | Pool / provider | Cuenta de servicio de despliegue | Quién la usa |
|---|---|---|---|
| `pretso-database` (staging) | `workloadIdentityPools/github/providers/github` | `deploy-staging@pretso-database.iam.gserviceaccount.com` | Workflow `ci-node-firebase.yml`, jobs de staging |
| `pretso-prod` (producción) | `workloadIdentityPools/github/providers/github` | `deploy-production@pretso-prod.iam.gserviceaccount.com` | Workflow `ci-node-firebase.yml`, jobs de producción, tras aprobación del Environment |

- **No existen claves**: el flujo intercambia el token OIDC de GitHub por credenciales temporales (de corta duración). No hay JSON de cuenta de servicio ni `FIREBASE_TOKEN`. No hay nada que rotar; si se sospecha un abuso se deshabilita el provider o se quita el rol a la cuenta.
- Propietario: Andres Alberdi. Revisión de la condición de confianza y de los roles de las cuentas: antes de cada pase a producción (checklist, sección de identidad) y ante cualquier cambio de repositorio.
- Roles de las cuentas de despliegue: documentados en `PILOTO.md` (incluido `roles/serviceusage.serviceUsageViewer`, mínimo para `firestore:rules`).

- **Identidad de runtime de Cloud Functions (`functions/`)**: la versión migrada del repositorio no se despliega (`FIREBASE_DEPLOY_ONLY=hosting,firestore:rules`; no está en el CI). Verificado con lecturas el 2026-10-01: en `pretso-prod` no hay funciones; en `pretso-database` **sigue desplegada una versión antigua de `createReaderUser`** (gen1, `nodejs20` deprecado, actualizada el 2026-07-29, autorizada por correo fijo, invocable públicamente como toda función callable y sin invocaciones en los últimos 30 días). Corre con la cuenta de servicio por defecto de App Engine de `pretso-database`, que tiene `roles/editor`: revisar y retirar el rol tras retirar la función. **Recomendación de seguridad: retirar la función; decisión pendiente de Andres Alberdi (no ejecutada).** Antes de desplegar cualquier versión futura habrá que registrar su cuenta de servicio y revisar sus roles (no usar la predeterminada con `roles/editor`). Propietario: Andres Alberdi.

### 4.1 Quién puede impersonar cada cuenta (desde el 2026-10-02 UTC (2026-10-01 en hora de Bolivia))

| Capa | Staging (`pretso-database`) | Producción (`pretso-prod`) |
|---|---|---|
| 1. Binding de la cuenta (`roles/iam.workloadIdentityUser`) | Sin cambios | `deploy-production` solo acepta el principal `principal://…/subject/repo:AndresAlberdi/PRETSO:environment:production` y su variante con identificadores inmutables. **El acceso amplio por repositorio (`principalSet://…/attribute.repository/…`) se quitó el 2026-10-02 UTC (2026-10-01 en hora de Bolivia).** En la práctica: solo un job con `environment: production`, es decir, tras la aprobación del Environment, obtiene credenciales de producción |
| 2. Condición del provider | Condición por identificadores inmutables del repositorio y del propietario (aplicada) | **Aplicada el 2026-10-02 a las 03:16 UTC** (2026-10-01 en hora de Bolivia): `assertion.repository_owner_id == '<id>' && assertion.repository_id == '<id>' && assertion.environment == 'production' && assertion.ref.startsWith('refs/tags/v')`. Los identificadores numéricos no se escriben en este documento. Mapeo de atributos y emisor sin cambios. Valor anterior: `assertion.repository_owner == 'AndresAlberdi'`. **Reversión:** restablecer ese valor anterior en el provider (lo hace Andres o Claude con su autorización); no se amplía el binding de la capa 1 |

Pruebas:

- **Negativa** (`.github/workflows/probar-identidad-negativa.yml`, solo `workflow_dispatch`, sin Environment): intenta el intercambio y la impersonación de `deploy-production`; verde solo ante el rechazo esperado: STS 400 `unauthorized_client` por la attribute condition (capa 2) o `generateAccessToken` 403 `PERMISSION_DENIED` sobre `iam.serviceAccounts.getAccessToken` (capa 1); rojo si obtiene un token, si la respuesta es cualquier otro error, si el secreto o la variable no apuntan a `pretso-prod` (huella del provider y nombre del proyecto) o si el job tuviera Environment. 
  - **Negativa n.º 1** (desde `main`, sin Environment, **antes** de aplicar la capa 2; [run](https://github.com/AndresAlberdi/PRETSO/actions/runs/36959351534)): verde por la capa 1, «Rechazado por el binding de la cuenta (capa 1): HTTP 403, PERMISSION_DENIED (iam.serviceAccounts.getAccessToken)». STS aceptó el intercambio, porque la condición del provider era todavía la antigua; anclas correctas (provider y proyecto de producción).
  - **Negativa n.º 2** (misma forma, **después** de la capa 2, con unos 4 minutos de propagación; [run](https://github.com/AndresAlberdi/PRETSO/actions/runs/36959462161)): verde por la capa 2, «Rechazado por la condición del provider (capa 2): HTTP 400, unauthorized_client (attribute condition).»
- **Positiva (PENDIENTE)**: `probar-identidad.yml` con `ambiente=production`, lanzado sobre el primer tag `v*` y aprobado por Andres en el Environment, **antes** de aprobar el despliegue de ese tag (PIP-10 depende de ella). Antes del primer despliegue se revisa además que `desplegar-produccion` autentica con la nueva condición; si algo falla cerrado, se revierte la condición por el valor guardado, nunca se amplía el binding.

> **ADVERTENCIA: no volver a ejecutar `setup-oidc-gcp.sh` del estándar contra `pretso-prod` ni contra `pretso-database`.** El comportamiento que sigue es según la v2.1 leída localmente; la 2.2 debe verificarse en la sesión de SeguridadGeneral. Si el provider ya existe, el script lo actualiza con su propia condición (solo el nombre del propietario del repositorio), sobrescribiendo la vigente, y vuelve a otorgar a la cuenta de despliegue el acceso amplio por repositorio (`principalSet://…/attribute.repository/…`), deshaciendo lo descrito arriba. **Su sección 2.3 debe llevar esta misma condición** (identificadores, `environment == production` y ref de tag `v*`), a llevar a SeguridadGeneral en su sesión. Cualquier cambio de WIF se hace a mano, con autorización de Andres, y se verifica con la prueba negativa.

## 5. Identificadores públicos por diseño (clase P)

| ID | Elemento | Dónde vive | Por qué no es un secreto | Qué lo protege |
|---|---|---|---|---|
| SEC-P01 | apiKey web de Firebase de `pretso-database` (staging) | `src/firebase-config.json` (reexportada por `src/environments/staging/firebase.ts`); en el historial también en `src/firebase.ts` y `src/pages/UserManagement.tsx` (exceptuados) | El navegador la recibe en cada carga del sitio; identifica el proyecto, no autentica a nadie | Restricción por referente HTTP (3 referentes) y por API (4: `identitytoolkit`, `securetoken`, `firestore`, `firebaseappcheck`); `firestore.rules`; Firebase Authentication. App Check pendiente (NUB-G06) |
| SEC-P02 | apiKey web de Firebase de `pretso-prod` | `src/environments/production/firebase.ts` | Ídem | Misma restricción: 4 APIs y los referentes `https://pretso-prod.web.app/*` y `https://pretso-prod.firebaseapp.com/*`; reglas de Firestore con custom claim `admin`; App Check pendiente |
| SEC-P03 | Client ID OAuth web de Google (copia a Drive) de `pretso-database` y de `pretso-prod` | `src/environments/*/google.ts` | Un Client ID es público (Google lo muestra en cada inicio de sesión). No hay *client secret* en el repositorio: el flujo del navegador usa Google Identity Services sin secreto | Orígenes JavaScript autorizados del cliente (solo los sitios de cada ambiente) y el consentimiento del usuario, que limita el alcance concedido |
| SEC-P04 | `appId`, `messagingSenderId`, `authDomain`, `storageBucket`, `projectId` | `src/environments/*/firebase.ts` | Configuración web estándar de Firebase | Mismas reglas de datos |
| SEC-P05 | Site key de reCAPTCHA Enterprise por ambiente (App Check) | `src/environments/*/firebase.ts` (`recaptchaSiteKey`); la de `pretso-prod` está pendiente (vacía hasta registrar App Check) | El navegador la recibe al cargar reCAPTCHA; identifica la clave, no autentica a nadie | Dominios permitidos de la clave y App Check en monitoreo |

Gitleaks detecta las apiKey por su forma. De los cinco hallazgos, tres son apiKey web de Firebase y dos son la clave del proyecto `pretso-platform`, ya retirada del árbol; los cinco están registrados como excepciones en `.devsecops.yml` (`seguridad.excepciones`), aprobadas por Andres el 2026-09-26 y con vencimiento **2026-12-25**, para obligar a revisarlas (por ejemplo, tras encender App Check). Rotar la apiKey es posible desde la consola (se crea una nueva clave restringida y se retira la antigua), pero no es necesario mientras no haya abuso medido.

## 6. Parámetros de hash de Authentication de `pretso-database`

| Elemento | Detalle |
|---|---|
| Qué es | Bloque `hashConfig` de Firebase Authentication (algoritmo scrypt, sal de parámetros del proyecto, rondas y costo de memoria) |
| Incidente | El 2026-10-01 una sesión imprimió ese bloque, sin filtrar, en su salida al leer la configuración de Authentication como referencia |
| Segunda impresión | El mismo bloque se imprimió una **segunda vez** el 2026-10-01 al leer la configuración de Authentication en una revisión de seguridad. Quedó solo en el transcript de la sesión del agente: sin hashes de usuarios ni contraseñas y sin escribirse en archivos. Andres decide si se rota (en Firebase no se puede rotar; solo serviría junto con un volcado de hashes). Recomendación: no compartir ese transcript |
| Qué NO salió | Ningún hash de contraseña de usuario, ninguna contraseña, ningún correo ni identificador de usuario |
| Riesgo | Bajo: esos parámetros solos no permiten reconstruir contraseñas; serían útiles junto con un export de hashes de usuarios, que no se filtró. No es una credencial de acceso |
| Decisión | **Andres Alberdi, 2026-10-01: solo anotarlo; no se rota nada** (consta en `ESTADO.md`) |
| Mitigación vigente | Las lecturas posteriores filtran esos campos. El plan de migración (paso 5) recomienda recrear los usuarios en `pretso-prod` en lugar de importar hashes; si se recrean, producción usa parámetros propios y no los de `pretso-database` (decisión pendiente en ese paso) |
| Revisión | Si `pretso-database` se conserva como staging, reevaluar al desmantelarlo o ante cualquier exportación de usuarios |

## 7. Credenciales locales (no versionadas)

Solo se registra su existencia; nunca tokens ni rutas con valores.

| Elemento | Dónde vive | Quién lo usa | Propietario | Rotación |
|---|---|---|---|---|
| Credenciales de aplicación por defecto (ADC) de `gcloud` | Equipo local de Andres, directorio de configuración de `gcloud` | `scripts/asignar_claim_admin.py`, `scripts/create_user.py`, `scripts/migrate_ods.py` (firebase-admin con `ApplicationDefault`) y `functions/migrate_keys.js` (firebase-admin, también con ADC) | Andres Alberdi | Renovar con `gcloud auth application-default login` cuando caduque o se cambie de equipo; revocar con `gcloud auth application-default revoke`. `asignar_claim_admin.py` avisa si `GOOGLE_APPLICATION_CREDENTIALS` está definida; no lo impide (sin valor mostrado) |
| Sesión de `gcloud` / `gh` de Andres | Equipo local | Operaciones puntuales autorizadas por Andres | Andres Alberdi | Cierre de sesión al terminar la jornada de trabajo sensible; sin periodicidad fija |
| Cuenta `segurolotengopy` (segundo colaborador del repositorio, flujo REP-03) | Cuenta de GitHub de la misma persona | Aprobación de PR bajo el ruleset `proteccion-main` | Andres Alberdi | Verificar que tenga autenticación de dos factores (**no verificable desde la sesión**); revisar el acceso al cerrar el piloto |
| `PRETSO_ADMIN_EMAIL` / `PRETSO_ADMIN_PASSWORD` | Variables de entorno de una sola ejecución de `scripts/create_user.py` | Alta manual de un usuario | Andres Alberdi | No se guardan en archivos. La contraseña inicial se cambia al primer ingreso; no existe valor persistente |
| Token de depuración de App Check (`VITE_APPCHECK_DEBUG_TOKEN`) | `.env.development.local` en el equipo de Andres; nunca en el repositorio ni en CI (`vite.config.ts` solo lo admite con `npm run dev`, servidor de desarrollo en modo development; cualquier `vite build`, en cualquier modo, o prueba falla si la variable tiene valor) | `npm run dev` (desarrollo local contra `pretso-database`) | Andres Alberdi | Revocar en la consola de App Check si se filtra o se cambia de equipo, y registrar uno nuevo |

No se usan tokens de n8n ni de otras integraciones: el repositorio no los menciona.

## 8. Lo que NO existe, y cómo comprobarlo

| Afirmación | Comprobación | Resultado (2026-10-01) |
|---|---|---|
| No hay claves JSON de cuentas de servicio versionadas | `git ls-files \| grep -iE 'serviceaccount\|-sa-key\|\.pem$\|\.key$'` y gitleaks (regla propia de JSON de cuenta de servicio en `.github/gitleaks.toml`) | Sin coincidencias en el árbol |
| No hay `.env` versionados | `git ls-files \| grep -E '(^\|/)\.env'`; `.gitignore` excluye `.env`, `.env.*`, `*.key`, `serviceAccountKey*.json`, `*-sa-key.json` (se permite `.env.example`) | Sin coincidencias |
| No hay secretos en el historial salvo los excepcionados | `gitleaks detect --config .github/gitleaks.toml --redact` (v8.30.1, el historial completo; el número de commits varía con las referencias escaneadas) | 5 hallazgos, todos ya excepcionados en `.devsecops.yml`: 2 `gcp-api-key` en un aviso de Dependabot pegado (proyecto `pretso-platform` en borrado, sin uso), y 3 apiKey web de `pretso-database` (públicas por diseño) |
| No hay `FIREBASE_TOKEN` ni PAT clásico | `gh secret list` (repositorio y ambos Environments) | Solo los cuatro S3 de la sección 2 (el quinto, `GCP_WIF_PROVIDER_PROD`, se creó el 2026-10-01 (hora de Bolivia)) |
| La aplicación no lee secretos en tiempo de ejecución | Revisión de `src/environments/*` y de `vite.config.ts`: la configuración se fija en el build por modo | Confirmado |

Observación: el historial contiene en un commit antiguo (`#14`) un directorio `venv/` con paquetes de Python que incluye paquetes de certificados raíz públicos (`cacert.pem`, `roots.pem`). Son certificados públicos de autoridades, no claves privadas; ya no están en el árbol.

## 9. Qué se verificó y cómo

| Hecho | Método | Estado |
|---|---|---|
| Secretos y variables de repositorio y de ambos Environments (nombres y fechas) | `gh secret list`, `gh variable list`, con y sin `--env` | Verificado |
| Protección del Environment `production` (revisores requeridos y política de ramas) | `gh api repos/.../environments` | Verificado |
| Ausencia de secretos de Dependabot y Codespaces | `gh secret list --app dependabot` / `--app codespaces` | Verificado |
| Referencias a secretos y variables en workflows | `grep` sobre `.github/workflows/*.yml` | Verificado |
| Ausencia de claves y `.env` en el árbol y el historial | `git ls-files`, `git log --diff-filter=A`, gitleaks 8.30.1 | Verificado |
| Restricción de las apiKey por referente y API | Medida por Andres y la sesión en jornadas anteriores (detalle en `PILOTO.md` y en el plan de migración) | Tomado de esos registros; **no se volvió a medir en esta sesión** |
| Orígenes autorizados de los Client ID OAuth | Configurados en la consola de Google por Andres | **No verificable desde esta sesión** (Google no lo expone por `gcloud`/API) |
| Condición de confianza del provider WIF y roles de las cuentas de despliegue | Requiere permisos IAM de lectura sobre ambos proyectos | **No verificado en esta sesión**; lo registrado al crearlos consta en `PILOTO.md` (jornada del 2026-09-25) |
| Autenticación de dos factores de las cuentas de GitHub | Ajuste de cuenta, no visible por la API del repositorio | **No verificable** |
| Fechas de creación de las cuentas de servicio y de las apiKey | No se consultó GCP | **No verificado**; se usan las fechas de carga en GitHub |

## 10. Rotación pendiente y decisiones

| Ítem | Estado | Responsable | Fecha |
|---|---|---|---|
| Rotación de parámetros de hash de `pretso-database` | **Decidido no rotar** (solo anotado) tras la primera impresión; la segunda impresión del mismo día queda pendiente de su decisión | Andres Alberdi | 2026-10-01 |
| Retiro de la versión antigua de `createReaderUser` en `pretso-database` y de `roles/editor` de su cuenta de runtime | **Recomendado; pendiente de decisión** (no ejecutado) | Andres Alberdi | 2026-10-01 |
| Excepciones de gitleaks sobre apiKey y clave de `pretso-platform` | Vigentes; revisar, y reducir a cero cuando App Check esté en `enforce` y `pretso-platform` se borre | Andres Alberdi | Vencen 2026-12-25 |
| App Check en `enforce` (NUB-G06) | Pendiente (primero monitoreo) | Andres Alberdi | Antes del primer tag |
| Verificar WIF (condición de confianza) y roles de las dos cuentas de despliegue | Binding de `deploy-production` estrechado al Environment `production` el 2026-10-02 UTC (2026-10-01 en hora de Bolivia), sección 4.1. Capas 1 y 2 aplicadas y verificadas con dos pruebas negativas verdes (sección 4.1). Pendiente: la prueba positiva sobre el primer tag | Andres Alberdi / sesión con su autorización | Antes del primer tag |
| Verificar autenticación de dos factores de `AndresAlberdi` y `segurolotengopy` | Pendiente, acción de Andres | Andres Alberdi | Antes del primer tag |
| Revisión periódica de este inventario | Cada trimestre y en cada pase a producción | Andres Alberdi | Próxima: 2027-01-01 |

Los secretos S3 no tienen periodicidad de rotación por calendario: se rotan al cambiar la infraestructura (regla de la clase S3). Si se agregara un S1 o S2, se añade una fila en la sección 2 con su fecha de rotación (90 y 180 días respectivamente).
