#!/usr/bin/env python3
"""Build the original experimental viewers' input schemas from verified scheduled data."""
import json
from pathlib import Path
from datetime import date
ROOT=Path(__file__).resolve().parents[1];DATA=ROOT/'data'
def write(name,value):(DATA/name).write_text(json.dumps(value,separators=(',',':'),allow_nan=False)+'\n')
def main():
    if not (DATA/'lab-price-history.json').exists():
        if (DATA/'lab-manifest.json').exists():print('Lab history unavailable; retaining published experimental observations.');return
        raise SystemExit('No verified long-history input for the lab')
    raw=json.loads((DATA/'lab-price-history.json').read_text());explore=json.loads((DATA/'explore.json').read_text());config=json.loads((DATA/'explore-config.json').read_text());dates=raw['dates'];series=raw['series'];sector_symbols=list(config['sector_funds']);required=['SPY']+sector_symbols
    usable=[i for i in range(len(dates)) if all(s in series and series[s]['prices'][i] is not None for s in required)]
    if len(usable)<330:raise SystemExit('Sector Galaxy requires sufficient actual history for weekly normalization; previous files retained')
    common=[dates[i] for i in usable];sector_series={s:[series[s]['prices'][i] for i in usable] for s in required}
    memberships=explore.get('sector_holdings',{});spy=explore['indices']['SPY'];mapping={m['symbol']:etf for etf,entry in memberships.items() for m in entry['members']}
    weights={etf:sum(m['weight_pct'] for m in spy['members'] if mapping.get(m['symbol'])==etf) for etf in sector_symbols};total=sum(weights.values())
    if len(memberships)<11 or total<90:raise SystemExit('Incomplete current sector holdings; previous lab files retained')
    weights={key:value/total for key,value in weights.items()};meta={'generated_at':raw['generated_at'],'as_of':common[-1],'holdings_as_of':min(entry['holdings_as_of'] for entry in memberships.values()),'price_basis':'split_dividend_adjusted_daily_close','provider':'Yahoo Finance via yfinance; official State Street ETF holdings','membership_basis':'Current ETF holdings applied to historical prices; not historical index membership or audited index contributions.'}
    write('lab-sector.json',{'source':'MARKET-DEX scheduled adjusted ETF observations','dates':common,'series':sector_series,'weights':weights,'meta':meta,'note':meta['membership_basis']})
    # Match the galaxy's weekly samples, preserving gaps rather than inventing closes.
    weekly=[];last=None
    for i,d in enumerate(common):
        key=date.fromisoformat(d).isocalendar()[:2]
        if key==last:weekly[-1]=i
        else:weekly.append(i);last=key
    week_dates=[common[i] for i in weekly];raw_idx={day:i for i,day in enumerate(dates)};by_sector={}
    for etf,entry in memberships.items():
        rows=[]
        for member in entry['members']:
            symbol=member['symbol'];prices=series.get(symbol,{}).get('prices')
            if not prices:continue
            rows.append({'t':symbol,'n':member['name'],'w':member['weight_pct']/100,'p':[prices[raw_idx[d]] for d in week_dates]})
        by_sector[etf]=rows
    write('lab-holdings.json',{'dates':week_dates,'sectors':by_sector,'source':meta['provider'],'asOf':meta['holdings_as_of'],'meta':meta})
    members=[m for m in spy['members'] if m['symbol'] in series];chip_dates=dates;prices=[series[m['symbol']]['prices'] for m in members]
    chips={'dates':chip_dates,'tickers':[m['symbol'] for m in members],'names':[m['name'] for m in members],'sectors':[config['sector_funds'].get(mapping.get(m['symbol']),'Unclassified') for m in members],'prices':prices,'bench':{'dates':dates,'series':{'SPY':series['SPY']['prices']}},'meta':{**meta,'holdings_as_of':spy['holdings_as_of']}}
    write('lab-chips.json',chips)
    write('lab-manifest.json',{'schema':'market-dex.lab.v1',**meta,'sector_count':len(sector_symbols),'stock_count':len(members),'history_from':dates[0],'history_through':dates[-1],'status':'published','refresh_window':'17:00 America/New_York weekdays'})
    print(f'Lab: {len(sector_symbols)} sectors, {len(members)} stocks, {len(dates)} actual dates; observation {common[-1]}')
if __name__=='__main__':main()
