#!/usr/bin/env python3
"""MARKET-DEX: free-first, source-provenanced daily market snapshot.

Sources: Yahoo Finance via yfinance (unofficial, best effort), and U.S. Treasury
Daily Treasury Par Yield Curve Rates (official published observations).

Run from repository root. No invented quotes, no background client scraping,
no secrets, and no intraday/live assertions. The previous verified snapshot is
retained with original observation dates when a source fails.
"""
from __future__ import annotations

import csv
import io
import json
import math
import os
import sys
import time
from datetime import datetime, date, timedelta, timezone
from pathlib import Path
from statistics import mean, stdev
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SCHEMA = "market-dex.snapshot.v1"
SOURCE_TREASURY = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve"
TREASURY_CSV = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/all/{month}?_format=csv&field_tdr_date_value_month={month}&page=&type=daily_treasury_yield_curve"
MATURITY_FIELDS = {
    "1M": ("1 Mo", "1 MO"), "2M": ("2 Mo", "2 MO"), "3M": ("3 Mo", "3 MO"),
    "6M": ("6 Mo", "6 MO"), "1Y": ("1 Yr", "1 YR"), "2Y": ("2 Yr", "2 YR"),
    "3Y": ("3 Yr", "3 YR"), "5Y": ("5 Yr", "5 YR"), "7Y": ("7 Yr", "7 YR"),
    "10Y": ("10 Yr", "10 YR"), "20Y": ("20 Yr", "20 YR"), "30Y": ("30 Yr", "30 YR")
}


def finite(value):
    try:
        v = float(value)
        return v if math.isfinite(v) else None
    except (ValueError, TypeError):
        return None


def parse_treasury_csv(content: str) -> list[dict]:
    """Official CSV only. Don't extrapolate missing tenors or non-trading dates."""
    content = content.lstrip("\ufeff")
    records = []
    reader = csv.DictReader(io.StringIO(content))
    if not reader.fieldnames or "Date" not in reader.fieldnames:
        raise ValueError("Treasury CSV missing Date header")
    for row in reader:
        raw_date = (row.get("Date") or "").strip()
        try:
            dt = datetime.strptime(raw_date, "%m/%d/%Y").date()
        except ValueError:
            continue
        if dt > datetime.now(ZoneInfo("America/New_York")).date() + timedelta(days=1):
            continue
        yields = {}
        for label, candidates in MATURITY_FIELDS.items():
            val = next((finite(row.get(k)) for k in candidates if row.get(k) is not None), None)
            if val is not None and 0 <= val < 30:
                yields[label] = round(val, 4)
        if len(yields) >= 10 and all(k in yields for k in ("2Y", "10Y", "30Y")):
            records.append({"date": dt.isoformat(), "yields": yields})
    records.sort(key=lambda r: r["date"])
    # Deduplicate by dated observation and limit history for small static downloads.
    return list({r["date"]: r for r in records}.values())[-64:]


def get_treasury(previous: dict, now: datetime) -> tuple[dict, list[str], bool]:
    """Read current and prior month so 3D view has useful actual history."""
    import requests
    warnings, rows = [], []
    first_of_month = now.date().replace(day=1)
    prior_month = first_of_month - timedelta(days=1)
    months = [prior_month.strftime("%Y%m"), now.strftime("%Y%m")]
    for month in months:
        url = TREASURY_CSV.format(month=month)
        try:
            resp = requests.get(url, headers={"User-Agent": "MARKET-DEX Research Bot (public daily par yields)"}, timeout=25)
            resp.raise_for_status()
            parsed = parse_treasury_csv(resp.text)
            if not parsed:
                raise ValueError("Treasury CSV has no validated par yield rows")
            rows.extend(parsed)
        except Exception as exc:
            warnings.append(f"Treasury {month}: {type(exc).__name__}: {str(exc)[:110]}")
    prior = previous.get("history", []) if isinstance(previous, dict) else []
    merged = {r["date"]: r for r in prior if isinstance(r, dict) and "date" in r}
    for record in rows:
        merged[record["date"]] = record
    history = sorted(merged.values(), key=lambda r: r["date"])[-64:]
    if not history:
        return {}, warnings or ["Treasury unavailable and no previous verified curve exists"], False
    current = history[-1]
    if (now.date() - date.fromisoformat(current["date"])).days > 4:
        warnings.append("Treasury observation is older than four calendar days; display as stale")
    # True only if source supplied a new observation, not if reused a prior one.
    fresh_source = bool(rows) and max(r["date"] for r in rows) >= current["date"]
    return {
        "as_of": current["date"], "provider": "U.S. Department of the Treasury",
        "source_url": SOURCE_TREASURY, "basis": "daily_constant_maturity_par_yields_pct",
        "frequency": "published_business_day", "history": history,
        "status": "observed" if fresh_source else "prior_verified_cached"
    }, warnings, fresh_source


def valid_bars(frame) -> list[dict]:
    """Use Yahoo's unadjusted daily Close. Reject nan/negative/future bars."""
    now_ny = datetime.now(ZoneInfo("America/New_York")).date()
    out = []
    if frame is None or frame.empty:
        return out
    for t, row in frame.iterrows():
        try:
            d = t.date() if hasattr(t, "date") else date.fromisoformat(str(t)[:10])
            if d > now_ny or d < now_ny-timedelta(days=400):
                continue
            close=finite(row.get("Close")); volume=finite(row.get("Volume")); op=finite(row.get("Open")); hi=finite(row.get("High")); lo=finite(row.get("Low"))
            if close is None or close <= 0 or close > 1_000_000_000:
                continue
            if volume is not None and volume < 0:
                continue
            if None not in (op,hi,lo) and not (0 < lo <= max(op,hi,close)*1.05):
                continue
            out.append({"date": d.isoformat(), "close":round(close,6), "volume":int(volume) if volume is not None else None})
        except Exception:
            continue
    out.sort(key=lambda x:x['date'])
    return list({p['date']:p for p in out}.values())[-130:]


def calc_indicators(bars: list[dict]) -> dict:
    prices=[b['close'] for b in bars]; ind={"sma20": None,"sma50":None,"return_20d":None,"rsi14":None,"realized_vol_20d":None}
    if len(prices)>=20:ind['sma20']=round(mean(prices[-20:]),4)
    if len(prices)>=50:ind['sma50']=round(mean(prices[-50:]),4)
    if len(prices)>=21 and prices[-21]>0:ind['return_20d']=round((prices[-1]/prices[-21]-1)*100,3)
    if len(prices)>=15:
        diffs=[prices[i]-prices[i-1] for i in range(-14,0)]
        ag=mean(max(d,0) for d in diffs); al=mean(max(-d,0) for d in diffs)
        ind['rsi14']=round(100 if al==0 and ag>0 else 50 if al==0 and ag==0 else 100-100/(1+ag/al),2)
    if len(prices)>=21:
        rets=[math.log(prices[i]/prices[i-1]) for i in range(-20,0) if prices[i-1]>0]
        if len(rets)==20:ind['realized_vol_20d']=round(stdev(rets)*math.sqrt(252)*100,2)
    return ind


def get_markets(universe:list[dict],previous:dict, now:datetime):
    """Batch download; a failure retains previously observed bars without changing their dates."""
    import yfinance as yf
    symbols=[x['symbol'] for x in universe]
    warnings=[]; result={}; seen=0
    batches=[symbols[i:i+9] for i in range(0,len(symbols),9)]
    for batch in batches:
        try:
            # Ticker group_by is explicit. No adjusted price confusion: unadjusted Close.
            df=yf.download(batch,period="8mo",interval="1d",group_by="ticker",auto_adjust=False,actions=False,threads=False,progress=False,timeout=22)
            if df is None or df.empty:raise ValueError('empty Yahoo daily history')
            for symbol in batch:
                meta=next(x for x in universe if x['symbol']==symbol)
                try:
                    frame=df[symbol] if isinstance(df.columns, __import__('pandas').MultiIndex) else df
                    bars=valid_bars(frame)
                    if len(bars)<22:raise ValueError('fewer than 22 valid daily bars')
                    recent=bars[-1]; prev=bars[-2]
                    # Do not publish incomplete/out-of-date bar as if fresh.
                    if (now.date()-date.fromisoformat(recent['date'])).days>7:raise ValueError('source bars too old')
                    change=round(recent['close']-prev['close'],6)
                    change_pct=round(change/prev['close']*100,4) if prev['close'] else None
                    if change_pct is not None and abs(change_pct)>55:
                        warnings.append(f'{symbol}: unusually large raw close-to-close change, potential corporate action')
                        change_pct=None
                    result[symbol]={"symbol":symbol,"name":meta['name'],"group":meta['group'],"sector":meta.get('sector'),"asset_class":meta.get('asset_class'),"currency":"USD","provider":"Yahoo Finance via yfinance","source_url":f"https://finance.yahoo.com/quote/{symbol}/history/","price_basis":"unadjusted_daily_close","collected_at":now.isoformat().replace('+00:00','Z'),"as_of":recent['date'],"close":recent['close'],"prev_close":prev['close'],"change":change,"change_pct":change_pct,"volume":recent['volume'],"history":bars[-95:],"indicators":calc_indicators(bars),"status":"observed"}
                    seen+=1
                except Exception as exc:
                    warnings.append(f'{symbol}: {str(exc)[:95]}')
        except Exception as exc:
            warnings.append(f"Batch {','.join(batch)}: {type(exc).__name__}: {str(exc)[:80]}")
        time.sleep(.7)
    carried=0
    for meta in universe:
        sym=meta['symbol']
        if sym not in result and sym in previous:
            old=previous[sym]
            # Explicitly carry forward date and provider; never forge a new close.
            if old.get('as_of') and finite(old.get('close')) is not None:
                result[sym]={**old,"status":"prior_verified_cached"};carried+=1
    if seen==0:warnings.append('No newly observed Yahoo bars; previous verified data retained where available')
    return result,warnings,seen,carried


def commit_snapshot(snapshot:dict):
    DATA.mkdir(exist_ok=True)
    body=json.dumps(snapshot,indent=2,ensure_ascii=False,allow_nan=False)+"\n"
    (DATA/'latest.json').write_text(body,encoding='utf-8')
    (DATA/'bootstrap.js').write_text('/* Same-origin file:// fallback. Generated by updater. */\nwindow.MDX_BOOTSTRAP = '+json.dumps(snapshot,separators=(',',':'),ensure_ascii=False,allow_nan=False)+';\n',encoding='utf-8')


def main():
    now=datetime.now(timezone.utc); now_ny=now.astimezone(ZoneInfo('America/New_York'))
    universe=json.loads((DATA/'universe.json').read_text())['instruments']
    old={}
    if (DATA/'latest.json').exists():
        try:old=json.loads((DATA/'latest.json').read_text(encoding='utf-8'))
        except Exception: pass
    prior_markets=old.get('markets',{}) if isinstance(old.get('markets'),dict) else {}
    markets,mwarn,seen,carried=get_markets(universe,prior_markets,now_ny)
    treasury,twarn,treas_fresh=get_treasury(old.get('treasury',{}),now_ny)
    if not markets and not treasury:
        raise SystemExit('No verified market or Treasury data available; no snapshot overwritten')
    warn=mwarn+twarn
    status='complete' if seen>=len(universe)*.75 and treas_fresh else 'partial'
    if seen==0 and not treas_fresh:status='retained_previous'
    snapshot={"schema":SCHEMA,"generated_at":now.isoformat().replace('+00:00','Z'),"refresh_window":"17:00 America/New_York business days","frequency":"daily_eod","status":status,"universe_scope":"curated_35_free_first_not_full_russell_3000","licensed_live_available":False,"markets":markets,"treasury":treasury,"coverage":{"requested":len(universe),"loaded":len(markets),"new_market_observations":seen,"reused_previous":carried,"treasury_loaded":bool(treasury),"treasury_fresh_source":treas_fresh},"warnings":warn[:55]}
    # Don't rewrite the complete snapshot or advance generated_at if absolutely
    # nothing new was observed (prevents false freshness on a total outage).
    if seen==0 and not treas_fresh and old.get('schema')==SCHEMA:
        print('No new observations; preserving existing verified snapshot unchanged')
        return 0
    commit_snapshot(snapshot)
    print(f"Wrote {len(markets)} validated securities ({seen} newly downloaded), Treasury={treasury.get('as_of','none')}, status={status}")
    if seen==0:print('WARNING: Equity batch failed; Treasury data is published independently')
    return 0

if __name__=='__main__':sys.exit(main())