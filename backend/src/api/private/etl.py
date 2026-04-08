"""Endpoint privado para disparar el proceso ETL."""
from __future__ import annotations

from fastapi import APIRouter, Depends, File, Form, UploadFile

from backend.src.api.auth import require_role
from backend.src.models.enums import UserRole
from backend.src.services.etl_service import run_etl as etl_run

router = APIRouter(tags=["admin-etl"])


@router.post("/etl/run")
async def run_etl(
    file: UploadFile = File(...),
    source_table: str = Form(...),
    user: dict = Depends(require_role(UserRole.editor.value, UserRole.administrador.value)),
):
    """Disparar el proceso ETL con un archivo CSV."""
    content = await file.read()
    summary = await etl_run(content=content, source_table=source_table, user_uid=user["uid"])
    return summary
