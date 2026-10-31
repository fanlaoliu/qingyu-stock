/* Online-only private app: no dashboard, identity or API response is cached. */
const OFFLINE_PAGE='<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#071523"><title>青嶼研究室｜請重新連線</title><style>body{margin:0;background:#071523;color:#dceff6;font:16px -apple-system,sans-serif;display:grid;place-items:center;min-height:100svh;padding:env(safe-area-inset-top) 24px env(safe-area-inset-bottom);box-sizing:border-box}main{max-width:430px}h1{font-size:28px}p{line-height:1.9;color:#a3bdcb}a{display:block;padding:14px 20px;margin-top:25px;background:#147d72;color:white;border-radius:10px;text-align:center;text-decoration:none}</style></head><body><main><span>◈ 青嶼研究室</span><h1>連線中斷，稍後再回來。</h1><p>私人工作台與行情需要網路連線。本頁未載入你的自選股、研究筆記或任何快取行情。</p><p>請確認網路後重新開啟；若登入已到期，網站會要求重新登入。</p><a href="/?view=app&amp;app=1">重新連線</a></main></body></html>';
self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||event.request.mode!=='navigate'||url.origin!==self.location.origin)return;
 if(url.pathname.startsWith('/api/')||url.pathname==='/data/stocks.json')return;
 // Platform-owned authentication routes must always use their normal network flow.
 if(['/signin-with-chatgpt','/signout-with-chatgpt','/callback'].some(path=>url.pathname===path||url.pathname.startsWith(path+'/')))return;
 event.respondWith(fetch(event.request).catch(()=>new Response(OFFLINE_PAGE,{status:503,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'}})));
});
