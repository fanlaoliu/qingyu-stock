import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../research-model.js';
import '../chips-model.js';
import '../priority-model.js';
const P=QingyuPriority,NOW=Date.parse('2026-10-31T12:00:00+08:00');
const strong={code:'2330',name:'測試強訊號',market:'上市',industry:'24',price:100,date:'2026-10-30',valuationDate:'2026-10-30',revenueMonth:'2026-09',pe:15,pb:1.5,yield:4,yoy:20,cumulative:10};
const analysis={usable:true,date:'2026-10-30',row:{foreign:1000,trust:500,dealer:1,total:1501}};
const weak={...strong,code:'2454',name:'測試弱訊號',pe:-1,pb:-1,yield:0,yoy:-1,cumulative:-1};
const selling={...analysis,row:{foreign:-1,trust:-2,dealer:-3,total:-6}};
test('documented weights total 100; explicit thresholds and component sum match',()=>{
 const full=P.evaluate(strong,analysis,NOW);assert.equal(full.score,100);assert.equal(full.band,'優先研究');assert.equal(full.parts.reduce((s,p)=>s+p.max,0),100);
 const mid=P.evaluate({...strong,pe:30,pb:3,yield:2,yoy:10,cumulative:1},selling,NOW);assert.equal(mid.score,45);assert.equal(mid.band,'訊號偏弱');
 const low=P.evaluate(weak,selling,NOW);assert.equal(low.score,0);assert.equal(low.band,'訊號偏弱');
 assert.equal(P.evaluate({...strong,pe:15.01,pb:1.51,yield:3.99,yoy:19.99,cumulative:9.99},analysis,NOW).score,70);
});
test('missing, stale and mismatched periods do not become a low recommendation score',()=>{
 for(const delta of [{pe:null},{pb:null},{yield:null},{yoy:null},{cumulative:null},{valuationDate:null},{valuationDate:'2026-10-29'},{revenueMonth:'2026-01'},{date:'2026-10-01'},{date:'2026-11-01'},{price:0},{code:'0050'},{yield:-1}]){
  const e=P.evaluate({...strong,...delta},analysis,NOW);assert.equal(e.score,null,JSON.stringify(delta));assert.equal(e.band,'資料待補');assert.ok(e.missing.length);
 }
 for(const a of [null,{...analysis,usable:false},{...analysis,row:{...analysis.row,trust:null}},{...analysis,row:{...analysis.row,total:1}}])assert.equal(P.evaluate(strong,a,NOW).score,null);
});
test('zero institutional flows are valid neutral evidence; missing flows never become zero',()=>{
 const neutral={...analysis,row:{foreign:0,trust:0,dealer:0,total:0}};
 assert.equal(P.evaluate(strong,neutral,NOW).score,75);
 assert.equal(P.evaluate(strong,{...neutral,row:{...neutral.row,dealer:null}},NOW).score,null);
});
test('sorts best to weakest with unknowns last, deterministic ties, and no mutation',()=>{
 const rows=[{...strong,code:'3000',pb:null},weak,{...strong,code:'2400'},strong];const before=[...rows];
 const ranked=P.rank(rows,r=>r.code==='2454'?selling:analysis,NOW);
 assert.deepEqual(ranked.map(x=>x.stock.code),['2330','2400','2454','3000']);assert.deepEqual(ranked.map(x=>x.evaluation.score),[100,100,0,null]);assert.deepEqual(rows,before);
});
test('current chip data must align with each stock date before awarding chip points',()=>{
 const payload={version:1,meta:{unit:'shares'},markets:{上市:{sessions:[{date:'2026-10-29',rows:{2330:analysis.row}}]}}};
 assert.equal(P.evaluate(strong,QingyuChips.analyze(payload,strong,NOW),NOW).score,null);
});
test('actual heatmap draw uses priority by default and recalculates after async chips arrive',()=>{
 const source=fs.readFileSync(new URL('../research-ui.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf(' function periodKnown('),source.indexOf(' heatControls.forEach'));
 const fields={heatMetric:{value:'yoy'},heatMarket:{value:'all'},heatIndustry:{value:'all'},heatSearch:{value:''},heatScope:{value:'all'},heatKnownPeriods:{checked:true},heatSort:{value:'priority'},heatLimit:{value:'all'},heatCaption:{},heatLegend:{},heatGrid:{},heatInspector:{append(p){this.explanation=p.textContent;}}};
 let ready=false;
 class Clock extends Date{static now(){return NOW;}}
 const context={Date:Clock,QingyuPriority:{...P,rank:(rows,lookup)=>P.rank(rows,lookup,NOW),evaluate:(r,a)=>P.evaluate(r,a,NOW)},R:QingyuResearch,$r:id=>fields[id],document:{createElement:()=>({})},stocks:[weak,strong,{...strong,code:'3000',pb:null}],filtered:[],favorites:new Set(),excludedIndustries:new Set(),esc:s=>String(s??''),display:v=>String(v),analyzeChipStock:r=>ready?(r.code==='2454'?selling:analysis):null};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf(' const metricValue='),source.indexOf(' function syncExclusions'))+code+';drawHeatmap();',context);assert.ok(fields.heatCaption.textContent.includes('可評分 0 檔'));assert.ok(fields.heatGrid.innerHTML.includes('資料待補'));
 ready=true;vm.runInContext('drawHeatmap();inspect(stocks[1],"yoy");',context);
 const grid=fields.heatGrid.innerHTML;assert.ok(grid.indexOf('data-heat-code="2330"')<grid.indexOf('data-heat-code="2454"'));assert.ok(grid.indexOf('data-heat-code="2454"')<grid.indexOf('data-heat-code="3000"'));assert.ok(grid.includes('#1 優先研究 100/100'));assert.ok(fields.heatInspector.explanation.includes('月營收成長 15/15'));
 context.excludedIndustries.add('24');vm.runInContext('drawHeatmap()',context);assert.ok(fields.heatGrid.innerHTML.includes('沒有符合條件'));
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');assert.match(html,/<select id="heatSort"><option value="priority">/);
});
test('committed snapshot scores stay bounded and fully explained for every ranked stock',()=>{
 const data=JSON.parse(fs.readFileSync(new URL('../data/stocks.json',import.meta.url))),chips=QingyuChips.validate(JSON.parse(fs.readFileSync(new URL('../data/chips.json',import.meta.url))));
 const now=Date.parse(data.meta.trade_date+'T12:00:00+08:00');const ranked=P.rank(data.stocks,r=>QingyuChips.analyze(chips,r,now),now);
 assert.ok(ranked.some(x=>x.evaluation.score!==null));assert.ok(ranked.some(x=>x.evaluation.score===null));
 for(let i=0;i<ranked.length;i++){
  const e=ranked[i].evaluation;if(e.score!==null){assert.ok(e.score>=0&&e.score<=100);assert.equal(e.score,e.parts.reduce((s,p)=>s+p.value,0));assert.equal(e.missing.length,0);}
  if(i)assert.ok(P.compare(ranked[i-1],ranked[i])<=0);
 }
});
