(function(root){
 'use strict';const M=root.QingyuInvestment,finite=v=>typeof v==='number'&&Number.isFinite(v),check=(v,m)=>{if(!v)throw Error(m);};
 const fields={income:['revenue','grossProfit','operatingProfit','netIncome'],balance:['assets','liabilities','equity','currentAssets','currentLiabilities','cashStart','cashEnd'],cashFlow:['operating','investing','financing','fx','capex']};
 function validate(input){
  check(input?.version===1&&input.kind==='three-statements'&&Array.isArray(input.records)&&input.records.length<=2000,'請使用三大報表version 1格式');const seen=new Set();
  return input.records.map(r=>{
   check(r&&/^[1-9]\d{3}$/.test(r.code)&&M.date(r.periodStart)&&M.date(r.periodEnd)&&M.date(r.publishedAt)&&r.periodStart<r.periodEnd&&r.periodEnd<=r.publishedAt&&r.unit==='TWD'&&r.scope==='consolidated'&&r.durationBasis==='explicit-range','代號、期間、公告日、TWD或合併口徑不符');
   const id=[r.code,r.periodStart,r.periodEnd,r.publishedAt].join(':');check(!seen.has(id),'重複報表期間與公告版本');seen.add(id);
   const out={code:r.code,periodStart:r.periodStart,periodEnd:r.periodEnd,publishedAt:r.publishedAt,unit:r.unit,scope:r.scope,durationBasis:r.durationBasis,sources:{}};
   for(const group of Object.keys(fields)){check(M.url(r.sources?.[group]),'三張報表各需HTTPS原始來源');out.sources[group]=M.url(r.sources[group]);out[group]={};for(const k of fields[group]){const v=r[group]?.[k];check(v===null||finite(v),'欄位'+group+'.'+k+'須為數字或null');out[group][k]=v;}}
   const b=out.balance,c=out.cashFlow;for(const k of ['assets','liabilities','currentAssets','currentLiabilities','cashStart','cashEnd'])check(b[k]===null||b[k]>=0,'資產負債現金數值不可為負');check(c.capex===null||c.capex>=0,'資本支出請填正的現金支出');
   if([b.assets,b.liabilities,b.equity].every(finite))check(Math.abs(b.assets-b.liabilities-b.equity)<=Math.max(1,Math.abs(b.assets)*1e-6),'資產不等於負債加權益');
   if([b.cashStart,b.cashEnd,c.operating,c.investing,c.financing,c.fx].every(finite))check(Math.abs(b.cashEnd-b.cashStart-c.operating-c.investing-c.financing-c.fx)<=Math.max(1,Math.abs(b.cashEnd)*1e-6),'期初期末現金與現金流量無法調節');
   return out;
  });
 }
 const ratio=(a,b)=>finite(a)&&finite(b)&&b>0?a/b:null;
 function analyze(r){const i=r.income,b=r.balance,c=r.cashFlow;return {grossMargin:ratio(i.grossProfit,i.revenue),operatingMargin:ratio(i.operatingProfit,i.revenue),netMargin:ratio(i.netIncome,i.revenue),debtRatio:ratio(b.liabilities,b.assets),currentRatio:ratio(b.currentAssets,b.currentLiabilities),cashConversion:ratio(c.operating,i.netIncome),freeCashFlow:finite(c.operating)&&finite(c.capex)?c.operating-c.capex:null};}
 function available(records,code,asOf){check(M.date(asOf),'查詢日格式不符');return records.filter(r=>r.code===code&&r.publishedAt<=asOf).sort((a,b)=>b.periodEnd.localeCompare(a.periodEnd)||b.publishedAt.localeCompare(a.publishedAt));}
 function compare(a,b){check(a.periodEnd.slice(5)===b.periodEnd.slice(5)&&a.periodStart.slice(5)===b.periodStart.slice(5)&&Number(a.periodStart.slice(0,4))===Number(b.periodStart.slice(0,4))+1&&Number(a.periodEnd.slice(0,4))===Number(b.periodEnd.slice(0,4))+1,'比較須為前一年度相同起迄期間');return Object.fromEntries(fields.income.map(k=>[k,finite(a.income[k])&&finite(b.income[k])&&b.income[k]>0?(a.income[k]/b.income[k]-1)*100:null]));}
 function ttm(input,code,asOf){
  const records=validate({version:1,kind:'three-statements',records:input});
  const candidates=available(records,code,asOf),current=candidates[0];check(current,'截至該日尚無已公告三表');
  const year=Number(current.periodEnd.slice(0,4)),md=current.periodEnd.slice(5);
  check(current.periodStart===year+'-01-01'&&['03-31','06-30','09-30','12-31'].includes(md),'TTM僅支援曆年制且由1月1日起的累計／年度報表');
  const find=(start,end)=>candidates.find(r=>r.periodStart===start&&r.periodEnd===end);
  const prior=find((year-1)+'-01-01',(year-1)+'-'+md),annual=md==='12-31'?null:find((year-1)+'-01-01',(year-1)+'-12-31');
  if(md!=='12-31')check(prior&&annual,'缺少上一年度全年或上一年度同期累計報表，不能推導TTM');
  const used=annual?[current,annual,prior]:[current];
  // Continuity is required when all cash endpoints are supplied. Gaps remain explicit.
  if(annual){for(const [a,b]of [[current.balance.cashStart,annual.balance.cashEnd],[annual.balance.cashStart,prior.balance.cashStart]])if(finite(a)&&finite(b))check(Math.abs(a-b)<=Math.max(1,Math.abs(a)*1e-6),'跨期現金起點不連續，請核對報表版本或重編');}
  const flow={income:{},cashFlow:{}};
  for(const group of ['income','cashFlow'])for(const key of fields[group]){const values=used.map(r=>r[group][key]);const value=values.every(finite)?annual?values[0]+values[1]-values[2]:values[0]:null;check(value===null||finite(value),'TTM數值溢位');flow[group][key]=value;}
  check(flow.cashFlow.capex===null||flow.cashFlow.capex>=0,'TTM資本支出不合理，請核對跨期口徑');
  const start=annual?new Date(Date.parse(prior.periodEnd+'T00:00:00Z')+86400000).toISOString().slice(0,10):current.periodStart;
  const cashStart=annual?prior.balance.cashEnd:current.balance.cashStart,cashEnd=current.balance.cashEnd,c=flow.cashFlow;
  const cashReconciled=[cashStart,cashEnd,c.operating,c.investing,c.financing,c.fx].every(finite);
  if(cashReconciled)check(Math.abs(cashEnd-cashStart-c.operating-c.investing-c.financing-c.fx)<=Math.max(1,Math.abs(cashEnd)*1e-6),'TTM現金流無法調節');
  const b=current.balance,beginEquity=prior?.balance.equity;
  const averageEquity=finite(beginEquity)&&finite(b.equity)&&beginEquity>0&&b.equity>0?(beginEquity+b.equity)/2:null;
  const record={...current,periodStart:start,balance:{...b,cashStart,cashEnd},income:flow.income,cashFlow:flow.cashFlow};
  return {periodStart:start,periodEnd:current.periodEnd,asOf,method:annual?'本期累計＋上一年度全年−上一年度同期累計':'完整年度報表',record,metrics:{...analyze(record),roe:ratio(flow.income.netIncome,averageEquity)},averageEquity,cashReconciled,evidence:(annual?used:prior?[current,prior]:used).map(r=>({periodStart:r.periodStart,periodEnd:r.periodEnd,publishedAt:r.publishedAt,sources:r.sources})),notes:'ROE以TTM合併淨利除期初期末總權益平均；不是母公司普通股ROE。未推算EPS，不自動加入合理價或選股分數。'};
 }
 root.QingyuStatements=Object.freeze({fields,validate,analyze,available,compare,ttm});
})(globalThis);
