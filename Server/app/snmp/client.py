from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

import yaml
from pysnmp.hlapi.asyncio import (
    CommunityData,
    ContextData,
    ObjectIdentity,
    ObjectType,
    SnmpEngine,
    UdpTransportTarget,
    getCmd,
    nextCmd,
)
from pysnmp.proto.rfc1905 import endOfMibView

from app.models import SnmpTestResult
from app.paths import resource_path
from app.snmp.counter_map import (
    EngineCounterRow,
    clean_snmp_text,
    fill_konica_billing_fallback,
    map_konica_print_counters,
    map_ricoh_engine_counters,
    merge_mapped_counters,
    parse_counter_int,
)
from app.snmp.metrics_utils import (
    CATEGORY_COMPONENT,
    CATEGORY_COUNTER,
    CATEGORY_INFO,
    CATEGORY_SUPPLY,
    sanitize_key_part,
    supply_description_matches,
)

PROFILES_DIR = resource_path("app", "snmp", "profiles")
SYS_OBJECT_ID = "1.3.6.1.2.1.1.2.0"
SYS_NAME_OID = "1.3.6.1.2.1.1.5.0"

# Printer-MIB prtMarkerSuppliesTable columns
SUPPLY_DESCR_OID = "1.3.6.1.2.1.43.11.1.1.6"
SUPPLY_MAX_OID = "1.3.6.1.2.1.43.11.1.1.8"
SUPPLY_LEVEL_OID = "1.3.6.1.2.1.43.11.1.1.9"
MAX_SUPPLY_WALK_ROWS = 48


@dataclass
class MetricDef:
    key: str
    oid: str
    label: str
    category: str = CATEGORY_COUNTER
    optional: bool = False


@dataclass
class WalkColumns:
    value_oid: str
    name_oid: str | None = None
    descr_oid: str | None = None
    type_oid: str | None = None
    color_type_oid: str | None = None
    function_type_oid: str | None = None


@dataclass
class CounterWalkDef:
    id: str
    mapper: str
    columns: list[WalkColumns]
    max_rows: int = 200
    preserve_keys: list[str] = field(default_factory=lambda: ["total"])


COUNTER_MAPPERS = {
    "ricoh_engine": map_ricoh_engine_counters,
    "konica_print_function": map_konica_print_counters,
}


DEFAULT_EXCLUDE_KEYWORDS = [
    "toner",
    "ink",
    "staple",
    "waste",
    "bottle",
    "cartridge",
    "powder",
    "maintenance kit",
]

DEFAULT_INCLUDE_KEYWORDS: list[str] = []


def _opt_oid(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _parse_counter_walks(raw: Any) -> list[CounterWalkDef]:
    walks: list[CounterWalkDef] = []
    for item in raw or []:
        columns: list[WalkColumns] = []
        for col in item.get("columns") or []:
            value_oid = _opt_oid(col.get("value_oid"))
            if not value_oid:
                continue
            columns.append(
                WalkColumns(
                    value_oid=value_oid,
                    name_oid=_opt_oid(col.get("name_oid")),
                    descr_oid=_opt_oid(col.get("descr_oid")),
                    type_oid=_opt_oid(col.get("type_oid")),
                    color_type_oid=_opt_oid(col.get("color_type_oid")),
                    function_type_oid=_opt_oid(col.get("function_type_oid")),
                )
            )
        mapper = str(item.get("mapper") or "").strip()
        if not mapper or not columns:
            continue
        preserve = item.get("preserve_keys", ["total"])
        walks.append(
            CounterWalkDef(
                id=str(item.get("id") or mapper),
                mapper=mapper,
                columns=columns,
                max_rows=int(item.get("max_rows") or 200),
                preserve_keys=[str(x) for x in preserve],
            )
        )
    return walks


@dataclass
class OidProfile:
    id: str
    display_name: str
    enterprise_ids: list[str]
    metrics: list[MetricDef]
    counter_walks: list[CounterWalkDef] = field(default_factory=list)
    collect_printer_mib_supplies: bool = True
    component_include_keywords: list[str] = field(default_factory=lambda: list(DEFAULT_INCLUDE_KEYWORDS))
    component_exclude_keywords: list[str] = field(default_factory=lambda: list(DEFAULT_EXCLUDE_KEYWORDS))


def load_profiles() -> dict[str, OidProfile]:
    profiles: dict[str, OidProfile] = {}
    for path in sorted(PROFILES_DIR.glob("*.yaml")):
        with open(path, encoding="utf-8") as f:
            raw = yaml.safe_load(f) or {}
        metrics = [
            MetricDef(
                key=m["key"],
                oid=m["oid"],
                label=m.get("label", m["key"]),
                category=m.get("category", CATEGORY_COUNTER),
                optional=bool(m.get("optional", False)),
            )
            for m in raw.get("metrics", [])
        ]
        filt = raw.get("component_filter") or {}
        profile = OidProfile(
            id=raw["id"],
            display_name=raw.get("display_name", raw["id"]),
            enterprise_ids=[str(x) for x in raw.get("enterprise_ids", [])],
            metrics=metrics,
            counter_walks=_parse_counter_walks(raw.get("counter_walks")),
            collect_printer_mib_supplies=bool(raw.get("collect_printer_mib_supplies", True)),
            component_include_keywords=[
                str(x) for x in filt.get("include_keywords", DEFAULT_INCLUDE_KEYWORDS)
            ],
            component_exclude_keywords=[
                str(x) for x in filt.get("exclude_keywords", DEFAULT_EXCLUDE_KEYWORDS)
            ],
        )
        profiles[profile.id] = profile
    return profiles


def suggest_profile(sys_object_id: str | None, profiles: dict[str, OidProfile]) -> str | None:
    if not sys_object_id:
        return None
    for pid, profile in profiles.items():
        for ent in profile.enterprise_ids:
            if ent in sys_object_id:
                return pid
    return None


def _unpack_var_bind_row(var_binds_table: Any) -> tuple[Any, Any] | None:
    """Разбор ответа nextCmd/getCmd (pysnmp 6.x возвращает вложенные list/tuple)."""
    if not var_binds_table:
        return None
    row = var_binds_table[0]
    if isinstance(row, tuple) and len(row) >= 2:
        return row[0], row[1]
    if isinstance(row, list) and row:
        first = row[0]
        if isinstance(first, tuple) and len(first) >= 2:
            return first[0], first[1]
    return None


def _oid_to_str(oid_obj: Any) -> str:
    if hasattr(oid_obj, "prettyPrint"):
        text = oid_obj.prettyPrint()
        if text.startswith("1.3.6"):
            return text
    text = str(oid_obj)
    if "1.3.6.1" in text:
        idx = text.find("1.3.6.1")
        return text[idx:].split()[0]
    return text


class SnmpClient:
    def __init__(self, timeout_sec: float = 5.0, retries: int = 2) -> None:
        self.timeout_sec = timeout_sec
        self.retries = retries
        self.profiles = load_profiles()

    def get_profile(self, profile_id: str) -> OidProfile:
        if profile_id not in self.profiles:
            raise KeyError(f"Unknown profile: {profile_id}")
        return self.profiles[profile_id]

    def list_profiles(self) -> list[tuple[str, str]]:
        return [(p.id, p.display_name) for p in self.profiles.values()]

    def _transport(self, host: str) -> UdpTransportTarget:
        return UdpTransportTarget(
            (host, 161),
            timeout=max(1, int(round(self.timeout_sec))),
            retries=self.retries,
        )

    async def _get_one_async(
        self,
        host: str,
        community: str,
        oid: str,
        engine: SnmpEngine | None = None,
        transport: UdpTransportTarget | None = None,
    ) -> tuple[Any | None, str | None]:
        snmp_engine = engine or SnmpEngine()
        udp = transport or self._transport(host)
        try:
            error_indication, error_status, _error_index, var_binds = await getCmd(
                snmp_engine,
                CommunityData(community, mpModel=1),
                udp,
                ContextData(),
                ObjectType(ObjectIdentity(oid)),
                lookupMib=False,
            )
        except Exception as exc:
            return None, str(exc)
        if error_indication:
            return None, str(error_indication)
        if error_status:
            return None, str(error_status)
        pair = _unpack_var_bind_row(var_binds)
        if pair:
            return self._normalize_value(pair[1]), None
        for _name, val in var_binds:
            return self._normalize_value(val), None
        return None, "Empty response"

    def _get_one(
        self,
        host: str,
        community: str,
        oid: str,
    ) -> tuple[Any | None, str | None]:
        return asyncio.run(self._get_one_async(host, community, oid))

    async def _walk_column_async(
        self,
        host: str,
        community: str,
        column_oid: str,
        max_rows: int = MAX_SUPPLY_WALK_ROWS,
    ) -> tuple[dict[str, Any], str | None]:
        """Walk one table column; returns {row_suffix: value}."""
        column_oid = column_oid.rstrip(".")
        engine = SnmpEngine()
        transport = self._transport(host)
        auth = CommunityData(community, mpModel=1)
        current = ObjectType(ObjectIdentity(column_oid))
        rows: dict[str, Any] = {}

        for _ in range(max_rows):
            try:
                error_indication, error_status, _, var_binds_table = await nextCmd(
                    engine,
                    auth,
                    transport,
                    ContextData(),
                    current,
                    lookupMib=False,
                )
            except Exception as exc:
                return rows, str(exc)
            if error_indication:
                return rows, str(error_indication)
            if error_status:
                return rows, str(error_status)
            if not var_binds_table:
                break
            pair = _unpack_var_bind_row(var_binds_table)
            if not pair:
                break
            oid_obj, val = pair
            if val is endOfMibView or "endOfMibView" in str(val):
                break
            oid_str = _oid_to_str(oid_obj)
            if oid_str == column_oid:
                break
            if not oid_str.startswith(column_oid + "."):
                break
            suffix = oid_str[len(column_oid) + 1 :]
            rows[suffix] = self._normalize_value(val)
            current = ObjectType(ObjectIdentity(oid_str))

        return rows, None

    def _walk_column(
        self,
        host: str,
        community: str,
        column_oid: str,
        max_rows: int = MAX_SUPPLY_WALK_ROWS,
    ) -> tuple[dict[str, Any], str | None]:
        return asyncio.run(
            self._walk_column_async(host, community, column_oid, max_rows=max_rows)
        )

    def _read_counter_rows(
        self,
        host: str,
        community: str,
        columns: WalkColumns,
        max_rows: int,
    ) -> tuple[list[EngineCounterRow], str | None]:
        values, err = self._walk_column(host, community, columns.value_oid, max_rows=max_rows)
        if not values:
            return [], err

        def _optional_column(oid: str | None) -> dict[str, Any]:
            if not oid:
                return {}
            walked, _walk_err = self._walk_column(host, community, oid, max_rows=max_rows)
            return walked

        names = _optional_column(columns.name_oid)
        descrs = _optional_column(columns.descr_oid)
        types = _optional_column(columns.type_oid)
        color_types = _optional_column(columns.color_type_oid)
        functions = _optional_column(columns.function_type_oid)
        rows: list[EngineCounterRow] = []
        for suffix, value in values.items():
            rows.append(
                EngineCounterRow(
                    suffix=str(suffix),
                    value=value,
                    name=str(names.get(suffix, "") or ""),
                    descr=str(descrs.get(suffix, "") or ""),
                    type_code=parse_counter_int(types.get(suffix)),
                    color_type=parse_counter_int(color_types.get(suffix)),
                    function_type=parse_counter_int(functions.get(suffix)),
                )
            )
        return rows, None

    def _collect_counter_walk(
        self,
        host: str,
        community: str,
        walk: CounterWalkDef,
    ) -> tuple[list[Any], list[EngineCounterRow], str | None]:
        mapper = COUNTER_MAPPERS.get(walk.mapper)
        if mapper is None:
            return [], [], f"Неизвестный разбор таблицы: {walk.mapper}"
        last_err: str | None = None
        for columns in walk.columns:
            rows, err = self._read_counter_rows(host, community, columns, walk.max_rows)
            if rows:
                return mapper(rows), rows, None
            if err:
                last_err = err
        return [], [], last_err

    @staticmethod
    def _snapshot_counter_rows(rows: list[EngineCounterRow]) -> list[dict[str, Any]]:
        """Строки таблицы для формулы биллинга. В экран сами по себе не выводятся."""
        snapshot: list[dict[str, Any]] = []
        for row in rows:
            value = parse_counter_int(row.value)
            if value is None or value < 0:
                continue
            name = clean_snmp_text(row.name) or clean_snmp_text(row.descr)
            snapshot.append(
                {
                    "suffix": str(row.suffix),
                    "type": row.type_code,
                    "name": name,
                    "value": value,
                }
            )
        return snapshot

    @staticmethod
    def _normalize_value(val: Any) -> Any:
        try:
            s = str(val)
            if s.isdigit() or (s.startswith("-") and s[1:].isdigit()):
                return int(s)
            return s
        except Exception:
            return str(val)

    @staticmethod
    def _supply_percent(level: Any, max_cap: Any) -> int | None:
        if not isinstance(level, int) or not isinstance(max_cap, int):
            return None
        if max_cap <= 0 or level < 0:
            return None
        # Printer-MIB: special values
        if level in (-1, -2, -3) or max_cap in (-1, -2):
            return None
        return min(100, round(level * 100 / max_cap))

    def _collect_printer_mib_supplies(
        self,
        host: str,
        community: str,
        profile: OidProfile,
    ) -> tuple[dict[str, Any], dict[str, str]]:
        metrics: dict[str, Any] = {}
        errors: dict[str, str] = {}

        descr, err = self._walk_column(host, community, SUPPLY_DESCR_OID)
        if err and not descr:
            errors["supply_table"] = err
            return metrics, errors
        levels, err_l = self._walk_column(host, community, SUPPLY_LEVEL_OID)
        if err_l and not levels:
            errors["supply_level"] = err_l
        maxes, err_m = self._walk_column(host, community, SUPPLY_MAX_OID)
        if err_m and not maxes:
            errors["supply_max"] = err_m

        for suffix, name in descr.items():
            name_str = str(name)
            if not supply_description_matches(
                name_str,
                profile.component_include_keywords,
                profile.component_exclude_keywords,
            ):
                continue
            level = levels.get(suffix)
            max_cap = maxes.get(suffix)
            slug = sanitize_key_part(name_str) or suffix.replace(".", "_")
            base = f"component_{slug}_{suffix.replace('.', '_')}"
            category = CATEGORY_COMPONENT
            metrics[f"{base}_name"] = name_str
            metrics[f"_label_{base}_name"] = f"Узел: {name_str}"
            metrics[f"_category_{base}_name"] = category
            if level is not None:
                metrics[f"{base}_level"] = level
                metrics[f"_label_{base}_level"] = f"{name_str} — уровень/ресурс"
                metrics[f"_category_{base}_level"] = category
            if max_cap is not None:
                metrics[f"{base}_max"] = max_cap
                metrics[f"_label_{base}_max"] = f"{name_str} — макс."
                metrics[f"_category_{base}_max"] = category
            pct = self._supply_percent(level, max_cap)
            if pct is not None:
                metrics[f"{base}_percent"] = pct
                metrics[f"_label_{base}_percent"] = f"{name_str} — %"
                metrics[f"_category_{base}_percent"] = category

        return metrics, errors

    def _store_scalar_metric(
        self,
        metrics: dict[str, Any],
        m: MetricDef,
        value: Any,
    ) -> None:
        metrics[m.key] = value
        metrics[f"_label_{m.key}"] = m.label
        metrics[f"_category_{m.key}"] = m.category

    def collect_metrics(
        self,
        host: str,
        community: str,
        profile_id: str,
    ) -> tuple[dict[str, Any], dict[str, str]]:
        profile = self.get_profile(profile_id)
        metrics: dict[str, Any] = {}
        errors: dict[str, str] = {}
        for m in profile.metrics:
            value, err = self._get_one(host, community, m.oid)
            if err:
                if not m.optional:
                    errors[m.key] = err
            elif value is not None:
                self._store_scalar_metric(metrics, m, value)

        counter_rows: list[dict[str, Any]] = []
        for walk in profile.counter_walks:
            try:
                mapped, rows, err = self._collect_counter_walk(host, community, walk)
                if err and not mapped:
                    errors[walk.id] = err
                merge_mapped_counters(metrics, mapped, walk.preserve_keys)
                counter_rows.extend(self._snapshot_counter_rows(rows))
            except Exception as exc:
                errors[walk.id] = str(exc)
        if counter_rows:
            metrics["_counter_rows"] = counter_rows
        fill_konica_billing_fallback(metrics)

        if profile.collect_printer_mib_supplies:
            try:
                sup_metrics, sup_errors = self._collect_printer_mib_supplies(host, community, profile)
                metrics.update(sup_metrics)
                errors.update(sup_errors)
            except Exception as exc:
                errors["supply_table"] = str(exc)

        return metrics, errors

    def test_connection(
        self,
        host: str,
        community: str,
        profile_id: str,
    ) -> SnmpTestResult:
        sys_name, err_name = self._get_one(host, community, SYS_NAME_OID)
        if err_name:
            return SnmpTestResult(
                success=False,
                message=f"SNMP недоступен: {err_name}",
            )
        sys_oid, _ = self._get_one(host, community, SYS_OBJECT_ID)
        sys_oid_str = str(sys_oid) if sys_oid is not None else None
        suggested = suggest_profile(sys_oid_str, self.profiles)
        metrics, errors = self.collect_metrics(host, community, profile_id)
        profile_len = len(self.get_profile(profile_id).metrics)
        ok = bool(sys_name) and (len(errors) < profile_len + 2)
        return SnmpTestResult(
            success=ok,
            sys_name=str(sys_name) if sys_name is not None else None,
            sys_object_id=sys_oid_str,
            suggested_profile=suggested,
            metrics=metrics,
            errors=errors,
            message="OK" if not errors else f"Частично: ошибок {len(errors)}",
        )
