// Synthetic data for math tests only. Never included in the public asset allowlist.
export function fixture(){
 const sources=[{id:'fixture',url:'https://example.org/synthetic-test',license:'synthetic mathematics only',authorization:'confirmed',verification:'provider-declared'}];
 const observations=[];let id=0;
 function add(key,value,basis,start,end,published){const o={id:'O'+(++id),key,value,basis,periodStart:start,periodEnd:end,publishedAt:published,obtainedAt:published+'T10:00:00+08:00',sourceId:'fixture',unit:key.toLowerCase().includes('eps')?'TWD/share':key==='shares'?'shares':key==='wacc'?'%':'TWD',status:'ok'};observations.push(o);return o;}
 for(const [year,rev,profit]of [[2022,100e6,10e6],[2023,120e6,12e6],[2024,150e6,15e6],[2025,180e6,18e6]])for(const [k,v]of Object.entries({revenue:rev,netIncome:profit,equityStart:80e6,equityEnd:100e6,ocf:30e6,capex:5e6}))add(k,v,'annual',year+'-01-01',year+'-12-31',(year+1)+'-03-31');
 const end='2026-09-30',published='2026-11-01';for(const [k,v]of Object.entries({eps:5,revenue:240e6,operatingProfit:50e6,grossProfit:100e6,nopat:30e6,averageInvestedCapital:150e6,wacc:8,ebitda:100e6,ocf:40e6,netIncome:30e6,coreProfit:28e6,fcfe:50e6}))add(k,v,'TTM','2025-10-01',end,published);
 add('netDebt',0,'daily',end,end,published);add('bookEquity',300e6,'daily',end,end,published);
 add('revenue',200e6,'TTM','2024-10-01','2025-09-30','2025-11-01');add('shares',10e6,'daily','2026-11-06','2026-11-06','2026-11-06');
 add('consensusEps',5,'forecast','2026-01-01','2026-12-31','2026-10-01');add('managementEps',6,'forecast','2026-01-01','2026-12-31','2026-10-01');
 const dates=[];let t=Date.parse('2026-11-06');while(dates.length<300){const d=new Date(t);if(![0,6].includes(d.getUTCDay()))dates.unshift(d.toISOString().slice(0,10));t-=86400000;}
 const bars=dates.map((date,i)=>{const close=45+i/299*14.5;return {date,open:close-.1,high:close+.5,low:close-.5,close,volume:1000000,amount:close*1000000};});
 const record={code:'2330',market:'上市',name:'合成測試公司（非真實財務）',industry:'24',model:'general',observations,bars,flows:dates.map(date=>({date,foreign:5000,trust:3000,dealer:2000,total:10000})),calendar:dates,barSourceId:'fixture',flowSourceId:'fixture',marketObtainedAt:'2026-11-06T15:00:00+08:00',flowObtainedAt:'2026-11-06T18:00:00+08:00',claims:[{type:'analyst_assumption',text:'合成數學假設，不可視為真實成長論點',confidence:'low',evidenceIds:[]}]};
 return {version:1,kind:'dual-expert-research',sources,records:[record],benchmark:dates.map((date,i)=>({date,close:100+i*.01}))};
}
