"""Endpoints públicos para compañías."""
from __future__ import annotations

import math
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from backend.src.db.repositories import (
    get_document,
    query_collection,
    count_collection,
    COMPANIES,
)

router = APIRouter(tags=["public-companies"])


@router.get("/companies")
async def list_companies(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
):
    """Listado paginado de compañías."""
    offset = (page - 1) * page_size
    all_companies = query_collection(COMPANIES, limit=10_000, offset=0)
    total = len(all_companies)
    results = all_companies[offset: offset + page_size]
    total_pages = math.ceil(total / page_size) if page_size > 0 else 0
    return {
        "results": results,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


@router.get("/companies/{company_id}")
async def get_company_detail(company_id: str):
    """Detalle de una compañía con sus transaction_ids."""
    company = get_document(COMPANIES, company_id)
    if company is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "RECORD_NOT_FOUND", "message": f"La compañía {company_id} no existe.", "field": None},
        )
    return company
