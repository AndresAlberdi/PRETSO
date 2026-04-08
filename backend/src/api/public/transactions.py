"""Endpoints públicos para transacciones."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.src.db.repositories import get_transaction, query_collection, RECORDS

router = APIRouter(tags=["public-transactions"])


@router.get("/transactions/{transaction_id}")
async def get_transaction_detail(transaction_id: str):
    """Devuelve la transacción con todos sus registros vinculados (solo publicados)."""
    transaction = get_transaction(transaction_id)
    if transaction is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "RECORD_NOT_FOUND", "message": f"La transacción {transaction_id} no existe.", "field": None},
        )

    # Obtener solo los registros publicados vinculados a esta transacción
    published_records = query_collection(
        RECORDS,
        filters=[
            ("transaction_id", "==", transaction_id),
            ("status", "==", "publicado"),
        ],
        limit=1000,
    )

    return {
        **transaction,
        "records": published_records,
    }
