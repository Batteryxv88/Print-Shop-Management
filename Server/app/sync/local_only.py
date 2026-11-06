from __future__ import annotations

from app.models import ReadingDTO, SyncResult
from app.storage.db import Database


class LocalOnlyBackend:
    """Сохраняет снимок в очередь sync_outbox со статусом pending."""

    def __init__(self, db: Database) -> None:
        self._db = db

    def push_reading(self, reading: ReadingDTO) -> SyncResult:
        self._db.enqueue_sync(reading)
        return SyncResult(success=True, state="pending", message="В очереди локальной синхронизации")

    def health_check(self) -> bool:
        return True
