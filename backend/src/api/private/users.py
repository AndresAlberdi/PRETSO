"""Endpoints privados para gestión de usuarios."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.src.api.auth import require_role
from backend.src.db.repositories import (
    async_query_collection,
    async_update_document,
    USERS,
)
from backend.src.models.enums import UserRole

router = APIRouter(tags=["admin-users"])


class RoleUpdateBody(BaseModel):
    role: Optional[str] = None


@router.get("/users")
async def list_users(
    user: dict = Depends(require_role(UserRole.administrador.value)),
):
    """Listar todos los usuarios registrados."""
    users = await async_query_collection(USERS)
    return {"results": users, "total": len(users)}


@router.put("/users/{uid}/role")
async def update_user_role(
    uid: str,
    body: RoleUpdateBody,
    admin: dict = Depends(require_role(UserRole.administrador.value)),
):
    """Asignar o revocar el rol de un usuario en Firebase Auth y Firestore."""
    # Validar rol si se proporciona
    if body.role is not None:
        valid_roles = {r.value for r in UserRole}
        if body.role not in valid_roles:
            raise HTTPException(
                status_code=422,
                detail={"code": "MISSING_REQUIRED_FIELD", "message": f"Rol inválido: {body.role}. Valores válidos: {valid_roles}", "field": "role"},
            )

    # Actualizar custom_claim en Firebase Auth
    try:
        from firebase_admin import auth as firebase_auth
        new_claims = {"role": body.role} if body.role else {}
        firebase_auth.set_custom_user_claims(uid, new_claims)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail={"code": "FIREBASE_ERROR", "message": str(exc), "field": None},
        )

    # Actualizar en Firestore
    await async_update_document(USERS, uid, {"role": body.role, "panel_access": body.role is not None})

    return {"uid": uid, "role": body.role}
