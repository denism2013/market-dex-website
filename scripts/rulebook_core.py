"""Causal daily rule definitions and inspectable, descriptive event statistics."""
import math, statistics
from datetime import date
RULES=[
 {'id':'sma200','name':'200-session trend regime','description':'Active when close exceeds SMA200; trigger on the first close crossing above it. Cash is unremunerated in the descriptive comparison.','direction':1},
 {'id':'golden','name':'Golden cross','description':'SMA50 crosses from at/below to above SMA200. A lagging trend event, not an entry guarantee.','direction':1},
 {'id':'death','name':'Death cross','description':'SMA50 crosses from at/above to below SMA200. Success means the underlying later fell, not a simulated short profit.','direction':-1},
 {'id':'rsi2_5','name':'RSI(2) pullback <5','description':'Wilder RSI2 <5 and close >SMA200. Explicit pullback variant; next-close entry and next-close exit after close >SMA5.','direction':1},
 {'id':'rsi2_10','name':'RSI(2) pullback <10','description':'Same pullback rule at RSI2 <10. Related threshold comparison increases selection risk.','direction':1},
 {'id':'breakout','name':'Volume-confirmed closing breakout','description':'Close exceeds the previous 20 closes and volume is at least 1.5 times the previous 20-session mean. Daily-close rule, not intraday confirmation.','direction':1}]
UNSUPPORTED=[
 {'name':'VIX >30 close-back-below reversal','need':'Dated authorized VIX close history aligned to the equity benchmark. Intraday 10–15% reversal requires intraday data.','status':'Source not collected'},
 {'name':'VIX / VIX3M cross below 1','need':'Matched daily VIX and VIX3M history. VIX3M is a three-month implied-volatility index, not a futures price.','status':'Source not collected'},
 {'name':'Cboe equity put/call >1','need':'Consistent equity-only option-volume history and reuse rights; single-stock OI ratios are not substitutes.','status':'Source not collected'},
 {'name':'AAII bears >50%','need':'Authorized dated survey history and actual publication timestamps.','status':'Source not collected'},
 {'name':'9:1 up/down volume days','need':'Historical exchange-wide up/down volume with consistent eligible-issue definitions.','status':'NYSE data unavailable'},
 {'name':'Zweig breadth thrust','need':'Historical exchange advances/declines and a fixed 10-session EMA specification. Current SPY constituents cannot recreate it.','status':'NYSE data unavailable'},
 {'name':'Whaley / 5-day advance-decline thrust','need':'Verified original rule definition and historical exchange advances/declines. The supplied name/variant is not treated as validated.','status':'Definition and source needed'},
 {'name':'Clustered Hindenburg Omen','need':'Complete historical new highs/lows, exchange universe, trend and breadth conditions. Definitions differ; 2.2–2.8% alone is incomplete.','status':'Definition and source needed'},
 {'name':'Turn of the month','need':'Verified exchange-session calendar, complete adjusted benchmark history and fixed entry/exit convention.','status':'Calendar validation needed'},
 {'name':'Pre-FOMC drift','need':'Historical scheduled announcement timestamps and intraday benchmark prices. Daily-close returns cannot test a 24-hour announcement window faithfully.','status':'Intraday data unavailable'},
 {'name':'Santa Claus / January barometer','need':'Verified session calendar and decades of adjusted prices; current three-year coverage gives too few independent annual events.','status':'History too short'},
 {'name':'Quarterly expiration / post-expiration week','need':'Exchange calendars and long adjusted OHLCV history. Volume seasonality is separate from direction. Intraday pinning/dealer hedging is not observable here.','status':'Calendar and history needed'},
 {'name':'Midterm election cycle','need':'Many decades of prices with independently specified election windows; three years cannot support a multi-cycle inference. Claims of never losing are not assumed.','status':'History too short'}]
def valid(bars):
 prev=None
 for b in bars:
  try:d=date.fromisoformat(b['date'])
  except (ValueError,KeyError,TypeError):return False
  c=b.get('close')
  if prev and d<=prev or not isinstance(c,(int,float)) or isinstance(c,bool) or not math.isfinite(c) or c<=0:return False
  prev=d
 return bool(bars)
def sma(values,n):
 out=[];total=0
 for i,v in enumerate(values):
  total+=v
  if i>=n:total-=values[i-n]
  out.append(total/n if i>=n-1 else None)
 return out
def rsi(values,n=2):
 out=[None]*len(values)
 if len(values)<=n:return out
 gain=sum(max(0,values[i]-values[i-1]) for i in range(1,n+1))/n;loss=sum(max(0,values[i-1]-values[i]) for i in range(1,n+1))/n
 for i in range(n,len(values)):
  if i>n:
   diff=values[i]-values[i-1];gain=(gain*(n-1)+max(0,diff))/n;loss=(loss*(n-1)+max(0,-diff))/n
  out[i]=50 if gain==loss==0 else 100 if loss==0 else 100-100/(1+gain/loss)
 return out
def flags(bars):
 if not valid(bars):raise ValueError('Invalid or unordered daily history')
 close=[b['close'] for b in bars];s5=sma(close,5);s50=sma(close,50);s200=sma(close,200);rs=rsi(close);states={r['id']:[None]*len(bars) for r in RULES}
 for i,b in enumerate(bars):
  if i<199:continue
  states['sma200'][i]=close[i]>s200[i]
  states['golden'][i]=s50[i]>s200[i];states['death'][i]=s50[i]<s200[i]
  states['rsi2_5'][i]=close[i]>s200[i] and rs[i]<5;states['rsi2_10'][i]=close[i]>s200[i] and rs[i]<10
  volumes=[x.get('volume') for x in bars[i-20:i]];v=b.get('volume');ok=all(isinstance(v,(int,float)) and math.isfinite(v) and v>=0 for v in volumes)
  states['breakout'][i]=close[i]>max(close[i-20:i]) and v>=statistics.mean(volumes)*1.5 if ok and statistics.mean(volumes)>0 and isinstance(v,(int,float)) and math.isfinite(v) and v>=0 else None
 events={k:[i for i in range(200,len(bars)) if a[i] is True and a[i-1] is False] for k,a in states.items()}
 return states,events,s5
def wilson(wins,n):
 if not n:return None
 z=1.95996398454;p=wins/n;denom=1+z*z/n;center=(p+z*z/(2*n))/denom;half=z*math.sqrt(p*(1-p)/n+z*z/(4*n*n))/denom
 return [max(0,center-half),min(1,center+half)]
def outcome_stats(bars,events,h,direction=1,split=None):
 # Entry is the next observed close. No event can capture its own trigger-day move.
 rows=[];blocked=-1
 for i in events:
  entry=i+1;exit=entry+h
  if i<=blocked or exit>=len(bars) or split is not None and i<split:continue
  r=bars[exit]['close']/bars[entry]['close']-1
  rows.append({'signal_date':bars[i]['date'],'entry_date':bars[entry]['date'],'exit_date':bars[exit]['date'],'return':r});blocked=exit
 values=[x['return'] for x in rows];n=len(values);wins=sum(direction*v>0 for v in values)
 baseline=[bars[i+1+h]['close']/bars[i+1]['close']-1 for i in range(max(200,split or 0),len(bars)-h-1)]
 mean=lambda a:statistics.mean(a) if a else None
 return {'horizon':h,'n':n,'win_rate':wins/n if n else None,'win_interval':wilson(wins,n),'mean_return':mean(values),'median_return':statistics.median(values) if n else None,'baseline_mean':mean(baseline),'baseline_n':len(baseline),'baseline_win_rate':sum(direction*v>0 for v in baseline)/len(baseline) if baseline else None,'status':'limited_evidence' if n<20 else 'descriptive_only','last_outcomes':rows[-5:]}
def pullback_trades(bars,state,s5,cost_bps=10):
 trades=[];i=200;open_trade=None
 while i<len(bars)-1:
  if not state[i]:i+=1;continue
  entry=i+1;exit_signal=next((j for j in range(entry,len(bars)) if bars[j]['close']>s5[j]),None)
  if exit_signal is None or exit_signal+1>=len(bars):
   open_trade={'entry_date':bars[entry]['date'],'marked_date':bars[-1]['date'],'unrealized_net':bars[-1]['close']/bars[entry]['close']*(1-cost_bps/10000)-1};break
  exit=exit_signal+1;net=bars[exit]['close']/bars[entry]['close']*(1-cost_bps/10000)**2-1
  trades.append({'signal_date':bars[i]['date'],'entry_date':bars[entry]['date'],'exit_date':bars[exit]['date'],'net_return':net});i=exit+1
 n=len(trades);wins=sum(t['net_return']>0 for t in trades)
 return {'n_closed':n,'win_rate':wins/n if n else None,'win_interval':wilson(wins,n),'mean_net':statistics.mean(t['net_return'] for t in trades) if n else None,'cost_bps_per_side':cost_bps,'open_trade':open_trade,'last_trades':trades[-8:]}
def analyze(symbol,x):
 bars=x.get('history',[])
 if not valid(bars):return {'symbol':symbol,'status':'invalid_history','rules':[]}
 states,events,s5=flags(bars);split=int(len(bars)*.7);output=[]
 suspected=[b['date'] for a,b in zip(bars,bars[1:]) if abs(b['close']/a['close']-1)>.5]
 for meta in RULES:
  key=meta['id'];a=states[key];ev=events[key];item={**meta,'active':a[-1],'last_trigger':bars[ev[-1]]['date'] if ev else None,'recent_triggers':[bars[i]['date'] for i in ev[-10:]],'event_count':len(ev),'eligible_sessions':sum(v is not None for v in a),'statistics':[] if suspected else [outcome_stats(bars,ev,h,meta['direction']) for h in [5,21,63,126,252]],'holdout_21':None if suspected else outcome_stats(bars,ev,21,meta['direction'],split)}
  if key.startswith('rsi2_'):item['exit_rule_test']=None if suspected else pullback_trades(bars,a,s5)
  output.append(item)
 return {'schema':1,'symbol':symbol,'name':x.get('name',symbol),'as_of':bars[-1]['date'],'source_url':x.get('source_url'),'collected_at':x.get('collected_at'),'first_date':bars[0]['date'],'sessions':len(bars),'price_basis':x.get('price_basis','unadjusted_daily_close'),'status':'corporate_action_check_required' if suspected else 'observed','possible_price_discontinuities':suspected,'split_date':bars[split]['date'],'rules':output}
