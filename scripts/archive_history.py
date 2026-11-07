"""Append immutable, first-observed snapshots; never backdate knowledge."""
import datetime as dt
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def append(history, snapshot, observed_at):
    timestamp = dt.datetime.fromisoformat(observed_at)
    if timestamp.tzinfo is None:
        raise ValueError('observed_at must include timezone')
    if history.get('version') != 1 or not isinstance(history.get('observations'), list):
        raise ValueError('Invalid history format')
    if snapshot.get('meta', {}).get('mode') != 'official':
        raise ValueError('Official snapshots only')
    trade_date = dt.date.fromisoformat(snapshot['meta']['trade_date'])
    if trade_date > timestamp.date():
        raise ValueError('Future trade date')
    if not isinstance(snapshot.get('stocks'), list) or not snapshot['stocks']:
        raise ValueError('Empty snapshot')
    seen = set()
    for row in snapshot['stocks']:
        key = (row.get('market'), row.get('code'))
        if key in seen or key[0] not in ('上市', '上櫃') or not isinstance(key[1], str):
            raise ValueError('Duplicate or invalid identifier')
        seen.add(key)
        if dt.date.fromisoformat(row['date']) > trade_date:
            raise ValueError('Row beyond snapshot date')
    raw = json.dumps(snapshot, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False)
    digest = hashlib.sha256(raw.encode()).hexdigest()
    # Repeated fetches do not change first-observed knowledge time.
    if any(o['sha256'] == digest for o in history['observations']):
        return history
    if history['observations'] and timestamp <= dt.datetime.fromisoformat(history['observations'][-1]['observedAt']):
        raise ValueError('Observation time must increase')
    return {'version': 1, 'observations': history['observations'] + [{
        'tradeDate': trade_date.isoformat(), 'observedAt': observed_at,
        'sha256': digest, 'snapshot': snapshot,
    }]}

def main():
    # One file per observation; daily index carries no private user data.
    folder = ROOT / 'data/history'
    index = folder / 'index.json'
    existing = json.loads(index.read_text()) if index.exists() else {'version': 1, 'observations': []}
    history = {'version': 1, 'observations': [dict(o) for o in existing['observations']]}
    snapshot = json.loads((ROOT / 'data/stocks.json').read_text())
    now = dt.datetime.now(dt.timezone.utc).isoformat(timespec='microseconds')
    result = append(history, snapshot, now)
    if len(result['observations']) == len(history['observations']):
        print('Snapshot already archived'); return
    item = result['observations'][-1]
    folder.mkdir(parents=True, exist_ok=True)
    name = item['sha256'] + '.json'
    target = folder / name
    if target.exists():
        raise ValueError('Refusing to overwrite archive')
    target.write_text(json.dumps(item, ensure_ascii=False, allow_nan=False))
    metadata = {k: v for k, v in item.items() if k != 'snapshot'}
    metadata['file'] = name
    existing['observations'].append(metadata)
    temp = index.with_suffix('.tmp')
    temp.write_text(json.dumps(existing, ensure_ascii=False))
    temp.replace(index)
    print('Archived first-observed snapshot:', item['tradeDate'])

if __name__ == '__main__':
    main()
