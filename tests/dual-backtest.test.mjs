import test from 'node:test';import assert from 'node:assert/strict';import '../dual-engine/core.js';import '../dual-engine/engine.js';import '../dual-engine/backtest.js';
const B=QingyuDualBacktest;
function panel(){const record=code=>({code,market:'上市',name:'synthetic',industry:'24',model:'general',observations:[],bars:[],flows:[],calendar:[],claims:[]});const pack={version:1,kind:'dual-expert-research',sources:[],records:[record('2330'),record('2454')],benchmark:[]};const dates=['2015-01-02','2015-01-30','2015-02-02','2015-02-27','2015-03-02','2015-03-03','2015-03-31'];return {version:1,kind:'monthly-pit-history',synthetic:true,adjustment:'total-return',source:'https://example.org/synthetic',license:'synthetic only',coverage:{includesDelisted:true,pointInTime:true,completeUniverse:true},master:[{id:'上市:2330',code:'2330',market:'上市',listedAt:'2010-01-01',delistedAt:null},{id:'上市:2454',code:'2454',market:'上市',listedAt:'2010-01-01',delistedAt:'2015-03-03'}],sessions:dates.map((date,i)=>({date,prices:{'上市:2330':100,'上市:2454':i<2?100:i<5?50:0}})),benchmark:dates.map(date=>({date,close:100})),snapshots:['2014-12-31','2015-01-30','2015-02-27'].map(decisionDate=>({decisionDate,pack:structuredClone(pack)}))};}
const select=code=>(()=>({all:[{score:90}],picks:[{code,market:'上市',technical:{latest:{avgAmount60:100000000}}}]}));
test('monthly kernel executes only next-session close and retains a delisting total loss instead of dropping the loser',()=>{
 const r=B.monthly(panel(),{initial:1000,buyCost:0,sellCost:0},select('2454'));assert.equal(r.curve.at(-1).equity,0);assert.equal(r.statistics.maxDrawdown,100);assert.equal(r.statistics.cagr,-100);assert.equal(r.verifiedPerformance,false);assert.equal(r.status,'synthetic-math-test');assert.equal(r.trades.at(-1).reason,'下市櫃結算');assert.ok(r.decisions.every(d=>d.executionDate>d.decisionDate));assert.equal(r.decisions[0].executionDate,'2015-01-02');
});
test('costs and monthly forced turnover reduce capital; market benchmark is aligned and explicitly gross total return',()=>{
 const z=B.monthly(panel(),{initial:1000,buyCost:0,sellCost:0},select('2330')),fee=B.monthly(panel(),{initial:1000,buyCost:1,sellCost:1},select('2330'));assert.equal(z.curve.at(-1).equity,1000);assert.ok(fee.curve.at(-1).equity<1000);assert.ok(fee.statistics.turnover>1);assert.equal(fee.statistics.benchmarkCagr,0);
});
test('missing delisting settlement, survivor-only monthly universe and non-month-end timing are rejected',()=>{
 const noPrice=panel();delete noPrice.sessions[5].prices['上市:2454'];assert.throws(()=>B.monthly(noPrice,{initial:1000},select('2454')));
 const survivor=panel();survivor.snapshots[0].pack.records.pop();assert.throws(()=>B.validateHistory(survivor));
 const timing=panel();timing.snapshots[0].decisionDate='2015-01-01';assert.throws(()=>B.monthly(timing,{initial:1000},select('2330')));
 const empty=panel();assert.throws(()=>B.monthly(empty,{initial:1000},()=>({all:[{score:null}],picks:[]})));
});
