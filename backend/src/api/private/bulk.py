"""Endpoints para operaciones masivas (Bulk)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from backend.src.api.auth import get_current_user, require_role
from backend.src.db.repositories import (
    async_batch_set_documents,
    async_get_document,
    async_query_collection,
    get_transaction,
    set_transaction,
    async_add_records_to_transaction,
    RECORDS,
)
from backend.src.models.enums import PublicationStatus, UserRole
from backend.src.models.record import RecordMaestroCreate
from backend.src.services.audit_service import log_operation
from backend.src.models.enums import AuditAction

router = APIRouter(tags=["admin-bulk"])

class BulkImportRequest(BaseModel):
    records: List[RecordMaestroCreate] = Field(..., max_length=100, min_length=1)

@router.post("/bulk/records", status_code=201)
async def bulk_import_records(
    body: BulkImportRequest,
    user: dict = Depends(require_role(UserRole.editor.value, UserRole.administrador.value)),
):
    """Importación masiva de hasta 100 registros. Entran en estado en_revision."""
    now = datetime.now(timezone.utc).isoformat()
    
    # We group by transaction_id to ensure transactions exist
    transaction_ids = {r.transaction_id for r in body.records}
    for t_id in transaction_ids:
        # Get synchronously or create
        t = get_transaction(t_id)
        if not t:
            set_transaction(t_id, {
                "id": t_id,
                "record_ids": [],
                "created_at": now,
                "updated_at": now,
            })
            
    documents_to_set = []
    audit_logs_to_set = []
    records_per_transaction = {t_id: [] for t_id in transaction_ids}
    
    for record_create in body.records:
        short_uuid = uuid.uuid4().hex[:8]
        record_id = f"{record_create.source_table.value}-{short_uuid}"
        
        record_data = {
            "id": record_id,
            "status": PublicationStatus.en_revision.value, # Status pending review
            "created_by": user["uid"],
            "created_at": now,
            "updated_at": now,
            **record_create.model_dump(exclude_none=True),
            "source_table": record_create.source_table.value,
        }
        
        documents_to_set.append((record_id, record_data))
        records_per_transaction[record_create.transaction_id].append(record_id)
        
        # Prepare audit log
        audit_id = f"audit-{uuid.uuid4().hex}"
        audit_logs_to_set.append((audit_id, {
            "id": audit_id,
            "record_id": record_id,
            "user_uid": user["uid"],
            "action": AuditAction.creacion.value,
            "timestamp": now,
            "details": {"source_table": record_create.source_table.value, "transaction_id": record_create.transaction_id, "bulk": True},
        }))
        
    # Execute batch
    await async_batch_set_documents(RECORDS, documents_to_set)
    from backend.src.db.repositories import AUDIT_LOG
    await async_batch_set_documents(AUDIT_LOG, audit_logs_to_set)
    
    # Update transactions
    for t_id, r_ids in records_per_transaction.items():
        if r_ids:
            await async_add_records_to_transaction(t_id, r_ids)
            
    return {"message": f"{len(body.records)} registros importados exitosamente.", "count": len(body.records)}

@router.post("/bulk/approve_all", status_code=200)
async def approve_all_records(
    user: dict = Depends(require_role(UserRole.revisor.value, UserRole.administrador.value)),
):
    """Aprueba todos los registros que estén en estado en_revision."""
    # Find all records in_revision
    records = await async_query_collection(RECORDS, filters=[("status", "==", PublicationStatus.en_revision.value)])
    
    if not records:
        return {"message": "No hay registros pendientes de revisión.", "count": 0}
        
    now = datetime.now(timezone.utc).isoformat()
    documents_to_set = []
    audit_logs_to_set = []
    
    for r in records:
        record_id = r["id"]
        updates = r.copy()
        updates["status"] = PublicationStatus.publicado.value
        updates["updated_at"] = now
        updates["published_at"] = now
        
        documents_to_set.append((record_id, updates))
        
        audit_id = f"audit-{uuid.uuid4().hex}"
        audit_logs_to_set.append((audit_id, {
            "id": audit_id,
            "record_id": record_id,
            "user_uid": user["uid"],
            "action": AuditAction.cambio_estado.value,
            "timestamp": now,
            "details": {"from": PublicationStatus.en_revision.value, "to": PublicationStatus.publicado.value, "bulk": True},
        }))
        
    # Batch update
    await async_batch_set_documents(RECORDS, documents_to_set)
    from backend.src.db.repositories import AUDIT_LOG
    await async_batch_set_documents(AUDIT_LOG, audit_logs_to_set)
    
    # Adjust published count
    from backend.src.db.repositories import increment_published_count
    increment_published_count(len(records))
    
    return {"message": f"{len(records)} registros aprobados exitosamente.", "count": len(records)}
