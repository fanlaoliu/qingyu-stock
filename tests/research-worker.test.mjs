import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPair,exportJWK,SignJWT} from 'jose';
import worker,{createHandler,verifyAccess} from '../research-worker.mjs';
const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
function setup(overrides={}){
 const calls=[];
 const env={AI_ENABLED:'true',RESEARCH_ORIGIN:'https://research.example',ACCESS_TEAM_DOMAIN:'https://unit-test.cloudflareaccess.com',ACCESS_AUD:'unit-audience',
  AI:{run:async(model,input)=>{calls.push({model,input});return {response:'行情取自快照 [S1]，資料不足無法推估未來報酬。'};}},
  RESEARCH_RATE_LIMITER:{limit:async()=>({success:true})},
  ASSETS:{fetch:async()=>Response.json({meta:{mode:'official'},stocks:[{code:'2330',name:'test',market:'上市',date:today,price:100,pe:null,valuationDate:null,yoy:null}]})},...overrides};
 const request=(body={code:'2330',question:'營收與估值風險？'},headers={})=>new Request('https://research.example/api/research',{method:'POST',headers:{Origin:'https://research.example','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
 return {env,calls,request};
}
test('AI disabled or incompletely configured fails closed with no inference or data leak',async()=>{
 const {env,calls,request}=setup({AI_ENABLED:'false'});const r=await worker.fetch(request(),env);assert.equal(r.status,503);assert.equal(calls.length,0);assert.equal(r.headers.get('Cache-Control'),'no-store');
 for(const change of [{RESEARCH_RATE_LIMITER:null},{ACCESS_AUD:''},{ACCESS_TEAM_DOMAIN:'https://evil.example'},{RESEARCH_ORIGIN:'http://research.example'}]){const x=setup(change);assert.equal((await worker.fetch(x.request(),x.env)).status,503);assert.equal(x.calls.length,0);}
});
test('missing or forged Access headers cannot invoke AI',async()=>{
 const {env,calls,request}=setup();assert.equal((await worker.fetch(request(),env)).status,401);
 assert.equal((await worker.fetch(request(undefined,{'Cf-Access-Jwt-Assertion':'forged'}),env)).status,401);assert.equal(calls.length,0);
});
test('cross-origin, rate-limited and non-POST requests cannot invoke AI',async()=>{
 const h=createHandler({authenticate:async()=> 'user'}),x=setup();
 assert.equal((await h(x.request(undefined,{Origin:'https://evil.example'}),x.env)).status,403);
 assert.equal((await h(new Request('https://research.example/api/research'),x.env)).status,405);
 const y=setup({RESEARCH_RATE_LIMITER:{limit:async()=>({success:false})}});assert.equal((await h(y.request(),y.env)).status,429);assert.equal(y.calls.length+x.calls.length,0);
});
test('strict request schema and byte limit reject private fields and large bodies',async()=>{
 const h=createHandler({authenticate:async()=> 'user'}),{env,calls,request}=setup();
 for(const body of [{code:'2330',question:'test',portfolio:[]},{code:'2330',question:''},{code:'bad',question:'test'}])assert.equal((await h(request(body),env)).status,400);
 assert.equal((await h(request({code:'2330',question:'x'.repeat(9000)}),env)).status,413);assert.equal(calls.length,0);
});
test('AI receives server-owned official fields only and response includes source metadata',async()=>{
 const h=createHandler({authenticate:async()=> 'user'}),{env,calls,request}=setup();
 const r=await h(request(),env);assert.equal(r.status,200);const data=await r.json();assert.match(data.answer,/\[S1\]/);assert.equal(data.sources.length,3);
 const input=JSON.parse(calls[0].input.messages[1].content);assert.equal(input.officialSnapshot.pe,null);assert.equal(input.officialSnapshot.price,100);assert.equal(input.portfolio,undefined);assert.equal(calls[0].input.max_tokens,800);
});
test('stale data, unsupported citations and provider errors fail without raw exception',async()=>{
 const h=createHandler({authenticate:async()=> 'user'});
 const stale=setup({ASSETS:{fetch:async()=>Response.json({meta:{mode:'official'},stocks:[{code:'2330',date:'2000-01-01',price:100}]})}});assert.equal((await h(stale.request(),stale.env)).status,422);assert.equal(stale.calls.length,0);
 for(const text of ['no citation','invalid [S9]']){const x=setup({AI:{run:async()=>({response:text})}});assert.equal((await h(x.request(),x.env)).status,502);}
 const x=setup({AI:{run:async()=>{throw Error('private upstream error');}}});const r=await h(x.request(),x.env);assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private upstream/);
});
test('static fallback delegates to allowlisted asset binding; unknown APIs return404',async()=>{
 const x=setup({ASSETS:{fetch:async()=>new Response('static')}});assert.equal(await (await worker.fetch(new Request('https://research.example/'),x.env)).text(),'static');assert.equal((await worker.fetch(new Request('https://research.example/api/other'),x.env)).status,404);
});
test('Access validation checks signature, issuer, audience and expiration using JWKS',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256'),jwk={...await exportJWK(publicKey),kid:'unit-key',alg:'RS256',use:'sig'};
 const original=globalThis.fetch;globalThis.fetch=async(url)=>{assert.equal(String(url),'https://unit-test.cloudflareaccess.com/cdn-cgi/access/certs');return Response.json({keys:[jwk]});};
 const {env}=setup(),now=Math.floor(Date.now()/1000);
 const token=async(patch={})=>new SignJWT({sub:'test-subject',iss:env.ACCESS_TEAM_DOMAIN,aud:env.ACCESS_AUD,iat:now,exp:now+60,...patch}).setProtectedHeader({alg:'RS256',kid:'unit-key'}).sign(privateKey);
 const request=jwt=>new Request('https://research.example/api/research',{headers:{'Cf-Access-Jwt-Assertion':jwt}});
 try{
  assert.equal(await verifyAccess(request(await token()),env),'test-subject');
  for(const patch of [{aud:'wrong'},{iss:'https://other.cloudflareaccess.com'},{exp:now-1},{iat:now+60}])await assert.rejects(verifyAccess(request(await token(patch)),env));
  const valid=await token(),parts=valid.split('.');parts[1]=Buffer.from(JSON.stringify({sub:'forged',iss:env.ACCESS_TEAM_DOMAIN,aud:env.ACCESS_AUD,iat:now,exp:now+60})).toString('base64url');await assert.rejects(verifyAccess(request(parts.join('.')),env));
 }finally{globalThis.fetch=original;}
});
