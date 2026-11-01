/* Evidence-gated 50/25/15/10 aggregation. No inferred or redistributed scores. */
(function(root){
 'use strict';
 const weights=Object.freeze({fundamental:50,chips:25,popularity:15,technical:10});
 const labels={fundamental:'基本面',chips:'籌碼面',popularity:'人氣面',technical:'技術面'};
 function evaluate(stock,evidence={},now=Date.now()){
  const parts=Object.entries(weights).map(([key,max])=>{
   const item=evidence?.[key];
   let reason=null;
   if(!item)reason='尚無已核對資料來源與計分方法';
   else if(!root.QingyuResearch.equity(stock)||!root.QingyuResearch.finite(stock.price)||stock.price<=0||!root.QingyuResearch.eligible({...stock,pe:1,yield:0},'income',now))reason='行情或估值期間未核對';
   else if(item.code!==stock.code||item.market!==stock.market||item.asOf!==stock.date)reason='個股、市場或評分日期不一致';
   else if(!/^https:\/\//.test(item.sourceUrl||'')||typeof item.methodology!=='string'||!item.methodology.trim()||item.verified!==true)reason='來源、計分方法或核對狀態未完成';
   else if(!root.QingyuResearch.finite(item.score)||item.score<0||item.score>100)reason='子分數須為0至100的有限數值';
   return {key,label:labels[key],max,value:reason?null:item.score*max/100,reason,
    asOf:item?.asOf||null,sourceUrl:item?.sourceUrl||null,methodology:item?.methodology||null};
  });
  const complete=parts.every(p=>p.value!==null);
  return {version:1,complete,score:complete?parts.reduce((sum,p)=>sum+p.value,0):null,
   availableWeight:parts.filter(p=>p.value!==null).reduce((sum,p)=>sum+p.max,0),
   status:complete?'完整評分':'未能完整評分',parts};
 }
 function current(stock,analysis,now=Date.now()){
  const triage=root.QingyuPriority.evaluate(stock,analysis,now);
  const chips=triage.parts.filter(p=>p.label.includes('淨買超'));
  const usable=chips.length===3&&chips.every(p=>p.value!==null);
  const sourceUrl=stock.market==='上市'?'https://www.twse.com.tw/rwd/zh/fund/T86':'https://www.tpex.org.tw/www/zh-tw/insti/dailyTrade';
  const evidence=usable?{chips:{code:stock.code,market:stock.market,asOf:analysis.date,
   score:chips.reduce((sum,p)=>sum+p.value,0)*4,sourceUrl,verified:true,
   methodology:'當日外資／投信／自營商淨買超各10／10／5分；非買超為0，同日完整法人資料'}}:{};
  return evaluate(stock,evidence,now);
 }
 root.QingyuScoring=Object.freeze({weights,evaluate,current});
})(globalThis);
