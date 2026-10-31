#!/usr/bin/env python3
"""Official institutional net shares. Failed markets retain their dated history."""
import concurrent.futures
import datetime as dt
import json
from pathlib import Path
import re
import urllib.request
from update_data import date

OUT = Path(__file__).resolve().parents[1] / 'data' / 'chips.json'
SOURCES = {
    '上市': 'https://www.twse.com.tw/rwd/zh/fund/T86?selectType=ALLBUT0999&response=json',
    '上櫃': 'https://www.tpex.org.tw/openapi/v1/tpex_3insti_daily_trading',
}
FIELDS = {
    '上市': {'code': '證券代號', 'foreign': '外陸資買賣超股數(不含外資自營商)', 'trust': '投信買賣超股數', 'dealer': '自營商買賣超股數', 'total': '三大法人買賣超股數'},
    '上櫃': {'code': 'SecuritiesCompanyCode', 'foreign': 'Foreign Investors include Mainland Area Investors (Foreign Dealers excluded)-Difference', 'trust': 'SecuritiesInvestmentTrustCompanies-Difference', 'dealer': 'Dealers-Difference', 'total': 'TotalDifference'},
}

def shares(value):
    if value is None or isinstance(value, bool):
        return None
    value = str(value).strip().replace(',', '')
    return int(value) if re.fullmatch(r'[+-]?\d+', value) else None


def parse(payload, market, today=None, min_rows=300):
    today = today or dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).date()
    if market == '上市':
        if not isinstance(payload, dict) or payload.get('stat') != 'OK':
            raise ValueError('TWSE report unavailable')
        fields = payload.get('fields', [])
        if len(fields) != len(set(fields)) or not set(FIELDS[market].values()).issubset(fields):
            raise ValueError('TWSE schema changed')
        rows = [dict(zip(fields, values)) for values in payload.get('data', []) if len(values) == len(fields)]
        report_date = date(payload.get('date'))
    else:
        if not isinstance(payload, list) or not payload:
            raise ValueError('TPEx report unavailable')
        rows = payload
        dates = {date(row.get('Date')) for row in rows}
        if len(dates) != 1 or None in dates:
            raise ValueError('Mixed or missing TPEx dates')
        report_date = dates.pop()
    if not report_date or not 0 <= (today - dt.date.fromisoformat(report_date)).days <= 7:
        raise ValueError('Stale, invalid or future report')
    result = {}
    complete = 0
    for row in rows:
        if not set(FIELDS[market].values()).issubset(row):
            raise ValueError('Missing institutional columns')
        code = str(row[FIELDS[market]['code']]).strip()
        if not re.fullmatch(r'\d{4,6}[A-Z]?', code):
            continue
        if code in result:
            raise ValueError('Duplicate stock code')
        entry = {key: shares(row[field]) for key, field in FIELDS[market].items() if key != 'code'}
        if all(value is not None for value in entry.values()):
            # Foreign dealers are already in dealers; never add them a second time.
            if entry['foreign'] + entry['trust'] + entry['dealer'] != entry['total']:
                raise ValueError('Institutional total does not reconcile')
            complete += 1
        result[code] = entry
    if len(result) < min_rows or complete < min_rows * .8:
        raise ValueError('Insufficient institutional coverage')
    return {'date': report_date, 'rows': result}


def merge_history(previous, session):
    sessions = {item['date']: item for item in previous}
    if sessions and session['date'] < max(sessions):
        raise ValueError('Older source would regress market snapshot')
    sessions[session['date']] = session
    return [sessions[key] for key in sorted(sessions)[-60:]]


def fetch_market(market):
    req = urllib.request.Request(SOURCES[market], headers={'User-Agent': 'QingyuResearch/1.0', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as response:
        return parse(json.load(response), market)


def main():
    payload = json.loads(OUT.read_text()) if OUT.exists() else {'version': 1, 'markets': {}}
    errors, success = {}, 0
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        futures = {executor.submit(fetch_market, market): market for market in SOURCES}
        for future in concurrent.futures.as_completed(futures):
            market = futures[future]
            try:
                session = future.result()
                prior = payload['markets'].get(market, {}).get('sessions', [])
                payload['markets'][market] = {'source': SOURCES[market], 'sessions': merge_history(prior, session)}
                print(market, session['date'], len(session['rows']))
                success += 1
            except Exception as error:
                errors[market] = str(error)
                print('WARNING', market, error)
    if not success:
        raise RuntimeError('Both institutional feeds failed; previous file preserved')
    payload['meta'] = {'updated_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'unit': 'shares', 'errors': errors,
                       'note': '外資不含外資自營商；自營商含外資自營商。每日累積最多60期；沒有資料不等於0。'}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    temporary = OUT.with_suffix('.tmp')
    temporary.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')))
    temporary.replace(OUT)

if __name__ == '__main__':
    main()
