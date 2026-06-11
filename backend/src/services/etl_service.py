"""Servicio ETL: procesa las 7 tablas CSV del proyecto PRETSO."""
from __future__ import annotations

import csv
import io
import re
import uuid
from datetime import datetime, timezone
from typing import Any

from backend.src.db.repositories import (
    async_get_document,
    async_set_document,
    get_transaction,
    set_transaction,
    add_record_to_transaction,
    RECORDS,
    TRANSACTIONS,
    COMPANIES,
)
from backend.src.models.enums import PublicationStatus, SourceTable

# Patrón válido para transaction_id
_TRA_PATTERN = re.compile(r"^Tra-\d+$")

# Campos obligatorios por tabla
_REQUIRED_FIELDS: dict[str, tuple[str, str]] = {
    "CM":  ("Indicador de registro", "Transacción"),
    "CS":  ("Indicador de registro", "Transacción"),
    "CC":  ("Indicador de registro", "Transacción"),
    "IdI": ("Indicador de registro", "Transacción"),
    "I":   ("Indicador de registro", "Indicador"),
    "Com": ("Indicador de registro", "Siglas"),
    "B":   ("Indicador de registro", "Autores"),
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _parse_year(value: str) -> int | None:
    """Extrae el primer año de un string (ej: '1579-1580' → 1579, '1603' → 1603)."""
    if not value or not value.strip():
        return None
    # Busca el primer grupo de 4 dígitos
    match = re.search(r"\b(\d{4})\b", value.strip())
    if match:
        return int(match.group(1))
    return None


def _parse_float(value: str) -> float | None:
    """Intenta parsear un valor monetario a float. Devuelve None si no es posible."""
    if not value or not value.strip():
        return None
    # Eliminar texto no numérico (ej: "8000 reales" → "8000")
    cleaned = re.sub(r"[^\d.,\-]", "", value.strip())
    # Normalizar coma decimal
    cleaned = cleaned.replace(",", ".")
    # Eliminar puntos de miles si hay más de uno o si hay decimales
    parts = cleaned.split(".")
    if len(parts) > 2:
        # Probablemente separadores de miles: "1.234.567" → "1234567"
        cleaned = "".join(parts[:-1]) + "." + parts[-1]
    try:
        return float(cleaned)
    except (ValueError, TypeError):
        return None


def _map_row(row: dict, source_table: str, row_num: int) -> tuple[dict | None, dict | None]:
    """
    Mapea una fila CSV a un dict de RecordMaestro.
    Devuelve (record_dict, None) si es válida, o (None, error_dict) si es inválida.
    """
    req = _REQUIRED_FIELDS.get(source_table)
    if req is None:
        return None, {"row": row_num, "field": "source_table", "reason": f"Tabla desconocida: {source_table}"}

    id_field, second_field = req

    # Validar campo de ID
    record_id = row.get(id_field, "").strip()
    if not record_id:
        return None, {"row": row_num, "field": id_field, "reason": f"Campo obligatorio vacío: {id_field}"}

    # Validar segundo campo obligatorio
    second_val = row.get(second_field, "").strip()
    if not second_val:
        return None, {"row": row_num, "field": second_field, "reason": f"Campo obligatorio vacío: {second_field}"}

    # Para tablas con Transacción, validar el patrón
    transaction_id: str | None = None
    if source_table in ("CM", "CS", "CC", "IdI"):
        transaction_id = row.get("Transacción", "").strip()
        if not transaction_id or not _TRA_PATTERN.match(transaction_id):
            return None, {"row": row_num, "field": "Transacción", "reason": "transaction_id inválido"}
    elif source_table == "I":
        # I no tiene Transacción; usamos un ID sintético basado en el indicador
        transaction_id = None
    elif source_table in ("Com", "B"):
        transaction_id = None

    now = datetime.now(timezone.utc)

    # Campos comunes
    city = row.get("Ciudad", "").strip() or ""
    year_raw = row.get("Año", row.get("Años", "")).strip()
    year = _parse_year(year_raw)

    noticia = (
        row.get("Noticia", "")
        or row.get("Indicador", "")
        or row.get("Otros datos para elaborar indicadores", "")
    ).strip()

    fuente = (
        row.get("Fuentes para la generación del dato", "")
        or row.get("Referencias bibliográficas", "")
    ).strip()

    doc_codigo = (
        row.get("Código documento", "")
        or row.get("Códigos documentos", "")
        or row.get("Código documentos", "")
    ).strip() or None

    compania_id = row.get("Compañía", "").strip() or None

    notas = (row.get("Notas", "") or row.get("Nota", "")).strip() or None
    documento = row.get("Documento", "").strip() or None

    record: dict[str, Any] = {
        "id": record_id,
        "source_table": source_table,
        "status": PublicationStatus.borrador.value,
        "city": city,
        "year": year,
        "noticia": noticia,
        "fuente_bibliografica": fuente,
        "documento_codigo": doc_codigo,
        "compania_id": compania_id,
        "notas": notas,
        "documento": documento,
        "created_by": None,  # se sobreescribe en run_etl
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }

    if transaction_id:
        record["transaction_id"] = transaction_id

    # Campos específicos por tabla
    if source_table == "CM":
        record["concepto_caja"] = row.get("Data", "").strip() or None
        record["cargo"] = row.get("Cargo", "").strip() or None
        record["otros_bienes"] = row.get("Otros bienes de la compañía", "").strip() or None
        record["normativa_caja"] = row.get("Datos sobre normativa de manejo de caja", "").strip() or None
        if not record.get("autor_bib"):
            record["autor_bib"] = row.get("Autores", "").strip() or None

    elif source_table == "CS":
        record["valor_indicador"] = row.get("Monto a pagar", "").strip() or None
        record["salario_diario"] = _parse_float(row.get("Ración diaria", ""))
        record["monto_reales"] = _parse_float(row.get("Pago por representación", ""))
        record["cargo"] = row.get("Encargo", "").strip() or None
        record["pagador"] = row.get("Pagador", "").strip() or None
        record["beneficiario"] = row.get("Beneficiario", "").strip() or None
        record["dias_racion"] = row.get("Días de ración en un año", "").strip() or None
        
        # Handling double spaces inside keys just in case
        rep_ano = row.get("Número de representaciones  por año", "") or row.get("Número de representaciones por año", "")
        record["representaciones_ano"] = rep_ano.strip() or None
        record["representaciones_estimadas"] = row.get("Número estimado de representaciones por año", "").strip() or None

    elif source_table == "CC":
        record["festividad"] = row.get("Encargo", "").strip() or None
        record["monto_reales"] = _parse_float(row.get("Monto a pagar", ""))
        record["encargado"] = row.get("Encargado", "").strip() or None
        record["fondos"] = row.get("Fondos", "").strip() or None

    elif source_table == "IdI":
        record["tipo_indicador"] = row.get("Categorías", "").strip() or None
        record["monto_reales"] = _parse_float(row.get("Monto", ""))
        record["concepto_caja"] = row.get("Concepto", "").strip() or None

    elif source_table == "I":
        record["monto_reales"] = _parse_float(row.get("Monto", ""))
        record["concepto_caja"] = row.get("Concepto", "").strip() or None

    elif source_table == "Com":
        record["siglas"] = row.get("Siglas", "").strip() or None
        record["autor_principal"] = row.get("Autores", "").strip() or None
        record["ambito"] = row.get("España / América", "").strip() or None
        record["valor_indicador"] = row.get("Temporadas teatrales", "").strip() or None

    elif source_table == "B":
        record["autor_bib"] = row.get("Autores", "").strip() or None
        record["titulo"] = row.get("Referencias bibliográficas", "").strip() or None

    return record, None


# ---------------------------------------------------------------------------
# ETL principal
# ---------------------------------------------------------------------------

async def run_etl(content: bytes, source_table: str, user_uid: str) -> dict:
    """
    Procesa un CSV y crea RecordMaestro en estado borrador.
    Devuelve: {imported: int, rejected: int, errors: list[{row, field, reason}], skipped: int}
    """
    imported = 0
    rejected = 0
    skipped = 0
    errors: list[dict] = []

    text = content.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))

    for row_num, row in enumerate(reader, start=2):  # fila 1 = cabecera
        # Limpiar claves con espacios extra
        clean_row = {k.strip(): v.strip() if isinstance(v, str) else v for k, v in row.items() if k}

        record_dict, error = _map_row(clean_row, source_table, row_num)

        if error:
            errors.append(error)
            rejected += 1
            continue

        record_id = record_dict["id"]

        # Idempotencia: verificar si ya existe
        existing = await async_get_document(RECORDS, record_id)
        if existing is not None:
            skipped += 1
            continue

        # Asignar usuario creador
        record_dict["created_by"] = user_uid

        # Persistir registro
        await async_set_document(RECORDS, record_id, record_dict)

        # Si es un registro de la tabla Com, creamos/actualizamos el documento en la colección 'companies'
        if source_table == "Com":
            temporadas = []
            val_ind = record_dict.get("valor_indicador")
            if val_ind:
                temporadas = [t.strip() for t in val_ind.split(",") if t.strip()]
            
            company_doc = {
                "id": record_id,
                "siglas": record_dict.get("siglas") or "",
                "autor_principal": record_dict.get("autor_principal") or "",
                "ambito": record_dict.get("ambito") or "España",
                "temporadas": temporadas,
                "transaction_ids": [],
            }
            await async_set_document(COMPANIES, record_id, company_doc)

        # Si el registro tiene compania_id (siglas) y transaction_id, vinculamos el transaction_id a la compañía
        compania_id = record_dict.get("compania_id")
        transaction_id = record_dict.get("transaction_id")
        if compania_id and transaction_id:
            from google.cloud.firestore_v1 import ArrayUnion
            import asyncio
            from backend.src.db.firestore import get_db, with_retry

            def _link_tx_to_company():
                ref = get_db().collection(COMPANIES)
                docs = list(ref.where("siglas", "==", compania_id).stream())
                for doc in docs:
                    doc.reference.update({"transaction_ids": ArrayUnion([transaction_id])})

            loop = asyncio.get_event_loop()
            await loop.run_in_executor(None, lambda: with_retry(_link_tx_to_company))

        # Gestionar transacción si aplica
        transaction_id = record_dict.get("transaction_id")
        if transaction_id:
            import asyncio
            from functools import partial

            loop = asyncio.get_event_loop()

            existing_tx = await loop.run_in_executor(None, partial(get_transaction, transaction_id))
            if existing_tx is None:
                now = datetime.now(timezone.utc)
                await loop.run_in_executor(
                    None,
                    partial(set_transaction, transaction_id, {
                        "id": transaction_id,
                        "created_at": now.isoformat(),
                        "updated_at": now.isoformat(),
                        "record_ids": [],
                    }),
                )
            await loop.run_in_executor(
                None,
                partial(add_record_to_transaction, transaction_id, record_id),
            )

        imported += 1

    return {
        "imported": imported,
        "rejected": rejected,
        "errors": errors,
        "skipped": skipped,
    }
