from __future__ import annotations

import threading
import tkinter as tk
from tkinter import messagebox

import customtkinter as ctk

from app.services.collector import CollectorService
from app.storage.db import Database


class SyncView(ctk.CTkFrame):
    def __init__(self, master: ctk.CTkBaseClass, db: Database, collector: CollectorService) -> None:
        super().__init__(master)
        self.db = db
        self.collector = collector
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(3, weight=1)

        bar = ctk.CTkFrame(self, fg_color="transparent")
        bar.grid(row=0, column=0, sticky="ew", padx=10, pady=10)
        ctk.CTkLabel(
            bar,
            text="Синхронизация с SL (Firestore): дневные показания CounterReadings/{YYYY-MM-DD}",
        ).pack(side="left", padx=5)

        self.status = ctk.CTkLabel(self, text="", anchor="w", justify="left")
        self.status.grid(row=1, column=0, sticky="ew", padx=12, pady=(0, 4))

        actions = ctk.CTkFrame(self, fg_color="transparent")
        actions.grid(row=2, column=0, sticky="ew", padx=10, pady=(0, 5))
        ctk.CTkButton(actions, text="Обновить статус", command=self.refresh).pack(side="left", padx=4)
        ctk.CTkButton(
            actions,
            text="Отправить показания за сегодня",
            command=self._push_period,
        ).pack(side="left", padx=4)
        ctk.CTkButton(
            actions,
            text="Повторить отправку за сегодня",
            command=lambda: self._push_period(force=True),
        ).pack(side="left", padx=4)

        self.text = ctk.CTkTextbox(self)
        self.text.grid(row=3, column=0, sticky="nsew", padx=10, pady=5)
        self.refresh()

    def _format_period_status(self) -> str:
        plan = self.collector.sl_period_status(force=False)
        reason = plan.get("reason", "disabled")
        dk = plan.get("date_key") or plan.get("period_key")
        day = plan.get("counter_reading_day")
        labels = {
            "disabled": "Firebase выключен",
            "due": f"Можно отправить день {dk}",
            "update-existing": f"День {dk} в SL есть — повтор обновит снимок",
            "already-done": f"День {dk} в SL есть — повтор обновит снимок",
            "force": f"Принудительно день {dk}",
        }
        base = labels.get(str(reason), str(reason))
        if day is not None:
            base += f" · день напоминания: {day}"
        return base

    def refresh(self) -> None:
        self.status.configure(text=self._format_period_status())
        items = self.db.list_sync_outbox()
        self.text.delete("1.0", "end")
        if not items:
            self.text.insert("end", "Очередь отправок пуста.\n")
            return
        for item in items:
            p = item["payload"]
            period = item.get("period_key") or p.get("date_key") or p.get("period_key") or "—"
            self.text.insert(
                "end",
                f"#{item['id']} period={period} state={item['state']}\n",
            )
            if isinstance(p.get("printers"), list):
                self.text.insert("end", f"  принтеров в пакете: {len(p['printers'])}\n")
            if p.get("missing"):
                self.text.insert("end", f"  без SNMP: {p['missing']}\n")
            if item.get("error"):
                self.text.insert("end", f"  error: {item['error']}\n")
            self.text.insert("end", "\n")

    def _push_period(self, force: bool = False) -> None:
        def work() -> None:
            result = self.collector.try_push_monthly_sl_sync(force=force)
            self.after(0, lambda: messagebox.showinfo("Синхронизация", result.message))
            self.after(0, self.refresh)

        threading.Thread(target=work, daemon=True).start()

