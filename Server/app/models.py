from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class Printer:
    id: int | None
    name: str
    host: str
    profile_id: str
    snmp_version: str = "2c"
    community: str = "public"
    enabled: bool = True
    color_mode: str = "mono"
    counter_preset: str = "generic"
    firestore_id: str | None = None
    model: str = ""
    synced_from_cloud: bool = False
    created_at: datetime | None = None


@dataclass
class Reading:
    id: int | None
    printer_id: int
    collected_at: datetime
    period_type: str
    status: str
    error_message: str | None
    metrics: dict[str, Any]
    printer_name: str | None = None
    printer_host: str | None = None


@dataclass
class ReadingDTO:
    reading_id: int
    printer_id: int
    printer_name: str
    printer_host: str
    profile_id: str
    collected_at: datetime
    period_type: str
    status: str
    metrics: dict[str, Any]
    printer_color_mode: str = "mono"
    counter_preset: str = "generic"


@dataclass
class SyncResult:
    success: bool
    state: str
    message: str = ""


@dataclass
class SnmpTestResult:
    success: bool
    sys_name: str | None = None
    sys_object_id: str | None = None
    suggested_profile: str | None = None
    metrics: dict[str, Any] = field(default_factory=dict)
    errors: dict[str, str] = field(default_factory=dict)
    message: str = ""
