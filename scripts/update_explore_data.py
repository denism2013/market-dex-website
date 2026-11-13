#!/usr/bin/env python3
"""Dated index-holdings proxies and adjusted close history for Market Internals / Global Markets."""
import io,json,math,re,time
from zoneinfo import ZoneInfo
from pathlib import Path
from datetime import datetime,date,timezone,timedelta
import requests
import pandas as pd
import yfinance as yf
ROOT=Path(__file__).resolve().parents[1]; DATA=ROOT/'data'
HOLDINGS='https://www.ssga.com/library-content/products/fund-data/etfs/us/holdings-daily-us-en-{symbol}.xlsx'

def parse_holdings(content,symbol):
    raw=pd.read_excel(io.BytesIO(content),header=None)
    stamp=None
    for value in raw.head(5).to_numpy().ravel():
        match=re.search(r'As of\s+(\d{2}-[A-Za-z]{3}-\d{4})',str(value))
        if match:stamp=datetime.strptime(match[1],'%d-%b-%Y').date().isoformat()
    if not stamp:raise ValueError('Holdings observation date missing')
    header=next((i for i,row in raw.iterrows() if 'Ticker' in row.values and 'Name' in row.values),None)
    if header is None:raise ValueError('Holdings columns missing')
    frame=raw.iloc[header+1:].copy();frame.columns=raw.iloc[header]
    members=[]
    for _,row in frame.iterrows():
        ticker=str(row.get('Ticker','')).strip()
        if not re.fullmatch(r'[A-Z]{1,5}(?:[.-][A-Z])?',ticker):continue
        if str(row.get('Local Currency',''))!='USD':continue
        weight=pd.to_numeric(row.get('Weight'),errors='coerce')
        if not pd.notna(weight) or weight<=0:continue
        members.append({'symbol':ticker.replace('.','-'),'name':str(row['Name']),'weight_pct':round(float(weight),6)})
    if not (450<=len(members)<=520 if symbol=='SPY' else 28<=len(members)<=32):raise ValueError(f'Unexpected {symbol} holding count {len(members)}')
    return {'name':'S&P 500' if symbol=='SPY' else 'Dow Jones 30','proxy':symbol,'holdings_as_of':stamp,'source_url':HOLDINGS.format(symbol=symbol.lower()),'members':members,'status':'observed'}

def extract_bars(frame,today):
    rows=[]
    if frame is None or frame.empty:return rows
    for dt,row in frame.iterrows():
        day=dt.date()
        try:value=float(row['Close'])
        except (ValueError,TypeError,KeyError):continue
        if day>today or not math.isfinite(value) or value<=0:continue
        rows.append({'date':day.isoformat(),'close':round(value,6)})
    return sorted({r['date']:r for r in rows}.values(),key=lambda r:r['date'])[-140:]

def main():
    now=datetime.now(timezone.utc);ny=now.astimezone(ZoneInfo('America/New_York'));today=ny.date() if ny.hour>=17 else ny.date()-timedelta(days=1);stamp=now.isoformat().replace('+00:00','Z')
    config=json.loads((DATA/'explore-config.json').read_text());path=DATA/'explore.json';old=json.loads(path.read_text()) if path.exists() else {};warnings=[];indices={}
    for symbol in config['index_funds']:
        print(f'Fetching official {symbol} holdings',flush=True)
        try:
            response=requests.get(HOLDINGS.format(symbol=symbol.lower()),timeout=35);response.raise_for_status()
            indices[symbol]=parse_holdings(response.content,symbol)
        except Exception as exc:
            warnings.append(f'{symbol} holdings: {str(exc)[:130]}')
            if symbol in old.get('indices',{}):indices[symbol]={**old['indices'][symbol],'status':'prior_verified_cached'}
    names={m['symbol']:m['name'] for index in indices.values() for m in index['members']}
    names.update({f['symbol']:f['name'] for f in config['global_funds']})
    for symbol in config['ratio_symbols']:names.setdefault(symbol,symbol)
    symbols=sorted(names);series={};seen=0
    for start in range(0,len(symbols),45):
        batch=symbols[start:start+45]
        print(f'Fetching adjusted history {start+1}–{min(start+45,len(symbols))} of {len(symbols)}',flush=True)
        try:
            prices=yf.download(batch,period='8mo',interval='1d',auto_adjust=True,group_by='ticker',threads=6,progress=False,timeout=12)
            for symbol in batch:
                try:
                    frame=prices[symbol] if isinstance(prices.columns,pd.MultiIndex) else prices
                    bars=extract_bars(frame,today)
                    if len(bars)<2 or (today-date.fromisoformat(bars[-1]['date'])).days>7:raise ValueError('Missing/rejected recent adjusted bars')
                    series[symbol]={'name':names[symbol],'history':bars,'as_of':bars[-1]['date'],'collected_at':stamp,'status':'observed','price_basis':'split_dividend_adjusted_daily_close'};seen+=1
                except Exception as exc:warnings.append(f'{symbol}: {str(exc)[:85]}')
        except Exception as exc:warnings.append(f'Batch {start}: {str(exc)[:140]}')
        time.sleep(.4)
    for symbol in symbols:
        if symbol not in series and symbol in old.get('series',{}):series[symbol]={**old['series'][symbol],'status':'prior_verified_cached'}
    if not seen:
        if old:print('No newly observed exploration prices; retaining previous snapshot unchanged');return
        raise SystemExit('Exploration source unavailable; no prices fabricated')
    snapshot={'schema':'market-dex.explore.v1','generated_at':stamp,'provider':'Yahoo Finance via yfinance (unofficial); State Street holdings','price_basis':'split_dividend_adjusted_daily_close','refresh_window':'17:00 America/New_York weekdays','indices':indices,'series':series,'coverage':{'requested':len(symbols),'loaded':len(series),'newly_observed':seen},'warnings':warnings,'global_funds':config['global_funds'],'coordinate_basis':config['coordinate_basis']}
    path.write_text(json.dumps(snapshot,separators=(',',':'),allow_nan=False)+'\n')
    print(f'Exploration: {len(series)}/{len(symbols)} series, {seen} newly observed; indices '+', '.join(f'{s}:{len(v["members"])} holdings dated {v["holdings_as_of"]}' for s,v in indices.items()))
if __name__=='__main__':main()
