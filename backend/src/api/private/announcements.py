"""Endpoints privados para gestión de anuncios."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from backend.src.api.auth import get_current_user, require_role
from backend.src.db.repositories import (
    async_get_document,
    async_set_document,
    async_update_document,
    async_delete_document,
    ANNOUNCEMENTS,
)
from backend.src.models.announcement import AnnouncementCreate
from backend.src.models.enums import UserRole

router = APIRouter(tags=["admin-announcements"])


@router.post("/announcements", status_code=201)
async def create_announcement(
    body: AnnouncementCreate,
    user: dict = Depends(require_role(UserRole.editor.value, UserRole.administrador.value)),
):
    """Crear un nuevo anuncio."""
    short_uuid = uuid.uuid4().hex[:8]
    ann_id = f"ann-{short_uuid}"

    expires_at_iso = None
    if body.expires_at:
        expires_at_iso = body.expires_at.isoformat() if hasattr(body.expires_at, "isoformat") else body.expires_at

    data = {
        "id": ann_id,
        "created_by": user["uid"],
        **body.model_dump(),
        "published_at": body.published_at.isoformat() if hasattr(body.published_at, "isoformat") else body.published_at,
        "expires_at": expires_at_iso,
    }

    await async_set_document(ANNOUNCEMENTS, ann_id, data)
    return data


@router.put("/announcements/{ann_id}")
async def update_announcement(
    ann_id: str,
    body: AnnouncementCreate,
    user: dict = Depends(get_current_user),
):
    """Editar un anuncio. Editor: solo los propios. Administrador: cualquiera."""
    role = user.get("role")
    if role not in (UserRole.editor.value, UserRole.administrador.value):
        raise HTTPException(status_code=403, detail={"code": "INSUFFICIENT_PERMISSIONS", "message": "Se requiere rol editor o administrador.", "field": None})

    ann = await async_get_document(ANNOUNCEMENTS, ann_id)
    if ann is None:
        raise HTTPException(status_code=404, detail={"code": "RECORD_NOT_FOUND", "message": f"El anuncio {ann_id} no existe.", "field": None})

    if role == UserRole.editor.value and ann.get("created_by") != user["uid"]:
        raise HTTPException(status_code=403, detail={"code": "INSUFFICIENT_PERMISSIONS", "message": "Un editor solo puede editar sus propios anuncios.", "field": None})

    updates = body.model_dump()
    if hasattr(updates.get("published_at"), "isoformat"):
        updates["published_at"] = updates["published_at"].isoformat()
    if updates.get("expires_at") and hasattr(updates.get("expires_at"), "isoformat"):
        updates["expires_at"] = updates["expires_at"].isoformat()

    await async_update_document(ANNOUNCEMENTS, ann_id, updates)
    return {**ann, **updates}


@router.delete("/announcements/{ann_id}", status_code=204)
async def delete_announcement(
    ann_id: str,
    user: dict = Depends(get_current_user),
):
    """Eliminar un anuncio. Editor: solo los propios. Administrador: cualquiera."""
    role = user.get("role")
    if role not in (UserRole.editor.value, UserRole.administrador.value):
        raise HTTPException(status_code=403, detail={"code": "INSUFFICIENT_PERMISSIONS", "message": "Se requiere rol editor o administrador.", "field": None})

    ann = await async_get_document(ANNOUNCEMENTS, ann_id)
    if ann is None:
        raise HTTPException(status_code=404, detail={"code": "RECORD_NOT_FOUND", "message": f"El anuncio {ann_id} no existe.", "field": None})

    if role == UserRole.editor.value and ann.get("created_by") != user["uid"]:
        raise HTTPException(status_code=403, detail={"code": "INSUFFICIENT_PERMISSIONS", "message": "Un editor solo puede eliminar sus propios anuncios.", "field": None})

    await async_delete_document(ANNOUNCEMENTS, ann_id)
