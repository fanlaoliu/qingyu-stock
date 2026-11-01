import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import update_financials as F
class FinancialSummaryTests(unittest.TestCase):
    def setUp(self):
        self.row={'出表日期':'1151101','年度':'115','季別':'3','公司代號':'2330','公司名稱':'測試','基本每股盈餘(元)':'0'}
        self.now='2026-11-01T10:00:00+00:00'
    def test_period_zero_and_no_invented_publication_or_ttm(self):
        r=F.parse([self.row],'上市',self.now)[0]
        self.assertEqual(r['eps'],0);self.assertEqual(r['periodEnd'],'2026-09-30')
        self.assertIsNone(r['publishedAt']);self.assertNotEqual(r['epsBasis'],'TTM')
    def test_otc_keys_negative_eps(self):
        r=F.parse([{'Date':'1151101','Year':'115','季別':'3','SecuritiesCompanyCode':'6488','基本每股盈餘':'-1.2'}],'上櫃',self.now)[0]
        self.assertEqual(r['eps'],-1.2)
    def test_bad_dates_duplicates_and_values_rejected(self):
        for patch in [{'季別':'5'},{'出表日期':'1151102'},{'基本每股盈餘(元)':'garbage'},{'公司代號':'0050'}]:
            with self.assertRaises(ValueError):F.parse([{**self.row,**patch}],'上市',self.now)
        with self.assertRaises(ValueError):F.parse([self.row,self.row],'上市',self.now)
    def test_failed_market_retains_old_timestamp_and_all_failure_preserves_file(self):
        old=F.parse([self.row],'上市','2026-11-01T09:00:00+00:00')
        otc={'Date':'1151101','Year':'115','季別':'3','SecuritiesCompanyCode':'6488','基本每股盈餘':'--'}
        r=F.update({'records':old},{'上櫃':[otc]},self.now)
        self.assertEqual(r['records'][0]['observedAt'],old[0]['observedAt']);self.assertIn('上市',r['meta']['errors'])
        with self.assertRaises(ValueError):F.update({'records':old},{},self.now)
