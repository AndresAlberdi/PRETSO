# Cerrar el estándar DevSecOps y habilitar el pase a producción — PRETSO

> **Instancia:** PRETSO es un sistema propio, no un módulo multicliente; el
> proyecto de GCP vigente es `pretso-database` (cuenta `alberdi.andres@gmail.com`).
> Hubo otros proyectos PRETSO, hoy en `DELETE_REQUESTED`: no se usan.

Eres la sesión dedicada a terminar la instalación del estándar DevSecOps v2 en
`AndresAlberdi/PRETSO` y a dejar el pase a producción hecho por tubería y no a
mano. El estándar ya se instaló (PR #14 `108f8df` y #15 `cc57deb`, fusionados el
2026-09-21); no se rediscute ni el modo A, ni el pipeline elegido, ni el
manifiesto. Este prompt ejecuta lo que quedó pendiente.

## Lo primero: el hecho que cambia las prioridades

**PRETSO ya está sirviendo en https://pretso-database.web.app el mismo código que
hay en `main`.** Medido el 2026-09-25: el sitio entrega
`assets/index-C68C218d.js` y `assets/index-Cz5ny_2p.css`, exactamente los
artefactos que produce `npm run build` sobre `main`, con fecha de despliegue
2026-09-17; y las reglas de Firestore publicadas en el proyecto son idénticas,
carácter por carácter, a `firestore.rules` del repositorio.

Lo que falta **no es subir el sistema**: es que subirlo deje de depender de una
persona con credenciales en su máquina. Antes de tocar nada, confirma con Andres
qué significa «producción» en su frase, porque hay dos lecturas y llevan a
trabajos distintos:

**Andres lo definió el 2026-09-25:** «producción» significa **tener el sistema
arriba**, y eso ya se cumple sobre `pretso-database`. Pero dejó dicho que
**`pretso-prod` sigue siendo necesario** para tener un modelo robusto: es el
Bloque 5 de este prompt, con plazo propio, no un pendiente que se olvida.

## Tu primera tarea, antes que cualquier otra cosa

**Bajar las aprobaciones del ruleset de `main` y fusionar lo que está esperando.**
La sesión anterior no pudo hacerlo: su clasificador se lo bloqueó tres veces
seguidas (aprobar con la segunda cuenta un PR propio, editar el ruleset, y
concederse el permiso para editarlo), y la regla de permiso que Andres agregó a
su `settings.json` —`Bash(gh api -X PUT repos/AndresAlberdi/PRETSO/rulesets/*)`—
no surtió efecto en aquella sesión ya abierta. En una sesión nueva sí debería.

El motivo de fondo: el ruleset del estándar exige **una aprobación** y este
repositorio tiene **un solo dueño**. Nadie puede aprobar su propio PR, así que
hoy no se fusiona nada. Andres decidió el 2026-09-25 bajar las aprobaciones a 0
conservando PR obligatorio, `compuerta-pr`, historia lineal, squash y cero
bypass, y **anotarlo como desviación del estándar en `PILOTO.md`, con su
motivo**. Eso último es parte de la tarea, no un adorno.

El orden, y cada paso con su verificación real:
1. Ruleset `proteccion-main` (id 24019577) con
   `required_approving_review_count: 0`.
2. Fusionar **#21** (arreglo del despliegue y cabeceras), que ya tiene el CI
   entero en verde. Squash.
3. **Mirar el run de `main`**: `desplegar-staging` tiene que llegar a desplegar
   y `dast-y-humo` correr detrás. Comprobar que el sitio sigue sirviendo un
   bundle que coincide con el `npm run build` local. Si algo falla, se arregla
   antes de seguir.
4. Fusionar **#22** (`pretso-prod` como producción y `Prompts/`).
5. Fusionar los cinco de Dependabot (**#16 a #20**), poniendo sus ramas al día
   primero: el ruleset exige la rama actualizada. Cerrar **#12** y **#13**, que
   quedaron apuntando a la rama vieja `master` y no tienen ni un check.
6. Anotar la desviación en `PILOTO.md` y el resultado real de cada paso.

Andres autoriza en el chat; vos operás. Si un bloqueo del arnés vuelve a
frenarte, **informalo, no lo esquives**.

## Lo que ya quedó hecho el 2026-09-25 (no rehacerlo)
- **Federación WIF creada** en `pretso-database` con
  `setup-oidc-gcp.sh --sin-cloudrun`: pool `github`, provider con la condición
  `assertion.repository_owner == 'AndresAlberdi'`, SA `deploy-staging` con
  `firebasehosting.admin`, `firebaserules.admin`, `iam.serviceAccountUser`,
  `secretmanager.secretAccessor` y `serviceusage.apiKeysViewer`, y el binding
  `workloadIdentityUser` restringido a este repositorio.
- **Secretos** `GCP_WIF_PROVIDER` y `GCP_SA_DEPLOY_STAGING`, y **variables**
  `GCP_PROJECT_ID_STAGING`, `STAGING_URL`, `MODO` y `HEALTH_PATH` (en `/`).
- **Rulesets aplicados**: `proteccion-main` (PR obligatorio, `compuerta-pr`,
  historia lineal, sin bypass, squash) y `proteccion-tags` (los tags `v*` no se
  mueven ni se borran).
- **La autenticación del despliegue ya pasa.** El job `desplegar-staging` dejó
  de morir en `google-github-actions/auth` y ahora muere más adelante, en un
  defecto de la plantilla que la rama `fix/despliegue-corepack-y-cabeceras`
  corrige (ver Bloque 0).

## Qué leer primero, en este orden
1. `CLAUDE.md` entero.
2. `PILOTO.md` — el checklist que dejó la sesión que instaló el estándar; sus
   fases 1 a 4.5 son la fuente de lo que sigue pendiente.
3. `.devsecops.yml` — el manifiesto, y en particular el bloque `ambientes`.
4. `.github/workflows/ci-node-firebase.yml` — de dónde salen las variables y
   secretos que el pipeline espera.
5. Del estándar, en **solo lectura**, en `~/SeguridadGeneral`:
   `03-scripts/setup-oidc-gcp.sh`, `01-seguridad/02-identidad-federada-oidc.md`,
   `01-seguridad/03-hardening-por-nube.md` y `Prompts/actualizar-repo-al-estandar.md`.

## Las decisiones que no se tocan
1. **Modo A** (repositorio público), pipeline `ci-node-firebase.yml`, versión 2
   del estándar. No se cambia de pipeline ni de modo.
2. **Federación de identidad (WIF), nunca una clave de cuenta de servicio.** No
   se descarga ni se crea un `serviceAccountKey.json`, ni siquiera temporal.
3. **`pretso-database` es el proyecto vigente.** Los otros proyectos PRETSO
   están en borrado y no se resucitan.
4. **Andres autoriza; la sesión opera.** Nada se escribe en GitHub ni en GCP sin
   su «sí» en el chat, y no se le pasan comandos para que los corra.
5. **Ningún secreto en el repositorio ni en el chat.** Los valores que imprime el
   script de OIDC se cargan como secretos de GitHub sin mostrarlos.
6. **Identidades por variable de entorno.** Nunca `gh auth switch` ni
   `gcloud config set`: mutan estado compartido con otras sesiones abiertas.

## Reutilizar antes de escribir
Consulta `~/Claude-Proyectos/proyectos/` antes de construir nada; la ficha de
este proyecto es `pretso.md` y la del estándar, `seguridadgeneral.md`. Leer otro
proyecto está permitido **en solo lectura**, diciendo en el chat qué se leyó y
para qué, y sin traer su estado ni sus decisiones. Todo lo de identidad federada,
reglas de Firestore endurecidas y pase a producción ya está resuelto en
SeguridadGeneral: se usa su script y sus documentos, no se reinventan.

## Cómo trabajar
- Worktree y rama propios por bloque; un PR por bloque contra `main`. Nunca
  cambiar de rama en la carpeta principal ni `git add -A`. Los worktrees van en
  `.claude/worktrees/` dentro del proyecto, jamás al lado en `~/`.
- **Costo declarado por bloque** en la unidad que este proyecto mide: minutos de
  GitHub Actions y despliegues sobre `pretso-database`.
- **Cada bloque dice qué prueba lo cubre**, y se anota el **resultado real** (no
  el esperado) en `PILOTO.md`, marcando la fase que cierra.
- Al cerrar la jornada, `ESTADO.md` (hoy no existe: lo crea el bloque que
  primero lo necesite) y la ficha `~/Claude-Proyectos/proyectos/pretso.md` si
  cambió algo reutilizable.

## Qué construir, por bloques

### Bloque 0 — Cerrar el despliegue automático (lo único que bloquea)
Rama `fix/despliegue-corepack-y-cabeceras`, **ya commiteada en local, sin subir**.

Con WIF creado, el job `desplegar-staging` pasa la autenticación y muere en el
paso «Preparar el gestor de paquetes para el hook `predeploy`»: ejecuta
`corepack prepare --activate` sin condición, y corepack aborta con «The local
project doesn't feature a 'packageManager' field» porque este proyecto no
declara ese campo. El `firebase.json` de PRETSO **no tiene ningún hook
`predeploy`**, así que el paso no preparaba nada: solo tumbaba el despliegue.
El paso aparece dos veces; en producción fallaría **después** de la aprobación
del Environment.

La rama guarda el `corepack prepare` detrás de un `grep` del campo, y de paso
pone al día las cuatro cabeceras de versión (security 2.3→2.4; dast, codeql y
ci-node-firebase 2.0→2.1/2.2).

**Es un defecto de la plantilla del estándar, no de este repositorio.** Hay que
llevarlo a SeguridadGeneral —en la sesión de ese proyecto— para que no muerda a
los demás proyectos sin `packageManager`; NovuChat tampoco lo declara.

**Prueba:** el run de `main` tras la fusión termina con `desplegar-staging` y
`dast-y-humo` en verde, y el sitio sigue sirviendo un bundle que coincide con el
`npm run build` local.
**Costo:** un run completo (~10 min) y un despliegue a `pretso-database`.

### Bloque 1 — `requirements.txt` completo y fijado (1 hora)
Rama `fix/requirements-pinned`. Medido el 2026-09-25 en un venv limpio:

- **Falta `odfpy`.** Once scripts leen el `.ods` con
  `pd.read_excel(..., engine='odf')` y mueren con
  `ImportError: Import odfpy failed`. El archivo no está solo sin fijar: está
  incompleto, y fijar versiones sin agregar esta dependencia no arregla nada.
- **pandas 3.0.6 y numpy 2.5.3 son seguros**: se probaron `dropna`, `rename`,
  `replace` con regex y `drop`, todos con `inplace=True`, que es lo que usan los
  scripts, y funcionan.
- **`ODS_PATH` apunta a un archivo que no existe** (`~/Descargas/Hacia PRETSO rev
  AA 1.ods`); el `.ods` vive en `~/Documentos/PRETSO/`. Conviene leerlo de una
  variable de entorno con valor por omisión, no de una ruta absoluta de usuario.

**Prueba:** venv limpio, `pip install -r requirements.txt`, y un script de los
que leen el `.ods` corriendo de punta a punta contra el archivo real.
**Costo:** ninguno en Actions.

### Bloque 2 — Cabeceras de versión al día — **absorbido por el Bloque 0**
Las cuatro cabeceras viajan en la misma rama que el arreglo del despliegue: el
contenido de los seis workflows ya era idéntico byte a byte al estándar
`702f2da`, solo mentía la etiqueta (security 2.3→2.4; dast 2.0→2.1; codeql
2.0→2.1; ci-node-firebase 2.0→2.2, que además cambia).
**Prueba:** `diff` contra las plantillas del estándar, vacío salvo el arreglo de
corepack, que primero tiene que estar fusionado arriba.

### Bloque 3 — Gobierno del repositorio (los rulesets ya están; falta decidir el candado)
**Hecho el 2026-09-25:** `proteccion-main` y `proteccion-tags`, tal cual los
define el estándar.

**Lo que hay que resolver, y es urgente porque bloquea toda fusión:** el ruleset
del estándar exige **una aprobación** y `AndresAlberdi` es el único colaborador
del repositorio. Nadie puede aprobar su propio PR, así que hoy **ningún PR se
puede fusionar** (medido: PR #20 quedó en `REVIEW_REQUIRED`). Dos salidas, y
Andres elige:
- **Dar acceso de escritura a la segunda cuenta** y que apruebe con su «sí» por
  PR. Es lo que ya se hace en FirmasNoCualificadas y NovuChat, y mantiene el
  estándar intacto.
- **Bajar `required_approving_review_count` a 0** en este repositorio,
  conservando PR obligatorio y `compuerta-pr`. Es una desviación del estándar y
  hay que anotarla como tal, con su motivo, en `PILOTO.md`.

**Environments, pendiente:** `production` **con revisores**; `staging` **sin
revisores**, o cada fusión a `main` queda esperando una aprobación manual y el
despliegue automático deja de serlo.

**Prueba:** un PR que no pueda fusionarse sin `compuerta-pr`, y un push directo
a `main` que el ruleset rechace.
**Costo:** ninguno.

### Bloque 4 — Dependabot al día (1 hora)
Hay **30 alertas abiertas** (17 altas, 12 medias, 1 baja) y siete PR:

- #16, #17, #18, #19 y #20 tienen **el CI entero en verde**: se fusionan.
- #12 y #13 **no tienen ni un check**: quedaron apuntando a la rama vieja
  `master`. Se cierran y se deja que Dependabot los recree contra `main`.

**Prueba:** `npm test` y `npm run build` verdes después de cada fusión, y el
recuento de alertas bajando.
**Costo:** un run por PR.

### Bloque 5 — `pretso-prod`: la separación real de producción (arrancado el 2026-09-25)
Andres lo pidió ese día: hace falta para tener un modelo robusto. **Lo que ya
está hecho** (no rehacerlo):

- Proyecto de GCP **`pretso-prod`** creado, con Firebase agregado, base de
  Firestore en `nam5` (la misma región que staging) y sitio de Hosting
  `pretso-prod` → `https://pretso-prod.web.app`.
- **Federación WIF propia** en ese proyecto (`--ambiente prod --sin-cloudrun`):
  pool, provider condicionado al propietario del repositorio y SA
  `deploy-production` con los roles mínimos de Hosting y reglas.
- **Environment `production`** con **revisor obligatorio** (AndresAlberdi) y
  política de despliegue restringida a los tags `v*`. Sus secretos
  `GCP_WIF_PROVIDER` —el del proyecto nuevo, que tapa al del repositorio— y
  `GCP_SA_DEPLOY_PROD` viven **en el Environment**, no en el repositorio: ahí
  está la separación real.
- Variables `GCP_PROJECT_ID_PROD`, `PROD_URL`, `APROBADORES_PROD`,
  `WORKFLOW_PRODUCCION`, `TAG_FIRMADO_REQUERIDO`, `NODE_VERSION`,
  `FIREBASE_DEPLOY_ONLY`, `GHAS_ENABLED` y `CODEQL_LENGUAJES`.
- `.devsecops.yml` apuntando `production` a `pretso-prod`.

**Lo que falta, y es lo que no se hace de apuro:**
1. **Migrar los datos de Firestore** desde `pretso-database`. Hoy `pretso-prod`
   está **vacío**: desplegar ahí publicaría la aplicación sin corpus.
2. **Migrar o rehacer los usuarios de autenticación**, y asignar el claim de
   administrador en el proyecto nuevo.
3. **Emitir y restringir la apiKey web de producción** (referentes HTTP y APIs,
   como en el paso 4.5), y encender App Check primero en modo monitoreo.
4. Revisar `.firebaserc`, que declara `default: pretso-database`.
5. Recién entonces, el primer tag `vX.Y.Z`.

Mientras 1 y 2 no estén, **decirlo cada vez que se hable de un pase**: el tag
está a una aprobación de publicar una aplicación sin datos. Lo único que hoy lo
impide es el revisor del Environment.
**Prueba:** el checklist `01-seguridad/05-checklist-pase-a-produccion.md` del
estándar, con evidencia, y un despliegue de prueba al proyecto nuevo con datos
antes de mover a nadie.
**Costo:** un proyecto de GCP más, con su cuota y su facturación.

### Bloque 6 — Endurecimiento, ya sin bloquear a nadie (la misma semana)
Rama por tema. En orden de valor:

1. **Reglas de Firestore.** Las vigentes dan escritura a un correo escrito fijo
   en el archivo. `firestore.rules.propuesta` ya trae la versión con claim
   `admin`. Asignar el claim, **probar en el emulador**, y recién entonces
   reemplazar y desplegar.
2. **Cobertura real.** El proyecto **sí tiene pruebas** —15, en 4 archivos, que
   pasan en 1,1 s—; `COVERAGE_MIN` está en 0 porque falta `@vitest/coverage-v8`,
   no porque no haya qué medir. Instalarlo y subir el umbral.
3. **Cloud Functions en Node 22**; hoy declaran Node 20, en fin de soporte.
4. **Restringir la apiKey web y encender App Check** (paso 4.5 de `PILOTO.md`).
   App Check se enciende **primero en modo monitoreo** y solo se pasa a bloqueo
   cuando las métricas muestran tráfico legítimo; al revés se tumba la app.
5. **Ordenar la raíz**: unos quince scripts sueltos (`print_*.py`,
   `test_ods_*.py`, `fix_app.py`, `migrate_*.py`) conviven con el código de la
   aplicación. Moverlos a `scripts/` es cosmético, pero abarata todo lo demás.

## Lo que NO se construye ahora (y por qué)
- **`pretso-prod` de un día para otro.** Es necesario y tiene bloque propio (el
  5), pero exige migrar datos y usuarios: se hace con plazo, no de apuro.
  Mientras tanto, `production` y `staging` apuntan al mismo proyecto, y eso se
  dice en voz alta cada vez que se hable de un pase.
- **Un tag `vX.Y.Z` mientras `production` apunte a `pretso-database`.** El tag
  desplegaría «producción» sobre el mismo proyecto que staging: ceremonia sin
  separación. Los tags esperan al Bloque 5.
- **`npm audit fix --force`.** Rompe versiones mayores sin revisión; las
  actualizaciones entran por los PR de Dependabot, que el CI prueba.
- **Tocar SeguridadGeneral.** Si algo del estándar está mal, se anota y se
  arregla en la sesión de ese proyecto, nunca desde acá.

## Entregables al cerrar
- Un PR por bloque, con su costo declarado, su prueba y el **resultado real**.
- `PILOTO.md` con las fases cerradas marcadas y lo medido de verdad.
- `ESTADO.md` con la jornada.
- `~/Claude-Proyectos/proyectos/pretso.md` actualizada si cambió algo
  reutilizable.
