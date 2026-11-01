import test from 'node:test';
import assert from 'node:assert/strict';
import '../research-model.js';
import '../priority-model.js';
import '../scoring-model.js';
const now=Date.parse('2026-11-01T12:00:00+08:00');
const stock={code:'2330',market:'上市',date:'2026-10-30',valuationDate:'2026-10-30',price:100};
const evidence=Object.fromEntries(Object.keys(QingyuScoring.weights).map(key=>[key,{code:stock.code,market:stock.market,asOf:stock.date,sourceUrl:'https://www.twse.com.tw/',methodology:'test fixture only',verified:true,score:80}]));
test('complete evidence uses exactly 50/25/15/10, keeping genuine zero scores',()=>{
 assert.equal(QingyuScoring.evaluate(stock,evidence,now).score,80);
 const zero=structuredClone(evidence);for(const e of Object.values(zero))e.score=0;
 assert.equal(QingyuScoring.evaluate(stock,zero,now).score,0);
});
test('missing or invalid evidence never redistributes weight or emits a total',()=>{
 for(const change of [null,{score:null},{score:NaN},{score:101},{verified:false},{asOf:'2026-10-29'},{code:'2454'},{market:'上櫃'},{sourceUrl:'javascript:alert(1)'},{methodology:''}]){
  const e=structuredClone(evidence);e.popularity=change===null?null:{...e.popularity,...change};
  const result=QingyuScoring.evaluate(stock,e,now);assert.equal(result.score,null);assert.equal(result.complete,false);assert.equal(result.availableWeight,85);
 }
 assert.equal(QingyuScoring.evaluate({...stock,date:'2026-09-01'},evidence,now).score,null);
});
test('current official adapter only enables complete aligned chips, never invents other factors',()=>{
 const a={usable:true,date:stock.date,row:{foreign:10,trust:0,dealer:-10,total:0}};
 const result=QingyuScoring.current(stock,a,now);
 assert.equal(result.score,null);assert.equal(result.availableWeight,25);
 assert.equal(result.parts.find(p=>p.key==='chips').value,10);
 assert.equal(QingyuScoring.current(stock,{...a,date:'2026-10-29'},now).availableWeight,0);
});
