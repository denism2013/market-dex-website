"""Validate a licensed provider export. No Yahoo options requests or inferred dealer positions.
Provider JSON contract: universe_as_of, universe_source, companies [{company_id,
symbol, market_cap, russell3000: true}], chains [{symbol, expiration, quote_at,
open_interest_as_of, contracts [{type, strike, bid, ask, open_interest, volume}]}].
OPTIONS_PUBLIC_RIGHTS_CONFIRMED must be true. Endpoint credentials stay in Actions secrets.
"""
import json, os, math, tempfile
from datetime import datetime, timezone, date
from pathlib import Path
import requests
ROOT=Path(__file__).resolve().parents[1]
def number(x): return isinstance(x,(int,float)) and not isinstance(x,bool) and math.isfinite(x)
def universe(payload):
    asof=date.fromisoformat(payload['universe_as_of'])
    if not payload.get('universe_source') or not 0 <= (datetime.now(timezone.utc).date()-asof).days <= 35: raise ValueError('Missing or stale constituent source')
    records=payload['companies']; ids=set(); symbols=set(); eligible=[]
    for c in sorted(records,key=lambda c:c.get('market_cap',0),reverse=True):
        if c.get('russell3000') is not True or c.get('symbol')=='ANDG': continue
        if not c.get('company_id') or not isinstance(c.get('symbol'),str) or not number(c.get('market_cap')) or c['market_cap']<=0: raise ValueError('Invalid company metadata')
        if c['company_id'] in ids or c['symbol'] in symbols: continue
        ids.add(c['company_id']);symbols.add(c['symbol']);eligible.append(c)
    if len(eligible)<100: raise ValueError('Fewer than 100 verified companies')
    return eligible[:100]
def validate_chain(chain, now):
    expiry=date.fromisoformat(chain['expiration']); quote=datetime.fromisoformat(chain['quote_at'].replace('Z','+00:00')); oi=date.fromisoformat(chain['open_interest_as_of'])
    if quote.tzinfo is None or not 0 <= (now-quote).total_seconds() <= 7*86400 or expiry<now.date() or oi>quote.date() or (quote.date()-oi).days>7: raise ValueError('Stale or invalid dates')
    contracts=chain['contracts']
    if not 0<len(contracts)<=10000: raise ValueError('Invalid chain size')
    seen=set()
    for c in contracts:
        key=(c['type'],c['strike'])
        if c['type'] not in ['call','put'] or key in seen or not number(c['strike']) or c['strike']<=0: raise ValueError('Invalid contract')
        seen.add(key)
        if not all(number(c[k]) and c[k]>=0 for k in ['bid','ask','open_interest','volume']) or c['ask']<c['bid'] or int(c['open_interest'])!=c['open_interest'] or int(c['volume'])!=c['volume']: raise ValueError('Invalid quotes or counts')
    totals={kind:sum(c['open_interest'] for c in contracts if c['type']==kind) for kind in ['call','put']}
    return {'expiration':chain['expiration'],'quote_at':chain['quote_at'],'open_interest_as_of':chain['open_interest_as_of'],'contracts':len(contracts),'call_oi':totals['call'],'put_oi':totals['put'],'put_call_oi':totals['put']/totals['call'] if totals['call'] else None,'call_wall':max((c for c in contracts if c['type']=='call'),key=lambda c:c['open_interest'],default={}).get('strike'),'put_wall':max((c for c in contracts if c['type']=='put'),key=lambda c:c['open_interest'],default={}).get('strike')}
def build(payload,previous=None,now=None):
    now=now or datetime.now(timezone.utc); companies=universe(payload); selected={c['symbol'] for c in companies}; grouped={}; failures=[]; seen=set()
    for chain in payload.get('chains',[]):
        sid=chain.get('symbol')
        if sid not in selected: continue
        try:
            key=(sid,chain['expiration'])
            if key in seen: raise ValueError('Duplicate expiry')
            seen.add(key); row=validate_chain(chain,now);grouped.setdefault(sid,[]).append(row)
        except (KeyError,TypeError,ValueError): failures.append(sid)
    output={}
    for c in companies:
        sid=c['symbol']; rows=sorted(grouped.get(sid,[]),key=lambda r:r['expiration'])[:4]
        if rows: output[sid]={'status':'observed' if len(rows)==4 else 'partial','expirations':rows}
        elif previous and sid in previous.get('symbols',{}): output[sid]={**previous['symbols'][sid],'status':'retained_previous'}
        else: output[sid]={'status':'unavailable','expirations':[]}
    if not grouped: raise ValueError('No valid fresh chains; preserving previous publication')
    return {'schema':1,'collected_at':now.isoformat(),'universe_as_of':payload['universe_as_of'],'universe_source':payload['universe_source'],'universe':companies,'symbols':output,'validation_failures':sorted(set(failures)),'note':'OI is dated separately from quotes. Walls are largest reported open interest, not dealer positioning or trade direction.'}
def main():
    if os.environ.get('OPTIONS_PUBLIC_RIGHTS_CONFIRMED')!='true': print('Options disabled: public display rights unconfirmed');return
    endpoint=os.environ.get('OPTIONS_EXPORT_URL','')
    if not endpoint.startswith('https://'): raise ValueError('A licensed HTTPS JSON export endpoint is required')
    target=ROOT/'data/options-positioning.json'; previous=json.loads(target.read_text()) if target.exists() else None
    # One bounded request per run; conditional revalidation; no per-contract network fanout.
    cache=ROOT/'work/options-etag.txt'; headers={}
    if cache.exists():headers['If-None-Match']=cache.read_text()
    token=os.environ.get('OPTIONS_EXPORT_TOKEN')
    if token: headers['Authorization']='Bearer '+token
    with requests.get(endpoint,headers=headers,timeout=(10,60),stream=True) as response:
        if response.status_code==304:return
        if response.status_code!=200: raise ValueError('Provider export request failed')
        content=bytearray()
        for chunk in response.iter_content(65536):
            content.extend(chunk)
            if len(content)>32*1024*1024: raise ValueError('Export exceeds 32 MB')
        data=build(json.loads(content),previous)
        with tempfile.NamedTemporaryFile('w',dir=target.parent,delete=False) as f:json.dump(data,f,allow_nan=False,separators=(',',':'));tmp=Path(f.name)
        tmp.replace(target)
        if response.headers.get('ETag'):cache.parent.mkdir(exist_ok=True);cache.write_text(response.headers['ETag'])
if __name__=='__main__':main()
