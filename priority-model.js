/* Transparent research triage v1. A rule score, not a return forecast. */
(function(root){
 'use strict';
 const R=root.QingyuResearch;
 const policy=Object.freeze({version:1,growth:30,valuation:30,income:15,chips:25});
 function evaluate(stock,analysis,now=Date.now()){
  const missing=[];
  const fields={pe:'本益比',pb:'淨值比',yield:'殖利率',yoy:'月營收年增',cumulative:'累計營收年增'};
  for(const [key,label] of Object.entries(fields))if(!R.finite(stock[key]))missing.push('缺少'+label);
  if(R.finite(stock.yield)&&stock.yield<0)missing.push('殖利率格式異常');
  const core=R.eligible(stock,'growth',now);
  if(!core)missing.push('行情、估值或營收期間／必要欄位未核對');
  const chipOK=analysis?.usable===true&&analysis.date===stock.date&&['foreign','trust','dealer','total'].every(k=>R.finite(analysis.row?.[k]))&&analysis.row.foreign+analysis.row.trust+analysis.row.dealer===analysis.row.total;
  if(!chipOK)missing.push('缺少同日且7日內的完整法人籌碼');
  const parts=[
   {label:'月營收成長',max:15,value:core?stock.yoy>=20?15:stock.yoy>=10?10:stock.yoy>=0?5:0:null},
   {label:'累計營收成長',max:15,value:core?stock.cumulative>=10?15:stock.cumulative>0?10:stock.cumulative===0?5:0:null},
   {label:'本益比',max:20,value:core?stock.pe>0&&stock.pe<=15?20:stock.pe>0&&stock.pe<=30?12:stock.pe>0&&stock.pe<=50?4:0:null},
   {label:'股價淨值比',max:10,value:core&&R.finite(stock.pb)?stock.pb>0&&stock.pb<=1.5?10:stock.pb>0&&stock.pb<=3?5:0:null},
   {label:'歷史殖利率',max:15,value:core&&R.finite(stock.yield)&&stock.yield>=0?stock.yield>=4?15:stock.yield>=2?8:0:null},
   {label:'外資當日淨買超',max:10,value:chipOK?analysis.row.foreign>0?10:0:null},
   {label:'投信當日淨買超',max:10,value:chipOK?analysis.row.trust>0?10:0:null},
   {label:'自營商當日淨買超',max:5,value:chipOK?analysis.row.dealer>0?5:0:null}
  ];
  const score=missing.length?null:parts.reduce((sum,p)=>sum+p.value,0);
  const band=score===null?'資料待補':score>=75?'優先研究':score>=50?'持續觀察':'訊號偏弱';
  return {score,band,parts,missing,chipDate:analysis?.date||null,policyVersion:policy.version};
 }
 function compare(a,b){
  const av=a.evaluation.score,bv=b.evaluation.score;
  return av===null?(bv===null?String(a.stock.code).localeCompare(String(b.stock.code)):1):bv===null?-1:bv-av||String(a.stock.code).localeCompare(String(b.stock.code));
 }
 function rank(rows,analyze,now=Date.now()){
  return rows.map(stock=>({stock,evaluation:evaluate(stock,analyze?.(stock),now)})).sort(compare);
 }
 root.QingyuPriority=Object.freeze({policy,evaluate,compare,rank});
})(globalThis);
