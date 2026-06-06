"""Servicio de búsqueda semántica sobre el corpus PRETSO."""
from __future__ import annotations

import math
import io
import csv
import logging
from collections import Counter
from typing import Any

from backend.src.db.repositories import async_query_collection, async_update_document, RECORDS
from backend.src.services.embedding_service import generate_embedding

logger = logging.getLogger(__name__)

SIMILARITY_THRESHOLD = 0.3  # umbral mínimo configurable
_MAX_CANDIDATES = 1000
_FALLBACK_SUGGESTIONS = ["compañía", "representación", "Corpus Christi"]


# ---------------------------------------------------------------------------
# Función principal de búsqueda
# ---------------------------------------------------------------------------

async def search(
    query: str | None = None,
    city: str | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    source_table: str | None = None,
    company: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> dict:
    """Búsqueda semántica con filtros opcionales sobre el corpus publicado.

    Flujo:
    1. Construye filtros Firestore: status=="publicado" + filtros opcionales.
    2. Recupera candidatos de Firestore (máx. 1 000).
    3. Si query está vacía, devuelve los candidatos aplicando paginación.
    4. Genera embedding de la query.
    5. Calcula similitud coseno entre query_embedding y embedding de cada candidato.
    6. Filtra por SIMILARITY_THRESHOLD.
    7. Ordena por score descendente.
    8. Pagina y devuelve resultados.
    """
    # 1. Construir filtros
    filters: list[tuple] = [("status", "==", "publicado")]
    if city is not None:
        filters.append(("city", "==", city))
    if year_from is not None:
        filters.append(("year", ">=", year_from))
    if year_to is not None:
        filters.append(("year", "<=", year_to))
    if source_table is not None:
        filters.append(("source_table", "==", source_table))
    if company is not None:
        filters.append(("compania_id", "==", company))

    # 2. Recuperar candidatos
    candidates: list[dict[str, Any]] = await async_query_collection(
        RECORDS,
        filters=filters,
        limit=_MAX_CANDIDATES,
    )

    if not query:
        total = len(candidates)
        offset = (page - 1) * page_size
        page_items = candidates[offset: offset + page_size]
        results = [
            {
                "id": doc.get("id"),
                "transaction_id": doc.get("transaction_id"),
                "city": doc.get("city"),
                "year": doc.get("year"),
                "noticia_fragment": _fragment(doc.get("noticia", "")),
                "score": 1.0,
            }
            for doc in page_items
        ]
        return {
            "results": results,
            "total": total,
            "page": page,
            "page_size": page_size,
            "suggestions": [],
        }

    # 3. Generar embedding de la query
    query_embedding = await generate_embedding(query)

    # 4 & 5. Calcular similitud y filtrar
    scored: list[tuple[float, dict]] = []
    for doc in candidates:
        doc_embedding = doc.get("embedding")
        if not doc_embedding:
            continue
        score = cosine_similarity(query_embedding, doc_embedding)
        if score >= SIMILARITY_THRESHOLD:
            scored.append((score, doc))

    # 6. Ordenar por score descendente
    scored.sort(key=lambda x: x[0], reverse=True)

    total = len(scored)

    # 7. Paginar
    offset = (page - 1) * page_size
    page_items = scored[offset: offset + page_size]

    results = [
        {
            "id": doc.get("id"),
            "transaction_id": doc.get("transaction_id"),
            "city": doc.get("city"),
            "year": doc.get("year"),
            "noticia_fragment": _fragment(doc.get("noticia", "")),
            "score": round(score, 6),
        }
        for score, doc in page_items
    ]

    # Sugerencias cuando no hay resultados
    suggestions: list[str] = []
    if total == 0:
        suggestions = _FALLBACK_SUGGESTIONS

    return {
        "results": results,
        "total": total,
        "page": page,
        "page_size": page_size,
        "suggestions": suggestions,
    }


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Calcula la similitud coseno entre dos vectores."""
    if len(a) != len(b):
        raise ValueError(
            f"Los vectores deben tener la misma dimensión: {len(a)} != {len(b)}"
        )
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)


async def index_record_embedding(record_id: str, text: str) -> None:
    """Genera y almacena el embedding de un registro en Firestore."""
    embedding = await generate_embedding(text)
    await async_update_document(RECORDS, record_id, {"embedding": embedding})
    logger.info("Embedding indexado para registro '%s'.", record_id)


def _fragment(text: str, max_chars: int = 200) -> str:
    """Devuelve un fragmento del texto de noticia."""
    if len(text) <= max_chars:
        return text
    return text[:max_chars].rsplit(" ", 1)[0] + "…"


async def get_stats() -> dict:
    """Devuelve conteos agregados por ciudad y por año para los registros publicados."""
    records = await async_query_collection(RECORDS, filters=[("status", "==", "publicado")])
    cities = Counter()
    years = Counter()
    for r in records:
        city = r.get("city")
        if city:
            cities[city] += 1
        year = r.get("year")
        if year:
            years[year] += 1
            
    # Formatear para recharts
    city_data = [{"name": c, "value": count} for c, count in cities.items()]
    year_data = [{"name": str(y), "value": count} for y, count in sorted(years.items())]
    
    return {"cities": city_data, "years": year_data}


async def export_records(
    query: str | None = None,
    city: str | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    source_table: str | None = None,
    company: str | None = None,
) -> Any:
    """Genera un iterador CSV con los resultados filtrados, máximo 1000."""
    result = await search(query, city, year_from, year_to, source_table, company, page=1, page_size=1000)
    items = result.get("results", [])
    
    # We yield chunks as strings
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow(["ID", "Transaccion", "Ciudad", "Anio", "Fragmento Noticia", "Score"])
    yield output.getvalue()
    output.seek(0)
    output.truncate(0)
    
    for item in items:
        writer.writerow([
            item.get("id"),
            item.get("transaction_id"),
            item.get("city"),
            item.get("year"),
            item.get("noticia_fragment", "").replace("\n", " "),
            item.get("score")
        ])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
