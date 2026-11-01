import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import update_statements as S
class StatementTests(unittest.TestCase):
    def setUp(self):self.row={'公司代號':'1232','年度':'115','季別':'3','出表日期':'1151101','營業收入':'1000','本期淨利（淨損）':'0'};self.now='2026-11-01T10:00:00+00:00'
    def test_original_fields_and_unit_ambiguity_preserved(self):
        r=S.parse([self.row],'上市:income',self.now)[0];self.assertEqual(r['periodEnd'],'2026-09-30');self.assertEqual(r['fields']['本期淨利（淨損）'],'0');self.assertEqual(r['unit'],'official-original-unit-unverified')
    def test_schema_duplicate_future_rejected(self):
        for rows in [[self.row,self.row],[{**self.row,'季別':'5'}],[{**self.row,'出表日期':'1151102'}],[{'公司代號':'1232'}]]:
            with self.assertRaises((ValueError,TypeError)):S.parse(rows,'上市:income',self.now)
    def test_source_failure_preserves_original_record(self):
        old=S.parse([self.row],'上市:income',self.now);p=S.update({'records':old},{'上市:income':[self.row]},self.now);self.assertEqual(len(p['meta']['errors']),3);self.assertEqual(len(p['records']),1)
        with self.assertRaises(ValueError):S.update({'records':old},{},self.now)
