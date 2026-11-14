"""Weekly cached SEC companyfacts collector; one request/second, no per-visitor requests."""
import os,json,time,re,argparse
from pathlib import Path
from datetime import datetime,timezone,timedelta
import requests
from fundamental_core import normalize
ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'work/sec-cache';DATA=ROOT/'data/fundamentals'
def get_json(url,path,headers,max_age_days=7):
 path.parent.mkdir(parents=True,exist_ok=True);now=datetime.now(timezone.utc)
 if path.exists() and now.timestamp()-path.stat().st_mtime<max_age_days*86400:return json.loads(path.read_text()),False
 time.sleep(1.05)
 try:
  with requests.get(url,headers=headers,timeout=(10,45),stream=True) as r:
   if r.status_code!=200:raise ValueError('SEC source unavailable')
   raw=bytearray()
   for chunk in r.iter_content(65536):
    raw.extend(chunk)
    if len(raw)>16*1024*1024:raise ValueError('SEC payload exceeds limit')
   data=json.loads(raw)
   temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data,separators=(',',':')));temp.replace(path);return data,True
 except Exception:
  if path.exists():return json.loads(path.read_text()),False
  raise ValueError('SEC source unavailable; previous publication retained') from None
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--max-companies',type=int,default=35);args=parser.parse_args();contact=os.environ.get('SEC_CONTACT_EMAIL','')
 if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',contact):print('SEC collector not configured: contact email is required');return
 headers={'User-Agent':'Market-DEX Research '+contact,'Accept-Encoding':'gzip, deflate','Accept':'application/json'};DATA.mkdir(parents=True,exist_ok=True)
 snapshot=json.loads((ROOT/'data/latest.json').read_text());instruments=snapshot['markets'];extra=ROOT/'data/extra-tickers.json'
 if extra.exists():instruments={**instruments,**json.loads(extra.read_text())}
 mapping,_=get_json('https://www.sec.gov/files/company_tickers.json',CACHE/'tickers.json',headers,30);tickers={r['ticker'].replace('-','.'):str(r['cik_str']).zfill(10) for r in mapping.values()};manifest=[];processed=0
 for symbol,x in instruments.items():
  equity=x.get('asset_class') in ['equity','common_stock'];cik=tickers.get(symbol.replace('-','.'));path=DATA/(symbol+'.json');status='not_applicable_fund' if not equity else 'cik_unavailable' if not cik else 'pending_collection'
  if equity and cik and processed<args.max_companies:
   processed+=1
   try:
    raw,fresh=get_json('https://data.sec.gov/api/xbrl/companyfacts/CIK'+cik+'.json',CACHE/(cik+'.json'),headers)
    checked=datetime.fromtimestamp((CACHE/(cik+'.json')).stat().st_mtime,timezone.utc).isoformat();data=normalize(raw,{'symbol':symbol,'name':x.get('name',symbol),'sector':x.get('sector'),'source_checked_at':checked});status=data['status']
    temp=path.with_suffix('.tmp');temp.write_text(json.dumps(data,allow_nan=False,separators=(',',':'))+'\n');temp.replace(path)
   except Exception:
    status='retained_previous' if path.exists() else 'source_unavailable'
  elif path.exists():status='retained_previous'
  manifest.append({'symbol':symbol,'name':x.get('name',symbol),'asset_class':x.get('asset_class'),'status':status,'cik':cik if equity else None,'price':x.get('close'),'price_as_of':x.get('as_of')})
 result={'schema':1,'built_at':datetime.now(timezone.utc).isoformat(),'symbols':manifest,'source':'SEC EDGAR companyfacts','source_url':'https://www.sec.gov/search-filings/edgar-application-programming-interfaces','policy':'Weekly check, cache at least seven days; dates and missing tags remain explicit. ETFs do not have operating-company statements. No visitor-triggered SEC calls.'}
 (ROOT/'data/fundamentals-index.json').write_text(json.dumps(result,allow_nan=False,separators=(',',':'))+'\n');print('Fundamentals publication: '+str(processed)+' companies considered; coverage statuses recorded.')
if __name__=='__main__':main()
