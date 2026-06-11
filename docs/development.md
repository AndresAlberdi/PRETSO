# Guía de Desarrollo para PRETSO

Este documento explica cómo configurar el entorno de desarrollo local, la estructura del proyecto y los comandos comunes para el mantenimiento de la plataforma.

---

## 1. Requisitos Previos

Asegúrate de tener instalado en tu sistema de desarrollo:
* **Node.js** (v18 o superior) y **npm** (v9 o superior).
* **Python** (v3.11 o superior).
* **Git**.
* Acceso a un proyecto de Firebase (Firestore, Auth, Hosting).

---

## 2. Configuración del Entorno Local

Clona el repositorio e instala las dependencias de cada componente.

### A. Backend (Python + FastAPI)
1. Navega al directorio del backend:
   ```bash
   cd backend
   ```
2. Crea un entorno virtual y actívalo:
   ```bash
   python -m venv .venv
   source .venv/bin/activate        # En Windows: .venv\Scripts\activate
   ```
3. Instala las dependencias en modo editable junto con las herramientas de desarrollo:
   ```bash
   pip install -e ".[dev]"
   ```
4. Configura el archivo de variables de entorno `.env` copiándolo desde la plantilla:
   ```bash
   cp .env.example .env
   ```
   * *Nota: Edita el archivo `.env` resultante y completa las credenciales de Firebase/Firestore.*
5. Inicia el servidor de desarrollo:
   ```bash
   uvicorn src.main:app --reload --port 8080
   ```
   * El backend estará disponible en `http://localhost:8080`.
   * Los endpoints se pueden probar interactivamente en `http://localhost:8080/docs`.

### B. Frontend (React + Vite)
1. Navega al directorio del frontend:
   ```bash
   cd frontend
   ```
2. Instala las dependencias de Node:
   ```bash
   npm install
   ```
3. Inicia el servidor de desarrollo Vite:
   ```bash
   npm run dev
   ```
   * El cliente de frontend estará disponible en `http://localhost:5173`.
   * Las peticiones hacia la ruta `/api` se redirigen automáticamente al backend (puerto `8080`) según la configuración en `vite.config.ts`.

---

## 3. Pruebas y Validación de Calidad

### A. Pruebas del Backend (`pytest`)
El backend utiliza Pytest para pruebas unitarias, de integración y property-based testing (con la librería Hypothesis).

1. Activa tu entorno virtual del backend.
2. Corre todas las pruebas ejecutando desde el directorio raíz del proyecto:
   ```bash
   PYTHONPATH=. ./backend/.venv/bin/pytest backend/tests
   ```

### B. Validación de Tipado del Frontend (`tsc`)
El frontend utiliza TypeScript para mitigar errores en tiempo de ejecución.
1. Navega a `frontend/`.
2. Ejecuta el validador del compilador:
   ```bash
   npx tsc --noEmit
   ```

---

## 4. Estructura de Directorios

```text
PRETSO/
├── backend/
│   ├── src/
│   │   ├── api/          # Enrutadores HTTP de FastAPI (públicos y privados)
│   │   ├── db/           # Conectores y repositorios de Firestore
│   │   ├── models/       # Validadores de datos con Pydantic
│   │   └── services/     # Lógica de negocio (ETL, Búsqueda, Lanzamiento, etc.)
│   └── tests/            # Tests automatizados (pytest)
├── frontend/
│   ├── public/           # Recursos estáticos (logos, iconos)
│   ├── src/
│   │   ├── api/          # Clientes y tipos TypeScript
│   │   ├── components/   # Componentes React reutilizables
│   │   ├── i18n/         # Archivos de traducción (es.json, en.json)
│   │   ├── pages/        # Vistas de React (públicas y de administración)
│   │   └── main.tsx      # Punto de entrada de la aplicación
│   └── package.json
├── docs/                 # Documentación técnica del proyecto
└── README.md             # Guía rápida de arranque
```
