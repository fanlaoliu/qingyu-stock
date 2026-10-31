(function(root){
 'use strict';
 const CODE=/^\d{4,6}[A-Z]?$/;
 const K={favorites:'qingyu-favorites-v1',excluded:'qingyu-excluded-industries-v1',settings:'qingyu-screen-settings-v1'};
 const array=(v,max)=>Array.isArray(v)?v.slice(0,max):[];
 const codes=v=>[...new Set(array(v,5000).filter(c=>typeof c==='string'&&CODE.test(c)))];
 const excluded=v=>root.QingyuResearch.normalizeExclusions(v);
 function settings(v){
  if(!v||typeof v!=='object'||Array.isArray(v))return null;
  const s={query:typeof v.query==='string'?v.query.slice(0,128):'',market:['all','上市','上櫃'].includes(v.market)?v.market:'all',sort:['code','pe','pb','yield','yoy','price'].includes(v.sort)?v.sort:'code',complete:v.complete===true,favoritesOnly:v.favoritesOnly===true,strategies:root.QingyuResearch.normalizeStrategies(v.strategies??v.strategy),chipFilter:['all','foreignBuy','trustBuy','totalBuy','allBuy'].includes(v.chipFilter)?v.chipFilter:'all',excludedIndustries:excluded(v.excludedIndustries)};
  for(const key of ['maxpe','maxpb','minyield','minyoy']){const raw=String(v[key]??'').trim();s[key]=raw!==''&&Number.isFinite(Number(raw))&&raw.length<30?raw:'';}
  return s;
 }
 function normalize(v){
  if(!v||v.format!=='qingyu-local-backup'||v.version!==1)throw Error('不是支援的青嶼備份格式。');
  const notes=Object.create(null),entries=v.notes&&typeof v.notes==='object'&&!Array.isArray(v.notes)?Object.entries(v.notes):[];
  if(entries.length>1000)throw Error('備份筆記數量超過1000筆。');
  for(const [code,note] of entries){if(!CODE.test(code)||typeof note!=='string'||note.length>12000)throw Error('備份筆記代號或內容格式不符。');notes[code]=note;}
  return {format:'qingyu-local-backup',version:1,exportedAt:typeof v.exportedAt==='string'?v.exportedAt:'',favorites:codes(v.favorites),excludedIndustries:excluded(v.excludedIndustries),settings:settings(v.settings),notes};
 }
 const json=(storage,key,fallback)=>{const value=storage.getItem(key);return value===null?fallback:JSON.parse(value);};
 function exportData(storage){
  const notes=Object.create(null);
  for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith('qingyu-note-')){const c=key.slice('qingyu-note-'.length);if(CODE.test(c))notes[c]=storage.getItem(key)||'';}}
  return normalize({format:'qingyu-local-backup',version:1,exportedAt:new Date().toISOString(),favorites:json(storage,K.favorites,[]),excludedIndustries:json(storage,K.excluded,[]),settings:json(storage,K.settings,null),notes});
 }
 function importData(storage,input){
  const data=normalize(input),writes=new Map();
  writes.set(K.favorites,JSON.stringify(codes([...codes(json(storage,K.favorites,[])),...data.favorites])));
  writes.set(K.excluded,JSON.stringify(excluded([...excluded(json(storage,K.excluded,[])),...data.excludedIndustries])));
  if(storage.getItem(K.settings)===null&&data.settings)writes.set(K.settings,JSON.stringify(data.settings));
  let notesAdded=0;for(const [code,note] of Object.entries(data.notes)){const key='qingyu-note-'+code;if(storage.getItem(key)===null){writes.set(key,note);notesAdded++;}}
  const previous=new Map([...writes.keys()].map(key=>[key,storage.getItem(key)]));
  try{for(const [key,value] of writes)storage.setItem(key,value);}
  catch{
   let restored=true;for(const [key,value] of previous)try{if(value===null)storage.removeItem(key);else storage.setItem(key,value);}catch{restored=false;}
   throw Error(restored?'無法儲存，已還原本次匯入變更。請檢查瀏覽器儲存空間。':'匯入及還原未完整完成。請保留備份檔並檢查瀏覽器儲存空間。');
  }
  return {notesAdded,favorites:JSON.parse(writes.get(K.favorites)).length,excluded:JSON.parse(writes.get(K.excluded)).length};
 }
 root.QingyuAppData=Object.freeze({normalize,exportData,importData,maxBytes:10*1024*1024});
})(globalThis);
