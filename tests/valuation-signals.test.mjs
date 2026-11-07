import test from 'node:test';
import assert from 'node:assert/strict';
import '../dual-engine/core.js';
import '../dual-engine/engine.js';
import {fixture} from './dual-fixture.mjs';
const C=QingyuDualCore,D=QingyuDual,ASOF='2026-11-07';
const evaluate=raw=>{const p=C.validate(raw);return D.evaluate(p.records[0],p,ASOF,{},p.benchmark);};
const copy=x=>structuredClone(x);
const signal=r=>D.valuationSignal(r,{sourceReady:true,priceConsistent:true});
test('only complete qualifying low valuations produce a research-buy signal, not an order or score change',()=>{
 const r=evaluate(fixture());assert.equal(r.eligible,true);assert.equal(r.valuationSignal.kind,'buy-research');assert.equal(r.valuationSignal.label,'估值偏低，可研究買入');assert.ok(r.valuationSignal.reasons.some(x=>x.includes('人工覆核')));assert.equal(r.valuationSignal.priceDate,'2026-11-06');assert.equal(r.valuationSignal.buyBelow,r.valuation.buyBelow);const score=r.score;signal(r);assert.equal(r.score,score);
});
test('cheap price without cashflow quality stays watch-only; specialized sectors never get buy signals',()=>{
 const raw=fixture();raw.records[0].observations=raw.records[0].observations.filter(o=>!(o.key==='ocf'&&o.basis==='annual'));const r=evaluate(raw);assert.equal(r.valuation.complete,true);assert.equal(r.valuationSignal.kind,'undervalued-watch');assert.ok(r.valuationSignal.reasons.includes('三年累計FCF為正'));
 const sector=copy(evaluate(fixture()));sector.model='financial';assert.equal(signal(sector).kind,'review');
});
test('high signal requires both 20% premium to median fair value and price above method range',()=>{
 const raw=fixture();raw.records[0].bars.at(-1).close=120;raw.records[0].bars.at(-1).high=121;raw.records[0].bars.at(-1).open=119;const r=evaluate(raw);assert.equal(r.valuationSignal.kind,'overvalued');assert.ok(r.valuationSignal.overvaluationPercent>=20);
 const middle=copy(r);middle.valuation.price=85;assert.equal(signal(middle).kind,'fair');
 const boundary=copy(r);boundary.valuation.price=boundary.valuation.cases[1].fair*1.2;assert.equal(signal(boundary).kind,'overvalued');
});
test('stale or future quote, unconfirmed source, inconsistent quote and missing methods suppress buy signals',()=>{
 const r=evaluate(fixture());for(const date of ['2026-10-20','2026-11-08']){const x=copy(r);x.valuation.priceDate=date;assert.equal(signal(x).kind,'unavailable');}
 assert.equal(D.valuationSignal(r).kind,'unavailable');assert.equal(D.valuationSignal(r,{sourceReady:true,priceConsistent:false}).kind,'unavailable');
 const missing=copy(r);missing.valuation.cases[1].range=null;assert.equal(signal(missing).kind,'unavailable');
 const source=fixture();source.sources[0].authorization='unverified';assert.equal(evaluate(source).valuationSignal.kind,'unavailable');
});
test('method disagreement and unresolved scenario risk request review instead of a cheap-buy signal',()=>{
 const r=evaluate(fixture());for(const change of [x=>x.valuation.cases[1].disagreement=30.001,x=>x.valuation.complete=false]){const x=copy(r);change(x);assert.equal(signal(x).kind,'review');}
});
test('synthetic inputs never emit real price or buy alerts and missing finance never becomes zero',()=>{
 const raw=fixture();raw.synthetic=true;assert.equal(evaluate(raw).valuationSignal.kind,'synthetic');const empty=fixture();empty.records[0].observations=[];const r=evaluate(empty);assert.equal(r.valuationSignal.kind,'unavailable');assert.equal(r.valuationSignal.margin,null);
});
test('low price boundary uses configured margin but remains below the valuation range',()=>{
 const r=copy(evaluate(fixture()));r.valuation.assumptions.margin=20;r.valuation.cases[1].margin=20-Number.EPSILON*16;assert.equal(signal(r).kind,'buy-research');r.valuation.cases[1].margin=19.9;assert.equal(signal(r).kind,'fair');
});
test('screen cache refuses an alert calculated from a different price, date or market',async()=>{
 const fs=await import('node:fs');const vm=await import('node:vm');const text=fs.readFileSync('dual-engine/ui.js','utf8');const start=text.indexOf('globalThis.QingyuValuationSignals=');const stop=text.indexOf('\nfunction signalHTML',start);assert.ok(start>=0&&stop>start);
 const good=evaluate(fixture()).valuationSignal;const ctx={C,signalMap:new Map([['上市:2330',good]])};vm.runInNewContext(text.slice(start,stop),ctx);const get=ctx.QingyuValuationSignals.get;
 assert.equal(get('2330','上市',{date:'2026-11-06',price:59.5}).kind,'buy-research');for(const quote of [{date:'2026-11-05',price:59.5},{date:'2026-11-06',price:60},{date:'2026-11-06',price:null}])assert.equal(get('2330','上市',quote).kind,'unavailable');assert.equal(get('2330','上櫃').kind,'unavailable');
});
test('missing stock after a dataset switch clears the preceding detail and buy signal',async()=>{
 const fs=await import('node:fs');const vm=await import('node:vm');const text=fs.readFileSync('dual-engine/ui.js','utf8'),start=text.indexOf('function inspect(code)'),stop=text.indexOf('\nfunction evidence()',start);assert.ok(start>=0&&stop>start);
 const nodes={dualStatus:{textContent:''},dualDetail:{hidden:false},dualPriceSignal:{textContent:'估值偏低，可研究買入'},dualContent:{textContent:'上一檔資料'}};const ctx={pack:{records:[]},current:{code:'2002'},currentRecord:{code:'2002'},$:id=>nodes[id]};vm.runInNewContext(text.slice(start,stop)+';inspect("9999");',ctx);
 assert.equal(ctx.current,null);assert.equal(ctx.currentRecord,undefined);assert.equal(nodes.dualDetail.hidden,true);assert.equal(nodes.dualPriceSignal.textContent,'');assert.equal(nodes.dualContent.textContent,'');assert.match(nodes.dualStatus.textContent,/已清除/);
});
