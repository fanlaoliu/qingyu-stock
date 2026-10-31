import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import '../research-model.js';
import '../app-data.js';
const A=globalThis.QingyuAppData;
class Storage{
 constructor(values={}){this.data=new Map(Object.entries(values));this.failOnce=null;}
 get length(){return this.data.size;}key(i){return [...this.data.keys()][i]??null;}
 getItem(k){return this.data.get(k)??null;}removeItem(k){this.data.delete(k);}
 setItem(k,v){if(this.failOnce===k){this.failOnce=null;throw Error('quota');}this.data.set(k,String(v));}
}
const sample={format:'qingyu-local-backup',version:1,favorites:['2330','2454'],excludedIndustries:['17'],notes:{2330:'研究筆記',2454:'另一筆'},settings:{query:'台',market:'上市',sort:'pe',maxpe:'30',strategy:'growth'}};
test('backup exports only known app data and never credentials or unrelated storage',()=>{
 const store=new Storage({'qingyu-favorites-v1':'["2330"]','qingyu-note-2330':'研究筆記','some-token':'secret','unrelated-app':'other'});
 const backup=A.exportData(store);assert.deepEqual(backup.favorites,['2330']);assert.equal(backup.notes['2330'],'研究筆記');assert.equal(JSON.stringify(backup).includes('secret'),false);assert.equal(JSON.stringify(backup).includes('other'),false);
});
test('backup import merges favorites and exclusions, preserving existing notes/settings',()=>{
 const store=new Storage({'qingyu-favorites-v1':'["2308"]','qingyu-excluded-industries-v1':'["24"]','qingyu-note-2330':'現有筆記','qingyu-screen-settings-v1':'{"query":"現有設定"}'});
 const result=A.importData(store,sample);assert.equal(result.notesAdded,1);assert.deepEqual(JSON.parse(store.getItem('qingyu-favorites-v1')),['2308','2330','2454']);assert.deepEqual(JSON.parse(store.getItem('qingyu-excluded-industries-v1')),['24','17']);assert.equal(store.getItem('qingyu-note-2330'),'現有筆記');assert.equal(store.getItem('qingyu-note-2454'),'另一筆');assert.equal(JSON.parse(store.getItem('qingyu-screen-settings-v1')).query,'現有設定');
});
test('invalid or future backup formats and unsafe note keys are rejected before writing',()=>{
 assert.throws(()=>A.normalize({...sample,version:2}));assert.throws(()=>A.normalize({...sample,notes:{'../token':'bad'}}));assert.throws(()=>A.normalize({...sample,notes:{2330:'a'.repeat(12001)}}));
 const normalized=A.normalize({...sample,favorites:['2330','invalid','2330'],settings:{sort:'invalid',strategy:'invalid'}});assert.deepEqual(normalized.favorites,['2330']);assert.equal(normalized.settings.sort,'code');assert.deepEqual(normalized.settings.strategies,[]);
});
test('storage quota failures roll back all changes made by the import',()=>{
 const store=new Storage({'qingyu-favorites-v1':'["2308"]','untouched':'keep'}),before=[...store.data];store.failOnce='qingyu-note-2454';assert.throws(()=>A.importData(store,sample),/已還原/);assert.deepEqual([...store.data],before);
});
test('manifest has same-origin private-app scope and correctly sized PNG icons',()=>{
 const m=JSON.parse(fs.readFileSync(new URL('../manifest.webmanifest',import.meta.url)));assert.equal(m.display,'standalone');assert.equal(m.scope,'/');assert.equal(m.id,'/');assert.ok(m.start_url.startsWith('/'));
 for(const [name,size] of [['icon-180.png',180],['icon-192.png',192],['icon-512.png',512],['icon-maskable-512.png',512]]){const b=fs.readFileSync(new URL('../icons/'+name,import.meta.url));assert.equal(b.toString('hex',0,8),'89504e470d0a1a0a');assert.equal(b.readUInt32BE(16),size);assert.equal(b.readUInt32BE(20),size);}
});
function worker(fetchImpl){const events={};const context={self:{location:{origin:'https://private.example'},addEventListener:(n,f)=>{events[n]=f},skipWaiting:async()=>{},clients:{claim:async()=>{}}},URL,Response,fetch:fetchImpl};vm.runInNewContext(fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8'),context);return events;}
test('service worker never intercepts APIs, cross-origin requests or auth routes',()=>{
 const events=worker(async()=>{throw Error('not expected')});
 for(const [path,mode,method] of [['/api/market','cors','GET'],['/api/market','navigate','GET'],['/data/stocks.json','navigate','GET'],['/signin-with-chatgpt?return_to=/','navigate','GET'],['/callback?code=private','navigate','GET'],['/signout-with-chatgpt','navigate','GET'],['/','navigate','POST']]){let intercepted=false;events.fetch({request:{url:'https://private.example'+path,mode,method},respondWith:()=>{intercepted=true}});assert.equal(intercepted,false,path);}
 let intercepted=false;events.fetch({request:{url:'https://auth.example/','navigate':true,mode:'navigate',method:'GET'},respondWith:()=>{intercepted=true}});assert.equal(intercepted,false);
});
test('navigation uses the network and only a generic no-store notice on outage',async()=>{
 const live=worker(async()=>new Response('live private page'));let result;live.fetch({request:{url:'https://private.example/',method:'GET',mode:'navigate'},respondWith:r=>{result=r}});assert.equal(await (await result).text(),'live private page');
 const offline=worker(async()=>{throw Error('offline')});offline.fetch({request:{url:'https://private.example/?view=heatmap',method:'GET',mode:'navigate'},respondWith:r=>{result=r}});const response=await result;assert.equal(response.status,503);assert.equal(response.headers.get('Cache-Control'),'private, no-store');const body=await response.text();assert.ok(body.includes('重新連線'));assert.equal(body.includes('2330'),false);assert.equal(body.includes('localStorage'),false);
});
