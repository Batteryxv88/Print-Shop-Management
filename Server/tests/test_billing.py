import unittest

from app.snmp.billing import (
    C7210X_UNMAPPED,
    billing_for_sync,
    format_billing_lines,
    guess_counter_preset,
    interpret_billing,
    split_reading_metrics,
)


def _km(**values: int) -> dict:
    labels = {
        "total": "Всего:",
        "black": "Ч/Б:",
        "color": "Цвет:",
        "color_full": "Полный цвет:",
        "print_bw": "Ч/Б, только печать",
        "copy_part": "Ч/Б, копия",
        "duplex_total": "Дуплекс",
    }
    metrics: dict = {}
    for key, value in values.items():
        metrics[key] = value
        metrics[f"_label_{key}"] = labels[key]
    return metrics


class TestGuessPreset(unittest.TestCase):
    def test_names(self) -> None:
        self.assertEqual(guess_counter_preset("Konica C3070L", "10.0.0.1"), "km_c3070")
        self.assertEqual(guess_counter_preset("AccurioPress C6100", ""), "km_c6100")
        self.assertEqual(guess_counter_preset("Ricoh Pro 8210S", ""), "ricoh_8210")
        self.assertEqual(guess_counter_preset("Ricoh C7210X", "192.168.88.119"), "ricoh_c7210x")
        self.assertEqual(
            guess_counter_preset("KONICA MINOLTA AccurioLabel 230", "192.168.1.155"),
            "km_label230",
        )
        self.assertEqual(
            guess_counter_preset("AccurioPress C14000", "", "konica_minolta"),
            "km_generic",
        )
        self.assertEqual(guess_counter_preset("Office", "10.0.0.5", "generic"), "generic")

    def test_c3070_is_not_c6100(self) -> None:
        self.assertNotEqual(guess_counter_preset("C3070", ""), "km_c6100")


class TestInterpret(unittest.TestCase):
    def test_c3070_uses_exact_labels_not_c6100_parts(self) -> None:
        metrics = _km(
            total=100,
            black=50,
            color=40,
            color_full=7,
            print_bw=1,
            copy_part=2,
            duplex_total=9,
        )
        bill = interpret_billing("km_c3070", metrics)
        self.assertEqual(bill["total"], 100)
        self.assertEqual(bill["black"], 50)
        self.assertEqual(bill["color"], 40)
        self.assertIsNone(bill["fifth_color"])
        lines = format_billing_lines("km_c3070", metrics)
        self.assertEqual(lines, ["Всего: 100", "Цвет: 40", "Ч/Б: 50"])
        self.assertFalse(any("Дуплекс" in line for line in lines))

    def test_c6100_sums_print_and_copy_and_uses_full_color(self) -> None:
        metrics = _km(
            total=100,
            black=999,
            color=5,
            color_full=7,
            print_bw=10,
            copy_part=20,
        )
        bill = interpret_billing("km_c6100", metrics)
        self.assertEqual(bill["total"], 100)
        self.assertEqual(bill["black"], 30)
        self.assertEqual(bill["color"], 7)
        self.assertNotEqual(bill["black"], 999)
        self.assertNotEqual(bill["color"], 5)

    def test_label230_sums_copy_and_print(self) -> None:
        # Панель 192.168.1.155: Всего 3344, Цвет 2956, Ч/Б 388.
        metrics = {
            "total": 3344,
            "_label_total": "Всего",
            "black": 999,
            "_label_black": "Ч/Б",
            "color": 5,
            "_label_color": "Цвет",
            "km_bw_copy": 12,
            "_label_km_bw_copy": "Ч/Б, копия",
            "km_bw_print": 376,
            "_label_km_bw_print": "Ч/Б, печать",
            "km_full_copy": 90,
            "_label_km_full_copy": "Полный цвет, копия",
            "km_full_print": 2866,
            "_label_km_full_print": "Полный цвет, печать",
        }
        bill = interpret_billing("km_label230", metrics)
        self.assertEqual(bill["total"], 3344)
        self.assertEqual(bill["color"], 2956)
        self.assertEqual(bill["black"], 388)

    def test_generic_does_not_apply_c6100_math(self) -> None:
        metrics = _km(total=100, black=999, color=5, color_full=7, print_bw=10, copy_part=20)
        bill = interpret_billing("km_generic", metrics)
        self.assertEqual(bill["black"], 999)
        self.assertEqual(bill["color"], 5)

    def test_ricoh_8210_mono_total_is_black(self) -> None:
        metrics = {
            "total": 15869602,
            "_label_total": "Всего",
            "black": 15869602,
            "_label_black": "Ч/Б",
            "color": 1,
            "_label_color": "Цвет",
            "eng_1": 99,
            "_label_eng_1": "Counter: Machine Total",
        }
        bill = interpret_billing("ricoh_8210", metrics)
        self.assertEqual(bill["total"], 15869602)
        self.assertEqual(bill["black"], 15869602)
        self.assertIsNone(bill["color"])
        self.assertIsNone(bill["fifth_color"])
        lines = format_billing_lines("ricoh_8210", metrics)
        self.assertEqual(lines, ["Всего: 15869602", "Ч/Б: 15869602"])

    def test_c7210x_matches_panel_types_not_full_color(self) -> None:
        # Панель 2026-11-05: Цвет 3966887, Ч/Б 1150315, 5-й цвет 13849.
        metrics = {
            "total": 5117496,
            "_label_total": "Всего",
            "color": 3964314,
            "_label_color": "Цвет",
            "black": 1152888,
            "_label_black": "Ч/Б",
            "_counter_rows": [
                {"suffix": "1", "type": 10, "name": "Counter: Machine Total", "value": 5117496},
                {"suffix": "7", "type": 600, "name": "Total Prints: Full Color", "value": 3964314},
                {"suffix": "8", "type": 601, "name": "Total Prints: Monocolor", "value": 1152888},
                {"suffix": "11", "type": 606, "name": "Printer: Color", "value": 3966887},
                {"suffix": "13", "type": 608, "name": "Total Prints: Color", "value": 3966887},
                {"suffix": "14", "type": 609, "name": "Total Prints: Black & White", "value": 1150315},
                {"suffix": "26", "type": 666, "name": "Total Prints: Color", "value": 0},
                {"suffix": "41", "type": 2001, "name": "Counter: Fifth Station Total", "value": 13849},
                {"suffix": "47", "type": 2007, "name": "Development: Fifth Station", "value": 99999},
                {"suffix": "103", "type": 970, "name": "Total: Fifth Station Only", "value": 294},
            ],
        }
        bill = interpret_billing("ricoh_c7210x", metrics)
        self.assertEqual(bill["total"], 5117496)
        self.assertEqual(bill["color"], 3966887)
        self.assertEqual(bill["black"], 1150315)
        self.assertEqual(bill["fifth_color"], 13849)
        self.assertFalse(bill["unmapped"])
        stored, sync = split_reading_metrics("ricoh_c7210x", metrics)
        self.assertEqual(sync["total"], 5117496)
        self.assertEqual(sync["color"], 3966887)
        self.assertEqual(sync["black"], 1150315)
        self.assertEqual(sync["fifth_color"], 13849)
        self.assertNotIn("_raw", sync)
        self.assertNotIn("_counter_rows", sync)
        self.assertIn("_raw", stored)
        lines = format_billing_lines("ricoh_c7210x", stored)
        self.assertEqual(
            lines,
            ["Всего: 5117496", "Цвет: 3966887", "Ч/Б: 1150315", "5-й цвет: 13849"],
        )
        self.assertFalse(any("Full Color" in line or "Development" in line for line in lines))

    def test_c7210x_unmapped_does_not_dump_rows(self) -> None:
        metrics = {
            "total": 5117496,
            "_label_total": "Всего",
            "eng_1": 12,
            "_label_eng_1": "Counter: Fifth Station 2",
            "_counter_rows": [
                {"suffix": "44", "type": 2004, "name": "Counter: Fifth Station 2", "value": 9619},
            ],
        }
        bill = interpret_billing("ricoh_c7210x", metrics)
        self.assertTrue(bill["unmapped"])
        self.assertIsNone(bill["total"])
        self.assertIsNone(bill["color"])
        lines = format_billing_lines("ricoh_c7210x", metrics)
        self.assertEqual(lines, [C7210X_UNMAPPED])
        sync = billing_for_sync(split_reading_metrics("ricoh_c7210x", metrics)[1])
        self.assertEqual(sync, {"status": C7210X_UNMAPPED})


if __name__ == "__main__":
    unittest.main()
