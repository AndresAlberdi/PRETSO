import os
import time
from collections import defaultdict
from threading import Lock

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRouter

# ---------------------------------------------------------------------------
# Aplicación FastAPI
# ---------------------------------------------------------------------------

app = FastAPI(title="PRETSO Academic Platform API", version="0.1.0")

# CORS
allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_raw.split(",")] if allowed_origins_raw != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Rate limiting — contador en memoria por IP, 60 req/min
# ---------------------------------------------------------------------------

_rate_lock = Lock()
_rate_counters: dict[str, list[float]] = defaultdict(list)
_RATE_LIMIT = 60
_RATE_WINDOW = 60.0  # segundos


@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()

    with _rate_lock:
        timestamps = _rate_counters[ip]
        # Eliminar timestamps fuera de la ventana
        _rate_counters[ip] = [t for t in timestamps if now - t < _RATE_WINDOW]
        if len(_rate_counters[ip]) >= _RATE_LIMIT:
            return JSONResponse(
                status_code=429,
                content={"error": {"code": "RATE_LIMIT_EXCEEDED", "message": "Has superado el límite de 60 peticiones por minuto.", "field": None}},
            )
        _rate_counters[ip].append(now)

    return await call_next(request)


# ---------------------------------------------------------------------------
# Middleware de portal inactivo (Regla de Lanzamiento Cero)
# ---------------------------------------------------------------------------

_PORTAL_EXEMPT_PREFIXES = (
    "/api/v1/admin/",
    "/api/v1/health",
    "/api/v1/launch-status",
    "/api/v1/announcements",
    "/docs",
    "/openapi.json",
    "/redoc",
)


@app.middleware("http")
async def portal_inactive_middleware(request: Request, call_next):
    path = request.url.path
    if path.startswith("/api/v1/") and not any(path.startswith(p) for p in _PORTAL_EXEMPT_PREFIXES):
        from backend.src.services.launch_rule import is_portal_active
        active = await is_portal_active()
        if not active:
            return JSONResponse(
                status_code=503,
                content={"error": {"code": "PORTAL_INACTIVE", "message": "El portal aún no está activo. Se requieren al menos 20 registros publicados.", "field": None}},
            )
    return await call_next(request)


# ---------------------------------------------------------------------------
# Middleware de solo lectura en rutas públicas
# ---------------------------------------------------------------------------

@app.middleware("http")
async def readonly_api_middleware(request: Request, call_next):
    """Rechaza métodos distintos de GET/OPTIONS en rutas públicas."""
    path = request.url.path
    method = request.method.upper()
    if (
        path.startswith("/api/v1/")
        and not path.startswith("/api/v1/admin/")
        and method not in ("GET", "OPTIONS")
    ):
        return JSONResponse(
            status_code=405,
            content={"error": {"code": "METHOD_NOT_ALLOWED", "message": "Method not allowed on public API.", "field": None}},
        )
    return await call_next(request)


# ---------------------------------------------------------------------------
# Startup: precargar modelo de embeddings
# ---------------------------------------------------------------------------

@app.on_event("startup")
async def startup_event():
    import asyncio
    from backend.src.services.embedding_service import preload_model
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, preload_model)


# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

api_router = APIRouter(prefix="/api/v1")


@api_router.get("/health")
async def health_check():
    return {"status": "ok"}


# Públicos
from backend.src.api.public.records import router as pub_records_router
from backend.src.api.public.transactions import router as pub_transactions_router
from backend.src.api.public.companies import router as pub_companies_router
from backend.src.api.public.search import router as pub_search_router
from backend.src.api.public.announcements import router as pub_announcements_router
from backend.src.api.public.launch import router as pub_launch_router

api_router.include_router(pub_records_router)
api_router.include_router(pub_transactions_router)
api_router.include_router(pub_companies_router)
api_router.include_router(pub_search_router)
api_router.include_router(pub_announcements_router)
api_router.include_router(pub_launch_router)

# Privados (admin)
from backend.src.api.private.records import router as priv_records_router
from backend.src.api.private.announcements import router as priv_announcements_router
from backend.src.api.private.users import router as priv_users_router
from backend.src.api.private.etl import router as priv_etl_router

admin_router = APIRouter(prefix="/admin")
admin_router.include_router(priv_records_router)
admin_router.include_router(priv_announcements_router)
admin_router.include_router(priv_users_router)
admin_router.include_router(priv_etl_router)

api_router.include_router(admin_router)

app.include_router(api_router)
