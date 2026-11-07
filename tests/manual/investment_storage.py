"""Check investment storage isolation in Chromium against the real static site.

Requires Python Playwright and Chromium installed outside the website dependencies.
Run: python tests/manual/investment_storage.py --chromium /usr/bin/chromium
Omit --chromium to use Playwright's installed Chromium.
The script serves this checkout on an ephemeral loopback port and uses fresh,
temporary browser contexts. It does not contact an official data source.
"""

import argparse
import functools
import http.server
import json
from pathlib import Path
import threading
import unittest

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
KEY = "qingyu-investment-v1"
FKEY = "qingyu-financials-v1"
EMPTY = {"version": 1, "transactions": [], "alerts": []}
FINANCIAL = {"version": 1, "records": [{
    "code": "2330", "periodEnd": "2020-06-30", "publishedAt": "2020-08-14",
    "epsPeriodEnd": "2020-06-30", "epsBasis": "TTM", "unit": "TWD",
    "cashFlowUnit": "TWD", "source": "https://example.com/report",
    "eps": 10, "roe": 20, "operatingCashFlow": 120, "netIncome": 100,
    "debtRatio": 40,
}]}


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class StorageChecks(unittest.TestCase):
    def setUp(self):
        self.context = browser.new_context(viewport=viewport, service_workers="block")
        self.addCleanup(self.context.close)
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))
        self.page.goto(base_url + "/?view=portfolio")
        self.page.wait_for_function("parseInt(document.getElementById('universe').textContent.replaceAll(',', ''), 10) > 0")

    def seed(self, ledger, financial):
        self.page.evaluate("""([key, fkey, ledger, financial]) => {
            localStorage.clear();
            if (ledger !== null) localStorage.setItem(key, ledger);
            if (financial !== null) localStorage.setItem(fkey, financial);
        }""", [KEY, FKEY, ledger, financial])
        self.page.reload()
        self.page.wait_for_function("parseInt(document.getElementById('universe').textContent.replaceAll(',', ''), 10) > 0")

    def stored(self, key):
        return self.page.evaluate("key => localStorage.getItem(key)", key)

    def add_trade(self):
        self.page.locator("#tradeDate").fill("2020-11-06")
        self.page.locator("#tradeCode").fill("2330")
        self.page.locator("#tradeQty").fill("1")
        self.page.locator("#tradePrice").fill("100")
        self.page.locator("#tradeAdd").click()

    def go(self, view):
        self.page.locator(f'button[data-view="{view}"]:visible').first.click()

    def test_financial_corruption_does_not_block_ledger(self):
        for raw in ("{", json.dumps({"version": 1, "records": [None]})):
            for ledger in (None, json.dumps(EMPTY)):
                with self.subTest(financial=raw, ledger=ledger):
                    self.seed(ledger, raw)
                    self.assertEqual(self.stored(FKEY), raw)
                    self.assertEqual(self.page.locator("#portfolioStatus").inner_text(), "")
                    self.assertIn("未覆寫原始資料", self.page.locator("#advancedStatus").inner_text())
                    self.go("advanced")
                    self.page.locator("#financialClear").click()
                    self.assertIsNone(self.stored(FKEY))
                    self.go("portfolio")
                    self.add_trade()
                    status = self.page.locator("#portfolioStatus").inner_text()
                    self.assertEqual(status, "交易已保存於此瀏覽器")
                    saved = json.loads(self.stored(KEY))
                    self.assertEqual(len(saved["transactions"]), 1)
                    self.assertEqual(saved["transactions"][0]["code"], "2330")
                    self.page.reload()
                    self.assertEqual(self.page.locator("#transactionRows tbody tr").count(), 1)
        self.assertEqual(self.errors, [])

    def test_corrupt_ledger_preserved_until_explicit_restore(self):
        for raw in ("{", json.dumps({"version": 1, "transactions": [], "alerts": None})):
            with self.subTest(ledger=raw):
                financial = json.dumps(FINANCIAL)
                self.seed(raw, financial)
                self.assertIn("未覆寫原始資料", self.page.locator("#portfolioStatus").inner_text())
                self.go("advanced")
                self.page.locator("#financialInspect").click()
                self.assertIn("2020-06-30／公開日 2020-08-14", self.page.locator("#advancedStatus").inner_text())
                self.assertEqual(self.stored(FKEY), financial)
                self.go("portfolio")
                self.add_trade()
                self.assertIn("原始本機資料損壞", self.page.locator("#portfolioStatus").inner_text())
                self.assertEqual(self.stored(KEY), raw)
                self.page.locator("#alertClear").click()
                self.assertEqual(self.stored(KEY), raw)
                with self.page.expect_event("dialog") as pending:
                    self.page.locator("#ledgerImport").set_input_files({
                        "name": "ledger.json", "mimeType": "application/json",
                        "buffer": json.dumps(EMPTY).encode(),
                    })
                pending.value.dismiss()
                self.assertEqual(self.stored(KEY), raw)
                with self.page.expect_event("dialog") as pending:
                    self.page.locator("#ledgerImport").set_input_files({
                        "name": "ledger.json", "mimeType": "application/json",
                        "buffer": json.dumps(EMPTY).encode(),
                    })
                pending.value.accept()
                self.page.wait_for_function("document.getElementById('portfolioStatus').textContent === '已還原帳本'")
                self.assertEqual(json.loads(self.stored(KEY)), EMPTY)
                self.add_trade()
                self.assertEqual(len(json.loads(self.stored(KEY))["transactions"]), 1)
        self.assertEqual(self.errors, [])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chromium", help="Path to an installed Chromium executable")
    parser.add_argument("--mobile", action="store_true", help="Use a 390px mobile viewport")
    args = parser.parse_args()
    viewport = {"width": 390 if args.mobile else 1440, "height": 900}
    handler = functools.partial(QuietHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base_url = f"http://127.0.0.1:{server.server_port}"
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=args.chromium)
            result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(StorageChecks))
            browser.close()
        server.shutdown()
    raise SystemExit(not result.wasSuccessful())
