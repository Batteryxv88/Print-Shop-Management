import unittest

from app.snmp.client import load_profiles, suggest_profile


class TestProfiles(unittest.TestCase):
    def test_load_all_profiles(self) -> None:
        profiles = load_profiles()
        self.assertIn("konica_minolta", profiles)
        self.assertIn("ricoh", profiles)
        self.assertGreater(len(profiles["ricoh"].metrics), 3)
        self.assertFalse(profiles["ricoh"].collect_printer_mib_supplies)
        self.assertFalse(profiles["konica_minolta"].collect_printer_mib_supplies)
        ricoh_total = next(m for m in profiles["ricoh"].metrics if m.key == "total")
        km_total = next(m for m in profiles["konica_minolta"].metrics if m.key == "total")
        self.assertEqual(ricoh_total.oid, "1.3.6.1.4.1.367.3.2.1.2.19.1.0")
        self.assertEqual(km_total.oid, "1.3.6.1.4.1.18334.1.1.1.5.7.2.1.1.0")
        self.assertEqual(profiles["ricoh"].counter_walks[0].mapper, "ricoh_engine")
        self.assertEqual(
            profiles["konica_minolta"].counter_walks[0].mapper,
            "konica_print_function",
        )
        self.assertTrue(profiles["ricoh"].metrics[-1].optional)

    def test_suggest_konica(self) -> None:
        profiles = load_profiles()
        pid = suggest_profile("1.3.6.1.4.1.18334.1.2.3", profiles)
        self.assertEqual(pid, "konica_minolta")
        self.assertEqual(
            suggest_profile("1.3.6.1.4.1.2590.1.1.1", profiles),
            "konica_minolta",
        )
        self.assertEqual(suggest_profile("1.3.6.1.4.1.367.3.2.1", profiles), "ricoh")


if __name__ == "__main__":
    unittest.main()
