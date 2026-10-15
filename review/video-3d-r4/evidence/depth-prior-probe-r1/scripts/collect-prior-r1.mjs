// MIT. Bounded authorized diagnostic, not runtime code or reconstruction training.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {createHash} from 'node:crypto';
import {chromium} from '/workspace/splashery/node_modules/playwright-core/index.mjs';
const repo='/workspace/splashery',base='http://127.0.0.1:4173/',output='/workspace/v3d-r4-media/depth-prior-probe-r1';
const cachePath='/workspace/v3d-r4-media/seed-probe.json',cacheBytes=fs.readFileSync(cachePath),cache=JSON.parse(cacheBytes),hash=b=>createHash('sha256').update(b).digest('hex');
const r6=JSON.parse(fs.readFileSync('/workspace/v3d-r4-media/candidate-r6/run.json'));
if(!['cat-plays','chameleon-flowers'].every(id=>r6.results.some(r=>r.id===id&&r.profile==='phone'&&['finished','explained','harness-error','timeout','unexplained'].includes(r.status))))throw new Error('Authorized R6 case boundary not reached');
if(hash(cacheBytes)!=='a58563911299803f7b9203214ac7a67a19817d6709dc4d1797d30bfa562d910f')throw new Error('Cached source changed');
if(fs.existsSync(output))throw new Error('Fresh output required');fs.mkdirSync(output);
const config={anchorCameraIndices:[0,5,10,15],side:294,maximumPointsPerAnchor:256,hostDeadlineMs:600000,
 calibration:{knownTrackVisibility:false,sourceFitColorRmseMax:.08,fitCameras:2,unusedValidationCameras:1,minimumParallaxDegrees:.15,maximumParallaxDegrees:12,minimumCorrespondences:30,minimumOccupiedTiles:6,gridTiles:4,spatialValidationTileModulo:4,minimumFitPoints:20,minimumValidationPoints:8,minimumInverseDepthIqrFraction:.08,minimumModelIqrFraction:.05,ransacHypotheses:96,ransacRelativeError:.08,minimumInlierFraction:.6,maximumSpatialValidationMedianRelativeError:.12,huberIterations:4},
 admission:{fitPatchSide:3,maximumFitPatchRmse:.08,sparseOcclusionRadiusPixels:3,sparseOcclusionDepthRatio:1.1,depthQuantileBounds:[.025,.975],depthBoundExpansion:.15,minimumNormalFacingCosine:.15,maximumNeighborInverseDepthJump:.15},
 protocol:'Raw relative inverse depth; fixed 4 cached TRAINING anchors, no held-out images, no relief/card/camera fit. Per-anchor two geometry-selected fit images and separate third TRAINING image. Cached track visibility absent; projected color consistency only, explicitly uncertified. No runtime-integration recommendation from this diagnostic.'};
fs.writeFileSync(path.join(output,'preregistered-config.json'),JSON.stringify(config,null,2)+'\n',{flag:'wx'});
const localFiles=['src/depth/client.js','src/live/depth-worker.js','src/depth/engine.js','src/depth/io.js','src/depth/clip.js','src/packs/photo-3d-core.js','src/photo3d/background.js','src/photo3d/depth-edges.js','vendor/depth-anything-v2-small/model_quantized.onnx','vendor/onnxruntime-web/ort.wasm.min.mjs','vendor/onnxruntime-web/ort-wasm-simd-threaded.mjs','vendor/onnxruntime-web/ort-wasm-simd-threaded.wasm'];
async function served(){const rows=[];for(const file of localFiles){const response=await fetch(new URL(file,base),{cache:'no-store',signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error(`Source ${file} HTTP${response.status}`);const bytes=Buffer.from(await response.arrayBuffer()),local=fs.readFileSync(path.join(repo,file));if(!bytes.equals(local))throw new Error(`Served/local bytes differ: ${file}`);rows.push({file,bytes:bytes.length,sha256:hash(bytes)});}return rows;}
const sourceBefore=await served(),clip=JSON.parse(fs.readFileSync('/workspace/v3d-r4-media/corpus-manifest.json')).find(c=>c.id==='chameleon-flowers');
const anchors=config.anchorCameraIndices.map(index=>{const camera=cache.recon.cams[index],f=cache.frames[camera.imgIdx],data=new Uint8Array(f.tw*f.th*4),valid=new Uint8Array(f.tw*f.th);for(let i=0;i<valid.length;i++){valid[i]=f.rgb[i*3]>=0?1:0;for(let k=0;k<3;k++)data[i*4+k]=Math.round(255*Math.max(0,Math.min(1,f.rgb[i*3+k])));data[i*4+3]=255;}return {index,w:f.tw,h:f.th,data:Array.from(data),inputRgbaSha256:hash(data),validMaskSha256:hash(valid)};});
const launchArgs=['--disable-gpu'];let browser,server,expired=false;
const receipt={created:new Date().toISOString(),cache:{file:cachePath,bytes:cacheBytes.length,sha256:hash(cacheBytes)},configSha256:hash(fs.readFileSync(path.join(output,'preregistered-config.json'))),collectorSha256:hash(fs.readFileSync(import.meta.filename)),evaluatorSha256:hash(fs.readFileSync('/workspace/v3d-r4-media/depth-prior-research/evaluate-prior-r1.mjs')),sourceBefore,clip,launchArgs,environment:{node:process.version,cpu:os.cpus()[0].model,cpuQuota:fs.readFileSync('/sys/fs/cgroup/cpu.max','utf8').trim(),browserExecutable:'/usr/bin/chromium',browserExecutableSha256:hash(fs.readFileSync('/usr/bin/chromium'))},anchors:[],status:'pending',noHeldoutRead:true,visibilityEvidence:'Uncertified projected color consistency; accepted track observations are absent from cache.'};
fs.writeFileSync(path.join(output,'pre-inference-binding.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
const timer=setTimeout(()=>{expired=true;server?.process()?.kill('SIGKILL');},config.hostDeadlineMs);
try{
 server=await chromium.launchServer({executablePath:'/usr/bin/chromium',args:launchArgs});if(expired)throw new Error('Host deadline expired');browser=await chromium.connect(server.wsEndpoint());receipt.environment.browserVersion=browser.version();
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1}),page=await context.newPage(),pageErrors=[],requests=[];
 page.on('pageerror',error=>pageErrors.push(error.message));context.on('request',r=>requests.push(r.url()));
 await page.route('**/v3d-depth-prior-empty.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><title>Local depth diagnostic fixture</title>'}));
 await page.goto(new URL('v3d-depth-prior-empty.html',base).href);
 const result=await page.evaluate(async ({anchors,side})=>{
  const {createDepthClient}=await import('/src/depth/client.js'),client=createDepthClient(),status=[];const start=performance.now();
  try{const loadStart=performance.now(),meta=await client.request('init',{},text=>status.push(text)),loadWallMs=performance.now()-loadStart,rows=[];
   for(const [order,a] of anchors.entries()){const t=performance.now(),depth=await client.request('photo',{w:a.w,h:a.h,data:Uint8Array.from(a.data),options:{side}},text=>status.push(text));rows.push({index:a.index,order,w:depth.w,h:depth.h,d:Array.from(depth.d),wallMs:performance.now()-t,inferenceMs:depth.ms,provider:depth.provider,threads:depth.threads,fallback:depth.fallback});}
   return {loadWallMs,totalWallMs:performance.now()-start,meta,status,rows};
  }finally{client.dispose();}
 },{anchors,side:config.side});
 if(expired)throw new Error('Host deadline expired');if(pageErrors.length)throw new Error(pageErrors.join('; '));
 for(const row of result.rows){const floats=Float32Array.from(row.d);if(!floats.every(Number.isFinite)||floats.length!==row.w*row.h)throw new Error('Invalid raw depth output');const name=`anchor-${row.index}.f32`,bytes=Buffer.from(floats.buffer);fs.writeFileSync(path.join(output,name),bytes,{flag:'wx'});const anchor=anchors.find(a=>a.index===row.index);receipt.anchors.push({...row,d:undefined,file:name,bytes:bytes.length,sha256:hash(bytes),inputRgbaSha256:anchor.inputRgbaSha256,validMaskSha256:anchor.validMaskSha256,sourceSize:[anchor.w,anchor.h]});}
 Object.assign(receipt,{loadWallMs:result.loadWallMs,totalWallMs:result.totalWallMs,coldLoadPlusFirstWallMs:result.loadWallMs+result.rows[0].wallMs,workerMeta:result.meta,statusMessages:result.status,requests:[...new Set(requests)].sort(),pageErrors});
 receipt.sourceAfter=await served();if(JSON.stringify(sourceBefore)!==JSON.stringify(receipt.sourceAfter))throw new Error('Served depth dependencies changed');receipt.status='collected';
}catch(error){receipt.status='diagnostic-error';receipt.reason=String(error.stack||error);process.exitCode=1;}
finally{clearTimeout(timer);await browser?.close().catch(()=>{});if(server){await Promise.race([server.close().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,1000))]);server.process()?.kill('SIGKILL');}fs.writeFileSync(path.join(output,'inference-receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});}
console.log(JSON.stringify({...receipt,sourceBefore:undefined,sourceAfter:undefined,statusMessages:undefined,workerMeta:undefined,clip:undefined,requests:undefined},null,2));
