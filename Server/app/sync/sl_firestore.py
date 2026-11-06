"""Низкоуровневый клиент Cloud Firestore для приложения SL."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.config import FirebaseConfig
from app.sync.base import NotConfiguredError
from app.sync.period import get_active_period_key, to_period_key


@dataclass
class SlPrinterRemote:
    firestore_id: str
    name: str
    model: str
    ip: str
    color_mode: str  # bw | color


@dataclass
class PeriodCollectPlan:
    period_key: str | None
    counter_reading_day: int | None
    reason: str  # force | no-day | too-early | already-done | due


class SlFirestore:
    def __init__(self, config: FirebaseConfig) -> None:
        self._config = config
        self._db: Any = None

    def _validate_config(self) -> None:
        if not self._config.enabled:
            raise NotConfiguredError("Firebase отключён в настройках")
        if not self._config.project_id:
            raise NotConfiguredError("Не указан project_id")
        cred = self._config.credentials_path.strip()
        if not cred or not Path(cred).is_file():
            raise NotConfiguredError("Не найден файл credentials JSON")

    def _client(self) -> Any:
        self._validate_config()
        if self._db is not None:
            return self._db
        import firebase_admin
        from firebase_admin import credentials, firestore

        cred_path = Path(self._config.credentials_path.strip()).resolve()
        if not firebase_admin._apps:
            firebase_admin.initialize_app(credentials.Certificate(str(cred_path)))
        self._db = firestore.client()
        return self._db

    def fetch_app_settings(self) -> dict[str, Any]:
        db = self._client()
        snap = db.collection("AppSettings").document("main").get()
        if not snap.exists:
            return {"counterReadingDay": None}
        data = snap.to_dict() or {}
        day = data.get("counterReadingDay")
        try:
            day_int = int(day)
        except (TypeError, ValueError):
            day_int = None
        if day_int is not None and not (1 <= day_int <= 31):
            day_int = None
        return {"counterReadingDay": day_int}

    def fetch_printers(self) -> list[SlPrinterRemote]:
        db = self._client()
        snap = db.collection("Printers").stream()
        out: list[SlPrinterRemote] = []
        for doc in snap:
            data = doc.to_dict() or {}
            name = str(data.get("name") or "").strip()
            if not name:
                continue
            ip = str(data.get("ip") or "").strip()
            model = str(data.get("model") or "").strip()
            cm = data.get("colorMode")
            color_mode = "bw" if cm == "bw" else "color"
            out.append(
                SlPrinterRemote(
                    firestore_id=doc.id,
                    name=name,
                    model=model,
                    ip=ip,
                    color_mode=color_mode,
                )
            )
        out.sort(key=lambda p: p.name.lower())
        return out

    def fetch_counter_reading(self, period_key: str) -> dict[str, Any] | None:
        db = self._client()
        snap = db.collection("CounterReadings").document(period_key).get()
        if not snap.exists:
            return None
        data = snap.to_dict() or {}
        data["id"] = snap.id
        return data

    def resolve_period_to_collect(self, force: bool = False) -> PeriodCollectPlan:
        settings = self.fetch_app_settings()
        day = settings.get("counterReadingDay")

        if force:
            now = __import__("datetime").datetime.now()
            period_key = to_period_key(now.year, now.month)
            return PeriodCollectPlan(
                period_key=period_key,
                counter_reading_day=day,
                reason="force",
            )

        if day is None:
            return PeriodCollectPlan(None, None, "no-day")

        period_key = get_active_period_key(int(day))
        if period_key is None:
            return PeriodCollectPlan(None, day, "too-early")

        existing = self.fetch_counter_reading(period_key)
        if existing:
            return PeriodCollectPlan(period_key, day, "already-done")

        return PeriodCollectPlan(period_key, day, "due")

    def create_counter_reading(
        self,
        period_key: str,
        printers: list[dict[str, Any]],
        user_id: str,
        user_name: str,
        note: str = "",
    ) -> None:
        db = self._client()
        ref = db.collection("CounterReadings").document(period_key)
        from datetime import datetime

        from google.cloud.firestore_v1 import transactional

        now = datetime.now().isoformat()
        payload = {
            "periodKey": period_key,
            "completedAt": now,
            "userId": user_id,
            "userName": user_name,
            "note": note or "",
            "printers": printers,
            "source": "snmp-desktop-collector",
        }

        @transactional
        def _run(transaction: Any) -> None:
            snap = ref.get(transaction=transaction)
            if snap.exists:
                raise ValueError(
                    f"Показания за {period_key} уже есть в Firestore — повторная запись пропущена."
                )
            transaction.set(ref, payload)

        _run(db.transaction())

    def update_counter_reading(
        self,
        period_key: str,
        printers: list[dict[str, Any]],
        user_name: str,
        note: str = "",
    ) -> None:
        db = self._client()
        ref = db.collection("CounterReadings").document(period_key)
        from datetime import datetime

        from google.cloud.firestore_v1 import transactional

        now = datetime.now().isoformat()

        @transactional
        def _run(transaction: Any) -> None:
            snap = ref.get(transaction=transaction)
            if not snap.exists:
                raise ValueError(
                    f"Показания за {period_key} не найдены — нельзя дополнить запись."
                )
            transaction.update(
                ref,
                {
                    "printers": printers,
                    "note": note or "",
                    "updatedAt": now,
                    "updatedByName": user_name,
                },
            )

        _run(db.transaction())

    def upsert_counter_reading(
        self,
        period_key: str,
        printers: list[dict[str, Any]],
        user_id: str,
        user_name: str,
        note: str = "",
    ) -> str:
        """Создаёт документ или обновляет printers[] (режим «Изменить» в веб-SL)."""
        existing = self.fetch_counter_reading(period_key)
        if existing:
            self.update_counter_reading(period_key, printers, user_name, note)
            return "merged"
        self.create_counter_reading(period_key, printers, user_id, user_name, note)
        return "created"

    def health_check_details(self) -> tuple[bool, str]:
        try:
            settings = self.fetch_app_settings()
            printers = self.fetch_printers()
            with_ip = sum(1 for p in printers if p.ip)
            day = settings.get("counterReadingDay")
            return (
                True,
                f"OK: принтеров {len(printers)} (с IP: {with_ip}), "
                f"день снятия: {day if day else 'не задан'}",
            )
        except NotConfiguredError as exc:
            return False, str(exc)
        except Exception as exc:
            return False, str(exc)
