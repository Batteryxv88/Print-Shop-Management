"""Синхронизация с Cloud Firestore приложения SL (Print Shop Management)."""

from __future__ import annotations

from typing import Any

from app.config import FirebaseConfig
from app.models import ReadingDTO, SyncResult
from app.storage.db import Database
from app.sync.base import NotConfiguredError
from app.sync.cloud_printer import profile_and_preset_for_remote
from app.sync.sl_firestore import SlFirestore
from app.sync.sl_mapping import local_color_mode_from_sl, merge_sl_printer_entries


class FirestoreBackend:
    """
    Коллекции SL:
      Printers/{id}
      CounterReadings/{YYYY-MM}
      AppSettings/main
    """

    def __init__(
        self,
        db: Database,
        config: FirebaseConfig,
        default_community: str = "public",
    ) -> None:
        self._db = db
        self._config = config
        self._default_community = default_community
        self._fs = SlFirestore(config)

    def health_check(self) -> bool:
        ok, _msg = self._fs.health_check_details()
        return ok

    def health_check_message(self) -> str:
        _ok, msg = self._fs.health_check_details()
        return msg

    def push_reading(self, reading: ReadingDTO) -> SyncResult:
        """SNMP-снимок уже в SQLite; в SL уходит агрегат за месяц отдельным шагом."""
        return SyncResult(
            success=True,
            state="local",
            message="Снимок сохранён локально; отправка в SL — вкладка «Синхронизация»",
        )

    def pull_printers(self) -> SyncResult:
        try:
            remote_list = self._fs.fetch_printers()
            seen_ids: set[str] = set()
            updated = 0
            created = 0
            skipped_no_ip = 0
            for remote in remote_list:
                if not remote.ip:
                    skipped_no_ip += 1
                    continue
                seen_ids.add(remote.firestore_id)
                profile_id, preset = profile_and_preset_for_remote(remote)
                color_mode = local_color_mode_from_sl(remote.color_mode)
                action = self._db.upsert_printer_from_cloud(
                    firestore_id=remote.firestore_id,
                    name=remote.name,
                    host=remote.ip,
                    model=remote.model,
                    profile_id=profile_id,
                    counter_preset=preset,
                    color_mode=color_mode,
                    default_community=self._default_community,
                )
                if action == "created":
                    created += 1
                else:
                    updated += 1
            disabled = self._db.disable_cloud_printers_not_in(seen_ids)
            msg = (
                f"Загружено из Firestore: создано {created}, обновлено {updated}, "
                f"без IP пропущено {skipped_no_ip}, отключено локально {disabled}"
            )
            return SyncResult(success=True, state="ok", message=msg)
        except NotConfiguredError as exc:
            return SyncResult(success=False, state="error", message=str(exc))
        except Exception as exc:
            return SyncResult(success=False, state="error", message=str(exc))

    def resolve_period_plan(self, force: bool = False) -> dict[str, Any]:
        plan = self._fs.resolve_period_to_collect(force=force)
        return {
            "period_key": plan.period_key,
            "counter_reading_day": plan.counter_reading_day,
            "reason": plan.reason,
        }

    def _period_key_for_push(self, force: bool) -> tuple[str | None, str, SyncResult | None]:
        plan = self._fs.resolve_period_to_collect(force=force)
        if plan.reason == "no-day":
            return None, plan.reason, SyncResult(
                success=False,
                state="skipped",
                message="В AppSettings не задан counterReadingDay",
            )
        if plan.reason == "too-early" and not force:
            return None, plan.reason, SyncResult(
                success=False,
                state="skipped",
                message="Ещё рано для активного периода снятия",
            )
        period_key = plan.period_key
        if not period_key and force:
            from datetime import datetime

            from app.sync.period import to_period_key

            now = datetime.now()
            period_key = to_period_key(now.year, now.month)
        if not period_key:
            return None, plan.reason, SyncResult(
                success=False,
                state="error",
                message="Не удалось определить periodKey",
            )
        return period_key, plan.reason, None

    def push_monthly_counter_reading(self, force: bool = False) -> SyncResult:
        try:
            period_key, plan_reason, early = self._period_key_for_push(force)
            if early:
                return early

            entries, missing = self._db.build_sl_printer_entries()
            if not entries:
                return SyncResult(
                    success=False,
                    state="error",
                    message="Нет успешных SNMP-снимков для синхронизированных принтеров",
                )
            note = f"Без снимка: {', '.join(missing)}" if missing else ""

            existing = self._fs.fetch_counter_reading(period_key or "")
            added = 0
            if existing:
                prev = existing.get("printers") or []
                if not isinstance(prev, list):
                    prev = []
                prev_ids = {str(p.get("printerId") or "") for p in prev if p.get("printerId")}
                added = sum(
                    1
                    for e in entries
                    if str(e.get("printerId") or "") and str(e.get("printerId")) not in prev_ids
                )
                merged = merge_sl_printer_entries(prev, entries)
                self._fs.update_counter_reading(
                    period_key or "",
                    merged,
                    self._config.agent_user_name,
                    note,
                )
                action = "merged"
                out_printers = merged
            else:
                if plan_reason == "already-done":
                    return SyncResult(
                        success=False,
                        state="skipped",
                        message=f"Показания за {period_key} уже внесены в SL, но документ не прочитан",
                    )
                self._fs.create_counter_reading(
                    period_key or "",
                    entries,
                    self._config.agent_user_id,
                    self._config.agent_user_name,
                    note,
                )
                action = "created"
                out_printers = entries

            payload = {
                "period_key": period_key,
                "printers": out_printers,
                "source": "snmp-desktop-collector",
                "missing": missing,
                "action": action,
            }
            self._db.enqueue_period_sync(period_key or "", payload, "sent", None)
            if action == "merged":
                msg = f"Дополнено в SL за {period_key}: обновлено {len(entries)} принтер(ов)"
                if added > 0:
                    msg += f", добавлено {added}"
            else:
                msg = f"Отправлено в SL за период {period_key} ({len(entries)} принтеров)"
            if missing:
                msg += f"; без данных: {len(missing)}"
            return SyncResult(success=True, state="sent", message=msg)
        except ValueError as exc:
            return SyncResult(success=False, state="skipped", message=str(exc))
        except NotConfiguredError as exc:
            return SyncResult(success=False, state="error", message=str(exc))
        except Exception as exc:
            pk = ""
            try:
                pk, _, _ = self._period_key_for_push(force)
            except Exception:
                pass
            if pk:
                self._db.enqueue_period_sync(pk, {"error": str(exc)}, "error", str(exc))
            return SyncResult(success=False, state="error", message=str(exc))

