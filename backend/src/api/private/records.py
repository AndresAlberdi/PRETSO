"""Endpoints privados para gestión de registros maestros."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from backend.src.api.auth import get_current_user, require_role
from backend.src.db.repositories import (
    async_get_document,
    async_set_document,
    async_update_document,
    async_delete_document,
    get_transaction,
    set_transaction,
    add_record_to_transaction,
    remove_record_from_transaction,
    RECORDS,
    TRANSACTIONS,
)
from backend.src.models.enums import PublicationStatus, UserRole
from backend.src.models.record import RecordMaestroCreate, RecordMaestroUpdate
from backend.src.services.audit_service import log_operation
from backend.src.services.launch_rule import on_record_unpublished
from backend.src.services.publication_service import transition_status
from backend.src.models.enums import AuditAction

router = APIRouter(tags=["admin-records"])


class StatusChangeBody(BaseModel):
    new_status: str
    rejection_comment: Optional[str] = None


@router.post("/records", status_code=201)
async def create_record(
    body: RecordMaestroCreate,
    user: dict = Depends(require_role(UserRole.editor.value, UserRole.administrador.value)),
):
    """Crear un nuevo registro en estado borrador."""
    short_uuid = uuid.uuid4().hex[:8]
    record_id = f"{body.source_table.value}-{short_uuid}"

    now = datetime.now(timezone.utc).isoformat()

    # Crear Transaction si no existe
    transaction = get_transaction(body.transaction_id)
    if transaction is None:
        set_transaction(body.transaction_id, {
            "id": body.transaction_id,
            "record_ids": [],
            "created_at": now,
            "updated_at": now,
        })

    record_data = {
        "id": record_id,
        "status": PublicationStatus.borrador.value,
        "created_by": user["uid"],
        "created_at": now,
        "updated_at": now,
        **body.model_dump(exclude_none=True),
        "source_table": body.source_table.value,
    }

    await async_set_document(RECORDS, record_id, record_data)
    add_record_to_transaction(body.transaction_id, record_id)

    await log_operation(
        record_id=record_id,
        user_uid=user["uid"],
        action=AuditAction.creacion,
        details={"source_table": body.source_table.value, "transaction_id": body.transaction_id},
    )

    return record_data


@router.put("/records/{record_id}/status")
async def change_record_status(
    record_id: str,
    body: StatusChangeBody,
    user: dict = Depends(get_current_user),
):
    """Cambiar el estado de un registro según las reglas de transición."""
    try:
        new_status = PublicationStatus(body.new_status)
    except ValueError:
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_STATE_TRANSITION", "message": f"Estado inválido: {body.new_status}", "field": "new_status"},
        )

    # Verificar permisos según la transición
    role = user.get("role")
    if new_status == PublicationStatus.publicado:
        if role not in (UserRole.revisor.value, UserRole.administrador.value):
            raise HTTPException(status_code=403, detail={"code": "INSUFFICIENT_PERMISSIONS", "message": "Se requiere rol revisor o administrador para aprobar.", "field": None})
    elif new_status == PublicationStatus.en_revision:
        if role not in (UserRole.editor.value, UserRole.administrador.value):
            raise HTTPException(status_code=403, detail={"code": "INSUFFICIENT_PERMISSIONS", "message": "Se requiere rol editor o administrador para enviar a revisión.", "field": None})
    elif new_status in (PublicationStatus.borrador, PublicationStatus.rechazado):
        if role not in (UserRole.revisor.value, UserRole.administrador.value):
            raise HTTPException(status_code=403, detail={"code": "INSUFFICIENT_PERMISSIONS", "message": "Se requiere rol revisor o administrador para rechazar.", "field": None})

    updated = await transition_status(
        record_id=record_id,
        new_status=new_status,
        user_uid=user["uid"],
        rejection_comment=body.rejection_comment,
    )
    return updated


@router.put("/records/{record_id}")
async def update_record(
    record_id: str,
    body: RecordMaestroUpdate,
    user: dict = Depends(require_role(UserRole.editor.value, UserRole.administrador.value)),
):
    """Editar campos de un registro en estado borrador o en_revision."""
    record = await async_get_document(RECORDS, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail={"code": "RECORD_NOT_FOUND", "message": f"El registro {record_id} no existe.", "field": None})

    if record.get("status") == PublicationStatus.publicado.value:
        raise HTTPException(
            status_code=422,
            detail={"code": "INVALID_STATE_TRANSITION", "message": "No se puede editar un registro publicado.", "field": "status"},
        )

    now = datetime.now(timezone.utc).isoformat()
    updates = body.model_dump(exclude_none=True, exclude={"id"})
    updates["updated_at"] = now

    await async_update_document(RECORDS, record_id, updates)
    await log_operation(
        record_id=record_id,
        user_uid=user["uid"],
        action=AuditAction.modificacion,
        details={"fields": list(updates.keys()), "previous_state": record},
    )

    return {**record, **updates}


@router.delete("/records/{record_id}", status_code=204)
async def delete_record(
    record_id: str,
    x_confirm_delete: Optional[str] = Header(None, alias="X-Confirm-Delete"),
    user: dict = Depends(require_role(UserRole.administrador.value)),
):
    """Eliminar un registro (requiere header X-Confirm-Delete: true)."""
    if x_confirm_delete != "true":
        raise HTTPException(
            status_code=400,
            detail={"code": "MISSING_CONFIRMATION", "message": "Se requiere el header X-Confirm-Delete: true.", "field": None},
        )

    record = await async_get_document(RECORDS, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail={"code": "RECORD_NOT_FOUND", "message": f"El registro {record_id} no existe.", "field": None})

    was_published = record.get("status") == PublicationStatus.publicado.value
    transaction_id = record.get("transaction_id")

    await async_delete_document(RECORDS, record_id)

    if transaction_id:
        remove_record_from_transaction(transaction_id, record_id)

    await log_operation(
        record_id=record_id,
        user_uid=user["uid"],
        action=AuditAction.eliminacion,
        details={"status_at_deletion": record.get("status")},
    )

    if was_published:
        await on_record_unpublished()
