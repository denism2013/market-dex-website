#!/usr/bin/env python3
"""Small source-backed first-paint payloads with enough history for true YTD comparisons."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'data'
def write(name,data):(DATA/name).write_text(json.dumps(data,separators=(',',':'),allow_nan=False)+'\n')
def main():
    rates=json.loads((DATA/'treasury-history.json').read_text());rates['coverage']={'available_from':rates['history'][0]['date'],'total_observations':len(rates['history'])};rates['history']=rates['history'][-260:];rates['history_scope']='recent';write('treasury-recent.json',rates)
    market=json.loads((DATA/'latest.json').read_text());market['history_scope']='preview'
    for value in market['markets'].values():value['history']=[{k:b[k] for k in ('date','open','high','low','close','volume') if k in b} for b in value.get('history',[])[-260:]]
    write('market-preview.json',market)
    explore=json.loads((DATA/'explore.json').read_text());history=DATA/'lab-price-history.json';raw=json.loads(history.read_text()) if history.exists() else None
    if raw:
        dates=raw['dates'][-260:];explore['dates']=dates;series={}
        for symbol,value in raw['series'].items():
            if symbol not in explore['series']:continue
            series[symbol]={k:v for k,v in value.items() if k not in ('prices','history')};series[symbol]['prices']=value['prices'][-len(dates):]
        explore['series']=series
    explore.pop('sector_holdings',None);write('internals.json',explore)
    symbols={f['symbol'] for f in explore['global_funds']}|{'SPY'};explore['series']={k:v for k,v in explore['series'].items() if k in symbols};explore['indices']={};explore['coverage']={'loaded':len(explore['series']),'requested':len(symbols),'newly_observed':sum(v['status']=='observed' for v in explore['series'].values())};explore['scope']='global';write('global-markets.json',explore)
    for name in ('treasury-recent.json','market-preview.json','internals.json','global-markets.json'):print(f'{name}: {(DATA/name).stat().st_size:,} bytes')
if __name__=='__main__':main()
