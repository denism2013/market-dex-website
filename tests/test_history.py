import importlib.util
from pathlib import Path
import unittest
from datetime import date
spec=importlib.util.spec_from_file_location('updater',Path(__file__).resolve().parents[1]/'scripts/update_market_data.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class HistoryTests(unittest.TestCase):
    def test_table_rejects_missing_future_invalid_and_pre1990(self):
        text='''#1989-12-29| 9.0
#1990-01-02| 7.94
#1990-01-03| .
#1990-01-04| 80
#2030-01-01| 4.0'''
        self.assertEqual(m.parse_fred(text,'DGS10',date(2026,11,13)),{'1990-01-02':7.94})
    def test_csv(self):
        self.assertEqual(m.parse_fred('observation_date,DGS10\n2026-11-10,4.98\n2026-11-11,.','DGS10',date(2026,11,13)),{'2026-11-10':4.98})
    def test_wrong_export_fails(self):
        with self.assertRaises(ValueError):m.parse_fred('<html>Data unavailable</html>','DGS10',date.today())
if __name__=='__main__': unittest.main()
