"""conftest.py — Mocks de infraestructura para aislar Firestore/Firebase en tests.

Este archivo se ejecuta automáticamente por pytest antes de recolectar tests.
Registra mocks en sys.modules para que firebase_admin y google.cloud.firestore
no requieran credenciales reales.
"""
from __future__ import annotations

import sys
from unittest.mock import MagicMock

# Mock firebase_admin y sus submódulos antes de cualquier importación
_firebase_mock = MagicMock()
sys.modules.setdefault("firebase_admin", _firebase_mock)
sys.modules.setdefault("firebase_admin.credentials", _firebase_mock.credentials)
sys.modules.setdefault("firebase_admin.firestore", _firebase_mock.firestore)

# Mock google.cloud.firestore_v1 para ArrayUnion, ArrayRemove, Increment
_gcloud_mock = MagicMock()
sys.modules.setdefault("google", _gcloud_mock)
sys.modules.setdefault("google.cloud", _gcloud_mock.cloud)
sys.modules.setdefault("google.cloud.firestore_v1", _gcloud_mock.cloud.firestore_v1)
