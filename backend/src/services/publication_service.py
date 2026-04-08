"""Publication workflow service — manages record state transitions."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException

from backend.src.db.repositories import (
    async_get_document,
    async_update_document,
    async_set_document,
    increment_published_count,
    RECORDS,
)
from backend.src.models.enums import AuditAction, PublicationStatus
from backend.src.services.audit_service import log_operation

VALID_TRANSITIONS: dict[PublicationStatus, set[PublicationStatus]] = {
    PublicationStatus.borrador: {PublicationStatus.en_revision},
    PublicationStatus.en_revision: {
        PublicationStatus.publicado,
        PublicationStatus.borrador,
    },
    PublicationStatus.publicado: set(),  # no direct transitions from published
}


async def transition_status(
    record_id: str,
    new_status: PublicationStatus,
    user_uid: str,
    rejection_comment: str | None = None,
) -> dict:
    """Transition a record to a new publication status.

    - Validates the transition is allowed.
    - If new_status == borrador (rejection), requires rejection_comment >= 10 chars.
    - Updates the record in Firestore.
    - Logs the operation in audit_log.
    - If new_status == publicado, calls increment_published_count(1).
    - If old_status == publicado and new_status != publicado, calls increment_published_count(-1).
    - Returns the updated record dict.
    """
    record = await async_get_document(RECORDS, record_id)
    if record is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "RECORD_NOT_FOUND", "message": f"El registro {record_id} no existe.", "field": None},
        )

    old_status = PublicationStatus(record["status"])

    if new_status not in VALID_TRANSITIONS.get(old_status, set()):
        raise HTTPException(
            status_code=422,
            detail={
                "code": "INVALID_STATE_TRANSITION",
                "message": f"La transición de '{old_status.value}' a '{new_status.value}' no está permitida.",
                "field": "status",
            },
        )

    # Rejection requires a comment of at least 10 characters
    if new_status == PublicationStatus.borrador:
        comment = rejection_comment or ""
        if len(comment) < 10:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "REJECTION_COMMENT_TOO_SHORT",
                    "message": "El comentario de rechazo debe tener al menos 10 caracteres.",
                    "field": "rejection_comment",
                },
            )

    now = datetime.now(timezone.utc).isoformat()
    updates: dict = {
        "status": new_status.value,
        "updated_at": now,
    }

    if new_status == PublicationStatus.publicado:
        updates["published_at"] = now

    if new_status == PublicationStatus.borrador and rejection_comment:
        updates["rejection_comment"] = rejection_comment

    await async_update_document(RECORDS, record_id, updates)

    # Adjust published_count counter
    if new_status == PublicationStatus.publicado:
        increment_published_count(1)
    elif old_status == PublicationStatus.publicado and new_status != PublicationStatus.publicado:
        increment_published_count(-1)

    # Audit log
    await log_operation(
        record_id=record_id,
        user_uid=user_uid,
        action=AuditAction.cambio_estado,
        details={"from": old_status.value, "to": new_status.value},
    )

    updated_record = {**record, **updates}
    return updated_record
