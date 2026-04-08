"""Unit tests for publication_service with mocked Firestore."""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi import HTTPException

from backend.src.models.enums import PublicationStatus
from backend.src.services.publication_service import transition_status


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _make_record(status: str) -> dict:
    return {
        "id": "CM-1",
        "transaction_id": "Tra-1",
        "source_table": "CM",
        "status": status,
        "city": "Sevilla",
        "year": 1600,
        "noticia": "Pago",
        "fuente_bibliografica": "AGI",
        "created_at": _now_iso(),
        "updated_at": _now_iso(),
    }


# Patch targets
_GET = "backend.src.services.publication_service.async_get_document"
_UPDATE = "backend.src.services.publication_service.async_update_document"
_INC = "backend.src.services.publication_service.increment_published_count"
_LOG = "backend.src.services.publication_service.log_operation"


@pytest.mark.asyncio
async def test_borrador_to_en_revision():
    record = _make_record("borrador")
    with (
        patch(_GET, new=AsyncMock(return_value=record)),
        patch(_UPDATE, new=AsyncMock()),
        patch(_INC),
        patch(_LOG, new=AsyncMock()),
    ):
        result = await transition_status("CM-1", PublicationStatus.en_revision, "user1")
    assert result["status"] == "en_revision"


@pytest.mark.asyncio
async def test_en_revision_to_publicado_increments_count():
    record = _make_record("en_revision")
    mock_inc = MagicMock(return_value=1)
    with (
        patch(_GET, new=AsyncMock(return_value=record)),
        patch(_UPDATE, new=AsyncMock()),
        patch(_INC, mock_inc),
        patch(_LOG, new=AsyncMock()),
    ):
        result = await transition_status("CM-1", PublicationStatus.publicado, "user1")
    assert result["status"] == "publicado"
    mock_inc.assert_called_once_with(1)


@pytest.mark.asyncio
async def test_en_revision_to_borrador_with_comment():
    record = _make_record("en_revision")
    with (
        patch(_GET, new=AsyncMock(return_value=record)),
        patch(_UPDATE, new=AsyncMock()),
        patch(_INC),
        patch(_LOG, new=AsyncMock()),
    ):
        result = await transition_status(
            "CM-1", PublicationStatus.borrador, "user1",
            rejection_comment="Falta información importante"
        )
    assert result["status"] == "borrador"


@pytest.mark.asyncio
async def test_invalid_transition_borrador_to_publicado():
    record = _make_record("borrador")
    with (
        patch(_GET, new=AsyncMock(return_value=record)),
        patch(_UPDATE, new=AsyncMock()),
        patch(_INC),
        patch(_LOG, new=AsyncMock()),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await transition_status("CM-1", PublicationStatus.publicado, "user1")
    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "INVALID_STATE_TRANSITION"


@pytest.mark.asyncio
async def test_invalid_transition_publicado_to_borrador():
    record = _make_record("publicado")
    with (
        patch(_GET, new=AsyncMock(return_value=record)),
        patch(_UPDATE, new=AsyncMock()),
        patch(_INC),
        patch(_LOG, new=AsyncMock()),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await transition_status("CM-1", PublicationStatus.borrador, "user1",
                                    rejection_comment="Comentario suficientemente largo")
    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "INVALID_STATE_TRANSITION"


@pytest.mark.asyncio
async def test_rejection_comment_too_short():
    record = _make_record("en_revision")
    with (
        patch(_GET, new=AsyncMock(return_value=record)),
        patch(_UPDATE, new=AsyncMock()),
        patch(_INC),
        patch(_LOG, new=AsyncMock()),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await transition_status("CM-1", PublicationStatus.borrador, "user1",
                                    rejection_comment="corto")
    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "REJECTION_COMMENT_TOO_SHORT"


@pytest.mark.asyncio
async def test_record_not_found():
    with patch(_GET, new=AsyncMock(return_value=None)):
        with pytest.raises(HTTPException) as exc_info:
            await transition_status("CM-999", PublicationStatus.en_revision, "user1")
    assert exc_info.value.status_code == 404
    assert exc_info.value.detail["code"] == "RECORD_NOT_FOUND"
