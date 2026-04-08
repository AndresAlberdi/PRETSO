"""Audit logging service — writes entries to the audit_log Firestore collection."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from backend.src.db.repositories import async_set_document
from backend.src.models.enums import AuditAction

AUDIT_LOG_COLLECTION = "audit_log"


async def log_operation(
    record_id: str,
    user_uid: str,
    action: AuditAction,
    details: dict,
) -> str:
    """Create an entry in audit_log and return its generated id.

    The entry is stored atomically; if the write fails the exception propagates
    to the caller so the enclosing operation can be rolled back or retried.
    """
    entry_id = f"log-{uuid.uuid4()}"
    timestamp = datetime.now(timezone.utc).isoformat()

    entry = {
        "id": entry_id,
        "record_id": record_id,
        "user_uid": user_uid,
        "action": action.value if isinstance(action, AuditAction) else action,
        "timestamp": timestamp,
        "details": details,
    }

    await async_set_document(AUDIT_LOG_COLLECTION, entry_id, entry)
    return entry_id
