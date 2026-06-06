"""Firestore CRUD repositories for all collections."""
from __future__ import annotations

import asyncio
from functools import partial
from typing import Any

from google.cloud.firestore_v1 import ArrayUnion, ArrayRemove

from .firestore import get_db, with_retry

# Collection names
RECORDS = "records"
TRANSACTIONS = "transactions"
COMPANIES = "companies"
ANNOUNCEMENTS = "announcements"
USERS = "users"
AUDIT_LOG = "audit_log"
CONFIG = "config"

LAUNCH_RULE_DOC = "launch_rule"


# ---------------------------------------------------------------------------
# Generic helpers
# ---------------------------------------------------------------------------

def get_document(collection: str, doc_id: str) -> dict | None:
    """Return a document dict or None if it does not exist."""
    def _op():
        doc = get_db().collection(collection).document(doc_id).get()
        return doc.to_dict() if doc.exists else None

    return with_retry(_op)


def set_document(collection: str, doc_id: str, data: dict) -> None:
    """Create or overwrite a document."""
    def _op():
        get_db().collection(collection).document(doc_id).set(data)

    with_retry(_op)


def update_document(collection: str, doc_id: str, data: dict) -> None:
    """Partially update a document (merge)."""
    def _op():
        get_db().collection(collection).document(doc_id).update(data)

    with_retry(_op)


def delete_document(collection: str, doc_id: str) -> None:
    """Delete a document."""
    def _op():
        get_db().collection(collection).document(doc_id).delete()

    with_retry(_op)


def query_collection(
    collection: str,
    filters: list[tuple] = [],
    order_by: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """Query a collection with optional filters, ordering, and pagination.

    Each filter is a tuple ``(field, operator, value)`` where operator is a
    Firestore comparison string such as ``"=="``, ``"<"``, ``">"``, etc.
    """
    def _op():
        ref: Any = get_db().collection(collection)
        for field, op, value in filters:
            ref = ref.where(field, op, value)
        if order_by:
            ref = ref.order_by(order_by)
        ref = ref.limit(limit).offset(offset)
        return [doc.to_dict() for doc in ref.stream()]

    return with_retry(_op)


def count_collection(collection: str, filters: list[tuple] | None = None) -> int:
    """Return the number of documents matching the given filters."""
    def _op():
        ref: Any = get_db().collection(collection)
        for field, op, value in (filters or []):
            ref = ref.where(field, op, value)
        return len(list(ref.stream()))

    return with_retry(_op)


# ---------------------------------------------------------------------------
# Async wrappers (run sync Firestore SDK in a thread pool executor)
# ---------------------------------------------------------------------------

async def _run(fn, *args, **kwargs):
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, partial(fn, *args, **kwargs))


async def async_get_document(collection: str, doc_id: str) -> dict | None:
    return await _run(get_document, collection, doc_id)


async def async_set_document(collection: str, doc_id: str, data: dict) -> None:
    await _run(set_document, collection, doc_id, data)


async def async_update_document(collection: str, doc_id: str, data: dict) -> None:
    await _run(update_document, collection, doc_id, data)


async def async_delete_document(collection: str, doc_id: str) -> None:
    await _run(delete_document, collection, doc_id)


async def async_query_collection(
    collection: str,
    filters: list[tuple] | None = None,
    order_by: str | None = None,
    order_dir: str = "asc",
    limit: int | None = None,
    offset: int | None = None,
) -> list[dict]:
    def _op():
        ref: Any = get_db().collection(collection)
        for field, op, value in (filters or []):
            ref = ref.where(field, op, value)
        if order_by:
            direction = "ASCENDING" if order_dir.lower() == "asc" else "DESCENDING"
            ref = ref.order_by(order_by, direction=direction)
        if limit is not None:
            ref = ref.limit(limit)
        if offset is not None:
            ref = ref.offset(offset)
        return [doc.to_dict() for doc in ref.stream()]

    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: with_retry(_op))


async def async_count_collection(
    collection: str, filters: list[tuple] | None = None
) -> int:
    return await _run(count_collection, collection, filters)


# ---------------------------------------------------------------------------
# Records
# ---------------------------------------------------------------------------

def get_record(record_id: str) -> dict | None:
    return get_document(RECORDS, record_id)


def set_record(record_id: str, data: dict) -> None:
    set_document(RECORDS, record_id, data)


def query_records(
    status: str | None = None,
    city: str | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    source_table: str | None = None,
    compania_id: str | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[dict], int]:
    """Return (records, total_count) for the given filters and page."""
    filters: list[tuple] = []
    if status is not None:
        filters.append(("status", "==", status))
    if city is not None:
        filters.append(("city", "==", city))
    if year_from is not None:
        filters.append(("year", ">=", year_from))
    if year_to is not None:
        filters.append(("year", "<=", year_to))
    if source_table is not None:
        filters.append(("source_table", "==", source_table))
    if compania_id is not None:
        filters.append(("compania_id", "==", compania_id))

    # Fetch all matching docs to compute total_count (Firestore has no COUNT)
    all_docs = query_collection(RECORDS, filters=filters, limit=10_000, offset=0)
    total_count = len(all_docs)

    offset = (page - 1) * page_size
    page_docs = all_docs[offset: offset + page_size]
    return page_docs, total_count


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

def get_transaction(transaction_id: str) -> dict | None:
    return get_document(TRANSACTIONS, transaction_id)


def set_transaction(transaction_id: str, data: dict) -> None:
    set_document(TRANSACTIONS, transaction_id, data)


def add_record_to_transaction(transaction_id: str, record_id: str) -> None:
    """Append record_id to the transaction's record_ids array (idempotent)."""
    def _op():
        get_db().collection(TRANSACTIONS).document(transaction_id).update(
            {"record_ids": ArrayUnion([record_id])}
        )

    with_retry(_op)


def remove_record_from_transaction(transaction_id: str, record_id: str) -> None:
    """Remove record_id from the transaction's record_ids array."""
    def _op():
        get_db().collection(TRANSACTIONS).document(transaction_id).update(
            {"record_ids": ArrayRemove([record_id])}
        )

    with_retry(_op)


# ---------------------------------------------------------------------------
# Launch rule (config/launch_rule)
# ---------------------------------------------------------------------------

def get_launch_rule() -> dict:
    """Return the launch rule document, creating defaults if absent."""
    doc = get_document(CONFIG, LAUNCH_RULE_DOC)
    if doc is None:
        doc = {"published_count": 0, "threshold": 10, "portal_active": False}
        set_document(CONFIG, LAUNCH_RULE_DOC, doc)
    return doc


def update_launch_rule(data: dict) -> None:
    update_document(CONFIG, LAUNCH_RULE_DOC, data)


def increment_published_count(delta: int = 1) -> int:
    """Atomically increment published_count and return the new value."""
    from google.cloud.firestore_v1 import Increment

    def _op():
        ref = get_db().collection(CONFIG).document(LAUNCH_RULE_DOC)
        ref.update({"published_count": Increment(delta)})
        updated = ref.get()
        doc = updated.to_dict() or {}
        new_count: int = doc.get("published_count", 0)
        # Keep portal_active in sync
        threshold: int = doc.get("threshold", 10)
        if doc.get("portal_active") != (new_count >= threshold):
            ref.update({"portal_active": new_count >= threshold})
        return new_count

    return with_retry(_op)
