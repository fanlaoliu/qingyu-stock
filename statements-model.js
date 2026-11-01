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
 root.QingyuStatements=Object.freeze({fields,validate,analyze,available,compare});
})(globalThis);
