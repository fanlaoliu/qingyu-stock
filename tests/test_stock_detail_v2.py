"""Static regression checks for the stock research card V2."""
from pathlib import Path
import unittest

HTML = (Path(__file__).resolve().parents[1] / "index.html").read_text(encoding="utf-8")


class StockDetailV2Tests(unittest.TestCase):
    def test_quality_panel_and_rendering(self):
        self.assertIn('id="detailQuality"', HTML)
        self.assertIn("function showDetailQuality(stock)", HTML)
        self.assertIn("showDetailQuality(stock);", HTML)

    def test_peer_comparison_is_market_scoped(self):
        self.assertIn("x.market===stock.market", HTML)
        self.assertIn("peers.length<10", HTML)

    def test_industry_comparison_requires_sufficient_peers(self):
        self.assertIn("x.industry===stock.industry", HTML)
        self.assertIn("sameIndustry.length>=10", HTML)
        self.assertIn("industryPeers?sameIndustry:stocks.filter", HTML)
        self.assertIn("industryPeers?'同產業':'同市場'", HTML)

    def test_industry_is_preserved_when_loading_json(self):
        self.assertIn("industry:typeof x.industry==='string'?x.industry.trim():null", HTML)

    def test_peer_median_and_gap_are_shown(self):
        self.assertIn("sort((a,b)=>a-b)", HTML)
        self.assertIn("中位數 ", HTML)
        self.assertIn("median!==0", HTML)
        self.assertIn("差距 ", HTML)

    def test_missing_metrics_are_not_ranked(self):
        self.assertIn("num(stock[key])===null", HTML)
        self.assertIn("缺少有效資料", HTML)

    def test_uses_safe_dom_and_period_caution(self):
        start = HTML.index("function showDetailQuality(stock)")
        end = HTML.index("let selectedStockCode=null;", start)
        block = HTML[start:end]
        self.assertIn("replaceChildren()", block)
        self.assertIn("textContent", block)
        self.assertNotIn("innerHTML", block)
        self.assertIn("營收年增可能對應不同月份", block)


if __name__ == "__main__":
    unittest.main()
