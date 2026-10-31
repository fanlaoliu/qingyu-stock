import test from 'node:test';
import assert from 'node:assert/strict';
import '../research-model.js';
import snapshot from '../data/stocks.json' with {type:'json'};
const R=globalThis.QingyuResearch,NOW=Date.parse('2026-10-31T12:00:00+08:00');
const row={code:'2330',market:'上市',price:100,date:'2026-10-30',valuationDate:'2026-10-30',revenueMonth:'2026-09',pe:20,pb:1.2,yield:5,yoy:20,cumulative:15};
test('multiple excluded industries remove only matching categories, including normalized codes',()=>{
 const excluded=new Set(['17','24','01']);
 for(const industry of ['17',24,' 24 ','1','01'])assert.equal(R.included({industry},excluded),false);
 assert.equal(R.included({industry:'28'},excluded),true);
 assert.equal(R.included({industry:null},excluded),true);
 assert.equal(R.included({industry:''},new Set(['__unclassified__'])),false);
 assert.equal(R.industryLabel('24'),'半導體業（24）');
});
test('saved exclusions tolerate missing/invalid older settings without excluding everything',()=>{
 assert.deepEqual(R.normalizeExclusions(undefined),[]);
 assert.deepEqual(R.normalizeExclusions('24'),[]);
 assert.deepEqual(R.normalizeExclusions(['24',null,'24',17,'']),['24']);
 const excluded=new Set(['24','17']);
 const rows=snapshot.stocks.filter(r=>R.included(r,excluded));
 assert.ok(rows.length<snapshot.stocks.length);
 assert.ok(rows.every(r=>!excluded.has(R.industryKey(r))));
 assert.ok(rows.length>0);
});
test('strategy thresholds are distinct and boundary-inclusive',()=>{
 assert.equal(R.matches({...row,pe:30,yoy:10,cumulative:.01},'growth',NOW),true);
 assert.equal(R.matches({...row,pe:30.01},'growth',NOW),false);
 assert.equal(R.matches({...row,pe:15,pb:1.5,yoy:0},'value',NOW),true);
 assert.equal(R.matches({...row,pe:15,pb:1.51},'value',NOW),false);
 assert.equal(R.matches({...row,yield:4,yoy:null,cumulative:null,revenueMonth:null},'income',NOW),true);
 assert.equal(R.matches({...row,pe:50,yoy:20,cumulative:10},'expansion',NOW),true);
 assert.equal(R.matches({...row,pe:50.01},'expansion',NOW),false);
});
test('missing data, ETF rows, future/stale prices and mismatched periods do not pass',()=>{
 for(const delta of [{pe:null},{cumulative:null},{revenueMonth:null},{price:null},{price:0},{code:'0050'},{date:'2026-10-01'},{date:'2026-11-01'},{valuationDate:'2026-10-29'},{revenueMonth:'2026-01'},{revenueMonth:'2026-13'}])assert.equal(R.matches({...row,...delta},'growth',NOW),false,JSON.stringify(delta));
 assert.equal(R.matches(row,'unknown',NOW),false);
});
test('negative/zero PE and unknown fiscal periods do not masquerade as value',()=>{
 for(const pe of [0,-1])assert.equal(R.matches({...row,pe},'value',NOW),false);
 assert.equal(R.matches({...row,pe:10,revenueMonth:null},'value',NOW),false);
});
test('equal amount allocation preserves every dollar, including tiny and large budgets',()=>{
 for(const plan of R.allocations)for(const amount of [0,1,2,7,101,9999,10000,1000000000]){
  const split=R.allocate(amount,plan.weights);assert.equal(split.reduce((a,b)=>a+b,0),amount);assert.ok(split.every(Number.isInteger));
  split.forEach((v,i)=>assert.ok(Math.abs(v-amount*plan.weights[i]/100)<1));
 }
 assert.deepEqual(R.allocate(10000,[60,30,10]),[6000,3000,1000]);
});
test('invalid budgets and malformed percentages are rejected',()=>{
 for(const amount of [-1,NaN,Infinity,1.5,1000000001])assert.equal(R.allocate(amount,[60,30,10]),null);
 for(const weights of [[60,30,20],[60,-10,50],[100],[20,30,NaN]])assert.equal(R.allocate(10000,weights),null);
});
test('color clipping preserves direction while null never equals numerical zero',()=>{
 assert.notEqual(R.color('yoy',-20),R.color('yoy',20));
 assert.notEqual(R.color('yoy',null),R.color('yoy',0));
 assert.equal(R.color('yoy',5000),R.color('yoy',50));
 assert.equal(R.color('pb',60),R.color('pb',6));
 assert.equal(R.color('yield',0),'rgb(20,43,58)');
});
test('real snapshot strategy candidates satisfy every declared condition',()=>{
 for(const s of R.strategies){
  const snapshotNow=Date.parse(snapshot.meta.trade_date+'T12:00:00+08:00');
  const candidates=snapshot.stocks.filter(r=>R.matches(r,s.id,snapshotNow));
  assert.ok(candidates.length>0,s.id);
  for(const r of candidates){assert.ok(s.test(r));assert.equal(r.valuationDate,r.date);assert.ok(R.equity(r));}
 }
});
