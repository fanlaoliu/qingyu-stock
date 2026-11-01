import test from 'node:test';
import assert from 'node:assert/strict';
import '../investment-model.js';
const M=globalThis.QingyuInvestment;
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
const tx=(id,type,quantity,price,fee=0,tax=0,date='2026-10-01')=>({id,code:'2330',date,type,quantity,price,fee,tax});
const book=transactions=>M.ledger({version:1,transactions,alerts:[]});
const financial={code:'2330',periodEnd:'2026-06-30',publishedAt:'2026-08-14',epsPeriodEnd:'2026-06-30',epsBasis:'TTM',unit:'TWD',cashFlowUnit:'TWD',source:'https://example.com/report',eps:10,roe:20,operatingCashFlow:120,netIncome:100,debtRatio:40};
test('financials reject duplicate, wrong units, unsupported EPS period and unsafe source',()=>{
 const records=M.financials({version:1,records:[financial]});assert.equal(records[0].eps,10);
 for(const patch of [{source:'javascript:alert(1)'},{publishedAt:'2026-02-30'},{unit:'thousand TWD'},{epsPeriodEnd:'2026-03-31'},{epsBasis:'quarterly'},{eps:'10'},{debtRatio:101}])assert.throws(()=>M.financials({version:1,records:[{...financial,...patch}]}));
 assert.throws(()=>M.financials({version:1,records:[financial,financial]}));
});
test('as-of financial lookup excludes future publication and orders amendments',()=>{
 const records=[financial,{...financial,publishedAt:'2026-08-20',eps:12}];assert.equal(M.latestFinancial(records,{code:'2330',date:'2026-08-13'}),null);
 assert.equal(M.latestFinancial(records,{code:'2330',date:'2026-08-15'}).eps,10);assert.equal(M.latestFinancial(records,{code:'2330',date:'2026-08-21'}).eps,12);
});
test('quality leaves missing data explicit and does not divide by nonpositive income',()=>{
 assert.equal(M.quality(financial).checks.filter(c=>c.pass).length,4);
 assert.ok(M.quality({...financial,netIncome:0}).missing.length);assert.ok(M.quality(null).missing.length);
});
test('valuation uses margin against fair value and explicit target price',()=>{
 const v=M.valuation(80,10,[8,10,12],20);close(v[1].fair,100);close(v[1].margin,20);close(v[1].buyBelow,80);
 assert.throws(()=>M.valuation(80,-1,[8,10,12],20));assert.throws(()=>M.valuation(80,10,[10,8,12],20));
});
test('moving average cost, fees, partial sale, split and dividend reconcile',()=>{
 const b=book([tx('a','buy',10,100,10),tx('b','buy',10,200,10),tx('c','sell',5,250,5,10),tx('d','split',2,0),tx('e','dividend',0,100)]);
 const p=M.positions(b,[{code:'2330',price:100,date:'2026-10-30',industry:'24'}],'2026-10-30');
 close(p.rows[0].quantity,30);close(p.rows[0].cost,2265);close(p.rows[0].realized,480);close(p.rows[0].unrealized,735);close(p.dividends,100);close(p.total,3000);close(p.concentration,100);
});
test('no short selling, duplicate IDs or split without holdings',()=>{
 assert.throws(()=>book([tx('a','sell',1,100)]));assert.throws(()=>book([tx('a','buy',1,100),tx('a','buy',1,100)]));assert.throws(()=>book([tx('a','split',2,0)]));
});
test('same day order preserved and transactions beyond snapshot excluded',()=>{
 const b=book([tx('a','buy',10,100),tx('b','split',2,0),tx('c','buy',2,200,0,0,'2026-11-01')]);
 close(M.positions(b,[],'2026-10-30').rows[0].quantity,20);
});
test('missing or mismatched price makes totals and concentration unavailable',()=>{
 const b=book([tx('a','buy',10,100)]),p=M.positions(b,[{code:'2330',date:'2026-10-29',price:200}],'2026-10-30');
 assert.equal(p.total,null);assert.equal(p.concentration,null);assert.deepEqual(p.missing,['2330']);assert.equal(p.rows[0].unrealized,null);
 const sold=M.positions(book([tx('a','buy',1,100),tx('b','sell',1,120)]),[],'2026-10-30');assert.equal(sold.total,0);close(sold.realized,20);
});
test('alerts require matching valuation date and preserve unknown state',()=>{
 const b=M.ledger({version:1,transactions:[],alerts:[{code:'2330',direction:'below',price:100}]});
 assert.equal(M.alerts(b,[{code:'2330',date:'2026-10-29',price:90}],'2026-10-30')[0].triggered,null);
 assert.equal(M.alerts(b,[{code:'2330',date:'2026-10-30',price:90}],'2026-10-30')[0].triggered,true);
});
test('research separates rule-based output and unsupported questions',()=>{
 const r=M.research({code:'2330',name:'test',price:100,date:'2026-10-30',yoy:60,pe:null},financial,{usable:true,row:{foreign:1,trust:-1,total:0},date:'2026-10-30'});
 assert.match(r.text,/未連接生成式AI/);assert.equal(r.anomalies.length,2);assert.match(M.answer(r,'本益比？'),/缺資料/);assert.match(M.answer(r,'明天會漲嗎'),/無法回答/);
});
const history=(prices,signals)=>({version:1,code:'2330',source:'https://example.com/prices',adjustment:'total-return',bars:prices.map((close,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,knownAt:`2026-10-${String(i+1).padStart(2,'0')}`,close,signal:signals[i]}))});
test('backtest executes preceding signal at next close, liquidates and reports drawdown',()=>{
 const h=history([100,200,100,100,100,100],[true,false,false,false,false,false]);
 const r=M.backtest(h,{feeBps:0,taxBps:0,slippageBps:0,split:0.5,initial:1000});
 close(r.full.final,500);close(r.full.maxDrawdownPct,50);assert.equal(r.full.trades,1);assert.equal(r.full.winRate,0);
 close(r.outOfSample.final,1000);assert.equal(r.outOfSample.winRate,null);
});
test('backtest roundtrip costs and benchmark charged on both sides',()=>{
 const h=history([100,100,100,100,100,100],[true,true,true,true,true,true]),r=M.backtest(h,{initial:1000,feeBps:100,taxBps:100,slippageBps:100,split:0.5});
 close(r.full.final,1000/1.02*0.97);close(r.full.returnPct,r.full.benchmarkPct);assert.ok(r.full.returnPct<0);
});
test('backtest rejects unknown signal dates, duplicates, raw prices and small holdout',()=>{
 const h=history([100,100,100,100,100,100],[false,false,false,false,false,false]);
 assert.throws(()=>M.backtest({...h,adjustment:'raw'}));assert.throws(()=>M.backtest({...h,bars:h.bars.map((b,i)=>i===0?{...b,knownAt:'2026-10-02'}:b)}));
 assert.throws(()=>M.backtest({...h,bars:[h.bars[0],...h.bars]}));assert.throws(()=>M.backtest(h,{split:0.9}));
 close(M.backtest(h,{split:0.5}).full.returnPct,0);
});
test('SMA signals only use current and prior closes; parameters and input exported',()=>{
 const h=history([100,120,140,160,180,200],[false,false,false,false,false,false]);
 const r=M.backtest(h,{strategy:'sma',lookback:2,feeBps:0,taxBps:0,slippageBps:0,initial:1000,split:0.5});
 // day2 crosses the 2-bar mean; first entry day3 at 140, exit day6 at 200.
 close(r.full.final,1000/140*200);close(r.full.curve[1].equity,1000);
 assert.equal(r.assumptions.strategy,'sma');assert.deepEqual(r.input,h);assert.equal(h.bars[1].signal,false);
 assert.throws(()=>M.backtest(h,{strategy:'sma',lookback:1}));
});
