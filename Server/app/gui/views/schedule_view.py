from __future__ import annotations

import tkinter as tk
from typing import Callable

import customtkinter as ctk

from app.config import AppConfig, ScheduleConfig
from app.scheduler.jobs import CollectionScheduler


class ScheduleView(ctk.CTkFrame):
    def __init__(
        self,
        master: ctk.CTkBaseClass,
        config: AppConfig,
        scheduler: CollectionScheduler,
        on_save: Callable[[AppConfig], None],
    ) -> None:
        super().__init__(master)
        self.config = config
        self.scheduler = scheduler
        self.on_save = on_save

        self.grid_columnconfigure(0, weight=1)

        box = ctk.CTkFrame(self)
        box.grid(row=0, column=0, padx=20, pady=20, sticky="nsew")

        self.enabled_var = tk.BooleanVar(value=config.schedule.enabled)
        ctk.CTkSwitch(box, text="Автоматический сбор включён", variable=self.enabled_var).pack(
            anchor="w", padx=10, pady=10
        )

        ctk.CTkLabel(box, text="Режим").pack(anchor="w", padx=10)
        self.mode_var = tk.StringVar(value=config.schedule.mode)
        mode_frame = ctk.CTkFrame(box, fg_color="transparent")
        mode_frame.pack(anchor="w", padx=10, pady=5)
        ctk.CTkRadioButton(mode_frame, text="Каждый день", variable=self.mode_var, value="daily").pack(
            side="left", padx=5
        )
        ctk.CTkRadioButton(
            mode_frame, text="1-е число каждого месяца", variable=self.mode_var, value="monthly"
        ).pack(side="left", padx=5)

        ctk.CTkLabel(box, text="Время (локальное, ЧЧ:ММ)").pack(anchor="w", padx=10, pady=(10, 0))
        self.time_var = tk.StringVar(value=config.schedule.time)
        ctk.CTkEntry(box, textvariable=self.time_var, width=120).pack(anchor="w", padx=10, pady=5)

        ctk.CTkButton(box, text="Сохранить расписание", command=self._save).pack(anchor="w", padx=10, pady=15)

        self.next_run_label = ctk.CTkLabel(box, text="")
        self.next_run_label.pack(anchor="w", padx=10, pady=5)
        self._update_next_run()

    def _save(self) -> None:
        sched = ScheduleConfig(
            enabled=self.enabled_var.get(),
            mode=self.mode_var.get(),
            time=self.time_var.get().strip(),
        )
        self.config.schedule = sched
        self.on_save(self.config)
        self._update_next_run()

    def _update_next_run(self) -> None:
        nxt = self.scheduler.next_run_time()
        if nxt and self.config.schedule.enabled:
            self.next_run_label.configure(text=f"Следующий запуск: {nxt.strftime('%Y-%m-%d %H:%M')}")
        elif self.config.schedule.enabled:
            self.next_run_label.configure(text="Следующий запуск: не запланирован (проверьте время)")
        else:
            self.next_run_label.configure(text="Автосбор выключен")

    def refresh(self) -> None:
        self._update_next_run()
