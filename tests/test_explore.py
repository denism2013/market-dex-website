import importlib.util, unittest
from pathlib import Path
from datetime import date
import pandas as pd
spec=importlib.util.spec_from_file_location('explore',Path(__file__).resolve().parents[1]/'scripts/update_explore_data.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ExploreTests(unittest.TestCase):
    def test_price_validation(self):
        frame=pd.DataFrame({'Close':[10,float('nan'),-4,11]},index=pd.to_datetime(['2026-11-01','2026-11-02','2026-11-03','2030-01-01']))
        self.assertEqual(m.extract_bars(frame,date(2026,11,13)),[{'date':'2026-11-01','close':10}])
    def test_bad_holdings_rejected(self):
        with self.assertRaises(Exception):m.parse_holdings(b'not an excel file','SPY')
if __name__=='__main__':unittest.main()
