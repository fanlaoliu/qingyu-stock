(function(){
 'use strict';
 const M=QingyuInvestment,$i=id=>document.getElementById(id),KEY='qingyu-investment-v1',FKEY='qingyu-financials-v1';
 const fmt=v=>typeof v==='number'&&Number.isFinite(v)?v.toLocaleString('zh-TW',{maximumFractionDigits:2}):'—';
 let storageBroken=false;
 let book={version:1,transactions:[],alerts:[]},financial=[],report=null,lastBacktest=null;
 const status=(id,text)=>{$i(id).textContent=text;};
 const safe=(id,fn)=>{try{fn();}catch(e){status(id,e.message);}};
 const table=(id,headers,rows)=>{
  const box=$i(id);box.replaceChildren();const wrap=document.createElement('div');wrap.className='table-wrap';const t=document.createElement('table'),head=document.createElement('thead'),tr=document.createElement('tr');
  headers.forEach(x=>{const th=document.createElement('th');th.scope='col';th.textContent=x;tr.append(th);});head.append(tr);t.append(head);const body=document.createElement('tbody');
  rows.forEach(row=>{const tr=document.createElement('tr');row.forEach(value=>{const td=document.createElement('td');td.textContent=value;tr.append(td);});body.append(tr);});t.append(body);wrap.append(t);box.append(wrap);
 };
 const download=(name,data,type='application/json')=>{const a=document.createElement('a'),u=URL.createObjectURL(new Blob([type==='application/json'?JSON.stringify(data,null,2):data],{type}));a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);};
 const save=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
 let officialEps=null;
 const stock=()=>{const s=stocks.find(s=>s.code===$i('researchCode').value.trim());if(!s)throw Error('找不到股票，請確認資料已載入及代號正確。');return s;};
 const number=id=>{const raw=$i(id).value.trim();if(raw==='')throw Error('請填寫 '+$i(id).labels?.[0]?.textContent);const n=Number(raw);if(!Number.isFinite(n))throw Error('數字格式錯誤');return n;};
 const panel=(id,title,html)=>{const section=document.createElement('section');section.id=id;section.className='research-card investment-panel';section.hidden=true;section.innerHTML='<h2>'+title+'</h2>'+html;const footer=document.querySelector('main footer');if(footer)footer.before(section);else document.querySelector('main').append(section);return section;};
 panel('advancedPanel','進階投資研究',`
 <p class="muted">法人歷史籌碼沿用「法人籌碼」與個股研究卡。財報由你匯入有來源、公開日及TTM期間的JSON；未匯入的欄位保持缺值。</p>
 <div class="controls"><label>股票代號<input id="researchCode" inputmode="numeric" value="2330" maxlength="7"></label><label>財務資料JSON<input id="financialImport" type="file" accept=".json,application/json"></label></div>
 <div class="investment-actions"><button id="financialTemplate">下載財務格式範本</button><button id="financialClear">清除匯入財報</button><button id="financialInspect">財務品質與籌碼</button></div>
 <p id="advancedStatus" role="status" aria-live="polite"></p><div id="financialQuality"></div>
 <h3>官方EPS摘要（自動資料）</h3><p class="muted">此接口只涵蓋部分公司。官方季別原始值不等於TTM，累計口徑尚未核對；出表日期不是原始公告日，不參與估值或歷史回測。</p><p><a href="https://data.gov.tw/dataset/20756" target="_blank" rel="noopener noreferrer">上市EPS官方資料集／授權</a> · <a href="https://data.gov.tw/dataset/20757" target="_blank" rel="noopener noreferrer">上櫃EPS官方資料集／授權</a></p><button id="officialEpsRefresh">重新讀取官方EPS</button><p id="officialEpsStatus" role="status"></p><div id="officialEpsResult"></div><h3>情境合理價與安全邊際</h3><p class="muted">只使用截至行情日已公開的正TTM EPS。三種本益比為你自行設定的假設；不是歷史合理價或預測。</p>
 <div class="controls"><label>保守PE<input id="peLow" type="number" value="12" min="0.1" max="200" step="0.1"></label><label>基準PE<input id="peBase" type="number" value="18" min="0.1" max="200" step="0.1"></label><label>樂觀PE<input id="peHigh" type="number" value="25" min="0.1" max="200" step="0.1"></label><label>目標安全邊際%<input id="marginTarget" type="number" value="20" min="0" max="99"></label></div>
 <button id="valueRun">計算情境估值</button><div id="valuationResults"></div>
 <h3>同期間個股比較</h3><label>2至5個代號，以逗號分開<input id="advancedCompareCodes" value="2330,2454" maxlength="60"></label><button id="advancedCompare">比較估值與財務品質</button><div id="advancedCompareResult"></div>`);
 panel('portfolioPanel','個人投資管理',`
 <p class="muted">交易與提醒只存在此瀏覽器，JSON備份未加密。以移動平均成本計算，費用與稅額輸入實際金額；不預設代入你的持股。估值僅使用本次快照同日價格。既有App備份不包含此帳本，請使用本頁匯出。</p>
 <div class="controls"><label>交易日<input id="tradeDate" type="date"></label><label>代號<input id="tradeCode" inputmode="numeric" maxlength="7"></label><label>類型<select id="tradeType"><option value="buy">買進</option><option value="sell">賣出</option><option value="dividend">股息實收</option><option value="split">股票分割／合併</option></select></label><label>股數／分割倍數（股息填0）<input id="tradeQty" type="number" min="0" step="any"></label><label>單價／股息現金總額（分割填0）<input id="tradePrice" type="number" min="0" step="any"></label><label>手續費<input id="tradeFee" type="number" value="0" min="0" step="any"></label><label>稅額<input id="tradeTax" type="number" value="0" min="0" step="any"></label></div>
 <div class="investment-actions"><button id="tradeAdd">新增交易</button><button id="ledgerExport">匯出帳本與提醒</button><label>還原帳本（取代本機）<input id="ledgerImport" type="file" accept=".json,application/json"></label></div>
 <p id="portfolioStatus" role="status" aria-live="polite"></p><div id="portfolioSummary"></div><div id="portfolioPositions"></div><div id="portfolioIndustries"></div>
 <h3>交易紀錄</h3><div id="transactionRows"></div><label>刪除交易ID<input id="deleteTradeId" maxlength="80"></label><button id="tradeDelete">刪除指定紀錄</button>
 <h3>追蹤價格提醒</h3><p class="muted">沿用選股頁自選清單。此處只在網頁開啟並刷新資料時核對盤後價格，沒有背景推播或即時到價通知。</p>
 <div class="controls"><label>代號<input id="alertCode" maxlength="7"></label><label>方向<select id="alertDirection"><option value="below">小於等於</option><option value="above">大於等於</option></select></label><label>目標價格<input id="alertPrice" type="number" min="0.01" step="any"></label></div><button id="alertAdd">新增提醒</button><button id="alertClear">清除價格提醒</button><div id="alertResults"></div>`);
 panel('assistantPanel','來源研究助理',`
 <p class="muted">目前為本機規則摘要與欄位問答，未連接生成式AI。使用「進階研究」的代號與匯入財報，可產出來源摘要、異常線索和AI研究素材。不會將投資組合送往外部服務。</p>
 <label>研究股票代號<input id="assistantCode" inputmode="numeric" value="2330" maxlength="7"></label><button id="researchGenerate">產生來源研究摘要</button><button id="researchExport">匯出研究素材</button><div id="researchSources"></div><pre id="researchReport" class="investment-output"></pre>
 <label>研究問題<input id="researchQuestion" maxlength="500" placeholder="例如：這檔的營收成長和本益比？"></label><button id="researchAsk">查詢資料欄位</button><pre id="researchAnswer" class="investment-output" role="status"></pre>
 <h3>Cloudflare AI研究（選用）</h3><p class="muted">按下按鈕會將本頁代號與問題送至Cloudflare AI，伺服器另讀取官方快照。不包含帳本、持股成本或匯入財報；請勿在問題填寫個資或機密。</p><button id="cloudResearchAsk">送至Cloudflare AI研究</button><pre id="cloudResearchAnswer" class="investment-output" role="status"></pre><div id="cloudResearchSources"></div><p class="muted">下方Cloudflare AI介面預設關閉；需管理者設定Access登入、AI binding及速率限制後才能使用。財報原文解析與持續事件監控尚未完成。</p>`);
 panel('backtestPanel','策略回測與績效驗證',`
 <p class="muted">匯入單一證券的總報酬調整收盤價與當時已公開的策略訊號。訊號於下一筆收盤成交；分數與今日選股結果不會回填歷史。範本只有格式，沒有虛構績效。</p>
 <label>歷史JSON<input id="backtestImport" type="file" accept=".json,application/json"></label><button id="backtestTemplate">下載歷史資料格式</button>
 <div class="controls"><label>回測策略<select id="btStrategy"><option value="imported">匯入的歷史訊號</option><option value="sma">收盤價高於移動平均線</option></select></label><label>均線期數（2至250）<input id="btLookback" type="number" min="2" max="250" value="20"></label><label>初始資金<input id="btInitial" type="number" value="100000" min="1"></label><label>單邊手續費bps<input id="btFee" type="number" value="14.25" min="0" max="500" step="any"></label><label>賣出稅bps<input id="btTax" type="number" value="30" min="0" max="500" step="any"></label><label>單邊滑價bps<input id="btSlip" type="number" value="10" min="0" max="500" step="any"></label><label>樣本內比例<input id="btSplit" type="number" value="0.7" min="0.5" max="0.9" step="0.05"></label></div>
 <p class="muted">1bps＝0.01%。成本為可調整參數，請依商品與券商核對；使用可分割股數、全額持有或現金，不模擬整股限制及流動性。均線策略只讀取當期及先前收盤價；尚未累積足夠期數保持現金。各期間最後一筆強制平倉。</p>
 <h3>固定參數滾動驗證</h3><div class="controls"><label>訓練期筆數<input id="wfTrain" type="number" value="60" min="2"></label><label>每段測試筆數<input id="wfTest" type="number" value="20" min="2"></label></div><button id="walkForwardRun">執行滾動驗證</button><div id="walkForwardResults"></div><button id="backtestRun">執行回測</button><button id="backtestExport">匯出結果與參數</button><p id="backtestStatus" role="status" aria-live="polite"></p><div id="backtestResults"></div><div id="backtestCurve"></div>`);
 const views=[['advanced','advancedPanel','進階研究'],['portfolio','portfolioPanel','投資組合'],['assistant','assistantPanel','研究助理'],['backtest','backtestPanel','策略回測']];
 for(const [view,id,label] of views){sections[view]=[$i(id)];for(const nav of document.querySelectorAll('aside nav,.mobile-nav')){const b=document.createElement('button');b.type='button';b.className='nav';b.dataset.view=view;b.textContent=label;b.addEventListener('click',()=>setView(view));nav.append(b);}}
 const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);$i('tradeDate').value=today;
 try{const v=localStorage.getItem(KEY);if(v)book=M.ledger(JSON.parse(v));const f=localStorage.getItem(FKEY);if(f)financial=M.financials(JSON.parse(f));}catch(e){storageBroken=true;status('portfolioStatus','本機資料無法讀取；未覆寫原始資料：'+e.message);}
 function persist(next,restore=false){if(storageBroken&&!restore)throw Error('原始本機資料損壞，請先保留原始資料，再用有效帳本還原。');const validated=M.ledger(next);save(KEY,validated);book=validated;storageBroken=false;drawPortfolio();}
 function drawPortfolio(){
  const asOf=meta.trade_date||'',p=M.positions(book,stocks,asOf);
  status('portfolioSummary','估值日期 '+(asOf||'尚未載入')+'｜持股市值 '+fmt(p.total)+'｜已實現損益 '+fmt(p.realized)+'｜股息 '+fmt(p.dividends)+'｜最大單股集中度 '+fmt(p.concentration)+'%'+(p.missing.length?'｜缺同日價格：'+p.missing.join('、')+'，不計算總市值與集中度。':''));
  table('portfolioPositions',['代號','股數','平均成本','剩餘成本','同日股價','市值','未實現損益'],p.rows.map(r=>[r.code,fmt(r.quantity),fmt(r.average),fmt(r.cost),fmt(r.price),fmt(r.value),fmt(r.unrealized)]));
  table('portfolioIndustries',['產業','已知市值','占持股市值%'],Object.entries(p.industries).map(([k,v])=>[QingyuResearch.industryLabel(k),fmt(v),p.total>0?fmt(v/p.total*100):'—']));
  table('transactionRows',['ID','日期','代號','類型','股數／倍數','單價／現金','費用','稅'],book.transactions.map(t=>[t.id,t.date,t.code,t.type,fmt(t.quantity),fmt(t.price),fmt(t.fee),fmt(t.tax)]));
  table('alertResults',['代號','條件','目標','盤後價格','日期','狀態'],M.alerts(book,stocks,asOf).map(a=>[a.code,a.direction==='above'?'≥':'≤',fmt(a.price),fmt(a.current),a.date||'—',a.triggered===null?'缺同日資料':a.triggered?'已達條件':'未達條件']));
 }
 function drawOfficialEps(){const code=$i('researchCode').value.trim(),rows=(officialEps?.records||[]).filter(r=>r.code===code);table('officialEpsResult',['代號','市場','報表期末','官方EPS（非TTM）','出表日期','擷取時間'],rows.map(r=>[r.code,r.market,r.periodEnd,fmt(r.eps),r.reportDate,r.observedAt]));if(!rows.length)$i('officialEpsResult').textContent='此代號尚無可用官方EPS摘要；不代表獲利為0。';}
 async function loadOfficialEps(){const b=$i('officialEpsRefresh');b.disabled=true;try{const res=await fetch('/data/financial-summary.json',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!res.ok)throw Error('EPS資料HTTP '+res.status);const data=await res.json();if(data.version!==1||data.kind!=='official-eps-summary'||!data.meta||typeof data.meta.updatedAt!=='string'||!data.meta.errors||typeof data.meta.errors!=='object'||!Array.isArray(data.records)||data.records.length>5000||data.records.some(r=>!r||!/^\d{4}$/.test(r.code)||!['上市','上櫃'].includes(r.market)||!M.date(r.periodEnd)||!M.date(r.reportDate)||!M.url(r.source)||!Number.isFinite(Date.parse(r.observedAt))||!(r.eps===null||typeof r.eps==='number'&&Number.isFinite(r.eps))))throw Error('官方EPS格式不符');officialEps=data;status('officialEpsStatus','涵蓋 '+data.records.length+' 筆（非全市場）｜更新 '+data.meta.updatedAt+'｜來源異常 '+(Object.keys(data.meta.errors||{}).join('、')||'無')+'。原始來源請見下方官方資料集連結。');drawOfficialEps();}catch(e){status('officialEpsStatus',e.message+(officialEps?'；保留前次資料及其日期。':'；不產生EPS推估。'));}finally{b.disabled=false;}}
 $i('officialEpsRefresh').addEventListener('click',loadOfficialEps);$i('researchCode').addEventListener('input',drawOfficialEps);loadOfficialEps();
 function inspect(){drawOfficialEps();
  const s=stock(),f=M.latestFinancial(financial,s),q=M.quality(f),chip=globalThis.analyzeChipStock?.(s);
  status('advancedStatus',s.code+' '+s.name+'｜行情 '+s.date+'｜財報 '+(f?f.periodEnd+'／公開日 '+f.publishedAt+'／來源 '+f.source:'未提供可用財報'));
  table('financialQuality',['檢查','結果'],[...q.checks.map(c=>[c.label,c.pass?'符合參考門檻':'未符合']),...q.missing.map(x=>[x,'資料不足']),['法人5日合計（股）',fmt(chip?.five?.total)],['法人20日合計（股）',fmt(chip?.twenty?.total)]]);
  return {s,f,chip};
 }
 $i('financialInspect').addEventListener('click',()=>safe('advancedStatus',inspect));
 $i('valueRun').addEventListener('click',()=>safe('advancedStatus',()=>{
  $i('valuationResults').replaceChildren();const {s,f}=inspect();if(!f)throw Error('請先匯入截至行情日已公開的TTM EPS。');
  const rows=M.valuation(s.price,f.eps,['peLow','peBase','peHigh'].map(number),number('marginTarget'));
  table('valuationResults',['情境','假設PE','合理價','目標買入上限','目前安全邊際%'],rows.map(r=>[r.scenario,fmt(r.pe),fmt(r.fair),fmt(r.buyBelow),fmt(r.margin)]));
 }));
 $i('advancedCompare').addEventListener('click',()=>safe('advancedStatus',()=>{
  $i('advancedCompareResult').replaceChildren();const codes=[...new Set($i('advancedCompareCodes').value.split(/[,，\s]+/).filter(Boolean))];if(codes.length<2||codes.length>5)throw Error('請提供2至5個代號');
  const found=codes.map(c=>stocks.find(s=>s.code===c));if(found.some(s=>!s))throw Error('有代號不在快照內');
  if(new Set(found.map(s=>s.date)).size!==1)throw Error('行情日期不同，無法同期比較');
  const fs=found.map(s=>M.latestFinancial(financial,s)),periods=new Set(fs.filter(Boolean).map(f=>f.periodEnd));
  table('advancedCompareResult',['代號','股價','PE（同日）','PB（同日）','財報期末','TTM EPS','ROE%','負債比%'],found.map((s,i)=>[s.code,fmt(s.price),s.valuationDate===s.date?fmt(s.pe):'期間不齊',s.valuationDate===s.date?fmt(s.pb):'期間不齊',fs[i]?.periodEnd||'缺資料',fmt(fs[i]?.eps),fmt(fs[i]?.roe),fmt(fs[i]?.debtRatio)]));
  status('advancedStatus',periods.size>1?'財報期末不同，請勿直接比較；表格保留各自期間。':fs.some(f=>!f)?'行情同期；部分或全部財報缺資料，不產生財務排名。':'行情同期；財報為截至行情日最新公開紀錄。');
 }));
 async function readJSON(file){if(!file||file.size>5*1024*1024)throw Error('請選擇小於5MB的JSON檔');return JSON.parse(await file.text());}
 function fileInput(id,statusId,accept){$i(id).addEventListener('change',async e=>{try{const data=await readJSON(e.target.files[0]);await accept(data);}catch(err){status(statusId,err.message);}finally{e.target.value='';}});}
 fileInput('financialImport','advancedStatus',data=>{const rows=M.financials(data);save(FKEY,{version:1,records:rows});financial=rows;$i('valuationResults').replaceChildren();status('advancedStatus','已匯入 '+rows.length+' 筆財報；來源為提供者聲明，請核對原始財報。');});
 $i('financialTemplate').addEventListener('click',()=>download('qingyu-financial-template.json',{version:1,records:[],schema:{code:'2330',periodEnd:'YYYY-MM-DD',publishedAt:'YYYY-MM-DD',epsPeriodEnd:'與periodEnd相同',epsBasis:'TTM',unit:'TWD',cashFlowUnit:'TWD',source:'https://原始財報網址',eps:null,roe:null,operatingCashFlow:null,netIncome:null,debtRatio:null},note:'所有數字取同一TTM期間；請用實際資料填入records。'}));
 $i('financialClear').addEventListener('click',()=>safe('advancedStatus',()=>{localStorage.removeItem(FKEY);financial=[];$i('financialQuality').replaceChildren();$i('valuationResults').replaceChildren();status('advancedStatus','已清除本機匯入財報');}));
 $i('tradeAdd').addEventListener('click',()=>safe('portfolioStatus',()=>{
  const t={id:crypto.randomUUID?.()||Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join(''),date:$i('tradeDate').value,code:$i('tradeCode').value.trim(),type:$i('tradeType').value,quantity:number('tradeQty'),price:number('tradePrice'),fee:number('tradeFee'),tax:number('tradeTax')};
  if(t.date>today)throw Error('交易日期不可在未來');persist({...book,transactions:[...book.transactions,t]});status('portfolioStatus','交易已保存於此瀏覽器');
 }));
 $i('tradeDelete').addEventListener('click',()=>safe('portfolioStatus',()=>{const id=$i('deleteTradeId').value.trim();if(!book.transactions.some(t=>t.id===id))throw Error('找不到交易ID');persist({...book,transactions:book.transactions.filter(t=>t.id!==id)});status('portfolioStatus','已刪除該筆紀錄；仍須符合不可超賣等帳本規則。');}));
 $i('ledgerExport').addEventListener('click',()=>download('qingyu-investment-backup.json',book));
 fileInput('ledgerImport','portfolioStatus',data=>{const next=M.ledger(data);if(!confirm('以匯入帳本取代本機交易與提醒？請先保留匯出備份。'))return;persist(next,true);status('portfolioStatus','已還原帳本');});
 $i('alertAdd').addEventListener('click',()=>safe('portfolioStatus',()=>{persist({...book,alerts:[...book.alerts,{code:$i('alertCode').value.trim(),direction:$i('alertDirection').value,price:number('alertPrice')}]});status('portfolioStatus','已新增盤後價格提醒');}));
 $i('alertClear').addEventListener('click',()=>safe('portfolioStatus',()=>{persist({...book,alerts:[]});status('portfolioStatus','已清除價格提醒');}));
 $i('researchGenerate').addEventListener('click',()=>safe('researchReport',()=>{$i('researchCode').value=$i('assistantCode').value;const {s,f,chip}=inspect();report=M.research(s,f,chip);status('researchReport',report.text);status('researchAnswer','');const links=$i('researchSources');links.replaceChildren();for(const fact of report.facts){if(!M.url(fact.sourceUrl))continue;const p=document.createElement('p'),a=document.createElement('a');a.href=fact.sourceUrl;a.target='_blank';a.rel='noopener noreferrer';a.textContent=fact.label+'來源（'+(fact.period||'期間未提供')+'）';p.append(a);links.append(p);}}));
 $i('researchAsk').addEventListener('click',()=>safe('researchAnswer',()=>{if(!report)throw Error('請先產生研究摘要');status('researchAnswer',M.answer(report,$i('researchQuestion').value));}));
 $i('researchExport').addEventListener('click',()=>safe('researchAnswer',()=>{if(!report)throw Error('請先產生研究摘要');download('qingyu-research.md',report.text+'\n\nAI分析任務：逐項引用以上來源與日期，區分事實、假設與推論；資料不足不得補造。列出成長論點、反方風險及需補資料。','text/markdown');}));
 $i('cloudResearchAsk').addEventListener('click',async()=>{
  const button=$i('cloudResearchAsk');button.disabled=true;status('cloudResearchAnswer','正在等待AI回覆…');$i('cloudResearchSources').replaceChildren();
  try{
   const question=$i('researchQuestion').value.trim(),code=$i('assistantCode').value.trim();if(!question||question.length>500||!/^\d{4,6}[A-Z]?$/.test(code))throw Error('請輸入有效代號與1至500字問題');
   const response=await fetch('/api/research',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,question}),signal:AbortSignal.timeout(30000)});
   if(response.status===404)throw Error('此環境未啟用AI伺服器，請使用本機來源摘要。');
   if(!(response.headers.get('Content-Type')||'').includes('application/json'))throw Error('AI接口未就緒或需要Access登入，請使用本機來源摘要。');
   const data=await response.json();if(!response.ok)throw Error(data.error||'AI研究失敗');
   if(typeof data.answer!=='string')throw Error('AI回覆格式不符');
   status('cloudResearchAnswer',data.answer+'\n\n'+data.warning+'\n模型 '+data.model+'｜行情日 '+data.asOf);
   for(const source of (data.sources||[])){if(!M.url(source.url))continue;const p=document.createElement('p'),a=document.createElement('a');a.href=source.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='['+source.id+'] '+source.label+'｜'+(source.period||'期間未提供');p.append(a);$i('cloudResearchSources').append(p);}
  }catch(e){status('cloudResearchAnswer',e.name==='TimeoutError'?'AI回覆逾時；可改用本機來源摘要。':e.message);}finally{button.disabled=false;}
 });
 let historyData=null;
 let lastWalkForward=null;
 $i('walkForwardRun').addEventListener('click',()=>safe('backtestStatus',()=>{lastWalkForward=null;$i('walkForwardResults').replaceChildren();const r=M.walkForward(historyData,{initial:number('btInitial'),feeBps:number('btFee'),taxBps:number('btTax'),slippageBps:number('btSlip'),strategy:$i('btStrategy').value,lookback:number('btLookback'),trainBars:number('wfTrain'),testBars:number('wfTest')});lastWalkForward=r;status('backtestStatus',r.warning+'｜累積報酬 '+fmt(r.returnPct)+'%｜最大回撤 '+fmt(r.maxDrawdownPct)+'%｜尾端未使用 '+r.unusedTailBars+' 筆');table('walkForwardResults',['訓練起日','訓練迄日','測試起日','測試迄日','報酬%','回撤%','完成交易'],r.folds.map(f=>[f.trainStart,f.trainEnd,f.start,f.end,fmt(f.returnPct),fmt(f.maxDrawdownPct),f.trades]));}));
 fileInput('backtestImport','backtestStatus',data=>{historyData=data;lastBacktest=null;lastWalkForward=null;$i('walkForwardResults').replaceChildren();$i('backtestResults').replaceChildren();$i('backtestCurve').replaceChildren();status('backtestStatus','已讀入檔案，執行時會檢查日期、公開日及調整方式。');});
 $i('backtestTemplate').addEventListener('click',()=>download('qingyu-backtest-template.json',{version:1,code:'2330',source:'https://原始歷史來源網址',adjustment:'total-return',bars:[],schema:{date:'YYYY-MM-DD',close:'正數：總報酬調整收盤價',signal:'boolean：當時策略持有意願',knownAt:'YYYY-MM-DD：訊號最早公開日，不晚於date'},note:'請提供至少7筆真實歷史資料；樣本內外須各至少2筆。'}));
 $i('backtestRun').addEventListener('click',()=>safe('backtestStatus',()=>{
  lastBacktest=null;$i('backtestResults').replaceChildren();$i('backtestCurve').replaceChildren();
  const r=M.backtest(historyData,{initial:number('btInitial'),feeBps:number('btFee'),taxBps:number('btTax'),slippageBps:number('btSlip'),split:number('btSplit'),strategy:$i('btStrategy').value,lookback:number('btLookback')});lastBacktest=r;
  status('backtestStatus','樣本外起點 '+r.cutoff+'｜'+r.warning);
  table('backtestResults',['區段','起日','迄日','報酬%','最大回撤%','勝率%','完成交易','買入持有%'],[['全期間',r.full],['樣本內',r.inSample],['樣本外（獨立起算）',r.outOfSample]].map(([name,v])=>[name,v.start,v.end,fmt(v.returnPct),fmt(v.maxDrawdownPct),fmt(v.winRate),v.trades,fmt(v.benchmarkPct)]));
  table('backtestCurve',['日期（全期間資產曲線）','期末資產'],r.full.curve.map(p=>[p.date,fmt(p.equity)]));
 }));
 $i('backtestExport').addEventListener('click',()=>safe('backtestStatus',()=>{if(!lastBacktest&&!lastWalkForward)throw Error('請先成功執行回測或滾動驗證');download('qingyu-backtest-result.json',{...lastBacktest,input:historyData,walkForward:lastWalkForward});}));
 const old=globalThis.refreshResearchTools;globalThis.refreshResearchTools=function(){old?.();drawPortfolio();};
 drawPortfolio();const initial=new URLSearchParams(location.search).get('view');if(views.some(v=>v[0]===initial))setView(initial);
})();
