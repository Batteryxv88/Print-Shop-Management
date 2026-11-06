from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Callable

from app.config import AppConfig
from app.models import Printer, ReadingDTO, SnmpTestResult, SyncResult
from app.snmp.billing import split_reading_metrics
from app.snmp.client import SnmpClient
from app.storage.db import Database
from app.sync.base import ReadingSyncBackend
from app.sync.firestore_stub import FirestoreBackend
from app.sync.local_only import LocalOnlyBackend


class CollectorService:
    def __init__(
        self,
        db: Database,
        config: AppConfig,
        snmp: SnmpClient | None = None,
    ) -> None:
        self.db = db
        self.config = config
        self.snmp = snmp or SnmpClient(
            timeout_sec=config.snmp.timeout_sec,
            retries=config.snmp.retries,
        )
        self._sync: ReadingSyncBackend = self._build_sync_backend()

    def _build_sync_backend(self) -> ReadingSyncBackend:
        if self.config.firebase.enabled:
            return FirestoreBackend(
                self.db,
                self.config.firebase,
                default_community=self.config.snmp.default_community,
            )
        return LocalOnlyBackend(self.db)

    def refresh_sync_backend(self) -> None:
        self._sync = self._build_sync_backend()

    def test_printer(self, printer: Printer) -> SnmpTestResult:
        community = printer.community or self.config.snmp.default_community
        return self.snmp.test_connection(printer.host, community, printer.profile_id)

    def _collect_one(self, printer: Printer, period_type: str) -> tuple[Printer, int | None, str | None]:
        community = printer.community or self.config.snmp.default_community
        raw, errors = self.snmp.collect_metrics(printer.host, community, printer.profile_id)
        if printer.id is None:
            raise ValueError("printer.id is required")
        if not raw and errors:
            rid = self.db.add_reading(
                printer.id,
                period_type,
                "error",
                {},
                error_message="; ".join(errors.values()),
            )
            return printer, rid, "error"
        status = "ok" if not errors else "partial"
        err_msg = "; ".join(errors.values()) if errors else None
        collected_at = datetime.now(timezone.utc)
        stored, sync_metrics = split_reading_metrics(printer.counter_preset, raw)
        rid = self.db.add_reading(
            printer.id, period_type, status, stored, err_msg, collected_at=collected_at
        )
        dto = ReadingDTO(
            reading_id=rid,
            printer_id=printer.id,
            printer_name=printer.name,
            printer_host=printer.host,
            profile_id=printer.profile_id,
            printer_color_mode=printer.color_mode,
            counter_preset=printer.counter_preset,
            collected_at=collected_at,
            period_type=period_type,
            status=status,
            metrics=sync_metrics,
        )
        self._sync.push_reading(dto)
        return printer, rid, status

    def collect_all(
        self,
        period_type: str | None = None,
        on_progress: Callable[[str, int, int], None] | None = None,
    ) -> list[tuple[Printer, int | None, str | None]]:
        period = period_type or self.config.schedule.mode
        if period not in ("daily", "monthly"):
            period = "daily"
        printers = [p for p in self.db.list_printers() if p.enabled]
        results: list[tuple[Printer, int | None, str | None]] = []
        total = len(printers)
        if total == 0:
            return results

        with ThreadPoolExecutor(max_workers=min(8, total)) as pool:
            futures = {
                pool.submit(self._collect_one, p, period): p for p in printers if p.id is not None
            }
            done = 0
            for fut in as_completed(futures):
                printer, rid, status = fut.result()
                done += 1
                if on_progress:
                    on_progress(printer.name, done, total)
                results.append((printer, rid, status))
        if self.config.firebase.enabled and period == "monthly":
            self.try_push_monthly_sl_sync(force=False)
        return results

    def pull_printers_from_firestore(self) -> SyncResult:
        backend = self._sync
        if not isinstance(backend, FirestoreBackend):
            return SyncResult(
                success=False,
                state="error",
                message="Включите Firebase в настройках",
            )
        return backend.pull_printers()

    def try_push_monthly_sl_sync(self, force: bool = False) -> SyncResult:
        backend = self._sync
        if not isinstance(backend, FirestoreBackend):
            return SyncResult(
                success=False,
                state="error",
                message="Включите Firebase в настройках",
            )
        return backend.push_monthly_counter_reading(force=force)

    def sl_period_status(self, force: bool = False) -> dict[str, object]:
        backend = self._sync
        if not isinstance(backend, FirestoreBackend):
            return {"reason": "disabled"}
        return backend.resolve_period_plan(force=force)

    def list_printers_needing_retry(self) -> list[Printer]:
        """Принтеры, у которых последний снимок — error или снимков ещё не было."""
        need: list[Printer] = []
        for p in self.db.list_printers():
            if not p.enabled or p.id is None:
                continue
            last = self.db.last_reading_for_printer(p.id)
            if last is None or last.status == "error":
                need.append(p)
        return need

    def collect_unreachable(
        self,
        on_progress: Callable[[str, int, int], None] | None = None,
    ) -> list[tuple[Printer, int | None, str | None]]:
        period = self.config.schedule.mode
        if period not in ("daily", "monthly"):
            period = "daily"
        printers = self.list_printers_needing_retry()
        if not printers:
            return []
        results: list[tuple[Printer, int | None, str | None]] = []
        total = len(printers)
        with ThreadPoolExecutor(max_workers=min(8, total)) as pool:
            futures = {pool.submit(self._collect_one, p, period): p for p in printers}
            done = 0
            for fut in as_completed(futures):
                printer, rid, status = fut.result()
                done += 1
                if on_progress:
                    on_progress(printer.name, done, total)
                results.append((printer, rid, status))
        if self.config.firebase.enabled and period == "monthly" and results:
            self.try_push_monthly_sl_sync(force=False)
        return results
