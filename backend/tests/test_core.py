"""Tarea 5 — Punto de control de pruebas del backend.

Cubre:
  1. Modelos Pydantic — validación de patrones, campos obligatorios, enum PublicationStatus
  2. Máquina de estados — VALID_TRANSITIONS directamente
  3. Comentario de rechazo — validación de longitud
  4. LaunchRule.is_active()
  5. Serialización round-trip de RecordMaestro
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import ValidationError
from fastapi import HTTPException

from backend.src.models.record import RecordMaestro
from backend.src.models.enums import PublicationStatus, SourceTable
from backend.src.models.launch_rule import LaunchRule
from backend.src.services.publication_service import VALID_TRANSITIONS, transition_status


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

class TestPydanticModels:
    """Validación de patrones, campos obligatorios y enum PublicationStatus."""

    # --- Patrón transaction_id: Tra-\d+ ---

    def test_transaction_id_valid(self):
        r = RecordMaestro(**_valid_record(transaction_id="Tra-1"))
        assert r.transaction_id == "Tra-1"

    def test_transaction_id_valid_large_number(self):
        r = RecordMaestro(**_valid_record(transaction_id="Tra-9999"))
        assert r.transaction_id == "Tra-9999"

    def test_transaction_id_invalid_prefix(self):
        with pytest.raises(ValidationError):
            RecordMaestro(**_valid_record(transaction_id="TX-1"))

    def test_transaction_id_invalid_no_digits(self):
        with pytest.raises(ValidationError):
            RecordMaestro(**_valid_record(transaction_id="Tra-"))

    def test_transaction_id_invalid_plain_string(self):
        with pytest.raises(ValidationError):
            RecordMaestro(**_valid_record(transaction_id="Indicador_de_Registro"))

    # --- Patrón id: (CM|CS|CC|IdI|I|Com|B)-\d+ ---

    def test_id_valid_cm(self):
        r = RecordMaestro(**_valid_record(id="CM-1"))
        assert r.id == "CM-1"

    def test_id_valid_idi(self):
        r = RecordMaestro(**_valid_record(id="IdI-100"))
        assert r.id == "IdI-100"

    def test_id_invalid_pattern(self):
        with pytest.raises(ValidationError):
            RecordMaestro(**_valid_record(id="INVALID-1"))

    def test_id_invalid_indicador_de_registro(self):
        """'Indicador_de_Registro' no es un id válido."""
        with pytest.raises(ValidationError):
            RecordMaestro(**_valid_record(id="Indicador_de_Registro"))

    # --- Campos obligatorios ---

    def test_missing_city_raises(self):
        data = _valid_record()
        del data["city"]
        with pytest.raises(ValidationError):
            RecordMaestro(**data)

    def test_missing_noticia_raises(self):
        data = _valid_record()
        del data["noticia"]
        with pytest.raises(ValidationError):
            RecordMaestro(**data)

    def test_missing_fuente_bibliografica_raises(self):
        data = _valid_record()
        del data["fuente_bibliografica"]
        with pytest.raises(ValidationError):
            RecordMaestro(**data)

    # --- Enum PublicationStatus ---

    def test_status_default_is_borrador(self):
        r = RecordMaestro(**_valid_record())
        assert r.status == PublicationStatus.borrador

    def test_status_en_revision(self):
        r = RecordMaestro(**_valid_record(status=PublicationStatus.en_revision))
        assert r.status == PublicationStatus.en_revision

    def test_status_publicado(self):
        r = RecordMaestro(**_valid_record(status=PublicationStatus.publicado))
        assert r.status == PublicationStatus.publicado

    def test_status_invalid_value(self):
        with pytest.raises(ValidationError):
            RecordMaestro(**_valid_record(status="archivado"))

    def test_publication_status_enum_values(self):
        assert PublicationStatus.borrador.value == "borrador"
        assert PublicationStatus.en_revision.value == "en_revision"
        assert PublicationStatus.publicado.value == "publicado"


# ---------------------------------------------------------------------------
# 2. Máquina de estados — VALID_TRANSITIONS directamente
# ---------------------------------------------------------------------------

class TestStateMachine:
    """Prueba directa del diccionario VALID_TRANSITIONS."""

    def test_borrador_to_en_revision_allowed(self):
        assert PublicationStatus.en_revision in VALID_TRANSITIONS[PublicationStatus.borrador]

    def test_en_revision_to_publicado_allowed(self):
        assert PublicationStatus.publicado in VALID_TRANSITIONS[PublicationStatus.en_revision]

    def test_en_revision_to_rechazado_allowed(self):
        assert PublicationStatus.rechazado in VALID_TRANSITIONS[PublicationStatus.en_revision]

    def test_borrador_to_publicado_not_allowed(self):
        assert PublicationStatus.publicado not in VALID_TRANSITIONS[PublicationStatus.borrador]

    def test_publicado_to_rechazado_not_allowed(self):
        assert PublicationStatus.rechazado not in VALID_TRANSITIONS[PublicationStatus.publicado]

    def test_publicado_can_transition_to_borrador(self):
        assert PublicationStatus.borrador in VALID_TRANSITIONS[PublicationStatus.publicado]


# ---------------------------------------------------------------------------
# 3. Comentario de rechazo — validación de longitud
# ---------------------------------------------------------------------------

_GET = "backend.src.services.publication_service.async_get_document"
_UPDATE = "backend.src.services.publication_service.async_update_document"
_INC = "backend.src.services.publication_service.increment_published_count"
_LOG = "backend.src.services.publication_service.log_operation"


class TestRejectionComment:
    """Lógica de validación de longitud del comentario de rechazo."""

    @pytest.mark.asyncio
    async def test_comment_shorter_than_10_fails(self):
        """Comentario de 9 chars → REJECTION_COMMENT_TOO_SHORT."""
        record = _make_record_dict("en_revision")
        with (
            patch(_GET, new=AsyncMock(return_value=record)),
            patch(_UPDATE, new=AsyncMock()),
            patch(_INC),
            patch(_LOG, new=AsyncMock()),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await transition_status(
                    "CM-1", PublicationStatus.rechazado, "user1",
                    rejection_comment="123456789"  # 9 chars
                )
        assert exc_info.value.status_code == 422
        assert exc_info.value.detail["code"] == "REJECTION_COMMENT_TOO_SHORT"

    @pytest.mark.asyncio
    async def test_comment_empty_fails(self):
        """Comentario vacío → REJECTION_COMMENT_TOO_SHORT."""
        record = _make_record_dict("en_revision")
        with (
            patch(_GET, new=AsyncMock(return_value=record)),
            patch(_UPDATE, new=AsyncMock()),
            patch(_INC),
            patch(_LOG, new=AsyncMock()),
        ):
            with pytest.raises(HTTPException) as exc_info:
                await transition_status(
                    "CM-1", PublicationStatus.rechazado, "user1",
                    rejection_comment=""
                )
        assert exc_info.value.detail["code"] == "REJECTION_COMMENT_TOO_SHORT"

    @pytest.mark.asyncio
    async def test_comment_exactly_10_passes(self):
        """Comentario de exactamente 10 chars → transición exitosa."""
        record = _make_record_dict("en_revision")
        with (
            patch(_GET, new=AsyncMock(return_value=record)),
            patch(_UPDATE, new=AsyncMock()),
            patch(_INC),
            patch(_LOG, new=AsyncMock()),
        ):
            result = await transition_status(
                "CM-1", PublicationStatus.rechazado, "user1",
                rejection_comment="1234567890"  # 10 chars
            )
        assert result["status"] == "rechazado"

    @pytest.mark.asyncio
    async def test_comment_longer_than_10_passes(self):
        """Comentario de 30 chars → transición exitosa."""
        record = _make_record_dict("en_revision")
        with (
            patch(_GET, new=AsyncMock(return_value=record)),
            patch(_UPDATE, new=AsyncMock()),
            patch(_INC),
            patch(_LOG, new=AsyncMock()),
        ):
            result = await transition_status(
                "CM-1", PublicationStatus.rechazado, "user1",
                rejection_comment="Falta información importante aquí"
            )
        assert result["status"] == "rechazado"


# ---------------------------------------------------------------------------
# 4. LaunchRule.is_active()
# ---------------------------------------------------------------------------

class TestLaunchRuleIsActive:
    """Pruebas directas del modelo LaunchRule.is_active()."""

    def test_below_threshold_returns_false(self):
        rule = LaunchRule(published_count=19, threshold=20)
        assert rule.is_active() is False

    def test_at_threshold_returns_true(self):
        rule = LaunchRule(published_count=20, threshold=20)
        assert rule.is_active() is True

    def test_above_threshold_returns_true(self):
        rule = LaunchRule(published_count=25, threshold=20)
        assert rule.is_active() is True

    def test_zero_count_returns_false(self):
        rule = LaunchRule(published_count=0, threshold=20)
        assert rule.is_active() is False


# ---------------------------------------------------------------------------
# 5. Serialización round-trip
# ---------------------------------------------------------------------------

class TestRoundTrip:
    """Crear RecordMaestro, serializar a JSON y deserializar."""

    def test_round_trip_model_dump(self):
        r1 = RecordMaestro(**_valid_record())
        r2 = RecordMaestro.model_validate(r1.model_dump())
        assert r1 == r2

    def test_round_trip_json_string(self):
        r1 = RecordMaestro(**_valid_record())
        json_str = r1.model_dump_json()
        r2 = RecordMaestro.model_validate_json(json_str)
        assert r1.id == r2.id
        assert r1.transaction_id == r2.transaction_id
        assert r1.status == r2.status
        assert r1.city == r2.city
        assert r1.year == r2.year
        assert r1.noticia == r2.noticia
        assert r1.source_table == r2.source_table

    def test_round_trip_preserves_optional_fields(self):
        r1 = RecordMaestro(**_valid_record(
            rejection_comment="Comentario de prueba largo",
            monto_reales=150.5,
            transcripcion="Texto transcrito del documento original",
        ))
        r2 = RecordMaestro.model_validate(r1.model_dump())
        assert r2.rejection_comment == r1.rejection_comment
        assert r2.monto_reales == r1.monto_reales
        assert r2.transcripcion == r1.transcripcion
