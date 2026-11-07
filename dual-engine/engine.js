(function(root){
'use strict';
const C=root.QingyuDualCore,{F,check,avg,median,DAY}=C;
const WEIGHTS=Object.freeze({quality:30,growth:20,valuation:20,chips:15,technical:10,expectations:5});
const DEFAULTS=Object.freeze({weights:WEIGHTS,cagr:8,ttmRevenueGrowth:10,roe:12,peMax:40,minEps:0,roic:10,netDebtEbitda:2,liquidity:30000000,margin:20,annualReturn:15,rewardRisk:2,disagreement:30,drawdown:20,years:3,entryCost:.15,exitCost:.45,payout:0,scenarios:[{name:'悲觀',growth:-20,pe:12,pb:1,ev:6,discount:14,terminal:1},{name:'基準',growth:8,pe:16,pb:1.5,ev:8,discount:12,terminal:2},{name:'樂觀',growth:18,pe:20,pb:2,ev:10,discount:10,terminal:3}]});
function settings(input={}){
 const out={...DEFAULTS,...input,weights:{...WEIGHTS,...input.weights},scenarios:(input.scenarios||DEFAULTS.scenarios).map(s=>({...s}))};
 check(Object.keys(out.weights).length===6&&Object.keys(WEIGHTS).every(k=>F(out.weights[k])&&out.weights[k]>=0&&out.weights[k]<=100)&&Math.abs(Object.values(out.weights).reduce((s,x)=>s+x,0)-100)<1e-8,'六大權重須為非負數且合計100');
 for(const k of ['cagr','ttmRevenueGrowth','roe','minEps','roic','netDebtEbitda','liquidity','margin','annualReturn','rewardRisk','disagreement','drawdown','years','entryCost','exitCost','payout','peMax'])check(F(out[k]),'設定須為有限數字：'+k);
 check(out.cagr>=0&&out.cagr<=100&&out.ttmRevenueGrowth>=0&&out.ttmRevenueGrowth<=200&&out.roe>=0&&out.roe<=100&&out.roic>=0&&out.roic<=100&&out.minEps>=0&&out.netDebtEbitda>=0&&out.netDebtEbitda<=20&&out.liquidity>=0&&out.liquidity<=1e12&&out.peMax>0&&out.peMax<=100&&out.margin>=0&&out.margin<100&&out.annualReturn>=0&&out.annualReturn<=100&&out.rewardRisk>0&&out.rewardRisk<=100&&out.disagreement>=0&&out.disagreement<=200&&out.drawdown>0&&out.drawdown<=50&&[1,2,3].includes(out.years)&&out.entryCost>=0&&out.entryCost<=5&&out.exitCost>=0&&out.exitCost<=10&&out.payout>=0&&out.payout<=100,'設定超出研究範圍');
 check(Array.isArray(out.scenarios)&&out.scenarios.length===3,'需要悲觀／基準／樂觀三情境');
 for(const s of out.scenarios)check(['growth','pe','pb','ev','discount','terminal'].every(k=>F(s[k]))&&s.growth>=-50&&s.growth<=50&&s.pe>0&&s.pe<=100&&s.pb>0&&s.pb<=10&&s.ev>0&&s.ev<=50&&s.discount>=5&&s.discount<=40&&s.terminal>=-2&&s.terminal<=5&&s.discount-s.terminal>=2,'情境假設無效；折現率須高於終值成長率至少2個百分點');
 for(let i=1;i<3;i++)check(out.scenarios[i].growth>=out.scenarios[i-1].growth&&out.scenarios[i].pe>=out.scenarios[i-1].pe&&out.scenarios[i].pb>=out.scenarios[i-1].pb&&out.scenarios[i].ev>=out.scenarios[i-1].ev,'三情境成長與倍數須由悲觀到樂觀遞增');
 return out;
}
function valuation(record,pack,asOf,opts={}){
 const cfg=settings(opts),get=(k,b='TTM',end)=>C.observation(record,k,b,asOf,pack,end),eps=get('eps'),end=eps?.periodEnd;
 const o=k=>end?get(k,['bookEquity','netDebt'].includes(k)?'daily':'TTM',end):null,shares=get('shares','daily'),bv=o('bookEquity'),ebitda=o('ebitda'),netDebt=o('netDebt'),fcfe=o('fcfe');
 const bars=record.bars.filter(b=>b.date<=asOf),last=record.quote&&record.quote.date<=asOf&&(!bars.length||record.quote.date>=bars.at(-1).date)?record.quote:bars.at(-1),epsGood=eps&&eps.value>0&&Date.parse(asOf)-Date.parse(end)<=230*DAY;
 const sharesGood=shares&&shares.value>0&&last&&shares.periodEnd===last.date;
 const methods=[];if(epsGood)methods.push('PE');if(epsGood&&sharesGood&&fcfe?.value>0&&['general','capital-intensive','cyclical'].includes(record.model))methods.push('DCF-FCFE');if(epsGood&&sharesGood&&ebitda?.value>0&&netDebt&&['general','capital-intensive','cyclical'].includes(record.model))methods.push('EV/EBITDA');if(epsGood&&sharesGood&&bv?.value>0&&['financial','insurance','construction','cyclical'].includes(record.model))methods.push('PB');
 const problems=[];if(!epsGood)problems.push('缺少新鮮、正數且有起迄期間的TTM EPS');if(!last)problems.push('沒有可驗證價格');if(methods.length<2)problems.push('不足兩種適用估值方法，不能通過估值研究門檻');
 const cases=cfg.scenarios.map((s,index)=>{
  const g=s.growth/100,discount=s.discount/100,terminal=s.terminal/100;
  const priceAt=(method,horizon)=>{
   if(method==='PE')return eps.value*(1+g)**horizon*s.pe;
   if(method==='PB')return bv.value/shares.value*s.pb; // Flat book value explicitly assumed; no invented bank growth.
   if(method==='EV/EBITDA')return (ebitda.value*(1+g)**horizon*s.ev-netDebt.value)/shares.value;
   let pv=0;for(let y=1;y<=5;y++)pv+=fcfe.value*(1+g)**(horizon+y)/(1+discount)**y;
   pv+=fcfe.value*(1+g)**(horizon+5)*(1+terminal)/(discount-terminal)/(1+discount)**5;return pv/shares.value;
  };
  const values=methods.map(method=>({method,now:priceAt(method,0),one:priceAt(method,1),three:priceAt(method,3)})).filter(p=>[p.now,p.one,p.three].every(x=>F(x)&&x>0));
  const epsPath=epsGood?[1,2,3].map(y=>eps.value*(1+g)**y):null;
  const fair=values.length?median(values.map(p=>p.now)):null,target1=values.length?median(values.map(p=>p.one)):null,target3=values.length?median(values.map(p=>p.three)):null;
  const div=epsPath?epsPath.map(v=>v*cfg.payout/100):null,initial=last?last.close*(1+cfg.entryCost/100):null;
  const total1=target1!==null&&initial?(target1*(1-cfg.exitCost/100)+(div?.[0]??0))/initial-1:null;
  const total3=target3!==null&&initial?(target3*(1-cfg.exitCost/100)+(div?div.reduce((s,x)=>s+x,0):0))/initial-1:null;
  const disagreement=values.length>=2?(Math.max(...values.map(x=>x.now))/Math.min(...values.map(x=>x.now))-1)*100:null;
  return {name:['悲觀','基準','樂觀'][index],assumptions:{...s},methods:values,eps12:epsPath?.[0]??null,eps3:epsPath?.[2]??null,dividends:div,fair,target1,target3,margin:fair&&last?(1-last.close/fair)*100:null,totalReturn1:total1===null?null:total1*100,totalReturn3:total3===null?null:total3*100,cagr3:total3!==null&&total3> -1?((1+total3)**(1/3)-1)*100:null,disagreement,range:values.length>=2?[Math.min(...values.map(x=>x.now)),Math.max(...values.map(x=>x.now))]:null};
 });
 const [bear,base]=cases,downside=bear.totalReturn1!==null?Math.max(0,-bear.totalReturn1):null,rewardRisk=downside>0&&base.totalReturn1!==null?Math.max(0,base.totalReturn1)/downside:null;
 if(base.disagreement>cfg.disagreement)problems.push('估值方法差異超過'+cfg.disagreement+'%，需重新審查');if(downside===0)problems.push('悲觀情境未顯示下跌，不代表零風險；風險報酬比不設無限大');
 const stress=epsGood&&last?{epsDown20:base.eps12*.8*cfg.scenarios[1].pe,peDown20:base.eps12*cfg.scenarios[1].pe*.8,bothDown20:base.eps12*cfg.scenarios[1].pe*.64,reference:base.eps12*cfg.scenarios[1].pe}:null;
 if(stress)stress.lossFromSpot=(stress.bothDown20/last.close-1)*100;
 const complete=cases.every(c=>c.methods.length>=2)&&!problems.length;const buyBelow=complete&&base.fair!==null?base.fair*(1-cfg.margin/100):null;
 return {asOf,price:last?.close??null,priceDate:last?.date??null,cases,methods,downside,rewardRisk,stress,buyBelow,watchRange:buyBelow!==null&&bear.fair!==null?[Math.min(bear.fair,buyBelow),buyBelow]:null,complete,problems,assumptions:cfg,sourceIds:[eps,shares,bv,ebitda,netDebt,fcfe].filter(Boolean).map(o=>o.id),note:'條件推演，非已驗證報酬預測。EPS／成長／倍數／折現率／終值／股息與成本都是明示假設。DCF採FCFE股權現金流，不以OCF−CAPEX冒充FCFE，亦不再扣淨負債。PB假設每股淨值不變。'};
}
function evaluate(record,pack,asOf,opts={},benchmark=[]){
 check(C.iso(asOf),'研究日格式錯誤');const cfg=settings(opts),a=C.annuals(record,asOf,pack),tech=C.technical(record,asOf,benchmark),ch=C.chips(record,asOf),v=valuation(record,pack,asOf,cfg);
 const eps=C.observation(record,'eps','TTM',asOf,pack),end=eps?.periodEnd,get=k=>end?C.observation(record,k,['netDebt','inventory','receivables','currentAssets','currentLiabilities'].includes(k)?'daily':'TTM',asOf,pack,end):null;
 const obs=Object.fromEntries(['revenue','operatingProfit','grossProfit','nopat','averageInvestedCapital','wacc','netDebt','ebitda','ocf','netIncome','inventory','receivables','coreProfit','currentAssets','currentLiabilities','capex'].map(k=>[k,get(k)]));
 const priorEnd=end?String(+end.slice(0,4)-1)+end.slice(4):null,prevRevenue=priorEnd?C.observation(record,'revenue','TTM',asOf,pack,priorEnd):null;
 const rev=obs.revenue?.value,revenueGrowth=rev>0&&prevRevenue?.value>0?(rev/prevRevenue.value-1)*100:null;
 const margin=rev>0&&obs.operatingProfit?(obs.operatingProfit.value/rev)*100:null,roic=obs.nopat&&obs.averageInvestedCapital?.value>0?obs.nopat.value/obs.averageInvestedCapital.value*100:null;
 const nd=obs.netDebt&&obs.ebitda?.value>0?obs.netDebt.value/obs.ebitda.value:null,conversion=obs.ocf&&obs.netIncome?.value>0?obs.ocf.value/obs.netIncome.value:null,core=obs.coreProfit&&obs.netIncome?.value>0?obs.coreProfit.value/obs.netIncome.value*100:null;
 const prev=(key,basis='TTM')=>priorEnd?C.observation(record,key,basis,asOf,pack,priorEnd):null;
 const grossMargin=rev>0&&obs.grossProfit?obs.grossProfit.value/rev*100:null,prevOp=prev('operatingProfit'),prevGross=prev('grossProfit');
 const grossMarginChange=grossMargin!==null&&prevGross&&prevRevenue?.value>0?grossMargin-prevGross.value/prevRevenue.value*100:null,operatingMarginChange=margin!==null&&prevOp&&prevRevenue?.value>0?margin-prevOp.value/prevRevenue.value*100:null;
 const balanceGrowth=key=>{const old=prev(key,'daily');return obs[key]&&old?.value>0?(obs[key].value/old.value-1)*100:null;};
 const inventoryGrowth=balanceGrowth('inventory'),receivablesGrowth=balanceGrowth('receivables'),currentRatio=obs.currentAssets&&obs.currentLiabilities?.value>0?obs.currentAssets.value/obs.currentLiabilities.value:null,cashIncomeDifference=obs.ocf&&obs.netIncome?obs.ocf.value-obs.netIncome.value:null,capexToOCF=obs.capex&&obs.ocf?.value>0?obs.capex.value/obs.ocf.value:null;
 const gates=[],add=(name,value,pass,ids=[])=>gates.push({name,value:value??null,status:value===null||value===undefined?'missing':pass?'pass':'fail',evidenceIds:ids});
 add('三年營收CAGR≥'+cfg.cagr+'%',a.cagr,a.cagr!==null&&a.cagr+1e-9>=cfg.cagr);add('TTM營收年增≥'+cfg.ttmRevenueGrowth+'%',revenueGrowth,revenueGrowth!==null&&revenueGrowth+1e-9>=cfg.ttmRevenueGrowth);
 add('TTM EPS為正',eps?.value,eps?.value>cfg.minEps,eps?[eps.id]:[]);add('三年至少兩年獲利',a.profitable,a.profitable>=2);add('三年ROE中位數≥'+cfg.roe+'%',a.roeMedian,a.roeMedian!==null&&a.roeMedian+1e-9>=cfg.roe);add('TTM營業利益率為正',margin,margin>0);add('三年累計FCF為正',a.fcf3,a.fcf3>0);add('60日均成交額≥'+cfg.liquidity,tech.latest?.avgAmount60,tech.latest?.avgAmount60>=cfg.liquidity);
 const last=tech.latest,priceAge=last?(Date.parse(asOf)-Date.parse(last.date))/DAY:null;add('行情7日內',priceAge,priceAge>=0&&priceAge<=7);add('報價與K線日期／價格一致',last?v.priceDate===last.date&&Math.abs(v.price-last.close)<.01:null,last&&v.priceDate===last.date&&Math.abs(v.price-last.close)<.01);add('60交易日歷史連續',last?tech.continuous:null,tech.continuous);
 add('估值至少兩種方法交叉核對',v.methods.length>=2?v.methods.length:null,v.complete);add('基準三年年化報酬≥'+cfg.annualReturn+'%',v.cases[1].cagr3,v.cases[1].cagr3>=cfg.annualReturn);add('悲觀12月損失不超出'+cfg.drawdown+'%重審門檻',v.downside,v.downside!==null&&v.downside<=cfg.drawdown);add('當期合理價安全邊際≥'+cfg.margin+'%',v.cases[1].margin,v.cases[1].margin>=cfg.margin);add('12月報酬／12月悲觀損失≥'+cfg.rewardRisk,v.rewardRisk,v.rewardRisk>=cfg.rewardRisk);
 add('行情來源授權已聲明確認',record.barSourceId?pack.sources.find(s=>s.id===record.barSourceId)?.authorization==='confirmed':null,record.barSourceId&&pack.sources.find(s=>s.id===record.barSourceId)?.authorization==='confirmed');
 if(cfg.weights.chips>0)add('法人來源授權已聲明確認',record.flowSourceId?pack.sources.find(s=>s.id===record.flowSourceId)?.authorization==='confirmed':null,record.flowSourceId&&pack.sources.find(s=>s.id===record.flowSourceId)?.authorization==='confirmed');
 if(eps){add('TTM期末230日內',(Date.parse(asOf)-Date.parse(eps.periodEnd))/DAY,Date.parse(asOf)-Date.parse(eps.periodEnd)<=230*DAY);}
 const pe=eps?.value>0&&last?last.close/eps.value:null;add('TTM PE不高於'+cfg.peMax,pe,pe>0&&pe<=cfg.peMax);
 const components={};
 function component(key,items){if(cfg.weights[key]===0){components[key]={max:0,score:0,knownPoints:0,missing:[],skipped:true,formula:[]};return;}let sum=0;const missing=[];for(const [label,points,value,fn]of items){if(!F(value)){missing.push(label);continue;}sum+=points*fn(value);}components[key]={max:cfg.weights[key],score:missing.length?null:sum/WEIGHTS[key]*cfg.weights[key],knownPoints:sum/WEIGHTS[key]*cfg.weights[key],missing,formula:items.map(([label,points])=>({label,points}))};}
 const tier=(v,a,b)=>v+1e-9>=a?1:v+1e-9>=b?.6:0;
 component('quality',[['三年ROE中位數',8,a.roeMedian,x=>tier(x,20,cfg.roe)],['ROIC與WACC',6,roic!==null&&obs.wacc?roic-obs.wacc.value:null,x=>roic>=cfg.roic&&x>=2?1:x>0?.5:0],['OCF／淨利',6,conversion,x=>tier(x,1,.8)],['營業利益率',5,margin,x=>tier(x,10,0.01)],['淨負債／EBITDA',5,nd,x=>x<=cfg.netDebtEbitda?1:x<=3?.5:0]]);
 component('growth',[['三年營收CAGR',8,a.cagr,x=>tier(x,15,cfg.cagr)],['TTM營收年增',8,revenueGrowth,x=>tier(x,20,cfg.ttmRevenueGrowth)],['本業占淨利',4,core,x=>tier(x,80,60)]]);
 component('valuation',[['安全邊際',8,v.complete?v.cases[1].margin:null,x=>tier(x,30,cfg.margin)],['年化總報酬假設',8,v.complete?v.cases[1].cagr3:null,x=>tier(x,20,cfg.annualReturn)],['風險報酬比',4,v.complete?v.rewardRisk:null,x=>tier(x,3,cfg.rewardRisk)]]);
 component('chips',[['5日法人淨買超',5,ch.windows[5]?.total,x=>x>0?1:0],['20日法人淨買超',5,ch.windows[20]?.total,x=>x>0?1:0],['60日法人淨買超',3,ch.windows[60]?.total,x=>x>0?1:0],['外資投信同步',2,ch.synchronized===null?null:ch.synchronized?1:0,x=>x]]);
 component('technical',[['MA5／20／60排列',4,last&&[last.ma5,last.ma20,last.ma60].every(F)?last.ma5>last.ma20&&last.ma20>last.ma60?1:0:null,x=>x],['RSI／MACD',3,last&&F(last.rsi)&&F(last.histogram)?last.rsi>=40&&last.rsi<=70&&last.histogram>0?1:0:null,x=>x],['60日相對強弱',3,last?.relativeStrength60,x=>x>0?1:0]]);
 const forecastEnd=asOf.slice(0,4)+'-12-31',cons=C.observation(record,'consensusEps','forecast',asOf,pack,forecastEnd),guidance=C.observation(record,'managementEps','forecast',asOf,pack,forecastEnd),gap=cons?.value>0&&guidance?(guidance.value/cons.value-1)*100:null;
 component('expectations',[['可追溯管理層／共識EPS差',3,gap,x=>tier(x,10,0)],['成交熱度代理',2,last?.volumeRatio,x=>x>=1&&x<=2?1:0]]);
 if(record.model!=='general')components.quality={...components.quality,score:null,missing:['產業專屬財務品質模型尚待實作與驗證']};
 const score=Object.values(components).every(c=>c.score!==null)?Object.values(components).reduce((s,c)=>s+c.score,0):null;
 const blocked=gates.filter(g=>g.status!=='pass'),special=record.model!=='general';if(special)blocked.push({name:'產業專屬模型尚待驗證：'+record.model,status:'missing',value:null});
 const dataProblems=Object.values(components).flatMap(c=>c.missing),eligible=blocked.length===0&&score!==null&&score>=75;
 const cyclePool=record.model==='cyclical'&&a.fcf3>0&&nd!==null&&nd<=2&&margin!==null&&margin<=0;
 const grade=score===null?'資料不足':score>=85?'優先買進研究候選':score>=75?'觀察或小額試單研究候選':score>=60?'持續研究':'暫不優先考慮';
 const claims=record.claims.map(c=>({...c,evidenceIds:c.evidenceIds.filter(id=>record.observations.some(o=>o.id===id&&C.observation(record,o.key,o.basis,asOf,pack,o.periodEnd)?.id===id))})).map(c=>({...c,confidence:c.evidenceIds.length?c.confidence:'low',verifiedEvidence:c.evidenceIds.length>0}));
 const result={researchType:pack.synthetic?'synthetic-math-test':'source-declared-research',code:record.code,name:record.name,market:record.market,industry:record.industry,model:record.model,asOf,score,grade,eligible,riskLevel:v.downside===null?'待核對':v.downside>cfg.drawdown||nd>2?'高':v.downside>cfg.drawdown*.75?'中高':'中',priority:false,decision:pack.synthetic?'合成數學測試，不是實際推薦':eligible?'觀察（須人工審查）':blocked.some(g=>g.status==='fail')?'等待條件改善／重新審查':blocked.length?'等待資料／研究':'持續研究',cyclePool,gates,blocked,components,metricEvidence:{cagr:a.revenueIds,annualQuality:a.years.flatMap(y=>y.ids),ttm:Object.values(obs).filter(Boolean).map(o=>o.id),revenueGrowth:[obs.revenue,prevRevenue].filter(Boolean).map(o=>o.id),valuation:v.sourceIds,technical:[record.barSourceId].filter(Boolean),chips:[record.flowSourceId].filter(Boolean),expectations:[cons,guidance].filter(Boolean).map(o=>o.id)},partialScore:Object.values(components).reduce((s,c)=>s+c.knownPoints,0),missing:dataProblems,metrics:{cagr:a.cagr,revenueGrowth,roeMedian:a.roeMedian,profitable:a.profitable,fcf3:a.fcf3,margin,roic,wacc:obs.wacc?.value??null,netDebtEbitda:nd,cashConversion:conversion,coreProfitShare:core,pe,expectationGap:gap,grossMargin,grossMarginChange,operatingMarginChange,inventoryGrowth,receivablesGrowth,currentRatio,cashIncomeDifference,capexToOCF},valuation:v,technical:tech,chips:ch,claims,sourceEvidence:record.observations.filter(o=>o.publishedAt<=asOf&&Date.parse(o.obtainedAt)<=Date.parse(asOf+'T23:59:59.999+08:00')).map(o=>({...o,source:pack.sources.find(s=>s.id===o.sourceId)})),warning:cfg.drawdown+'%為風險重審門檻，不保證最大損失。所有初始門檻、權重與估值假設尚待樣本外驗證；無任何下單功能。'};
 result.valuationSignal=valuationSignal(result,{synthetic:pack.synthetic,sourceReady:record.quote&&record.quote.date===v.priceDate?pack.sources.some(s=>s.id===record.quote.sourceId&&s.authorization==='confirmed'):pack.sources.some(s=>s.id===record.barSourceId&&s.authorization==='confirmed')&&Date.parse(record.marketObtainedAt)<=Date.parse(asOf+'T23:59:59.999+08:00'),priceConsistent:!last||v.priceDate===last.date&&Math.abs(v.price-last.close)<.01});
 return result;
}
// Price signals describe explicit model assumptions; they never place orders or change scores.
function valuationSignal(result,{synthetic=false,sourceReady=false,priceConsistent=false}={}){
 const v=result.valuation,cfg=v.assumptions,base=v.cases[1],range=base.range;
 const signal={kind:'unavailable',label:'估值資料不足，無法判定',reasons:[],asOf:result.asOf,priceDate:v.priceDate,price:v.price,fairRange:range,margin:base.margin,overvaluationPercent:F(v.price)&&F(base.fair)&&base.fair>0?(v.price/base.fair-1)*100:null,buyBelow:null,action:'等待資料',modelConditional:true};
 const finish=(kind,label,reasons,action)=>({...signal,kind,label,reasons,action});
 if(synthetic||result.researchType==='synthetic-math-test')return finish('synthetic','合成測試，不提供買入訊號',['測試價格與財務不是實際投資證據。'],'僅數學驗證');
 const age=C.iso(v.priceDate)?(Date.parse(result.asOf)-Date.parse(v.priceDate))/DAY:null;
 if(!sourceReady||!priceConsistent||!F(age)||age<0||age>7||!F(v.price)||v.price<=0)return finish('unavailable','行情待核對，無法判定',['須有授權聲明已確認的行情，報價與K線一致且距研究日不超過7天。'],'等待行情核對');
 if(!range||range.length!==2||!range.every(x=>F(x)&&x>0)||!F(base.fair)||!F(base.margin)||base.methods.length<2)return finish('unavailable','估值資料不足，無法判定',['至少兩種適用估值、明確TTM期間與可追溯財務資料才判定高低。'],'等待估值資料');
 if(!v.complete||!F(base.disagreement)||base.disagreement>cfg.disagreement||result.model!=='general')return finish('review','估值待複核',['估值方法差異、情境風險或產業模型尚未通過；暫不發買入訊號。',...v.problems],'重新審查');
 signal.buyBelow=v.buyBelow;
 if(signal.overvaluationPercent+1e-9>=20&&v.price>range[1])return finish('overvalued','估值偏高，留意風險',['現價高於基準當期合理價中位數至少20%，並超過兩法估值區間上緣。'],'留意估值回落風險');
 if(base.margin+1e-9>=cfg.margin&&v.price<=range[0]){
  if(result.eligible===true)return finish('buy-research','估值偏低，可研究買入',['安全邊際達'+cfg.margin+'%且不高於估值區間下緣；財務、流動性、評分與風控門檻均通過。','買入前仍須人工覆核；情境假設與20%風險門檻均不是損失保證。'],'人工覆核後研究分批買入');
  return finish('undervalued-watch','估值偏低，等待條件確認',['價格達安全邊際，但整體研究門檻未全數通過。',...(result.blocked||[]).map(g=>g.name),...(result.missing||[])],'暫不發買入訊號');
 }
 return finish('fair','估值合理區間／持續觀察',['尚未同時達到偏高警示或偏低安全邊際條件；估值僅是明示假設下的推演。'],'持續觀察');
}
function select(pack,asOf,opts={},excluded=[],benchmark=[]){const settingsCopy=settings(opts),all=pack.records.filter(r=>!excluded.includes(r.industry)).map(r=>evaluate(r,pack,asOf,settingsCopy,benchmark));const picks=all.filter(r=>r.eligible).sort((a,b)=>b.score-a.score||a.code.localeCompare(b.code)).slice(0,5).map((p,i)=>({...p,priority:i<3}));return {asOf,picks:pack.synthetic?[]:picks,all,cyclePool:all.filter(r=>r.cyclePool),status:picks.length?'待驗證研究候選':'資料或研究門檻不足，不湊五檔'};}
function crossReview(result){
 const m=result.metrics,v=result.valuation,refs=(keys)=>result.sourceEvidence.filter(o=>keys.includes(o.key)&&o.status==='ok'&&o.source?.authorization==='confirmed').map(o=>o.id);
 const claims=[['成長真實性',m.cagr!==null?'三年營收CAGR '+m.cagr.toFixed(2)+'%；TTM年增 '+(m.revenueGrowth?.toFixed(2)??'缺漏')+'%。':'缺少四個年度營收，無法支持持續成長論點。',[
  {q:'成長是否只是景氣循環或低基期？',keys:['revenue'],answer:'需同期間多年營收與需求證據；單年成長不能證明護城河。'},
  {q:'EPS是否依賴業外？',keys:['coreProfit','netIncome'],answer:m.coreProfitShare===null?'本業占比缺漏，論點可信度降低。':'本業占淨利 '+m.coreProfitShare.toFixed(2)+'%，仍需查原文。'},
  {q:'帳面獲利有現金流支持嗎？ROE是否靠槓桿？',keys:['ocf','netIncome','netDebt','equityEnd'],answer:m.cashConversion===null?'現金轉換資料不足，不能視為已解答。':'OCF／淨利 '+m.cashConversion.toFixed(2)+'；槓桿與資本支出仍須查核。'}]],
 ['估值合理性',v.complete?'至少兩法估值。基準當期合理價 '+v.cases[1].fair.toFixed(2)+'，三年EPS假設 '+v.cases[1].eps3.toFixed(2)+'。':'不足兩種適用估值或差異待審查，不提出可靠買價。',[
  {q:'EPS下修20%？',keys:['eps'],answer:v.stress?'PE法情境價 '+v.stress.epsDown20.toFixed(2):'缺TTM EPS，無法計算。'},
  {q:'PE下修20%？',keys:['eps'],answer:v.stress?'PE法情境價 '+v.stress.peDown20.toFixed(2):'無法計算。'},
  {q:'EPS與PE同時下修20%？',keys:['eps'],answer:v.stress?'PE法情境價 '+v.stress.bothDown20.toFixed(2)+'；相對現價 '+v.stress.lossFromSpot.toFixed(2)+'%。':'無法計算。'}]],
 ['投資決策',result.eligible?'可列入人工研究清單；不產生買進指令。':'目前決議：'+result.decision,[
  {q:'法人是否僅短線流動？',keys:[],answer:'5／20／60日缺漏不補0；未有ETF／持股比例來源，不能稱為吸籌。'},
  {q:'技術面與價格是否支持進場？',keys:['eps'],answer:result.technical.signals.map(s=>s.text).join('；')||'未觸發規則不代表安全；先查流動性與跳空。'},
  {q:'什麼證據會推翻論點？',keys:['revenue','ocf','netIncome'],answer:'TTM營收年增低於設定、現金轉換惡化、估值低於現價或來源無法核對時，重新審查。下跌10／15／20%分級重審。'}]]];
 return {mode:'deterministic-cross-review',independentSources:false,label:'規則化雙角色交叉檢查，未呼叫AI；不代表兩個獨立研究來源',rounds:claims.map(([title,bull,questions],i)=>({round:i+1,title,a:{text:bull,evidenceIds:refs(i===1?['eps','fcfe','ebitda']:['revenue','netIncome'])},b:questions.map(q=>({question:q.q,response:q.answer,evidenceIds:refs(q.keys),status:q.keys.length&&q.keys.every(k=>refs([k]).length)?'有資料，仍需人工核對':'未解決',confidence:q.keys.length&&q.keys.every(k=>refs([k]).length)?'medium':'low'}))})),unresolved:[...result.blocked.map(g=>g.name),...result.missing,...result.claims.filter(c=>!c.verifiedEvidence).map(c=>'論點缺可用證據：'+c.text)],invalidation:['核心財報資料重編或來源失效','需求／競爭優勢論點失去證據支持','估值假設下修令安全邊際消失','股價下跌10／15／20%分級重新審查，跳空可能直接越過門檻'],decision:result.decision};
}
function sizePosition(input){
 const {capital,price,atr,avgAmount60,existingStock=0,existingIndustry=0,portfolioPeak=capital,portfolioNow=capital,entryPrice=price}=input;
 check([capital,price,atr,avgAmount60,existingStock,existingIndustry,portfolioPeak,portfolioNow,entryPrice].every(F)&&capital>0&&price>0&&atr>=0&&avgAmount60>=0&&existingStock>=0&&existingIndustry>=existingStock&&existingIndustry<=capital&&portfolioPeak>0&&portfolioNow>=0&&entryPrice>0,'請提供正確的總資產、現價、ATR、成交額及既有曝險');
 const riskBudget=input.riskBudget??.75,initialWeight=input.initialWeight??4,cap=input.maxWeight??10,industryCap=input.industryCap??25,stop=input.stop??20;
 check([riskBudget,initialWeight,cap,industryCap,stop].every(F)&&riskBudget>=.5&&riskBudget<=1&&initialWeight>=3&&initialWeight<=5&&cap>=8&&cap<=10&&industryCap>0&&industryCap<=25&&stop>0&&stop<=50,'配置／預算風險超出設定範圍');
 const riskDistance=Math.max(price*stop/100,atr*2)+price*.05;
 const notional=Math.max(0,Math.min(capital*initialWeight/100,capital*cap/100-existingStock,capital*industryCap/100-existingIndustry,capital*riskBudget/100/riskDistance*price,avgAmount60*.01));
 const dd=Math.max(0,(1-price/entryPrice)*100),portfolioDD=Math.max(0,(1-portfolioNow/portfolioPeak)*100);
 return {shares:Math.floor(notional/price),amount:Math.floor(notional/price)*price,riskDistance,riskBudgetAmount:capital*riskBudget/100,stockDrawdown:dd,portfolioDrawdown:portfolioDD,stage:dd>=stop?'原則退出研究／事前核准例外':dd>=15?'強制風險審查':dd>=10?'重新檢查投資論點':'持續觀察',portfolioReview:portfolioDD>=10,warning:'含5%跳空緩衝的試算仍不保證最大損失。未估完整產業相關性，不會下單。'};
}
root.QingyuDual=Object.freeze({WEIGHTS,DEFAULTS,settings,valuation,valuationSignal,evaluate,select,crossReview,sizePosition});
})(globalThis);
