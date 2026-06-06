"""Launch rule service — manages the Zero Launch Rule (Regla de Lanzamiento Cero)."""
from __future__ import annotations

import asyncio
import os

from backend.src.db.repositories import (
    get_launch_rule,
    update_launch_rule,
    increment_published_count,
)

LAUNCH_THRESHOLD: int = int(os.environ.get("LAUNCH_THRESHOLD", 10))


async def _run_sync(fn, *args, **kwargs):
    """Run a synchronous repository call in a thread pool executor."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))


async def get_portal_status() -> dict:
    """Return the current launch rule state: {published_count, threshold, portal_active}."""
    rule = await _run_sync(get_launch_rule)
    return {
        "published_count": rule.get("published_count", 0),
        "threshold": rule.get("threshold", LAUNCH_THRESHOLD),
        "portal_active": rule.get("portal_active", False),
    }


async def is_portal_active() -> bool:
    """Return True if the portal is active (published_count >= threshold)."""
    status = await get_portal_status()
    return status["portal_active"]


async def on_record_published() -> dict:
    """Called when a record transitions to 'publicado'.

    Increments published_count and updates portal_active.
    Returns the updated launch rule dict.
    """
    new_count = await _run_sync(increment_published_count, 1)
    rule = await _run_sync(get_launch_rule)
    return {
        "published_count": rule.get("published_count", new_count),
        "threshold": rule.get("threshold", LAUNCH_THRESHOLD),
        "portal_active": rule.get("portal_active", False),
    }


async def on_record_unpublished() -> dict:
    """Called when a published record is deleted or moved back from 'publicado'.

    Decrements published_count and updates portal_active.
    If portal_active goes from True to False, logs a warning.
    Returns the updated launch rule dict.
    """
    # Capture state before decrement to detect deactivation
    before = await _run_sync(get_launch_rule)
    was_active = before.get("portal_active", False)

    await _run_sync(increment_published_count, -1)

    rule = await _run_sync(get_launch_rule)
    is_active_now = rule.get("portal_active", False)

    if was_active and not is_active_now:
        print(
            "[WARNING] Portal desactivado: el número de registros publicados ha caído "
            f"por debajo del umbral ({rule.get('threshold', LAUNCH_THRESHOLD)})."
        )

    return {
        "published_count": rule.get("published_count", 0),
        "threshold": rule.get("threshold", LAUNCH_THRESHOLD),
        "portal_active": is_active_now,
    }
