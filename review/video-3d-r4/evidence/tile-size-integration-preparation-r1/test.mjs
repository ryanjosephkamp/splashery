// MIT. Made by Ryan with Codex (GPT-6). Compiler selection/uniform controls; no GPU claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {GSTrainer} from './vendor/splatjs/src/gs/trainer.js';
import {GSTrainer as Original} from '/workspace/splashery-v3d-bench-tools-r10/vendor/splatjs/src/gs/trainer.js';
import {GSTrainer as Prototype8} from '/workspace/v3d-r4-media/tile-size-probe-r1/v8/src/gs/trainer.js';
import {tileShaderSource,makeRenderSrc,SCAN_SRC} from './vendor/splatjs/src/gs/shaders.js';

function mocked(work){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{getPreferredCanvasFormat:()=> 'bgra8unorm'}}});
 const d={limits:{maxStorageBufferBindingSize:128*1024*1024},features:new Set(),createShaderModule:x=>x,createComputePipeline:x=>x,createRenderPipeline:x=>x};
 try{return work(d);}finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
}

for(const opts of [{},{tileGrad:false},{ssimWeight:.2},{tileGrad:false,ssimWeight:.2}]){
 test('all default compiled pipelines remain exact '+JSON.stringify(opts),()=>mocked(d=>{
  const options={shDeg:0,compact:false,...opts},a=new Original(d,options),b=new GSTrainer(d,options);
  try{
   assert.equal(b.tileSize,16);
   const keys=Object.keys(a).filter(k=>k.startsWith('pipe'));
   assert.ok(keys.length>=10);
   for(const k of keys)assert.deepEqual(b[k],a[k],k);
  }finally{a.dispose();b.dispose();}
 }));
}

test('tile8 compiles direct raster workgroups without changing image-wide SSIM workgroups',()=>mocked(d=>{
 const t=new GSTrainer(d,{shDeg:0,compact:false,tileGrad:false,tileSize:8,ssimWeight:.2});
 try{
  assert.equal(t.tileSize,8);
  for(const k of ['pipeRender','pipeRenderFwd','pipeRenderBwd']){
   assert.match(t[k].compute.module.code,/const TILEF = 8\.0;/);
   assert.match(t[k].compute.module.code,/@compute @workgroup_size\(8, 8\)/);
   assert.doesNotMatch(t[k].compute.module.code,/@compute @workgroup_size\(16, 16\)/);
  }
  assert.match(t.pipeSsimPrep.compute.module.code,/@compute @workgroup_size\(16, 16\)/);
 }finally{t.dispose();}
}));

test('tile size validation rejects unsupported sizes and shared-gradient combinations before GPU allocation',()=>mocked(d=>{
 for(const tileSize of [0,4,32,-8,Infinity,NaN,'8',true])assert.throws(()=>new GSTrainer(d,{tileSize,tileGrad:false}),/tile size/i);
 for(const tileGrad of [undefined,true,0,'false'])assert.throws(()=>new GSTrainer(d,{tileSize:8,tileGrad}),/direct gradients/);
}));

test('uniform tile counts follow the explicit tile size for partial edge tiles',()=>mocked(d=>{
 const camera={R:[1,0,0,0,1,0,0,0,1],t:[0,0,0],f:43,cx:17.5,cy:13.5,w:35,h:27};
 for(const tileSize of [8,16]){
  const t=new GSTrainer(d,{shDeg:0,compact:false,tileGrad:false,tileSize});
  try{t.n=3;t.cap=3;const u=t._camUniform(camera,1,7);assert.equal(u[22],Math.ceil(35/tileSize));assert.deepEqual(Array.from(u.slice(20,24)),[35,27,Math.ceil(35/tileSize),3]);assert.equal(new Uint32Array(u.buffer)[27],7);}finally{t.dispose();}
 }
}));

test('source specialization preserves default bytes and rejects ambiguous raster anchors',()=>{
 const source=makeRenderSrc(undefined,undefined,false);
 assert.equal(tileShaderSource(source),source);
 assert.equal(tileShaderSource(source,16,true),source);
 assert.equal(tileShaderSource(SCAN_SRC,8),SCAN_SRC.replace('const TILEF = 16.0;','const TILEF = 8.0;'));
 assert.throws(()=>tileShaderSource(source,4,true),/8 or 16/);
 assert.throws(()=>tileShaderSource('@compute @workgroup_size(16, 16)',8,true),/constant/);
 assert.throws(()=>tileShaderSource(source+'\n@compute @workgroup_size(16, 16)',8,true),/ambiguous/);
});

for(const ssimWeight of [0,.2])test('tile8 pipelines match the separately GPU-verified prototype '+ssimWeight,()=>mocked(d=>{
 const opts={shDeg:0,compact:false,tileGrad:false,ssimWeight,serialSort:true},a=new Prototype8(d,opts),b=new GSTrainer(d,{...opts,tileSize:8});
 try{
  for(const key of Object.keys(a).filter(k=>k.startsWith('pipe')))assert.deepEqual(b[key],a[key],key);
  const camera={R:[1,0,0,0,1,0,0,0,1],t:[0,0,0],f:43,cx:17.5,cy:13.5,w:35,h:27};
  for(const t of [a,b]){t.n=3;t.cap=3;}
  assert.deepEqual(b._camUniform(camera,1,7),a._camUniform(camera,1,7));
 }finally{a.dispose();b.dispose();}
}));
