from __future__ import annotations

import threading
import tkinter as tk
from tkinter import messagebox
from typing import Callable

import customtkinter as ctk

from app.models import Printer
from app.printer_types import COLOR_MODE_CHOICES, COLOR_MODE_LABELS, normalize_color_mode
from app.services.collector import CollectorService
from app.snmp.billing import (
    PRESET_CHOICES,
    PRESET_LABELS,
    format_billing_lines,
    guess_counter_preset,
    normalize_counter_preset,
)
from app.snmp.client import SnmpClient
from app.storage.db import Database


class PrintersView(ctk.CTkFrame):
    def __init__(
        self,
        master: ctk.CTkBaseClass,
        db: Database,
        collector: CollectorService,
        snmp: SnmpClient,
        default_community: str,
        on_data_changed: Callable[[], None],
    ) -> None:
        super().__init__(master)
        self.db = db
        self.collector = collector
        self.snmp = snmp
        self.default_community = default_community
        self.on_data_changed = on_data_changed
        self._editing_id: int | None = None

        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)

        form = ctk.CTkFrame(self)
        form.grid(row=0, column=0, sticky="ew", padx=10, pady=10)
        form.grid_columnconfigure(1, weight=1)

        self.form_title = ctk.CTkLabel(form, text="Новый принтер", font=ctk.CTkFont(weight="bold"))
        self.form_title.grid(row=0, column=0, columnspan=2, sticky="w", padx=5, pady=(0, 8))

        ctk.CTkLabel(form, text="Имя").grid(row=1, column=0, padx=5, pady=5, sticky="w")
        self.name_var = tk.StringVar()
        ctk.CTkEntry(form, textvariable=self.name_var).grid(row=1, column=1, padx=5, pady=5, sticky="ew")

        ctk.CTkLabel(form, text="IP / host").grid(row=2, column=0, padx=5, pady=5, sticky="w")
        self.host_var = tk.StringVar()
        ctk.CTkEntry(form, textvariable=self.host_var).grid(row=2, column=1, padx=5, pady=5, sticky="ew")

        ctk.CTkLabel(form, text="Профиль OID").grid(row=3, column=0, padx=5, pady=5, sticky="w")
        profiles = snmp.list_profiles()
        self._profile_ids = [p[0] for p in profiles]
        self.profile_var = tk.StringVar(value=self._profile_ids[0] if self._profile_ids else "generic")
        self.profile_menu = ctk.CTkOptionMenu(
            form,
            variable=self.profile_var,
            values=self._profile_ids or ["generic"],
        )
        self.profile_menu.grid(row=3, column=1, padx=5, pady=5, sticky="ew")

        ctk.CTkLabel(form, text="Community SNMP").grid(row=4, column=0, padx=5, pady=5, sticky="w")
        self.community_var = tk.StringVar(value=default_community)
        ctk.CTkEntry(form, textvariable=self.community_var).grid(row=4, column=1, padx=5, pady=5, sticky="ew")

        ctk.CTkLabel(form, text="Тип").grid(row=5, column=0, padx=5, pady=5, sticky="w")
        self._color_mode_ids = [c[0] for c in COLOR_MODE_CHOICES]
        self._color_mode_labels = [c[1] for c in COLOR_MODE_CHOICES]
        self.color_mode_var = tk.StringVar(value=self._color_mode_labels[0])
        self.color_mode_menu = ctk.CTkOptionMenu(
            form,
            variable=self.color_mode_var,
            values=self._color_mode_labels,
        )
        self.color_mode_menu.grid(row=5, column=1, padx=5, pady=5, sticky="ew")

        ctk.CTkLabel(form, text="Формула счётчиков").grid(row=6, column=0, padx=5, pady=5, sticky="w")
        self._preset_ids = [item[0] for item in PRESET_CHOICES]
        self._preset_labels = [item[1] for item in PRESET_CHOICES]
        self.preset_var = tk.StringVar(value=self._label_for_preset("generic"))
        self._guess_locked = False
        self._applying_guess = False
        self.preset_menu = ctk.CTkOptionMenu(
            form,
            variable=self.preset_var,
            values=self._preset_labels,
            command=self._on_preset_picked,
        )
        self.preset_menu.grid(row=6, column=1, padx=5, pady=5, sticky="ew")
        self.name_var.trace_add("write", self._guess_preset_from_form)
        self.host_var.trace_add("write", self._guess_preset_from_form)
        self.profile_var.trace_add("write", self._guess_preset_from_form)

        self.enabled_var = tk.BooleanVar(value=True)
        ctk.CTkSwitch(form, text="Сбор включён", variable=self.enabled_var).grid(
            row=7, column=0, columnspan=2, sticky="w", padx=5, pady=5
        )

        btn_row = ctk.CTkFrame(form, fg_color="transparent")
        btn_row.grid(row=8, column=0, columnspan=2, pady=8, sticky="ew")
        self.save_btn = ctk.CTkButton(btn_row, text="Добавить", command=self._save_printer)
        self.save_btn.pack(side="left", padx=4)
        ctk.CTkButton(btn_row, text="Отмена", command=self._cancel_edit).pack(side="left", padx=4)
        ctk.CTkButton(btn_row, text="Проверить SNMP", command=self._test_snmp).pack(side="left", padx=4)
        ctk.CTkButton(btn_row, text="Снять сейчас (все)", command=self._collect_all).pack(side="left", padx=4)
        ctk.CTkButton(
            btn_row,
            text="Загрузить из Firestore",
            command=self._pull_firestore,
        ).pack(side="left", padx=4)

        self.progress = ctk.CTkProgressBar(self)
        self.progress.grid(row=2, column=0, sticky="ew", padx=10, pady=(0, 5))
        self.progress.set(0)
        self.status_label = ctk.CTkLabel(self, text="")
        self.status_label.grid(row=3, column=0, sticky="w", padx=12, pady=(0, 8))

        self.list_frame = ctk.CTkScrollableFrame(self, label_text="Принтеры")
        self.list_frame.grid(row=1, column=0, sticky="nsew", padx=10, pady=5)
        self.list_frame.grid_columnconfigure(0, weight=1)

        self.refresh()

    def _color_mode_from_label(self, label: str) -> str:
        for mode_id, mode_label in COLOR_MODE_CHOICES:
            if mode_label == label:
                return mode_id
        return normalize_color_mode(None)

    def _label_for_color_mode(self, mode: str) -> str:
        return COLOR_MODE_LABELS.get(normalize_color_mode(mode), self._color_mode_labels[0])

    def _preset_from_label(self, label: str) -> str:
        for preset_id, preset_label in PRESET_CHOICES:
            if preset_label == label:
                return preset_id
        return normalize_counter_preset(None)

    def _label_for_preset(self, preset: str) -> str:
        return PRESET_LABELS.get(normalize_counter_preset(preset), self._preset_labels[-1])

    def _on_preset_picked(self, _label: str) -> None:
        if self._applying_guess:
            return
        self._guess_locked = True

    def _guess_preset_from_form(self, *_args: object) -> None:
        if self._guess_locked:
            return
        preset = guess_counter_preset(
            self.name_var.get(),
            self.host_var.get(),
            self.profile_var.get(),
        )
        self._applying_guess = True
        try:
            self.preset_var.set(self._label_for_preset(preset))
        finally:
            self._applying_guess = False

    def _form_printer(self) -> Printer:
        host = self.host_var.get().strip()
        name = self.name_var.get().strip() or host
        return Printer(
            id=self._editing_id,
            name=name,
            host=host,
            profile_id=self.profile_var.get(),
            community=self.community_var.get().strip() or self.default_community,
            enabled=self.enabled_var.get(),
            color_mode=self._color_mode_from_label(self.color_mode_var.get()),
            counter_preset=self._preset_from_label(self.preset_var.get()),
        )

    def _cancel_edit(self) -> None:
        self._editing_id = None
        self.form_title.configure(text="Новый принтер")
        self.save_btn.configure(text="Добавить")
        self.name_var.set("")
        self.host_var.set("")
        self.community_var.set(self.default_community)
        self.enabled_var.set(True)
        if self._profile_ids:
            self.profile_var.set(self._profile_ids[0])
        self.color_mode_var.set(self._color_mode_labels[0])
        self._guess_locked = False
        self._guess_preset_from_form()

    def _start_edit(self, printer: Printer) -> None:
        self._editing_id = printer.id
        self.form_title.configure(text=f"Редактирование: {printer.name}")
        self.save_btn.configure(text="Сохранить")
        self._guess_locked = True
        self.name_var.set(printer.name)
        self.host_var.set(printer.host)
        self.profile_var.set(printer.profile_id)
        self.community_var.set(printer.community)
        self.enabled_var.set(printer.enabled)
        self.color_mode_var.set(self._label_for_color_mode(printer.color_mode))
        self.preset_var.set(self._label_for_preset(printer.counter_preset))

    def refresh(self) -> None:
        for w in self.list_frame.winfo_children():
            w.destroy()
        for p in self.db.list_printers():
            self._render_printer_row(p)

    def _render_printer_row(self, printer: Printer) -> None:
        row = ctk.CTkFrame(self.list_frame)
        row.grid(sticky="ew", pady=4)
        row.grid_columnconfigure(0, weight=1)

        last = self.db.last_reading_for_printer(printer.id)
        last_txt = "—"
        if last:
            last_txt = f"{last.collected_at.astimezone().strftime('%Y-%m-%d %H:%M')} ({last.status})"

        state = "вкл" if printer.enabled else "выкл"
        type_lbl = COLOR_MODE_LABELS.get(printer.color_mode, printer.color_mode)
        preset_lbl = self._label_for_preset(printer.counter_preset)
        billing = ""
        if last:
            billing = "  |  " + " · ".join(
                format_billing_lines(printer.counter_preset, last.metrics)
            )
        cloud = ""
        if printer.synced_from_cloud and printer.firestore_id:
            cloud = f"  |  SL:{printer.firestore_id[:8]}…"
        elif printer.synced_from_cloud:
            cloud = "  |  SL"
        text = (
            f"{printer.name}  |  {printer.host}  |  {type_lbl}  |  {preset_lbl}  |  "
            f"{printer.profile_id}  |  {state}{cloud}  |  последний: {last_txt}{billing}"
        )
        ctk.CTkLabel(row, text=text, anchor="w").grid(row=0, column=0, sticky="ew", padx=8, pady=6)

        actions = ctk.CTkFrame(row, fg_color="transparent")
        actions.grid(row=0, column=1, padx=4)
        ctk.CTkButton(
            actions,
            text="Изменить",
            width=80,
            command=lambda pr=printer: self._start_edit(pr),
        ).pack(side="left", padx=2)
        ctk.CTkButton(
            actions,
            text="Снять",
            width=70,
            command=lambda pr=printer: self._collect_one(pr),
        ).pack(side="left", padx=2)
        ctk.CTkButton(
            actions,
            text="Удалить",
            width=70,
            fg_color="#8b3a3a",
            hover_color="#6d2d2d",
            command=lambda pid=printer.id: self._delete_printer(pid),
        ).pack(side="left", padx=2)

    def _save_printer(self) -> None:
        printer = self._form_printer()
        if not printer.host:
            messagebox.showwarning("Принтер", "Укажите IP или hostname")
            return
        try:
            if self._editing_id is None:
                self.db.add_printer(printer)
                self._cancel_edit()
            else:
                self.db.update_printer(printer)
                self._cancel_edit()
            self.refresh()
            self.on_data_changed()
        except Exception as exc:
            messagebox.showerror("Ошибка", str(exc))

    def _delete_printer(self, printer_id: int | None) -> None:
        if printer_id is None:
            return
        if self._editing_id == printer_id:
            self._cancel_edit()
        if messagebox.askyesno("Удалить", "Удалить принтер и все его снимки?"):
            self.db.delete_printer(printer_id)
            self.refresh()
            self.on_data_changed()

    def _test_snmp(self) -> None:
        host = self.host_var.get().strip()
        if not host:
            messagebox.showwarning("SNMP", "Укажите IP для проверки")
            return
        printer = self._form_printer()
        if not printer.name:
            printer.name = host

        def work() -> None:
            result = self.collector.test_printer(printer)
            lines = [
                f"Успех: {result.success}",
                f"sysName: {result.sys_name}",
                f"sysObjectID: {result.sys_object_id}",
                f"Рекомендуемый профиль: {result.suggested_profile}",
                f"Сообщение: {result.message}",
                "",
            ]
            lines.append(f"Формула: {self._label_for_preset(printer.counter_preset)}")
            lines.extend(format_billing_lines(printer.counter_preset, result.metrics))
            if result.errors:
                lines.append("")
                lines.append(f"Ошибок OID: {len(result.errors)}")
            self.after(0, lambda: messagebox.showinfo("Проверка SNMP", "\n".join(lines)))

        threading.Thread(target=work, daemon=True).start()

    def _collect_one(self, printer: Printer) -> None:
        self._run_collect(self.collector.collect_all, single_name=printer.name)

    def _collect_all(self) -> None:
        self._run_collect(self.collector.collect_all)

    def _pull_firestore(self) -> None:
        def work() -> None:
            result = self.collector.pull_printers_from_firestore()
            self.after(0, lambda: messagebox.showinfo("Firestore", result.message))
            self.after(0, self.refresh)
            self.after(0, self.on_data_changed)

        threading.Thread(target=work, daemon=True).start()

    def _run_collect(self, fn: Callable, single_name: str | None = None) -> None:
        self.progress.set(0)
        self.status_label.configure(text="Сбор…")

        def work() -> None:
            try:
                def on_progress(name: str, done: int, total: int) -> None:
                    frac = done / total if total else 1
                    self.after(0, lambda value=frac: self.progress.set(value))
                    self.after(
                        0,
                        lambda label=f"{name} ({done}/{total})": self.status_label.configure(text=label),
                    )

                if single_name:
                    printer = next((p for p in self.db.list_printers() if p.name == single_name), None)
                    if printer:
                        self.collector._collect_one(printer, self.collector.config.schedule.mode)
                        self.after(0, lambda: self.progress.set(1))
                else:
                    fn(on_progress=on_progress)
                self.after(0, lambda: self.status_label.configure(text="Готово"))
            except Exception as exc:
                err = str(exc)
                self.after(0, lambda: self.status_label.configure(text=f"Ошибка: {err}"))
                self.after(0, lambda: messagebox.showerror("Сбор", err))
            finally:
                self.after(0, self.refresh)
                self.after(0, self.on_data_changed)

        threading.Thread(target=work, daemon=True).start()
