#!/usr/bin/env python3
"""Fetch official end-of-day TWSE/TPEx snapshots. No API keys required.
Fails safely: never overwrites a valid snapshot if both official sources fail.
Usage: python scripts/update_data.py
"""
import datetime as dt
import json
import pathlib
import re
import urllib.request

ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'data'/'stocks.json'
URLS={
 'twse_price':'https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL',
 'twse_valuation':'https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL',
 'twse_revenue':'https://openapi.twse.com.tw/v1/opendata/t187ap05_L',
 'tpex_price':'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes',
 'tpex_valuation':'https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis',
}
def fetch(url):
 req=urllib.request.Request(url,headers={'User-Agent':'QingyuResearch/1.0 (+research demo)','Accept':'application/json'})
 with urllib.request.urlopen(req,timeout=35) as res:
  data=json.load(res)
 if not isinstance(data,list): raise ValueError('Expected list response')
 return data

def value(row,*keys):
 for key in keys:
  if key in row and row[key] is not None:return str(row[key]).strip()
 return ''
def numeric(s):
 s=str(s or '').strip().replace(',','').replace('%','')
 if not s or s in ('--','-','N/A','除零','不適用','—'):return None
 try:
  v=float(s)
  return round(v,4) if v==v and abs(v)!=float('inf') else None
 except ValueError:return None

def date(s):
 s=re.sub(r'[^0-9]','',str(s or ''))
 if len(s)==7:return f'{int(s[:3])+1911:04d}-{s[3:5]}-{s[5:7]}'
 if len(s)==8:return f'{s[:4]}-{s[4:6]}-{s[6:8]}'
 return None

def code(row):
 c=value(row,'Code','SecuritiesCompanyCode','SecuritiesCode','股票代號','公司代號','證券代號')
 return c if re.fullmatch(r'\d{4,6}',c) else None

def main():
 results={};errors={}
 for key,url in URLS.items():
  try:results[key]=fetch(url);print(key,len(results[key]))
  except Exception as exc:errors[key]=str(exc);print('WARNING',key,str(exc))
 stocks={}
 for row in results.get('twse_price',[]):
  c=code(row)
  if not c:continue
  stocks[c]=dict(code=c,name=value(row,'Name','證券名稱'),market='上市',price=numeric(value(row,'ClosingPrice','收盤價')),pe=None,pb=None,yield_=None,yoy=None,date=date(value(row,'Date','日期')))
 for row in results.get('tpex_price',[]):
  c=code(row)
  if not c or c in stocks:continue
  stocks[c]=dict(code=c,name=value(row,'CompanyName','Name','證券名稱'),market='上櫃',price=numeric(value(row,'Close','ClosingPrice')),pe=None,pb=None,yield_=None,yoy=None,date=date(value(row,'Date')))
 for key in ('twse_valuation','tpex_valuation'):
  for row in results.get(key,[]):
   c=code(row)
   if not c or c not in stocks:continue
   s=stocks[c]
   s['pe']=numeric(value(row,'PEratio','PERatio','P/E','本益比'))
   s['pb']=numeric(value(row,'PBratio','PBRatio','P/B','股價淨值比'))
   s['yield_']=numeric(value(row,'DividendYield','Yield','殖利率(%)','殖利率'))
 # Monthly revenue: use only explicit YoY field; never confuse MoM and YoY.
 # Revenue sources have distinct period dates; keep revenue period separate from quote date.
 for row in results.get('twse_revenue',[]):
  c=code(row)
  if not c or c not in stocks:continue
  yoy=numeric(value(row,'營業收入-去年同月增減(%)','營業收入-去年同月增減（%）','去年同月增減(%)'))
  if yoy is not None:stocks[c]['yoy']=yoy
 if not stocks:raise RuntimeError('No official price data; existing snapshot preserved. '+json.dumps(errors,ensure_ascii=False))
 clean=[]
 for s in stocks.values():
  clean.append({'code':s['code'],'name':s['name'],'market':s['market'],'price':s['price'],'pe':s['pe'],'pb':s['pb'],'yield':s['yield_'],'yoy':s['yoy'],'date':s['date']})
 dates=[s['date'] for s in clean if s['date']]
 now=dt.datetime.now(dt.timezone.utc).astimezone(dt.timezone(dt.timedelta(hours=8)))
 payload={'meta':{'mode':'official','trade_date':max(dates) if dates else None,'updated_at':now.strftime('%Y-%m-%d %H:%M UTC+08:00'),'sources':[k for k in results if k in ('twse_price','tpex_price')],'source_details':list(results),'errors':errors,'note':'Official EOD snapshot; missing values null; revenue YoY is latest reported month, not necessarily quote date.'},'stocks':sorted(clean,key=lambda x:x['code'])}
 tmp=OUT.with_suffix('.tmp');tmp.write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':')),encoding='utf-8');tmp.replace(OUT)
 print('Saved',len(clean),'records to',OUT)
if __name__=='__main__':main()
