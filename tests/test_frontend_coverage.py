"""Regression checks for the static research dashboard's data coverage UI."""
from html.parser import HTMLParser
from pathlib import Path
import unittest

HTML = (Path(__file__).resolve().parents[1] / "index.html").read_text(encoding="utf-8")


class IdParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []

    def handle_starttag(self, tag, attrs):
        self.ids.extend(v for k, v in attrs if k == "id")


class FrontendCoverageTests(unittest.TestCase):
    def test_coverage_panel_exists(self):
        parser = IdParser()
        parser.feed(HTML)
        self.assertIn("dataCoverage", parser.ids)
        self.assertIn("researchTools", parser.ids)

    def test_both_markets_and_all_metrics_are_present(self):
        self.assertIn("const markets=['上市','上櫃']", HTML)
        for metric in ("['pe','本益比 PE']", "['pb','股價淨值比 PB']",
                       "['yield','殖利率']", "['yoy','營收年增']"):
            self.assertIn(metric, HTML)

    def test_accessible_progress_and_zero_division_guard(self):
        self.assertIn("role','progressbar'", HTML)
        self.assertIn("aria-valuenow", HTML)
        self.assertIn("rows.length?Math.round", HTML)

    def test_coverage_uses_safe_dom_text(self):
        start = HTML.index("function updateCoverage(){")
        end = HTML.index("\nlet selectedStockCode=null;", start)
        fragment = HTML[start:end]
        self.assertIn("textContent", fragment)
        self.assertNotIn("innerHTML", fragment)


if __name__ == "__main__":
    unittest.main()
