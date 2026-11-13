"""Fetch missing covered instruments from Yahoo's public daily chart feed."""
import json,math
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
from pathlib import Path
import requests
from update_market_data import calc_indicators,commit_snapshot
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'data'
def fetch(meta):
 sid=meta['symbol'];r=requests.get(f'https://query1.finance.yahoo.com/v8/finance/chart/{sid}',params={'range':'3y','interval':'1d'},headers={'User-Agent':'Mozilla/5.0'},timeout=25);r.raise_for_status();x=r.json()['chart']['result'][0];q=x['indicators']['quote'][0];bars=[]
 for i,t in enumerate(x['timestamp']):
  b={k:q[k][i] for k in ['open','high','low','close','volume']};b['date']=datetime.fromtimestamp(t,timezone.utc).date().isoformat()
  if all(isinstance(b[k],(int,float)) and math.isfinite(b[k]) and b[k]>0 for k in ['open','high','low','close']) and b['low']<=min(b['open'],b['close'])<=max(b['open'],b['close'])<=b['high']:bars.append(b)
 if len(bars)<50:raise ValueError('Insufficient verified history')
 a,b=bars[-2:];stamp=datetime.now(timezone.utc)
 if (stamp.date()-datetime.fromisoformat(b['date']).date()).days>7:raise ValueError('Old history')
 return {**meta,'currency':'USD','provider':'Yahoo Finance public daily chart','source_url':f'https://finance.yahoo.com/quote/{sid}/history/','price_basis':'unadjusted_daily_close','collected_at':stamp.isoformat(),'as_of':b['date'],'close':b['close'],'prev_close':a['close'],'change':b['close']-a['close'],'change_pct':(b['close']/a['close']-1)*100,'volume':b['volume'],'history':bars,'indicators':calc_indicators(bars),'status':'observed'}
def main():
 d=json.loads((DATA/'latest.json').read_text());u=json.loads((DATA/'universe.json').read_text())['instruments'];pending=[m for m in u if m['symbol'] not in d['markets'] or d['markets'][m['symbol']].get('status')=='prior_verified_cached']
 def one(m):
  try:return fetch(m)
  except Exception as exc:print(m['symbol'],type(exc).__name__,flush=True)
 with ThreadPoolExecutor(max_workers=3) as pool:
  for result in pool.map(one,pending):
   if result:d['markets'][result['symbol']]=result
 d['coverage']['loaded']=len(d['markets']);d['coverage']['requested']=len(u);commit_snapshot(d);extra_path=DATA/'extra-tickers.json';extra=json.loads(extra_path.read_text()) if extra_path.exists() else {};extra_path.write_text(json.dumps({k:d['markets'].get(k,v) for k,v in extra.items()},separators=(',',':')));print('Loaded',len(d['markets']),'of',len(u))
if __name__=='__main__':main()
