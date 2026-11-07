"""Fetch official EPS summaries without inventing TTM or publication dates."""
import concurrent.futures
import datetime as dt
import json
from pathlib import Path
import re
from update_data import fetch, date, numeric
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data/financial-summary.json'
SOURCES={'上市':'https://openapi.twse.com.tw/v1/opendata/t187ap14_L','上櫃':'https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap14_O'}

def parse(rows,market,observed_at):
    now=dt.datetime.fromisoformat(observed_at)
    if now.tzinfo is None or market not in SOURCES or not isinstance(rows,list) or not rows:
        raise ValueError('Invalid market, observation time or empty data')
    output=[];seen=set()
    for r in rows:
        code=str(r.get('公司代號',r.get('SecuritiesCompanyCode',''))).strip()
        year=str(r.get('年度',r.get('Year',''))).strip();quarter=str(r.get('季別','')).strip()
        if not re.fullmatch(r'[1-9]\d{3}',code) or not year.isdigit() or quarter not in ('1','2','3','4'):
            raise ValueError('Unexpected EPS identifier or period')
        year=int(year);year=year+1911 if year<1911 else year
        q=int(quarter);end=dt.date(year, q*3, (31 if q in (1,4) else 30))
        report=date(r.get('出表日期',r.get('Date')))
        if not report or not end<=dt.date.fromisoformat(report)<=now.astimezone(dt.timezone(dt.timedelta(hours=8))).date():
            raise ValueError('Invalid report date')
        key=(code,year,q)
        if key in seen:raise ValueError('Duplicate financial period')
        seen.add(key)
        raw=r.get('基本每股盈餘(元)',r.get('基本每股盈餘'))
        eps=numeric(raw)
        if eps is None and str(raw).strip() not in ('','--','-','N/A','不適用','None'):
            raise ValueError('Invalid EPS value')
        output.append({'code':code,'market':market,'name':str(r.get('公司名稱',r.get('CompanyName','')))[:100],
            'periodEnd':end.isoformat(),'year':year,'quarter':q,'eps':eps,'epsBasis':'official-reported-not-TTM',
            'unit':'TWD/share','reportDate':report,'publishedAt':None,'observedAt':observed_at,'source':SOURCES[market]})
    return output

def update(previous,results,observed_at):
    records=[];errors={}
    for market in SOURCES:
        try:records.extend(parse(results[market],market,observed_at))
        except Exception as e:
            errors[market]=type(e).__name__+': source unavailable or schema invalid'
            records.extend(r for r in previous.get('records',[]) if r['market']==market)
    if len(errors)==len(SOURCES):raise ValueError('All EPS sources failed; preserving previous file')
    return {'version':1,'kind':'official-eps-summary','meta':{'updatedAt':observed_at,'errors':errors,'license':'https://data.gov.tw/license','datasets':['https://data.gov.tw/dataset/20756','https://data.gov.tw/dataset/20757'],'note':'Partial-company official EPS summary, not TTM. Report date is not publication date.'},'records':records}

def main():
    prior=json.loads(OUT.read_text()) if OUT.exists() else {'records':[]}
    now=dt.datetime.now(dt.timezone.utc).isoformat();results={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        pending={pool.submit(fetch,url):market for market,url in SOURCES.items()}
        for task in concurrent.futures.as_completed(pending):
            try:results[pending[task]]=task.result()
            except Exception:pass
    payload=update(prior,results,now);OUT.parent.mkdir(parents=True,exist_ok=True)
    temp=OUT.with_suffix('.tmp');temp.write_text(json.dumps(payload,ensure_ascii=False,allow_nan=False));temp.replace(OUT)
    print('Saved EPS summaries:',len(payload['records']),'source errors:',list(payload['meta']['errors']))
if __name__=='__main__':main()
