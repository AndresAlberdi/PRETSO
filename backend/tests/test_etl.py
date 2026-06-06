"""Tarea 10 — Punto de control del backend: pruebas del servicio ETL.

Cubre:
  1. _map_row con fila CM válida
  2. _map_row con transaction_id inválido
  3. _map_row con campo obligatorio vacío
  4. _parse_year — varios casos
  5. _parse_float — varios casos
  6. _map_row con tabla Com
  7. _map_row con tabla B
"""
from __future__ import annotations

import pytest

from backend.src.services.etl_service import _map_row, _parse_year, _parse_float
from backend.src.models.enums import PublicationStatus


# ---------------------------------------------------------------------------
# 1. ETL — fila válida CM
# ---------------------------------------------------------------------------

class TestMapRowCM:
    """_map_row con una fila CM válida produce un dict correcto."""

    def test_valid_cm_row_returns_record(self):
        row = {
            "Indicador de registro": "CM-1",
            "Transacción": "Tra-42",
            "Ciudad": "Sevilla",
            "Año": "1600",
            "Noticia": "Pago de salario",
            "Fuentes para la generación del dato": "AGI",
            "Data": "Concepto de caja",
            "Cargo": "Actor",
        }
        record, error = _map_row(row, "CM", 2)

        assert error is None
        assert record is not None
        assert record["id"] == "CM-1"
        assert record["transaction_id"] == "Tra-42"
        assert record["status"] == PublicationStatus.borrador.value
        assert record["source_table"] == "CM"


# ---------------------------------------------------------------------------
# 2. ETL — transaction_id inválido
# ---------------------------------------------------------------------------

class TestMapRowInvalidTransactionId:
    """_map_row con Transacción='X' devuelve error con reason que contiene 'inválido'."""

    def test_invalid_transaction_id_returns_error(self):
        row = {
            "Indicador de registro": "CM-1",
            "Transacción": "X",
            "Ciudad": "Sevilla",
            "Año": "1600",
            "Noticia": "Pago",
            "Fuentes para la generación del dato": "AGI",
        }
        record, error = _map_row(row, "CM", 2)

        assert record is None
        assert error is not None
        assert "inválido" in error["reason"]

    def test_empty_transaction_id_returns_error(self):
        """Transacción vacía falla como campo obligatorio vacío (antes de validar patrón)."""
        row = {
            "Indicador de registro": "CM-1",
            "Transacción": "",
            "Ciudad": "Sevilla",
            "Año": "1600",
            "Noticia": "Pago",
            "Fuentes para la generación del dato": "AGI",
        }
        record, error = _map_row(row, "CM", 2)

        assert record is None
        assert error is not None
        # Transacción vacía puede fallar como campo obligatorio vacío o como inválido
        assert "Transacción" in error["reason"] or error["field"] == "Transacción"


# ---------------------------------------------------------------------------
# 3. ETL — campo obligatorio vacío
# ---------------------------------------------------------------------------

class TestMapRowMissingRequiredField:
    """_map_row con 'Indicador de registro' vacío devuelve error."""

    def test_empty_indicador_de_registro_returns_error(self):
        row = {
            "Indicador de registro": "",
            "Transacción": "Tra-1",
            "Ciudad": "Sevilla",
            "Año": "1600",
            "Noticia": "Pago",
            "Fuentes para la generación del dato": "AGI",
        }
        record, error = _map_row(row, "CM", 2)

        assert record is None
        assert error is not None
        assert error["field"] == "Indicador de registro"

    def test_missing_indicador_de_registro_key_returns_error(self):
        row = {
            "Transacción": "Tra-1",
            "Ciudad": "Sevilla",
        }
        record, error = _map_row(row, "CM", 2)

        assert record is None
        assert error is not None


# ---------------------------------------------------------------------------
# 4. ETL — _parse_year
# ---------------------------------------------------------------------------

class TestParseYear:
    """_parse_year extrae el primer año de un string."""

    def test_range_returns_first_year(self):
        assert _parse_year("1579-1580") == 1579

    def test_single_year(self):
        assert _parse_year("1603") == 1603

    def test_empty_string_returns_none(self):
        assert _parse_year("") is None

    def test_sin_fecha_returns_none(self):
        assert _parse_year("sin fecha") is None

    def test_none_like_whitespace_returns_none(self):
        assert _parse_year("   ") is None


# ---------------------------------------------------------------------------
# 5. ETL — _parse_float
# ---------------------------------------------------------------------------

class TestParseFloat:
    """_parse_float convierte strings monetarios a float."""

    def test_value_with_text_suffix(self):
        assert _parse_float("8000 reales") == 8000.0

    def test_non_numeric_returns_none(self):
        assert _parse_float("X") is None

    def test_empty_string_returns_none(self):
        assert _parse_float("") is None

    def test_comma_decimal_separator(self):
        assert _parse_float("5,5") == 5.5

    def test_plain_integer_string(self):
        assert _parse_float("1234") == 1234.0

    def test_none_like_whitespace_returns_none(self):
        assert _parse_float("   ") is None


# ---------------------------------------------------------------------------
# 6. ETL — fila válida Com
# ---------------------------------------------------------------------------

class TestMapRowCom:
    """_map_row con tabla Com produce dict con siglas, autor_principal, ambito."""

    def test_valid_com_row(self):
        row = {
            "Indicador de registro": "Com-1",
            "Siglas": "COMP-A",
            "Autores": "Juan Pérez",
            "España / América": "España",
            "Temporadas teatrales": "1600-1610",
            "Ciudad": "Madrid",
            "Año": "1600",
            "Noticia": "Compañía teatral",
            "Fuentes para la generación del dato": "AGI",
        }
        record, error = _map_row(row, "Com", 2)

        assert error is None
        assert record is not None
        assert record["siglas"] == "COMP-A"
        assert record["autor_principal"] == "Juan Pérez"
        assert record["ambito"] == "España"

    def test_com_has_no_transaction_id(self):
        row = {
            "Indicador de registro": "Com-2",
            "Siglas": "COMP-B",
            "Autores": "María García",
            "España / América": "América",
        }
        record, error = _map_row(row, "Com", 3)

        assert error is None
        assert "transaction_id" not in record


# ---------------------------------------------------------------------------
# 7. ETL — fila válida B
# ---------------------------------------------------------------------------

class TestMapRowB:
    """_map_row con tabla B produce dict con autor_bib, titulo."""

    def test_valid_b_row(self):
        row = {
            "Indicador de registro": "B-1",
            "Autores": "Lope de Vega",
            "Referencias bibliográficas": "Arte nuevo de hacer comedias",
            "Ciudad": "Madrid",
            "Año": "1609",
            "Noticia": "Obra dramática",
            "Fuentes para la generación del dato": "BNE",
        }
        record, error = _map_row(row, "B", 2)

        assert error is None
        assert record is not None
        assert record["autor_bib"] == "Lope de Vega"
        assert record["titulo"] == "Arte nuevo de hacer comedias"

    def test_b_has_no_transaction_id(self):
        row = {
            "Indicador de registro": "B-2",
            "Autores": "Calderón de la Barca",
            "Referencias bibliográficas": "La vida es sueño",
        }
        record, error = _map_row(row, "B", 3)

        assert error is None
        assert "transaction_id" not in record
