"""Сопоставление строк таблиц счётчиков Ricoh/Konica с ключами метрик.

Источники (не фиксировать индекс строки — он плывёт между моделями):

* Ricoh Private MIB Specification v4, ricohEngCounterTable
  1.3.6.1.4.1.367.3.2.1.2.19.5.1: type .2, name .5, value .9.
  Тип 600 = Total Prints: Full Color, 609 = Total Prints: Black & White.
  Тип 606/17 «Printer: Color» и 602/603 Development — не биллинг панели.
  5-й цвет (Special Color / White / Clear / Neon) в публичной таблице v4
  не имеет стабильного индекса: на Pro C7210X (E-45/E-46) его находят по имени.
  https://forum.iobroker.net/assets/uploads/files/294_privatemibspecificationv4_050-4.pdf
  GLPI Agent MibSupport::Ricoh складывает тип 202 (single/two-color) в COLOR —
  так делать нельзя, панель «Full Color» от этого чуть выше.

* Minolta MIB mltSysPrintFunctionCounterTable (enterprise 2590 и то же дерево
  под Konica 18334): значение .5.<colorIndex>.<functionIndex>.
  color: 1=BW, 2=4C Full Color, 3=3C, 4=CMY (1 цвет), 5=RGB, 6=сумма 3+4+5.
  function: 1=copy, 2=printer, 3=receive, 4=fax, 5=reportPrint.
  https://mibbrowser.online/mibdb_search.php?mib=MC2350-MIB
  Листья .5.1.2 / .5.2.2 — только функция printer, поэтому Ч/Б и цвет
  чуть не сходятся с панелью Total / Full Color / Black.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Callable

from app.snmp.metrics_utils import CATEGORY_COUNTER, sanitize_key_part

_EXCLUDE_NAME_PARTS = (
    "coverage",
    "develop",
    "duplex",
    "distribution",
    "scanner",
    "large paper",
    "gpc",
    "send:",
    "send total",
    " a3",
    ">=a3",
    "a3,",
    "a3/",
    "job",
)

_FIFTH_PHRASES = (
    "special color",
    "special colour",
    "spot color",
    "spot colour",
    "5th color",
    "5th colour",
    "fifth color",
    "fifth colour",
    "fifth station",
    "5th station",
    "спеццвет",
    "5-й цвет",
    "5й цвет",
    "пятый цвет",
    "пятая станция",
    "пятый станция",
    "特色",
    "スペシャル",
    "5色",
    "ネオン",
    "ホワイト",
    "クリア",
)


@dataclass
class EngineCounterRow:
    suffix: str
    value: Any
    name: str = ""
    descr: str = ""
    type_code: int | None = None
    color_type: int | None = None
    function_type: int | None = None


@dataclass
class MappedCounter:
    key: str
    value: Any
    label: str
    category: str = CATEGORY_COUNTER
    overwrite: bool = True
    matched_suffixes: tuple[str, ...] = field(default=())


def parse_counter_int(value: Any) -> int | None:
    if isinstance(value, bool) or value is None:
        return None
    if isinstance(value, int):
        return value
    text = str(value).strip()
    if re.fullmatch(r"-?\d+", text):
        return int(text)
    return None


def clean_snmp_text(value: Any) -> str:
    if value is None or isinstance(value, int):
        return ""
    text = str(value).strip().strip('"').strip()
    lowered = text.lower()
    if lowered in {"nosuchobject", "nosuchinstance", "endofmibview", "none"}:
        return ""
    return text


def merge_mapped_counters(
    metrics: dict[str, Any],
    mapped: list[MappedCounter],
    preserve_keys: set[str] | list[str],
) -> None:
    """Кладёт результат обхода в словарь метрик.

    Ключи из preserve_keys (обычно total со скаляра, который уже совпал с панелью)
    не перезаписываются. overwrite=False не затирает уже записанный ключ,
    чтобы фиксированный GET не был затёрт случайным дублем и наоборот:
    канонические black/color/fifth_color идут с overwrite=True и побеждают
    старые индексные GET, если те вдруг использовали тот же ключ.
    """
    preserve = set(preserve_keys)
    for item in mapped:
        if item.key in preserve and item.key in metrics:
            continue
        if not item.overwrite and item.key in metrics:
            continue
        metrics[item.key] = item.value
        metrics[f"_label_{item.key}"] = item.label
        metrics[f"_category_{item.key}"] = item.category


def map_ricoh_engine_counters(rows: list[EngineCounterRow]) -> list[MappedCounter]:
    """Биллинг Ricoh: Total / Full Color / Black и 5-й цвет по имени строки."""
    prepared = [_with_clean_name(row) for row in rows]
    matched: set[str] = set()
    mapped: list[MappedCounter] = []

    total_rows = _select_rows(
        prepared,
        type_groups=[({10}, "one")],
        name_family=_total_name_family,
        name_order=("total",),
    )
    if total_rows:
        mapped.append(_canonical("total", "Всего", total_rows, how="one"))
        matched.update(_collapse_same_type(prepared, total_rows))

    black_rows = _select_rows(
        prepared,
        type_groups=[({609}, "one"), ({201, 301, 401}, "sum"), ({811, 821, 830}, "sum")],
        name_family=_black_name_family,
        name_order=("total", "counter_parts", "app_parts"),
    )
    if black_rows:
        mapped.append(_canonical("black", "Ч/Б", black_rows, how=_how_black(black_rows)))
        matched.update(_collapse_same_type(prepared, black_rows))

    color_rows = _select_rows(
        prepared,
        type_groups=[({600}, "one"), ({203, 403}, "sum"), ({810, 820}, "sum")],
        name_family=_full_color_name_family,
        name_order=("total", "counter_parts", "app_parts"),
    )
    if color_rows:
        how = _how_color(color_rows)
        mapped.append(_canonical("color", "Цвет", color_rows, how=how))
        mapped.append(_canonical("color_full", "Полный цвет", color_rows, how=how))
        matched.update(_collapse_same_type(prepared, color_rows))

    mono_rows = _select_rows(
        prepared,
        type_groups=[({601}, "one")],
        name_family=_mono_name_family,
        name_order=("total",),
    )
    if mono_rows:
        mapped.append(_canonical("mono_color", "Моноцвет", mono_rows, how="one"))
        matched.update(r.suffix for r in mono_rows)

    single_two = [
        r
        for r in prepared
        if r.type_code in {202, 402} and _usable(r)
    ]
    if single_two:
        mapped.append(_canonical("single_two_color", "1-2 цвета", single_two, how="sum"))
        matched.update(r.suffix for r in single_two)

    single_rows = [r for r in prepared if r.type_code in {812, 822} and _usable(r)]
    if single_rows:
        mapped.append(_canonical("single_color", "1 цвет", single_rows, how="sum"))
        matched.update(r.suffix for r in single_rows)

    two_rows = [r for r in prepared if r.type_code in {813, 823} and _usable(r)]
    if two_rows:
        mapped.append(_canonical("two_color", "2 цвета", two_rows, how="sum"))
        matched.update(r.suffix for r in two_rows)

    fifth = _select_fifth([r for r in prepared if r.suffix not in matched])
    if fifth:
        how = "sum" if len(fifth) > 1 else "one"
        name = fifth[0].name if len(fifth) == 1 and fifth[0].name else ""
        fifth_label = f"5-й цвет ({name})" if name else "5-й цвет"
        special_label = f"Доп. станция ({name})" if name else "Доп. станция"
        mapped.append(_canonical("fifth_color", fifth_label, fifth, how=how))
        mapped.append(_canonical("special_color", special_label, fifth, how=how))
        matched.update(r.suffix for r in fifth)

    mapped.extend(_unmatched_extras(prepared, matched, prefix="eng"))
    return mapped


def map_konica_print_counters(rows: list[EngineCounterRow]) -> list[MappedCounter]:
    """Биллинг KM: сумма функций для BW и Full Color (4C), без 2-color и developer.

    Индекс 6 (monoColor) — уже сумма 3C+CMY+RGB, в «Цвет» и «Ч/Б» не входит.
    Неизвестный цветовой индекс (label press, 5-я станция) становится
    special_color / fifth_color, только если такой индекс ровно один.
    """
    grouped: dict[str, list[EngineCounterRow]] = {}
    unknown: dict[int, list[EngineCounterRow]] = {}
    for row in rows:
        value = parse_counter_int(row.value)
        if value is None or value < 0:
            continue
        kind, enum = _km_kind(row)
        stored = EngineCounterRow(
            suffix=row.suffix,
            value=value,
            name=row.name,
            descr=row.descr,
            type_code=row.type_code,
            color_type=enum,
            function_type=_km_function(row),
        )
        if kind == "unknown" and enum is not None:
            unknown.setdefault(enum, []).append(stored)
        elif kind:
            grouped.setdefault(kind, []).append(stored)

    mapped: list[MappedCounter] = []
    if grouped.get("bw"):
        mapped.append(_canonical("black", "Ч/Б", grouped["bw"], how="sum"))
    if grouped.get("full"):
        mapped.append(_canonical("color", "Цвет", grouped["full"], how="sum"))
        mapped.append(_canonical("color_full", "Полный цвет", grouped["full"], how="sum"))
    if grouped.get("mono_sum"):
        mapped.append(_canonical("mono_color", "Моноцвет", grouped["mono_sum"], how="sum"))
    elif grouped.get("three"):
        mapped.append(_canonical("mono_color", "Моноцвет (3C)", grouped["three"], how="sum"))
    if grouped.get("cmy"):
        mapped.append(_canonical("single_color", "1 цвет (CMY)", grouped["cmy"], how="sum"))
    if grouped.get("rgb"):
        mapped.append(_canonical("rgb_color", "RGB", grouped["rgb"], how="sum"))

    special_source: list[EngineCounterRow] | None = None
    if len(unknown) == 1:
        special_source = next(iter(unknown.values()))
        mapped.append(_canonical("special_color", "Доп. станция", special_source, how="sum"))
        mapped.append(_canonical("fifth_color", "5-й цвет", special_source, how="sum"))

    for kind, kind_rows in grouped.items():
        mapped.extend(_km_function_details(kind, kind_rows))
    for enum, kind_rows in sorted(unknown.items()):
        mapped.extend(_km_function_details(f"c{enum}", kind_rows))
        if special_source is not kind_rows:
            mapped.append(
                _canonical(
                    f"km_color_{enum}",
                    f"Цвет #{enum}",
                    kind_rows,
                    how="sum",
                    overwrite=False,
                )
            )
    return mapped


def fill_konica_billing_fallback(metrics: dict[str, Any]) -> None:
    """Если обход таблицы пуст, сложить copy+print только для BW и 4C.

    Это запасной путь к панельным Full Color / Black. CMY/2-color сюда не входит.
    Уже записанные обходом black/color не трогает.
    """
    if "black" not in metrics:
        black = _sum_optional(metrics.get("copy_bw"), metrics.get("print_bw"))
        if black is not None:
            metrics["black"] = black
            metrics["_label_black"] = "Ч/Б"
            metrics["_category_black"] = CATEGORY_COUNTER
    if "color" not in metrics:
        color = _sum_optional(metrics.get("copy_full"), metrics.get("print_full"))
        if color is not None:
            metrics["color"] = color
            metrics["_label_color"] = "Цвет"
            metrics["_category_color"] = CATEGORY_COUNTER
            metrics["color_full"] = color
            metrics["_label_color_full"] = "Полный цвет"
            metrics["_category_color_full"] = CATEGORY_COUNTER


def _sum_optional(*values: Any) -> int | None:
    nums = [v for v in values if isinstance(v, int) and not isinstance(v, bool)]
    if not nums:
        return None
    return sum(nums)


_KM_KIND_BY_ENUM = {
    1: "bw",
    2: "full",
    3: "three",
    4: "cmy",
    5: "rgb",
    6: "mono_sum",
    7: "paper",
}

_KM_KIND_LABEL = {
    "bw": "Ч/Б",
    "full": "Полный цвет",
    "three": "Моноцвет (3C)",
    "cmy": "1 цвет (CMY)",
    "rgb": "RGB",
    "mono_sum": "Моноцвет (сумма)",
    "paper": "Тракт бумаги",
}

_KM_FUNC_KEY = {
    1: "copy",
    2: "print",
    3: "receive",
    4: "fax",
    5: "report",
}

_KM_FUNC_LABEL = {
    1: "копия",
    2: "печать",
    3: "вход",
    4: "факс",
    5: "отчёт",
}


def _km_kind(row: EngineCounterRow) -> tuple[str | None, int | None]:
    enum = row.color_type if row.color_type is not None else _suffix_part(row.suffix, 0)
    if enum is None:
        return None, None
    return _KM_KIND_BY_ENUM.get(enum, "unknown"), enum


def _km_function(row: EngineCounterRow) -> int | None:
    if row.function_type is not None:
        return row.function_type
    return _suffix_part(row.suffix, 1)


def _km_function_details(kind: str, rows: list[EngineCounterRow]) -> list[MappedCounter]:
    by_func: dict[int, list[EngineCounterRow]] = {}
    for row in rows:
        func = row.function_type if row.function_type is not None else 0
        by_func.setdefault(func, []).append(row)
    kind_label = _KM_KIND_LABEL.get(kind, kind)
    details: list[MappedCounter] = []
    for func, func_rows in sorted(by_func.items()):
        func_key = _KM_FUNC_KEY.get(func, f"f{func}")
        func_name = _KM_FUNC_LABEL.get(func, func_key)
        key = f"km_{kind}_{func_key}"
        details.append(
            _canonical(
                key,
                f"{kind_label}, {func_name}",
                func_rows,
                how="sum",
                overwrite=False,
            )
        )
    return details


def _collapse_same_type(
    rows: list[EngineCounterRow],
    chosen: list[EngineCounterRow],
) -> set[str]:
    """Прячем повтор того же type code (в MIB Machine Total часто записан дважды)."""
    suffixes = {r.suffix for r in chosen}
    if len(chosen) == 1 and chosen[0].type_code in {10, 600, 601, 609}:
        code = chosen[0].type_code
        for row in rows:
            if row.type_code == code:
                suffixes.add(row.suffix)
    return suffixes


def _with_clean_name(row: EngineCounterRow) -> EngineCounterRow:
    name = clean_snmp_text(row.name) or clean_snmp_text(row.descr)
    return EngineCounterRow(
        suffix=row.suffix,
        value=parse_counter_int(row.value) if not isinstance(row.value, int) else row.value,
        name=name,
        descr=clean_snmp_text(row.descr),
        type_code=row.type_code if row.type_code is not None else None,
        color_type=row.color_type,
        function_type=row.function_type,
    )


def _select_rows(
    rows: list[EngineCounterRow],
    type_groups: list[tuple[set[int], str]],
    name_family: Callable[[str], str | None],
    name_order: tuple[str, ...],
) -> list[EngineCounterRow]:
    for type_set, how in type_groups:
        found = _sort_rows([r for r in rows if r.type_code in type_set and _usable(r)])
        if not found:
            continue
        return [found[0]] if how == "one" else found
    buckets: dict[str, list[EngineCounterRow]] = {}
    for row in rows:
        if not _usable(row):
            continue
        family = name_family(row.name)
        if family:
            buckets.setdefault(family, []).append(row)
    for family in name_order:
        found = buckets.get(family)
        if not found:
            continue
        found = _sort_rows(found)
        return [found[0]] if family == "total" else found
    return []


def _select_fifth(rows: list[EngineCounterRow]) -> list[EngineCounterRow]:
    cands = [r for r in rows if _usable(r) and _is_fifth_name(r.name)]
    if not cands:
        return []
    totals = [
        r
        for r in cands
        if _looks_like_total_name(r.name) and not _looks_like_part_name(r.name)
    ]
    if len(totals) == 1:
        return totals
    if len(totals) > 1:
        totals = sorted(totals, key=lambda r: (-_fifth_score(r.name), _suffix_key(r.suffix)))
        return [totals[0]]
    parts = [r for r in cands if _looks_like_part_name(r.name)]
    if parts and len(parts) == len(cands):
        return _sort_rows(parts)
    if len(cands) == 1:
        return cands
    cands = sorted(cands, key=lambda r: (-_fifth_score(r.name), _suffix_key(r.suffix)))
    return [cands[0]]


def _canonical(
    key: str,
    label: str,
    rows: list[EngineCounterRow],
    how: str,
    overwrite: bool = True,
) -> MappedCounter:
    if how == "sum":
        value = sum(int(r.value) for r in rows)
    else:
        value = int(rows[0].value)
    return MappedCounter(
        key=key,
        value=value,
        label=label,
        overwrite=overwrite,
        matched_suffixes=tuple(r.suffix for r in rows),
    )


def _how_black(rows: list[EngineCounterRow]) -> str:
    if len(rows) == 1 and (rows[0].type_code == 609 or _black_name_family(rows[0].name) == "total"):
        return "one"
    if len(rows) == 1:
        return "one"
    return "sum"


def _how_color(rows: list[EngineCounterRow]) -> str:
    if len(rows) == 1:
        return "one"
    return "sum"


def _unmatched_extras(
    rows: list[EngineCounterRow],
    matched: set[str],
    prefix: str,
) -> list[MappedCounter]:
    extras: list[MappedCounter] = []
    used: set[str] = set()
    for row in _sort_rows(rows):
        if row.suffix in matched:
            continue
        if not isinstance(row.value, int) or isinstance(row.value, bool) or row.value < 0:
            continue
        name = row.name or row.descr
        if not name:
            type_note = f", type {row.type_code}" if row.type_code is not None else ""
            name = f"index {row.suffix}{type_note}"
        base = f"{prefix}_{row.suffix.replace('.', '_')}_{sanitize_key_part(name)}"
        key = base[:70]
        n = 2
        while key in used:
            key = f"{base[:60]}_{n}"
            n += 1
        used.add(key)
        extras.append(
            MappedCounter(
                key=key,
                value=row.value,
                label=name,
                overwrite=False,
            )
        )
    return extras


def _usable(row: EngineCounterRow) -> bool:
    if isinstance(row.value, bool) or not isinstance(row.value, int):
        return False
    if row.value < 0:
        return False
    return not _excluded_name(row.name)


def _excluded_name(name: str) -> bool:
    if not name.strip():
        return False
    n = _norm(name)
    return any(part in n for part in _EXCLUDE_NAME_PARTS)


def _norm(text: str) -> str:
    s = text.strip().lower().replace("ё", "е")
    s = s.replace("&", " and ")
    s = re.sub(r"\s*:\s*", ":", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def _is_fifth_name(name: str) -> bool:
    n = _norm(name)
    if not n:
        return False
    if any(part in n for part in ("black", "ч/б", "черн", "монохром")):
        return False
    if any(phrase in n for phrase in _FIFTH_PHRASES):
        return True
    if "специальн" in n and any(part in n for part in ("цвет", "color", "станц")):
        return True
    if re.search(r"(?<![0-9a-z])(5th|fifth)(?![a-z])", n):
        return True
    if re.search(r"(?<![a-z0-9])(white|clear|neon|spot)(?![a-z0-9])", n):
        return True
    if re.search(r"(?<![а-яе])(белый|прозрачн\w*|неон\w*)(?![а-яе])", n):
        return True
    return False


def _fifth_score(name: str) -> int:
    n = _norm(name)
    score = 0
    if any(
        part in n
        for part in (
            "special",
            "5th",
            "fifth",
            "спец",
            "5-й",
            "5й",
            "пятый",
            "пятая",
            "特色",
            "スペシャル",
            "5色",
        )
    ):
        score += 10
    if any(part in n for part in ("total", "всего", "合計")):
        score += 5
    if _looks_like_part_name(name):
        score -= 3
    return score


def _looks_like_total_name(name: str) -> bool:
    n = _norm(name)
    return any(part in n for part in ("total", "всего", "合計", "machine total"))


def _looks_like_part_name(name: str) -> bool:
    n = _norm(name)
    return n.startswith(("counter:", "copier:", "printer:", "fax:")) or any(
        part in n for part in ("copy:", ":copy", ":print", "printer:", "copier:")
    )


def _total_name_family(name: str) -> str | None:
    n = _norm(name)
    if "machine total" in n or n in {"total", "counter:machine total", "counter:total"}:
        return "total"
    return None


def _black_name_family(name: str) -> str | None:
    n = _norm(name)
    if "black" not in n and "ч/б" not in n and "черн" not in n:
        return None
    if "full color" in n or "full colour" in n:
        return None
    if "total prints" in n or n.startswith("total:"):
        return "total"
    if n.startswith("counter:"):
        return "counter_parts"
    if n.startswith(("copier:", "printer:", "fax:")):
        return "app_parts"
    return None


def _full_color_name_family(name: str) -> str | None:
    n = _norm(name)
    if not any(part in n for part in ("full color", "full colour", "полный цвет", "полноцвет")):
        return None
    if "total" in n:
        return "total"
    if n.startswith("counter:"):
        return "counter_parts"
    if n.startswith(("copier:", "printer:")):
        return "app_parts"
    return None


def _mono_name_family(name: str) -> str | None:
    n = _norm(name)
    if "monocolor" not in n and "mono color" not in n and "mono colour" not in n:
        return None
    if "total" in n:
        return "total"
    return None


def _sort_rows(rows: list[EngineCounterRow]) -> list[EngineCounterRow]:
    return sorted(rows, key=lambda r: _suffix_key(r.suffix))


def _suffix_key(suffix: str) -> tuple[int, ...]:
    parts: list[int] = []
    for piece in suffix.split("."):
        try:
            parts.append(int(piece))
        except ValueError:
            parts.append(9999)
    return tuple(parts)


def _suffix_part(suffix: str, index: int) -> int | None:
    parts = suffix.split(".")
    if index >= len(parts):
        return None
    return parse_counter_int(parts[index])
