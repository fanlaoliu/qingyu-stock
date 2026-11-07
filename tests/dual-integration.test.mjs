import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
test('entrypoint actually loads reused and new modules in dependency order, including deferred existing mode',()=>{
 const html=fs.readFileSync('index.html','utf8'),scripts=[...html.matchAll(/<script[^>]+src="([^"]+)"[^>]*>/g)].map(m=>m[1]);
 for(const p of ['/investment-model.js','/investment-ui.js','/statements-model.js','/statements-ui.js','/dual-engine/core.js','/dual-engine/engine.js','/dual-engine/backtest.js','/dual-engine/ui.js']){assert.ok(scripts.includes(p),p);assert.ok(fs.existsSync(p.slice(1)));}
 for(const [before,after]of [['/investment-model.js','/investment-ui.js'],['/statements-model.js','/statements-ui.js'],['/dual-engine/core.js','/dual-engine/engine.js'],['/dual-engine/engine.js','/dual-engine/ui.js']])assert.ok(scripts.indexOf(before)<scripts.indexOf(after));
 assert.equal(scripts.filter(x=>x==='/ui-mode.js').length,1);assert.ok(html.includes('const initialView='));
});
test('new data source starts empty, no fabricated recommendations or synthetic performance is shipped',()=>{const p=JSON.parse(fs.readFileSync('data/dual-research.json'));assert.deepEqual(p.records,[]);assert.notEqual(p.origin,'verified-official-ingestion');const build=fs.readFileSync('scripts/build_static.py','utf8');assert.ok(build.includes('dual-engine/core.js'));assert.ok(!build.includes('dual-fixture'));const worker=fs.readFileSync('wrangler.jsonc','utf8');assert.ok(!worker.includes('AI_ENABLED'));assert.ok(!worker.includes('DUAL_REVIEW_ENABLED'));});
