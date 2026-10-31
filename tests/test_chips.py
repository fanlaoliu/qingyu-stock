import datetime as dt
import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
import update_chips as C
from update_data import month, date

TODAY = dt.date(2026, 10, 31)
TWSE = {'stat': 'OK', 'date': '20261030', 'fields': ['證券代號','外陸資買賣超股數(不含外資自營商)','投信買賣超股數','自營商買賣超股數','三大法人買賣超股數'], 'data': [['2330','1,000','-500','0','500']]}
TPEX = [{'Date': '1151030', 'SecuritiesCompanyCode': '6488', 'Foreign Investors include Mainland Area Investors (Foreign Dealers excluded)-Difference': '2000', 'SecuritiesInvestmentTrustCompanies-Difference': '-1000', 'Dealers-Difference': '500', 'TotalDifference': '1500'}]

class ChipsTests(unittest.TestCase):
    def test_twse_uses_headers_and_keeps_zero_distinct_from_missing(self):
        data = C.parse(TWSE, '上市', TODAY, min_rows=1)
        self.assertEqual(data['date'], '2026-10-30')
        self.assertEqual(data['rows']['2330'], {'foreign':1000,'trust':-500,'dealer':0,'total':500})
        reordered = {**TWSE, 'fields': list(reversed(TWSE['fields'])), 'data': [list(reversed(TWSE['data'][0]))]}
        self.assertEqual(C.parse(reordered,'上市',TODAY,1), data)
        self.assertIsNone(C.shares('--'))
        self.assertEqual(C.shares('0'),0)
        self.assertIsNone(C.shares(True))
        self.assertIsNone(C.shares('1.5'))

    def test_tpex_foreign_dealer_is_not_added_twice(self):
        payload=[{**TPEX[0], 'ForeignDealers-Difference': '99999'}]
        row=C.parse(payload,'上櫃',TODAY,1)['rows']['6488']
        self.assertEqual(row['total'],1500)
        self.assertEqual(row['foreign'],2000)

    def test_dates_schema_duplicates_and_totals_fail_closed(self):
        for payload in [{**TWSE,'date':'20261001'}, {**TWSE,'date':'20261101'}, {**TWSE,'stat':'no data'}, {**TWSE,'fields':['證券代號']}, {**TWSE,'data':[TWSE['data'][0]]*2}, {**TWSE,'data':[['2330','1000','-500','0','501']]}]:
            with self.assertRaises(ValueError): C.parse(payload,'上市',TODAY,1)
        with self.assertRaises(ValueError): C.parse([TPEX[0],{**TPEX[0],'Date':'1151029'}],'上櫃',TODAY,1)
        with self.assertRaises(ValueError): C.parse(TWSE,'上市',TODAY,min_rows=300)

    def test_history_is_idempotent_bounded_and_never_regresses(self):
        old=[{'date':'2026-10-29','rows':{}},{'date':'2026-10-30','rows':{}}]
        replacement={'date':'2026-10-30','rows':{'2330':{'total':0}}}
        self.assertEqual(C.merge_history(old,replacement),[old[0],replacement])
        with self.assertRaises(ValueError): C.merge_history(old,old[0])
        history=[{'date':(TODAY-dt.timedelta(days=100-i)).isoformat(),'rows':{}} for i in range(80)]
        self.assertEqual(len(C.merge_history(history,{'date':TODAY.isoformat(),'rows':{}})),60)

    def test_failed_sources_never_overwrite_previous_file(self):
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'chips.json';path.write_text('{"version":1,"markets":{}}')
            before=path.read_bytes()
            with patch.object(C,'OUT',path), patch.object(C,'fetch_market',side_effect=RuntimeError('offline')):
                with self.assertRaises(RuntimeError): C.main()
            self.assertEqual(path.read_bytes(),before)

    def test_partial_failure_preserves_failed_market(self):
        prior={'source':'official','sessions':[{'date':'2026-10-29','rows':{}}]}
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/'chips.json';path.write_text(json.dumps({'version':1,'markets':{'上櫃':prior}}))
            def result(market):
                if market=='上櫃':raise RuntimeError('offline')
                return {'date':'2026-10-30','rows':{'2330':{'foreign':0,'trust':0,'dealer':0,'total':0}}}
            with patch.object(C,'OUT',path), patch.object(C,'fetch_market',side_effect=result):C.main()
            data=json.loads(path.read_text());self.assertEqual(data['markets']['上櫃'],prior);self.assertIn('上櫃',data['meta']['errors'])

    def test_periods_preserve_real_calendar_values(self):
        self.assertEqual(month('11509'),'2026-09')
        self.assertEqual(month('202609'),'2026-09')
        self.assertIsNone(month('11513'))
        self.assertIsNone(date('1150230'))

if __name__ == '__main__':unittest.main()
