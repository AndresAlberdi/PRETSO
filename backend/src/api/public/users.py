"""Endpoints públicos para usuarios."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.src.api.auth import get_current_user
from backend.src.db.repositories import async_set_document, USERS

router = APIRouter(tags=["public-users"])


class ProfileCreateBody(BaseModel):
    name: str
    institution: str
    phone: Optional[str] = None


@router.post("/users/profile", status_code=201)
async def create_user_profile(
    body: ProfileCreateBody,
    user: dict = Depends(get_current_user),
):
    """Guardar o actualizar el perfil público del usuario registrado."""
    uid = user["uid"]
    email = user["email"]

    profile_data = {
        "uid": uid,
        "email": email,
        "name": body.name,
        "institution": body.institution,
        "phone": body.phone or "",
        "role": None,
        "panel_access": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await async_set_document(USERS, uid, profile_data)
    return profile_data
