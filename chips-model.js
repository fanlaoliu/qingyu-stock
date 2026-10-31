(function(root){
 'use strict';
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const keys=['foreign','trust','dealer','total'];
 const iso=v=>/^\d{4}-\d{2}-\d{2}$/.test(v||'')&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 function validate(payload){
  if(payload?.version!==1||payload?.meta?.unit!=='shares'||!payload.markets||typeof payload.markets!=='object')throw Error('籌碼資料格式不符');
  for(const market of ['上市','上櫃']){
   const data=payload.markets[market];if(!data)continue;
   if(!Array.isArray(data.sessions)||data.sessions.length>60)throw Error('籌碼期間格式不符');
   let prior='';for(const s of data.sessions){
    if(!iso(s.date)||s.date<=prior||!s.rows||typeof s.rows!=='object'||Array.isArray(s.rows))throw Error('籌碼日期重複或順序錯誤');prior=s.date;
    for(const [code,row] of Object.entries(s.rows)){
     if(!/^\d{4,6}[A-Z]?$/.test(code)||!row||keys.some(k=>row[k]!==null&&!Number.isSafeInteger(row[k])))throw Error('籌碼欄位格式不符');
     if(keys.every(k=>finite(row[k]))&&row.foreign+row.trust+row.dealer!==row.total)throw Error('籌碼合計不符');
    }
   }
  }return payload;
 }
 function previousWeekday(date){let t=Date.parse(date+'T00:00:00Z')-86400000;while([0,6].includes(new Date(t).getUTCDay()))t-=86400000;return new Date(t).toISOString().slice(0,10);}
 function contiguous(sessions){return sessions.every((s,i)=>i===0||previousWeekday(s.date)===sessions[i-1].date);}
 function analyze(payload,stock,now=Date.now()){
  const market=payload?.markets?.[stock.market],sessions=market?.sessions||[],last=sessions.at(-1),row=last?.rows?.[stock.code];
  const age=last?(now-Date.parse(last.date+'T00:00:00+08:00'))/86400000:NaN;
  const aligned=!!last&&last.date===stock.date,fresh=Number.isFinite(age)&&age>=0&&age<=7;
  const window=n=>{const group=sessions.slice(-n);return group.length===n&&contiguous(group)?Object.fromEntries(keys.map(k=>[k,group.every(s=>finite(s.rows[stock.code]?.[k]))?group.reduce((sum,s)=>sum+s.rows[stock.code][k],0):null])):null;};
  const streak={};
  for(const key of keys){
   let count=0,sign=0,known=false;
   for(let i=sessions.length-1;i>=0;i--){
    if(i<sessions.length-1&&previousWeekday(sessions[i+1].date)!==sessions[i].date)break;
    const value=sessions[i].rows[stock.code]?.[key];if(!finite(value))break;
    const direction=Math.sign(value);if(i===sessions.length-1){sign=direction;if(!sign){known=true;break;}}
    if(direction!==sign){known=true;break;}count++;
   }
   streak[key]={count,sign,exact:known};
  }
  return {date:last?.date||null,row:row||null,aligned,fresh,usable:aligned&&fresh&&!!row,error:payload?.meta?.errors?.[stock.market]||null,count:sessions.length,five:window(5),twenty:window(20),streak};
 }
 function matches(payload,stock,filter,now=Date.now()){
  if(!filter||filter==='all')return true;
  const a=analyze(payload,stock,now);if(!a.usable)return false;
  if(filter==='allBuy')return ['foreign','trust','dealer'].every(k=>finite(a.row[k])&&a.row[k]>0);
  const key={foreignBuy:'foreign',trustBuy:'trust',totalBuy:'total'}[filter];return !!key&&finite(a.row[key])&&a.row[key]>0;
 }
 root.QingyuChips=Object.freeze({keys,validate,analyze,matches,contiguous});
})(globalThis);
