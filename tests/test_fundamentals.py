import sys,unittest,tempfile,json
from pathlib import Path
from datetime import date
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from fundamental_core import normalize,normalize_period
from update_fundamentals import get_json
class FundamentalsTests(unittest.TestCase):
 def fact(self,val,start='2024-01-01',end='2024-12-31',accn='0000000001-25-000001',form='10-K'):
  r={'val':val,'end':end,'filed':'2025-02-01','accn':accn,'form':form}
  if start:r['start']=start
  return r
 def source(self):
  d={'RevenueFromContractWithCustomerExcludingAssessedTax':[self.fact(100)],'NetIncomeLoss':[self.fact(10)],'NetCashProvidedByUsedInOperatingActivities':[self.fact(20)],'PaymentsToAcquirePropertyPlantAndEquipment':[self.fact(5)],'Assets':[self.fact(200,None)],'Liabilities':[self.fact(120,None)],'StockholdersEquity':[self.fact(80,None)]}
  return {'cik':1,'entityName':'Fabricated test company','facts':{'us-gaap':{k:{'units':{'USD':v}} for k,v in d.items()}}}
 def test_period_matched_arithmetic(self):
  r=normalize(self.source(),{'symbol':'TEST'},date(2025,3,1))['annual'][0];self.assertEqual(r['ocf_less_capex'],15);self.assertEqual(r['ratios']['net_margin'],.1);self.assertEqual(r['ratios']['liabilities_assets'],.6);self.assertIsNone(r['ratios']['current_ratio'])
 def test_different_accession_not_mixed(self):
  s=self.source();s['facts']['us-gaap']['PaymentsToAcquirePropertyPlantAndEquipment']['units']['USD'][0]['accn']='different';r=normalize(s,{},date(2025,3,1))['annual'][0];self.assertIsNone(r['ocf_less_capex'])
 def test_different_duration_not_mixed(self):
  s=self.source();s['facts']['us-gaap']['NetCashProvidedByUsedInOperatingActivities']['units']['USD'][0]['start']='2024-07-01';r=normalize(s,{},date(2025,3,1))['annual'][0];self.assertIsNone(r['values']['operating_cash'])
 def test_conflicting_same_tag_is_missing(self):
  s=self.source();s['facts']['us-gaap']['NetIncomeLoss']['units']['USD'].append(self.fact(11));r=normalize(s,{},date(2025,3,1))['annual'][0];self.assertIsNone(r['values']['net_income'])
 def test_no_future_filing_and_no_zero_fill(self):
  self.assertEqual(normalize(self.source(),{},date(2025,1,1))['annual'],[]);s=self.source();del s['facts']['us-gaap']['PaymentsToAcquirePropertyPlantAndEquipment'];r=normalize(s,{},date(2025,3,1))['annual'][0];self.assertIsNone(r['ocf_less_capex'])
 def test_average_balance_return_ratios(self):
  source=self.source()
  for tag,value in [('RevenueFromContractWithCustomerExcludingAssessedTax',90),('NetIncomeLoss',8),('Assets',180),('StockholdersEquity',70)]:
   instant=tag in ['Assets','StockholdersEquity'];source['facts']['us-gaap'][tag]['units']['USD'].append(self.fact(value,None if instant else '2023-01-01','2023-12-31'))
  result=normalize(source,{},date(2025,3,1))['annual'][0]
  self.assertAlmostEqual(result['ratios']['return_on_average_equity'],10/75)
  self.assertAlmostEqual(result['ratios']['return_on_average_assets'],10/190)
 def test_cached_file_has_zero_network_requests(self):
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'cache.json';path.write_text('{"a":1}')
   with patch('update_fundamentals.requests.get') as request:
    result,fresh=get_json('https://data.sec.gov/example',path,{});self.assertEqual(result,{'a':1});self.assertFalse(fresh);request.assert_not_called()
