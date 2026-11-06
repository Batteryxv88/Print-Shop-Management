"""Формулы и SNMP-коды: один YAML на модель в app/snmp/formulas/."""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from typing import Any

import yaml

from app.paths import resource_path

FORMULAS_DIR = resource_path("app", "snmp", "formulas")


@dataclass
class FormulaField:
    key: str
    label: str
    rule: str
    match: tuple[str, ...] = ()
    fallback_match: str = ""
    copy_from: str = ""
    type_code: int | None = None
    fallback_metric: str = ""
    optional: bool = False


@dataclass
class CounterFormula:
    id: str
    title: str
    order: int
    profile: str
    detect: tuple[str, ...] = ()
    detect_profile: str = ""
    require: tuple[str, ...] = ()
    unmapped: str = ""
    snmp: dict[str, Any] = field(default_factory=dict)
    fields: tuple[FormulaField, ...] = ()


def _as_match(value: Any) -> tuple[str, ...]:
    if value is None:
        return ()
    if isinstance(value, list):
        return tuple(str(item) for item in value)
    return (str(value),)


def _load_file(path) -> CounterFormula:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    fields: list[FormulaField] = []
    for item in raw.get("billing") or []:
        type_code = item.get("type")
        fields.append(
            FormulaField(
                key=str(item["key"]),
                label=str(item.get("label") or item["key"]),
                rule=str(item.get("rule") or "label"),
                match=_as_match(item.get("match")),
                fallback_match=str(item.get("fallback_match") or ""),
                copy_from=str(item.get("from") or ""),
                type_code=int(type_code) if type_code is not None else None,
                fallback_metric=str(item.get("fallback_metric") or ""),
                optional=bool(item.get("optional", False)),
            )
        )
    return CounterFormula(
        id=str(raw["id"]),
        title=str(raw.get("title") or raw["id"]),
        order=int(raw.get("order") or 100),
        profile=str(raw.get("profile") or ""),
        detect=tuple(str(item) for item in (raw.get("detect") or [])),
        detect_profile=str(raw.get("detect_profile") or ""),
        require=tuple(str(item) for item in (raw.get("require") or [])),
        unmapped=str(raw.get("unmapped") or ""),
        snmp=dict(raw.get("snmp") or {}),
        fields=tuple(fields),
    )


@lru_cache(maxsize=1)
def load_formulas() -> dict[str, CounterFormula]:
    found: dict[str, CounterFormula] = {}
    if not FORMULAS_DIR.is_dir():
        return found
    for path in sorted(FORMULAS_DIR.glob("*.yaml")):
        formula = _load_file(path)
        found[formula.id] = formula
    return found


def formulas_in_order() -> list[CounterFormula]:
    return sorted(load_formulas().values(), key=lambda item: (item.order, item.id))
