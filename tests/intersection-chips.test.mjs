import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../research-model.js';
import '../chips-model.js';
import '../app-data.js';
const R=QingyuResearch,C=QingyuChips,NOW=Date.parse('2026-10-31T12:00:00+08:00');
const stock={code:'2330',market:'上市',industry:'24',price:100,date:'2026-10-30',valuationDate:'2026-10-30',revenueMonth:'2026-09',pe:12,pb:1.2,yield:5,yoy:20,cumulative:15};
const net=(foreign=1000,trust=500,dealer=-100)=>({foreign,trust,dealer,total:foreign+trust+dealer});
const payload=sessions=>({version:1,meta:{unit:'shares'},markets:{上市:{sessions}}});
const one=payload([{date:stock.date,rows:{2330:net()}}]);
test('multiple strategies use intersection rather than union; missing values fail',()=>{
 assert.ok(R.matchesAll(stock,['growth','income','value','expansion'],NOW));
 assert.ok(!R.matchesAll({...stock,yield:3},['growth','income'],NOW));
 assert.ok(!R.matchesAll({...stock,cumulative:null},['growth','income'],NOW));
 assert.ok(R.matchesAll({...stock,cumulative:null},['income'],NOW));
 assert.deepEqual(R.normalizeStrategies('growth'),['growth']);
 assert.deepEqual(R.normalizeStrategies(['growth','income','growth','unknown']),['growth','income']);
 assert.ok(R.matchesAll(stock,[],NOW));
});
test('stored single strategy migrates to multiple strategies; backups preserve chip filters',()=>{
 const make=settings=>QingyuAppData.normalize({format:'qingyu-local-backup',version:1,settings});
 assert.deepEqual(make({strategy:'growth'}).settings.strategies,['growth']);
 assert.deepEqual(make({strategies:['income','growth'],chipFilter:'trustBuy'}).settings.strategies,['income','growth']);
 assert.equal(make({chipFilter:'trustBuy'}).settings.chipFilter,'trustBuy');
});
test('chip filters distinguish positive, zero and unknown and require same fresh trading date',()=>{
 assert.equal(C.matches(one,stock,'totalBuy',NOW),true);
 assert.equal(C.matches(one,stock,'allBuy',NOW),false);
 assert.equal(C.matches(payload([{date:stock.date,rows:{2330:net(0,0,0)}}]),stock,'totalBuy',NOW),false);
 assert.equal(C.matches(one,{...stock,date:'2026-10-29'},'totalBuy',NOW),false);
 assert.equal(C.matches(one,stock,'totalBuy',NOW+8*86400000),false);
 assert.equal(C.matches(null,stock,'totalBuy',NOW),false);
 assert.equal(C.matches(null,stock,'all',NOW),true);
});
test('history windows and streaks do not bridge missing weekdays or unknown values',()=>{
 const dates=['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30'];
 let data=payload(dates.map(date=>({date,rows:{2330:net()}}))),a=C.analyze(data,stock,NOW);
 assert.equal(a.five.total,7000);assert.equal(a.twenty,null);assert.equal(a.streak.foreign.count,5);assert.equal(a.streak.foreign.exact,false);
 data.markets.上市.sessions[0].rows[2330]=net(-1);a=C.analyze(data,stock,NOW);assert.equal(a.streak.foreign.count,4);assert.equal(a.streak.foreign.exact,true);
 data.markets.上市.sessions.splice(2,1);a=C.analyze(data,stock,NOW);assert.equal(a.five,null);assert.equal(a.streak.foreign.count,2);assert.equal(a.streak.foreign.exact,false);
 data=payload(dates.map(date=>({date,rows:{2330:net()}})));data.markets.上市.sessions[1].rows[2330].foreign=null;assert.equal(C.analyze(data,stock,NOW).five.foreign,null);
});
test('weekend is safe but unverified holiday gaps suppress cumulative windows',()=>{
 assert.equal(C.contiguous([{date:'2026-10-23'},{date:'2026-10-26'}]),true);
 assert.equal(C.contiguous([{date:'2026-10-23'},{date:'2026-10-27'}]),false);
});
test('schema validation rejects duplicate, unsafe or inconsistent history',()=>{
 assert.equal(C.validate(one),one);
 assert.throws(()=>C.validate({...one,meta:{unit:'lots'}}));
 assert.throws(()=>C.validate(payload([{date:stock.date,rows:{2330:{...net(),total:10}}}])));
 assert.throws(()=>C.validate(payload([{date:stock.date,rows:{}},{date:stock.date,rows:{}}])));
});
test('actual screen compute composes all strategies, excluded industries and chip filters',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');const fn=html.slice(html.indexOf('function compute(){'),html.indexOf('\nfunction render(){'));
 const values={query:'',market:'all',maxpe:'',maxpb:'',minyield:'',minyoy:'',sort:'code',complete:''};
 const document={getElementById:id=>({value:values[id]??'',checked:false})};
 const context={QingyuResearch:R,document,stocks:[stock,{...stock,code:'2454',yield:3},{...stock,code:'2881',industry:'17'}],activeStrategies:['growth','income'],excludedIndustries:new Set(['17']),favorites:new Set(),filtered:[],render(){},bounds:id=>values[id]===''?null:Number(values[id]),$:document.getElementById,matchesChipFilter:r=>C.matches(one,r,'totalBuy',NOW)};
 // Production defaults use Date.now; pin to the declared fixture date.
 context.QingyuResearch={...R,matchesAll:(r,ids)=>R.matchesAll(r,ids,NOW)};vm.createContext(context);vm.runInContext(fn+';compute();',context);
 assert.deepEqual(Array.from(context.filtered,r=>r.code),['2330']);
 values.maxpe='10';vm.runInContext('compute()',context);assert.equal(context.filtered.length,0);
});

test('committed real chips reconcile and expose dated coverage for both markets',()=>{
 const data=C.validate(JSON.parse(fs.readFileSync(new URL('../data/chips.json',import.meta.url),'utf8')));
 for(const market of ['上市','上櫃']){const last=data.markets[market].sessions.at(-1);assert.ok(Object.keys(last.rows).length>=300);}
});
