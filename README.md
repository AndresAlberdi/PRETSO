# PRETSO — Plataforma Académica

Plataforma digital para el estudio de la actividad comercial y dinámicas económicas del teatro hispanoamericano de los siglos XVI y XVII (Proyecto THIS).

PRETSO recopila, consolida y permite buscar y analizar datos económicos (precios de licencias, transacciones de taquillas, arriendos de teatros y salarios de comediantes) a partir de transcripciones históricas y documentos paleográficos.

---

## 🚀 Inicio Rápido en Desarrollo

El proyecto está estructurado como un monorepositorio con el código del backend en Python y el frontend en React + TypeScript.

### 1. Backend (FastAPI)
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env             # edita las credenciales según tu entorno
uvicorn src.main:app --reload --port 8080
```
* **API local**: `http://localhost:8080`
* **Swagger OpenAPI**: `http://localhost:8080/docs`

### 2. Frontend (React + Vite + TypeScript)
```bash
cd frontend
npm install
npm run dev
```
* **Cliente local**: `http://localhost:5173` (con proxy automático de peticiones `/api` al backend en el puerto `8080`).

---

## 📚 Documentación Técnica Detallada

Para obtener más información sobre el diseño del sistema, consulta los siguientes documentos de la carpeta `docs/`:

1. **[Arquitectura del Sistema](docs/architecture.md)**: Vista general del flujo de componentes (Mermaid), Single Page Application, API REST y servicios clave.
2. **[Estructura y Esquemas de Base de Datos](docs/database.md)**: Mapeo de colecciones de Google Cloud Firestore, esquemas de datos de registros maestros con Pydantic y reglas de seguridad de Firestore.
3. **[Referencia de la API REST](docs/api.md)**: Detalle de los endpoints públicos de consulta y búsqueda, y endpoints privados para el flujo de aprobación y ETL.
4. **[Guía del Desarrollador](docs/development.md)**: Requisitos, configuración detallada del entorno, comandos útiles para pruebas de código y estructura de archivos.
5. **[Guía de Despliegue en Producción](docs/deployment.md)**: Configuración e instrucciones para publicar el frontend en Firebase Hosting y el backend en Google Cloud Run.
