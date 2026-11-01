"""Regression tests for official snapshot coverage and freshness audit."""
import datetime as dt
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("audit_coverage", ROOT / "scripts" / "audit_coverage.py")
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


def snapshot(rows=None, **meta):
    return {"meta": {"mode": "official", "trade_date": "2026-10-30", **meta},
            "stocks": rows if rows is not None else [
                {"code": "2330", "market": "上市", "price": 100.0, "pe": None, "pb": 2.0, "yield": 0.0, "yoy": 10.0},
                {"code": "6488", "market": "上櫃", "price": 50.0, "pe": 12.0, "pb": None, "yield": None, "yoy": None}]}


class AuditCoverageTests(unittest.TestCase):
    def test_market_specific_coverage_and_missing_values(self):
        result = audit.analyze(snapshot(), today=dt.date(2026, 11, 1))
        self.assertFalse(result["stale"])
        self.assertEqual(result["markets"]["上市"]["coverage_percent"]["pe"], 0)
        self.assertEqual(result["markets"]["上市"]["coverage_percent"]["yield"], 100)
        self.assertEqual(result["markets"]["上櫃"]["coverage_percent"]["pb"], 0)

    def test_stale_and_future_dates_are_flagged(self):
        self.assertTrue(audit.analyze(snapshot(), today=dt.date(2026, 11, 20))["stale"])
        self.assertTrue(audit.analyze(snapshot(), today=dt.date(2026, 10, 29))["stale"])

    def test_demo_data_is_rejected(self):
        with self.assertRaises(ValueError):
            audit.analyze(snapshot(mode="demo"), today=dt.date(2026, 11, 1))

    def test_invalid_snapshot_is_rejected(self):
        with self.assertRaises(ValueError):
            audit.analyze({"meta": {"mode": "official"}}, today=dt.date(2026, 11, 1))

    def test_source_errors_are_preserved(self):
        result = audit.analyze(snapshot(errors={"TPEx": "unavailable"}), today=dt.date(2026, 11, 1))
        self.assertEqual(result["source_errors"]["TPEx"], "unavailable")


if __name__ == "__main__":
    unittest.main()
