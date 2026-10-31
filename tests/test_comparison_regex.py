"""Regression tests for the inline stock comparison input parser."""
from pathlib import Path
import re
import unittest


HTML = (Path(__file__).resolve().parents[1] / "index.html").read_text(encoding="utf-8")


class ComparisonInputTests(unittest.TestCase):
    def test_separators_include_spaces_and_chinese_punctuation(self):
        match = re.search(r"raw\.split\(/(.*?)/\)", HTML)
        self.assertIsNotNone(match, "comparison split regex not found")
        parts = re.split(match.group(1), "2330 2454,2308；2881、0050")
        self.assertEqual(parts, ["2330", "2454", "2308", "2881", "0050"])

    def test_stock_code_validation_accepts_digits_only(self):
        match = re.search(r"codes\.some\(c=>!/(.*?)/\.test\(c\)", HTML)
        self.assertIsNotNone(match, "comparison code regex not found")
        code = re.compile(match.group(1))
        for valid in ("2330", "6488", "006208"):
            self.assertIsNotNone(code.fullmatch(valid))
        for invalid in ("23A0", "233", "1234567", ""):
            self.assertIsNone(code.fullmatch(invalid))


if __name__ == "__main__":
    unittest.main()
