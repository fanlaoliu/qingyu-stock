(function(root){
'use strict';const C=root.QingyuDualCore,D=root.QingyuDual,{F,check,iso}=C;
function statistics(curve,benchmark,initial=curve[0]?.equity,riskFree=0,trades=[]){
 check(Array.isArray(curve)&&curve.length>=3&&curve.every((p,i)=>iso(p.date)&&F(p.equity)&&p.equity>=0&&(!i||p.date>curve[i-1].date))&&F(initial)&&initial>0,'資產曲線需至少3筆嚴格遞增正值');
 check(F(riskFree)&&riskFree>=-5&&riskFree<=30,'無風險年利率假設超出範圍');
 const returns=curve.slice(1).map((p,i)=>curve[i].equity===0?0:p.equity/curve[i].equity-1),rf=(1+riskFree/100)**(1/252)-1,ex=returns.map(r=>r-rf),mean=C.avg(ex),sd=Math.sqrt(ex.reduce((s,r)=>s+(r-mean)**2,0)/(ex.length-1));
 let peak=initial,mdd=0;for(const p of curve){peak=Math.max(peak,p.equity);mdd=Math.max(mdd,1-p.equity/peak);}
 const years=(Date.parse(curve.at(-1).date)-Date.parse(curve[0].date))/86400000/365.2425,cagr=(curve.at(-1).equity/initial)**(1/years)-1;
 const matched=benchmark.filter(b=>b.date>=curve[0].date&&b.date<=curve.at(-1).date),complete=matched.length===curve.length&&matched.every((p,i)=>p.date===curve[i].date&&p.close>0);
 const benchmarkCagr=complete?(matched.at(-1).close/matched[0].close)**(1/years)-1:null;
 const wins=trades.filter(t=>t.pnl>0),losses=trades.filter(t=>t.pnl<0),annual=[];
 for(const y of [...new Set(curve.map(p=>p.date.slice(0,4)))]){const group=curve.filter(p=>p.date.startsWith(y)),idx=curve.indexOf(group[0]),start=idx?curve[idx-1].equity:initial;annual.push({year:y,returnPct:(group.at(-1).equity/start-1)*100,partial:y===curve[0].date.slice(0,4)||y===curve.at(-1).date.slice(0,4)});}
 return {cagr:cagr*100,maxDrawdown:mdd*100,sharpe:sd>0?mean/sd*Math.sqrt(252):null,calmar:mdd>0?cagr/mdd:null,winRate:trades.length?wins.length/trades.length*100:null,averageWinLoss:wins.length&&losses.length?C.avg(wins.map(t=>t.pnl))/Math.abs(C.avg(losses.map(t=>t.pnl))):null,annual,trades:trades.length,benchmarkCagr:benchmarkCagr===null?null:benchmarkCagr*100,excessCagr:benchmarkCagr===null?null:(cagr-benchmarkCagr)*100,riskFree,notes:'CAGR依實際日數；Sharpe用日超額報酬樣本標準差×√252，未作自相關調整；零波動／零回撤比率保留null。'};
}
function validateHistory(input,options={}){
 check(input?.version===1&&input.kind==='monthly-pit-history'&&input.adjustment==='total-return'&&Array.isArray(input.master)&&Array.isArray(input.sessions)&&Array.isArray(input.snapshots)&&Array.isArray(input.benchmark),'請匯入monthly-pit-history及含息價格、主檔、每日行情、決策快照、含息基準');
 check(input.master.length>0&&input.master.length<=5000&&input.sessions.length>=3&&input.sessions.length<=10000&&input.snapshots.length>=1&&input.snapshots.length<=180,'歷史資料筆數不符');
 check(input.coverage?.includesDelisted===true&&input.coverage?.pointInTime===true&&input.coverage?.completeUniverse===true&&C.url(input.source)&&typeof input.license==='string'&&input.license.length>0,'缺歷史下市櫃、PIT完整性聲明或來源授權');
 const ids=new Set();for(const m of input.master){check(m&&m.id===m.market+':'+m.code&&/^[1-9]\d{3}$/.test(m.code)&&['上市','上櫃'].includes(m.market)&&!ids.has(m.id)&&iso(m.listedAt)&&(m.delistedAt===null||iso(m.delistedAt)&&m.delistedAt>=m.listedAt),'歷史證券主檔錯誤');ids.add(m.id);}
 check(input.synthetic===true||input.master.some(m=>m.delistedAt),'未含任何歷史下市櫃證券，不接受僅存活公司資料');
 let prev='';for(const s of input.sessions){check(iso(s.date)&&s.date>prev&&s.prices&&typeof s.prices==='object','交易日日期或價格面板錯誤');prev=s.date;for(const [id,p]of Object.entries(s.prices))check(ids.has(id)&&F(p)&&p>=0,'價格須為已知證券非負含息值；0僅用明示下市結算');}
 prev='';for(const s of input.snapshots){check(iso(s.decisionDate)&&s.decisionDate>prev,'每月決策日需遞增');prev=s.decisionDate;s.pack=C.validate(s.pack);const active=input.master.filter(m=>m.listedAt<=s.decisionDate&&(!m.delistedAt||m.delistedAt>s.decisionDate));check(active.every(m=>s.pack.records.some(r=>r.market===m.market&&r.code===m.code)),'月快照缺少當時仍上市櫃公司，可能有存活者偏誤');}
 check(input.benchmark.length===input.sessions.length&&input.benchmark.every((p,i)=>p.date===input.sessions[i].date&&F(p.close)&&p.close>0),'含息基準須逐交易日對齊');
 const start=options.start||'2015-01-01',end=options.end||'2025-12-31';check(iso(start)&&iso(end)&&start<end,'回測起迄錯誤');
 check(input.synthetic===true||options.allowSubperiod===true||start==='2015-01-01'&&end==='2025-12-31'&&input.sessions[0].date<=start&&input.sessions.at(-1).date>=end,'正式驗證需涵蓋2015～2025含前置歷史，不能用短期資料冒充');
 return {input,start,end};
}
function monthly(input,options={},selector=D.select){
 const {start,end}=validateHistory(input,options),initial=options.initial??1000000,buy=options.buyCost??.25,sell=options.sellCost??.55,maxParticipation=options.maxParticipation??.01;
 check(F(initial)&&initial>0&&initial<=1e12&&[buy,sell].every(x=>F(x)&&x>=0&&x<=5)&&F(maxParticipation)&&maxParticipation>0&&maxParticipation<=.05,'回測資金、成本或參與率不符');
 const sessions=input.sessions.filter(s=>s.date>=start&&s.date<=end);check(sessions.length>=3,'期間交易日不足');
 const allDates=input.sessions.map(s=>s.date),plans=new Map(),months=new Set();
 for(const s of input.snapshots){const next=allDates.find(d=>d>s.decisionDate);if(!next||next<start||next>end)continue;check(s.decisionDate.slice(0,7)!==next.slice(0,7),'決策快照必須是月底最後交易日，下一月交易日執行');check(!months.has(next.slice(0,7)),'同月重複選股');months.add(next.slice(0,7));const result=selector(s.pack,s.decisionDate,options.model||{},[],input.benchmark.filter(b=>b.date<=s.decisionDate));check(result.all.some(r=>r.score!==null),'月快照沒有任何可完整評分資料，不能以全現金掩飾缺資料');plans.set(next,{decisionDate:s.decisionDate,result});}
 const required=new Set(sessions.map(s=>s.date.slice(0,7)));check([...required].every(m=>months.has(m)),'缺每月月底決策快照或次月執行行情');
 let cash=initial,positions=new Map(),volume=0;const curve=[],trades=[],decisions=[];
 function close(id,price,date,reason){const p=positions.get(id),proceeds=p.units*price*(1-sell/100);cash+=proceeds;volume+=p.units*price;trades.push({id,boughtAt:p.date,soldAt:date,pnl:proceeds-p.basis,returnPct:(proceeds/p.basis-1)*100,reason});positions.delete(id);}
 for(const s of sessions){
  for(const [id]of positions){const m=input.master.find(m=>m.id===id);check(F(s.prices[id]),'持倉缺少當日含息價格，不能略過或靜默補值：'+id);if(m.delistedAt&&m.delistedAt<=s.date)close(id,s.prices[id],s.date,'下市櫃結算');else check(s.prices[id]>0,'未下市持倉價格不可為0');}
  const plan=plans.get(s.date);
  if(plan){
   for(const [id]of [...positions])close(id,s.prices[id],s.date,'每月全額換倉');
   const per=plan.result.picks.length?cash/plan.result.picks.length:0;
   for(const p of plan.result.picks){const id=p.market+':'+p.code,m=input.master.find(m=>m.id===id),price=s.prices[id];check(m&&m.listedAt<=s.date&&(!m.delistedAt||m.delistedAt>s.date)&&price>0,'選股沒有可交易價格／已下市：'+id);
    const liquid=p.technical?.latest?.avgAmount60;check(F(liquid)&&liquid>0,'缺決策日已知流動性');const amount=Math.min(per,liquid*maxParticipation,cash),units=amount/(price*(1+buy/100));if(amount<=0)continue;cash-=amount;volume+=units*price;positions.set(id,{units,basis:amount,date:s.date});
   }
   decisions.push({decisionDate:plan.decisionDate,executionDate:s.date,picks:plan.result.picks.map(p=>p.market+':'+p.code)});
  }
  if(s===sessions.at(-1))for(const [id]of [...positions])close(id,s.prices[id],s.date,'期末全數平倉');
  const equity=cash+[...positions].reduce((n,[id,p])=>n+p.units*s.prices[id],0);check(F(equity)&&equity>=0,'資產數值無效');curve.push({date:s.date,equity});
 }
 const stats=statistics(curve,input.benchmark,initial,options.riskFree??0,trades);
 return {status:input.synthetic===true?'synthetic-math-test':'provider-data-backtest-unverified',verifiedPerformance:false,curve,trades,decisions,statistics:{...stats,turnover:volume/(C.avg(curve.map(p=>p.equity))||1)},assumptions:{start,end,initial,buyCost:buy,sellCost:sell,maxParticipation,execution:'月底已知訊號於次月首交易日收盤執行，每月全數換倉；期末平倉；含息比例單位、允許分割持倉，非真實委託'},warning:input.synthetic===true?'合成數學測試，不是投資績效':'使用者提供的歷史覆蓋、還原與公告版本尚待獨立稽核；不代表已完成2015～2025實證驗證。'};
}
function rolling(input,options={}){
 check(Number.isInteger(options.trainYears??5)&&Number.isInteger(options.testYears??1)&&(options.trainYears??5)>=2&&(options.testYears??1)>=1,'滾動年數錯誤');
 const {start,end}=validateHistory(input,options),first=+start.slice(0,4),last=+end.slice(0,4),train=options.trainYears??5,n=options.testYears??1,folds=[];
 for(let y=first+train;y+n-1<=last;y+=n){const result=monthly(input,{...options,start:y+'-01-01',end:(y+n-1)+'-12-31',allowSubperiod:true});folds.push({trainStart:(y-train)+'-01-01',trainEnd:(y-1)+'-12-31',testStart:y+'-01-01',testEnd:(y+n-1)+'-12-31',statistics:result.statistics,status:result.status});}
 check(folds.length>0,'不足以形成完整滾動樣本外區段');return {folds,parameterSearch:false,warning:'固定參數滾動樣本外驗證；訓練窗只定義可用範圍，未進行最佳化。不使用未來測試區段調參，未做真實資料驗證。'};
}
function sensitivity(pack,asOf,baseline,variants,benchmark=[]){check(Array.isArray(variants)&&variants.length<=20,'敏感度最多20組');return variants.map(v=>{const cfg=D.settings({...baseline,...v,weights:{...D.WEIGHTS,...baseline?.weights,...v.weights}}),s=D.select(pack,asOf,cfg,[],benchmark);return {settings:cfg,qualified:s.picks.map(p=>p.code),complete:s.all.filter(r=>r.score!==null).length,warning:'截面敏感度不是歷史因子有效性驗證'};});}
root.QingyuDualBacktest=Object.freeze({statistics,validateHistory,monthly,rolling,sensitivity});
})(globalThis);
