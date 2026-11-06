from __future__ import annotations

from datetime import datetime
from typing import Callable

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import RetryConfig, ScheduleConfig


def parse_hh_mm(value: str) -> tuple[int, int]:
    parts = value.strip().split(":")
    if len(parts) != 2:
        raise ValueError(f"Invalid time format: {value}")
    hour, minute = int(parts[0]), int(parts[1])
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        raise ValueError(f"Invalid time: {value}")
    return hour, minute


class CollectionScheduler:
    JOB_ID = "printer_collection"
    RETRY_JOB_ID = "printer_retry_hourly"

    def __init__(
        self,
        on_collect: Callable[[str], None],
        on_retry: Callable[[], None] | None = None,
    ) -> None:
        self._scheduler = BackgroundScheduler()
        self._on_collect = on_collect
        self._on_retry = on_retry
        self._schedule = ScheduleConfig()
        self._retry = RetryConfig()

    def start(self) -> None:
        if not self._scheduler.running:
            self._scheduler.start()

    def shutdown(self) -> None:
        if self._scheduler.running:
            self._scheduler.shutdown(wait=False)

    def apply_config(self, schedule: ScheduleConfig, retry: RetryConfig) -> None:
        self._schedule = schedule
        self._retry = retry

        if self._scheduler.get_job(self.JOB_ID):
            self._scheduler.remove_job(self.JOB_ID)
        if self._scheduler.get_job(self.RETRY_JOB_ID):
            self._scheduler.remove_job(self.RETRY_JOB_ID)

        if schedule.enabled:
            hour, minute = parse_hh_mm(schedule.time)
            if schedule.mode == "monthly":
                trigger = CronTrigger(day=1, hour=hour, minute=minute)
                period_type = "monthly"
            else:
                trigger = CronTrigger(hour=hour, minute=minute)
                period_type = "daily"
            self._scheduler.add_job(
                lambda: self._on_collect(period_type),
                trigger=trigger,
                id=self.JOB_ID,
                replace_existing=True,
            )

        if retry.enabled and self._on_retry:
            start_h, _ = parse_hh_mm(retry.day_start)
            end_h, _ = parse_hh_mm(retry.day_end)
            if end_h < start_h:
                end_h = start_h
            hour_range = f"{start_h}-{end_h}"
            self._scheduler.add_job(
                self._on_retry,
                trigger=CronTrigger(minute=0, hour=hour_range),
                id=self.RETRY_JOB_ID,
                replace_existing=True,
            )

    def next_run_time(self) -> datetime | None:
        job = self._scheduler.get_job(self.JOB_ID)
        if job and job.next_run_time:
            return job.next_run_time
        return None

    def next_retry_run_time(self) -> datetime | None:
        job = self._scheduler.get_job(self.RETRY_JOB_ID)
        if job and job.next_run_time:
            return job.next_run_time
        return None
