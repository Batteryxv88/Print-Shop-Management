from __future__ import annotations

from typing import Protocol

from app.models import ReadingDTO, SyncResult


class NotConfiguredError(Exception):
    """Firebase или другой backend не настроен."""


class ReadingSyncBackend(Protocol):
    def push_reading(self, reading: ReadingDTO) -> SyncResult: ...

    def health_check(self) -> bool: ...
