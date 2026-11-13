import importlib.util
import json
from copy import deepcopy
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
spec=importlib.util.spec_from_file_location('close_refresh',Path(__file__).resolve().parents[1]/'scripts/refresh_market_close.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
NOW=datetime(2026,11,13,22,10,tzinfo=timezone.utc)
U=[{'symbol':'SPY'},{'symbol':'QQQ'}]
def record(close=754.21,day='2026-11-13',stamp='2026-11-13T16:06:31-05:00'):
    return {'as_of':day,'close':close,'collected_at':stamp,'status':'observed','history':[{'date':'2026-11-12','close':757.12},{'date':day,'close':close}],'change':close-757.12}
def snapshot():
    return {'schema':'market-dex.snapshot.v1','generated_at':'old','markets':{'SPY':record(),'QQQ':record(688)},'treasury':{'as_of':'2026-11-12','history':[1]},'coverage':{},'warnings':[]}
def fetch(records):
    return lambda universe,previous,now:(records,[],len(records),0)
class MarketCloseTests(unittest.TestCase):
    def test_guard(self):
        called=[]
        def fail(*args):called.append(1);raise AssertionError('Fetched outside window')
        self.assertIsNone(m.refresh_snapshot(snapshot(),U,datetime(2026,11,13,21,59,tzinfo=timezone.utc),fail))
        self.assertIsNone(m.refresh_snapshot(snapshot(),U,datetime(2026,11,14,23,tzinfo=timezone.utc),fail))
        self.assertEqual(called,[])
    def test_same_date_revision_and_unrelated_sources(self):
        before=snapshot();old=deepcopy(before)
        revised=record(754.37,stamp=NOW.isoformat())
        out=m.refresh_snapshot(before,U,NOW,fetch({'SPY':revised}))
        self.assertEqual(out['markets']['SPY']['close'],754.37)
        self.assertEqual(out['markets']['SPY']['history'][-1]['close'],754.37)
        self.assertEqual(out['markets']['SPY']['change'],754.37-757.12)
        self.assertEqual(out['treasury'],before['treasury'])
        self.assertEqual(out['markets']['QQQ']['collected_at'],before['markets']['QQQ']['collected_at'])
        self.assertEqual(out['markets']['QQQ']['status'],'prior_verified_cached')
        self.assertEqual(out['post_close_recheck']['newly_verified'],1)
        self.assertEqual(before,old)
    def test_total_outage_does_not_advance_metadata(self):
        before=snapshot();old=deepcopy(before)
        with self.assertRaises(m.RefreshUnavailable):m.refresh_snapshot(before,U,NOW,fetch({}))
        self.assertEqual(before,old)
        cached=deepcopy(before['markets']);cached['SPY']['status']='prior_verified_cached';cached['QQQ']['status']='prior_verified_cached'
        with self.assertRaises(m.RefreshUnavailable):m.refresh_snapshot(before,U,NOW,fetch(cached))
    def test_older_response_does_not_overwrite_newer(self):
        before=snapshot();out=m.refresh_snapshot(before,U,NOW,fetch({'SPY':record(750,'2026-11-12'), 'QQQ':record(689,stamp=NOW.isoformat())}))
        self.assertEqual(out['markets']['SPY']['as_of'],'2026-11-13')
        self.assertEqual(out['markets']['SPY']['close'],754.21)
        self.assertEqual(out['markets']['SPY']['collected_at'],before['markets']['SPY']['collected_at'])
    def test_invalid_or_future_bar_rejected(self):
        for candidate in [record(900,'2026-11-14'),record(float('nan')),record(-1)]:
            with self.assertRaises(m.RefreshUnavailable):m.refresh_snapshot(snapshot(),U,NOW,fetch({'SPY':candidate}))
    def test_every_market_product_uses_same_revision(self):
        out=m.refresh_snapshot(snapshot(),U,NOW,fetch({'SPY':record(754.37,stamp=NOW.isoformat())}))
        with TemporaryDirectory() as folder:
            path=Path(folder);(path/'extra-tickers.json').write_text(json.dumps({'SPY':record()}))
            m.publish(out,path)
            for name in ['latest.json','market-preview.json']:
                data=json.loads((path/name).read_text());self.assertEqual(data['markets']['SPY']['close'],754.37)
                self.assertEqual(data['markets']['SPY']['history'][-1]['close'],754.37)
            self.assertEqual(json.loads((path/'extra-tickers.json').read_text())['SPY']['close'],754.37)
            self.assertIn('754.37',(path/'bootstrap.js').read_text())
if __name__=='__main__':unittest.main()
