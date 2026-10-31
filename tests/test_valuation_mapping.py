"""Regression checks for official valuation field normalization."""
import importlib.util
from pathlib import Path
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "update_data.py"
spec = importlib.util.spec_from_file_location("qingyu_update_data", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ValuationMappingTests(unittest.TestCase):
    def test_english_official_columns(self):
        self.assertEqual(module.valuation({
            "PEratio": "18.5", "PBratio": "2.31", "DividendYield": "3.45"
        }), {"pe": 18.5, "pb": 2.31, "yield_": 3.45})

    def test_chinese_columns_and_missing_values(self):
        self.assertEqual(module.valuation({
            "本益比(倍)": "12.6", "股價淨值比（倍）": "1.48",
            "殖利率(％)": "—"
        }), {"pe": 12.6, "pb": 1.48, "yield_": None})

    def test_missing_metrics_are_not_zero(self):
        self.assertEqual(module.valuation({}), {
            "pe": None, "pb": None, "yield_": None
        })

    def test_merge_preserves_existing_metrics_when_source_missing(self):
        stock = {"pe": 18.2, "pb": 1.4, "yield_": 3.1}
        module.merge_valuation(stock, {"PEratio": "—", "PBratio": "", "DividendYield": "N/A"})
        self.assertEqual(stock, {"pe": 18.2, "pb": 1.4, "yield_": 3.1})

    def test_merge_updates_only_present_metrics(self):
        stock = {"pe": 18.2, "pb": 1.4, "yield_": 3.1}
        module.merge_valuation(stock, {"PEratio": "15.6", "PBratio": "—"})
        self.assertEqual(stock, {"pe": 15.6, "pb": 1.4, "yield_": 3.1})

    def test_numeric_rejects_nonfinite_and_invalid(self):
        for value in ("--", "除零", "N/A", "NaN", "Infinity"):
            self.assertIsNone(module.numeric(value))


if __name__ == "__main__":
    unittest.main()
