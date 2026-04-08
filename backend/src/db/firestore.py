import os
import time
import logging
from typing import Callable, TypeVar

import firebase_admin
from firebase_admin import credentials, firestore as firebase_firestore

logger = logging.getLogger(__name__)

_db = None
_app = None

T = TypeVar("T")


def _init_firebase() -> None:
    global _app
    if _app is not None:
        return
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    if cred_path:
        cred = credentials.Certificate(cred_path)
        _app = firebase_admin.initialize_app(cred)
    else:
        # Use Application Default Credentials
        _app = firebase_admin.initialize_app()


def get_db():
    """Return the Firestore client singleton."""
    global _db
    if _db is None:
        _init_firebase()
        _db = firebase_firestore.client()
    return _db


def with_retry(operation: Callable[[], T], max_attempts: int = 3) -> T:
    """Execute an operation with exponential backoff on transient errors."""
    delays = [1, 2, 4]
    last_exc: Exception | None = None
    for attempt in range(max_attempts):
        try:
            return operation()
        except Exception as exc:
            last_exc = exc
            if attempt < max_attempts - 1:
                delay = delays[attempt]
                logger.warning("Firestore transient error (attempt %d/%d): %s. Retrying in %ds.", attempt + 1, max_attempts, exc, delay)
                time.sleep(delay)
    raise last_exc  # type: ignore[misc]
