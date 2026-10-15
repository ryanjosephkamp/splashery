// MIT. Made by Ryan with Codex (GPT-6). Predeclared full-optimizer parity after isolated tile R1.
import fs from 'node:fs';import {createHash} from 'node:crypto';
import {chromium} from '/workspace/splashery-r4-public/node_modules/playwright-core/index.mjs';
const root='/workspace/v3d-r4-media',out=root+'/tile-size-probe-r2',prior=root+'/tile-size-probe-r1',hash=b=>createHash('sha256').update(b).digest('hex');
if(fs.existsSync(out))throw Error('Fresh output required');fs.mkdirSync(out);
const write=(f,v)=>fs.writeFileSync(out+'/'+f,JSON.stringify(v,null,2)+'\n',{flag:'wx'}),p=JSON.parse(fs.readFileSync(prior+'/declaration.json'));
const before=()=>p.sourceFiles.map(f=>({file:f.file,sha256:hash(fs.readFileSync(prior+'/'+f.file))}));
const sourceBefore=before(),cases=p.cases.map(c=>({...c,steps:4,order:c.id==='small'?[8,16]:[16,8]}));
write('declaration.json',{at:new Date().toISOString(),scriptSha256:hash(fs.readFileSync(import.meta.filename)),sourceBefore,sourceBinding:p.sourceFiles,cases,protocol:'Four complete fenced stepOnce calls per variant, identical fixed real cached inputs and optimizer seeds; opposite tile orders by case. Preserve raw model, both Adam moments, fixed-point/float gradients, rendered pixels, and statistics. Exact byte parity and zero GPU/page errors required. Includes optimizer work, no camera solve/refinement/held-out images/bakes or native goal claims. Source copies remain outside product and immutable.'});
const result={at:new Date().toISOString(),status:'pending',cases:[]};let server,browser,expired=false;
const timer=setTimeout(()=>{expired=true;server?.process()?.kill('SIGKILL');},600000);
try{
 server=await chromium.launchServer({executablePath:p.nativeEnvironment.executablePath,args:p.nativeEnvironment.launchArgs});browser=await chromium.connect(server.wsEndpoint());result.browser=browser.version();
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),page=await context.newPage(),pageErrors=[];page.on('pageerror',e=>pageErrors.push(e.message));
 await page.route('**/tile-step-empty.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html>'}));await page.goto('http://127.0.0.1:4195/tile-step-empty.html');
 for(const c of cases){
  const floats=name=>{const b=fs.readFileSync(prior+'/'+name);return Array.from(new Float32Array(b.buffer,b.byteOffset,b.length/4));};
  const data=await page.evaluate(async({c,params,image})=>{
   const {createGpu}=await import('/tile-size-probe-r1/v16/src/gpu/context.js'),gpu=await createGpu(),d=gpu.device,errors=[],variants=[];
   d.addEventListener('uncapturederror',e=>errors.push(e.error.message));
   const raw=async(buffer,size)=>{const b=d.createBuffer({size,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});try{const e=d.createCommandEncoder();e.copyBufferToBuffer(buffer,0,b,0,size);d.queue.submit([e.finish()]);await b.mapAsync(GPUMapMode.READ);const a=new Uint8Array(b.getMappedRange().slice(0));let s='';for(let i=0;i<a.length;i+=32768)s+=String.fromCharCode(...a.subarray(i,i+32768));return btoa(s);}finally{try{b.unmap();}catch{}b.destroy();}};
   try{for(const tile of c.order){
    const {GSTrainer}=await import('/tile-size-probe-r1/v'+tile+'/src/gs/trainer.js'),t=new GSTrainer(d,{shDeg:0,maxIters:1200,maxSplats:c.n,capMult:1,entriesCap:16777216,seed:777,dilate:.1,mipComp:true,rectBin:true,compact:true,subgroupAgg:false,camGrads:false,useStats:false,ssimWeight:0,ssaa:0,tileGrad:false,serialSort:true},gpu.info);
    try{
     t.setup({data:Float32Array.from(params),n:c.n,dc:'sigmoid'},[c.camera],[{tw:c.w,th:c.h,rgb:Float32Array.from(image)}],c.w,c.h,1);await d.queue.onSubmittedWorkDone();const steps=[];
     for(let i=0;i<c.steps;i++){const start=performance.now();t.stepOnce();await d.queue.onSubmittedWorkDone();steps.push({iter:t.iter,wallMs:performance.now()-start});}
     const buffers={params:[t.bufParams,c.n*64],adamM:[t.bufM,c.n*64],adamV:[t.bufV,c.n*64],gradP:[t.bufGradP,c.n*64],gradF:[t.bufGradF,c.n*64],out:[t.bufOut,c.w*c.h*16],stats:[t.bufStats,16]},snapshot={};
     for(const[k,[b,n]]of Object.entries(buffers))snapshot[k]=await raw(b,n);
     variants.push({tile,steps,raw:snapshot});
    }finally{t.dispose();}
   }return{variants,errors};}finally{gpu.dispose();}
  },{c,params:floats(c.paramsFile),image:floats(c.imageFile)});
  if(expired||data.errors.length||pageErrors.length)throw Error('GPU/page/deadline failure: '+JSON.stringify({errors:data.errors,pageErrors}));
  const row={id:c.id,variants:[],parity:{}};
  for(const v of data.variants){const files=[];for(const[k,s]of Object.entries(v.raw)){const b=Buffer.from(s,'base64'),file=c.id+'-tile'+v.tile+'-'+k+'.bin';fs.writeFileSync(out+'/'+file,b,{flag:'wx'});files.push({kind:k,file,bytes:b.length,sha256:hash(b)});}row.variants.push({...v,raw:undefined,files});}
  for(const k of ['params','adamM','adamV','gradP','gradF','out','stats']){const a=fs.readFileSync(out+'/'+c.id+'-tile16-'+k+'.bin'),b=fs.readFileSync(out+'/'+c.id+'-tile8-'+k+'.bin');row.parity[k]={byteExact:a.equals(b),differentBytes:a.reduce((sum,v,i)=>sum+Number(v!==b[i]),0)};}
  result.cases.push(row);write(c.id+'-result.json',row);
 }
 result.sourceAfter=before();if(JSON.stringify(sourceBefore)!==JSON.stringify(result.sourceAfter))throw Error('Isolated source changed');result.status='diagnostic-complete';result.allParityExact=result.cases.every(c=>Object.values(c.parity).every(v=>v.byteExact));result.gpuAndPageErrors=[];
}catch(e){result.status='diagnostic-error';result.error=String(e.stack||e);process.exitCode=1;}
finally{clearTimeout(timer);await browser?.close().catch(()=>{});if(server){await Promise.race([server.close().catch(()=>{}),new Promise(r=>setTimeout(r,1000))]);server.process()?.kill('SIGKILL');}result.finishedAt=new Date().toISOString();write('receipt.json',result);}
console.log(JSON.stringify({status:result.status,allParityExact:result.allParityExact,cases:result.cases.map(c=>({id:c.id,parity:c.parity,variants:c.variants.map(v=>({tile:v.tile,steps:v.steps}))})),error:result.error}));
