"""Маппинг локальных счётчиков в формат SL CounterReadings."""

from __future__ import annotations

from typing import Any

from app.models import Printer
from app.snmp.billing import billing_for_sync, interpret_billing, source_metrics


def sl_color_mode_from_local(color_mode: str) -> str:
    return "bw" if color_mode == "mono" else "color"


def local_color_mode_from_sl(color_mode: str) -> str:
    return "mono" if color_mode == "bw" else "color"


def billing_to_sl_values(billing: dict[str, Any], sl_color_mode: str) -> dict[str, Any]:
    total = billing.get("total")
    values: dict[str, Any] = {"total": int(total) if total is not None else 0}
    if sl_color_mode == "color":
        mono = billing.get("black")
        if mono is not None:
            values["mono"] = int(mono)
        color = billing.get("color")
        if color is not None:
            values["color"] = int(color)
        fifth = billing.get("fifth_color")
        if fifth is not None:
            values["special"] = {"fifth": int(fifth)}
    return values


def merge_sl_printer_entries(
    existing: list[dict[str, Any]],
    local: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Объединяет массив printers[]: локальные SNMP-данные дополняют или обновляют запись SL."""
    by_id: dict[str, dict[str, Any]] = {}
    order: list[str] = []
    for item in existing:
        pid = str(item.get("printerId") or "").strip()
        if not pid:
            continue
        if pid not in by_id:
            order.append(pid)
        by_id[pid] = item
    for item in local:
        pid = str(item.get("printerId") or "").strip()
        if not pid:
            continue
        if pid not in by_id:
            order.append(pid)
        by_id[pid] = item
    return [by_id[pid] for pid in order if pid in by_id]


def printer_entry_from_reading(printer: Printer, metrics: dict[str, Any]) -> dict[str, Any]:
    bill = interpret_billing(printer.counter_preset, source_metrics(metrics))
    billing = billing_for_sync(bill)
    sl_mode = sl_color_mode_from_local(printer.color_mode)
    return {
        "printerId": printer.firestore_id,
        "printerName": printer.name,
        "colorMode": sl_mode,
        "values": billing_to_sl_values(billing, sl_mode),
    }
