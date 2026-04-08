"""Endpoint público para el estado de lanzamiento del portal."""
from __future__ import annotations

from fastapi import APIRouter

from backend.src.services.launch_rule import get_portal_status

router = APIRouter(tags=["public-launch"])


@router.get("/launch-status")
async def launch_status():
    """Devuelve el estado actual del portal: published_count, threshold, portal_active."""
    return await get_portal_status()
