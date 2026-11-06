import unittest

from app.config import RetryConfig, ScheduleConfig
from app.scheduler.jobs import CollectionScheduler, parse_hh_mm


class TestSchedulerParse(unittest.TestCase):
    def test_parse_time(self) -> None:
        self.assertEqual(parse_hh_mm("08:00"), (8, 0))
        self.assertEqual(parse_hh_mm("23:59"), (23, 59))

    def test_invalid(self) -> None:
        with self.assertRaises(ValueError):
            parse_hh_mm("25:00")


class TestRetryJob(unittest.TestCase):
    def test_retry_job_registered(self) -> None:
        calls: list[str] = []

        def on_retry() -> None:
            calls.append("retry")

        sched = CollectionScheduler(on_collect=lambda _: None, on_retry=on_retry)
        sched.start()
        try:
            sched.apply_config(
                ScheduleConfig(enabled=False),
                RetryConfig(enabled=True, day_start="08:00", day_end="18:00"),
            )
            job = sched._scheduler.get_job(CollectionScheduler.RETRY_JOB_ID)
            self.assertIsNotNone(job)
        finally:
            sched.shutdown()


if __name__ == "__main__":
    unittest.main()
