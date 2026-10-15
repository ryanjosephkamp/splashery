// MIT. Expected programs come from the independently frozen baseline/prototype, never new code.
import fs from 'node:fs';import {createHash}from'node:crypto';
import {GSTrainer as Baseline}from'/workspace/splashery-v3d-bench-tools-r10/vendor/splatjs/src/gs/trainer.js';
import {GSTrainer as Prototype}from'/workspace/v3d-r4-media/tile-size-probe-r1/v8/src/gs/trainer.js';
const previous=Object.getOwnPropertyDescriptor(globalThis,'navigator');
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{gpu:{getPreferredCanvasFormat:()=> 'bgra8unorm'}}});
const d={limits:{maxStorageBufferBindingSize:128*1024*1024},features:new Set(),createShaderModule:x=>x,createComputePipeline:x=>x,createRenderPipeline:x=>x};
const sha=b=>createHash('sha256').update(b).digest('hex');
const programs=(Constructor,options)=>{
 const t=new Constructor(d,options);try{return Object.fromEntries(Object.entries(t).filter(([k])=>k.startsWith('pipe')).map(([k,v])=>[k,sha(JSON.stringify(v))]));}finally{t.dispose();}
};
try{
 const original=[{},{tileGrad:false},{ssimWeight:.2},{tileGrad:false,ssimWeight:.2}].map(opts=>{const options={shDeg:0,compact:false,...opts};return {options,programs:programs(Baseline,options)};});
 const tile8=[0,.2].map(ssimWeight=>{const options={shDeg:0,compact:false,tileGrad:false,ssimWeight,serialSort:true};return {options,programs:programs(Prototype,options)};});
 fs.mkdirSync(import.meta.dirname+'/candidate-tests/fixtures',{recursive:true});
 fs.writeFileSync(import.meta.dirname+'/candidate-tests/fixtures/v3d-tile-source-hashes.json',JSON.stringify({version:1,notice:'Made by Ryan with Codex (GPT-6), MIT. Default expectations generated only from frozen1cbccf engine; tile8 expectations from the independently GPU-verified global8 prototype. Source program/descriptor hashes include exact shader text. No production candidate is used as its own expected result.',original,tile8},null,2)+'\n',{flag:'wx'});
}finally{if(previous)Object.defineProperty(globalThis,'navigator',previous);else delete globalThis.navigator;}
