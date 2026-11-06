"""Логика периода снятия счётчиков — зеркало SL snmp-agent/src/period.js."""

from __future__ import annotations

from datetime import date, datetime


def _days_in_month(year: int, month: int) -> int:
    if month == 12:
        nxt = date(year + 1, 1, 1)
    else:
        nxt = date(year, month + 1, 1)
    first = date(year, month, 1)
    return (nxt - first).days


def to_period_key(year: int, month: int) -> str:
    return f"{year}-{month:02d}"


def get_due_date(year: int, month: int, day_of_month: int) -> datetime:
    day = min(max(1, day_of_month), _days_in_month(year, month))
    return datetime(year, month, day, 0, 0, 0, 0)


def get_active_period_key(day_of_month: int, now: datetime | None = None) -> str | None:
    """Какой период YYYY-MM сейчас должен быть снят, либо None если ещё рано."""
    if not day_of_month or day_of_month < 1 or day_of_month > 31:
        return None

    now = now or datetime.now()
    y, m = now.year, now.month
    due_this = get_due_date(y, m, day_of_month)
    if now >= due_this:
        return to_period_key(y, m)

    if m == 1:
        py, pm = y - 1, 12
    else:
        py, pm = y, m - 1
    due_prev = get_due_date(py, pm, day_of_month)
    if now > due_prev:
        return to_period_key(py, pm)

    return None
