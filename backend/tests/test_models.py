"""Unit tests for Pydantic models."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

from backend.src.models.record import RecordMaestro
from backend.src.models.enums import PublicationStatus, SourceTable
from backend.src.models.launch_rule import LaunchRule


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


# ---------------------------------------------------------------------------
# RecordMaestro — valid
# ---------------------------------------------------------------------------

def test_record_valid():
    r = RecordMaestro(**_valid_record())
    assert r.id == "CM-1"
    assert r.transaction_id == "Tra-1"
    assert r.status == PublicationStatus.borrador


def test_record_invalid_id_pattern():
    with pytest.raises(ValidationError):
        RecordMaestro(**_valid_record(id="INVALID-1"))


def test_record_invalid_transaction_id_pattern():
    with pytest.raises(ValidationError):
        RecordMaestro(**_valid_record(transaction_id="TX-1"))


def test_record_year_out_of_range():
    with pytest.raises(ValidationError):
        RecordMaestro(**_valid_record(year=1400))


# ---------------------------------------------------------------------------
# LaunchRule.is_active()
# ---------------------------------------------------------------------------

def test_launch_rule_not_active_below_threshold():
    rule = LaunchRule(published_count=19, threshold=20)
    assert rule.is_active() is False


def test_launch_rule_active_at_threshold():
    rule = LaunchRule(published_count=20, threshold=20)
    assert rule.is_active() is True


# ---------------------------------------------------------------------------
# Round-trip serialization
# ---------------------------------------------------------------------------

def test_record_round_trip():
    data = _valid_record()
    r1 = RecordMaestro(**data)
    r2 = RecordMaestro.model_validate(r1.model_dump())
    assert r1 == r2
