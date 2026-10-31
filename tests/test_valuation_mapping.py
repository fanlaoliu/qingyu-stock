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

    def test_main_calls_valuation_merge_for_official_rows(self):
        # Guard against a source-edit regression where the call was swallowed
        # by a comment, silently leaving all valuation fields empty.
        source = SCRIPT.read_text(encoding="utf-8")
        start = source.index('    for source in ("twse_valuation", "tpex_valuation"):')
        end = source.index('    for row in results.get("twse_revenue"', start)
        block = source[start:end]
        self.assertIn('                merge_valuation(s, row)', block)
        self.assertNotIn('\\\\n                s.update', block)

    def test_valuation_coverage_accepts_sufficient_official_metrics(self):
        stocks = {
            str(i): {"market": "上市", "price": 10, "pe": 15 if i < 3 else None, "pb": None}
            for i in range(10)
        }
        stocks.update({
            "o" + str(i): {"market": "上櫃", "price": 20, "pe": None,
                           "pb": 2 if i < 2 else None}
            for i in range(10)
        })
        module.validate_valuation_coverage(stocks, {
            "twse_valuation": [{}], "tpex_valuation": [{}]
        })

    def test_valuation_coverage_rejects_empty_metrics(self):
        stocks = {
            "a": {"market": "上市", "price": 10, "pe": None, "pb": None},
            "b": {"market": "上櫃", "price": 20, "pe": 10, "pb": None},
        }
        with self.assertRaisesRegex(RuntimeError, "上市 valuation coverage"):
            module.validate_valuation_coverage(stocks, {
                "twse_valuation": [{}], "tpex_valuation": [{}]
            })

    def test_valuation_coverage_rejects_missing_feed(self):
        with self.assertRaisesRegex(RuntimeError, "feed missing"):
            module.validate_valuation_coverage({}, {"twse_valuation": []})

    def test_schema_diagnostics_reports_parsed_valuation_rows(self):
        rows = [
            {"Code": "2330", "PEratio": "21.5", "PBratio": "4.3"},
            {"Code": "2317", "PEratio": "—"},
            {"unexpected": "value"},
        ]
        report = module.valuation_source_diagnostics(rows)
        self.assertEqual(report["rows"], 3)
        self.assertEqual(report["rows_with_code"], 2)
        self.assertEqual(report["rows_with_valuation"], 1)
        self.assertIn("PEratio", report["columns"])
        self.assertIn("unexpected", report["columns"])

    def test_schema_diagnostics_handles_empty_feed(self):
        self.assertEqual(module.valuation_source_diagnostics([]), {
            "rows": 0, "rows_with_code": 0,
            "rows_with_valuation": 0, "columns": [],
        })

    def test_official_company_master_industry_codes(self):
        self.assertEqual(module.industry({"產業別": "24"}), "24")
        self.assertEqual(module.industry({"SecuritiesIndustryCode": "28"}), "28")
        self.assertIsNone(module.industry({}))

    def test_both_official_company_master_feeds_are_configured(self):
        self.assertTrue(module.URLS["twse_company"].endswith("/t187ap03_L"))
        self.assertTrue(module.URLS["tpex_company"].endswith("/mopsfin_t187ap03_O"))

    def test_company_master_join_is_market_scoped(self):
        source = SCRIPT.read_text(encoding="utf-8")
        self.assertIn('for source, market in (("twse_company", "上市"), ("tpex_company", "上櫃")):', source)
        self.assertIn('stocks[c]["market"] == market', source)
        self.assertIn('stocks[c]["industry"] = group', source)

    def test_industry_coverage_rejects_missing_company_feed(self):
        with self.assertRaisesRegex(RuntimeError, "company master feed missing"):
            module.validate_industry_coverage({}, {"twse_company": []})

    def test_industry_coverage_accepts_classified_equities(self):
        stocks = {}
        for market, prefix in (("上市", "1"), ("上櫃", "6")):
            for i in range(350):
                c = prefix + f"{i:03d}"
                stocks[c] = {"code": c, "market": market,
                             "industry": "半導體" if i < 280 else None}
        module.validate_industry_coverage(stocks, {
            "twse_company": [{"公司代號": "1101"}],
            "tpex_company": [{"公司代號": "6101"}],
        })

    def test_industry_coverage_rejects_unclassified_equities(self):
        stocks = {}
        for market, prefix in (("上市", "1"), ("上櫃", "6")):
            for i in range(350):
                c = prefix + f"{i:03d}"
                stocks[c] = {"code": c, "market": market, "industry": None}
        with self.assertRaisesRegex(RuntimeError, "industry coverage"):
            module.validate_industry_coverage(stocks, {
                "twse_company": [{}], "tpex_company": [{}],
            })

    def test_numeric_rejects_nonfinite_and_invalid(self):
        for value in ("--", "除零", "N/A", "NaN", "Infinity"):
            self.assertIsNone(module.numeric(value))


if __name__ == "__main__":
    unittest.main()
