# PRETSO — Plataforma Académica

Plataforma digital para el estudio del teatro hispanoamericano de los siglos XVI–XVII.

## Arranque en desarrollo

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env             # editar variables según entorno
uvicorn src.main:app --reload --port 8080
```

La API queda disponible en `http://localhost:8080`. Documentación OpenAPI en `http://localhost:8080/docs`.

### Frontend (React + Vite)

```bash
cd frontend
npm install
npm run dev
```

La SPA queda disponible en `http://localhost:5173` y hace proxy de `/api` al backend en el puerto 8080.
