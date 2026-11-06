"""Сопоставление записей SL Printers с локальными SNMP-профилями."""

from __future__ import annotations

from app.snmp.billing import guess_counter_preset
from app.snmp.formula_loader import load_formulas
from app.sync.sl_firestore import SlPrinterRemote
from app.sync.sl_mapping import local_color_mode_from_sl


def profile_and_preset_for_remote(remote: SlPrinterRemote) -> tuple[str, str]:
    blob = f"{remote.name} {remote.model}".strip()
    preset = guess_counter_preset(blob, remote.ip, None)
    formula = load_formulas().get(preset) or load_formulas().get("generic")
    profile_id = (formula.profile if formula else "") or "generic"
    return profile_id, preset


def local_color_mode(remote: SlPrinterRemote) -> str:
    return local_color_mode_from_sl(remote.color_mode)
