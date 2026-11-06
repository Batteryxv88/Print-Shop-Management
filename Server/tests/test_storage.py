import sqlite3
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

from app.models import Printer, ReadingDTO
from app.storage.db import Database


class TestDatabase(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Database(Path(self.tmp.name) / "test.db")

    def tearDown(self) -> None:
        self.db.close()
        self.tmp.cleanup()

    def test_printer_and_reading(self) -> None:
        pid = self.db.add_printer(
            Printer(id=None, name="KM-1", host="192.168.1.10", profile_id="konica_minolta")
        )
        rid = self.db.add_reading(pid, "monthly", "ok", {"total": 1000})
        reading = self.db.get_reading(rid)
        assert reading is not None
        self.assertEqual(reading.metrics["total"], 1000)
        self.assertEqual(len(self.db.list_printers()), 1)

    def test_color_mode_roundtrip(self) -> None:
        pid = self.db.add_printer(
            Printer(
                id=None,
                name="R-1",
                host="192.168.1.20",
                profile_id="ricoh",
                color_mode="color_extra",
            )
        )
        printers = self.db.list_printers()
        self.assertEqual(printers[0].color_mode, "color_extra")
        p = printers[0]
        p.color_mode = "color"
        self.db.update_printer(p)
        updated = next(x for x in self.db.list_printers() if x.id == pid)
        self.assertEqual(updated.color_mode, "color")

    def test_counter_preset_roundtrip_and_sync_hides_raw(self) -> None:
        pid = self.db.add_printer(
            Printer(
                id=None,
                name="Ricoh C7210X",
                host="192.168.88.119",
                profile_id="ricoh",
                counter_preset="ricoh_c7210x",
            )
        )
        stored = self.db.get_printer(pid)
        assert stored is not None
        self.assertEqual(stored.counter_preset, "ricoh_c7210x")
        stored.counter_preset = "ricoh_8210"
        self.db.update_printer(stored)
        self.assertEqual(self.db.get_printer(pid).counter_preset, "ricoh_8210")

        rid = self.db.add_reading(pid, "daily", "ok", {"total": 1, "_raw": {"eng_secret": 9}})
        self.db.enqueue_sync(
            ReadingDTO(
                reading_id=rid,
                printer_id=pid,
                printer_name="Ricoh C7210X",
                printer_host="192.168.88.119",
                profile_id="ricoh",
                collected_at=datetime.now(timezone.utc),
                period_type="daily",
                status="ok",
                metrics={"total": 1, "black": 2, "_raw": {"dump": True}, "eng_walk": 3},
                counter_preset="ricoh_c7210x",
            )
        )
        payload = self.db.list_sync_outbox()[0]["payload"]
        self.assertEqual(payload["billing"], {"total": 1, "black": 2})
        self.assertNotIn("_raw", payload["metrics"])
        self.assertNotIn("eng_walk", payload["metrics"])
        self.assertEqual(payload["counter_preset"], "ricoh_c7210x")

    def test_migration_assigns_preset_from_name(self) -> None:
        path = Path(self.tmp.name) / "old.db"
        con = sqlite3.connect(path)
        con.execute(
            """
            CREATE TABLE printers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                host TEXT NOT NULL UNIQUE,
                profile_id TEXT NOT NULL,
                snmp_version TEXT NOT NULL DEFAULT '2c',
                community TEXT NOT NULL DEFAULT 'public',
                enabled INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
            """
        )
        con.execute(
            "INSERT INTO printers (name, host, profile_id, created_at) VALUES (?, ?, ?, ?)",
            ("Konica C3070", "192.168.88.102", "konica_minolta", "2026-11-05T00:00:00+00:00"),
        )
        con.execute(
            "INSERT INTO printers (name, host, profile_id, created_at) VALUES (?, ?, ?, ?)",
            ("AccurioPress C14000", "10.0.0.8", "konica_minolta", "2026-11-05T00:00:00+00:00"),
        )
        con.commit()
        con.close()
        db = Database(path)
        try:
            by_name = {p.name: p.counter_preset for p in db.list_printers()}
            self.assertEqual(by_name["Konica C3070"], "km_c3070")
            self.assertEqual(by_name["AccurioPress C14000"], "km_generic")
        finally:
            db.close()


if __name__ == "__main__":
    unittest.main()
