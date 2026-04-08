"""Endpoints públicos para registros maestros."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from backend.src.db.repositories import get_record, query_records

router = APIRouter(tags=["public-records"])


@router.get("/records")
async def list_records(
    city: Optional[str] = Query(None),
    year_from: Optional[int] = Query(None),
    year_to: Optional[int] = Query(None),
    source_table: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    """Listado paginado de registros publicados con filtros opcionales."""
    records, total = query_records(
        status="publicado",
        city=city,
        year_from=year_from,
        year_to=year_to,
        source_table=source_table,
        compania_id=company,
        page=page,
        page_size=page_size,
    )
    import math
    total_pages = math.ceil(total / page_size) if page_size > 0 else 0
    return {
        "results": records,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/records/{record_id}")
async def get_record_detail(record_id: str):
    """Detalle completo de un registro publicado."""
    record = get_record(record_id)
    if record is None or record.get("status") != "publicado":
        raise HTTPException(
            status_code=404,
            detail={"code": "RECORD_NOT_FOUND", "message": f"El registro {record_id} no existe o no está publicado.", "field": None},
        )
    return record
