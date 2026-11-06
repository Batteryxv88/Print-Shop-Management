"""Биллинговые числа оператора.

Формула и SNMP-коды каждой модели лежат в app/snmp/formulas/<id>.yaml.
Сырой обход не попадает в экран и в очередь синхронизации.
"""

from __future__ import annotations

import re
from typing import Any

from app.snmp.formula_loader import formulas_in_order, load_formulas
from app.snmp.metrics_utils import CATEGORY_COUNTER, CATEGORY_INFO

PRESET_KM_C3070 = "km_c3070"
PRESET_KM_C6100 = "km_c6100"
PRESET_RICOH_8210 = "ricoh_8210"
PRESET_RICOH_C7210X = "ricoh_c7210x"
PRESET_KM_GENERIC = "km_generic"
PRESET_GENERIC = "generic"

PRESET_CHOICES: list[tuple[str, str]] = [
    (item.id, item.title) for item in formulas_in_order()
]
PRESET_LABELS = dict(PRESET_CHOICES)

C7210X_UNMAPPED = (
    load_formulas().get(PRESET_RICOH_C7210X).unmapped
    if PRESET_RICOH_C7210X in load_formulas()
    else "счётчики C7210X ещё не сопоставлены"
)

_BILLING_ORDER = (
    ("total", "Всего"),
    ("color", "Цвет"),
    ("black", "Ч/Б"),
    ("fifth_color", "5-й цвет"),
)


def normalize_counter_preset(value: str | None) -> str:
    if value in PRESET_LABELS:
        return value
    return PRESET_GENERIC


def guess_counter_preset(name: str, host: str = "", profile_id: str | None = None) -> str:
    """Пресет по имени или адресу. Шаблоны — в YAML каждой модели."""
    blob = f"{name} {host}"
    for formula in formulas_in_order():
        for pattern in formula.detect:
            if re.search(pattern, blob, flags=re.IGNORECASE):
                return formula.id
    for formula in formulas_in_order():
        if formula.detect_profile and formula.detect_profile == profile_id:
            return formula.id
    return PRESET_GENERIC


def interpret_billing(preset: str, metrics: dict[str, Any] | None) -> dict[str, Any]:
    """Возвращает total, black, color, fifth_color (или None) и unmapped.

    Правила читаются из app/snmp/formulas/<preset>.yaml.
    """
    metrics = metrics or {}
    preset = normalize_counter_preset(preset)
    formula = load_formulas().get(preset) or load_formulas().get(PRESET_GENERIC)
    result: dict[str, Any] = {
        "total": None,
        "black": None,
        "color": None,
        "fifth_color": None,
        "unmapped": False,
    }
    if formula is None:
        return result
    labels = _label_index(metrics)
    for field in formula.fields:
        result[field.key] = _apply_field(field, labels, metrics, result)
    if formula.require and any(result.get(key) is None for key in formula.require):
        for key in ("total", "black", "color", "fifth_color"):
            result[key] = None
        result["unmapped"] = True
    return result


def split_reading_metrics(
    preset: str,
    raw: dict[str, Any] | None,
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Снимок для SQLite (с подписями и _raw) и чистый объект для синхронизации."""
    bill = interpret_billing(preset, raw)
    stored: dict[str, Any] = {}
    sync: dict[str, Any] = {}
    if bill.get("unmapped"):
        stored["billing_status"] = C7210X_UNMAPPED
        stored["_label_billing_status"] = "Статус"
        stored["_category_billing_status"] = CATEGORY_INFO
        sync["status"] = C7210X_UNMAPPED
    else:
        labels = dict(_BILLING_ORDER)
        for key, label in labels.items():
            value = bill.get(key)
            if not _is_counter(value):
                continue
            stored[key] = value
            stored[f"_label_{key}"] = label
            stored[f"_category_{key}"] = CATEGORY_COUNTER
            sync[key] = value
    stored["_counter_preset"] = normalize_counter_preset(preset)
    stored["_raw"] = dict(raw or {})
    return stored, sync


def billing_for_sync(metrics: dict[str, Any] | None) -> dict[str, Any]:
    """Только числа биллинга. Сырые строки и подписи _label_ не уходят в очередь."""
    metrics = metrics or {}
    out: dict[str, Any] = {}
    for key, _label in _BILLING_ORDER:
        value = metrics.get(key)
        if _is_counter(value):
            out[key] = value
    status = metrics.get("billing_status")
    if not isinstance(status, str) or not status:
        status = metrics.get("status") if isinstance(metrics.get("status"), str) else ""
    if status:
        out["status"] = status
    return out


def source_metrics(metrics: dict[str, Any] | None) -> dict[str, Any]:
    metrics = metrics or {}
    raw = metrics.get("_raw")
    if isinstance(raw, dict):
        return raw
    return metrics


def format_billing_lines(preset: str, metrics: dict[str, Any] | None) -> list[str]:
    bill = interpret_billing(preset, source_metrics(metrics))
    if bill.get("unmapped"):
        return [C7210X_UNMAPPED]
    lines: list[str] = []
    for key, label in _BILLING_ORDER:
        value = bill.get(key)
        if _is_counter(value):
            lines.append(f"{label}: {value}")
    if not lines:
        return ["Нет биллинговых счётчиков"]
    return lines


def _apply_field(field, labels: dict[str, int], metrics: dict[str, Any], result: dict[str, Any]) -> int | None:
    if field.rule == "sum_labels":
        nums = [labels.get(_norm_label(name)) for name in field.match]
        found = [item for item in nums if item is not None]
        return sum(found) if found else None
    if field.rule == "copy":
        value = result.get(field.copy_from)
        return value if _is_counter(value) else None
    if field.rule == "counter_type" and field.type_code is not None:
        rows = metrics.get("_counter_rows")
        found = _first_type(rows if isinstance(rows, list) else [], field.type_code)
        if found is None and field.fallback_metric:
            scalar = metrics.get(field.fallback_metric)
            if _is_counter(scalar):
                return int(scalar)
        return found
    found = None
    if field.match:
        found = labels.get(_norm_label(field.match[0]))
    if found is None and field.fallback_match:
        found = labels.get(_norm_label(field.fallback_match))
    return found


def _first_type(rows: list[Any], type_code: int) -> int | None:
    for row in rows:
        if not isinstance(row, dict):
            continue
        if _as_type(row.get("type")) != type_code:
            continue
        value = row.get("value")
        if _is_counter(value) and value >= 0:
            return int(value)
    return None


def _as_type(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, str) and value.isdigit():
        return int(value)
    return None


def _label_index(metrics: dict[str, Any]) -> dict[str, int]:
    found: dict[str, int] = {}
    for key, value in metrics.items():
        if not isinstance(key, str) or key.startswith("_"):
            continue
        if not _is_counter(value):
            continue
        label = metrics.get(f"_label_{key}")
        norm = _norm_label(str(label) if label is not None else "")
        if not norm or norm in found:
            continue
        found[norm] = int(value)
    return found


def _norm_label(text: str) -> str:
    s = text.strip().lower().replace("ё", "е")
    s = re.sub(r"\s*:\s*", ":", s)
    s = re.sub(r"\s+", " ", s).strip()
    if s.endswith(":"):
        s = s[:-1].strip()
    return s


def _is_counter(value: Any) -> bool:
    return isinstance(value, int) and not isinstance(value, bool)
