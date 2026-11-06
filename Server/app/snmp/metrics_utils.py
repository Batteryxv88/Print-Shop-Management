from __future__ import annotations

import re
from typing import Any

CATEGORY_COUNTER = "counter"
CATEGORY_SUPPLY = "supply"
CATEGORY_INFO = "info"
CATEGORY_COMPONENT = "component"


def sanitize_key_part(text: str) -> str:
    s = re.sub(r"[^\w\-]+", "_", text.strip(), flags=re.UNICODE)
    s = re.sub(r"_+", "_", s).strip("_")
    return (s[:40] or "item").lower()


def metric_keys_for_display(metrics: dict[str, Any]) -> list[str]:
    return sorted(
        k
        for k in metrics
        if isinstance(k, str) and not k.startswith("_")
    )


def metric_category(metrics: dict[str, Any], key: str) -> str:
    return str(metrics.get(f"_category_{key}", CATEGORY_COUNTER))


def group_metric_keys(metrics: dict[str, Any]) -> dict[str, list[str]]:
    groups: dict[str, list[str]] = {
        CATEGORY_INFO: [],
        CATEGORY_COUNTER: [],
        CATEGORY_COMPONENT: [],
        CATEGORY_SUPPLY: [],
    }
    for key in metric_keys_for_display(metrics):
        cat = metric_category(metrics, key)
        groups.setdefault(cat, []).append(key)
    return groups


def format_metrics_grouped(metrics: dict[str, Any]) -> list[str]:
    titles = {
        CATEGORY_INFO: "Информация",
        CATEGORY_COUNTER: "Счётчики",
        CATEGORY_COMPONENT: "Узлы (барабаны, ролики, ресурс)",
        CATEGORY_SUPPLY: "Прочие расходники",
    }
    lines: list[str] = []
    grouped = group_metric_keys(metrics)
    for cat in (CATEGORY_INFO, CATEGORY_COUNTER, CATEGORY_COMPONENT, CATEGORY_SUPPLY):
        keys = grouped.get(cat) or []
        if not keys:
            continue
        lines.append(f"=== {titles[cat]} ===")
        for key in keys:
            label = metrics.get(f"_label_{key}", key)
            lines.append(f"  {label}: {metrics.get(key)}")
        lines.append("")
    return lines


def supply_description_matches(
    description: str,
    include_keywords: list[str],
    exclude_keywords: list[str],
) -> bool:
    text = description.lower()
    if exclude_keywords:
        for word in exclude_keywords:
            if word.lower() in text:
                return False
    if include_keywords:
        return any(word.lower() in text for word in include_keywords)
    return True
