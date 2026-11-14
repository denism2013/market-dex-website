import sys, unittest
from pathlib import Path
from datetime import datetime, timezone, timedelta
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from import_options import universe, validate_chain, build
class OptionsTests(unittest.TestCase):
 def payload(self):
  return {'universe_as_of':datetime.now(timezone.utc).date().isoformat(),'universe_source':'fabricated test fixture','companies':[{'symbol':f'T{i}','company_id':str(i),'market_cap':1000-i,'russell3000':True} for i in range(110)]}
 def chain(self):
  now=datetime.now(timezone.utc)
  return {'symbol':'T0','expiration':(now.date()+timedelta(days=30)).isoformat(),'quote_at':now.isoformat(),'open_interest_as_of':now.date().isoformat(),'contracts':[{'type':'call','strike':100,'bid':1,'ask':2,'open_interest':20,'volume':3},{'type':'put','strike':90,'bid':1,'ask':2,'open_interest':10,'volume':3}]}
 def test_rank_and_deduplicate(self):
  p=self.payload();p['companies'].append({**p['companies'][0],'symbol':'CLASSB'});self.assertEqual(len(universe(p)),100);self.assertEqual(universe(p)[0]['symbol'],'T0')
 def test_missing_universe(self):
  p=self.payload();p['companies']=p['companies'][:99]
  with self.assertRaises(ValueError):universe(p)
 def test_ratio(self):self.assertEqual(validate_chain(self.chain(),datetime.now(timezone.utc))['put_call_oi'],.5)
 def test_crossed_quote(self):
  c=self.chain();c['contracts'][0]['bid']=4
  with self.assertRaises(ValueError):validate_chain(c,datetime.now(timezone.utc))
 def test_total_failure(self):
  with self.assertRaises(ValueError):build(self.payload())
 def test_missing_chain_retains_timestamp(self):
  p=self.payload();p['chains']=[self.chain()];prior={'symbols':{'T1':{'status':'observed','expirations':[{'quote_at':'2020-01-01'}]}}};result=build(p,prior);self.assertEqual(result['symbols']['T1']['status'],'retained_previous');self.assertEqual(result['symbols']['T1']['expirations'][0]['quote_at'],'2020-01-01')
