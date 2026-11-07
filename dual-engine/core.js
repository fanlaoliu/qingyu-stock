/* Versioned point-in-time research contract. No network, model execution or trades. */
(function(root){
'use strict';
const DAY=86400000,F=v=>typeof v==='number'&&Number.isFinite(v),check=(b,m)=>{if(!b)throw Error(m);};
const iso=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
const url=s=>{try{const u=new URL(s);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const timestamp=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(s)&&iso(s.slice(0,10))&&Number.isFinite(Date.parse(s));
const avg=a=>a.reduce((a,b)=>a+b,0)/a.length,median=a=>{const x=[...a].sort((a,b)=>a-b);return x.length?(x[(x.length-1)>>1]+x[x.length>>1])/2:null;};
const money=['revenue','netIncome','equityStart','equityEnd','ocf','capex','operatingProfit','grossProfit','nopat','averageInvestedCapital','netDebt','ebitda','currentAssets','currentLiabilities','inventory','receivables','fcfe','bookEquity','coreProfit','consensusEps','managementEps','eps'];
const UNITS=Object.freeze({...Object.fromEntries(money.map(k=>[k,k.toLowerCase().includes('eps')||k==='eps'?'TWD/share':'TWD'])),shares:'shares',wacc:'%',dividendPerShare:'TWD/share'});
function validate(input){
 check(input?.version===1&&input.kind==='dual-expert-research'&&Array.isArray(input.sources)&&input.sources.length<=10000&&Array.isArray(input.records)&&input.records.length<=3000,'研究檔須為version 1、dual-expert-research；來源≤10000、公司≤3000');
 const sources=new Map();for(const s of input.sources){check(s&&typeof s.id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(s.id)&&!sources.has(s.id)&&url(s.url)&&typeof s.license==='string'&&s.license.trim().length>0&&s.license.length<=1000&&['confirmed','unverified'].includes(s.authorization),'來源ID、HTTPS或授權聲明不符');sources.set(s.id,{id:s.id,url:url(s.url),license:s.license,authorization:s.authorization,verification:s.verification==='document-checked'?'document-checked':'provider-declared'});}
 const seen=new Set();
 const records=input.records.map(r=>{
  check(r&&/^[1-9]\d{3}$/.test(r.code)&&['上市','上櫃'].includes(r.market)&&!seen.has(r.market+':'+r.code),'普通股代碼、市場或重複公司不符');seen.add(r.market+':'+r.code);
  check(['general','financial','insurance','construction','cyclical','capital-intensive'].includes(r.model),'產業模型不符');
  check(Array.isArray(r.observations)&&r.observations.length<=2000&&Array.isArray(r.bars)&&r.bars.length<=6000&&Array.isArray(r.flows)&&r.flows.length<=6000,'觀察、行情或法人筆數不符');
  const ids=new Set();const observations=r.observations.map(o=>{
   check(o&&typeof o.id==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(o.id)&&!ids.has(o.id)&&UNITS[o.key]&&o.unit===UNITS[o.key]&&['annual','TTM','daily','forecast'].includes(o.basis)&&iso(o.periodStart)&&iso(o.periodEnd)&&o.periodStart<=o.periodEnd&&iso(o.publishedAt)&&timestamp(o.obtainedAt)&&sources.has(o.sourceId)&&['ok','missing','unverified'].includes(o.status)&&(o.value===null||F(o.value)&&Math.abs(o.value)<=1e18),'觀察欄位、單位、期間、來源或重複ID不符');
   check(o.basis==='forecast'||o.publishedAt>=o.periodEnd,'已實現財報不可在期末前公告');
   if(['annual','TTM'].includes(o.basis)){const days=(Date.parse(o.periodEnd)-Date.parse(o.periodStart))/DAY;check(days>=350&&days<=380,'annual／TTM須有完整一年起迄；不可將累計EPS當TTM');}
   check(o.basis!=='annual'||o.periodStart.slice(5)==='01-01'&&o.periodEnd.slice(5)==='12-31'&&o.periodStart.slice(0,4)===o.periodEnd.slice(0,4),'年度資料目前僅支援曆年制');
   ids.add(o.id);return {...o};
  });
  check(Array.isArray(r.calendar)&&r.calendar.length<=10000&&r.calendar.every((d,i)=>iso(d)&&(!i||d>r.calendar[i-1])),'交易所日曆需嚴格遞增且不可重複');
  if(r.bars.length)check(sources.has(r.barSourceId)&&timestamp(r.marketObtainedAt),'行情須記錄來源與實際取得時間');
  if(r.flows.length)check(sources.has(r.flowSourceId)&&timestamp(r.flowObtainedAt),'法人須記錄來源與實際取得時間');
  if(r.quote)check(iso(r.quote.date)&&F(r.quote.close)&&r.quote.close>0&&sources.has(r.quote.sourceId),'報價日期、價格或來源錯誤');
  let prev='';const bars=r.bars.map(b=>{check(b&&iso(b.date)&&b.date>prev&&['open','high','low','close','volume','amount'].every(k=>F(b[k]))&&Math.min(b.open,b.low,b.high,b.close)>0&&b.low<=Math.min(b.open,b.close)&&b.high>=Math.max(b.open,b.close)&&b.close<=1e9&&b.volume>=0&&b.amount>=0&&b.volume<=1e18&&b.amount<=1e18,'行情日期、OHLC或成交量值不符');prev=b.date;return {...b};});
  prev='';const flows=r.flows.map(f=>{check(f&&iso(f.date)&&f.date>prev&&['foreign','trust','dealer','total'].every(k=>f[k]===null||Number.isSafeInteger(f[k]))&&(!['foreign','trust','dealer','total'].every(k=>F(f[k]))||f.foreign+f.trust+f.dealer===f.total),'法人日期、單位或合計錯誤');prev=f.date;return {...f};});
  const claims=(r.claims||[]).map(c=>{check(c&&['confirmed_fact','management_outlook','analyst_assumption','ai_inference'].includes(c.type)&&typeof c.text==='string'&&c.text.length<=2000&&['high','medium','low'].includes(c.confidence)&&Array.isArray(c.evidenceIds)&&c.evidenceIds.every(id=>ids.has(id))&&(!['confirmed_fact','management_outlook'].includes(c.type)||c.evidenceIds.length>0),'研究論點類型、證據ID或可信度錯誤');return {...c};});
  return {code:r.code,market:r.market,name:String(r.name||r.code).slice(0,80),industry:String(r.industry||'未分類').slice(0,80),model:r.model,observations,bars,flows,claims,quote:r.quote?{date:r.quote.date,close:r.quote.close,sourceId:r.quote.sourceId}:null,barSourceId:r.barSourceId||null,flowSourceId:r.flowSourceId||null,marketObtainedAt:r.marketObtainedAt||null,flowObtainedAt:r.flowObtainedAt||null,calendar:[...r.calendar]};
 });
 const benchmark=input.benchmark||[];check(Array.isArray(benchmark)&&benchmark.length<=10000&&benchmark.every((p,i)=>iso(p.date)&&F(p.close)&&p.close>0&&(!i||p.date>benchmark[i-1].date)),'基準日期或價格錯誤');return {version:1,kind:'dual-expert-research',sources:[...sources.values()],records,benchmark,synthetic:input.synthetic===true};
}
function observation(record,key,basis,asOf,pack,end){
 const sourceMap=new Map(pack.sources.map(s=>[s.id,s]));
 return record.observations.filter(o=>o.key===key&&o.basis===basis&&o.publishedAt<=asOf&&o.periodEnd<=(basis==='forecast'?'9999-12-31':asOf)&&Date.parse(o.obtainedAt)<=Date.parse(asOf+'T23:59:59.999+08:00')&&o.status==='ok'&&F(o.value)&&sourceMap.get(o.sourceId)?.authorization==='confirmed'&&(!end||o.periodEnd===end)).sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd)||b.publishedAt.localeCompare(a.publishedAt))[0]||null;
}
function annuals(record,asOf,pack){
 const revenues=[...new Set(record.observations.filter(o=>o.key==='revenue'&&o.basis==='annual').map(o=>o.periodEnd))].sort().reverse().map(end=>observation(record,'revenue','annual',asOf,pack,end)).filter(Boolean);
 const recent=revenues.slice(0,4),consecutive=recent.length===4&&recent.every((o,i)=>i===0||+recent[i-1].periodEnd.slice(0,4)-+o.periodEnd.slice(0,4)===1);
 const years=recent.slice(0,3).map(rev=>{const get=k=>observation(record,k,'annual',asOf,pack,rev.periodEnd),n=get('netIncome'),begin=get('equityStart'),end=get('equityEnd'),ocf=get('ocf'),capex=get('capex');return {end:rev.periodEnd,revenue:rev.value,netIncome:n?.value??null,roe:n&&begin&&end&&begin.value>0&&end.value>0?n.value/((begin.value+end.value)/2)*100:null,fcf:ocf&&capex&&capex.value>=0?ocf.value-capex.value:null,ids:[rev,n,begin,end,ocf,capex].filter(Boolean).map(x=>x.id)};});
 const ready=consecutive&&Date.parse(asOf)-Date.parse(recent[0].periodEnd)<=550*DAY;
 return {years,ready,revenueIds:recent.map(o=>o.id),cagr:ready&&recent[3].value>0&&recent[0].value>0?((recent[0].value/recent[3].value)**(1/3)-1)*100:null,profitable:ready&&years.every(y=>y.netIncome!==null)?years.filter(y=>y.netIncome>0).length:null,roeMedian:ready&&years.every(y=>y.roe!==null)?median(years.map(y=>y.roe)):null,fcf3:ready&&years.every(y=>y.fcf!==null)?years.reduce((s,y)=>s+y.fcf,0):null};
}
function indicators(input,asOf){
 const bars=input.filter(b=>b.date<=asOf),out=[];let ema12=null,ema26=null,dea=null;
 for(let i=0;i<bars.length;i++){const b=bars[i],close=b.close,point={...b};
  for(const n of [5,10,20,60,120,240])point['ma'+n]=i+1>=n?avg(bars.slice(i+1-n,i+1).map(b=>b.close)):null;
  ema12=i===11?avg(bars.slice(0,12).map(b=>b.close)):i>11?close*2/13+ema12*11/13:null;
  ema26=i===25?avg(bars.slice(0,26).map(b=>b.close)):i>25?close*2/27+ema26*25/27:null;
  point.macd=ema12!==null&&ema26!==null?ema12-ema26:null;
  if(i===33)dea=avg(out.slice(25,33).map(p=>p.macd).concat(point.macd));else if(i>33)dea=point.macd*.2+dea*.8;
  point.signal=dea;point.histogram=point.macd!==null&&dea!==null?point.macd-dea:null;
  if(i>=14){const changes=bars.slice(i-14,i+1).slice(1).map((p,j)=>p.close-bars[i-14+j].close),up=changes.reduce((s,d)=>s+Math.max(0,d),0),down=changes.reduce((s,d)=>s+Math.max(0,-d),0);point.rsi=up+down===0?50:100*up/(up+down);}else point.rsi=null;
  if(i>=8){const w=bars.slice(i-8,i+1),hi=Math.max(...w.map(p=>p.high)),lo=Math.min(...w.map(p=>p.low)),rsv=hi===lo?50:(close-lo)/(hi-lo)*100;point.k=(out.at(-1)?.k??50)*2/3+rsv/3;point.d=(out.at(-1)?.d??50)*2/3+point.k/3;}else{point.k=null;point.d=null;}
  point.volumeRatio=i>=20&&avg(bars.slice(i-20,i).map(b=>b.volume))>0?b.volume/avg(bars.slice(i-20,i).map(b=>b.volume)):null;
  point.avgAmount60=i>=59?avg(bars.slice(i-59,i+1).map(p=>p.amount)):null;
  const prior=bars.slice(Math.max(0,i-20),i);point.resistance=prior.length===20?Math.max(...prior.map(p=>p.high)):null;point.support=prior.length===20?Math.min(...prior.map(p=>p.low)):null;
  point.atr=i>=14?avg(bars.slice(i-13,i+1).map((p,j)=>Math.max(p.high-p.low,Math.abs(p.high-bars[i-14+j].close),Math.abs(p.low-bars[i-14+j].close)))):null;
  point.momentum60=i>=60?(close/bars[i-60].close-1)*100:null;
  out.push(point);
 }
 return out;
}
function aggregate(bars,unit){check(['daily','weekly','monthly'].includes(unit),'K線週期錯誤');if(unit==='daily')return bars.map(b=>({...b,startDate:b.date}));const map=new Map();for(const b of bars){let key=b.date.slice(0,7);if(unit==='weekly'){const t=new Date(b.date+'T00:00:00Z'),offset=(t.getUTCDay()+6)%7;t.setUTCDate(t.getUTCDate()-offset);key=t.toISOString().slice(0,10);}let a=map.get(key);if(!a){a={...b,startDate:b.date,count:0};map.set(key,a);}a.high=Math.max(a.high,b.high);a.low=Math.min(a.low,b.low);a.close=b.close;a.date=b.date;if(a.count){a.volume+=b.volume;a.amount+=b.amount;}a.count++;for(const n of [5,10,20,60,120,240])if(b['ma'+n]!==undefined)a['ma'+n]=b['ma'+n];}return [...map.values()];}
function technical(record,asOf,benchmark=[]){
 const all=indicators(record.bars,asOf),p=all.at(-1),prior=all.at(-2);if(!p)return {latest:null,signals:[],series:[]};
 const signals=[],add=(id,bias,text)=>signals.push({id,bias,text,date:p.date,confirmation:'待後續收盤與基本面／估值核對'});
 if([p.ma5,p.ma10,p.ma20,p.ma60].every(F)){if(p.ma5>p.ma10&&p.ma10>p.ma20&&p.ma20>p.ma60)add('bull-stack','偏多','MA5＞MA10＞MA20＞MA60');if(p.ma5<p.ma10&&p.ma10<p.ma20&&p.ma20<p.ma60)add('bear-stack','偏空','MA5＜MA10＜MA20＜MA60');}
 if(prior?.ma20!==null&&F(prior?.ma20)&&F(p.ma20)){if(prior.close<=prior.ma20&&p.close>p.ma20)add('cross-up','偏多','收盤由MA20下方轉至上方');if(prior.close>=prior.ma20&&p.close<p.ma20)add('cross-down','偏空','收盤由MA20上方轉至下方');}
 if(p.resistance!==null&&p.close>p.resistance&&p.volumeRatio>=1.5)add('volume-breakout','偏多','收盤突破先前20日高點且量比≥1.5倍');
 if(prior?.resistance!==null&&F(prior?.resistance)&&prior.close>prior.resistance&&p.close<prior.resistance)add('failed-breakout','風險','前日突破、今日收回突破前20日高點以下');
 if(p.rsi>=75||p.ma20>0&&p.close/p.ma20>=1.15)add('overheat','風險','RSI≥75或高於MA20達15%');
 if(prior?.rsi<30&&p.rsi>=30&&p.close>prior.close)add('stabilizing','觀察','RSI由30以下回到30以上且收盤上升；僅止跌候選');
 if(all.length>=11){const a=all.at(-11);if(p.close>a.close&&p.volume<a.volume*.7)add('price-volume-divergence','風險','10日前後比較：價格上升、成交量減少≥30%');if(a.histogram<0&&p.histogram>=0&&F(p.histogram))add('momentum-turn','觀察','MACD柱由負轉非負（10日對照）');}
 const index=benchmark.filter(b=>b.date<=p.date),ib=index.find(b=>b.date===p.date),before=all.at(-61),bb=before&&index.find(b=>b.date===before.date);p.relativeStrength60=ib&&bb&&before?(p.close/before.close-ib.close/bb.close)*100:null;
 const used=record.bars.filter(b=>b.date<=asOf).slice(-60),cal=record.calendar.filter(d=>d<=p.date).slice(-60),continuous=used.length===60&&cal.length===60&&used.every((b,i)=>b.date===cal[i]);
 return {latest:p,signals,series:all,continuous,warning:'RSI14採簡單均值；MACD為EMA12−EMA26及EMA9，KD為9日RSV、初值50、2/3平滑。未還原股價；除權息／分割可能影響訊號。'};
}
function chips(record,asOf){
 const calendar=record.calendar.filter(d=>d<=asOf),last=calendar.at(-1),map=new Map(record.flows.filter(f=>f.date<=asOf).map(f=>[f.date,f]));
 const result={date:last,windows:{},streak:{},warning:'法人淨買賣超是流量，不等於主力吸籌；ETF被動調整與基本面驅動尚無分類資料。'};
 for(const n of [5,20,60]){const dates=calendar.slice(-n);result.windows[n]=dates.length===n?Object.fromEntries(['foreign','trust','dealer','total'].map(k=>[k,dates.every(d=>F(map.get(d)?.[k]))?dates.reduce((s,d)=>s+map.get(d)[k],0):null])):null;}
 for(const k of ['foreign','trust']){let count=0,sign=null;for(const d of [...calendar].reverse()){const f=map.get(d);if(!f||!F(f[k]))break;if(sign===null)sign=Math.sign(f[k]);if(sign===0||Math.sign(f[k])!==sign)break;count++;}result.streak[k]={count,sign,exact:false};}
 const recent=map.get(last);result.synchronized=recent&&F(recent.foreign)&&F(recent.trust)?recent.foreign>0&&recent.trust>0:null;result.opposed=recent&&F(recent.foreign)&&F(recent.trust)?recent.foreign*recent.trust<0:null;return result;
}
root.QingyuDualCore=Object.freeze({DAY,F,check,iso,url,avg,median,UNITS,validate,observation,annuals,indicators,aggregate,technical,chips});
})(globalThis);
