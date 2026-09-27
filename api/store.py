"""Persistence interface + in-memory implementation.

The Firestore implementation (same interface) is added when the GCP project exists.
"""
from __future__ import annotations

import threading
from typing import Protocol

from common.schemas import Assessment, AuditEntry, FeatureMode


class VersionConflict(Exception):
    """The stored assessment changed since the caller read it."""


class Repository(Protocol):
    def add(self, a: Assessment) -> None: ...
    def get(self, assessment_id: str) -> Assessment | None: ...
    def list_by_mode(self, mode: FeatureMode) -> list[Assessment]: ...
    def update(self, a: Assessment, expected_version: int) -> None: ...
    def next_id(self) -> str: ...
    def add_audit(self, entry: AuditEntry) -> None: ...
    def list_audit(self) -> list[AuditEntry]: ...
    def next_audit_id(self) -> str: ...


class InMemoryRepository:
    """Thread-safe, process-local store. Data is lost on restart (fine for dev and tests)."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._items: dict[str, Assessment] = {}
        self._audit: list[AuditEntry] = []
        self._n = 0
        self._an = 0

    def next_id(self) -> str:
        with self._lock:
            self._n += 1
            return f"A-{1000 + self._n}"

    def next_audit_id(self) -> str:
        with self._lock:
            self._an += 1
            return f"E-{self._an}"

    def add(self, a: Assessment) -> None:
        with self._lock:
            self._items[a.id] = a

    def get(self, assessment_id: str) -> Assessment | None:
        with self._lock:
            return self._items.get(assessment_id)

    def list_by_mode(self, mode: FeatureMode) -> list[Assessment]:
        with self._lock:
            return sorted((a for a in self._items.values() if a.mode == mode), key=lambda a: a.created_at, reverse=True)

    def update(self, a: Assessment, expected_version: int) -> None:
        """Compare-and-set on version."""
        with self._lock:
            current = self._items.get(a.id)
            if current is None or current.version != expected_version:
                raise VersionConflict(a.id)
            self._items[a.id] = a

    def add_audit(self, entry: AuditEntry) -> None:
        with self._lock:
            self._audit.insert(0, entry)

    def list_audit(self) -> list[AuditEntry]:
        with self._lock:
            return list(self._audit)
