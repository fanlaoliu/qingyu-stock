import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from archive_history import append

class HistoryTests(unittest.TestCase):
    def setUp(self):
        self.h={'version':1,'observations':[]}
        self.s={'meta':{'mode':'official','trade_date':'2026-10-30'},'stocks':[{'code':'2330','market':'上市','date':'2026-10-30','price':100}]}
    def test_first_seen_is_not_trade_date_and_duplicate_is_idempotent(self):
        h=append(self.h,self.s,'2026-11-01T08:00:00+00:00')
        self.assertEqual(h['observations'][0]['observedAt'],'2026-11-01T08:00:00+00:00')
        self.assertIs(append(h,self.s,'2026-11-02T08:00:00+00:00'),h)
        self.assertEqual(self.h['observations'],[])
    def test_revisions_preserve_prior_version(self):
        h=append(self.h,self.s,'2026-11-01T08:00:00+00:00')
        revised={**self.s,'stocks':[{**self.s['stocks'][0],'price':101}]}
        r=append(h,revised,'2026-11-01T09:00:00+00:00')
        self.assertEqual(len(r['observations']),2)
        self.assertEqual(r['observations'][0]['snapshot']['stocks'][0]['price'],100)
        with self.assertRaises(ValueError):append(h,revised,'2026-11-01T07:00:00+00:00')
    def test_invalid_source_future_duplicates_and_naive_time_rejected(self):
        for s,t in [({**self.s,'meta':{'mode':'demo','trade_date':'2026-10-30'}},'2026-11-01T00:00:00Z'),(self.s,'2026-10-29T00:00:00Z'),(self.s,'2026-11-01'),({**self.s,'stocks':self.s['stocks']*2},'2026-11-01T00:00:00Z')]:
            with self.assertRaises(ValueError):append(self.h,s,t)
