from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.models import Printer, Reading, ReadingDTO
from app.printer_types import normalize_color_mode
from app.snmp.billing import billing_for_sync, guess_counter_preset, normalize_counter_preset


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(value: str) -> datetime:
    dt = datetime.fromisoformat(value)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


class Database:
    def __init__(self, path: Path) -> None:
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._init_schema()

    def _init_schema(self) -> None:
        cur = self._conn.cursor()
        cur.executescript(
            """
            CREATE TABLE IF NOT EXISTS printers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                host TEXT NOT NULL UNIQUE,
                profile_id TEXT NOT NULL,
                snmp_version TEXT NOT NULL DEFAULT '2c',
                community TEXT NOT NULL DEFAULT 'public',
                enabled INTEGER NOT NULL DEFAULT 1,
                color_mode TEXT NOT NULL DEFAULT 'mono',
                counter_preset TEXT NOT NULL DEFAULT 'generic',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS readings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                printer_id INTEGER NOT NULL,
                collected_at TEXT NOT NULL,
                period_type TEXT NOT NULL,
                status TEXT NOT NULL,
                error_message TEXT,
                metrics_json TEXT NOT NULL,
                FOREIGN KEY (printer_id) REFERENCES printers(id)
            );

            CREATE INDEX IF NOT EXISTS idx_readings_printer_collected
                ON readings(printer_id, collected_at);

            CREATE TABLE IF NOT EXISTS sync_outbox (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reading_id INTEGER NOT NULL UNIQUE,
                payload_json TEXT NOT NULL,
                state TEXT NOT NULL DEFAULT 'pending',
                last_attempt_at TEXT,
                error TEXT,
                FOREIGN KEY (reading_id) REFERENCES readings(id)
            );
            """
        )
        self._conn.commit()
        self._migrate_schema()

    def _migrate_schema(self) -> None:
        cur = self._conn.cursor()
        cols = {row[1] for row in cur.execute("PRAGMA table_info(printers)").fetchall()}
        if "color_mode" not in cols:
            cur.execute(
                "ALTER TABLE printers ADD COLUMN color_mode TEXT NOT NULL DEFAULT 'mono'"
            )
            self._conn.commit()
            cols.add("color_mode")
        if "counter_preset" not in cols:
            cur.execute(
                "ALTER TABLE printers ADD COLUMN counter_preset TEXT NOT NULL DEFAULT 'generic'"
            )
            existing = cur.execute(
                "SELECT id, name, host, profile_id FROM printers"
            ).fetchall()
            for row in existing:
                preset = guess_counter_preset(row["name"], row["host"], row["profile_id"])
                cur.execute(
                    "UPDATE printers SET counter_preset=? WHERE id=?",
                    (preset, row["id"]),
                )
            self._conn.commit()
        cols = {row[1] for row in cur.execute("PRAGMA table_info(printers)").fetchall()}
        if "firestore_id" not in cols:
            cur.execute("ALTER TABLE printers ADD COLUMN firestore_id TEXT")
            cur.execute(
                "CREATE UNIQUE INDEX IF NOT EXISTS idx_printers_firestore_id "
                "ON printers(firestore_id) WHERE firestore_id IS NOT NULL"
            )
            self._conn.commit()
        if "model" not in cols:
            cur.execute("ALTER TABLE printers ADD COLUMN model TEXT NOT NULL DEFAULT ''")
            self._conn.commit()
        if "synced_from_cloud" not in cols:
            cur.execute(
                "ALTER TABLE printers ADD COLUMN synced_from_cloud INTEGER NOT NULL DEFAULT 0"
            )
            self._conn.commit()
        self._migrate_sync_outbox()

    def _migrate_sync_outbox(self) -> None:
        cur = self._conn.cursor()
        cols = {row[1] for row in cur.execute("PRAGMA table_info(sync_outbox)").fetchall()}
        if "period_key" in cols:
            return
        cur.executescript(
            """
            CREATE TABLE sync_outbox_new (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                period_key TEXT UNIQUE,
                reading_id INTEGER UNIQUE,
                payload_json TEXT NOT NULL,
                state TEXT NOT NULL DEFAULT 'pending',
                last_attempt_at TEXT,
                error TEXT
            );
            INSERT INTO sync_outbox_new (id, reading_id, payload_json, state, last_attempt_at, error)
            SELECT id, reading_id, payload_json, state, last_attempt_at, error FROM sync_outbox;
            DROP TABLE sync_outbox;
            ALTER TABLE sync_outbox_new RENAME TO sync_outbox;
            """
        )
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()

    def add_printer(self, printer: Printer) -> int:
        cur = self._conn.cursor()
        created = (printer.created_at or _utc_now()).isoformat()
        cur.execute(
            """
            INSERT INTO printers (
                name, host, profile_id, snmp_version, community, enabled, color_mode, counter_preset,
                firestore_id, model, synced_from_cloud, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                printer.name,
                printer.host,
                printer.profile_id,
                printer.snmp_version,
                printer.community,
                1 if printer.enabled else 0,
                normalize_color_mode(printer.color_mode),
                normalize_counter_preset(printer.counter_preset),
                printer.firestore_id,
                printer.model or "",
                1 if printer.synced_from_cloud else 0,
                created,
            ),
        )
        self._conn.commit()
        return int(cur.lastrowid)

    def update_printer(self, printer: Printer) -> None:
        if printer.id is None:
            raise ValueError("printer.id required")
        cur = self._conn.cursor()
        cur.execute(
            """
            UPDATE printers
            SET name=?, host=?, profile_id=?, snmp_version=?, community=?, enabled=?, color_mode=?,
                counter_preset=?, firestore_id=?, model=?, synced_from_cloud=?
            WHERE id=?
            """,
            (
                printer.name,
                printer.host,
                printer.profile_id,
                printer.snmp_version,
                printer.community,
                1 if printer.enabled else 0,
                normalize_color_mode(printer.color_mode),
                normalize_counter_preset(printer.counter_preset),
                printer.firestore_id,
                printer.model or "",
                1 if printer.synced_from_cloud else 0,
                printer.id,
            ),
        )
        self._conn.commit()

    def delete_printer(self, printer_id: int) -> None:
        cur = self._conn.cursor()
        cur.execute("DELETE FROM sync_outbox WHERE reading_id IN (SELECT id FROM readings WHERE printer_id=?)", (printer_id,))
        cur.execute("DELETE FROM readings WHERE printer_id=?", (printer_id,))
        cur.execute("DELETE FROM printers WHERE id=?", (printer_id,))
        self._conn.commit()

    def list_printers(self) -> list[Printer]:
        cur = self._conn.cursor()
        rows = cur.execute("SELECT * FROM printers ORDER BY name").fetchall()
        return [self._row_to_printer(r) for r in rows]

    def get_printer(self, printer_id: int) -> Printer | None:
        cur = self._conn.cursor()
        row = cur.execute("SELECT * FROM printers WHERE id=?", (printer_id,)).fetchone()
        return self._row_to_printer(row) if row else None

    @staticmethod
    def _row_to_printer(row: sqlite3.Row) -> Printer:
        keys = row.keys()
        return Printer(
            id=row["id"],
            name=row["name"],
            host=row["host"],
            profile_id=row["profile_id"],
            snmp_version=row["snmp_version"],
            community=row["community"],
            enabled=bool(row["enabled"]),
            color_mode=normalize_color_mode(
                row["color_mode"] if "color_mode" in keys else "mono"
            ),
            counter_preset=normalize_counter_preset(
                row["counter_preset"] if "counter_preset" in keys else "generic"
            ),
            firestore_id=row["firestore_id"] if "firestore_id" in keys else None,
            model=row["model"] if "model" in keys else "",
            synced_from_cloud=bool(row["synced_from_cloud"]) if "synced_from_cloud" in keys else False,
            created_at=_parse_dt(row["created_at"]),
        )

    def get_printer_by_firestore_id(self, firestore_id: str) -> Printer | None:
        cur = self._conn.cursor()
        row = cur.execute(
            "SELECT * FROM printers WHERE firestore_id=?",
            (firestore_id,),
        ).fetchone()
        return self._row_to_printer(row) if row else None

    def upsert_printer_from_cloud(
        self,
        firestore_id: str,
        name: str,
        host: str,
        model: str,
        profile_id: str,
        counter_preset: str,
        color_mode: str,
        default_community: str,
    ) -> str:
        existing = self.get_printer_by_firestore_id(firestore_id)
        if existing and existing.id is not None:
            cur = self._conn.cursor()
            cur.execute(
                """
                UPDATE printers
                SET name=?, host=?, model=?, color_mode=?, enabled=1, synced_from_cloud=1
                WHERE id=?
                """,
                (name, host, model, normalize_color_mode(color_mode), existing.id),
            )
            self._conn.commit()
            return "updated"

        cur = self._conn.cursor()
        row = cur.execute("SELECT * FROM printers WHERE host=?", (host,)).fetchone()
        if row:
            cur.execute(
                """
                UPDATE printers
                SET firestore_id=?, name=?, model=?, color_mode=?, enabled=1, synced_from_cloud=1
                WHERE id=?
                """,
                (
                    firestore_id,
                    name,
                    model,
                    normalize_color_mode(color_mode),
                    row["id"],
                ),
            )
            self._conn.commit()
            return "updated"

        printer = Printer(
            id=None,
            name=name,
            host=host,
            profile_id=profile_id,
            community=default_community,
            enabled=True,
            color_mode=color_mode,
            counter_preset=counter_preset,
            firestore_id=firestore_id,
            model=model,
            synced_from_cloud=True,
        )
        self.add_printer(printer)
        return "created"

    def disable_cloud_printers_not_in(self, firestore_ids: set[str]) -> int:
        cur = self._conn.cursor()
        rows = cur.execute(
            """
            SELECT id, firestore_id FROM printers
            WHERE synced_from_cloud=1 AND firestore_id IS NOT NULL AND firestore_id != ''
            """
        ).fetchall()
        disabled = 0
        for row in rows:
            fid = row["firestore_id"]
            if fid not in firestore_ids:
                cur.execute("UPDATE printers SET enabled=0 WHERE id=?", (row["id"],))
                disabled += 1
        self._conn.commit()
        return disabled

    def last_successful_reading(self, printer_id: int) -> Reading | None:
        cur = self._conn.cursor()
        row = cur.execute(
            """
            SELECT r.*, p.name AS printer_name, p.host AS printer_host
            FROM readings r
            JOIN printers p ON p.id = r.printer_id
            WHERE r.printer_id=? AND r.status IN ('ok', 'partial')
            ORDER BY r.collected_at DESC
            LIMIT 1
            """,
            (printer_id,),
        ).fetchone()
        return self._row_to_reading(row) if row else None

    def build_sl_printer_entries(self) -> tuple[list[dict[str, object]], list[str]]:
        from app.sync.sl_mapping import printer_entry_from_reading

        entries: list[dict[str, object]] = []
        missing: list[str] = []
        for printer in self.list_printers():
            if not printer.firestore_id or not printer.enabled:
                continue
            if printer.id is None:
                continue
            reading = self.last_successful_reading(printer.id)
            if reading is None:
                missing.append(printer.name)
                continue
            entries.append(printer_entry_from_reading(printer, reading.metrics))
        return entries, missing

    def add_reading(
        self,
        printer_id: int,
        period_type: str,
        status: str,
        metrics: dict[str, Any],
        error_message: str | None = None,
        collected_at: datetime | None = None,
    ) -> int:
        cur = self._conn.cursor()
        ts = (collected_at or _utc_now()).isoformat()
        cur.execute(
            """
            INSERT INTO readings (printer_id, collected_at, period_type, status, error_message, metrics_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (printer_id, ts, period_type, status, error_message, json.dumps(metrics, ensure_ascii=False)),
        )
        self._conn.commit()
        return int(cur.lastrowid)

    def get_reading(self, reading_id: int) -> Reading | None:
        cur = self._conn.cursor()
        row = cur.execute(
            """
            SELECT r.*, p.name AS printer_name, p.host AS printer_host
            FROM readings r
            JOIN printers p ON p.id = r.printer_id
            WHERE r.id=?
            """,
            (reading_id,),
        ).fetchone()
        return self._row_to_reading(row) if row else None

    def list_readings(
        self,
        printer_id: int | None = None,
        limit: int = 500,
        date_from: str | None = None,
        date_to: str | None = None,
    ) -> list[Reading]:
        cur = self._conn.cursor()
        clauses: list[str] = []
        params: list[object] = []
        if printer_id is not None:
            clauses.append("r.printer_id=?")
            params.append(printer_id)
        if date_from:
            clauses.append("r.collected_at >= ?")
            params.append(f"{date_from}T00:00:00+00:00")
        if date_to:
            clauses.append("r.collected_at <= ?")
            params.append(f"{date_to}T23:59:59+00:00")
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        params.append(limit)
        rows = cur.execute(
            f"""
            SELECT r.*, p.name AS printer_name, p.host AS printer_host
            FROM readings r
            JOIN printers p ON p.id = r.printer_id
            {where}
            ORDER BY r.collected_at DESC
            LIMIT ?
            """,
            params,
        ).fetchall()
        return [self._row_to_reading(r) for r in rows]

    def last_reading_for_printer(self, printer_id: int) -> Reading | None:
        cur = self._conn.cursor()
        row = cur.execute(
            """
            SELECT r.*, p.name AS printer_name, p.host AS printer_host
            FROM readings r
            JOIN printers p ON p.id = r.printer_id
            WHERE r.printer_id=?
            ORDER BY r.collected_at DESC
            LIMIT 1
            """,
            (printer_id,),
        ).fetchone()
        return self._row_to_reading(row) if row else None

    @staticmethod
    def _row_to_reading(row: sqlite3.Row) -> Reading:
        return Reading(
            id=row["id"],
            printer_id=row["printer_id"],
            collected_at=_parse_dt(row["collected_at"]),
            period_type=row["period_type"],
            status=row["status"],
            error_message=row["error_message"],
            metrics=json.loads(row["metrics_json"]),
            printer_name=row["printer_name"] if "printer_name" in row.keys() else None,
            printer_host=row["printer_host"] if "printer_host" in row.keys() else None,
        )

    def enqueue_sync(self, dto: ReadingDTO) -> None:
        payload = {
            "reading_id": dto.reading_id,
            "printer_id": dto.printer_id,
            "printer_name": dto.printer_name,
            "printer_host": dto.printer_host,
            "profile_id": dto.profile_id,
            "printer_color_mode": dto.printer_color_mode,
            "counter_preset": dto.counter_preset,
            "collected_at": dto.collected_at.isoformat(),
            "period_type": dto.period_type,
            "status": dto.status,
            "billing": billing_for_sync(dto.metrics),
            "metrics": billing_for_sync(dto.metrics),
            "source": "snmp",
        }
        cur = self._conn.cursor()
        cur.execute(
            """
            INSERT OR REPLACE INTO sync_outbox (reading_id, payload_json, state, last_attempt_at, error)
            VALUES (?, ?, 'pending', NULL, NULL)
            """,
            (dto.reading_id, json.dumps(payload, ensure_ascii=False)),
        )
        self._conn.commit()

    def enqueue_period_sync(
        self,
        period_key: str,
        payload: dict[str, Any],
        state: str,
        error: str | None,
    ) -> None:
        cur = self._conn.cursor()
        cur.execute(
            """
            INSERT OR REPLACE INTO sync_outbox (period_key, reading_id, payload_json, state, last_attempt_at, error)
            VALUES (?, NULL, ?, ?, ?, ?)
            """,
            (
                period_key,
                json.dumps(payload, ensure_ascii=False),
                state,
                _utc_now().isoformat(),
                error,
            ),
        )
        self._conn.commit()

    def list_sync_outbox(self, limit: int = 200) -> list[dict[str, Any]]:
        cur = self._conn.cursor()
        rows = cur.execute(
            """
            SELECT id, period_key, reading_id, payload_json, state, last_attempt_at, error
            FROM sync_outbox
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        result = []
        for r in rows:
            result.append(
                {
                    "id": r["id"],
                    "period_key": r["period_key"] if "period_key" in r.keys() else None,
                    "reading_id": r["reading_id"],
                    "state": r["state"],
                    "last_attempt_at": r["last_attempt_at"],
                    "error": r["error"],
                    "payload": json.loads(r["payload_json"]),
                }
            )
        return result

    def update_sync_state(self, reading_id: int, state: str, error: str | None = None) -> None:
        cur = self._conn.cursor()
        cur.execute(
            """
            UPDATE sync_outbox SET state=?, error=?, last_attempt_at=?
            WHERE reading_id=?
            """,
            (state, error, _utc_now().isoformat(), reading_id),
        )
        self._conn.commit()
