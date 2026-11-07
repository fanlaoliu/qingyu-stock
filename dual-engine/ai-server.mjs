import './core.js';
import './engine.js';
import {runDualAgents} from './agents.mjs';
const MODEL='@cf/meta/llama-3.3-70b-instruct-fp8-fast',reply=(s,d)=>Response.json(d,{status:s,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export function createDualHandler({authenticate}={}){return async(request,env)=>{
 try{
  if(request.method!=='POST')return reply(405,{error:'僅接受POST'});
  if(env.AI_ENABLED!=='true'||env.DUAL_REVIEW_ENABLED!=='true'||env.DUAL_REVIEW_MAX_CALLS!=='6'||!env.AI?.run||!env.RESEARCH_RATE_LIMITER?.limit||!env.ACCESS_TEAM_DOMAIN||!env.ACCESS_AUD||!env.RESEARCH_ORIGIN||!authenticate)return reply(503,{error:'雙專家AI未啟用：須先核准身分、模型、用量與六次呼叫上限'});
  if(request.headers.get('Origin')!==env.RESEARCH_ORIGIN||new URL(request.url).origin!==env.RESEARCH_ORIGIN)return reply(403,{error:'來源不符'});
  const user=await authenticate(request,env);if(!(await env.RESEARCH_RATE_LIMITER.limit({key:'dual-review:'+user})).success)return reply(429,{error:'請求過於頻繁'});
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('Content-Type')||''))return reply(415,{error:'須為JSON'});
  const reader=request.body?.getReader();let size=0,chunks=[];if(!reader)return reply(400,{error:'缺內容'});
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1024){await reader.cancel();return reply(413,{error:'內容過大'});}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
  const body=JSON.parse(new TextDecoder().decode(bytes));if(!body||Object.keys(body).length!==1||!body.code||!/^[1-9]\d{3}$/.test(body.code))return reply(400,{error:'只接受普通股代號，不接受筆記、帳本、假設或使用者財報'});
  const response=await env.ASSETS.fetch(new Request(new URL('/data/dual-research.json',request.url)));if(!response.ok)return reply(503,{error:'官方研究資料未就緒'});
  const raw=await response.json();if(raw.synthetic||raw.origin!=='verified-official-ingestion')return reply(422,{error:'尚未建立有來源核對的官方研究檔；不將本機匯入資料送往AI'});
  const pack=globalThis.QingyuDualCore.validate(raw),record=pack.records.find(r=>r.code===body.code),asOf=new Date(Date.now()+8*3600000).toISOString().slice(0,10);if(!record)return reply(422,{error:'沒有此股的完整官方研究證據'});
  const result=globalThis.QingyuDual.evaluate(record,pack,asOf);if(!result.technical.latest||(Date.parse(asOf)-Date.parse(result.technical.latest.date))/86400000>7)return reply(422,{error:'行情缺漏或過期'});
  const evidence=result.sourceEvidence.filter(o=>o.status==='ok'&&o.source.authorization==='confirmed').map(o=>({id:o.id,key:o.key,value:o.value,unit:o.unit,periodEnd:o.periodEnd,publishedAt:o.publishedAt,url:o.source.url}));
  const packet={code:record.code,asOf,metrics:result.metrics,score:result.score,stress:result.valuation.stress,missing:result.missing,evidence};
  const review=await runDualAgents(packet,async call=>{const r=await env.AI.run(MODEL,{messages:call.messages,max_tokens:call.max_tokens,temperature:call.temperature});if(typeof r?.response!=='string')throw Error('模型回應錯誤');return r.response;},{enabled:true,maxCalls:6,model:MODEL});
  return reply(200,review);
 }catch(e){return reply(e.status===401?401:503,{error:e.status===401?'登入驗證失敗':'雙專家AI暫時無法完成；未自動重試，請使用規則化交叉檢查'});}
};}
