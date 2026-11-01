(function(){
 'use strict';
 const R=globalThis.QingyuResearch,$r=id=>document.getElementById(id);
 const metricValue=(r,key)=>R.finite(r[key])?r[key]:null;
 const formatted=(v,key)=>v===null?'—':(key==='yoy'&&v>0?'+':'')+display(v)+(R.metrics[key]?.unit||'');
 function syncExclusions(){
  const names=[...excludedIndustries].map(R.industryLabel);
  document.querySelectorAll('[data-excluded-industry]').forEach(input=>{input.checked=excludedIndustries.has(input.dataset.excludedIndustry);});
  document.querySelectorAll('.exclusion-count').forEach(el=>el.textContent=names.length?'已排除 '+names.length+' 類':'未排除');
  document.querySelectorAll('.exclusion-summary').forEach(el=>el.textContent=names.length?'已排除：'+names.join('、'):'尚未排除任何行業。');
 }
 document.querySelectorAll('.industry-exclusion-list').forEach(list=>list.addEventListener('change',e=>{
  const input=e.target.closest('[data-excluded-industry]');if(!input)return;
  if(input.checked)excludedIndustries.add(input.dataset.excludedIndustry);else excludedIndustries.delete(input.dataset.excludedIndustry);
  persistExcludedIndustries();compute();
 }));
 document.querySelectorAll('[data-clear-exclusions]').forEach(b=>b.addEventListener('click',()=>{excludedIndustries.clear();persistExcludedIndustries();compute();}));

 function updateSelection(){
  const selected=R.normalizeStrategies(activeStrategies).map(R.strategy);
  $r('appliedStrategy').textContent=selected.length?'策略交集（全部符合）：'+selected.map(s=>s.name).join(' ∩ ')+'｜'+filtered.length+' 檔。行情7日內、估值同日；營收策略須100日內。':'目前未選策略；可複選並查看全部符合的個股。';
  $r('clearStrategy').hidden=!selected.length;
  document.querySelectorAll('[data-strategy]').forEach(b=>{const on=activeStrategies.includes(b.dataset.strategy);b.setAttribute('aria-pressed',String(on));b.textContent=(on?'✓ 已選：':'＋ 選擇：')+R.strategy(b.dataset.strategy).name;});
  const summary=$r('strategyIntersection');if(summary)summary.textContent=selected.length?'交集 '+filtered.length+' 檔｜'+selected.map(s=>s.name).join(' ∩ ')+'。篩選器、行業排除與自選條件亦會套用。':'尚未選策略；選擇兩項以上可找出重疊個股。';
 }
 function selectStrategy(id){
  if(!R.strategy(id))return;
  activeStrategies=activeStrategies.includes(id)?activeStrategies.filter(x=>x!==id):[...activeStrategies,id];
  // Each strategy owns its thresholds; numeric controls remain extra AND conditions.
  page=0;compute();updateSelection();
 }
 globalThis.applyResearchStrategy=selectStrategy;
 $r('clearStrategy').addEventListener('click',()=>{activeStrategies=[];compute();});
 $r('strategyCards').innerHTML=R.strategies.map(s=>'<article class="research-card"><div class="section-head"><span class="eyebrow">'+esc(s.tag)+'</span><span class="risk-label">風險 '+esc(s.risk)+'</span></div><h3>'+esc(s.name)+'</h3><p>'+esc(s.description)+'</p><p class="strategy-rule">'+esc(s.rule)+'</p><p class="muted">'+esc(s.watch)+'</p><div class="strategy-bottom"><span id="strategyCount-'+s.id+'">資料載入中</span><button type="button" class="primary" data-strategy="'+s.id+'" aria-pressed="false">選擇'+esc(s.name)+'</button></div></article>').join('');
 const intersection=document.createElement('div');intersection.className='intersection-panel';intersection.innerHTML='<p id="strategyIntersection" role="status"></p><button type="button" id="inspectIntersection">查看全部符合個股</button>';$r('strategyCards').before(intersection);
 $r('inspectIntersection').addEventListener('click',()=>{setView('screen');document.querySelector('.results').scrollIntoView({block:'start'});});
 $r('strategyCards').addEventListener('click',e=>{const b=e.target.closest('[data-strategy]');if(b)selectStrategy(b.dataset.strategy);});

 const diagnostics=document.createElement('section');diagnostics.className='research-card';
 diagnostics.innerHTML='<h3>策略未入選原因</h3><p class="muted">統計使用排除行業後的全部證券，未套用搜尋、自選、數值篩選與籌碼條件；各策略獨立統計，不是策略交集。資料不足者不當成未達門檻。</p><div id="strategyDiagnosticsSummary" class="table-wrap"></div><label for="diagnosticCode">查詢單一股票代號</label><input id="diagnosticCode" type="text" inputmode="numeric" maxlength="6" placeholder="例如 2330"><div id="strategyDiagnosticResult" role="status" aria-live="polite"></div>';
 $r('strategyCards').after(diagnostics);
 function drawDiagnosticStock(){
  const box=$r('strategyDiagnosticResult'),code=$r('diagnosticCode').value.trim();box.replaceChildren();
  if(!code){box.textContent='輸入代號，查看已選策略的通過或排除原因；未選策略時顯示全部策略。';return;}
  const stock=stocks.find(r=>r.code===code);
  if(!stock){box.textContent=stocks.length?'目前快照找不到此代號。':'股票資料尚未載入。';return;}
  const title=document.createElement('p');title.textContent=stock.code+' '+stock.name+'｜行情 '+(stock.date||'未提供')+'｜估值 '+(stock.valuationDate||'未提供')+'｜營收 '+(stock.revenueMonth||'未提供');box.append(title);
  if(!R.included(stock,excludedIndustries)){const p=document.createElement('p');p.textContent='目前此股票的行業已被排除，下列只說明策略本身。';box.append(p);}
  const ids=R.normalizeStrategies(activeStrategies),now=Date.now();
  for(const s of (ids.length?ids.map(R.strategy):R.strategies)){
   const result=R.diagnose(stock,s.id,now),p=document.createElement('p');
   p.textContent=s.name+'：'+({pass:'通過策略門檻',unavailable:'資料不足／不適用',fail:'未達策略門檻'}[result.status])+(result.reasons.length?'｜'+result.reasons.join('；'):'');box.append(p);
  }
  const note=document.createElement('p');note.className='muted';note.textContent='通過策略門檻不代表會出現在目前篩選結果；仍須符合其他已選策略、行業、自選、數值與籌碼條件。';box.append(note);
 }
 $r('diagnosticCode').addEventListener('input',drawDiagnosticStock);
 function drawDiagnostics(universe,now){
  $r('strategyDiagnosticsSummary').innerHTML='<table><caption>排除行業後 '+universe.length+' 檔證券，各列三項數量合計等於樣本總數</caption><thead><tr><th>策略</th><th>通過</th><th>資料不足／不適用</th><th>未達門檻</th></tr></thead><tbody>'+R.strategies.map(s=>{const c=R.strategySummary(universe,s.id,now);return '<tr><th scope="row">'+esc(s.name)+'</th><td>'+c.pass+'</td><td>'+c.unavailable+'</td><td>'+c.fail+'</td></tr>';}).join('')+'</tbody></table>';
  drawDiagnosticStock();
 }

 const heatControls=['heatMetric','heatMarket','heatIndustry','heatScope','heatSort','heatLimit','heatSearch','heatKnownPeriods'];
 function updateIndustryOptions(){
  const select=$r('heatIndustry'),old=select.value;
  select.innerHTML='<option value="all">所有產業</option><option value="unknown">未分類</option>'+[...new Set(stocks.filter(R.equity).map(R.industryKey).filter(x=>x!=='__unclassified__'))].sort().map(x=>'<option value="'+esc(x)+'">'+esc(R.industryLabel(x))+'</option>').join('');
  select.value=[...select.options].some(o=>o.value===old)?old:'all';
  const counts=new Map();for(const r of stocks){const key=R.industryKey(r);counts.set(key,(counts.get(key)||0)+1);}
  const keys=[...new Set([...counts.keys(),...excludedIndustries,'__unclassified__'])].sort((a,b)=>a==='__unclassified__'?1:b==='__unclassified__'?-1:a.localeCompare(b));
  document.querySelectorAll('.industry-exclusion-list').forEach(list=>{list.innerHTML=keys.map(key=>'<label><input type="checkbox" data-excluded-industry="'+esc(key)+'" '+(excludedIndustries.has(key)?'checked':'')+'><span>'+esc(R.industryLabel(key))+'<small>'+ (counts.get(key)||0)+' 檔證券</small></span></label>').join('');});
  syncExclusions();
 }
 function periodKnown(r,key){
  const now=Date.now(),age=(now-Date.parse(r.date+'T00:00:00+08:00'))/86400000;
  if(!Number.isFinite(age)||age<0||age>7)return false;
  if(key!=='yoy')return !!r.valuationDate&&r.valuationDate===r.date;
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.revenueMonth||''))return false;
  const revenueAge=(now-Date.parse(r.revenueMonth+'-01T00:00:00+08:00'))/86400000;
  return revenueAge>=0&&revenueAge<=100;
 }
 let heatEvaluations=new Map();
 const evaluatePriority=r=>QingyuPriority.evaluate(r,globalThis.analyzeChipStock?.(r));
 function inspect(r,key){
  const m=R.metrics[key],period=r[m.period],e=heatEvaluations.get(r.code)||evaluatePriority(r);
  $r('heatInspector').innerHTML='<strong>'+esc(r.code+' '+r.name)+'</strong><span>'+esc(m.label)+' '+formatted(metricValue(r,key),key)+'</span><small>'+esc(r.market)+' · '+esc(r.industry?'官方產業 '+r.industry:'未分類')+' · 指標期間 '+esc(period||'未提供')+' · 行情 '+esc(r.date||'未提供')+'<br>'+esc(key==='yoy'?r.revenueOrigin||'來源未提供':r.valuationOrigin||'來源未提供')+' · 點擊或按 Enter 開啟完整研究卡</small>';
  const score=document.createElement('p');score.className='priority-explanation';score.textContent='研究優先度：'+(e.score===null?'資料待補（不評分）':e.score+'/100 · '+e.band)+'｜'+e.parts.map(p=>p.label+' '+(p.value===null?'—':p.value)+'/'+p.max).join(' · ')+(e.missing.length?'｜'+e.missing.join('；'):'')+'｜籌碼日期 '+(e.chipDate||'未提供');$r('heatInspector').append(score);
  if(globalThis.QingyuScoring){const full=QingyuScoring.current(r,globalThis.analyzeChipStock?.(r));const note=document.createElement('p');note.className='priority-explanation';note.textContent='完整50／25／15／10模型：'+full.status+'｜'+full.parts.map(p=>p.label+' '+(p.value===null?'未提供（'+p.reason+'）':p.value+'/'+p.max)).join('；')+'｜已具資料權重 '+full.availableWeight+'/100；缺值不補0、不放大其餘權重。基本面尚缺獲利／現金流等完整來源契約；現有研究優先度另行顯示。';$r('heatInspector').append(note);}
 }
 function drawHeatmap(){
  const key=$r('heatMetric').value,m=R.metrics[key],market=$r('heatMarket').value,industry=$r('heatIndustry').value,q=$r('heatSearch').value.trim().toLowerCase(),scope=$r('heatScope').value;
  let rows=(scope==='filtered'?filtered:stocks).filter(R.equity).filter(r=>R.included(r,excludedIndustries)&&(scope!=='favorites'||favorites.has(r.code))&&(market==='all'||r.market===market)&&(industry==='all'||R.industryKey(r)===(industry==='unknown'?'__unclassified__':industry))&&(!q||(r.code+' '+r.name).toLowerCase().includes(q)));
  const original=rows.length,unknown=rows.filter(r=>!periodKnown(r,key)).length;
  if($r('heatKnownPeriods').checked)rows=rows.filter(r=>periodKnown(r,key));
  const sort=$r('heatSort').value;
  const ranked=QingyuPriority.rank(rows,r=>globalThis.analyzeChipStock?.(r));heatEvaluations=new Map(ranked.map(x=>[x.stock.code,x.evaluation]));
  if(sort==='priority')rows=ranked.map(x=>x.stock);else rows.sort((a,b)=>{if(sort==='code')return a.code.localeCompare(b.code);const av=metricValue(a,key),bv=metricValue(b,key);return av===null?(bv===null?a.code.localeCompare(b.code):1):bv===null?-1:(sort==='asc'?av-bv:bv-av)||a.code.localeCompare(b.code);});
  const available=rows.filter(r=>metricValue(r,key)!==null).length,limit=$r('heatLimit').value==='all'?rows.length:Number($r('heatLimit').value),shown=rows.slice(0,limit);
  const periods=[...new Set(rows.map(r=>r[m.period]||'未提供'))].sort();
  const rankedCount=ranked.filter(x=>x.evaluation.score!==null).length;
  $r('heatCaption').textContent=(sort==='priority'?'研究優先度高→低（同分按代號）｜可評分 '+rankedCount+' 檔、資料待補 '+(rows.length-rankedCount)+' 檔（另列最後）｜':'')+'顯示 '+shown.length+' / '+rows.length+' 檔｜行業排除 '+excludedIndustries.size+' 類｜本範圍有指標 '+available+' 檔、缺值 '+(rows.length-available)+' 檔｜'+($r('heatKnownPeriods').checked?'已排除期間未核對或過舊 '+unknown+' / '+original+' 檔':'包含期間未核對或過舊 '+unknown+' 檔')+'｜指標期間 '+(periods.length>4?periods.slice(0,4).join('、')+'等 '+periods.length+' 個期間':periods.join('、')||'—');
  $r('heatLegend').innerHTML='<span>'+esc(m.label)+'</span><div class="heat-scale '+(key==='yoy'?'diverging':'sequential')+'" aria-hidden="true"></div><div class="legend-labels">'+m.legend.map(v=>'<span>'+esc(v)+'</span>').join('')+'</div><small>灰色斜線＝缺值；色塊等面積，不代表市值。'+esc(m.note)+'</small>';
  $r('heatGrid').innerHTML=shown.map((r,i)=>{const v=metricValue(r,key),period=r[m.period]||'未提供',e=heatEvaluations.get(r.code),priority=(sort==='priority'&&e.score!==null?'#'+(i+1)+' ':'')+(e.score===null?'資料待補':e.band+' '+e.score+'/100');return '<button type="button" class="heat-tile '+(v===null?'missing':'')+' '+(!periodKnown(r,key)?'period-unknown':'')+'" data-heat-code="'+esc(r.code)+'" style="background-color:'+R.color(key,v)+'" aria-label="'+esc(r.code+' '+r.name+' '+priority+' '+m.label+' '+formatted(v,key)+' 期間 '+period)+'"><span class="tile-priority">'+esc(priority)+'</span><span class="tile-code">'+esc(r.code)+'</span><strong>'+esc(r.name)+'</strong><b>'+formatted(v,key)+'</b><small>'+esc(period)+'</small></button>';}).join('')||'<p class="heat-empty">沒有符合條件的股票。請調整範圍、產業或期間條件。</p>';
  $r('heatInspector').innerHTML=shown.length?'移到色塊或以鍵盤聚焦，可查看研究分數、各項得分、缺漏原因、日期與來源；點擊開啟研究卡。':'目前範圍沒有可顯示的股票。';
 }
 heatControls.forEach(id=>$r(id).addEventListener(id==='heatSearch'?'input':'change',drawHeatmap));
 for(const event of ['pointerover','focusin'])$r('heatGrid').addEventListener(event,e=>{const b=e.target.closest('[data-heat-code]');if(!b)return;const r=stocks.find(s=>s.code===b.dataset.heatCode);if(r)inspect(r,$r('heatMetric').value);});
 $r('heatGrid').addEventListener('click',e=>{const b=e.target.closest('[data-heat-code]');if(b)openStock(b.dataset.heatCode);});

 $r('allocationTabs').innerHTML=R.allocations.map((p,i)=>'<button type="button" data-plan="'+p.id+'" aria-pressed="'+(i===1)+'">'+p.name+'</button>').join('');
 let allocation='balanced';
 function drawAllocation(){
  const plan=R.allocations.find(p=>p.id===allocation),raw=$r('monthlyBudget').value.trim(),amount=raw===''?NaN:Number(raw),values=R.allocate(amount,plan.weights);
  document.querySelectorAll('[data-plan]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.plan===allocation)));
  const labels=['分散股票資產','債券資產','現金保留'];
  $r('allocationBar').innerHTML=plan.weights.map((w,i)=>'<div class="alloc-segment alloc-'+i+'" style="width:'+w+'%" aria-label="'+labels[i]+w+'%">'+w+'%</div>').join('');
  $r('allocationCaption').textContent=plan.name+' · '+plan.summary;
  $r('allocationAmounts').innerHTML=values?values.map((v,i)=>'<div><span class="alloc-key alloc-'+i+'"></span><span>'+labels[i]+' '+plan.weights[i]+'%</span><strong>NT$ '+v.toLocaleString('zh-TW')+'</strong></div>').join(''):'<p class="warning-text">請輸入0～1,000,000,000元的整數月預算。</p>';
  $r('allocationRisk').textContent=plan.risk;
 }
 $r('allocationTabs').addEventListener('click',e=>{const b=e.target.closest('[data-plan]');if(!b)return;allocation=b.dataset.plan;drawAllocation();});
 $r('monthlyBudget').addEventListener('input',drawAllocation);drawAllocation();

 let lastStocks=null;
 globalThis.refreshResearchTools=function(){
  if(lastStocks!==stocks){lastStocks=stocks;updateIndustryOptions();}
  syncExclusions();
  const now=Date.now();
  const universe=stocks.filter(r=>R.included(r,excludedIndustries));
  drawDiagnostics(universe,now);
  for(const s of R.strategies){const usable=universe.filter(r=>R.eligible(r,s.id,now)).length,count=universe.filter(r=>R.matches(r,s.id,now)).length;$r('strategyCount-'+s.id).textContent='符合 '+count+' 檔 / 可核對 '+usable+' 檔（排除 '+excludedIndustries.size+' 類）';}
  updateSelection();if(activeView==='heatmap')drawHeatmap();
 };
 globalThis.refreshResearchTools();
})();
