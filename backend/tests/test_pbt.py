"""Property-Based Tests (PBT) using Hypothesis for the PRETSO backend."""
from __future__ import annotations

import csv
import io
import math
import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
from hypothesis import given, strategies as st
from pydantic import ValidationError
from fastapi import HTTPException
from fastapi.testclient import TestClient

from backend.src.models.record import RecordMaestro
from backend.src.models.enums import PublicationStatus, SourceTable, AuditAction
from backend.src.models.launch_rule import LaunchRule
from backend.src.services.publication_service import VALID_TRANSITIONS, transition_status
from backend.src.services.launch_rule import is_portal_active
from backend.src.services.etl_service import _map_row, run_etl, _REQUIRED_FIELDS
from backend.src.services.audit_service import log_operation
from backend.src.services.search_service import search
from backend.src.db.repositories import query_records
from backend.src.api.public.transactions import get_transaction_detail
from backend.src.api.public.records import get_record_detail
from backend.src.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Hypothesis Custom Strategies
# ---------------------------------------------------------------------------

@st.composite
def record_maestro_strategy(draw):
    """Generate a valid RecordMaestro model instance."""
    prefix = draw(st.sampled_from(["CM", "CS", "CC", "IdI", "I", "Com", "B"]))
    rid = f"{prefix}-{draw(st.integers(min_value=1, max_value=100000))}"
    tra_id = f"Tra-{draw(st.integers(min_value=1, max_value=100000))}"
    source = draw(st.sampled_from(list(SourceTable)))
    status = draw(st.sampled_from(list(PublicationStatus)))
    city = draw(st.text(min_size=1, max_size=50).filter(lambda x: x.strip() != ""))
    year = draw(st.integers(min_value=1500, max_value=1700))
    noticia = draw(st.text(min_size=1, max_size=100).filter(lambda x: x.strip() != ""))
    fuente = draw(st.text(min_size=1, max_size=100).filter(lambda x: x.strip() != ""))
    
    # Generate datetimes with timezone UTC to match our model expectation
    created_at = draw(st.datetimes(min_value=datetime(1970, 1, 1), max_value=datetime(2030, 12, 31), timezones=st.just(timezone.utc)))
    updated_at = draw(st.datetimes(min_value=datetime(1970, 1, 1), max_value=datetime(2030, 12, 31), timezones=st.just(timezone.utc)))

    return RecordMaestro(
        id=rid,
        transaction_id=tra_id,
        source_table=source,
        status=status,
        city=city,
        year=year,
        noticia=noticia,
        fuente_bibliografica=fuente,
        created_at=created_at,
        updated_at=updated_at,
    )


@st.composite
def valid_row_strategy(draw, table):
    """Generate a valid raw CSV row for a specific SourceTable type."""
    row = {}
    id_field = _REQUIRED_FIELDS[table][0]
    row[id_field] = f"{table}-{draw(st.integers(min_value=1, max_value=9999))}"
    
    second_field = _REQUIRED_FIELDS[table][1]
    if second_field == "Transacción":
        row[second_field] = f"Tra-{draw(st.integers(min_value=1, max_value=9999))}"
    else:
        row[second_field] = draw(st.text(min_size=1, max_size=50).filter(lambda x: x.strip() != ""))
        
    row["Ciudad"] = draw(st.text(min_size=1, max_size=50).filter(lambda x: x.strip() != ""))
    row["Año"] = str(draw(st.integers(min_value=1500, max_value=1700)))
    row["Noticia"] = draw(st.text(min_size=1, max_size=100).filter(lambda x: x.strip() != ""))
    row["Fuentes para la generación del dato"] = draw(st.text(min_size=1, max_size=100).filter(lambda x: x.strip() != ""))
    
    if table == "Com":
        row["Siglas"] = draw(st.text(min_size=1, max_size=20).filter(lambda x: x.strip() != ""))
        row["Autores"] = draw(st.text(min_size=1, max_size=50).filter(lambda x: x.strip() != ""))
        row["España / América"] = draw(st.sampled_from(["España", "América"]))
    elif table == "B":
        row["Autores"] = draw(st.text(min_size=1, max_size=50).filter(lambda x: x.strip() != ""))
        row["Referencias bibliográficas"] = draw(st.text(min_size=1, max_size=100).filter(lambda x: x.strip() != ""))
        
    return row


@st.composite
def valid_row_and_table_strategy(draw):
    """Generate a valid raw CSV row and its corresponding SourceTable type."""
    table = draw(st.sampled_from(["CM", "CS", "CC", "IdI", "I", "Com", "B"]))
    row = draw(valid_row_strategy(table))
    return row, table


@st.composite
def mixed_rows_strategy(draw):
    """Generate a list of rows where some are valid and others are intentionally invalid."""
    table = draw(st.sampled_from(["CM", "CS", "CC", "IdI", "I", "Com", "B"]))
    rows = []
    expected_valid = 0
    expected_invalid = 0
    
    num_rows = draw(st.integers(min_value=1, max_value=10))
    for _ in range(num_rows):
        is_valid = draw(st.booleans())
        row = draw(valid_row_strategy(table))
        
        id_field = _REQUIRED_FIELDS[table][0]
        second_field = _REQUIRED_FIELDS[table][1]
        
        if is_valid:
            expected_valid += 1
        else:
            # Corrupt the row to make it invalid
            corrupt_choice = draw(st.sampled_from(["missing_id", "missing_second", "bad_tx"]))
            if corrupt_choice == "missing_id":
                row[id_field] = ""
            elif corrupt_choice == "missing_second":
                row[second_field] = ""
            elif corrupt_choice == "bad_tx" and second_field == "Transacción":
                row[second_field] = "invalid_tx_pattern"
            else:
                row[id_field] = ""
            expected_invalid += 1
            
        rows.append(row)
        
    return rows, table, expected_valid, expected_invalid


# ---------------------------------------------------------------------------
# 15 Property-Based Tests
# ---------------------------------------------------------------------------

# P1: Invariante de vinculación Registro–Transacción
@given(record_maestro_strategy())
def test_p1_transaction_id_binding_invariant(record):
    assert record.transaction_id.startswith("Tra-")
    assert record.transaction_id[4:].isdigit()


# P2: Completitud de referencias cruzadas
@pytest.mark.asyncio
@given(
    st.lists(record_maestro_strategy(), min_size=1, max_size=10, unique_by=lambda r: r.id),
    st.builds(lambda s: f"Tra-{s}", st.integers(min_value=1, max_value=99999))
)
async def test_p2_cross_reference_completeness(records, tx_id):
    for r in records:
        r.transaction_id = tx_id
        
    published_records = [r.model_dump() for r in records if r.status == PublicationStatus.publicado]
    
    with (
        patch("backend.src.api.public.transactions.get_transaction", return_value={"id": tx_id}),
        patch("backend.src.api.public.transactions.query_collection", return_value=published_records)
    ):
        res = await get_transaction_detail(tx_id)
        assert res["id"] == tx_id
        for r_res in res["records"]:
            assert r_res["transaction_id"] == tx_id
            assert r_res["status"] == "publicado"


# P3: ETL produce registros en estado Borrador
@given(valid_row_and_table_strategy())
def test_p3_etl_produces_draft_status(row_and_table):
    row, table = row_and_table
    record_dict, error = _map_row(row, table, 2)
    assert error is None
    assert record_dict is not None
    assert record_dict["status"] == PublicationStatus.borrador.value


# P4: ETL particiona correctamente filas válidas e inválidas
@pytest.mark.asyncio
@given(mixed_rows_strategy())
async def test_p4_etl_partitions_valid_and_invalid_rows(mixed_data):
    rows, table, expected_valid, expected_invalid = mixed_data
    if not rows:
        return
        
    fieldnames = list(rows[0].keys())
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for r in rows:
        writer.writerow(r)
    csv_bytes = output.getvalue().encode("utf-8")
    
    with (
        patch("backend.src.services.etl_service.async_get_document", return_value=None),
        patch("backend.src.services.etl_service.async_set_document", return_value=None),
        patch("backend.src.services.etl_service.get_transaction", return_value=None),
        patch("backend.src.services.etl_service.set_transaction", return_value=None),
        patch("backend.src.services.etl_service.add_record_to_transaction", return_value=None)
    ):
        result = await run_etl(csv_bytes, table, "test_user")
        assert result["imported"] == expected_valid
        assert result["rejected"] == expected_invalid
        assert len(result["errors"]) == expected_invalid


# P5: Idempotencia del ETL
@pytest.mark.asyncio
@given(
    st.sampled_from(["CM", "CS", "CC", "IdI", "I", "Com", "B"]).flatmap(
        lambda tbl: st.tuples(
            st.just(tbl),
            st.lists(valid_row_strategy(tbl), min_size=1, max_size=5)
        )
    )
)
async def test_p5_etl_idempotency(table_and_rows):
    table, rows = table_and_rows
    if not rows:
        return
        
    id_field = _REQUIRED_FIELDS[table][0]
    second_field = _REQUIRED_FIELDS[table][1]
    
    for idx, r in enumerate(rows):
        rid = f"{table}-{idx + 1}"
        r[id_field] = rid
        if second_field == "Transacción":
            r[second_field] = f"Tra-{idx + 1}"
            
    fieldnames = list(rows[0].keys())
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()
    for r in rows:
        writer.writerow(r)
    csv_bytes = output.getvalue().encode("utf-8")
    
    mock_db = {}
    async def mock_get(col, doc_id):
        return mock_db.get(doc_id)
    async def mock_set(col, doc_id, data):
        mock_db[doc_id] = data

    with (
        patch("backend.src.services.etl_service.async_get_document", side_effect=mock_get),
        patch("backend.src.services.etl_service.async_set_document", side_effect=mock_set),
        patch("backend.src.services.etl_service.get_transaction", return_value=None),
        patch("backend.src.services.etl_service.set_transaction", return_value=None),
        patch("backend.src.services.etl_service.add_record_to_transaction", return_value=None)
    ):
        res1 = await run_etl(csv_bytes, table, "test_user")
        assert res1["imported"] == len(rows)
        assert res1["skipped"] == 0
        
        res2 = await run_etl(csv_bytes, table, "test_user")
        assert res2["imported"] == 0
        assert res2["skipped"] == len(rows)


# P6: Umbral de Lanzamiento Cero
@pytest.mark.asyncio
@given(st.integers(min_value=0, max_value=100))
async def test_p6_launch_rule_threshold(count):
    threshold = 10
    is_active = count >= threshold
    mock_rule = {
        "published_count": count,
        "threshold": threshold,
        "portal_active": is_active
    }
    with patch("backend.src.services.launch_rule.get_launch_rule", return_value=mock_rule):
        res = await is_portal_active()
        assert res == is_active


# P7: Máquina de estados de publicación
@pytest.mark.asyncio
@given(
    st.sampled_from(list(PublicationStatus)),
    st.sampled_from(list(PublicationStatus)),
    st.text(min_size=10, max_size=50)
)
async def test_p7_state_machine_transitions(old_status, new_status, comment):
    record = {
        "id": "CM-1",
        "transaction_id": "Tra-1",
        "source_table": "CM",
        "status": old_status.value,
        "city": "Sevilla",
        "year": 1600,
        "noticia": "Pago",
        "fuente_bibliografica": "AGI",
    }
    
    is_allowed = new_status in VALID_TRANSITIONS.get(old_status, set())
    
    with (
        patch("backend.src.services.publication_service.async_get_document", return_value=record),
        patch("backend.src.services.publication_service.async_update_document", return_value=None),
        patch("backend.src.services.publication_service.increment_published_count", return_value=0),
        patch("backend.src.services.publication_service.log_operation", return_value=None)
    ):
        if is_allowed:
            if new_status == PublicationStatus.rechazado:
                res = await transition_status("CM-1", new_status, "user1", rejection_comment=comment)
                assert res["status"] == new_status.value
            else:
                res = await transition_status("CM-1", new_status, "user1")
                assert res["status"] == new_status.value
        else:
            with pytest.raises(HTTPException) as exc_info:
                await transition_status("CM-1", new_status, "user1", rejection_comment=comment)
            assert exc_info.value.status_code == 422
            assert exc_info.value.detail["code"] == "INVALID_STATE_TRANSITION"


# P8: Comentario de rechazo mínimo
@pytest.mark.asyncio
@given(st.text())
async def test_p8_rejection_comment_length(comment):
    record = {
        "id": "CM-1",
        "transaction_id": "Tra-1",
        "source_table": "CM",
        "status": PublicationStatus.en_revision.value,
        "city": "Sevilla",
        "year": 1600,
        "noticia": "Pago",
        "fuente_bibliografica": "AGI",
    }
    
    with (
        patch("backend.src.services.publication_service.async_get_document", return_value=record),
        patch("backend.src.services.publication_service.async_update_document", return_value=None),
        patch("backend.src.services.publication_service.increment_published_count", return_value=0),
        patch("backend.src.services.publication_service.log_operation", return_value=None)
    ):
        if len(comment) < 10:
            with pytest.raises(HTTPException) as exc_info:
                await transition_status("CM-1", PublicationStatus.rechazado, "user1", rejection_comment=comment)
            assert exc_info.value.status_code == 422
            assert exc_info.value.detail["code"] == "REJECTION_COMMENT_TOO_SHORT"
        else:
            res = await transition_status("CM-1", PublicationStatus.rechazado, "user1", rejection_comment=comment)
            assert res["status"] == PublicationStatus.rechazado.value
            assert res["rejection_comment"] == comment


# P9: Visibilidad pública solo de registros publicados
@pytest.mark.asyncio
@given(
    st.sampled_from(list(PublicationStatus)),
    st.text(min_size=1, max_size=20)
)
async def test_p9_public_visibility_only_published(status, record_id):
    record = {
        "id": record_id,
        "status": status.value,
        "city": "Sevilla",
        "year": 1600,
        "noticia": "Pago",
        "fuente_bibliografica": "AGI",
    }
    with patch("backend.src.api.public.records.get_record", return_value=record):
        if status == PublicationStatus.publicado:
            res = await get_record_detail(record_id)
            assert res["status"] == "publicado"
        else:
            with pytest.raises(HTTPException) as exc_info:
                await get_record_detail(record_id)
            assert exc_info.value.status_code == 404
            assert exc_info.value.detail["code"] == "RECORD_NOT_FOUND"


# P10: Auditoría completa de operaciones
@pytest.mark.asyncio
@given(
    st.text(min_size=1, max_size=20),
    st.text(min_size=1, max_size=20),
    st.sampled_from(list(AuditAction)),
    st.dictionaries(st.text(min_size=1, max_size=10), st.text(min_size=1, max_size=10))
)
async def test_p10_audit_logging(record_id, user_uid, action, details):
    logged_doc = {}
    async def mock_set(col, entry_id, doc):
        assert col == "audit_log"
        assert entry_id.startswith("log-")
        logged_doc.update(doc)

    with patch("backend.src.services.audit_service.async_set_document", side_effect=mock_set):
        entry_id = await log_operation(record_id, user_uid, action, details)
        assert logged_doc["id"] == entry_id
        assert logged_doc["record_id"] == record_id
        assert logged_doc["user_uid"] == user_uid
        assert logged_doc["action"] == action.value
        assert logged_doc["details"] == details
        assert "timestamp" in logged_doc


# P11: Ordenación de resultados de búsqueda por relevancia
@pytest.mark.asyncio
@given(
    st.lists(
        st.fixed_dictionaries({
            "id": st.text(min_size=1, max_size=10),
            "status": st.just("publicado"),
            "embedding": st.lists(st.floats(min_value=-1.0, max_value=1.0), min_size=3, max_size=3),
        }),
        min_size=1,
        max_size=10,
        unique_by=lambda r: r["id"]
    ),
    st.lists(st.floats(min_value=-1.0, max_value=1.0), min_size=3, max_size=3)
)
async def test_p11_search_results_sorted_by_relevance(candidates, query_emb):
    async def mock_query(*args, **kwargs):
        return candidates
    async def mock_generate_emb(query_text):
        return query_emb

    with (
        patch("backend.src.services.search_service.async_query_collection", side_effect=mock_query),
        patch("backend.src.services.search_service.generate_embedding", side_effect=mock_generate_emb)
    ):
        res = await search("some query")
        results = res["results"]
        scores = [r["score"] for r in results]
        
        for i in range(len(scores) - 1):
            assert scores[i] >= scores[i+1]


# P12: Paginación de la API no excede el límite
@pytest.mark.asyncio
@given(
    st.integers(min_value=-10, max_value=200),
    st.integers(min_value=0, max_value=150)
)
async def test_p12_api_pagination_limit(requested_page_size, available_records_count):
    clamped_page_size = max(1, min(requested_page_size, 100)) if requested_page_size > 0 else 25
    all_records = [{"id": f"CM-{i}", "status": "publicado"} for i in range(available_records_count)]
    
    with patch("backend.src.db.repositories.query_collection", return_value=all_records):
        records, total = query_records(status="publicado", page=1, page_size=clamped_page_size)
        assert len(records) <= clamped_page_size
        assert len(records) <= 100
        assert len(records) <= available_records_count


# P13: API de solo lectura rechaza métodos de escritura
@given(
    st.sampled_from(["POST", "PUT", "DELETE", "PATCH", "GET", "OPTIONS"]),
    st.sampled_from([
        "/api/v1/records",
        "/api/v1/transactions",
        "/api/v1/companies",
        "/api/v1/announcements",
    ])
)
def test_p13_readonly_api_rejects_write_methods(method, path):
    response = client.request(method, path)
    if method not in ("GET", "OPTIONS"):
        assert response.status_code == 405
        assert response.json()["error"]["code"] == "METHOD_NOT_ALLOWED"


# P14: Round-trip de serialización de Registros_Maestros
@given(record_maestro_strategy())
def test_p14_record_maestro_round_trip(record):
    dumped_dict = record.model_dump()
    reconstructed_dict = RecordMaestro.model_validate(dumped_dict)
    assert record == reconstructed_dict
    
    dumped_json = record.model_dump_json()
    reconstructed_json = RecordMaestro.model_validate_json(dumped_json)
    
    assert record.id == reconstructed_json.id
    assert record.transaction_id == reconstructed_json.transaction_id
    assert record.source_table == reconstructed_json.source_table
    assert record.status == reconstructed_json.status
    assert record.city == reconstructed_json.city
    assert record.year == reconstructed_json.year
    assert record.noticia == reconstructed_json.noticia
    assert record.fuente_bibliografica == reconstructed_json.fuente_bibliografica


# P15: Deserialización de JSON inválido produce error descriptivo
@given(
    record_maestro_strategy(),
    st.sampled_from(["id", "transaction_id", "source_table", "city", "year", "noticia", "fuente_bibliografica"]),
    st.sampled_from(["remove", "bad_type"])
)
def test_p15_invalid_json_deserialization_error(record, field_to_corrupt, corruption_type):
    data = record.model_dump()
    
    if corruption_type == "remove":
        del data[field_to_corrupt]
    else:
        if field_to_corrupt == "year":
            data[field_to_corrupt] = "invalid_year_string"
        elif field_to_corrupt in ("id", "transaction_id", "city", "noticia", "fuente_bibliografica"):
            data[field_to_corrupt] = {"nested": "dict_instead_of_string"}
        elif field_to_corrupt == "source_table":
            data[field_to_corrupt] = "INVALID_TABLE_NAME"
            
    with pytest.raises(ValidationError) as exc_info:
        RecordMaestro.model_validate(data)
        
    errors = exc_info.value.errors()
    assert any(field_to_corrupt in e["loc"] for e in errors)
