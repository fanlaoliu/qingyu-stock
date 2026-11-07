// Offline, no model/provider/network calls. Input/report paths are explicit.
import fs from 'node:fs';import '../dual-engine/core.js';import '../dual-engine/engine.js';import '../dual-engine/backtest.js';
const [command,inputPath,asOf,outputPath]=process.argv.slice(2);
if(!['research','backtest'].includes(command)||!inputPath||!outputPath)throw Error('Usage: node scripts/run_dual_research.mjs research|backtest input.json YYYY-MM-DD output.json');
if(fs.existsSync(outputPath))throw Error('報告檔已存在，請使用新檔名');
const input=JSON.parse(fs.readFileSync(inputPath,'utf8'));
let result;if(command==='research'){const pack=QingyuDualCore.validate(input);result=QingyuDual.select(pack,asOf,{},[],pack.benchmark);result.reviews=result.all.map(r=>QingyuDual.crossReview(r));}else result=QingyuDualBacktest.monthly(input);
fs.writeFileSync(outputPath,JSON.stringify({engineVersion:'1.0.0-draft',createdAt:new Date().toISOString(),input,result},null,2),{flag:'wx'});
console.log(JSON.stringify({command,outputPath,status:result.status,verifiedPerformance:false}));
