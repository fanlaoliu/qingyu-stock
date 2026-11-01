(function(){'use strict';
const KEY='qingyu-ui-mode-v1';
const simpleLabels={'股票篩選':'找股票','指標熱力圖':'股票評分','投資理財策略':'選股方法','籌碼面分析':'大資金動向','個股比較':'比較股票','資料狀態':'資料更新狀況','iPhone App':'手機使用說明'};
const explanations={'本益比':'目前股價相對公司獲利的倍數','股價淨值比':'股價相對公司每股淨資產的倍數','殖利率':'過去配息相對股價的比例，不代表未來配息','月營收年增':'最近一個月生意比去年同月成長多少','ROE':'公司運用股東資本創造獲利的能力'};
function mode(){try{return localStorage.getItem(KEY)==='expert'?'expert':'simple'}catch{return 'simple'}}
function apply(value){const expert=value==='expert';document.body.classList.toggle('qingyu-simple',!expert);document.body.classList.toggle('qingyu-expert',expert);document.querySelectorAll('[data-ui-mode]').forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.uiMode===value));b.classList.toggle('active',b.dataset.uiMode===value)});
document.querySelectorAll('button[data-view]').forEach(b=>{if(!b.dataset.originalLabel)b.dataset.originalLabel=b.textContent;const original=b.dataset.originalLabel;const key=Object.keys(simpleLabels).find(k=>original.includes(k));if(key)b.textContent=expert?original:original.replace(key,simpleLabels[key])});
const title=document.querySelector('header h1');if(title){if(!title.dataset.originalTitle)title.dataset.originalTitle=title.textContent;title.textContent=expert?title.dataset.originalTitle:'用簡單的方法，找到值得研究的股票。'}
const intro=document.getElementById('qingyu-simple-intro');if(intro)intro.hidden=expert;
try{localStorage.setItem(KEY,value)}catch{}
}
const bar=document.createElement('div');bar.className='qingyu-mode-bar';bar.setAttribute('role','group');bar.setAttribute('aria-label','網站使用模式');bar.innerHTML='<span>閱讀模式</span><button type="button" data-ui-mode="simple">簡單版</button><button type="button" data-ui-mode="expert">專業版</button>';
const header=document.querySelector('main header');if(!header)return;header.parentNode.insertBefore(bar,header);
const intro=document.createElement('section');intro.id='qingyu-simple-intro';intro.className='qingyu-simple-intro';intro.innerHTML='<h2>第一次使用？從這裡開始</h2><p>① 搜尋股票名稱或代號　② 查看公司獲利與價格　③ 點開詳細分析再決定是否加入自選股。</p><p>本站使用盤後資料，不是即時報價；任何評分都不保證未來漲跌。</p><details><summary>看不懂財務名詞？點此查看白話解釋</summary><dl>'+Object.entries(explanations).map(([k,v])=>'<dt>'+k+'</dt><dd>'+v+'</dd>').join('')+'</dl></details>';
bar.insertAdjacentElement('afterend',intro);
bar.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>apply(b.dataset.uiMode)));apply(mode());
})();