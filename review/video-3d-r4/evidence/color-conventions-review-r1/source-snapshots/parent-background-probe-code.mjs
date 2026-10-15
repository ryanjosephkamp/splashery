// MIT. Renderer-background diagnostic only; no benchmark, source, or image edits.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium} from '/workspace/splashery/node_modules/playwright-core/index.mjs';
import {PNG} from '/workspace/splashery/node_modules/pngjs/lib/png.js';
import {imageMetrics} from '/workspace/splashery-v3d-bench-tools/tools/cdx-v3d-clarity-metrics.mjs';
import {replayPage,captureAt} from '/workspace/splashery-r4-public/tools/v3d-review.mjs';
const root='/workspace/v3d-r4-media',out=root+'/background-probe-r1',folder=root+'/candidate-r8-phone/dianthus-phone',sha=b=>createHash('sha256').update(b).digest('hex');
if(fs.existsSync(out))throw Error('Fresh output required');fs.mkdirSync(out);
const read=f=>JSON.parse(fs.readFileSync(f)),row=read(folder+'/result.json'),model=read(folder+'/model.json'),evaluation=read(folder+'/evaluation.json'),clip=read('/workspace/splashery-v3d-bench-tools/tools/v3d-corpus.json').find(c=>c.id==='dianthus');
const receipt={created:new Date().toISOString(),scriptSha256:sha(fs.readFileSync(import.meta.filename)),protocol:'Same saved model, camera path, production viewer, and references; exact saved-render reproduction required first. Change only renderer clear/background color to match trainer black. No image processing, fitting, or change to strict recorded row. Diagnostic only.',inputs:['model.ply','model.json','evaluation.json','result.json'].map(file=>({file,sha256:sha(fs.readFileSync(folder+'/'+file))}))};
fs.writeFileSync(out+'/pre-dispatch.json',JSON.stringify(receipt,null,2));
let server,browser,context;const timer=setTimeout(()=>server?.process()?.kill('SIGKILL'),300000);
try{
const args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'];server=await chromium.launchServer({executablePath:'/usr/bin/chromium',args});browser=await chromium.connect(server.wsEndpoint());receipt.browser=browser.version();
const replay=await replayPage(browser,{folder,url:'http://127.0.0.1:4179/',model,row,evaluation,preservePhotometric:true},clip,'phone');context=replay.context;receipt.exactVerification=replay.verification;
receipt.before=await replay.page.evaluate(()=>{const {player}=window.__splashery;const c=player.stage.cameraEntity.camera.clearColor;return{background:player.scene.look.background,clear:[c.r,c.g,c.b,c.a]};});
await replay.page.evaluate(()=>{const {player}=window.__splashery;player.scene.look.background='#000000';player.applyLook();});
receipt.frames=[];
for(const [i,f] of row.frames.entries()){const bytes=await captureAt(replay.page,f.time,evaluation.width,evaluation.height),file=`black-${i}.png`;fs.writeFileSync(out+'/'+file,bytes);receipt.frames.push({index:i,file,sha256:sha(bytes),metrics:imageMetrics(PNG.sync.read(bytes),PNG.sync.read(fs.readFileSync(folder+`/reference-${i}.png`)))});}
receipt.errors=replay.errors;if(receipt.errors.length)throw Error(receipt.errors.join('; '));receipt.status='diagnostic-complete';
}catch(e){receipt.status='diagnostic-error';receipt.error=String(e.stack||e);process.exitCode=1;}
finally{clearTimeout(timer);await context?.close().catch(()=>{});await browser?.close().catch(()=>{});await server?.close().catch(()=>{});fs.writeFileSync(out+'/receipt.json',JSON.stringify(receipt,null,2));}
console.log(JSON.stringify({status:receipt.status,before:receipt.before,metrics:receipt.frames?.map(f=>f.metrics),error:receipt.error}));
