"""Endpoints para restaurar versiones anteriores de registros."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from backend.src.api.auth import require_role
from backend.src.db.repositories import (
    async_get_document,
    async_set_document,
    AUDIT_LOG,
    RECORDS,
)
from backend.src.models.enums import AuditAction, UserRole
from backend.src.services.audit_service import log_operation

router = APIRouter(tags=["admin-rollback"])

@router.post("/records/{record_id}/rollback/{version_id}")
async def rollback_record(
    record_id: str,
    version_id: str,
    user: dict = Depends(require_role(UserRole.editor.value, UserRole.administrador.value)),
):
    """Restaura un registro a un estado anterior usando la versión del audit log."""
    # 1. Obtener el log de auditoría
    audit_entry = await async_get_document(AUDIT_LOG, version_id)
    if not audit_entry:
        raise HTTPException(status_code=404, detail={"code": "VERSION_NOT_FOUND", "message": f"La versión {version_id} no existe.", "field": None})
        
    if audit_entry.get("record_id") != record_id:
        raise HTTPException(status_code=400, detail={"code": "VERSION_MISMATCH", "message": "La versión no pertenece a este registro.", "field": None})
        
    previous_state = audit_entry.get("details", {}).get("previous_state")
    if not previous_state:
        raise HTTPException(status_code=422, detail={"code": "NO_PREVIOUS_STATE", "message": "Esta versión no contiene un estado completo para restaurar.", "field": None})
        
    # 2. Obtener el estado actual (para logearlo)
    current_state = await async_get_document(RECORDS, record_id)
    if not current_state:
        raise HTTPException(status_code=404, detail={"code": "RECORD_NOT_FOUND", "message": f"El registro {record_id} fue eliminado.", "field": None})
        
    # 3. Restaurar los datos
    now = datetime.now(timezone.utc).isoformat()
    restored_state = {**previous_state, "updated_at": now}
    
    await async_set_document(RECORDS, record_id, restored_state)
    
    # 4. Registrar la acción de rollback
    await log_operation(
        record_id=record_id,
        user_uid=user["uid"],
        action=AuditAction.modificacion, # We treat rollback as a modification
        details={"rollback_from": version_id, "previous_state": current_state},
    )
    
    return restored_state
