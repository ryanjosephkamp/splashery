// MIT. Controlled optimizer experiment on cached real photographs, not corpus acceptance.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { chromium } from '/workspace/splashery/node_modules/playwright-core/index.mjs';
import { PNG } from '/workspace/splashery/node_modules/pngjs/lib/png.js';
import { imageMetrics } from '/workspace/splashery-v3d-bench-tools/tools/cdx-v3d-clarity-metrics.mjs';
const root='/workspace/v3d-r4-media',out=root+'/learned-background-probe-r1',base='http://127.0.0.1:4188/',sha=b=>createHash('sha256').update(b).digest('hex');
if(fs.existsSync(out))throw Error('Fresh output required');fs.mkdirSync(out);
const bytes=fs.readFileSync(root+'/seed-probe.json');if(sha(bytes)!=='a58563911299803f7b9203214ac7a67a19817d6709dc4d1797d30bfa562d910f')throw Error('Input changed');
const paths=['src/video3d/surface-seed.js','src/video3d/scene.js','vendor/splatjs/src/session.js','vendor/splatjs/src/gs/init.js','vendor/splatjs/src/gs/trainer.js','vendor/splatjs/src/gs/shaders.js','vendor/splatjs/src/gpu/context.js','vendor/splatjs/src/sfm/geometry.js'];
const sources=async()=>Promise.all(paths.map(async file=>{const r=await fetch(base+file,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP'+r.status);const b=Buffer.from(await r.arrayBuffer());return{file,bytes:b.length,sha256:sha(b)};}));
const receipt={created:new Date().toISOString(),scriptSha256:sha(fs.readFileSync(import.meta.filename)),inputSha256:sha(bytes),sourceBefore:await sources(),config:{weights:[0],seed:777,steps:80,evalAt:[0,40,80],withheldLossCameras:[3,11],seedSplats:15000,trainSide:320,allocationCeiling:30000,modelSelection:{minTrainingMseRelativeImprovement:0.01,eachDiagnosticHoldoutMustNotLosePsnr:true}},protocol:'Optimizer-only diagnostic with identical real cached SfM, seed, targets, and camera RNG. Cameras3/11 excluded from loss and surface-color inputs. Sparse geometry and sparse colors were previously constructed using all cached images; this is NOT an independent novel-view or task88 acceptance benchmark. No refinement, no preview, no duty cycling, and no native bake timing. Compare fixed-step image quality and complete raw parameter hashes. R3 uses native-phone allocation ceiling and direct gradients; compare only WITHIN R3, not raw R2 timing or quality. Fixed80 steps for all three strengths; weights declared before rendering results. Global background experiment fits three scalar model parameters from all eligible training pixels after fixed80 steps, excluding both diagnostic loss-held-out cameras. This is independent from the rejected lowtexture heuristic; no cachecolor is supplied. External corpusheldouts are not opened or used. Clamped analytic leastsquares; log full before/after training residual and lossheldout views.'};
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

   row.backgroundParamsBefore=b64(await raw(t.bufParams,t.n*16*4));
   const sums={denom:0,numerator:[0,0,0],baseSse:0,pixels:0,camIndices:[]};
   for(let ci=0;ci<t.camMeta.length;ci++){
    if(t.excluded.has(ci)||ci===t.holdout)continue;
    const m=t.camMeta[ci],f=frames[m.imgIdx],u=t._camUniform({...m,bg:[0,0,0]},0,m.offset,ci);
    d.queue.writeBuffer(t.uniView,0,u);d.queue.writeBuffer(t.bufTileCnt,0,t.tileZero);
    const enc=d.createCommandEncoder(),p=enc.beginComputePass();t.encodeRaster(p,m,false);p.end();d.queue.submit([enc.finish()]);
    const bytes=await raw(t.bufOut,m.w*m.h*16),render=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
    for(let i=0;i<m.w*m.h;i++){
     const trans=1-render[i*4+3];if(!Number.isFinite(trans)||trans<-.000001||trans>1.000001)throw Error('Invalid transmittance');
     sums.denom+=trans*trans;sums.pixels++;
     for(let k=0;k<3;k++){const target=Math.round(Math.max(0,Math.min(1,f.rgb[i*3+k]))*255)/255,residual=target-render[i*4+k];if(!Number.isFinite(residual))throw Error('Invalid RGB');sums.numerator[k]+=trans*residual;sums.baseSse+=residual*residual;}
    }
    sums.camIndices.push(ci);
   }
   const bg=sums.denom>0?sums.numerator.map(v=>Math.max(0,Math.min(1,v/sums.denom))):[0,0,0];
   const fittedSse=sums.baseSse+bg.reduce((sum,v,k)=>sum+sums.denom*v*v-2*v*sums.numerator[k],0);
   row.backgroundFit={...sums,rgb:bg,fittedSse,method:'Analytic global constant3parameter fit; all eligible trainingpixels, no crops, masks or evalinputs. Cache has no perframe source receipts; diagnostics only.'};
   if(fittedSse>sums.baseSse+1e-8)throw Error('Fit increased training SSE');
   for(const ci of config.withheldLossCameras){
    const m=t.camMeta[ci],f=frames[m.imgIdx],u=t._camUniform({...m,bg},0,m.offset,ci);
    d.queue.writeBuffer(t.uniView,0,u);d.queue.writeBuffer(t.bufTileCnt,0,t.tileZero);const enc=d.createCommandEncoder(),p=enc.beginComputePass();t.encodeRaster(p,m,false);p.end();d.queue.submit([enc.finish()]);
    const buf=await raw(t.bufOut,m.w*m.h*16);row.evaluations.push({iter:t.iter,ci,w:m.w,h:m.h,background:bg,label:'fitted-training-only',render:b64(buf),reference:b64(new Uint8Array(f.rgb.buffer))});
   }
   console.log('[fit-background] '+JSON.stringify(row.backgroundFit));

   row.finalParams=b64(await raw(t.bufParams,t.n*16*4));row.errors=errors;if(errors.length)throw Error('GPU validation failed: '+errors[0]);results.push(row);
  }finally{s.dispose();}
 }return results;
},receipt.config);
for(const r of receipt.results){
 const prefix='weight-'+r.ssimWeight;
 for(const k of ['initialParams','finalParams','backgroundParamsBefore']){const b=Buffer.from(r[k],'base64'),file=prefix+'-'+k+'.f32';fs.writeFileSync(out+'/'+file,b);r[k]={file,bytes:b.length,sha256:sha(b)};}
 for(const e of r.evaluations){const images={};for(const kind of ['render','reference']){const b=Buffer.from(e[kind],'base64'),x=new Float32Array(b.buffer,b.byteOffset,b.length/4),channels=kind==='render'?4:3,data=Buffer.alloc(e.w*e.h*4);for(let i=0;i<e.w*e.h;i++){for(let k=0;k<3;k++)data[i*4+k]=Math.max(0,Math.min(255,Math.round(x[i*channels+k]*255)));data[i*4+3]=255;}images[kind]={width:e.w,height:e.h,data};const png=PNG.sync.write(images[kind]),file=`${prefix}-${e.iter}-${e.ci}-${e.label||"black"}-${kind}.png`;fs.writeFileSync(out+'/'+file,png);e[kind]={file,bytes:png.length,sha256:sha(png)};}e.metrics=imageMetrics(images.render,images.reference);}
}
for(const r of receipt.results){r.unchangedModelParametersDuringBackgroundFit=r.backgroundParamsBefore.sha256===r.finalParams.sha256;const before=r.evaluations.filter(e=>e.iter===receipt.config.steps&&!e.label),after=r.evaluations.filter(e=>e.label==='fitted-training-only');r.backgroundFit.diagnosticGate=r.backgroundFit.fittedSse<=r.backgroundFit.baseSse*(1-receipt.config.modelSelection.minTrainingMseRelativeImprovement)&&before.length===after.length&&before.every(b=>after.find(a=>a.ci===b.ci)?.metrics.psnr>=b.metrics.psnr);if(!r.unchangedModelParametersDuringBackgroundFit)throw Error('Background fit changed trained modelparams');}
receipt.identicalInitialParameters=receipt.results.every(r=>r.initialParams.sha256===receipt.results[0].initialParams.sha256);
receipt.sourceAfter=await sources();if(JSON.stringify(receipt.sourceAfter)!==JSON.stringify(receipt.sourceBefore))throw Error('Source changed');receipt.status='diagnostic-complete';
}catch(e){receipt.status='diagnostic-error';receipt.error=String(e.stack||e);process.exitCode=1;}
finally{clearTimeout(timer);await browser?.close().catch(()=>{});await server?.close().catch(()=>{});fs.writeFileSync(out+'/receipt.json',JSON.stringify(receipt,null,2));}
console.log(JSON.stringify({status:receipt.status,error:receipt.error,identicalInitialParameters:receipt.identicalInitialParameters,results:receipt.results?.map(r=>({weight:r.ssimWeight,batchMs:r.batches.reduce((a,b)=>a+b,0),metrics:r.evaluations.map(e=>({iter:e.iter,ci:e.ci,metrics:e.metrics}))}))}));
