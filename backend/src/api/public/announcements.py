"""Endpoint público para el tablón de anuncios."""
from __future__ import annotations

import math

from fastapi import APIRouter, Query

from backend.src.db.repositories import query_collection, ANNOUNCEMENTS

router = APIRouter(tags=["public-announcements"])


@router.get("/announcements")
async def list_announcements(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    """Listado de anuncios ordenado por published_at descendente."""
    all_announcements = query_collection(
        ANNOUNCEMENTS,
        order_by="published_at",
        limit=10_000,
        offset=0,
    )
    # Ordenar descendente (Firestore solo soporta un orden; invertimos en memoria)
    all_announcements.sort(key=lambda a: a.get("published_at", ""), reverse=True)

    total = len(all_announcements)
    offset = (page - 1) * page_size
    results = all_announcements[offset: offset + page_size]
    total_pages = math.ceil(total / page_size) if page_size > 0 else 0

    return {
        "results": results,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }
