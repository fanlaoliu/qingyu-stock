(function(){
 'use strict';
 const el=id=>document.getElementById(id);
 const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 function updateStatus(){
  el('appMode').textContent=/Qingyu-iOS\//.test(navigator.userAgent)?'iOS App 模式':standalone()?'主畫面 App 模式':'瀏覽器模式';
  el('appConnection').textContent=navigator.onLine?'裝置顯示連線中；行情是否成功請看來源狀態。':'裝置目前離線，無法更新行情或重新驗證登入。';
  el('connectionBanner').hidden=navigator.onLine;
 }
 addEventListener('online',updateStatus);addEventListener('offline',updateStatus);addEventListener('pageshow',updateStatus);updateStatus();
 el('appOpenGuide').addEventListener('click',()=>{setView('app');el('appPanel').scrollIntoView({block:'start',behavior:'instant'});});
 if('serviceWorker' in navigator&&window.isSecureContext){
  navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(reg=>{
   el('appServiceStatus').textContent='連線中斷提示已設定；私人頁面與行情仍須連網載入。';
   reg.update().catch(()=>{});
  }).catch(()=>{el('appServiceStatus').textContent='此瀏覽器尚未啟用連線中斷提示；請保持連線使用。仍可依Safari選單加入主畫面。';});
 }else el('appServiceStatus').textContent='此瀏覽器無法啟用連線中斷提示，請連網使用。';
 let pending=null;
 const status=message=>{el('backupStatus').textContent=message;};
 el('exportAppData').addEventListener('click',()=>{
  try{
   const data=QingyuAppData.exportData(localStorage),blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
   if(blob.size>QingyuAppData.maxBytes)throw Error('備份超過10MB，請先整理筆記。');
   const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='qingyu-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);
   status('已產生備份檔。請將檔案保存到「檔案」App；匯入前請妥善保管，其中可能包含你的研究筆記。');
  }catch(e){status('無法匯出：'+e.message);}
 });
 el('importAppFile').addEventListener('change',async event=>{
  pending=null;el('confirmAppImport').disabled=true;
  const file=event.target.files?.[0];if(!file)return;
  try{
   if(file.size>QingyuAppData.maxBytes)throw Error('檔案超過10MB。');
   pending=QingyuAppData.normalize(JSON.parse(await file.text()));
   status('已讀取備份：'+pending.favorites.length+' 檔自選、'+Object.keys(pending.notes).length+' 筆筆記、'+pending.excludedIndustries.length+' 類排除。按「匯入並合併」後才會寫入；同代號既有筆記與既有儲存篩選會保留。');el('confirmAppImport').disabled=false;
  }catch(e){status('無法讀取備份：'+e.message);}
 });
 el('confirmAppImport').addEventListener('click',()=>{
  if(!pending)return;
  try{
   const result=QingyuAppData.importData(localStorage,pending);
   favorites.clear();JSON.parse(localStorage.getItem('qingyu-favorites-v1')||'[]').forEach(c=>favorites.add(c));
   excludedIndustries=new Set(QingyuResearch.normalizeExclusions(JSON.parse(localStorage.getItem('qingyu-excluded-industries-v1')||'[]')));
   updateCoverage();compute();status('匯入完成：目前自選 '+result.favorites+' 檔、排除 '+result.excluded+' 類、新增筆記 '+result.notesAdded+' 筆。儲存的篩選設定可在選股頁按「載入設定」。');
   pending=null;el('confirmAppImport').disabled=true;el('importAppFile').value='';
  }catch(e){status(e.message);}
 });
})();
