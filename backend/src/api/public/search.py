"""Endpoint público de búsqueda semántica."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query

from backend.src.services.search_service import search as search_service

router = APIRouter(tags=["public-search"])


@router.get("/search")
async def search(
    q: str = Query(..., min_length=1, description="Texto de búsqueda (obligatorio)"),
    city: Optional[str] = Query(None),
    year_from: Optional[int] = Query(None),
    year_to: Optional[int] = Query(None),
    source_table: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    """Búsqueda semántica sobre el corpus publicado."""
    result = await search_service(
        query=q,
        city=city,
        year_from=year_from,
        year_to=year_to,
        source_table=source_table,
        company=company,
        page=page,
        page_size=page_size,
    )
    return result
