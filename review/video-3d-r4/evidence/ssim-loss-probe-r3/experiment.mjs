// MIT. Controlled optimizer experiment on cached real photographs, not corpus acceptance.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from '/workspace/splashery/node_modules/playwright-core/index.mjs';
import { PNG } from '/workspace/splashery/node_modules/pngjs/lib/png.js';
import { imageMetrics } from '/workspace/splashery-v3d-bench-tools/tools/cdx-v3d-clarity-metrics.mjs';
const root='/workspace/v3d-r4-media',out=root+'/ssim-loss-probe-r3',base='http://127.0.0.1:4188/',sha=b=>createHash('sha256').update(b).digest('hex');
if(fs.existsSync(out))throw Error('Fresh output required');fs.mkdirSync(out);
const bytes=fs.readFileSync(root+'/seed-probe.json');if(sha(bytes)!=='a58563911299803f7b9203214ac7a67a19817d6709dc4d1797d30bfa562d910f')throw Error('Input changed');
const paths=['src/video3d/surface-seed.js','src/video3d/scene.js','vendor/splatjs/src/session.js','vendor/splatjs/src/gs/init.js','vendor/splatjs/src/gs/trainer.js','vendor/splatjs/src/gs/shaders.js','vendor/splatjs/src/gpu/context.js','vendor/splatjs/src/sfm/geometry.js'];
const sources=async()=>Promise.all(paths.map(async file=>{const r=await fetch(base+file,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP'+r.status);const b=Buffer.from(await r.arrayBuffer());return{file,bytes:b.length,sha256:sha(b)};}));
const receipt={created:new Date().toISOString(),scriptSha256:sha(fs.readFileSync(import.meta.filename)),inputSha256:sha(bytes),sourceBefore:await sources(),config:{weights:[0,0.2,0.8],seed:777,steps:80,evalAt:[0,40,80],withheldLossCameras:[3,11],seedSplats:15000,trainSide:320,allocationCeiling:30000},protocol:'Optimizer-only diagnostic with identical real cached SfM, seed, targets, and camera RNG. Cameras3/11 excluded from loss and surface-color inputs. Sparse geometry and sparse colors were previously constructed using all cached images; this is NOT an independent novel-view or task88 acceptance benchmark. No refinement, no preview, no duty cycling, and no native bake timing. Compare fixed-step image quality and complete raw parameter hashes. R3 uses native-phone allocation ceiling and direct gradients; compare only WITHIN R3, not raw R2 timing or quality. Fixed80 steps for all three strengths; weights declared before rendering results.'};
fs.writeFileSync(out+'/pre-dispatch.json',JSON.stringify(receipt,null,2));
let browser,server;const timer=setTimeout(()=>server?.process()?.kill('SIGKILL'),1800000);
try{
const args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-unsafe-webgpu','--enable-features=Vulkan,WebGPU','--use-webgpu-adapter=swiftshader','--use-vulkan=swiftshader'];
server=await chromium.launchServer({executablePath:'/usr/bin/chromium',args});browser=await chromium.connect(server.wsEndpoint());receipt.browser=browser.version();receipt.args=args;
const page=await browser.newPage();page.on('console',m=>console.log(m.text()));await page.route('**/__loss-input.json',r=>r.fulfill({contentType:'application/json',body:bytes}));await page.route('**/__loss.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Real input structural-loss experiment</title>'}));await page.goto(base+'__loss.html');
receipt.results=await page.evaluate(async(config)=>{
 const cache=await(await fetch('/__loss-input.json')).json(),{createSession}=await import('/vendor/splatjs/src/session.js'),{surfaceSeed}=await import('/src/video3d/surface-seed.js');
 const results=[],b64=b=>{let t='';for(let i=0;i<b.length;i+=32768)t+=String.fromCharCode(...b.subarray(i,i+32768));return btoa(t);};
 for(const ssimWeight of config.weights){
  const frames=cache.frames.map((f,i)=>({...f,name:`frame_${i}.jpg`,rgb:Float32Array.from(f.rgb),sharpness:1})),s=createSession({maxIters:1200,initTarget:15000,maxViewW:320,maxViewH:320,lowMem:false,evalHoldEvery:1e9,holdout:-1,trainer:{shDeg:0,maxSplats:30000,serialSort:true,tileGrad:false,seed:config.seed,ssimWeight}});
  try{
   s.useFrames(frames);s.useReconstruction(cache.recon);
   const seedFrames=frames.map((f,i)=>config.withheldLossCameras.includes(i)?{...f,rgb:null}:f),surface=surfaceSeed(cache.recon,seedFrames,{maxPoints:13800});
   await s.seed({initTarget:15000-surface.n,seedLimit:15000,appendGaussians:surface});
   const t=s.trainer,d=t.device,errors=[];t.excluded=new Set(config.withheldLossCameras);t.holdout=-1;d.addEventListener('uncapturederror',e=>errors.push(e.error.message));
   const raw=async(buffer,size)=>{const rb=d.createBuffer({size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}),enc=d.createCommandEncoder();enc.copyBufferToBuffer(buffer,0,rb,0,size);d.queue.submit([enc.finish()]);await rb.mapAsync(GPUMapMode.READ);const bytes=new Uint8Array(rb.getMappedRange().slice(0));rb.unmap();rb.destroy();return bytes;};
   const row={ssimWeight,n:t.n,surface:surface.n,initialParams:b64(new Uint8Array(s.model.data.buffer,s.model.data.byteOffset,t.n*16*4)),evaluations:[],batches:[]};
   const evaluate=async()=>{for(const ci of config.withheldLossCameras){const psnr=await t.evalCamPsnr(ci),meta=t.camMeta[ci],f=frames[meta.imgIdx],buf=await raw(t.bufOut,meta.w*meta.h*16);row.evaluations.push({iter:t.iter,ci,w:meta.w,h:meta.h,psnr,render:b64(buf),reference:b64(new Uint8Array(f.rgb.buffer))});}console.log('[loss] weight='+ssimWeight+' iter='+t.iter);};
   await evaluate();
   while(t.iter<config.steps){const start=performance.now();t.stepOnce();t.stepOnce();await d.queue.onSubmittedWorkDone();row.batches.push(performance.now()-start);if(errors.length)throw Error('GPU validation failed: '+errors[0]);if(config.evalAt.includes(t.iter))await evaluate();}
   row.finalParams=b64(await raw(t.bufParams,t.n*16*4));row.errors=errors;if(errors.length)throw Error('GPU validation failed: '+errors[0]);results.push(row);
  }finally{s.dispose();}
 }return results;
},receipt.config);
for(const r of receipt.results){
 const prefix='weight-'+r.ssimWeight;
 for(const k of ['initialParams','finalParams']){const b=Buffer.from(r[k],'base64'),file=prefix+'-'+k+'.f32';fs.writeFileSync(out+'/'+file,b);r[k]={file,bytes:b.length,sha256:sha(b)};}
 for(const e of r.evaluations){const images={};for(const kind of ['render','reference']){const b=Buffer.from(e[kind],'base64'),x=new Float32Array(b.buffer,b.byteOffset,b.length/4),channels=kind==='render'?4:3,data=Buffer.alloc(e.w*e.h*4);for(let i=0;i<e.w*e.h;i++){for(let k=0;k<3;k++)data[i*4+k]=Math.max(0,Math.min(255,Math.round(x[i*channels+k]*255)));data[i*4+3]=255;}images[kind]={width:e.w,height:e.h,data};const png=PNG.sync.write(images[kind]),file=`${prefix}-${e.iter}-${e.ci}-${kind}.png`;fs.writeFileSync(out+'/'+file,png);e[kind]={file,bytes:png.length,sha256:sha(png)};}e.metrics=imageMetrics(images.render,images.reference);}
}
receipt.identicalInitialParameters=receipt.results.every(r=>r.initialParams.sha256===receipt.results[0].initialParams.sha256);
receipt.sourceAfter=await sources();if(JSON.stringify(receipt.sourceAfter)!==JSON.stringify(receipt.sourceBefore))throw Error('Source changed');receipt.status='diagnostic-complete';
}catch(e){receipt.status='diagnostic-error';receipt.error=String(e.stack||e);process.exitCode=1;}
finally{clearTimeout(timer);await browser?.close().catch(()=>{});await server?.close().catch(()=>{});fs.writeFileSync(out+'/receipt.json',JSON.stringify(receipt,null,2));}
console.log(JSON.stringify({status:receipt.status,error:receipt.error,identicalInitialParameters:receipt.identicalInitialParameters,results:receipt.results?.map(r=>({weight:r.ssimWeight,batchMs:r.batches.reduce((a,b)=>a+b,0),metrics:r.evaluations.map(e=>({iter:e.iter,ci:e.ci,metrics:e.metrics}))}))}));
