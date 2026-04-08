FROM python:3.11-slim

WORKDIR /app

# Install dependencies first (layer cache)
COPY pyproject.toml ./
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir \
        fastapi \
        "uvicorn[standard]" \
        pydantic \
        google-cloud-firestore \
        firebase-admin \
        sentence-transformers \
        python-multipart \
        "python-jose[cryptography]" \
        httpx

# Copy source code
COPY src/ ./src/

EXPOSE 8080

# NOTE: sentence-transformers model is loaded lazily at first request,
# not at build time, to keep cold start fast.
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
