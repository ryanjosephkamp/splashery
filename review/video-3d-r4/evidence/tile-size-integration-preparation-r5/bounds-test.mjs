// MIT. Made by Ryan with Codex (GPT-6). CPU capacity and dispatch controls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {GSTrainer} from './vendor/splatjs/src/gs/trainer.js';
function mocked(work,limit=1024**3,bufferLimit=limit){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{getPreferredCanvasFormat:()=> 'bgra8unorm'}}});
 const d={limits:{maxStorageBufferBindingSize:limit,maxBufferSize:bufferLimit},features:new Set(),createShaderModule:x=>x,createComputePipeline:x=>x,createRenderPipeline:x=>x,createBuffer(){throw Error('Unexpected GPU allocation');}};
 try{return work(d);}finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
}
const opts={shDeg:0,compact:false,tileSize:8,tileGrad:false,maxSplats:30000,maxRasterTiles:1600};
test('full phone bound includes every padded segment and raises capacity only when all fit',()=>mocked(d=>{
 const t=new GSTrainer(d,opts);try{assert.equal(t.tileSize,8);assert.equal(t.tileEntryBound,1600*32768);assert.equal(t.entriesCap,52428800);assert.equal(t.pipeScan.compute.constants.ENTCAP,t.entriesCap);}finally{t.dispose();}
}));
test('binding and buffer limits independently select unchanged tile16 without raising memory',()=>{
 for(const [binding,buffer]of[[128*1024**2,1024**3],[1024**3,128*1024**2]])mocked(d=>{
  const t=new GSTrainer(d,opts),old=new GSTrainer(d,{...opts,tileSize:16});try{assert.equal(t.tileSize,16);assert.equal(t.tileEntryBound,0);assert.equal(t.entriesCap,old.entriesCap);for(const k of Object.keys(old).filter(k=>k.startsWith('pipe')))assert.deepEqual(t[k],old[k]);}finally{t.dispose();old.dispose();}
 },binding,buffer);
});
test('missing ceilings, scan overflow, and unsafe multiplication select tile16',()=>mocked(d=>{
 for(const extra of [{maxSplats:undefined},{maxRasterTiles:undefined},{maxRasterTiles:16385},{maxSplats:Number.MAX_SAFE_INTEGER},{maxRasterTiles:8100,maxSplats:250000}]){
  const t=new GSTrainer(d,{...opts,...extra});try{assert.equal(t.tileSize,16);assert.equal(t.tileEntryBound,0);}finally{t.dispose();}
 }
}));
test('explicit malformed ceilings fail before allocating buffers',()=>mocked(d=>{
 for(const key of ['maxSplats','maxRasterTiles'])for(const value of [0,-1,1.5,NaN,Infinity,'30000'])assert.throws(()=>new GSTrainer(d,{...opts,[key]:value}),/positive safe integer/);
}));
test('SSAA scaling cannot undo the final complete entry bound or exceed device capacity',()=>mocked(d=>{
 const t=new GSTrainer(d,{...opts,ssaa:2});try{assert.equal(t.tileSize,8);assert.ok(t.entriesCap>=52428800);assert.ok(t.entriesCap*8<=d.limits.maxBufferSize);}finally{t.dispose();}
}));
test('adversarial whole-view opaque splats require more than the inherited 12M entries',()=>mocked(d=>{
 const t=new GSTrainer(d,{...opts,maxSplats:15000,maxRasterTiles:920});try{
  assert.equal(t.tileSize,8);assert.equal(t.tileEntryBound,15073280);assert.equal(t.entriesCap,15073280);
  // Every padded tile segment fits, including the final one; no drop/sentinel overflow.
  let cursor=0;for(let i=0;i<920;i++){cursor+=16384;assert.ok(cursor<=t.entriesCap);}assert.equal(cursor,t.entriesCap);
 }finally{t.dispose();}
}));
test('seed overflow fails before conversion, truncation, or GPU allocation',()=>mocked(d=>{
 const t=new GSTrainer(d,opts),data=Float32Array.of(2);try{assert.throws(()=>t.setup({n:30001,data,dc:'sh'},[],[],320,180,1),/seed exceeds/);assert.deepEqual(data,Float32Array.of(2));}finally{t.dispose();}
}));
test('later draws respect allocated tiles, allocated pixels, and grown splat count',()=>mocked(d=>{
 const t=new GSTrainer(d,opts);try{
  t.n=15000;t.maxTiles=920;t.maxPixels=320*180;t._checkRasterBounds(320,180);
  for(const [w,h]of[[320,184],[320,240],[0,1],[1,NaN],[1.2,1]])assert.throws(()=>t._checkRasterBounds(w,h),/allocated raster/);
  t.n=30001;assert.throws(()=>t._checkRasterBounds(320,180),/splat bound/);
 }finally{t.dispose();}
}));
for(const loss of ['ssim','ssaa'])test(loss+' image kernels keep 16-wide dispatch while raster uses tile8',()=>mocked(d=>{
 const t=new GSTrainer(d,{...opts,...(loss==='ssim'?{ssimWeight:.2}:{ssaa:2})}),calls=[];let label;
 const pass={setPipeline(p){label=p.label;},setBindGroup(){},dispatchWorkgroups(...dims){calls.push({label,dims});}};
 try{
  t.n=48;t.maxTiles=1600;t.maxPixels=100000;t.encodeRaster(pass,{w:35,h:27},true);
  const raster=calls.filter(c=>c.label.startsWith('render'));assert.equal(raster.length,2);for(const c of raster)assert.deepEqual(c.dims,loss==='ssim'?[5,4]:[9,7]);
  const image=calls.filter(c=>c.label.startsWith(loss==='ssim'?'ssim-':'ssaa-loss'));assert.equal(image.length,loss==='ssim'?6:1);for(const c of image)assert.deepEqual(c.dims,[3,2]);
 }finally{t.dispose();}
}));

test('caller options cannot enlarge a compiled tile8 capacity bound or growth allocation',()=>mocked(d=>{
 const options={shDeg:0,compact:false,tileSize:8,tileGrad:false,maxSplats:48,maxRasterTiles:20,entriesCap:1280},t=new GSTrainer(d,options);
 try{
  options.maxSplats=2049;options.maxRasterTiles=200;
  assert.equal(t.tileMaxSplats,48);assert.equal(t.tileMaxRasterTiles,20);assert.equal(t.entriesCap,1280);
  assert.throws(()=>t.setup({n:49,data:new Float32Array(49*16),dc:'sigmoid'},[],[],35,27,1),/seed exceeds/);
  assert.throws(()=>t.setup({n:48,data:new Float32Array(48*16),dc:'sigmoid'},[],[],80,80,1),/declared raster/);
  assert.equal(t.cap,48);
  t.n=49;t.maxTiles=20;t.maxPixels=35*27;
  assert.throws(()=>t._checkRasterBounds(35,27),/splat bound/);
 }finally{t.dispose();}
}));
