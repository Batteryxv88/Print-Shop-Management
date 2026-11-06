from __future__ import annotations

import os
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from app.paths import APP_ROOT, DATA_DIR, EXAMPLE_CONFIG, ROOT_DIR, DEFAULT_DATA_DIR


def _app_data_dir() -> Path:
    appdata = os.environ.get("APPDATA")
    if appdata:
        return Path(appdata) / "PrinterCounterCollector"
    return DEFAULT_DATA_DIR


@dataclass
class SnmpDefaults:
    default_community: str = "public"
    timeout_sec: float = 5.0
    retries: int = 2


@dataclass
class ScheduleConfig:
    enabled: bool = False
    mode: str = "monthly"  # daily | monthly
    time: str = "08:00"


@dataclass
class RetryConfig:
    """Повторный опрос каждый час в течение дня, пока принтер недоступен."""
    enabled: bool = False
    day_start: str = "07:00"
    day_end: str = "22:00"


@dataclass
class FirebaseConfig:
    enabled: bool = False
    project_id: str = ""
    credentials_path: str = ""
    site_id: str = "default"
    agent_user_id: str = "snmp-desktop-collector"
    agent_user_name: str = "SNMP Desktop"


@dataclass
class AppConfig:
    snmp: SnmpDefaults = field(default_factory=SnmpDefaults)
    schedule: ScheduleConfig = field(default_factory=ScheduleConfig)
    retry: RetryConfig = field(default_factory=RetryConfig)
    firebase: FirebaseConfig = field(default_factory=FirebaseConfig)
    database_path: str = ""

    @property
    def db_path(self) -> Path:
        if self.database_path:
            p = Path(self.database_path)
            if not p.is_absolute():
                p = APP_ROOT / p
        else:
            p = DATA_DIR / "collector.db"
        p.parent.mkdir(parents=True, exist_ok=True)
        return p


class ConfigManager:
    def __init__(self, config_path: Path | None = None) -> None:
        self._config_path = config_path or (_app_data_dir() / "config.yaml")
        self._project_config = DEFAULT_DATA_DIR / "config.yaml"
        self._ensure_config_file()
        self.config = self._load()

    def _ensure_config_file(self) -> None:
        if self._config_path.exists():
            return
        self._config_path.parent.mkdir(parents=True, exist_ok=True)
        if EXAMPLE_CONFIG.exists():
            shutil.copy(EXAMPLE_CONFIG, self._config_path)
        elif self._project_config.exists():
            shutil.copy(self._project_config, self._config_path)
        else:
            self.save(AppConfig())

    def _load(self) -> AppConfig:
        with open(self._config_path, encoding="utf-8") as f:
            raw: dict[str, Any] = yaml.safe_load(f) or {}
        snmp_raw = raw.get("snmp") or {}
        sched_raw = raw.get("schedule") or {}
        retry_raw = raw.get("retry") or {}
        fb_raw = raw.get("firebase") or {}
        return AppConfig(
            snmp=SnmpDefaults(
                default_community=str(snmp_raw.get("default_community", "public")),
                timeout_sec=float(snmp_raw.get("timeout_sec", 5)),
                retries=int(snmp_raw.get("retries", 2)),
            ),
            schedule=ScheduleConfig(
                enabled=bool(sched_raw.get("enabled", False)),
                mode=str(sched_raw.get("mode", "monthly")),
                time=str(sched_raw.get("time", "08:00")),
            ),
            retry=RetryConfig(
                enabled=bool(retry_raw.get("enabled", False)),
                day_start=str(retry_raw.get("day_start", "07:00")),
                day_end=str(retry_raw.get("day_end", "22:00")),
            ),
            firebase=FirebaseConfig(
                enabled=bool(fb_raw.get("enabled", False)),
                project_id=str(fb_raw.get("project_id", "")),
                credentials_path=str(fb_raw.get("credentials_path", "")),
                site_id=str(fb_raw.get("site_id", "default")),
                agent_user_id=str(fb_raw.get("agent_user_id", "snmp-desktop-collector")),
                agent_user_name=str(fb_raw.get("agent_user_name", "SNMP Desktop")),
            ),
            database_path=str(raw.get("database_path", "data/collector.db")),
        )

    def save(self, config: AppConfig) -> None:
        self._config_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "snmp": {
                "default_community": config.snmp.default_community,
                "timeout_sec": config.snmp.timeout_sec,
                "retries": config.snmp.retries,
            },
            "schedule": {
                "enabled": config.schedule.enabled,
                "mode": config.schedule.mode,
                "time": config.schedule.time,
            },
            "retry": {
                "enabled": config.retry.enabled,
                "day_start": config.retry.day_start,
                "day_end": config.retry.day_end,
            },
            "firebase": {
                "enabled": config.firebase.enabled,
                "project_id": config.firebase.project_id,
                "credentials_path": config.firebase.credentials_path,
                "site_id": config.firebase.site_id,
                "agent_user_id": config.firebase.agent_user_id,
                "agent_user_name": config.firebase.agent_user_name,
            },
            "database_path": config.database_path,
        }
        with open(self._config_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(payload, f, allow_unicode=True, default_flow_style=False)
        self.config = config

    @property
    def path(self) -> Path:
        return self._config_path
