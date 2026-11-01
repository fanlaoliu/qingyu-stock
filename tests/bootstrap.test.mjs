import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const inline=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(m=>m[1]).filter(s=>s.trim()).join('\n');
function element(){return {value:'',checked:false,hidden:false,style:{},dataset:{},parentElement:{style:{}},classList:{toggle(){}},addEventListener(){},setAttribute(){},append(){},after(){},replaceChildren(){},insertAdjacentHTML(){}};}
async function boot(fail=false){
 const nodes=new Map();const get=id=>{if(!nodes.has(id))nodes.set(id,element());return nodes.get(id);};
 get('market').value='all';get('sort').value='code';
 const requests=[];
 const context=vm.createContext({URL,URLSearchParams,AbortSignal,console,
  localStorage:{getItem(){return null;}},location:{href:'https://research.example/',search:''},history:{replaceState(){}},window:{scrollTo(){}},
  document:{body:{dataset:{}},getElementById:get,querySelector:get,querySelectorAll(){return [];},createElement:element},
  // Browser named properties expose elements before later scripts install hooks.
  refreshChips:get('refreshChips'),
  fetch:async url=>{requests.push(url);if(fail)throw Error('offline');return {ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('../data/stocks.json',import.meta.url),'utf8'))};}
 });
 vm.runInContext(fs.readFileSync(new URL('../research-model.js',import.meta.url),'utf8'),context);
 vm.runInContext(inline,context);
 await new Promise(resolve=>setImmediate(resolve));
 return {nodes,requests,context};
}
test('dashboard boots with browser named button property and loads official stocks',async()=>{
 const {nodes,requests}=await boot();assert.equal(requests.length,1);assert.match(requests[0],/data\/stocks.json/);
 assert.notEqual(nodes.get('universe').textContent,'—');assert.match(nodes.get('rows').innerHTML,/stock-open/);
 assert.equal(nodes.get('refreshData').disabled,false);assert.doesNotMatch(nodes.get('notice').textContent,/載入失敗/);
});
test('initial network failure restores retry button; retry loads real rows',async()=>{
 const {nodes,context}=await boot(true);assert.match(nodes.get('notice').textContent,/載入失敗/);assert.equal(nodes.get('refreshData').disabled,false);
 context.fetch=async()=>({ok:true,json:async()=>JSON.parse(fs.readFileSync(new URL('../data/stocks.json',import.meta.url),'utf8'))});
 await vm.runInContext('init()',context);assert.match(nodes.get('rows').innerHTML,/stock-open/);
});
