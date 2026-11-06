from __future__ import annotations

import csv
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox
from typing import Callable

import customtkinter as ctk

from app.snmp.billing import (
    C7210X_UNMAPPED,
    PRESET_LABELS,
    format_billing_lines,
    interpret_billing,
    normalize_counter_preset,
    source_metrics,
)
from app.storage.db import Database


def _billing_csv_values(preset: str, metrics: dict) -> list[object]:
    bill = interpret_billing(preset, source_metrics(metrics))
    if bill.get("unmapped"):
        return ["", "", "", "", C7210X_UNMAPPED]
    numbers = [
        "" if bill.get(key) is None else bill[key]
        for key in ("total", "color", "black", "fifth_color")
    ]
    return [*numbers, ""]


class HistoryView(ctk.CTkFrame):
    def __init__(self, master: ctk.CTkBaseClass, db: Database, get_export_dir: Callable[[], Path]) -> None:
        super().__init__(master)
        self.db = db
        self.get_export_dir = get_export_dir

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        bar = ctk.CTkFrame(self, fg_color="transparent")
        bar.grid(row=0, column=0, sticky="ew", padx=10, pady=10)

        ctk.CTkLabel(bar, text="Принтер").pack(side="left", padx=5)
        printers = self.db.list_printers()
        values = ["Все"] + [f"{p.name} ({p.host})" for p in printers]
        self.filter_var = tk.StringVar(value="Все")
        self.filter_menu = ctk.CTkOptionMenu(bar, variable=self.filter_var, values=values or ["Все"])
        self.filter_menu.pack(side="left", padx=5)
        ctk.CTkLabel(bar, text="С").pack(side="left", padx=(12, 2))
        self.date_from_var = tk.StringVar()
        ctk.CTkEntry(bar, textvariable=self.date_from_var, width=100, placeholder_text="ГГГГ-ММ-ДД").pack(
            side="left", padx=2
        )
        ctk.CTkLabel(bar, text="По").pack(side="left", padx=2)
        self.date_to_var = tk.StringVar()
        ctk.CTkEntry(bar, textvariable=self.date_to_var, width=100, placeholder_text="ГГГГ-ММ-ДД").pack(
            side="left", padx=2
        )
        ctk.CTkButton(bar, text="Обновить", command=self.refresh).pack(side="left", padx=5)
        ctk.CTkButton(bar, text="Экспорт CSV", command=self._export_csv).pack(side="left", padx=5)

        self.text = ctk.CTkTextbox(self, wrap="none")
        self.text.grid(row=1, column=0, sticky="nsew", padx=10, pady=5)

        self.reload_filters()

    def reload_filters(self) -> None:
        printers = self.db.list_printers()
        values = ["Все"] + [f"{p.name} ({p.host})" for p in printers]
        self.filter_menu.configure(values=values or ["Все"])
        self.refresh()

    def _selected_printer_id(self) -> int | None:
        val = self.filter_var.get()
        if val == "Все":
            return None
        for p in self.db.list_printers():
            if val.startswith(p.name):
                return p.id
        return None

    def _date_filter(self) -> tuple[str | None, str | None]:
        d_from = self.date_from_var.get().strip() or None
        d_to = self.date_to_var.get().strip() or None
        return d_from, d_to

    def refresh(self) -> None:
        pid = self._selected_printer_id()
        d_from, d_to = self._date_filter()
        readings = self.db.list_readings(
            printer_id=pid, limit=300, date_from=d_from, date_to=d_to
        )
        self.text.delete("1.0", "end")
        if not readings:
            self.text.insert("end", "Нет записей.\n")
            return
        presets = {p.id: p.counter_preset for p in self.db.list_printers()}
        for r in readings:
            ts = r.collected_at.astimezone().strftime("%Y-%m-%d %H:%M:%S")
            preset = presets.get(r.printer_id, "generic")
            preset_lbl = PRESET_LABELS.get(normalize_counter_preset(preset), preset)
            line = (
                f"[{ts}] {r.printer_name} ({r.printer_host}) | {preset_lbl} | "
                f"{r.period_type} | {r.status}\n"
            )
            self.text.insert("end", line)
            if r.status != "error":
                for billing_line in format_billing_lines(preset, r.metrics):
                    self.text.insert("end", f"    {billing_line}\n")
            if r.error_message:
                self.text.insert("end", f"    Ошибка: {r.error_message}\n")
            self.text.insert("end", "\n")

    def _export_csv(self) -> None:
        pid = self._selected_printer_id()
        d_from, d_to = self._date_filter()
        readings = self.db.list_readings(
            printer_id=pid, limit=5000, date_from=d_from, date_to=d_to
        )
        if not readings:
            messagebox.showinfo("Экспорт", "Нет данных")
            return
        path = filedialog.asksaveasfilename(
            defaultextension=".csv",
            initialdir=str(self.get_export_dir()),
            filetypes=[("CSV", "*.csv")],
        )
        if not path:
            return
        presets = {p.id: p.counter_preset for p in self.db.list_printers()}
        with open(path, "w", newline="", encoding="utf-8-sig") as f:
            w = csv.writer(f, delimiter=";")
            w.writerow(
                [
                    "collected_at",
                    "printer",
                    "host",
                    "period_type",
                    "status",
                    "formula",
                    "Всего",
                    "Цвет",
                    "Ч/Б",
                    "5-й цвет",
                    "статус",
                ]
            )
            for r in readings:
                preset = presets.get(r.printer_id, "generic")
                values = _billing_csv_values(preset, r.metrics)
                w.writerow(
                    [
                        r.collected_at.astimezone().isoformat(),
                        r.printer_name,
                        r.printer_host,
                        r.period_type,
                        r.status,
                        PRESET_LABELS.get(normalize_counter_preset(preset), preset),
                        *values,
                    ]
                )
        messagebox.showinfo("Экспорт", f"Сохранено: {path}")
