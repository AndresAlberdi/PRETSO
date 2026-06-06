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


class UserCreateBody(BaseModel):
    email: str
    password: str
    name: str
    institution: str
    phone: Optional[str] = None
    role: Optional[str] = None


@router.post("/users", status_code=201)
async def create_user(
    body: UserCreateBody,
    admin: dict = Depends(require_role(UserRole.administrador.value)),
):
    """Permite al administrador crear un nuevo usuario en Firebase Auth y Firestore."""
    from firebase_admin import auth as firebase_auth
    from datetime import datetime, timezone
    from backend.src.db.repositories import async_set_document

    # 1. Crear usuario en Firebase Auth
    try:
        firebase_user = firebase_auth.create_user(
            email=body.email,
            password=body.password,
            display_name=body.name,
        )
        uid = firebase_user.uid
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail={"code": "FIREBASE_ERROR", "message": str(exc), "field": "email"},
        )

    # 2. Configurar claims si hay rol
    if body.role:
        valid_roles = {r.value for r in UserRole}
        if body.role not in valid_roles:
            try:
                firebase_auth.delete_user(uid)
            except Exception:
                pass
            raise HTTPException(
                status_code=422,
                detail={"code": "INVALID_ROLE", "message": f"Rol inválido: {body.role}. Valores válidos: {valid_roles}", "field": "role"},
            )
        try:
            firebase_auth.set_custom_user_claims(uid, {"role": body.role})
        except Exception as exc:
            try:
                firebase_auth.delete_user(uid)
            except Exception:
                pass
            raise HTTPException(
                status_code=500,
                detail={"code": "FIREBASE_ERROR", "message": str(exc), "field": None},
            )

    # 3. Guardar en Firestore
    profile_data = {
        "uid": uid,
        "email": body.email,
        "name": body.name,
        "institution": body.institution,
        "phone": body.phone or "",
        "role": body.role,
        "panel_access": body.role is not None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await async_set_document(USERS, uid, profile_data)
    return profile_data


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
