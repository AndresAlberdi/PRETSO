from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .enums import PublicationStatus, SourceTable

_ID_PATTERN = re.compile(r"^(CM|CS|CC|IdI|I|Com|B)-\d+$")
_TRA_PATTERN = re.compile(r"^Tra-\d+$")


class RecordMaestro(BaseModel):
    # Config is not needed since Pydantic V2 handles datetime isoformat natively

    # Common fields
    id: str = Field(...)
    transaction_id: str = Field(...)

    @field_validator("id")
    def validate_id(cls, v):
        if not _ID_PATTERN.match(v):
            raise ValueError(f"id must match pattern ^(CM|CS|CC|IdI|I|Com|B)-\\d+$, got: {v}")
        return v

    @field_validator("transaction_id")
    def validate_transaction_id(cls, v):
        if not _TRA_PATTERN.match(v):
            raise ValueError(f"transaction_id must match pattern ^Tra-\\d+$, got: {v}")
        return v
    source_table: SourceTable
    status: PublicationStatus = PublicationStatus.borrador
    city: str
    year: int = Field(..., ge=1500, le=1700)
    noticia: str
    fuente_bibliografica: str
    documento_codigo: Optional[str] = None
    transcripcion: Optional[str] = None
    monto_reales: Optional[float] = None
    monto_maravedis: Optional[float] = None
    compania_id: Optional[str] = None
    embedding: Optional[list[float]] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    published_at: Optional[datetime] = None
    rejection_comment: Optional[str] = None

    # CM fields
    tipo_pago: Optional[str] = None
    concepto_caja: Optional[str] = None

    # CS fields
    nombre_actor: Optional[str] = None
    cargo: Optional[str] = None
    salario_diario: Optional[float] = None

    # CC fields
    festividad: Optional[str] = None
    numero_autos: Optional[int] = None

    # IdI fields
    tipo_indicador: Optional[str] = None

    # I fields
    valor_indicador: Optional[str] = None
    unidad: Optional[str] = None

    # Com fields
    siglas: Optional[str] = None
    autor_principal: Optional[str] = None
    ambito: Optional[str] = None

    # B fields
    autor_bib: Optional[str] = None
    titulo: Optional[str] = None
    anio_publicacion: Optional[int] = None
    editorial: Optional[str] = None


class RecordMaestroCreate(BaseModel):
    transaction_id: str = Field(...)

    @field_validator("transaction_id")
    def validate_transaction_id(cls, v):
        if not _TRA_PATTERN.match(v):
            raise ValueError(f"transaction_id must match pattern ^Tra-\\d+$, got: {v}")
        return v
    source_table: SourceTable
    city: str
    year: int = Field(..., ge=1500, le=1700)
    noticia: str
    fuente_bibliografica: str
    documento_codigo: Optional[str] = None
    transcripcion: Optional[str] = None
    monto_reales: Optional[float] = None
    monto_maravedis: Optional[float] = None
    compania_id: Optional[str] = None
    created_by: Optional[str] = None
    rejection_comment: Optional[str] = None

    # CM
    tipo_pago: Optional[str] = None
    concepto_caja: Optional[str] = None

    # CS
    nombre_actor: Optional[str] = None
    cargo: Optional[str] = None
    salario_diario: Optional[float] = None

    # CC
    festividad: Optional[str] = None
    numero_autos: Optional[int] = None

    # IdI
    tipo_indicador: Optional[str] = None

    # I
    valor_indicador: Optional[str] = None
    unidad: Optional[str] = None

    # Com
    siglas: Optional[str] = None
    autor_principal: Optional[str] = None
    ambito: Optional[str] = None

    # B
    autor_bib: Optional[str] = None
    titulo: Optional[str] = None
    anio_publicacion: Optional[int] = None
    editorial: Optional[str] = None


class RecordMaestroUpdate(BaseModel):
    id: str = Field(...)
    transaction_id: Optional[str] = None

    @field_validator("id")
    def validate_id(cls, v):
        if not _ID_PATTERN.match(v):
            raise ValueError(f"id must match pattern ^(CM|CS|CC|IdI|I|Com|B)-\\d+$, got: {v}")
        return v

    @field_validator("transaction_id", mode="before")
    def validate_transaction_id(cls, v):
        if v is not None and not _TRA_PATTERN.match(v):
            raise ValueError(f"transaction_id must match pattern ^Tra-\\d+$, got: {v}")
        return v
    source_table: Optional[SourceTable] = None
    status: Optional[PublicationStatus] = None
    city: Optional[str] = None
    year: Optional[int] = Field(None, ge=1500, le=1700)
    noticia: Optional[str] = None
    fuente_bibliografica: Optional[str] = None
    documento_codigo: Optional[str] = None
    transcripcion: Optional[str] = None
    monto_reales: Optional[float] = None
    monto_maravedis: Optional[float] = None
    compania_id: Optional[str] = None
    embedding: Optional[list[float]] = None
    created_by: Optional[str] = None
    rejection_comment: Optional[str] = None

    # CM
    tipo_pago: Optional[str] = None
    concepto_caja: Optional[str] = None

    # CS
    nombre_actor: Optional[str] = None
    cargo: Optional[str] = None
    salario_diario: Optional[float] = None

    # CC
    festividad: Optional[str] = None
    numero_autos: Optional[int] = None

    # IdI
    tipo_indicador: Optional[str] = None

    # I
    valor_indicador: Optional[str] = None
    unidad: Optional[str] = None

    # Com
    siglas: Optional[str] = None
    autor_principal: Optional[str] = None
    ambito: Optional[str] = None

    # B
    autor_bib: Optional[str] = None
    titulo: Optional[str] = None
    anio_publicacion: Optional[int] = None
    editorial: Optional[str] = None
