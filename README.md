# PRETSO (Plataforma de Registros Económicos y Teatrales del Siglo de Oro)

PRETSO es una aplicación web diseñada para la consulta, gestión y análisis de registros históricos relacionados con la actividad teatral y económica del Siglo de Oro. Proporciona una interfaz moderna y eficiente para interactuar con bases de datos documentales.

## Características Principales

- **Gestión Documental Completa**: Visualización e interrelación de registros sobre Compañías, Transacciones, Manejo de Caja, Salarios, Corpus Christi, e Indicadores.
- **Búsquedas Avanzadas**: Sistema de filtrado de datos multi-factor y búsqueda por similitud en todas las vistas principales.
- **Interfaz Interactiva**: Tablas con ordenamiento dinámico (`useSortableTable`), tooltips explicativos y navegación ágil (SPA).
- **Seguridad y Accesos**:
  - Autenticación segura mediante Firebase Auth.
  - Rol de Administración (Lectura y Escritura).
  - Rol de Lector (`lector@pretso.com`) para consulta exclusiva sin permisos de modificación.
- **Despliegue Continuo**: Pipeline automatizado que incluye pruebas locales (Vitest), análisis de seguridad (Snyk) y publicación a Firebase Hosting.

## Tecnologías Utilizadas

- **Frontend**: React 18, TypeScript, Vite
- **Estilos**: CSS (Variables globales, diseño responsive, paleta de colores corporativa)
- **Backend (BaaS)**: Firebase (Firestore, Authentication, Cloud Functions, Hosting)
- **Pruebas y Seguridad**: Vitest, jsdom, Snyk
- **Control de Versiones**: Git / GitHub

## Requisitos Previos

Asegúrese de tener instalado en su entorno de desarrollo:
- [Node.js](https://nodejs.org/) (Versión 20 o superior recomendada para compatibilidad con Cloud Functions)
- [npm](https://www.npmjs.com/) (Gestor de paquetes de Node)
- [Firebase CLI](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`)

## Instalación y Ejecución Local

1. **Clonar el repositorio**:
   ```bash
   git clone https://github.com/AndresAlberdi/PRETSO.git
   cd PRETSO
   ```

2. **Instalar dependencias**:
   ```bash
   npm install
   ```

3. **Ejecutar el servidor de desarrollo**:
   ```bash
   npm run dev
   ```
   La aplicación estará disponible localmente, generalmente en `http://localhost:5173`.

## Pruebas

El proyecto cuenta con una batería de pruebas automatizadas que verifican la integridad de las funciones utilitarias, reglas de seguridad de la base de datos y componentes clave (como `useSortableTable`).

Para ejecutar las pruebas:
```bash
npm run test
```

## Despliegue (Pipeline)

El despliegue está automatizado mediante el script `deploy.sh`. Este comando ejecutará las pruebas locales, buscará vulnerabilidades mediante Snyk, compilará la aplicación y finalmente la publicará en Firebase, haciendo push de los cambios al repositorio en master.

```bash
npm run deploy
```

## Enlaces Útiles

- **Entorno de Producción**: [https://pretso-database.web.app/](https://pretso-database.web.app/)
- **Estructura de la Base de Datos**: Para conocer a detalle la estructura de las colecciones de Firestore, refiérase al archivo [`estructura_datos.md`](./estructura_datos.md).
- **Guía de Arquitectura**: Detalles técnicos sobre la organización del código en [`ARCHITECTURE.md`](./ARCHITECTURE.md).
- **Guía de Contribución**: Normas para desarrollo en [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Licencia

Todos los derechos reservados.
