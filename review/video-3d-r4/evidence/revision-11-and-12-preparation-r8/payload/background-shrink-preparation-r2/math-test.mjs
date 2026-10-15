// MIT. Made by Ryan with Codex (GPT-6). Analytic constraints; no native quality claim.
import test from 'node:test';
import assert from 'node:assert/strict';
import {backgroundFitMoments,accumulateBackgroundFit,solveBackgroundFit,backgroundFitSse,constrainBackgroundFit}from'./vendor/splatjs/src/gs/background-fit.js';
const pack=(r,g,b)=>((255<<24)|(b<<16)|(g<<8)|r)>>>0;
function moments(bytes,rgba=[0,0,0,0]){const m=backgroundFitMoments();accumulateBackgroundFit(m,Float32Array.from(rgba),Uint32Array.of(pack(...bytes)));return m;}
test('full color remains byte exact when every internal camera already passes',()=>{
 const rgb=[.8,.6,.4],valid=[moments([204,153,102]),moments([220,180,120])];
 assert.deepEqual(constrainBackgroundFit(rgb,valid),{rgb,scale:1});
});
test('overshooting color shrinks inside the exact analytic nonregressing interval',()=>{
 const train=moments([204,153,102]),rgb=solveBackgroundFit(train),valid=moments([77,64,51]);
 assert.ok(backgroundFitSse(valid,rgb)>valid.baseSse);
 const r=constrainBackgroundFit(rgb,[valid]);assert.ok(r.scale>0&&r.scale<1);
 const bound=2*rgb.reduce((s,v,c)=>s+v*valid.numerator[c],0)/(valid.denominator*rgb.reduce((s,v)=>s+v*v,0));
 assert.equal(r.scale,bound*.99);assert.deepEqual(r.rgb,rgb.map(v=>v*r.scale));
 assert.ok(backgroundFitSse(valid,r.rgb)<valid.baseSse);assert.ok(backgroundFitSse(train,r.rgb)<train.baseSse*.99);
 assert.ok(backgroundFitSse(valid,rgb.map(v=>v*bound*1.001))>valid.baseSse);
});
test('the strictest camera controls magnitude independently of camera order',()=>{
 const rgb=[.8,.6,.4],a=moments([77,64,51]),b=moments([25,20,15]),c=moments([204,153,102]);
 const r=constrainBackgroundFit(rgb,[a,b,c]);assert.deepEqual(r,constrainBackgroundFit(rgb,[c,b,a]));
 assert.ok(r.scale<constrainBackgroundFit(rgb,[a]).scale);
 for(const m of[a,b,c])assert.ok(backgroundFitSse(m,r.rgb)<=m.baseSse);
});
test('a direction that harms even infinitesimal color remains rejected',()=>{
 const valid=moments([0,0,0],[.1,.2,.3,0]);assert.equal(constrainBackgroundFit([.8,.6,.4],[valid]),null);
});
test('an empty validation target remains rejected and zero transmittance is neutral',()=>{
 assert.equal(constrainBackgroundFit([.8,.6,.4],[backgroundFitMoments()]),null);
 const neutral=moments([25,51,76],[.1,.2,.3,1]);assert.deepEqual(constrainBackgroundFit([.8,.6,.4],[neutral]),{rgb:[.8,.6,.4],scale:1});
});
test('input moments and proposed color are never mutated',()=>{
 const rgb=Object.freeze([.8,.6,.4]),m=moments([77,64,51]),before=structuredClone(m);Object.freeze(m.numerator);Object.freeze(m);
 constrainBackgroundFit(rgb,[m]);assert.deepEqual(m,before);assert.deepEqual(rgb,[.8,.6,.4]);
});
test('malformed colors and validation records throw without a partial fit',()=>{
 for(const c of[[NaN,0,0],[-1,0,0],[2,0,0],[0,0],new Array(3)])assert.throws(()=>constrainBackgroundFit(c,[moments([77,64,51])]),/RGB/);
 for(const v of[undefined,[],[null],[{...backgroundFitMoments(),denominator:-1}]])assert.throws(()=>constrainBackgroundFit([.8,.6,.4],v));
});
test('hundreds of independent analytic targets satisfy every unchanged SSE inequality',()=>{
 for(let i=1;i<=250;i++){
  const train=moments([120+i%130,100+i%150,80+i%170]),rgb=solveBackgroundFit(train),validation=[moments([10+i%110,15+i%100,20+i%90]),moments([60+i%140,65+i%130,70+i%120])];
  const r=constrainBackgroundFit(rgb,validation);assert.ok(r);
  for(const m of validation)assert.ok(backgroundFitSse(m,r.rgb)<=m.baseSse);
  assert.ok(backgroundFitSse(train,r.rgb)<=backgroundFitSse(train,[0,0,0]));
 }
});
