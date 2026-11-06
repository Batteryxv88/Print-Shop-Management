import unittest
from datetime import datetime

from app.models import Printer
from app.sync.period import get_active_period_key, to_period_key
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


if __name__ == "__main__":
    unittest.main()
