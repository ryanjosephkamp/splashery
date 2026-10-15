// MIT. Outside-only real browser proof; no native result or performance claim.
import fs from'node:fs';import{createHash}from'node:crypto';
import{chromium}from'/workspace/splashery-r4-public/node_modules/playwright-core/index.mjs';
import{backgroundShrinkGpuFixture}from'./gpu-fixture.mjs';
const root=import.meta.dirname,sha=b=>createHash('sha256').update(b).digest('hex'),ref=JSON.parse(fs.readFileSync('/workspace/v3d-r4-media/tile-size-probe-r1/declaration.json'));
const files=['vendor/splatjs/src/gs/background-fit.js','vendor/splatjs/src/gs/trainer.js','gpu-fixture.mjs'],sources=()=>files.map(file=>({file,sha256:sha(fs.readFileSync(root+'/'+file))}));
const r={at:new Date().toISOString(),sourcesBefore:sources(),protocol:'Five predeclared actual-GPU synthetic fixtures; preserve legacy full-fit rejection, accept bounded color only with unchanged 1% train and every-camera nonregression, retain full fit, reject harmful direction, reject insufficient train gain. Exact Gaussian bytes and no optimizer steps throughout.'};
fs.writeFileSync(root+'/gpu-declaration.json',JSON.stringify(r,null,2)+'\n',{flag:'wx'});let browser,server;const timer=setTimeout(()=>server?.process()?.kill('SIGKILL'),180000);
try{
 server=await chromium.launchServer({executablePath:ref.nativeEnvironment.executablePath,args:ref.nativeEnvironment.launchArgs});browser=await chromium.connect(server.wsEndpoint());const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/background-shrink-empty.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto('http://127.0.0.1:4195/background-shrink-empty.html');
 r.result=await page.evaluate(backgroundShrinkGpuFixture,'/background-shrink-preparation-r1/vendor/splatjs');r.pageErrors=errors;r.sourcesAfter=sources();
 const cases=r.result.cases,bounded=cases.find(c=>c.id==='bounded-color'),full=cases.find(c=>c.id==='unchanged-full-fit'),tiny=cases.find(c=>c.id==='insufficient-training-gain');
 r.passed=JSON.stringify(r.sourcesBefore)===JSON.stringify(r.sourcesAfter)&&errors.length===0&&r.result.errors.length===0&&cases.length===5&&cases.every(c=>c.modelExact&&c.iters===0&&JSON.stringify(c.cameraReads)==='[0,2,1]'&&c.fit.accepted===c.expectedAccepted&&c.fit.reason===c.expectedReason)&&bounded.fit.validationScale>0&&bounded.fit.validationScale<1&&bounded.fit.improvement>=.01&&bounded.fit.validation.every(v=>v.fittedMse<=v.baseMse)&&full.fit.proposedRgb===undefined&&(full.fit.validationScale??1)===1&&tiny.fit.improvement<.01;
 if(!r.passed)throw Error('Strict constrained-background GPU gate failed');r.status='passed';
}catch(e){r.status='failed';r.error=String(e.stack||e);process.exitCode=1;}
finally{clearTimeout(timer);await browser?.close().catch(()=>{});if(server){await Promise.race([server.close().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,1000))]);server.process()?.kill('SIGKILL');}r.finishedAt=new Date().toISOString();fs.writeFileSync(root+'/gpu-result.json',JSON.stringify(r,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({status:r.status,passed:r.passed,error:r.error,cases:r.result?.cases?.map(c=>({id:c.id,accepted:c.fit.accepted,reason:c.fit.reason,scale:c.fit.validationScale}))}));
