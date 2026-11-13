#!/usr/bin/env python3
"""Public official-agency economic observations distributed by FRED; no keys.
Observation periods are not publication dates. Retain each last-good series on
failure; never manufacture releases or carry observations into missing periods.
"""
import csv
import io
import json
import math
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timezone
from pathlib import Path
import requests
ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / 'data/economy.json'
# id, title, group, publisher, frequency, units, transform, seasonal adjustment
SERIES = [
 ('CPIAUCSL','Headline CPI','Inflation','BLS','Monthly','Index 1982–84=100','yoy','Seasonally adjusted'),
 ('CPILFESL','Core CPI','Inflation','BLS','Monthly','Index 1982–84=100','yoy','Seasonally adjusted'),
 ('PCEPI','Headline PCE','Inflation','BEA','Monthly','Index 2017=100','yoy','Seasonally adjusted'),
 ('PCEPILFE','Core PCE','Inflation','BEA','Monthly','Index 2017=100','yoy','Seasonally adjusted'),
 ('PAYEMS','Nonfarm payrolls','Labor','BLS','Monthly','Thousands of persons','change','Seasonally adjusted'),
 ('UNRATE','Unemployment rate','Labor','BLS','Monthly','Percent','level','Seasonally adjusted'),
 ('ICSA','Initial jobless claims','Labor','DOL / Employment and Training Administration','Weekly','Claims','level','Seasonally adjusted; week ending Saturday'),
 ('JTSJOL','Job openings','Labor','BLS','Monthly','Thousands of openings','level','Seasonally adjusted'),
 ('GDPC1','Real GDP','Growth','BEA','Quarterly','Billions of chained 2017 dollars, annual rate','annualized','Seasonally adjusted annual rate'),
 ('RSAFS','Retail sales','Growth','Census Bureau','Monthly','Millions of dollars','mom','Seasonally adjusted; nominal'),
 ('INDPRO','Industrial production','Growth','Federal Reserve Board','Monthly','Index 2017=100','mom','Seasonally adjusted'),
 ('HOUST','Housing starts','Housing','Census Bureau / HUD','Monthly','Thousands of units, annual rate','level','Seasonally adjusted annual rate'),
 ('DFF','Effective fed funds rate','Policy','Federal Reserve Board','Daily','Percent','level','Not seasonally adjusted'),
]

def parse_csv(text, sid, today):
 reader=csv.DictReader(io.StringIO(text))
 if not reader.fieldnames or sid not in reader.fieldnames or 'observation_date' not in reader.fieldnames:
  raise ValueError('Unexpected FRED CSV columns')
 out={}
 for row in reader:
  try:
   period=date.fromisoformat(row['observation_date']); value=float(row[sid])
  except (ValueError,TypeError):continue
  if period<=today and math.isfinite(value):out[period.isoformat()]={'date':period.isoformat(),'value':value}
 if len(out)<2:raise ValueError('Insufficient validated observations')
 return sorted(out.values(),key=lambda x:x['date'])

def period_offset(period, months):
 d=date.fromisoformat(period); n=d.year*12+d.month-1-months
 return date(n//12,n%12+1,1).isoformat()

def transform(history, kind):
 bydate={p['date']:p['value'] for p in history}; out=[]
 for i,p in enumerate(history):
  prior=None
  if kind=='level':value=p['value']
  else:
   months=12 if kind=='yoy' else 3 if kind=='annualized' else 1
   prior=bydate.get(period_offset(p['date'],months))
   if prior is None or (kind!='change' and prior<=0):continue
   if kind=='change':value=p['value']-prior
   elif kind=='annualized':value=((p['value']/prior)**4-1)*100
   else:value=(p['value']/prior-1)*100
  if math.isfinite(value):out.append({'date':p['date'],'value':round(value,6)})
 return out

def build_series(spec, history, collected_at, old=None, retained=False):
 sid,title,group,publisher,freq,units,kind,sa=spec
 derived=transform(history,kind)
 latest=derived[-1] if derived else None
 previous=derived[-2] if len(derived)>1 else None
 old_values={p['date']:p['value'] for p in (old or {}).get('history',[])}
 revised=sum(p['date'] in old_values and old_values[p['date']]!=p['value'] for p in history)
 unit={'yoy':'% YoY','mom':'% MoM','annualized':'% QoQ annualized','change':'thousand jobs MoM','level':units}[kind]
 return {'id':sid,'title':title,'group':group,'publisher':publisher,'distributor':'Federal Reserve Bank of St. Louis / FRED','frequency':freq,'raw_units':units,'seasonal_adjustment':sa,'transformation':kind,'display_units':unit,'source_url':f'https://fred.stlouisfed.org/series/{sid}','download_url':f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}', 'collected_at':collected_at,'status':'retained_previous' if retained else 'observed','latest':latest,'previous':previous,'overlapping_revisions_since_previous_snapshot':revised if old else None,'history':history,'display_history':derived}

def update(previous=None, now=None, fetch=requests.get):
 now=now or datetime.now(timezone.utc);today=now.date(); stamp=now.isoformat().replace('+00:00','Z')
 old={s['id']:s for s in (previous or {}).get('series',[])}
 def one(spec):
  sid=spec[0]
  try:
   response=fetch('https://fred.stlouisfed.org/graph/fredgraph.csv',params={'id':sid,'cosd':f'{today.year-6}-01-01'},timeout=35,headers={'User-Agent':'Market-DEX public economic research/1.0'})
   response.raise_for_status();hist=parse_csv(response.text,sid,today)
   # A provider response older than our last verified observation is not a refresh.
   if old.get(sid,{}).get('history',[]) and hist[-1]['date']<old[sid]['history'][-1]['date']:raise ValueError('Response older than previous snapshot')
   return build_series(spec,hist,stamp,old.get(sid)),None
  except Exception as exc:
   if old.get(sid,{}).get('history'):return build_series(spec,old[sid]['history'],old[sid]['collected_at'],old[sid],True),sid+': fetch unavailable; retained verified series ('+type(exc).__name__+')'
   return {**build_series(spec,[],None),'status':'unavailable'},sid+': unavailable ('+type(exc).__name__+')'
 with ThreadPoolExecutor(max_workers=4) as pool:results=list(pool.map(one,SERIES))
 return {'schema':'market-dex.economy.v1','generated_at':stamp,'refresh_policy':'Checked with the weekday 5 PM New York market snapshot; releases follow agency schedules.','vintage_note':'Latest available, revisable data; this is not a point-in-time archive. Observation dates identify reference periods, not release dates. No consensus or surprise estimates.','series':[r[0] for r in results],'warnings':[r[1] for r in results if r[1]]}

def main():
 previous=json.loads(PATH.read_text()) if PATH.exists() else None
 result=update(previous)
 if not any(s['latest'] for s in result['series']):raise SystemExit('No validated economic series; existing snapshot left unchanged')
 PATH.write_text(json.dumps(result,separators=(',',':'),allow_nan=False)+'\n')
 print('Economy: '+str(sum(s['status']=='observed' for s in result['series']))+'/'+str(len(SERIES))+' series checked; '+str(len(result['warnings']))+' warnings')
if __name__=='__main__':main()
