from __future__ import annotations

import shutil
import threading
from pathlib import Path

import customtkinter as ctk

from app.config import AppConfig, ConfigManager
from app.paths import DATA_DIR, DEFAULT_DATA_DIR, EXAMPLE_CONFIG
from app.scheduler.jobs import CollectionScheduler
from app.services.collector import CollectorService
from app.snmp.client import SnmpClient
from app.storage.db import Database
from app.gui.views.history_view import HistoryView
from app.gui.views.printers_view import PrintersView
from app.gui.views.schedule_view import ScheduleView
from app.gui.views.settings_view import SettingsView
from app.gui.views.sync_view import SyncView


class MainApp(ctk.CTk):
    def __init__(self) -> None:
        super().__init__()
        ctk.set_appearance_mode("System")
        ctk.set_default_color_theme("blue")

        self.title("Сбор счётчиков принтеров (SNMP)")
        self.geometry("1100x700")
        self.minsize(900, 600)

        self._ensure_local_config()
        self.config_manager = ConfigManager(self._local_config_path())
        self.config = self.config_manager.config

        self.db = Database(self.config.db_path)
        self.snmp = SnmpClient(
            timeout_sec=self.config.snmp.timeout_sec,
            retries=self.config.snmp.retries,
        )
        self.collector = CollectorService(self.db, self.config, self.snmp)
        self.scheduler = CollectionScheduler(
            on_collect=self._scheduled_collect,
            on_retry=self._scheduled_retry,
        )
        self.scheduler.start()
        self.scheduler.apply_config(self.config.schedule, self.config.retry)

        self.tabview = ctk.CTkTabview(self)
        self.tabview.pack(fill="both", expand=True, padx=10, pady=10)

        self.tabview.add("Принтеры")
        self.tabview.add("Расписание")
        self.tabview.add("История")
        self.tabview.add("Синхронизация")
        self.tabview.add("Настройки")

        self.printers_view = PrintersView(
            self.tabview.tab("Принтеры"),
            self.db,
            self.collector,
            self.snmp,
            self.config.snmp.default_community,
            on_data_changed=self._on_data_changed,
        )
        self.printers_view.pack(fill="both", expand=True)

        self.schedule_view = ScheduleView(
            self.tabview.tab("Расписание"),
            self.config,
            self.scheduler,
            on_save=self._save_config,
        )
        self.schedule_view.pack(fill="both", expand=True)

        self.history_view = HistoryView(
            self.tabview.tab("История"),
            self.db,
            get_export_dir=lambda: DEFAULT_DATA_DIR,
        )
        self.history_view.pack(fill="both", expand=True)

        self.sync_view = SyncView(self.tabview.tab("Синхронизация"), self.db, self.collector)
        self.sync_view.pack(fill="both", expand=True)

        self.settings_view = SettingsView(
            self.tabview.tab("Настройки"),
            self.config,
            self.config_manager.path,
            self.config.db_path,
            self.collector,
            on_save=self._save_config,
        )
        self.settings_view.pack(fill="both", expand=True)

        self.protocol("WM_DELETE_WINDOW", self._on_close)

    @staticmethod
    def _local_config_path() -> Path:
        return DATA_DIR / "config.yaml"

    def _ensure_local_config(self) -> None:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        local = DATA_DIR / "config.yaml"
        if not local.exists() and EXAMPLE_CONFIG.exists():
            shutil.copy(EXAMPLE_CONFIG, local)

    def _save_config(self, config: AppConfig) -> None:
        self.config = config
        self.config_manager.save(config)
        self.collector.config = config
        self.collector.refresh_sync_backend()
        self.scheduler.apply_config(config.schedule, config.retry)
        self.schedule_view.refresh()

    def _scheduled_collect(self, period_type: str) -> None:
        def work() -> None:
            self.collector.collect_all(period_type=period_type)
            self.after(0, self._on_data_changed)

        threading.Thread(target=work, daemon=True).start()

    def _scheduled_retry(self) -> None:
        def work() -> None:
            if not self.config.retry.enabled:
                return
            self.collector.collect_unreachable()
            self.after(0, self._on_data_changed)

        threading.Thread(target=work, daemon=True).start()

    def _on_data_changed(self) -> None:
        self.printers_view.refresh()
        self.history_view.reload_filters()
        self.sync_view.refresh()

    def _on_close(self) -> None:
        self.scheduler.shutdown()
        self.db.close()
        self.destroy()


def main() -> None:
    app = MainApp()
    app.mainloop()
