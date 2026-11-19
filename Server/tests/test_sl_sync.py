import unittest
from datetime import datetime

from app.models import Printer
from app.sync.period import (
    get_active_period_key,
    period_key_from_date_key,
    resolve_daily_collect_reason,
    to_date_key,
    to_period_key,
    today_date_key,
)
from app.sync.sl_mapping import (
    billing_to_sl_values,
    local_color_mode_from_sl,
    merge_sl_printer_entries,
    sl_color_mode_from_local,
)


class TestPeriodKey(unittest.TestCase):
    def test_active_period_after_due_day(self) -> None:
        now = datetime(2026, 3, 15, 12, 0, 0)
        self.assertEqual(get_active_period_key(10, now=now), "2026-03")

    def test_too_early_before_first_due(self) -> None:
        now = datetime(2026, 3, 5, 12, 0, 0)
        self.assertEqual(get_active_period_key(10, now=now), "2026-02")

    def test_invalid_day(self) -> None:
        self.assertIsNone(get_active_period_key(0))

    def test_to_period_key(self) -> None:
        self.assertEqual(to_period_key(2026, 1), "2026-01")

    def test_today_date_key(self) -> None:
        now = datetime(2026, 11, 12, 13, 30, 0)
        self.assertEqual(today_date_key(now), "2026-11-12")
        self.assertEqual(to_date_key(2026, 1, 5), "2026-01-05")
        self.assertEqual(period_key_from_date_key("2026-11-12"), "2026-11")

    def test_daily_collect_reason(self) -> None:
        self.assertEqual(resolve_daily_collect_reason(existing=False), "due")
        self.assertEqual(resolve_daily_collect_reason(existing=True), "update-existing")
        self.assertEqual(resolve_daily_collect_reason(existing=True, force=True), "force")


class TestSlMapping(unittest.TestCase):
    def test_color_modes(self) -> None:
        self.assertEqual(sl_color_mode_from_local("mono"), "bw")
        self.assertEqual(local_color_mode_from_sl("bw"), "mono")

    def test_billing_to_sl_color(self) -> None:
        values = billing_to_sl_values(
            {"total": 1000, "black": 700, "color": 300},
            "color",
        )
        self.assertEqual(values["total"], 1000)
        self.assertEqual(values["mono"], 700)
        self.assertEqual(values["color"], 300)

    def test_billing_bw_only_total(self) -> None:
        values = billing_to_sl_values({"total": 500}, "bw")
        self.assertEqual(values, {"total": 500})


class TestMergeEntries(unittest.TestCase):
    def test_merge_adds_and_updates(self) -> None:
        existing = [
            {"printerId": "a", "printerName": "A", "values": {"total": 1}},
            {"printerId": "b", "printerName": "B", "values": {"total": 2}},
        ]
        local = [
            {"printerId": "b", "printerName": "B", "values": {"total": 99}},
            {"printerId": "c", "printerName": "C", "values": {"total": 3}},
        ]
        merged = merge_sl_printer_entries(existing, local)
        self.assertEqual([p["printerId"] for p in merged], ["a", "b", "c"])
        self.assertEqual(merged[1]["values"]["total"], 99)


class TestCloudPrinterUpsert(unittest.TestCase):
    def test_upsert_and_disable(self) -> None:
        from pathlib import Path
        import tempfile

        from app.storage.db import Database

        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "t.db")
            action = db.upsert_printer_from_cloud(
                firestore_id="abc123",
                name="KM-1",
                host="192.168.0.10",
                model="C3070",
                profile_id="konica_minolta",
                counter_preset="generic",
                color_mode="color",
                default_community="public",
            )
            self.assertEqual(action, "created")
            p = db.get_printer_by_firestore_id("abc123")
            assert p is not None
            self.assertTrue(p.synced_from_cloud)
            disabled = db.disable_cloud_printers_not_in({"other"})
            self.assertEqual(disabled, 1)
            p2 = db.get_printer_by_firestore_id("abc123")
            assert p2 is not None
            self.assertFalse(p2.enabled)
            db.close()


class _FakeSlFirestore:
    def __init__(self) -> None:
        self.docs: dict[str, dict] = {}
        self.created: list[str] = []
        self.updated: list[str] = []

    def resolve_period_to_collect(self, force: bool = False):
        from app.sync.period import (
            period_key_from_date_key,
            resolve_daily_collect_reason,
            today_date_key,
        )
        from app.sync.sl_firestore import PeriodCollectPlan

        date_key = today_date_key()
        existing = date_key in self.docs
        return PeriodCollectPlan(
            date_key=date_key,
            period_key=period_key_from_date_key(date_key),
            counter_reading_day=6,
            reason=resolve_daily_collect_reason(existing=existing, force=force),
        )

    def fetch_counter_reading(self, date_key: str):
        return self.docs.get(date_key)

    def create_counter_reading(self, date_key, printers, user_id, user_name, note=""):
        self.docs[date_key] = {
            "id": date_key,
            "dateKey": date_key,
            "periodKey": date_key[:7],
            "printers": printers,
            "userId": user_id,
            "userName": user_name,
            "note": note,
        }
        self.created.append(date_key)

    def update_counter_reading(self, date_key, printers, user_name, note=""):
        self.docs[date_key]["printers"] = printers
        self.docs[date_key]["note"] = note
        self.updated.append(date_key)


class TestDailyFirestorePush(unittest.TestCase):
    def test_creates_today_date_key_document(self) -> None:
        from pathlib import Path
        import tempfile

        from app.config import FirebaseConfig
        from app.storage.db import Database
        from app.sync.firestore_stub import FirestoreBackend
        from app.sync.period import today_date_key

        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "t.db")
            db.upsert_printer_from_cloud(
                firestore_id="p1",
                name="KM-1",
                host="192.168.0.10",
                model="C3070",
                profile_id="konica_minolta",
                counter_preset="generic",
                color_mode="color",
                default_community="public",
            )
            printer = db.get_printer_by_firestore_id("p1")
            assert printer is not None and printer.id is not None
            db.add_reading(printer.id, "daily", "ok", {"total": 100, "black": 40, "color": 60})

            backend = FirestoreBackend(
                db,
                FirebaseConfig(enabled=True, project_id="test", agent_user_name="SNMP Desktop"),
            )
            fake = _FakeSlFirestore()
            backend._fs = fake
            result = backend.push_monthly_counter_reading(force=False)
            db.close()

        today = today_date_key()
        self.assertTrue(result.success)
        self.assertEqual(result.state, "sent")
        self.assertIn(today, result.message)
        self.assertEqual(fake.created, [today])
        self.assertEqual(fake.docs[today]["dateKey"], today)
        self.assertEqual(fake.docs[today]["periodKey"], today[:7])
        self.assertEqual(fake.docs[today]["printers"][0]["printerId"], "p1")

    def test_updates_existing_today_document(self) -> None:
        from pathlib import Path
        import tempfile

        from app.config import FirebaseConfig
        from app.storage.db import Database
        from app.sync.firestore_stub import FirestoreBackend
        from app.sync.period import today_date_key

        today = today_date_key()
        with tempfile.TemporaryDirectory() as tmp:
            db = Database(Path(tmp) / "t.db")
            db.upsert_printer_from_cloud(
                firestore_id="p1",
                name="KM-1",
                host="192.168.0.10",
                model="C3070",
                profile_id="konica_minolta",
                counter_preset="generic",
                color_mode="color",
                default_community="public",
            )
            printer = db.get_printer_by_firestore_id("p1")
            assert printer is not None and printer.id is not None
            db.add_reading(printer.id, "daily", "ok", {"total": 200, "black": 80, "color": 120})

            backend = FirestoreBackend(
                db,
                FirebaseConfig(enabled=True, project_id="test", agent_user_name="SNMP Desktop"),
            )
            fake = _FakeSlFirestore()
            fake.docs[today] = {
                "id": today,
                "dateKey": today,
                "printers": [{"printerId": "p1", "printerName": "KM-1", "values": {"total": 1}}],
            }
            backend._fs = fake
            result = backend.push_monthly_counter_reading(force=False)
            db.close()

        self.assertTrue(result.success)
        self.assertEqual(fake.updated, [today])
        self.assertEqual(fake.created, [])
        self.assertEqual(fake.docs[today]["printers"][0]["printerId"], "p1")
        self.assertIn("values", fake.docs[today]["printers"][0])


if __name__ == "__main__":
    unittest.main()
