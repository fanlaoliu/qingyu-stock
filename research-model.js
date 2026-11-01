/* Shared, deterministic research calculations; used by the browser and Node tests. */
(function(root){
 'use strict';
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const equity=r=>/^[1-9]\d{3}$/.test(String(r.code));
 // TWSE / TPEx official industry codes; unknown codes retain their source label.
 const industries={'01':'水泥工業','02':'食品工業','03':'塑膠工業','04':'紡織纖維','05':'電機機械','06':'電器電纜','08':'玻璃陶瓷','09':'造紙工業','10':'鋼鐵工業','11':'橡膠工業','12':'汽車工業','14':'建材營造','15':'航運業','16':'觀光餐旅','17':'金融保險','18':'貿易百貨','20':'其他','21':'化學工業','22':'生技醫療業','23':'油電燃氣業','24':'半導體業','25':'電腦及週邊設備業','26':'光電業','27':'通信網路業','28':'電子零組件業','29':'電子通路業','30':'資訊服務業','31':'其他電子業','32':'文化創意業','33':'農業科技業','35':'綠能環保','36':'數位雲端','37':'運動休閒','38':'居家生活'};
 function industryKey(r){const v=String(r.industry??'').trim();return v?/^\d{1,2}$/.test(v)?v.padStart(2,'0'):v:'__unclassified__';}
 function industryLabel(key){return key==='__unclassified__'?'未分類／未提供行業':industries[key]?industries[key]+'（'+key+'）':'官方分類 '+key;}
 function normalizeExclusions(values){return Array.isArray(values)?[...new Set(values.filter(v=>typeof v==='string'&&v.length>0&&v.length<100).slice(0,128))]:[];}
 function included(r,excluded){return !excluded.has(industryKey(r));}
 const day=86400000;
 function freshDate(v,now){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return false;
  const t=Date.parse(v+'T00:00:00+08:00');
  return Number.isFinite(t)&&new Date(t+8*3600000).toISOString().slice(0,10)===v&&t<=now&&now-t<=7*day;
 }
 function freshRevenue(r,now){
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(r.revenueMonth||''))return false;
  const t=Date.parse(r.revenueMonth+'-01T00:00:00+08:00');return t<=now&&now-t<=100*day;
 }
 const strategies=[
  {id:'growth',name:'成長 × 價值',tag:'成長與估值並看',risk:'中高',description:'先找營收持續成長、估值未超出範例門檻的公司。',rule:'0＜PE≤30、月營收年增≥10%、累計年增＞0%',watch:'仍須查核獲利、現金流與法人動向；低基期可能放大年增率。',fields:['pe','yoy','cumulative'],revenue:true,controls:{maxpe:'30',maxpb:'',minyield:'',minyoy:'10',sort:'yoy'},test:r=>r.pe>0&&r.pe<=30&&r.yoy>=10&&r.cumulative>0},
  {id:'value',name:'低估值觀察',tag:'尋找價格與基本面的落差',risk:'中高',description:'用正本益比、較低淨值比與未衰退的單月營收建立觀察池。',rule:'0＜PE≤15、0＜PB≤1.5、月營收年增≥0%',watch:'低估值可能反映衰退或資產品質問題；未驗證ROE與獲利品質。',fields:['pe','pb','yoy'],revenue:true,controls:{maxpe:'15',maxpb:'1.5',minyield:'',minyoy:'0',sort:'pe'},test:r=>r.pe>0&&r.pe<=15&&r.pb>0&&r.pb<=1.5&&r.yoy>=0},
  {id:'income',name:'現金收益觀察',tag:'重視股利持續性',risk:'中高',description:'觀察歷史殖利率較高、具有正本益比的股票。',rule:'歷史殖利率≥4%、0＜PE≤30',watch:'殖利率不等於總報酬，過去股利不保證續配；股價下跌也會推高殖利率。',fields:['pe','yield'],revenue:false,controls:{maxpe:'30',maxpb:'',minyield:'4',minyoy:'',sort:'yield'},test:r=>r.pe>0&&r.pe<=30&&r.yield>=4},
  {id:'expansion',name:'成長進取觀察',tag:'願意研究更高的成長假設',risk:'高',description:'放寬估值範例門檻，同時要求較高的單月與累計營收成長。',rule:'0＜PE≤50、月營收年增≥20%、累計年增≥10%',watch:'成長不如預期可能同時帶來獲利與估值下修，需檢查客戶集中及景氣循環。',fields:['pe','yoy','cumulative'],revenue:true,controls:{maxpe:'50',maxpb:'',minyield:'',minyoy:'20',sort:'yoy'},test:r=>r.pe>0&&r.pe<=50&&r.yoy>=20&&r.cumulative>=10}
 ];
 function strategy(id){return strategies.find(s=>s.id===id)||null;}
 function eligible(r,id,now=Date.now()){
  const s=strategy(id);return !!s&&equity(r)&&finite(r.price)&&r.price>0&&freshDate(r.date,now)&&r.valuationDate===r.date&&s.fields.every(k=>finite(r[k]))&&(!s.revenue||freshRevenue(r,now));
 }
 function matches(r,id,now=Date.now()){const s=strategy(id);return !!s&&eligible(r,id,now)&&s.test(r);}
 function normalizeStrategies(values){return [...new Set((Array.isArray(values)?values:typeof values==='string'?[values]:[]).filter(id=>strategy(id)))];}
 function matchesAll(r,ids,now=Date.now()){return normalizeStrategies(ids).every(id=>matches(r,id,now));}
 function diagnose(r,id,now=Date.now()){
  const s=strategy(id),reasons=[];
  if(!s)return {status:'unavailable',reasons:['未知策略']};
  if(!r||typeof r!=='object')return {status:'unavailable',reasons:['找不到股票資料']};
  if(!equity(r))reasons.push('此策略僅適用四位數普通股');
  if(!finite(r.price)||r.price<=0)reasons.push('缺少有效收盤價');
  if(!freshDate(r.date,now))reasons.push('行情日期無效、在未來或超過7日');
  if(!r.valuationDate||r.valuationDate!==r.date)reasons.push('估值日期未提供或與行情不同日');
  const labels={pe:'本益比',pb:'股價淨值比',yield:'殖利率',yoy:'月營收年增',cumulative:'累計營收年增'};
  for(const key of s.fields)if(!finite(r[key]))reasons.push('缺少有效'+labels[key]);
  if(s.revenue&&!freshRevenue(r,now))reasons.push('營收月份無效、在未來或超過100日');
  if(reasons.length)return {status:'unavailable',reasons};
  if(s.test(r))return {status:'pass',reasons:[]};
  const rules={
   growth:[[r.pe>0&&r.pe<=30,'本益比須大於0且不超過30'],[r.yoy>=10,'月營收年增須至少10%'],[r.cumulative>0,'累計營收年增須大於0%']],
   value:[[r.pe>0&&r.pe<=15,'本益比須大於0且不超過15'],[r.pb>0&&r.pb<=1.5,'股價淨值比須大於0且不超過1.5'],[r.yoy>=0,'月營收年增須至少0%']],
   income:[[r.pe>0&&r.pe<=30,'本益比須大於0且不超過30'],[r.yield>=4,'歷史殖利率須至少4%']],
   expansion:[[r.pe>0&&r.pe<=50,'本益比須大於0且不超過50'],[r.yoy>=20,'月營收年增須至少20%'],[r.cumulative>=10,'累計營收年增須至少10%']]
  };
  return {status:'fail',reasons:rules[id].filter(([ok])=>!ok).map(([,reason])=>reason)};
 }
 function strategySummary(rows,id,now=Date.now()){
  const counts={total:rows.length,pass:0,unavailable:0,fail:0};
  for(const r of rows)counts[diagnose(r,id,now).status]++;
  return counts;
 }
 const metrics={
  yoy:{label:'月營收年增',unit:'%',min:-50,max:50,legend:['≤−50%','−25%','0%','+25%','≥+50%'],note:'藍色為負成長，琥珀色為正成長；不是股價漲跌幅。超出±50%以端點顏色顯示，數字保留原值。',period:'revenueMonth'},
  pe:{label:'本益比 PE',unit:'倍',min:0,max:60,legend:['0倍','15倍','30倍','45倍','≥60倍'],note:'顏色由淺到深表示倍數增加，超過60倍以端點顏色顯示；高低不等於好壞。',period:'valuationDate'},
  pb:{label:'股價淨值比 PB',unit:'倍',min:0,max:6,legend:['0倍','1.5倍','3倍','4.5倍','≥6倍'],note:'顏色由淺到深表示倍數增加，超過6倍以端點顏色顯示；不同產業不宜直接比較。',period:'valuationDate'},
  yield:{label:'歷史殖利率',unit:'%',min:0,max:8,legend:['0%','2%','4%','6%','≥8%'],note:'顏色由淺到深表示殖利率增加，超過8%以端點顏色顯示；不是未來配息或總報酬預測。',period:'valuationDate'}
 };
 const blend=(a,b,t)=>a.map((v,i)=>Math.round(v+(b[i]-v)*t));
 function color(key,v){
  const m=metrics[key];if(!m||!finite(v))return '#263746';
  let rgb;if(key==='yoy'){const t=Math.min(1,Math.abs(v)/50);rgb=blend([27,45,59],v<0?[38,101,151]:[158,86,25],t);}
  else rgb=blend([20,43,58],[18,108,105],Math.max(0,Math.min(1,(v-m.min)/(m.max-m.min))));
  return 'rgb('+rgb.join(',')+')';
 }
 const allocations=[
  {id:'defensive',name:'防守型範例',weights:[30,50,20],summary:'較低股票比重，保留較多債券與現金。',risk:'仍有股價下跌、債券利率與信用風險；海外資產另有匯率風險。'},
  {id:'balanced',name:'均衡型範例',weights:[60,30,10],summary:'兼顧股票成長、債券與現金彈性。',risk:'股債可能同時下跌，分散不代表保本；仍需符合你的資金用途與期限。'},
  {id:'growth',name:'成長型範例',weights:[80,15,5],summary:'提高股票比重，接受較大的資產波動。',risk:'下跌時承受的損失可能較大，不宜把短期必要支出直接放進高波動資產。'}
 ];
 function allocate(amount,weights){
  if(!finite(amount)||amount<0||amount>1e9||!Number.isInteger(amount)||!Array.isArray(weights)||weights.length!==3||weights.some(w=>!finite(w)||w<0)||Math.abs(weights.reduce((a,b)=>a+b,0)-100)>1e-9)return null;
  const raw=weights.map(w=>amount*w/100),values=raw.map(Math.floor);let remainder=amount-values.reduce((a,b)=>a+b,0);
  const order=raw.map((v,i)=>({i,fraction:v-values[i]})).sort((a,b)=>b.fraction-a.fraction||a.i-b.i);
  for(let i=0;i<remainder;i++)values[order[i%3].i]++;return values;
 }
 root.QingyuResearch=Object.freeze({finite,equity,industryKey,industryLabel,normalizeExclusions,included,strategies,strategy,eligible,matches,normalizeStrategies,matchesAll,diagnose,strategySummary,metrics,color,allocations,allocate});
})(globalThis);
