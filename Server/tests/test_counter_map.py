import unittest

from app.snmp.counter_map import (
    EngineCounterRow,
    fill_konica_billing_fallback,
    map_konica_print_counters,
    map_ricoh_engine_counters,
    merge_mapped_counters,
)


def _by_key(mapped):
    return {item.key: item for item in mapped}


class TestRicohCounterMap(unittest.TestCase):
    def test_billing_names_ignore_printer_color_and_developer(self) -> None:
        mapped = map_ricoh_engine_counters(
            [
                EngineCounterRow("1", 1000, "Counter: Machine Total", type_code=10),
                EngineCounterRow("10", 1000, "Counter: Machine Total", type_code=10),
                EngineCounterRow("11", 400, "Total Prints: Full Color", type_code=600),
                EngineCounterRow("20", 500, "Total Prints: Black & White", type_code=609),
                EngineCounterRow("17", 999, "Printer: Color", type_code=606),
                EngineCounterRow("14", 50, "Development: Black & White", type_code=603),
                EngineCounterRow("21", 12, "Total Prints: Full Color A3", type_code=610),
                EngineCounterRow("8", 7, "Counter:Print:Single/Two-col.", type_code=402),
                EngineCounterRow("80", 3, "Special Color", type_code=950),
                EngineCounterRow("59", 1, "Coverage: Black & White", type_code=851),
            ]
        )
        got = _by_key(mapped)
        self.assertEqual(got["total"].value, 1000)
        self.assertEqual(got["black"].value, 500)
        self.assertEqual(got["color"].value, 400)
        self.assertEqual(got["color_full"].value, 400)
        self.assertEqual(got["fifth_color"].value, 3)
        self.assertEqual(got["special_color"].value, 3)
        self.assertEqual(got["single_two_color"].value, 7)
        self.assertNotEqual(got["color"].value, 999)
        self.assertNotEqual(got["black"].value, 50)
        labels = [item.label for item in mapped]
        self.assertTrue(any(label.startswith("5-й цвет") for label in labels))
        self.assertTrue(any("Printer: Color" == label for label in labels))
        self.assertTrue(any("Development: Black & White" == label for label in labels))
        # второй Machine Total того же type 10 не дублируется
        self.assertEqual(sum(1 for item in mapped if item.value == 1000 and item.key == "total"), 1)

    def test_parts_not_double_counted_with_8xx_family(self) -> None:
        mapped = _by_key(
            map_ricoh_engine_counters(
                [
                    EngineCounterRow("3", 2, "Counter:Copy:Full Color", type_code=203),
                    EngineCounterRow("9", 5, "Counter:Print:Full Color", type_code=403),
                    EngineCounterRow("52", 100, "Printer: Full Color", type_code=820),
                    EngineCounterRow("3b", 1, "Counter:Copy:Black & White", type_code=201),
                    EngineCounterRow("7", 4, "Counter:Print:Black & White", type_code=401),
                    EngineCounterRow("49", 80, "Copier: Black & White", type_code=811),
                ]
            )
        )
        self.assertEqual(mapped["color"].value, 7)
        self.assertEqual(mapped["black"].value, 5)

    def test_name_fallback_and_fifth_sum(self) -> None:
        mapped = _by_key(
            map_ricoh_engine_counters(
                [
                    EngineCounterRow("1", 20, "Counter:Copy:Special Color"),
                    EngineCounterRow("2", 5, "Counter:Print:Special Color"),
                    EngineCounterRow("3", 9, "Counter:Copy:Black & White"),
                    EngineCounterRow("4", 1, "Counter:Print:Black & White"),
                    EngineCounterRow("5", 4, "Counter:Copy:Full Color"),
                    EngineCounterRow("6", 6, "Counter:Print:Full Color"),
                ]
            )
        )
        self.assertEqual(mapped["fifth_color"].value, 25)
        self.assertEqual(mapped["black"].value, 10)
        self.assertEqual(mapped["color"].value, 10)

    def test_fifth_total_beats_parts_and_black_white_is_not_white(self) -> None:
        mapped = _by_key(
            map_ricoh_engine_counters(
                [
                    EngineCounterRow("1", 9, "Total: Special Color"),
                    EngineCounterRow("2", 5, "Counter:Print:Special Color"),
                    EngineCounterRow("3", 100, "Total Prints: Black & White"),
                    EngineCounterRow("4", 2, "White"),
                ]
            )
        )
        self.assertEqual(mapped["fifth_color"].value, 9)
        self.assertEqual(mapped["black"].value, 100)
        self.assertTrue(any(item.label == "White" for item in mapped.values()))

    def test_localized_fifth_and_mono_press(self) -> None:
        fifth = _by_key(
            map_ricoh_engine_counters(
                [EngineCounterRow("4", 8, "スペシャルカラー", type_code=970)]
            )
        )
        self.assertEqual(fifth["fifth_color"].value, 8)
        self.assertEqual(fifth["special_color"].label.startswith("Доп. станция"), True)

        mono = _by_key(
            map_ricoh_engine_counters(
                [
                    EngineCounterRow("1", 500, "Counter: Machine Total", type_code=10),
                    EngineCounterRow("2", 500, "Total Prints: Black & White", type_code=609),
                ]
            )
        )
        self.assertEqual(mono["black"].value, 500)
        self.assertNotIn("color", mono)
        self.assertNotIn("fifth_color", mono)

    def test_type_wins_when_name_is_japanese(self) -> None:
        mapped = _by_key(
            map_ricoh_engine_counters(
                [
                    EngineCounterRow("11", 15, "フルカラー合計", type_code=600),
                    EngineCounterRow("20", 40, "白黒合計", type_code=609),
                ]
            )
        )
        self.assertEqual(mapped["color"].value, 15)
        self.assertEqual(mapped["black"].value, 40)


class TestKonicaCounterMap(unittest.TestCase):
    def test_full_color_and_black_sum_functions_without_cmy(self) -> None:
        mapped = _by_key(
            map_konica_print_counters(
                [
                    EngineCounterRow("1.1", 10, color_type=1, function_type=1),
                    EngineCounterRow("1.2", 20, color_type=1, function_type=2),
                    EngineCounterRow("1.5", 1, color_type=1, function_type=5),
                    EngineCounterRow("2.1", 3, color_type=2, function_type=1),
                    EngineCounterRow("2.2", 7, color_type=2, function_type=2),
                    EngineCounterRow("4.2", 4, color_type=4, function_type=2),
                    EngineCounterRow("6.2", 4, color_type=6, function_type=2),
                ]
            )
        )
        self.assertEqual(mapped["black"].value, 31)
        self.assertEqual(mapped["color"].value, 10)
        self.assertEqual(mapped["color_full"].value, 10)
        self.assertEqual(mapped["single_color"].value, 4)
        self.assertEqual(mapped["mono_color"].value, 4)
        self.assertNotIn("fifth_color", mapped)
        self.assertEqual(mapped["black"].label, "Ч/Б")
        self.assertEqual(mapped["color"].label, "Цвет")

    def test_color_enum_wins_over_drifted_index(self) -> None:
        mapped = _by_key(
            map_konica_print_counters(
                [
                    EngineCounterRow("3.2", 11, color_type=2, function_type=2),
                    EngineCounterRow("9.1", 4, color_type=1, function_type=1),
                ]
            )
        )
        self.assertEqual(mapped["color"].value, 11)
        self.assertEqual(mapped["black"].value, 4)

    def test_suffix_fallback_and_single_unknown_station(self) -> None:
        mapped = _by_key(
            map_konica_print_counters(
                [
                    EngineCounterRow("1.1", 2),
                    EngineCounterRow("1.2", 5),
                    EngineCounterRow("2.2", 8),
                    EngineCounterRow("8.2", 6, color_type=8, function_type=2),
                ]
            )
        )
        self.assertEqual(mapped["black"].value, 7)
        self.assertEqual(mapped["color"].value, 8)
        self.assertEqual(mapped["fifth_color"].value, 6)
        self.assertEqual(mapped["special_color"].label, "Доп. станция")

    def test_two_unknown_colors_are_not_forced_into_fifth(self) -> None:
        mapped = _by_key(
            map_konica_print_counters(
                [
                    EngineCounterRow("8.1", 1, color_type=8, function_type=1),
                    EngineCounterRow("9.1", 2, color_type=9, function_type=1),
                ]
            )
        )
        self.assertNotIn("fifth_color", mapped)
        self.assertIn("km_color_8", mapped)
        self.assertIn("km_color_9", mapped)

    def test_fallback_sums_copy_and_print_only(self) -> None:
        metrics = {"copy_bw": 2, "print_bw": 3, "copy_full": 4, "print_full": 5}
        fill_konica_billing_fallback(metrics)
        self.assertEqual(metrics["black"], 5)
        self.assertEqual(metrics["color"], 9)
        self.assertEqual(metrics["color_full"], 9)
        metrics["black"] = 100
        metrics["color"] = 80
        fill_konica_billing_fallback(metrics)
        self.assertEqual(metrics["black"], 100)
        self.assertEqual(metrics["color"], 80)


class TestMerge(unittest.TestCase):
    def test_preserve_total_and_walk_overwrites_fifth(self) -> None:
        metrics = {
            "total": 10,
            "_label_total": "Всего",
            "fifth_color": 1,
            "_label_fifth_color": "старый индекс",
        }
        mapped = map_ricoh_engine_counters(
            [
                EngineCounterRow("1", 99, "Counter: Machine Total", type_code=10),
                EngineCounterRow("4", 6, "5th Station"),
            ]
        )
        merge_mapped_counters(metrics, mapped, {"total"})
        self.assertEqual(metrics["total"], 10)
        self.assertEqual(metrics["fifth_color"], 6)
        self.assertTrue(str(metrics["_label_fifth_color"]).startswith("5-й цвет"))


if __name__ == "__main__":
    unittest.main()
