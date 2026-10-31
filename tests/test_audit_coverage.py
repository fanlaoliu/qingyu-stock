import datetime as dt
import importlib.util
from pathlib import Path
import unittest

path = Path(__file__).resolve().parents[1] / "scripts" / "audit_coverage.py"
spec = importlib.util.spec_from_file_location("audit_coverage", path)
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class CoverageAuditTests(unittest.TestCase):
    def test_market_coverage_and_age(self):
        payload = {"meta": {"mode": "official", "trade_date": "2026-10-30",
                            "errors": {}}, "stocks": [
            {"market": "上市", "price": 10, "pe": 15, "pb": None, "yield": 2, "yoy": None},
            {"market": "上市", "price": 20, "pe": None, "pb": 1.5, "yield": None, "yoy": 5},
            {"market": "上櫃", "price": 30, "pe": 20, "pb": 3, "yield": None, "yoy": None},
        ]}
        result = audit.analyze(payload, today=dt.date(2026, 10, 31))
        self.assertEqual(result["age_days"], 1)
        self.assertFalse(result["stale"])
        self.assertEqual(result["markets"]["上市"]["coverage_percent"]["pe"], 50)
        self.assertEqual(result["markets"]["上櫃"]["coverage_percent"]["pb"], 100)

    def test_stale_snapshot(self):
        payload = {"meta": {"mode": "official", "trade_date": "2026-10-01"},
                   "stocks": []}
        self.assertTrue(audit.analyze(payload, today=dt.date(2026, 10, 31))["stale"])

    def test_demo_rejected(self):
        with self.assertRaises(ValueError):
            audit.analyze({"meta": {"mode": "demo"}, "stocks": []})

    def test_empty_market_does_not_divide_by_zero(self):
        result = audit.analyze({"meta": {"mode": "official", "trade_date": "2026-10-30"},
                                "stocks": []}, today=dt.date(2026, 10, 31))
        self.assertEqual(result["markets"]["上櫃"]["coverage_percent"]["pe"], 0)


if __name__ == "__main__":
    unittest.main()
