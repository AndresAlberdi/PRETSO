# PRETSO (Plataforma de Registros Económicos y Teatrales del Siglo de Oro)

PRETSO es una aplicación web diseñada para la consulta, gestión y análisis de registros históricos relacionados con la actividad teatral y económica del Siglo de Oro. Proporciona una interfaz moderna y eficiente para interactuar con bases de datos documentales.

## Características Principales

- **Gestión Documental Completa**: Visualización e interrelación de registros sobre Compañías, Transacciones, Manejo de Caja, Salarios, Corpus Christi, Indicadores y Bibliografía.
- **Búsqueda guiada**: un solo campo de búsqueda con guía por niveles; dos palabras se tratan como frase exacta y se busca por la sigla de la compañía (reglas en [`estructura_datos.md`](./estructura_datos.md)).
- **Dataset XML**: la administración descarga un ZIP con un XML por unidad de registro y un README en español (`src/utils/dataset/`).
- **Interfaz Interactiva**: Tablas con ordenamiento dinámico (`useSortableTable`), tooltips explicativos y navegación ágil (SPA).
- **Seguridad y Accesos**:
  - Autenticación con Firebase Auth (acceso con Google).
  - Tres roles: **visitante** (sin sesión; solo lectura pública del corpus, `[[PENDIENTE: vigente cuando se fusionen las reglas y las rutas públicas del plan de lectura pública; hoy la aplicación exige sesión]]`), **lector** (claim `reader`, solo lectura) y **administración** (claim `admin`, lectura y escritura).
  - Las cuentas no son un rol: el rol lo da el claim de cada cuenta (véase `ARCHITECTURE.md`).
- **Despliegue Continuo**: GitHub Actions con pruebas (Vitest), análisis de seguridad (gitleaks, Semgrep, Trivy, CodeQL y otros) y publicación en Firebase Hosting: la fusión a `main` despliega a staging y un tag `vX.Y.Z` a producción, con aprobación humana.

## Tecnologías Utilizadas

- **Frontend**: React 19, TypeScript, Vite
- **Estilos**: CSS (Variables globales, diseño responsive, paleta de colores corporativa)
- **Backend (BaaS)**: Firebase (Firestore, Authentication, Cloud Functions, Hosting); una Cloud Function (`listAccounts`) para la lista de cuentas
- **Pruebas y Seguridad**: Vitest, jsdom
- **Control de Versiones**: Git / GitHub

## Requisitos Previos

Asegúrese de tener instalado en su entorno de desarrollo:
- [Node.js](https://nodejs.org/) (Versión 20 o superior recomendada para compatibilidad con Cloud Functions)
- [npm](https://www.npmjs.com/) (Gestor de paquetes de Node)
- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)

## Instalación y Ejecución Local

1. **Clonar el repositorio**:
   ```bash
   git clone git@github.com:AndresAlberdi/PRETSO.git
   cd PRETSO
   ```
   La URL cambiará cuando el repositorio se transfiera a la organización de la Universidad (véase `docs/traspaso/procedimiento-traspaso.md`).

2. **Instalar dependencias**:
   ```bash
   npm ci
   cd functions && npm ci
   ```

3. **Ejecutar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   La aplicación estará disponible localmente, generalmente en `http://localhost:5173`. App Check exige un token de depuración en desarrollo (`VITE_APPCHECK_DEBUG_TOKEN`, véase `.env.example` si existe; no se versiona). `[[PENDIENTE: .env.example no existe en el repositorio]]`

## Pruebas

El proyecto cuenta con una batería de pruebas automatizadas que verifican la integridad de las funciones utilitarias, reglas de seguridad de la base de datos y componentes clave (como `useSortableTable`).

Para ejecutar las pruebas:
```bash
npm run test
```

## Despliegue (Pipeline)

El despliegue lo hace el CI de GitHub Actions (`.github/workflows/ci-node-firebase.yml`), sin claves de larga duración (federación WIF):

- Una fusión a `main` (squash, desde una rama `feat/*`, `fix/*` o `chore/*`) despliega a **staging** (`pretso-database`).
- Un tag `vX.Y.Z` despliega a **producción** (`pretso-prod`) tras la aprobación humana del Environment `production`.
- `./deploy.sh staging` despliega a staging a mano (`--dry-run` muestra los comandos). El despliegue a producción no se hace desde un terminal.

Antes de abrir un PR: `npm run lint`, `npm test` y `npm run build`. Operación diaria: [`docs/operacion/runbook-operacion.md`](./docs/operacion/runbook-operacion.md); rollback: [`docs/produccion/runbook-rollback.md`](./docs/produccion/runbook-rollback.md).

## Enlaces Útiles

- **Entorno de staging**: [https://pretso-database.web.app/](https://pretso-database.web.app/). `[[PENDIENTE: URL de producción (pretso-prod.web.app) cuando salga el primer tag]]`
- **Traspaso a la Universidad**: [`docs/traspaso/acta-de-entrega.md`](./docs/traspaso/acta-de-entrega.md) y [`docs/traspaso/procedimiento-traspaso.md`](./docs/traspaso/procedimiento-traspaso.md).
- **Estructura de la Base de Datos**: Para conocer a detalle la estructura de las colecciones de Firestore, refiérase al archivo [`estructura_datos.md`](./estructura_datos.md).
- **Guía de Arquitectura**: Detalles técnicos sobre la organización del código en [`ARCHITECTURE.md`](./ARCHITECTURE.md).
- **Guía de Contribución**: Normas para desarrollo en [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Licencia

Todos los derechos reservados.
