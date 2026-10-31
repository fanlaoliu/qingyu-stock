(function(){
 'use strict';
 const C=QingyuChips,el=id=>document.getElementById(id);
 let payload=null,loading=false,failure='',limit=50;
 const fmt=v=>typeof v==='number'&&Number.isFinite(v)?(v>0?'+':'')+(v/1000).toLocaleString('zh-TW',{maximumFractionDigits:3}):'—';
 const labels={foreign:'外資（不含外資自營商）',trust:'投信',dealer:'自營商',total:'三大法人合計'};
 globalThis.analyzeChipStock=stock=>C.analyze(payload,stock);
 globalThis.matchesChipFilter=stock=>C.matches(payload,stock,el('chipFilter').value);
 function detail(stock){
  const a=C.analyze(payload,stock);const box=el('detailChips');box.replaceChildren();
  const title=document.createElement('h3');title.textContent='籌碼面 · 三大法人';box.append(title);
  const p=document.createElement('p');p.className='muted';p.textContent=loading?'籌碼載入中…':failure||(!a.row?'此股尚無籌碼紀錄。':'資料 '+a.date+'｜股數換算張數（1張＝1,000股），負值為賣超。'+(!a.usable?'日期未與行情對齊或已超過7日；不通過籌碼篩選。':''));box.append(p);
  if(a.row){
   const wrap=document.createElement('div');wrap.className='table-wrap';const table=document.createElement('table');
   table.innerHTML='<thead><tr><th>法人</th><th>當日淨買賣超（張）</th><th>5日累計（張）</th><th>20日累計（張）</th><th>連買／連賣紀錄</th></tr></thead>';
   const body=document.createElement('tbody');for(const key of C.keys){const tr=document.createElement('tr'),st=a.streak[key];let streak='資料不足';if(st.exact)streak=st.sign===0?'當日淨額為0':(st.sign>0?'連買 ':'連賣 ')+st.count+' 日';else if(st.count)streak='已知 '+st.count+' 日'+(st.sign>0?'買超':'賣超')+'（起點未核對）';
    for(const value of [labels[key],fmt(a.row[key]),fmt(a.five?.[key]),fmt(a.twenty?.[key]),streak]){const td=document.createElement('td');td.textContent=value;tr.append(td);}body.append(tr);
   }table.append(body);wrap.append(table);box.append(wrap);
   const note=document.createElement('p');note.className='muted';note.textContent='歷史已存 '+a.count+' 期；5／20日須逐個平日完整，有休市或缺日尚未核對時顯示「—」。自營商已含外資自營商，不再加總一次。法人買超不代表未來上漲。';box.append(note);
  }
 }
 function draw(){
  const status=el('chipStatus');status.textContent=loading?'正在讀取官方籌碼快照…':failure||['上市','上櫃'].map(m=>{const a=payload?.markets?.[m],last=a?.sessions?.at(-1);return m+' '+(last?last.date+' · '+Object.keys(last.rows).length+' 檔 · '+a.sessions.length+'期':'尚無資料')+(payload?.meta?.errors?.[m]?'（更新失敗，保留原日期）':'');}).join('｜');
  const sort=el('chipSort').value;
  const rows=filtered.filter(r=>QingyuResearch.equity(r)).map(r=>({r,a:C.analyze(payload,r)})).filter(x=>x.a.row);
  rows.sort((x,y)=>{const a=x.a.row[sort],b=y.a.row[sort];return typeof a!=='number'?(typeof b!=='number'?x.r.code.localeCompare(y.r.code):1):typeof b!=='number'?-1:b-a||x.r.code.localeCompare(y.r.code);});
  el('chipCount').textContent='沿用策略交集、行業排除及選股條件｜有紀錄 '+rows.length+' 檔；顯示前 '+Math.min(limit,rows.length)+' 檔。';
  el('chipRows').innerHTML=rows.slice(0,limit).map(({r,a})=>'<tr><td><button type="button" data-chip-code="'+esc(r.code)+'">'+esc(r.code+' '+r.name)+'</button></td><td>'+esc(a.date)+(a.usable?'':' · 期間待核對')+'</td>'+C.keys.map(k=>'<td class="'+(a.row[k]>0?'chip-positive':a.row[k]<0?'chip-negative':'')+'">'+fmt(a.row[k])+'</td>').join('')+'</tr>').join('')||'<tr><td colspan="6">'+esc(failure||'此範圍無可顯示籌碼。請檢查日期、條件或重新讀取。')+'</td></tr>';
  el('chipMore').hidden=rows.length<=limit;
  if(selectedStockCode&&!el('stockDetail').hidden){const stock=stocks.find(r=>r.code===selectedStockCode);if(stock)detail(stock);}
 }
 globalThis.renderChipDetail=detail;globalThis.refreshChips=draw;
 el('chipRows').addEventListener('click',e=>{const b=e.target.closest('[data-chip-code]');if(b)openStock(b.dataset.chipCode);});
 el('chipSort').addEventListener('change',()=>{limit=50;draw();});el('chipMore').addEventListener('click',()=>{limit+=50;draw();});
 el('chipFilter').addEventListener('change',()=>{page=0;limit=50;compute();});
 async function load(){if(loading)return;loading=true;failure='';draw();try{const r=await fetch('./data/chips.json?ts='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('籌碼快照 HTTP '+r.status);payload=C.validate(await r.json());}catch(e){failure='籌碼更新失敗：'+e.message+(payload?'。保留前次有日期的資料。':'。無資料不補成0。');}finally{loading=false;compute();draw();}}
 el('refreshChips').addEventListener('click',load);load();
})();
