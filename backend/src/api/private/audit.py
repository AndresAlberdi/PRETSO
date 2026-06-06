from fastapi import APIRouter, Depends
from backend.src.api.auth import get_current_user
from backend.src.db.repositories import async_query_collection
from backend.src.services.audit_service import AUDIT_LOG_COLLECTION

router = APIRouter(tags=["admin-audit"])

@router.get("/admin/records/{record_id}/audit")
async def get_audit_logs(
    record_id: str,
    user: dict = Depends(get_current_user),
):
    """Devuelve el historial de cambios (auditoría) de un registro específico."""
    logs = await async_query_collection(
        AUDIT_LOG_COLLECTION,
        filters=[("record_id", "==", record_id)],
        limit=100
    )
    # Sort in python to avoid composite index requirement
    logs.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return {"results": logs}
