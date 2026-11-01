"""Official general-industry statements, original units and fields preserved."""
import concurrent.futures,datetime as dt,json,re
from pathlib import Path
from update_data import fetch,date
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'data/statements.json'
SOURCES={f'{market}:{kind}':base+path for market,base,paths in [('上市','https://openapi.twse.com.tw/v1/opendata/',{'income':'t187ap06_L_ci','balance':'t187ap07_L_ci'}),('上櫃','https://www.tpex.org.tw/openapi/v1/',{'income':'mopsfin_t187ap06_O_ci','balance':'mopsfin_t187ap07_O_ci'})]for kind,path in paths.items()}
def parse(rows,key,now):
    if not isinstance(rows,list)or not rows:raise ValueError('Empty source')
    market,kind=key.split(':');out=[];seen=set();today=dt.datetime.fromisoformat(now).date()
    required=['營業收入','本期淨利（淨損）']if kind=='income'else['資產總計','負債總計','權益總計']
    for r in rows:
        code=str(r.get('公司代號',r.get('SecuritiesCompanyCode','')));year=int(r.get('年度',r.get('Year',0)));year=year+1911 if year<1911 else year;q=int(r.get('季別',r.get('Season',0)))
        if not re.fullmatch('[1-9][0-9]{3}',code)or q not in (1,2,3,4)or any(k not in r for k in required):raise ValueError('Statement schema mismatch')
        end=dt.date(year,q*3,31 if q in (1,4)else 30);report=date(r.get('出表日期',r.get('Date')))
        if not report or not end<=dt.date.fromisoformat(report)<=today or code in seen:raise ValueError('Invalid period or duplicate')
        seen.add(code);out.append({'code':code,'market':market,'kind':kind,'periodEnd':end.isoformat(),'reportDate':report,'observedAt':now,'source':SOURCES[key],'unit':'official-original-unit-unverified','fields':{str(k):str(v)for k,v in r.items()}})
    return out

def update(prior,results,now):
    records=[];errors={}
    for key in SOURCES:
        try:records.extend(parse(results[key],key,now))
        except Exception:
            errors[key]='Source unavailable or schema invalid'
            market,kind=key.split(':');records.extend(r for r in prior.get('records',[])if r['market']==market and r['kind']==kind)
    if len(errors)==4:raise ValueError('All sources failed; prior preserved')
    return {'version':1,'kind':'official-statements','meta':{'updatedAt':now,'errors':errors,'license':'https://data.gov.tw/license','note':'General industry only; raw units and income duration not verified. No cash-flow source connected.'},'records':records}
def main():
    prior=json.loads(OUT.read_text())if OUT.exists()else{'records':[]};results={};now=dt.datetime.now(dt.timezone.utc).isoformat()
    with concurrent.futures.ThreadPoolExecutor(max_workers=4)as pool:
        tasks={pool.submit(fetch,url):key for key,url in SOURCES.items()}
        for task in concurrent.futures.as_completed(tasks):
            try:results[tasks[task]]=task.result()
            except Exception:pass
    result=update(prior,results,now);temp=OUT.with_suffix('.tmp');temp.write_text(json.dumps(result,ensure_ascii=False));temp.replace(OUT);print('Statements:',len(result['records']),'errors:',result['meta']['errors'])
if __name__=='__main__':main()
