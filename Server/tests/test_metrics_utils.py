import unittest

from app.snmp.metrics_utils import (
    CATEGORY_COMPONENT,
    CATEGORY_SUPPLY,
    format_metrics_grouped,
    group_metric_keys,
    sanitize_key_part,
    supply_description_matches,
)


class TestMetricsUtils(unittest.TestCase):
    def test_sanitize(self) -> None:
        self.assertEqual(sanitize_key_part("Black Toner #1"), "black_toner_1")

    def test_component_filter(self) -> None:
        self.assertFalse(
            supply_description_matches("Black Toner", [], ["toner"])
        )
        self.assertTrue(
            supply_description_matches("Drum Unit", ["drum"], ["toner"])
        )
        self.assertTrue(
            supply_description_matches("Charge Roller", [], ["toner"])
        )

    def test_grouping(self) -> None:
        metrics = {
            "total": 100,
            "_label_total": "Total",
            "_category_total": "counter",
            "drum_life": 80,
            "_label_drum_life": "Drum",
            "_category_drum_life": "component",
        }
        g = group_metric_keys(metrics)
        self.assertIn("total", g["counter"])
        self.assertIn("drum_life", g[CATEGORY_COMPONENT])
        lines = format_metrics_grouped(metrics)
        self.assertTrue(any("Узлы" in line for line in lines))


if __name__ == "__main__":
    unittest.main()
