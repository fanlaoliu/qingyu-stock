import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
function setup(connected=true){
 const opener={isConnected:connected,focus(){this.focused=true;}};
 const nodes={};
 for(const id of ['stockDetail','detailTitle','detailNote','stockTableRegion'])nodes[id]={focus(){this.focused=true;},scrollIntoView(){}};
 const context=vm.createContext({document:{activeElement:opener,getElementById:id=>nodes[id]},$:id=>nodes[id],stocks:[{code:'2330',name:'台積電'}],selectedStockCode:null,showDetailQuality(){},enrichDetail(){},localStorage:{getItem(){return '原有筆記';}}});
 const functions=html.split('\n').filter(l=>l.startsWith('function openStock(')||l.startsWith('function closeStockDetail(')).join('\n');
 vm.runInContext('let detailReturnTarget=null;'+functions,context);
 return {context,nodes,opener};
}
test('opening a stock focuses its named detail heading; closing restores the originating control',()=>{
 const {context,nodes,opener}=setup();
 vm.runInContext("openStock('2330')",context);
 assert.equal(nodes.detailTitle.focused,true);
 assert.equal(nodes.detailTitle.textContent,'2330 台積電｜個股研究卡');
 assert.equal(nodes.detailNote.value,'原有筆記');
 assert.equal(nodes.stockDetail.hidden,false);
 vm.runInContext('closeStockDetail()',context);
 assert.equal(nodes.stockDetail.hidden,true);assert.equal(opener.focused,true);
});
test('closing after a table rerender falls back to the keyboard accessible results region',()=>{
 const {context,nodes,opener}=setup(false);
 vm.runInContext("openStock('2330');closeStockDetail()",context);
 assert.equal(nodes.stockTableRegion.focused,true);assert.equal(opener.focused,undefined);
});
test('unknown stock does not move focus or open details',()=>{
 const {context,nodes}=setup();
 vm.runInContext("openStock('missing')",context);
 assert.equal(nodes.detailTitle.focused,undefined);assert.equal(nodes.stockDetail.hidden,undefined);
});
test('results expose column headers, a caption and a labelled keyboard scroll region',()=>{
 const section=html.slice(html.indexOf('<section class="results">'),html.indexOf('<footer>'));
 assert.match(section,/id="stockTableRegion"[^>]*role="region"[^>]*aria-labelledby="resultsTitle"[^>]*aria-describedby="stockScrollHint paginationLabel"[^>]*tabindex="0"/);
 assert.equal((section.match(/<th scope="col">/g)||[]).length,10);
 assert.match(section,/<caption[^>]*>股票篩選結果與盤後指標<\/caption>/);
});
test('Escape in the detail region closes it and restores focus',()=>{
 const {context,nodes,opener}=setup();let keydown;
 nodes.stockDetail.addEventListener=(name,handler)=>{assert.equal(name,'keydown');keydown=handler;};
 vm.runInContext(html.split('\n').find(l=>l.startsWith("document.getElementById('stockDetail').addEventListener('keydown'")),context);
 vm.runInContext("openStock('2330')",context);
 keydown({key:'ArrowDown'});assert.equal(nodes.stockDetail.hidden,false);
 let prevented=false;keydown({key:'Escape',preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(nodes.stockDetail.hidden,true);assert.equal(opener.focused,true);
});
function pagination(count){
 const nodes={};
 for(const id of ['rows','matched','resultHint','paginationLabel','prev','next','stockTableRegion'])nodes[id]={focus(){this.focused=true;},scrollIntoView(){this.scrolled=true;}};
 const context=vm.createContext({$:id=>nodes[id],page:0,PAGE_SIZE:2,filtered:Array.from({length:count},(_,i)=>({code:String(1000+i),name:'測試股票',market:'上市'})),favorites:new Set(),esc:String,display:x=>x??'—'});
 vm.runInContext(html.split('\n').filter(l=>l.startsWith('function render(')||l.startsWith('function changeResultPage(')).join('\n'),context);
 vm.runInContext('render()',context);
 return {nodes,context};
}
test('paging renders the next rows, announces the range and moves focus to results',()=>{
 const {nodes,context}=pagination(5);
 assert.equal(nodes.paginationLabel.textContent,'1–2 / 5');assert.equal(nodes.prev.disabled,true);
 vm.runInContext('changeResultPage(1)',context);
 assert.equal(nodes.paginationLabel.textContent,'3–4 / 5');assert.match(nodes.rows.innerHTML,/1002/);assert.doesNotMatch(nodes.rows.innerHTML,/1000/);
 assert.equal(nodes.stockTableRegion.focused,true);assert.equal(nodes.stockTableRegion.scrolled,true);
 vm.runInContext('changeResultPage(1)',context);
 assert.equal(nodes.paginationLabel.textContent,'5–5 / 5');assert.equal(nodes.next.disabled,true);
 vm.runInContext('changeResultPage(1)',context);assert.equal(context.page,2);
 vm.runInContext('changeResultPage(-1)',context);assert.equal(nodes.paginationLabel.textContent,'3–4 / 5');
});
test('empty results and first page cannot navigate outside the available pages or steal focus',()=>{
 for(const count of [0,1]){
  const {nodes,context}=pagination(count);
  vm.runInContext('changeResultPage(-1);changeResultPage(1)',context);
  assert.equal(context.page,0);assert.equal(nodes.prev.disabled,true);assert.equal(nodes.next.disabled,true);assert.equal(nodes.stockTableRegion.focused,undefined);
  if(count===0){assert.equal(nodes.paginationLabel.textContent,'0 筆');assert.match(nodes.rows.innerHTML,/沒有符合條件/);}
 }
});
test('pagination range is an atomic polite status associated with the scroll region',()=>{
 assert.match(html,/<span id="paginationLabel" role="status" aria-live="polite" aria-atomic="true">/);
});
