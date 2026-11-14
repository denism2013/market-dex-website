import sys,unittest
from pathlib import Path
from datetime import date,timedelta
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from rulebook_core import flags,rsi,outcome_stats,wilson,analyze,pullback_trades
class RuleTests(unittest.TestCase):
 def bars(self,n=260):return [{'date':(date(2024,1,1)+timedelta(days=i)).isoformat(),'close':100.,'volume':1000} for i in range(n)]
 def test_wilder_seed(self):
  x=rsi([100,101,100,102]);self.assertEqual(x[2],50);self.assertAlmostEqual(x[3],83.3333333333)
 def test_cross_warmup_and_causal_prefix(self):
  b=self.bars();b[200]['close']=101
  states,events,_=flags(b);self.assertIsNone(states['sma200'][198]);self.assertIn(200,events['sma200']);small,ev,_=flags(b[:220]);self.assertEqual(states['sma200'][:220],small['sma200']);self.assertEqual([i for i in events['sma200'] if i<220],ev['sma200'])
 def test_next_close_excludes_trigger_jump(self):
  b=self.bars(5);b[1]['close']=200;b[2]['close']=220;b[3]['close']=200;b[4]['close']=200
  s=outcome_stats(b,[0],1);self.assertEqual(s['n'],1);self.assertAlmostEqual(s['mean_return'],.1)
 def test_window_declustering(self):
  b=self.bars(10);s=outcome_stats(b,list(range(9)),2);self.assertEqual(s['n'],2);self.assertIsNone(s['baseline_mean']);self.assertEqual(s['win_rate'],0)
 def test_unresolved_and_bear_direction(self):
  b=self.bars(4);b[2]['close']=90;s=outcome_stats(b,[0,3],1,-1);self.assertEqual(s['n'],1);self.assertEqual(s['win_rate'],1)
 def test_wilson_reference(self):
  lo,hi=wilson(5,10);self.assertAlmostEqual(lo,.236593,places=5);self.assertAlmostEqual(hi,.763407,places=5);self.assertIsNone(wilson(0,0))
 def test_holdout_and_invalid(self):
  b=self.bars();s=outcome_stats(b,[201,220,245],5,split=230);self.assertEqual(s['n'],1)
  b[5]['date']=b[4]['date'];self.assertEqual(analyze('X',{'history':b})['status'],'invalid_history')
 def test_corporate_action_suppression(self):
  b=self.bars();b[220]['close']=40;r=analyze('X',{'history':b});self.assertEqual(r['status'],'corporate_action_check_required');self.assertEqual(r['rules'][0]['statistics'],[])
 def test_exit_trade_cost_and_no_same_day_fill(self):
  b=self.bars(207);b[201]['close']=90;b[202]['close']=99;b[203]['close']=100
  state=[False]*207;state[200]=True;s5=[100.]*207;s5[202]=95
  out=pullback_trades(b,state,s5);self.assertEqual(out['last_trades'][0]['entry_date'],b[201]['date']);self.assertEqual(out['last_trades'][0]['exit_date'],b[203]['date']);self.assertAlmostEqual(out['mean_net'],100/90*.999**2-1)
