"""Punto de control 1 — Pruebas unitarias de los servicios implementados.

Cubre:
  1. Modelos Pydantic (sin mocks)
  2. Máquina de estados de publicación (con mocks de Firestore)
  3. Regla de Lanzamiento Cero (con mocks)
  4. Servicio de auditoría (con mocks)
"""
from __future__ import annotations

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError
from fastapi import HTTPException

from backend.src.models.record import RecordMaestro
from backend.src.models.enums import PublicationStatus, SourceTable, AuditAction
from backend.src.models.launch_rule import LaunchRule
from backend.src.services.publication_service import transition_status
from backend.src.services.launch_rule import is_portal_active
from backend.src.services.audit_service import log_operation


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _valid_record(**overrides) -> dict:
    base = {
        "id": "CM-1",
        "transaction_id": "Tra-1",
        "source_table": SourceTable.CM,
        "city": "Sevilla",
        "year": 1600,
        "noticia": "Pago de salario",
        "fuente_bibliografica": "Archivo General de Indias",
        "created_at": _now(),
        "updated_at": _now(),
    }
    base.update(overrides)
    return base


def _make_record_dict(status: str) -> dict:
    return {
        "id": "CM-1",
        "transaction_id": "Tra-1",
        "source_table": "CM",
        "status": status,
        "city": "Sevilla",
        "year": 1600,
        "noticia": "Pago",
        "fuente_bibliografica": "AGI",
        "created_at": _now().isoformat(),
        "updated_at": _now().isoformat(),
    }


# ---------------------------------------------------------------------------
# 1. Modelos Pydantic
# ---------------------------------------------------------------------------

def test_record_valid_id_pattern():
    """RecordMaestro acepta ids válidos: CM-1, CS-42, IdI-100."""
    for valid_id in ("CM-1", "CS-42", "IdI-100"):
        r = RecordMaestro(**_valid_record(id=valid_id))
        assert r.id == valid_id


def test_record_invalid_id_pattern():
    """RecordMaestro rechaza ids inválidos: XX-1, CM, 1."""
    for invalid_id in ("XX-1", "CM", "1"):
        with pytest.raises(ValidationError):
            RecordMaestro(**_valid_record(id=invalid_id))


def test_transaction_id_pattern():
    """RecordMaestro acepta Tra-1, rechaza Tra, 1, T-1."""
    # Valid
    r = RecordMaestro(**_valid_record(transaction_id="Tra-1"))
    assert r.transaction_id == "Tra-1"

    # Invalid
    for invalid_tid in ("Tra", "1", "T-1"):
        with pytest.raises(ValidationError):
            RecordMaestro(**_valid_record(transaction_id=invalid_tid))


def test_launch_rule_is_active():
    """LaunchRule.is_active() es True cuando published_count >= threshold."""
    assert LaunchRule(published_count=10, threshold=10).is_active() is True
    assert LaunchRule(published_count=9, threshold=10).is_active() is False


def test_record_serialization_round_trip():
    """Serializar a JSON y deserializar produce un objeto igual al original."""
    r1 = RecordMaestro(**_valid_record())
    r2 = RecordMaestro.model_validate(r1.model_dump())
    assert r1 == r2


# ---------------------------------------------------------------------------
# 2. Máquina de estados de publicación
# ---------------------------------------------------------------------------

_GET = "backend.src.services.publication_service.async_get_document"
_UPDATE = "backend.src.services.publication_service.async_update_document"
_INC = "backend.src.services.publication_service.increment_published_count"
_LOG = "backend.src.services.publication_service.log_operation"


@pytest.mark.asyncio
async def test_transition_borrador_to_en_revision():
    """Transición válida borrador → en_revision llama async_update_document con status='en_revision'."""
    record = _make_record_dict("borrador")
    mock_update = AsyncMock()
    with (
        patch(_GET, new=AsyncMock(return_value=record)),
        patch(_UPDATE, new=mock_update),
        patch(_INC),
        patch(_LOG, new=AsyncMock()),
    ):
        result = await transition_status("CM-1", PublicationStatus.en_revision, "user1")

    assert result["status"] == "en_revision"
    mock_update.assert_called_once()
    call_kwargs = mock_update.call_args[0]  # positional args: (collection, id, data)
    assert call_kwargs[2]["status"] == "en_revision"


@pytest.mark.asyncio
async def test_transition_en_revision_to_publicado():
    """Transición válida en_revision → publicado llama increment_published_count(1)."""
    record = _make_record_dict("en_revision")
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
async def test_transition_en_revision_to_borrador_with_comment():
    """Rechazo válido con comentario >= 10 chars."""
    record = _make_record_dict("en_revision")
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
async def test_transition_invalid_borrador_to_publicado():
    """Transición inválida borrador → publicado lanza HTTPException(422) con INVALID_STATE_TRANSITION."""
    record = _make_record_dict("borrador")
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
async def test_transition_rejection_comment_too_short():
    """Comentario de 5 chars lanza HTTPException(422) con REJECTION_COMMENT_TOO_SHORT."""
    record = _make_record_dict("en_revision")
    with (
        patch(_GET, new=AsyncMock(return_value=record)),
        patch(_UPDATE, new=AsyncMock()),
        patch(_INC),
        patch(_LOG, new=AsyncMock()),
    ):
        with pytest.raises(HTTPException) as exc_info:
            await transition_status(
                "CM-1", PublicationStatus.borrador, "user1",
                rejection_comment="corto"
            )

    assert exc_info.value.status_code == 422
    assert exc_info.value.detail["code"] == "REJECTION_COMMENT_TOO_SHORT"


@pytest.mark.asyncio
async def test_transition_record_not_found():
    """async_get_document devuelve None → HTTPException(404)."""
    with patch(_GET, new=AsyncMock(return_value=None)):
        with pytest.raises(HTTPException) as exc_info:
            await transition_status("CM-999", PublicationStatus.en_revision, "user1")

    assert exc_info.value.status_code == 404


# ---------------------------------------------------------------------------
# 3. Regla de Lanzamiento Cero
# ---------------------------------------------------------------------------

_GET_RULE = "backend.src.services.launch_rule.get_launch_rule"


def _rule(published_count: int, threshold: int = 10) -> dict:
    return {
        "published_count": published_count,
        "threshold": threshold,
        "portal_active": published_count >= threshold,
    }


@pytest.mark.asyncio
async def test_portal_inactive_below_threshold():
    """published_count=5 → is_portal_active() devuelve False."""
    with patch(_GET_RULE, return_value=_rule(5)):
        result = await is_portal_active()
    assert result is False


@pytest.mark.asyncio
async def test_portal_active_at_threshold():
    """published_count=10 → is_portal_active() devuelve True."""
    with patch(_GET_RULE, return_value=_rule(10)):
        result = await is_portal_active()
    assert result is True


@pytest.mark.asyncio
async def test_portal_active_above_threshold():
    """published_count=15 → is_portal_active() devuelve True."""
    with patch(_GET_RULE, return_value=_rule(15)):
        result = await is_portal_active()
    assert result is True


# ---------------------------------------------------------------------------
# 4. Servicio de auditoría
# ---------------------------------------------------------------------------

_SET_DOC = "backend.src.services.audit_service.async_set_document"


@pytest.mark.asyncio
async def test_log_operation_creates_entry():
    """async_set_document se llama con colección 'audit_log' y entry con campos requeridos."""
    mock_set = AsyncMock()
    with patch(_SET_DOC, new=mock_set):
        await log_operation(
            record_id="CM-1",
            user_uid="user-abc",
            action=AuditAction.cambio_estado,
            details={"from": "borrador", "to": "en_revision"},
        )

    mock_set.assert_called_once()
    args = mock_set.call_args[0]  # (collection, doc_id, data)
    collection, doc_id, entry = args

    assert collection == "audit_log"
    assert "record_id" in entry
    assert "user_uid" in entry
    assert "action" in entry
    assert "timestamp" in entry
    assert "details" in entry
    assert entry["record_id"] == "CM-1"
    assert entry["user_uid"] == "user-abc"


@pytest.mark.asyncio
async def test_log_operation_id_format():
    """El id devuelto por log_operation empieza con 'log-'."""
    with patch(_SET_DOC, new=AsyncMock()):
        entry_id = await log_operation(
            record_id="CM-1",
            user_uid="user-abc",
            action=AuditAction.creacion,
            details={},
        )

    assert entry_id.startswith("log-")
