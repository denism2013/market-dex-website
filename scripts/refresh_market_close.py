#!/usr/bin/env python3
"""Recheck published Yahoo daily bars after 17:00 New York; never assert finality.

This refreshes market products only. Treasury/economic records are preserved.
A later source can revise the same observation date. Older responses and source
failures retain original source timestamps rather than pretending to be fresh.
"""
from __future__ import annotations
from copy import deepcopy
from datetime import datetime, date, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
import importlib.util
import json
import math

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
NY = ZoneInfo('America/New_York')
_UPDATER = None

class RefreshUnavailable(RuntimeError):
    """No newly verified source response; do not publish or advance timestamps."""

def updater():
    global _UPDATER
    if _UPDATER is None:
        spec = importlib.util.spec_from_file_location('market_close_base', ROOT/'scripts/update_market_data.py')
        _UPDATER = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(_UPDATER)
    return _UPDATER

def eligible(now):
    if now.tzinfo is None:
        raise ValueError('An aware collection time is required')
    local = now.astimezone(NY)
    return local.weekday() < 5 and local.hour >= 17

def valid_record(record, today):
    try:
        observed = date.fromisoformat(record['as_of'])
        history = record['history']
        close = record['close']
        return (record.get('status') == 'observed' and observed <= today
                and isinstance(close, (float, int)) and math.isfinite(close) and close > 0
                and bool(record.get('collected_at')) and len(history) >= 2
                and history[-1]['date'] == record['as_of']
                and history[-1]['close'] == close)
    except (KeyError, ValueError, TypeError):
        return False

def refresh_snapshot(previous, universe, now=None, fetch=None):
    """Return a source-backed revised snapshot, None outside the refresh window.

    ``fetch`` has the same signature as update_market_data.get_markets and is
    injectable for deterministic tests. A total outage raises before mutation.
    """
    now = now or datetime.now(timezone.utc)
    if not eligible(now):
        return None
    local = now.astimezone(NY)
    original = previous.get('markets', {})
    fetch = fetch or updater().get_markets
    downloaded, warnings, _reported, _carried = fetch(universe, original, local)
    accepted = {}
    notes = list(warnings)
    for meta in universe:
        symbol = meta['symbol']
        candidate = downloaded.get(symbol)
        if not candidate or not valid_record(candidate, local.date()):
            continue
        old = original.get(symbol, {})
        if old.get('as_of', '') > candidate['as_of']:
            notes.append(f'{symbol}: older response rejected; original observation retained')
            continue
        accepted[symbol] = deepcopy(candidate)
        accepted[symbol]['post_close_rechecked_at'] = now.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
    if not accepted:
        raise RefreshUnavailable('No newly verified market responses; all published market products left unchanged')
    result = deepcopy(previous)
    markets = result.setdefault('markets', {})
    for meta in universe:
        symbol = meta['symbol']
        if symbol in accepted:
            markets[symbol] = accepted[symbol]
        elif symbol in markets:
            markets[symbol]['status'] = 'prior_verified_cached'
    retained = sum(meta['symbol'] not in accepted and meta['symbol'] in markets for meta in universe)
    stamp = now.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
    result['generated_at'] = stamp
    result['status'] = 'complete' if len(accepted) == len(universe) and bool(result.get('treasury')) else 'partial'
    result['post_close_recheck'] = {
        'checked_at': stamp, 'newly_verified': len(accepted), 'retained_previous': retained,
        'note': 'Daily source bars rechecked after 17:00 New York; providers can revise these observations later.'}
    result['coverage'] = {**result.get('coverage', {}), 'loaded': len(markets),
                          'requested': len(universe), 'new_market_observations': len(accepted),
                          'reused_previous': retained}
    result['warnings'] = (list(previous.get('warnings', [])) + notes)[-55:]
    return result

def publish(snapshot, data_dir=DATA):
    """Keep every market-facing product consistent with the same revised bars."""
    data_dir = Path(data_dir)
    base = updater()
    old_data = base.DATA
    try:
        base.DATA = data_dir
        base.commit_snapshot(snapshot)
    finally:
        base.DATA = old_data
    preview = deepcopy(snapshot)
    preview['history_scope'] = 'preview'
    for record in preview['markets'].values():
        record['history'] = [{key:bar[key] for key in ('date','open','high','low','close','volume') if key in bar}
                             for bar in record.get('history', [])[-260:]]
    (data_dir/'market-preview.json').write_text(json.dumps(preview, separators=(',', ':'), allow_nan=False)+'\n')
    path = data_dir/'extra-tickers.json'
    if path.exists():
        extras = json.loads(path.read_text())
        extras = {key:deepcopy(snapshot['markets'].get(key, record)) for key,record in extras.items()}
        path.write_text(json.dumps(extras, separators=(',', ':'), allow_nan=False)+'\n')

def main():
    now = datetime.now(timezone.utc)
    if not eligible(now):
        print('Post-close recheck skipped: runs on weekdays at or after 17:00 New York.')
        return 0
    previous = json.loads((DATA/'latest.json').read_text())
    universe = json.loads((DATA/'universe.json').read_text())['instruments']
    try:
        result = refresh_snapshot(previous, universe, now)
    except RefreshUnavailable as exc:
        print(str(exc))
        return 1
    publish(result)
    coverage = result['post_close_recheck']
    print(f"Post-close source recheck: {coverage['newly_verified']}/{len(universe)} verified, {coverage['retained_previous']} retained.")
    spy = result['markets'].get('SPY')
    if spy:
        print(f"SPY {spy['as_of']}: {spy['close']:.6f}; source collected {spy['collected_at']}")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
