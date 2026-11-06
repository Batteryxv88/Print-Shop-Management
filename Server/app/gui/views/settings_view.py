from __future__ import annotations

import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox
from typing import Callable

import customtkinter as ctk

from app.config import AppConfig, FirebaseConfig, RetryConfig, SnmpDefaults
from app.services.collector import CollectorService
from app.sync.firestore_stub import FirestoreBackend


class SettingsView(ctk.CTkFrame):
    def __init__(
        self,
        master: ctk.CTkBaseClass,
        config: AppConfig,
        config_path: Path,
        db_path: Path,
        collector: CollectorService,
        on_save: Callable[[AppConfig], None],
    ) -> None:
        super().__init__(master)
        self.config = config
        self.config_path = config_path
        self.db_path = db_path
        self.collector = collector
        self.on_save = on_save

        scroll = ctk.CTkScrollableFrame(self, label_text="Настройки")
        scroll.pack(fill="both", expand=True, padx=10, pady=10)

        ctk.CTkLabel(scroll, text=f"Файл конфигурации: {config_path}").pack(anchor="w", padx=5, pady=2)
        ctk.CTkLabel(scroll, text=f"База SQLite: {db_path}").pack(anchor="w", padx=5, pady=2)

        ctk.CTkLabel(scroll, text="SNMP по умолчанию", font=ctk.CTkFont(weight="bold")).pack(
            anchor="w", padx=5, pady=(15, 5)
        )
        self.community_var = tk.StringVar(value=config.snmp.default_community)
        self.timeout_var = tk.StringVar(value=str(config.snmp.timeout_sec))
        self.retries_var = tk.StringVar(value=str(config.snmp.retries))

        ctk.CTkLabel(scroll, text="Community").pack(anchor="w", padx=5)
        ctk.CTkEntry(scroll, textvariable=self.community_var).pack(fill="x", padx=5, pady=2)
        ctk.CTkLabel(scroll, text="Timeout (сек)").pack(anchor="w", padx=5)
        ctk.CTkEntry(scroll, textvariable=self.timeout_var, width=80).pack(anchor="w", padx=5, pady=2)
        ctk.CTkLabel(scroll, text="Retries").pack(anchor="w", padx=5)
        ctk.CTkEntry(scroll, textvariable=self.retries_var, width=80).pack(anchor="w", padx=5, pady=2)

        ctk.CTkLabel(scroll, text="Повтор при недоступности", font=ctk.CTkFont(weight="bold")).pack(
            anchor="w", padx=5, pady=(15, 5)
        )
        self.retry_enabled = tk.BooleanVar(value=config.retry.enabled)
        ctk.CTkSwitch(
            scroll,
            text="Каждый час опрашивать принтеры с ошибкой SNMP (в заданном интервале)",
            variable=self.retry_enabled,
        ).pack(anchor="w", padx=5, pady=5)
        self.retry_start = tk.StringVar(value=config.retry.day_start)
        self.retry_end = tk.StringVar(value=config.retry.day_end)
        ctk.CTkLabel(scroll, text="Начало дня (ЧЧ:ММ)").pack(anchor="w", padx=5)
        ctk.CTkEntry(scroll, textvariable=self.retry_start, width=80).pack(anchor="w", padx=5, pady=2)
        ctk.CTkLabel(scroll, text="Конец дня (ЧЧ:ММ)").pack(anchor="w", padx=5)
        ctk.CTkEntry(scroll, textvariable=self.retry_end, width=80).pack(anchor="w", padx=5, pady=2)

        ctk.CTkLabel(scroll, text="Firebase / SL (Print Shop Management)", font=ctk.CTkFont(weight="bold")).pack(
            anchor="w", padx=5, pady=(15, 5)
        )
        self.fb_enabled = tk.BooleanVar(value=config.firebase.enabled)
        ctk.CTkSwitch(scroll, text="Включить синхронизацию с Firestore SL", variable=self.fb_enabled).pack(
            anchor="w", padx=5, pady=5
        )
        self.fb_project = tk.StringVar(value=config.firebase.project_id)
        self.fb_creds = tk.StringVar(value=config.firebase.credentials_path)
        self.fb_agent_id = tk.StringVar(value=config.firebase.agent_user_id)
        self.fb_agent_name = tk.StringVar(value=config.firebase.agent_user_name)

        ctk.CTkLabel(scroll, text="Project ID (например sl-sandbox-b84b3)").pack(anchor="w", padx=5)
        ctk.CTkEntry(scroll, textvariable=self.fb_project).pack(fill="x", padx=5, pady=2)
        ctk.CTkLabel(scroll, text="Service account JSON").pack(anchor="w", padx=5)
        cred_row = ctk.CTkFrame(scroll, fg_color="transparent")
        cred_row.pack(fill="x", padx=5)
        ctk.CTkEntry(cred_row, textvariable=self.fb_creds).pack(side="left", fill="x", expand=True, padx=(0, 5))
        ctk.CTkButton(cred_row, text="…", width=40, command=self._pick_creds).pack(side="left")

        ctk.CTkLabel(scroll, text="User ID в CounterReadings").pack(anchor="w", padx=5)
        ctk.CTkEntry(scroll, textvariable=self.fb_agent_id).pack(fill="x", padx=5, pady=2)
        ctk.CTkLabel(scroll, text="Имя в CounterReadings").pack(anchor="w", padx=5)
        ctk.CTkEntry(scroll, textvariable=self.fb_agent_name).pack(fill="x", padx=5, pady=2)

        ctk.CTkButton(scroll, text="Проверить Firebase", command=self._check_firebase).pack(
            anchor="w", padx=5, pady=5
        )
        ctk.CTkButton(scroll, text="Сохранить настройки", command=self._save).pack(anchor="w", padx=5, pady=15)

    def _pick_creds(self) -> None:
        path = filedialog.askopenfilename(filetypes=[("JSON", "*.json")])
        if path:
            self.fb_creds.set(path)

    def _check_firebase(self) -> None:
        fb = FirebaseConfig(
            enabled=self.fb_enabled.get(),
            project_id=self.fb_project.get().strip(),
            credentials_path=self.fb_creds.get().strip(),
            agent_user_id=self.fb_agent_id.get().strip() or "snmp-desktop-collector",
            agent_user_name=self.fb_agent_name.get().strip() or "SNMP Desktop",
        )
        backend = FirestoreBackend(
            self.collector.db,
            fb,
            default_community=self.community_var.get().strip() or "public",
        )
        ok = backend.health_check()
        msg = backend.health_check_message()
        if ok:
            messagebox.showinfo("Firebase", msg)
        else:
            messagebox.showwarning("Firebase", msg)

    def _save(self) -> None:
        try:
            self.config.snmp = SnmpDefaults(
                default_community=self.community_var.get().strip() or "public",
                timeout_sec=float(self.timeout_var.get().strip()),
                retries=int(self.retries_var.get().strip()),
            )
        except ValueError:
            messagebox.showerror("Настройки", "Timeout и retries должны быть числами")
            return
        self.config.retry = RetryConfig(
            enabled=self.retry_enabled.get(),
            day_start=self.retry_start.get().strip() or "07:00",
            day_end=self.retry_end.get().strip() or "22:00",
        )
        self.config.firebase = FirebaseConfig(
            enabled=self.fb_enabled.get(),
            project_id=self.fb_project.get().strip(),
            credentials_path=self.fb_creds.get().strip(),
            agent_user_id=self.fb_agent_id.get().strip() or "snmp-desktop-collector",
            agent_user_name=self.fb_agent_name.get().strip() or "SNMP Desktop",
        )
        self.collector.snmp.timeout_sec = self.config.snmp.timeout_sec
        self.collector.snmp.retries = self.config.snmp.retries
        self.on_save(self.config)
        messagebox.showinfo("Настройки", "Сохранено")
