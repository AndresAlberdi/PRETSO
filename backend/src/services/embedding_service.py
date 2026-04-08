"""Servicio de embeddings con carga lazy del modelo sentence-transformers."""
from __future__ import annotations

import asyncio
import logging
from functools import partial

logger = logging.getLogger(__name__)

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

# Variable global; se inicializa la primera vez que se llama generate_embedding()
_model = None


def _load_model():
    """Carga el modelo en el proceso actual (bloqueante, para ejecutar en executor)."""
    global _model
    if _model is not None:
        return _model

    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "La librería 'sentence-transformers' no está instalada. "
            "Instálala con: pip install sentence-transformers"
        ) from exc

    logger.info("Cargando modelo de embeddings '%s'…", MODEL_NAME)
    _model = SentenceTransformer(MODEL_NAME)
    logger.info("Modelo '%s' cargado correctamente.", MODEL_NAME)
    return _model


def preload_model() -> None:
    """Pre-carga el modelo de forma síncrona (llamar en el startup de FastAPI)."""
    _load_model()


async def generate_embedding(text: str) -> list[float]:
    """Genera el embedding de *text* sin bloquear el event loop.

    Carga el modelo de forma lazy la primera vez que se invoca.
    """
    loop = asyncio.get_event_loop()
    model = await loop.run_in_executor(None, _load_model)

    def _encode(t: str) -> list[float]:
        vector = model.encode(t, convert_to_numpy=True)
        return vector.tolist()

    return await loop.run_in_executor(None, partial(_encode, text))
