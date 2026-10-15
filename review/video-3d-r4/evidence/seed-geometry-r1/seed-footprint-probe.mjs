// MIT. Read-only, bounded geometric diagnostic; no image searches or GPU work.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {surfaceFootprint} from '/workspace/splashery/src/video3d/surface-seed.js';
const cache=JSON.parse(fs.readFileSync('/workspace/v3d-r4-media/seed-probe.json'));
const depth=JSON.parse(fs.readFileSync('/workspace/v3d-r4-media/seed-depth-probe-r1.json'));
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const unit=a=>{const n=Math.hypot(...a);return a.map(v=>v/n);};
const cameras=cache.recon.cams.map(c=>{const image=cache.frames[c.imgIdx],s=image.tw/image.fw;return {...c,f:c.f*s,fy:(c.fy??c.f)*s,cx:c.cx*s,cy:c.cy*s};});
function axes(q){const [x,y,z,w]=q;return [[1-2*(y*y+z*z),2*(x*y+w*z),2*(x*z-w*y)],[2*(x*y-w*z),1-2*(x*x+z*z),2*(y*z+w*x)],[2*(x*z+w*y),2*(y*z-w*x),1-2*(x*x+y*y)]];}
const quantile=(values,p)=>{const s=values.slice().sort((a,b)=>a-b),at=(s.length-1)*p,lo=Math.floor(at),hi=Math.ceil(at);return s.length?s[lo]+(s[hi]-s[lo])*(at-lo):null;};
const quantiles=values=>Object.fromEntries([['min',0],['p10',.1],['p25',.25],['median',.5],['p75',.75],['p90',.9],['p95',.95],['max',1]].map(([k,p])=>[k,quantile(values,p)]));
function projection(camera,position,q,scales){
 const p=[0,1,2].map(k=>dot(camera.R.slice(k*3,k*3+3),position)+camera.t[k]),R=camera.R;
 const jx=[0,1,2].map(k=>camera.f/p[2]*(R[k]-p[0]/p[2]*R[6+k]));
 const jy=[0,1,2].map(k=>camera.fy/p[2]*(R[3+k]-p[1]/p[2]*R[6+k]));
 let xx=0,xy=0,yy=0;const basis=axes(q);
 for(let k=0;k<3;k++){const x=dot(jx,basis[k])*scales[k],y=dot(jy,basis[k])*scales[k];xx+=x*x;xy+=x*y;yy+=y*y;}
 const d=Math.hypot(xx-yy,2*xy),major=Math.sqrt((xx+yy+d)/2),minor=Math.sqrt(Math.max(0,(xx+yy-d)/2));
 return {xx,xy,yy,major,minor,axisRatio:major/minor};
}
const rows=[];
const targetSigma=1.05,maxStretch=8;
const started=performance.now();
for(const prior of depth.projectedAnisotropy.rows){
 const raw=cache.seed.data.slice(prior.index*16,prior.index*16+16),position=raw.slice(0,3),oldQuat=[raw[7],raw[8],raw[9],raw[6]],normal=axes(oldQuat)[2],camera=cameras[prior.reference];
 const p=[0,1,2].map(k=>dot(camera.R.slice(k*3,k*3+3),position)+camera.t[k]);
 const unconstrained=surfaceFootprint(camera,position,normal,targetSigma,Number.MAX_VALUE);
 const bounded=surfaceFootprint(camera,position,normal,targetSigma,maxStretch);
 if(!unconstrained)throw new Error('Expected finite non-grazing Jacobian for cached point');
 const reference=p[2]/Math.sqrt(camera.f*camera.fy)*targetSigma;
 const tangent=projection(camera,position,unconstrained.quat,[unconstrained.scales[0],unconstrained.scales[1],0]);
 const full=projection(camera,position,unconstrained.quat,unconstrained.scales);
 rows.push({index:prior.index,reference:prior.reference,normalFacingCosine:prior.normalFacingCosine,
  originalMinorSigmaPerStep:prior.original.minorSigmaPixels/4,originalMajorSigmaPerStep:prior.original.majorSigmaPixels/4,
  originalAxisRatio:prior.original.axisRatio,stretch:unconstrained.scales[0]/reference,accepted:!!bounded,
  tangentProjection:tangent,fullProjection:full,
  tangentIdentityError:Math.max(Math.abs(tangent.xx-targetSigma**2),Math.abs(tangent.xy),Math.abs(tangent.yy-targetSigma**2))});
}
const elapsedMs=performance.now()-started;
function summarize(values){return {points:values.length,minorSigmaPerStep:quantiles(values.map(r=>r.originalMinorSigmaPerStep)),
 minorSigmaPerStepBelow:Object.fromEntries([.1,.15,.2,.25].map(t=>[t,values.filter(r=>r.originalMinorSigmaPerStep<t).length])),stretch:quantiles(values.map(r=>r.stretch)),
 acceptedAt8:values.filter(r=>r.accepted).length,rejectedAt8:values.filter(r=>!r.accepted).length,
 projectedFullMinor:quantiles(values.map(r=>r.fullProjection.minor)),projectedFullMajor:quantiles(values.map(r=>r.fullProjection.major)),
 tangentIdentityErrorMaximum:Math.max(...values.map(r=>r.tangentIdentityError))};}
// Descriptive point-bootstrap intervals only; spatial samples are correlated and one capture is not a population.
let state=0x8beef121;const random=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/4294967296;};
function interval(values){const medians=[];for(let b=0;b<2000;b++){const sample=values.map(()=>values[Math.floor(random()*values.length)]);medians.push(quantile(sample,.5));}return {n:values.length,pairedMedian:quantile(values,.5),pointBootstrap95:[quantile(medians,.025),quantile(medians,.975)]};}
const valid=depth.rows.filter(r=>r.validationBefore&&r.validationAfter);
const normalValid=depth.rows.filter(r=>r.validationBefore&&r.validationFacingNormal);
const report={created:new Date().toISOString(),inputDepthDiagnostic:'/workspace/v3d-r4-media/seed-depth-probe-r1.json',
 helper:'/workspace/splashery/src/video3d/surface-seed.js',helperSha256:createHash('sha256').update(fs.readFileSync('/workspace/splashery/src/video3d/surface-seed.js')).digest('hex'),
 targetSigma,maxStretch,elapsedMs,all:summarize(rows),accepted:summarize(rows.filter(r=>r.accepted)),nongrazing:summarize(rows.filter(r=>r.normalFacingCosine>=.15)),
 thirdCameraPairedRmseImprovement:{all:interval(valid.map(r=>r.validationBefore.rmse-r.validationAfter.rmse)),confident:interval(valid.filter(r=>r.confident).map(r=>r.validationBefore.rmse-r.validationAfter.rmse)),normalOnly:interval(normalValid.map(r=>r.validationBefore.rmse-r.validationFacingNormal.rmse)),caveat:'Descriptive fixed-point bootstrap; spatial samples are correlated. One capture does not provide capture-level statistical generalization.'},rows};
fs.writeFileSync('/workspace/v3d-r4-media/seed-footprint-probe-r1.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({...report,rows:undefined},null,2));
