from app.sync.base import NotConfiguredError, ReadingSyncBackend
from app.sync.local_only import LocalOnlyBackend

__all__ = [
    "ReadingSyncBackend",
    "NotConfiguredError",
    "LocalOnlyBackend",
    "FirestoreBackend",
]


def __getattr__(name: str) -> object:
    if name == "FirestoreBackend":
        from app.sync.firestore_stub import FirestoreBackend

        return FirestoreBackend
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
