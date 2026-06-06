FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias (cacheadas por layer)
COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir \
        fastapi \
        "uvicorn[standard]" \
        "pydantic>=1.10,<3" \
        google-cloud-firestore \
        firebase-admin \
        sentence-transformers \
        python-multipart \
        "python-jose[cryptography]" \
        httpx \
        pytest-asyncio

# Copiar código fuente manteniendo la estructura de paquetes
COPY src/ ./src/

# Crear __init__.py en /app para que 'backend' sea importable como paquete
RUN mkdir -p /app/backend && \
    cp -r /app/src /app/backend/src && \
    touch /app/backend/__init__.py

# Añadir /app al PYTHONPATH para que 'backend.src.*' sea resolvible
ENV PYTHONPATH=/app

EXPOSE 8080

# Cloud Run inyecta PORT=8080; uvicorn lo lee explícitamente
CMD ["uvicorn", "backend.src.main:app", "--host", "0.0.0.0", "--port", "8080"]
