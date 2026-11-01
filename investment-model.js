/* Pure calculations. Imported data stays local; no network or model calls. */
(function(root){
 'use strict';
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
 const code=v=>typeof v==='string'&&/^\d{4,6}[A-Z]?$/.test(v);
 const check=(ok,message)=>{if(!ok)throw Error(message);};
 const url=v=>{try{const u=new URL(v);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}};
 const optional=(v,key)=>{check(v===null||finite(v),'欄位 '+key+' 須為數字或null');return v;};
 function financials(input){
  check(input?.version===1&&Array.isArray(input.records)&&input.records.length<=5000,'財務資料須為version 1、records最多5000筆');
  const seen=new Set();
  return input.records.map(r=>{
   check(r&&code(r.code)&&date(r.periodEnd)&&date(r.publishedAt)&&r.publishedAt>=r.periodEnd&&date(r.epsPeriodEnd)&&r.epsPeriodEnd===r.periodEnd&&r.epsBasis==='TTM'&&url(r.source),'財務代號、日期、TTM期間或HTTPS來源不符');
   const id=r.code+':'+r.periodEnd+':'+r.publishedAt;check(!seen.has(id),'重複財務紀錄');seen.add(id);
   const out={code:r.code,periodEnd:r.periodEnd,publishedAt:r.publishedAt,epsPeriodEnd:r.epsPeriodEnd,epsBasis:'TTM',source:url(r.source),unit:'TWD',cashFlowUnit:'TWD'};
   check(r.unit==='TWD'&&r.cashFlowUnit==='TWD','EPS及現金流單位須明列TWD');
   for(const k of ['eps','roe','operatingCashFlow','netIncome','debtRatio'])out[k]=optional(r[k],k);
   check(out.debtRatio===null||out.debtRatio>=0&&out.debtRatio<=100,'負債比須介於0與100');
   return out;
  });
 }
 function latestFinancial(records,stock){return records.filter(r=>r.code===stock.code&&r.publishedAt<=stock.date).sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd)||b.publishedAt.localeCompare(a.publishedAt))[0]||null;}
 function quality(r){
  if(!r)return {checks:[],missing:['未匯入截至行情日已公開的財報']};
  const checks=[],missing=[];
  for(const [k,label,pass] of [['roe','ROE至少15%',v=>v>=15],['debtRatio','負債比不超過50%',v=>v<=50],['operatingCashFlow','營業現金流為正',v=>v>0]]){
   if(!finite(r[k]))missing.push(label+'：缺資料');else checks.push({label,pass:pass(r[k])});
  }
  if(!finite(r.netIncome)||!finite(r.operatingCashFlow)||r.netIncome<=0)missing.push('現金轉換比：缺值或淨利非正');
  else checks.push({label:'營業現金流／同期淨利至少1倍',pass:r.operatingCashFlow/r.netIncome>=1});
  return {checks,missing};
 }
 function valuation(price,eps,multiples,margin){
  check(finite(price)&&price>0&&finite(eps)&&eps>0,'股價及TTM EPS須為正數');
  check(Array.isArray(multiples)&&multiples.length===3&&multiples.every(x=>finite(x)&&x>0&&x<=200)&&multiples[0]<=multiples[1]&&multiples[1]<=multiples[2],'本益比須為遞增的三個正數且不超過200');
  check(finite(margin)&&margin>=0&&margin<100,'目標安全邊際須為0至小於100%');
  return multiples.map((pe,i)=>{const fair=eps*pe;check(finite(fair)&&fair>0,'估值數值超出範圍');return {scenario:['保守','基準','樂觀'][i],pe,fair,buyBelow:fair*(1-margin/100),margin:(1-price/fair)*100};});
 }
 function ledger(input){
  check(input?.version===1&&Array.isArray(input.transactions)&&input.transactions.length<=10000&&Array.isArray(input.alerts)&&input.alerts.length<=1000,'帳本格式不符');
  const ids=new Set();
  const transactions=input.transactions.map(t=>{
   check(t&&typeof t.id==='string'&&t.id.length>0&&t.id.length<=80&&!ids.has(t.id)&&code(t.code)&&date(t.date),'交易ID重複或日期／代號錯誤');ids.add(t.id);
   check(['buy','sell','dividend','split'].includes(t.type),'交易類型錯誤');
   check(finite(t.quantity)&&finite(t.price)&&finite(t.fee)&&finite(t.tax)&&t.quantity>=0&&t.price>=0&&t.fee>=0&&t.tax>=0,'交易數值須為非負數');
   check(!['buy','sell'].includes(t.type)||t.quantity>0&&t.price>0,'買賣股數及單價須為正');
   check(t.type!=='split'||t.quantity>0&&t.price===0&&t.fee===0&&t.tax===0,'分割以quantity記錄正倍數，其餘填0');
   check(t.type!=='dividend'||t.quantity===0,'股息以price記錄實收現金總額、quantity填0');
   return {id:t.id,code:t.code,date:t.date,type:t.type,quantity:t.quantity,price:t.price,fee:t.fee,tax:t.tax};
  });
  const alerts=input.alerts.map(a=>{check(a&&code(a.code)&&['above','below'].includes(a.direction)&&finite(a.price)&&a.price>0,'提醒格式錯誤');return {code:a.code,direction:a.direction,price:a.price};});
  // Stable same-day order is the entered order, including splits and dividends.
  transactions.sort((a,b)=>a.date.localeCompare(b.date));
  positions({version:1,transactions,alerts},[]);
  return {version:1,transactions,alerts};
 }
 function positions(book,stocks,asOf='9999-12-31'){
  const map=new Map();
  for(const t of book.transactions){
   if(t.date>asOf)continue;
   const p=map.get(t.code)||{code:t.code,quantity:0,cost:0,realized:0,dividends:0};
   if(t.type==='buy'){p.quantity+=t.quantity;p.cost+=t.quantity*t.price+t.fee+t.tax;}
   if(t.type==='sell'){
    check(t.quantity<=p.quantity+1e-9,'賣出超過持股：'+t.code);const allocated=p.cost*t.quantity/p.quantity;
    p.quantity-=t.quantity;p.cost-=allocated;p.realized+=t.quantity*t.price-t.fee-t.tax-allocated;
    if(Math.abs(p.quantity)<1e-9){p.quantity=0;p.cost=0;}
   }
   if(t.type==='split'){check(p.quantity>0,'分割前無持股');p.quantity*=t.quantity;}
   if(t.type==='dividend'){check(p.quantity>0,'配息時無持股');p.dividends+=t.price-t.fee-t.tax;}
   check([p.quantity,p.cost,p.realized,p.dividends].every(finite),'交易數值超出範圍');map.set(t.code,p);
  }
  const rows=[...map.values()].map(p=>{
   const stock=stocks.find(s=>s.code===p.code&&s.date===asOf),price=stock&&finite(stock.price)&&stock.price>0?stock.price:null;
   const value=p.quantity===0?0:price===null?null:price*p.quantity;
   return {...p,average:p.quantity?p.cost/p.quantity:null,price,value,unrealized:value===null?null:value-p.cost,industry:stock?.industry||'未分類',date:stock?.date||null};
  });
  const missing=rows.filter(p=>p.quantity>0&&p.value===null).map(p=>p.code),total=missing.length?null:rows.reduce((s,p)=>s+p.value,0);
  const industries=Object.create(null);for(const p of rows)if(p.value!==null)industries[p.industry]=(industries[p.industry]||0)+p.value;
  return {rows,total,missing,industries,realized:rows.reduce((s,p)=>s+p.realized,0),dividends:rows.reduce((s,p)=>s+p.dividends,0),concentration:total>0?Math.max(...rows.map(p=>p.value/total))*100:null};
 }
 function alerts(book,stocks,asOf){return book.alerts.map(a=>{const s=stocks.find(s=>s.code===a.code&&s.date===asOf);const price=s&&finite(s.price)&&s.price>0?s.price:null;return {...a,current:price,date:s?.date||null,triggered:price===null?null:a.direction==='above'?price>=a.price:price<=a.price};});}
 function research(stock,financial,chip){
  check(stock&&code(stock.code),'找不到股票');
  const endpoints=stock.market==='上市'?['https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL','https://openapi.twse.com.tw/v1/exchangeReport/BWIBBU_ALL','https://openapi.twse.com.tw/v1/opendata/t187ap05_L']:['https://www.tpex.org.tw/openapi/v1/tpex_mainboard_quotes','https://www.tpex.org.tw/openapi/v1/tpex_mainboard_peratio_analysis','https://www.tpex.org.tw/openapi/v1/mopsfin_t187ap05_O'];
  const facts=[['收盤價',stock.price,stock.date,stock.priceOrigin||stock.market+'官方行情'],['本益比',stock.pe,stock.valuationDate,stock.valuationOrigin||'來源未提供'],['月營收年增%',stock.yoy,stock.revenueMonth,stock.revenueOrigin||'來源未提供']].map(([label,value,period,source],i)=>({label,value:finite(value)?value:null,period:period||null,source,sourceUrl:endpoints[i]}));
  if(financial)facts.push({label:'TTM EPS',value:financial.eps,period:financial.periodEnd,source:financial.source,sourceUrl:financial.source});
  if(chip?.row)facts.push({label:'法人當日合計（股）',value:chip.row.total,period:chip.date,source:'TWSE／TPEx法人快照',sourceUrl:stock.market==='上市'?'https://www.twse.com.tw/rwd/zh/fund/T86?selectType=ALLBUT0999&response=json':'https://www.tpex.org.tw/openapi/v1/tpex_3insti_daily_trading'});
  const anomalies=[];if(finite(stock.yoy)&&Math.abs(stock.yoy)>=50)anomalies.push('單月營收年增幅度達50%，需核對基期與一次性因素。');
  if(financial&&financial.netIncome>0&&finite(financial.operatingCashFlow)&&financial.operatingCashFlow<0)anomalies.push('同期淨利為正、營業現金流為負，需查核應收及存貨。');
  if(chip?.usable&&chip.row?.foreign*chip.row?.trust<0)anomalies.push('外資與投信當日方向相反；不能據此判定吃貨或出貨。');
  const lines=['# '+stock.code+' '+stock.name+' 來源研究摘要','模式：本機規則摘要，未連接生成式AI。','行情日：'+stock.date,...facts.map(f=>'- '+f.label+'：'+(f.value??'缺資料')+'｜期間 '+(f.period||'未提供')+'｜來源 '+f.source+' '+f.sourceUrl),'## 待查核事件',...(anomalies.length?anomalies:['未觸發目前規則；不代表沒有風險。']),'## 反方與限制','估值依產業與景氣變動；營收成長不等於獲利成長。匯入來源為使用者提供，未自動驗證真實性。'];
  return {facts,anomalies,text:lines.join('\n')};
 }
 function answer(report,question){
  check(typeof question==='string'&&question.trim()&&question.length<=500,'問題請輸入1至500字');
  const topics=[[/估值|本益比|便宜/,['本益比']],[/營收|成長/,['月營收年增%']],[/獲利|財報|EPS/i,['TTM EPS']],[/法人|籌碼/,['法人當日合計（股）']],[/股價|價格/,['收盤價']]];
  const names=topics.filter(([re])=>re.test(question)).flatMap(([,keys])=>keys),facts=report.facts.filter(f=>names.includes(f.label));
  return facts.length?facts.map(f=>f.label+'：'+(f.value??'缺資料')+'，期間 '+(f.period||'未提供')+'，來源 '+f.source+' '+f.sourceUrl).join('\n')+'\n這是欄位檢索，不是AI推論或買賣建議。':'目前規則無法回答此問題，請查閱原始財報或匯出研究素材交由AI分析。';
 }
 function backtest(input,options={}){
  check(input?.version===1&&Array.isArray(input.bars)&&input.bars.length>=3&&input.bars.length<=10000&&url(input.source)&&input.adjustment==='total-return','回測須含3至10000筆、HTTPS來源及total-return調整價格');
  check(typeof input.code==='string'&&code(input.code),'回測代號錯誤');
  const fee=options.feeBps??14.25,tax=options.taxBps??30,slip=options.slippageBps??10,initial=options.initial??100000,split=options.split??0.7;
  check([fee,tax,slip].every(v=>finite(v)&&v>=0&&v<=500)&&finite(initial)&&initial>0&&initial<=1e12&&finite(split)&&split>=0.5&&split<=0.9,'回測成本、資金或樣本切分錯誤');
  let previous='';
  const bars=input.bars.map(b=>{check(date(b.date)&&b.date>previous&&finite(b.close)&&b.close>0&&b.close<1e12&&typeof b.signal==='boolean'&&date(b.knownAt)&&b.knownAt<=b.date,'回測日期、價格、signal或knownAt錯誤');previous=b.date;return b;});
  const strategy=options.strategy??'imported',lookback=options.lookback??20;
  check(['imported','sma'].includes(strategy)&&Number.isInteger(lookback)&&lookback>=2&&lookback<=250,'策略或均線期數錯誤');
  if(strategy==='sma')for(let i=0;i<bars.length;i++){const avg=i+1>=lookback?bars.slice(i+1-lookback,i+1).reduce((sum,b)=>sum+b.close,0)/lookback:null;bars[i]={...bars[i],signal:avg!==null&&bars[i].close>avg};}
  const costBuy=(fee+slip)/10000,costSell=(fee+tax+slip)/10000;
  function run(start,end){
   let cash=initial,qty=0,basis=0,peak=initial,drawdown=0,wins=0,trades=0;const curve=[];
   const exit=price=>{const proceeds=qty*price*(1-costSell);if(proceeds>basis)wins++;cash+=proceeds;qty=0;basis=0;trades++;};
   for(let i=start;i<end;i++){
    // The preceding bar's published signal executes at this bar's close.
    if(i>start){const signal=bars[i-1].signal;if(signal&&qty===0){basis=cash;qty=cash/(bars[i].close*(1+costBuy));cash=0;}else if(!signal&&qty>0)exit(bars[i].close);}
    if(i===end-1&&qty>0)exit(bars[i].close);
    const equity=cash+qty*bars[i].close;check(finite(equity)&&equity>=0,'回測資產數值超出範圍');peak=Math.max(peak,equity);drawdown=Math.min(drawdown,equity/peak-1);curve.push({date:bars[i].date,equity});
   }
   const final=curve.at(-1).equity,benchmark=initial/(bars[start].close*(1+costBuy))*bars[end-1].close*(1-costSell);
   return {start:bars[start].date,end:bars[end-1].date,returnPct:(final/initial-1)*100,maxDrawdownPct:Math.max(0,-drawdown*100),winRate:trades?wins/trades*100:null,trades,final,benchmarkPct:(benchmark/initial-1)*100,curve};
  }
  const cut=Math.floor(bars.length*split);check(cut>=2&&bars.length-cut>=2,'樣本內外各需至少2筆，請增加歷史資料');
  return {full:run(0,bars.length),inSample:run(0,cut),outOfSample:run(cut,bars.length),cutoff:bars[cut].date,assumptions:{feeBps:fee,taxBps:tax,slippageBps:slip,initial,split,source:input.source,code:input.code,strategy,lookback},input:{...input,bars:input.bars.map(b=>({...b}))},warning:'單一證券、'+(strategy==='sma'?'使用歷史均線訊號':'使用匯入訊號')+'；knownAt與總報酬調整為提供者聲明，無法自行證明沒有前視或倖存者偏誤。樣本外獨立起算，需凍結策略後再匯入驗證。'};
 }
 root.QingyuInvestment=Object.freeze({date,url,financials,latestFinancial,quality,valuation,ledger,positions,alerts,research,answer,backtest});
})(globalThis);
