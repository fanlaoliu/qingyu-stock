import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../research-model.js';
const R=globalThis.QingyuResearch,now=Date.parse('2026-11-01T12:00:00+08:00');
const stock={code:'2330',price:100,date:'2026-10-30',valuationDate:'2026-10-30',revenueMonth:'2026-09',pe:15,pb:1.5,yoy:10,cumulative:1,yield:4};
test('diagnostics distinguish unavailable evidence from failed thresholds and preserve valid zeros',()=>{
 assert.equal(R.diagnose(stock,'growth',now).status,'pass');
 assert.equal(R.diagnose({...stock,yoy:null},'growth',now).status,'unavailable');
 const failed=R.diagnose({...stock,yoy:0,cumulative:0},'growth',now);
 assert.equal(failed.status,'fail');assert.equal(failed.reasons.length,2);
 assert.equal(R.diagnose({...stock,yoy:0},'value',now).status,'pass');
 for(const change of [{date:'2026-02-30'},{date:'2026-11-02'},{valuationDate:null},{revenueMonth:'2025-01'},{price:NaN},{code:'0050'}])assert.equal(R.diagnose({...stock,...change},'growth',now).status,'unavailable');
 assert.equal(R.diagnose(null,'growth',now).status,'unavailable');
 assert.equal(R.diagnose(stock,'unknown',now).status,'unavailable');
});
test('diagnostic UI updates on input, selection and exclusions without inserting stock names as HTML',()=>{
 const source=fs.readFileSync(new URL('../research-ui.js',import.meta.url),'utf8');
 const code=source.slice(source.indexOf(' const diagnostics='),source.indexOf(" const heatControls="));
 const nodes=new Map();
 const element=()=>({children:[],value:'',className:'',addEventListener(name,fn){this[name]=fn;},after(){},replaceChildren(){this.children=[];this.textContent='';},append(...children){this.children.push(...children);}});
 const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
 class Clock extends Date{static now(){return now;}}
 const context={R,Date:Clock,document:{createElement:element},$r:get,stocks:[{...stock,name:'<img src=x onerror=alert(1)>',industry:'24'}],activeStrategies:[],excludedIndustries:new Set(),esc:String};
 vm.createContext(context);vm.runInContext(code+';drawDiagnostics(stocks,Date.now());',context);
 get('diagnosticCode').value='2330';get('diagnosticCode').input();
 let paragraphs=get('strategyDiagnosticResult').children;
 assert.equal(paragraphs.length,6);assert.match(paragraphs[0].textContent,/<img/);assert.equal(paragraphs[0].innerHTML,undefined);
 context.activeStrategies=['growth'];context.excludedIndustries.add('24');vm.runInContext('drawDiagnostics([],Date.now())',context);
 paragraphs=get('strategyDiagnosticResult').children;assert.equal(paragraphs.length,4);assert.match(paragraphs[1].textContent,/行業已被排除/);assert.match(paragraphs[2].textContent,/通過策略門檻/);
 get('diagnosticCode').value='999999';get('diagnosticCode').input();assert.match(get('strategyDiagnosticResult').textContent,/找不到/);
 assert.match(get('strategyDiagnosticsSummary').innerHTML,/排除行業後 0 檔/);
});
test('all real snapshot explanations agree with strategy eligibility and membership; counts partition sample',()=>{
 const rows=JSON.parse(fs.readFileSync(new URL('../data/stocks.json',import.meta.url),'utf8')).stocks;
 for(const s of R.strategies){
  const counts=R.strategySummary(rows,s.id,now);
  assert.equal(counts.total,counts.pass+counts.unavailable+counts.fail);
  for(const row of rows){const d=R.diagnose(row,s.id,now);assert.equal(d.status==='pass',R.matches(row,s.id,now));assert.equal(d.status!=='unavailable',R.eligible(row,s.id,now));if(d.status!=='pass')assert.ok(d.reasons.length);}
 }
});
