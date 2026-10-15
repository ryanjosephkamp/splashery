// MIT. Outside-only runner for the shared real GPU fixture.
import fs from 'node:fs';import {createHash}from'node:crypto';
import {chromium}from'/workspace/splashery-r4-public/node_modules/playwright-core/index.mjs';
import {tileGpuFixture}from'./gpu-fixture.mjs';
const out=import.meta.dirname,hash=b=>createHash('sha256').update(b).digest('hex'),ref=JSON.parse(fs.readFileSync('/workspace/v3d-r4-media/tile-size-probe-r1/declaration.json'));
const files=['vendor/splatjs/src/gs/trainer.js','vendor/splatjs/src/gs/shaders.js','gpu-fixture.mjs'],sources=()=>files.map(file=>({file,sha256:hash(fs.readFileSync(out+'/'+file))}));
const receipt={at:new Date().toISOString(),sourcesBefore:sources(),status:'pending',protocol:'Six predeclared synthetic actual-GPU fixtures, four complete optimizer steps each, direct tile16 vs requested tile8; partial edges, clipped/behind-camera splats, invalid pixels, serial/parallel sort, structural loss, SSAA2, 2049 whole-view opaque splats requiring a raised padded entry cap, and scan-limit fallback. Not a bake or native speed/quality claim.'};
fs.writeFileSync(out+'/gpu-declaration.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});let server,browser;const timer=setTimeout(()=>server?.process()?.kill('SIGKILL'),240000);
try{
 server=await chromium.launchServer({executablePath:ref.nativeEnvironment.executablePath,args:ref.nativeEnvironment.launchArgs});browser=await chromium.connect(server.wsEndpoint());const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/tile-optin-empty.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto('http://127.0.0.1:4195/tile-optin-empty.html');
 receipt.result=await page.evaluate(tileGpuFixture,'/tile-size-integration-preparation-r4/vendor/splatjs');receipt.pageErrors=errors;receipt.sourcesAfter=sources();
 if(JSON.stringify(receipt.sourcesBefore)!==JSON.stringify(receipt.sourcesAfter))throw Error('Prepared source changed');
 receipt.passed=errors.length===0&&receipt.result.errors.length===0&&receipt.result.cases.length===6&&receipt.result.cases.every(c=>Object.values(c.exact).every(Boolean)&&c.variants.every(v=>v.iters===4&&v.finite&&v.changed&&v.maxTiles===v.expectedTiles&&v.entryOverflow===0&&v.tileSize===(c.forceFallback?16:v.requestedTileSize)&&v.entriesCap>=v.tileEntryBound));
 if(!receipt.passed)throw Error('Strict actual GPU parity gate failed');receipt.status='passed';
}catch(e){receipt.status='failed';receipt.error=String(e.stack||e);process.exitCode=1;}
finally{clearTimeout(timer);await browser?.close().catch(()=>{});if(server){await Promise.race([server.close().catch(()=>{}),new Promise(r=>setTimeout(r,1000))]);server.process()?.kill('SIGKILL');}receipt.finishedAt=new Date().toISOString();fs.writeFileSync(out+'/gpu-result.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify(receipt));
