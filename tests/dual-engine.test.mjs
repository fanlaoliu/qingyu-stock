import test from 'node:test';import assert from 'node:assert/strict';
import '../dual-engine/core.js';import '../dual-engine/engine.js';import '../dual-engine/backtest.js';
import {fixture}from './dual-fixture.mjs';
const C=QingyuDualCore,D=QingyuDual,B=QingyuDualBacktest,ASOF='2026-11-07',copy=x=>JSON.parse(JSON.stringify(x));
const pack=()=>C.validate(fixture()),evaluate=p=>D.evaluate(p.records[0],p,ASOF,{},p.benchmark);
test('versioned source and temporal contract rejects malformed dates, units, credentials in URLs, duplicate IDs and nonordinary stocks',()=>{
 for(const change of [p=>p.sources[0].url='https://user:pass@example.org/',p=>p.records[0].code='0050',p=>p.records[0].observations[0].unit='TWD-thousands',p=>p.records[0].observations[0].periodEnd='2022-02-30',p=>p.records[0].observations.push({...p.records[0].observations[0]}),p=>p.records[0].observations[0].value=1e300,p=>p.records[0].observations[0].periodStart='2022-09-01',p=>p.records[0].calendar.push(p.records[0].calendar.at(-1))]){const p=fixture();change(p);assert.throws(()=>C.validate(p));}
});
test('four annual revenues produce exact 3-year CAGR; ROE uses average equity and 3-year median; cash flow sums never EPS proxy',()=>{
 const p=pack(),a=C.annuals(p.records[0],ASOF,p);assert.equal(a.cagr,((180/100)**(1/3)-1)*100);assert.equal(a.profitable,3);assert.equal(a.roeMedian,15e6/90e6*100);assert.equal(a.fcf3,75e6);const r=evaluate(p);assert.equal(r.metrics.revenueGrowth,20-Number.EPSILON*16);assert.equal(r.metrics.roic,20);assert.equal(r.metrics.netDebtEbitda,0);
});
test('future announcements, future obtained vintages and unlicensed observations cannot boost present score',()=>{
 for(const change of [p=>p.records[0].observations.find(o=>o.key==='eps').publishedAt='2026-11-08',p=>p.records[0].observations.find(o=>o.key==='eps').obtainedAt='2026-11-07T17:00:00Z',p=>p.sources[0].authorization='unverified']){const p=fixture();change(p);const r=evaluate(C.validate(p));assert.equal(r.eligible,false);assert.equal(r.score,null);}
 const p=pack(),before=evaluate(p);p.records[0].observations.push({...p.records[0].observations.find(o=>o.key==='eps'),id:'FUTURE',value:100,publishedAt:'2026-11-08',obtainedAt:'2026-11-08T15:00:00+08:00'});assert.deepEqual(evaluate(p).metrics,before.metrics);
});
test('six weights conserve 100; missing factors do not become zero or get reweighted',()=>{
 const p=pack(),r=evaluate(p);assert.equal(Object.values(r.components).reduce((s,c)=>s+c.max,0),100);assert.equal(r.score,Object.values(r.components).reduce((s,c)=>s+c.score,0));assert.ok(r.eligible);
 const missing=pack();missing.records[0].observations=missing.records[0].observations.filter(o=>o.key!=='wacc');const x=evaluate(missing);assert.equal(x.components.quality.score,null);assert.equal(x.score,null);assert.equal(x.eligible,false);
 assert.throws(()=>D.settings({weights:{quality:50}}));assert.throws(()=>D.settings({roe:NaN}));
 const ablated=D.evaluate(missing.records[0],missing,ASOF,{weights:{quality:0,growth:50}},missing.benchmark);assert.equal(ablated.components.quality.score,0);assert.ok(ablated.components.quality.skipped);
});
test('selection is at most five and prioritizes only three; exclusions and fixed score cutoffs remain enforced',()=>{
 const p=pack();p.records=Array.from({length:8},(_,i)=>({...copy(p.records[0]),code:String(2330+i)}));const s=D.select(p,ASOF,{},[],p.benchmark);assert.equal(s.picks.length,5);assert.equal(s.picks.filter(p=>p.priority).length,3);assert.equal(D.select(p,ASOF,{},['24'],p.benchmark).picks.length,0);
 const q=pack();q.records[0].observations=[];assert.equal(D.select(q,ASOF,{},[],q.benchmark).picks.length,0);
});
test('non-general sectors are not silently scored by a generic cash-flow/debt model',()=>{
 for(const model of ['financial','insurance','construction','capital-intensive','cyclical']){const p=pack();p.records[0].model=model;const r=evaluate(p);assert.equal(r.eligible,false);assert.equal(r.components.quality.score,null);assert.ok(r.blocked.some(g=>g.name.includes('產業專屬')));}
 const p=pack();p.records[0].model='cyclical';p.records[0].observations.find(o=>o.key==='operatingProfit'&&o.basis==='TTM').value=-1;assert.ok(evaluate(p).cyclePool);
});
test('two valuation methods share dimensions; FCFE DCF is discounted equity, EV explicitly deducts net debt',()=>{
 const p=pack(),v=evaluate(p).valuation;assert.ok(v.complete);assert.deepEqual(v.methods,['PE','DCF-FCFE','EV/EBITDA']);const pe=v.cases[1].methods.find(m=>m.method==='PE');assert.equal(pe.now,80);assert.equal(pe.one,5*1.08*16);assert.equal(pe.three,5*1.08**3*16);
 const ev=v.cases[1].methods.find(m=>m.method==='EV/EBITDA');assert.equal(ev.now,100e6*8/10e6);assert.ok(v.cases[1].methods.find(m=>m.method==='DCF-FCFE').now>0);
 const both=copy(p);both.records[0].observations.find(o=>o.key==='netDebt').value=10e6;const w=evaluate(both).valuation;assert.equal(w.cases[1].methods.find(m=>m.method==='EV/EBITDA').now,79);assert.equal(w.cases[1].methods.find(m=>m.method==='DCF-FCFE').now,v.cases[1].methods.find(m=>m.method==='DCF-FCFE').now);
});
test('no indirect EPS, no one-method certification, no infinite risk-reward; disagreement triggers review',()=>{
 const p=pack();p.records[0].observations=p.records[0].observations.filter(o=>!['fcfe','ebitda'].includes(o.key));assert.equal(evaluate(p).valuation.complete,false);
 const q=pack();q.records[0].observations=q.records[0].observations.filter(o=>o.key!=='eps');assert.equal(evaluate(q).valuation.cases[1].eps12,null);assert.equal(evaluate(q).valuation.complete,false);
 const low=pack();low.records[0].bars.at(-1).close=10;const v=evaluate(low).valuation;assert.equal(v.downside,0);assert.equal(v.rewardRisk,null);assert.equal(v.complete,false);
 const gap=pack();gap.records[0].observations.find(o=>o.key==='fcfe').value=1e6;assert.ok(evaluate(gap).valuation.problems.some(s=>s.includes('差異')));
});
test('joint 20% earnings and multiple shocks produce 64% reference, not a 20% maximum loss promise',()=>{const v=evaluate(pack()).valuation;assert.equal(v.stress.bothDown20,v.stress.reference*.64);assert.equal(v.stress.epsDown20,v.stress.reference*.8);assert.ok(v.note.includes('假設'));assert.throws(()=>D.settings({scenarios:D.DEFAULTS.scenarios.map(s=>({...s,discount:5,terminal:5}))}));});
test('candles aggregate exact OHLC, volume and calendar week/month; all MAs require full periods',()=>{
 const p=pack(),bars=p.records[0].bars,a=C.aggregate(bars,'monthly'),last=a.at(-1),same=bars.filter(b=>b.date.startsWith(last.date.slice(0,7)));assert.equal(last.open,same[0].open);assert.equal(last.close,same.at(-1).close);assert.equal(last.high,Math.max(...same.map(b=>b.high)));assert.equal(last.volume,same.reduce((s,b)=>s+b.volume,0));
 const t=C.indicators(bars,ASOF);assert.equal(t[3].ma5,null);assert.equal(t[4].ma5,C.avg(bars.slice(0,5).map(b=>b.close)));assert.equal(t[238].ma240,null);assert.ok(t[239].ma240);assert.equal(t[24].macd,null);assert.equal(t[32].signal,null);assert.ok(C.F(t[33].signal));
});
test('technical formulas ignore future bars, missing calendar sessions suppress 60-day liquidity certification',()=>{
 const p=pack(),r=evaluate(p),later=copy(p);later.records[0].bars.push({date:'2026-11-09',open:1,high:1,low:1,close:1,volume:1,amount:1});assert.deepEqual(evaluate(later).technical,r.technical);
 const g=pack();g.records[0].bars.splice(-10,1);assert.equal(evaluate(g).technical.continuous,false);assert.equal(evaluate(g).eligible,false);
});
test('5/20/60 institutional sums use declared trading calendar; null is not zero and duplicate total foreign dealer is rejected',()=>{
 const p=pack(),r=evaluate(p);assert.equal(r.chips.windows[5].total,50000);assert.equal(r.chips.windows[20].total,200000);assert.equal(r.chips.windows[60].total,600000);assert.ok(r.chips.synchronized);
 const q=pack();q.records[0].flows.splice(-7,1);assert.equal(evaluate(q).chips.windows[20].total,null);assert.equal(evaluate(q).score,null);
 const b=fixture();b.records[0].flows[0].total+=1;assert.throws(()=>C.validate(b));
});
test('cross examination contains three rounds, at least three objections each, evidence and unresolved hypotheses, never masquerades as AI',()=>{
 const r=evaluate(pack()),v=D.crossReview(r);assert.equal(v.rounds.length,3);assert.ok(v.rounds.every(r=>r.b.length>=3));assert.equal(v.mode,'deterministic-cross-review');assert.equal(v.independentSources,false);assert.ok(v.rounds[1].b[2].response.includes(nf(r.valuation.stress.bothDown20)));assert.ok(v.unresolved.length);
 function nf(x){return x.toFixed(2);}
});
test('risk budget respects initial, issuer, industry and liquidity caps; 10/15/20 review is not an automatic order',()=>{
 const input={capital:1000000,price:100,atr:2,avgAmount60:100000000,existingStock:0,existingIndustry:0,entryPrice:100};const r=D.sizePosition(input);assert.equal(r.shares,300);assert.equal(r.amount,30000);assert.equal(r.riskDistance,25);
 assert.equal(D.sizePosition({...input,existingIndustry:250000}).shares,0);assert.equal(D.sizePosition({...input,price:79}).stage,'原則退出研究／事前核准例外');assert.equal(D.sizePosition({...input,price:85}).stage,'強制風險審查');assert.ok(D.sizePosition({...input,portfolioPeak:1000000,portfolioNow:890000}).portfolioReview);assert.throws(()=>D.sizePosition({...input,capital:NaN}));
});
test('performance stats include fees indirectly through equity, calendar CAGR, sample Sharpe and null zero-risk ratios',()=>{
 const curve=[{date:'2020-01-01',equity:100},{date:'2020-06-01',equity:80},{date:'2021-01-01',equity:120}],bench=curve.map(p=>({date:p.date,close:100})),s=B.statistics(curve,bench,100);assert.equal(s.maxDrawdown,20-Number.EPSILON*16);assert.ok(s.cagr>19&&s.cagr<20.1);assert.ok(s.calmar>0);assert.equal(s.winRate,null);
 const flat=curve.map(p=>({...p,equity:100})),f=B.statistics(flat,bench,100);assert.equal(f.sharpe,null);assert.equal(f.calmar,null);
});
test('full-market backtest refuses current-only, absent delisted universe, missing PIT, wrong adjustment or mismatched benchmark',()=>{
 for(const obj of [{},{version:1,kind:'monthly-pit-history',adjustment:'raw',master:[],sessions:[],snapshots:[],benchmark:[]}])assert.throws(()=>B.monthly(obj));
});
test('inclusive percentage thresholds do not lose points to floating-point 20-minus-epsilon, and weekly MA samples last session',()=>{const p=pack(),r=D.evaluate(p.records[0],p,ASOF,{ttmRevenueGrowth:20},p.benchmark);assert.equal(r.components.growth.score,20);assert.ok(r.gates.find(g=>g.name.startsWith('TTM營收年增')).status==='pass');const daily=C.indicators(p.records[0].bars,ASOF),weekly=C.aggregate(daily,'weekly');assert.equal(weekly.at(-1).ma20,daily.at(-1).ma20);});
