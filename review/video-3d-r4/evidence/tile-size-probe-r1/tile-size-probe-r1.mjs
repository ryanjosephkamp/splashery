// MIT. Made by Ryan with Codex (GPT-6). Fixed-model tile-size diagnostic, never a native bake.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {chromium} from '/workspace/splashery-r4-public/node_modules/playwright-core/index.mjs';
const root='/workspace/v3d-r4-media',out=root+'/tile-size-probe-r1',source='/workspace/splashery-v3d-bench-tools-r10/vendor/splatjs';
const hash=b=>createHash('sha256').update(b).digest('hex'),write=(name,value)=>fs.writeFileSync(out+'/'+name,JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const floats=name=>{const b=fs.readFileSync(out+'/'+name);return Array.from(new Float32Array(b.buffer,b.byteOffset,b.length/4));};
if(fs.existsSync(out))throw Error('Fresh diagnostic directory required');fs.mkdirSync(out);
const sourceFiles=[];
for(const tile of [16,8]){
 fs.cpSync(source,out+'/v'+tile,{recursive:true,errorOnExist:true});
 const file=out+'/v'+tile+'/src/gs/shaders.js',original=fs.readFileSync(file,'utf8');
 if(tile===8){
  if(original.split('export const TILE = 16;').length!==2)throw Error('Tile constant anchor changed');
  const start=original.indexOf('const makeRenderSrcRaw ='),end=original.indexOf('export const makeRenderSrc =',start),part=original.slice(start,end);
  if(part.split('@compute @workgroup_size(16, 16)').length!==2)throw Error('Render workgroup anchor changed');
  const changed=original.replace('export const TILE = 16;','export const TILE = 8;');
  fs.writeFileSync(file,changed.slice(0,start)+changed.slice(start,end).replace('@compute @workgroup_size(16, 16)','@compute @workgroup_size(8, 8)')+changed.slice(end));
 }
 for(const f of ['src/gs/trainer.js','src/gs/shaders.js','src/sfm/geometry.js','src/gpu/context.js']){const b=fs.readFileSync(out+'/v'+tile+'/'+f);sourceFiles.push({file:'v'+tile+'/'+f,bytes:b.length,sha256:hash(b)});}
}
const cacheBytes=fs.readFileSync(root+'/seed-probe.json');if(hash(cacheBytes)!=='a58563911299803f7b9203214ac7a67a19817d6709dc4d1797d30bfa562d910f')throw Error('Cached input changed');
const cache=JSON.parse(cacheBytes),frame=cache.frames[cache.recon.cams[0].imgIdx],cam=cache.recon.cams[0];
const cases=[];
for(const [id,n,w,h,order]of [['small',1000,96,54,[16,8]],['phone',15000,320,180,[8,16]]]){
 const params=new Float32Array(n*16),image=new Float32Array(w*h*3);
 for(let i=0;i<n;i++){const j=Math.floor((i+.5)*cache.seed.n/n);params.set(cache.seed.data.slice(j*16,(j+1)*16),i*16);}
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const x0=x*frame.tw/w,x1=(x+1)*frame.tw/w,y0=y*frame.th/h,y1=(y+1)*frame.th/h;let weight=0,invalid=false;
  for(let sy=Math.floor(y0);sy<Math.ceil(y1);sy++)for(let sx=Math.floor(x0);sx<Math.ceil(x1);sx++){
   const a=(Math.min(sx+1,x1)-Math.max(sx,x0))*(Math.min(sy+1,y1)-Math.max(sy,y0));
   if(frame.rgb[(sy*frame.tw+sx)*3]<0)invalid=true;
   for(let c=0;c<3;c++)image[(y*w+x)*3+c]+=a*frame.rgb[(sy*frame.tw+sx)*3+c];weight+=a;
  }
  for(let c=0;c<3;c++)image[(y*w+x)*3+c]=invalid?-1:image[(y*w+x)*3+c]/weight;
 }
 const scale=w/frame.fw,camera={...cam,imgIdx:0,f:cam.f*scale,fy:(cam.fy??cam.f)*scale,cx:cam.cx*scale,cy:cam.cy*scale,w,h};
 fs.writeFileSync(out+'/'+id+'-params.f32',Buffer.from(params.buffer),{flag:'wx'});fs.writeFileSync(out+'/'+id+'-image.f32',Buffer.from(image.buffer),{flag:'wx'});
 cases.push({id,n,w,h,order,camera,paramsFile:id+'-params.f32',imageFile:id+'-image.f32',paramsSha256:hash(Buffer.from(params.buffer)),imageSha256:hash(Buffer.from(image.buffer))});
}
const reference=JSON.parse(fs.readFileSync(root+'/main-master-r1/run.json')).provenance.environment;
const declaration={at:new Date().toISOString(),cases,sourceFiles,cacheSha256:hash(cacheBytes),scriptSha256:hash(fs.readFileSync(import.meta.filename)),protocol:'Two predeclared fixed-model cases, opposite tile orders. Tile16 and tile8 use identical inputs, direct gradients, serial sort, and native browser flags. Only global tile size and fused render workgroup dimensions differ in isolated source copies. Same-model rendered float pixels and fixed-point gradients must be exact before considering integration. No chain/Adam or model optimization, no geometry solve, no held-out images, no source/runtime/controller changes. GPU stage timing is diagnostic shared-load evidence only.',nativeEnvironment:reference,cpuQuota:fs.readFileSync('/sys/fs/cgroup/cpu.max','utf8').trim(),load:os.loadavg()};
write('declaration.json',declaration);
let browser,server,expired=false;
const receipt={at:new Date().toISOString(),status:'pending',cases:[]},timer=setTimeout(()=>{expired=true;server?.process()?.kill('SIGKILL');},600000);
try{
 server=await chromium.launchServer({executablePath:reference.executablePath,args:reference.launchArgs});browser=await chromium.connect(server.wsEndpoint());receipt.browser=browser.version();
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),page=await context.newPage(),pageErrors=[];
 page.on('pageerror',e=>pageErrors.push(e.message));await page.route('**/tile-size-empty.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto('http://127.0.0.1:4195/tile-size-empty.html');
 for(const c of cases){
  const result=await page.evaluate(async({c,params,image})=>{
   const {createGpu}=await import('/tile-size-probe-r1/v16/src/gpu/context.js'),gpu=await createGpu(),d=gpu.device,errors=[],variants=[];
   d.addEventListener('uncapturederror',e=>errors.push(e.error.message));
   const raw=async(buffer,size)=>{const b=d.createBuffer({size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{const e=d.createCommandEncoder();e.copyBufferToBuffer(buffer,0,b,0,size);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const a=new Uint8Array(b.getMappedRange().slice(0));let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));return btoa(s);}finally{try{b.unmap();}catch{}b.destroy();}};
   try{for(const tile of c.order){
    const {GSTrainer}=await import('/tile-size-probe-r1/v'+tile+'/src/gs/trainer.js');
    const opts={shDeg:0,maxSplats:c.n,capMult:1,entriesCap:16777216,seed:777,dilate:.1,mipComp:true,rectBin:true,compact:true,subgroupAgg:false,gradSpread:1,gradBatch:16,gradZeroSkip:false,projVec:false,camGrads:false,useStats:false,ssimWeight:0,ssaa:0,tileGrad:false,serialSort:true};
    const t=new GSTrainer(d,opts,gpu.info),stages=[];try{
     t.setup({data:Float32Array.from(params),n:c.n,dc:'sigmoid'},[c.camera],[{tw:c.w,th:c.h,rgb:Float32Array.from(image)}],c.w,c.h,1);await d.queue.onSubmittedWorkDone();
     const stage=async(name,encode)=>{const timestamps=d.features.has('timestamp-query'),q=timestamps?d.createQuerySet({type:'timestamp',count:2}):null,qb=timestamps?d.createBuffer({size:16,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}):null,rb=timestamps?d.createBuffer({size:16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}):null,e=d.createCommandEncoder(),p=e.beginComputePass(q?{timestampWrites:{querySet:q,beginningOfPassWriteIndex:0,endOfPassWriteIndex:1}}:{});encode(p);p.end();if(q){e.resolveQuerySet(q,0,2,qb,0);e.copyBufferToBuffer(qb,0,rb,0,16);}const begin=performance.now();d.queue.submit([e.finish()]);await d.queue.onSubmittedWorkDone();let gpuMs=null;if(rb){await rb.mapAsync(GPUMapMode.READ);const a=new BigUint64Array(rb.getMappedRange().slice(0));gpuMs=Number(a[1]-a[0])/1e6;rb.unmap();rb.destroy();qb.destroy();q.destroy();}stages.push({name,wallMs:performance.now()-begin,gpuMs});};
     const gx=Math.ceil(c.w/tile),gy=Math.ceil(c.h/tile);t._writeTrainUniforms(t.camUniforms[0]);d.queue.writeBuffer(t.bufTileCnt,0,t.tileZero);
     for(const [name,pipe,bg,count]of [['project',t.pipeProject,t.bgProjectTrain,Math.ceil(c.n/256)],['scan',t.pipeScan,t.bgScanTrain,1],['scatter',t.pipeScatter,t.bgScatterTrain,Math.ceil(c.n/256)],['sort',t.pipeSort,t.bgSort,gx*gy]])await stage(name,p=>{p.setPipeline(pipe);p.setBindGroup(0,bg);p.dispatchWorkgroups(count);});
     const forward=new Float32Array(t.camUniforms[0]);forward[28]=0;t._writeTrainUniforms(forward);await stage('forwardColdPipeline',p=>{p.setPipeline(t.pipeRender);p.setBindGroup(0,t.bgRenderTrain);p.dispatchWorkgroups(gx,gy);});
     t._writeTrainUniforms(t.camUniforms[0]);await stage('renderBackwardWarmPipeline',p=>{p.setPipeline(t.pipeRender);p.setBindGroup(0,t.bgRenderTrain);p.dispatchWorkgroups(gx,gy);});
     variants.push({tile,maxTiles:t.maxTiles,stages,raw:{gradP:await raw(t.bufGradP,c.n*64),out:await raw(t.bufOut,c.w*c.h*16),stats:await raw(t.bufStats,16),params:await raw(t.bufParams,c.n*64)}});
    }finally{t.dispose();}
   }return {variants,errors,adapter:gpu.info.description};}finally{gpu.dispose();}
  },{c,params:floats(c.paramsFile),image:floats(c.imageFile)});
  if(expired||result.errors.length||pageErrors.length)throw Error('Deadline or GPU/page error: '+JSON.stringify({errors:result.errors,pageErrors}));
  const row={id:c.id,variants:[],parity:{}};
  for(const v of result.variants){const files=[];for(const [kind,b64]of Object.entries(v.raw)){const b=Buffer.from(b64,'base64'),name=c.id+'-tile'+v.tile+'-'+kind+'.bin';fs.writeFileSync(out+'/'+name,b,{flag:'wx'});files.push({kind,file:name,bytes:b.length,sha256:hash(b)});}row.variants.push({...v,raw:undefined,files});}
  for(const kind of ['gradP','out','stats','params']){const a=fs.readFileSync(out+'/'+c.id+'-tile16-'+kind+'.bin'),b=fs.readFileSync(out+'/'+c.id+'-tile8-'+kind+'.bin');row.parity[kind]={byteExact:a.equals(b),differentBytes:a.reduce((sum,v,i)=>sum+Number(v!==b[i]),0)};}
  receipt.cases.push(row);write(c.id+'-result.json',row);
 }
 for(const f of sourceFiles)if(hash(fs.readFileSync(out+'/'+f.file))!==f.sha256)throw Error('Isolated source changed');
 receipt.status='diagnostic-complete';receipt.allParityExact=receipt.cases.every(c=>Object.values(c.parity).every(p=>p.byteExact));
}catch(e){receipt.status='diagnostic-error';receipt.error=String(e.stack||e);process.exitCode=1;}
finally{clearTimeout(timer);await browser?.close().catch(()=>{});if(server){await Promise.race([server.close().catch(()=>{}),new Promise(r=>setTimeout(r,1000))]);server.process()?.kill('SIGKILL');}receipt.finishedAt=new Date().toISOString();write('receipt.json',receipt);}
console.log(JSON.stringify({status:receipt.status,allParityExact:receipt.allParityExact,cases:receipt.cases.map(c=>({id:c.id,parity:c.parity,stages:c.variants.map(v=>({tile:v.tile,stages:v.stages}))})),error:receipt.error}));
