// MIT. Read-only CPU diagnostic of cached training photographs and surface seeds.
// No held-out benchmark images, runtime changes, GPU work, color fitting, or normal fitting.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const input = '/workspace/v3d-r4-media/seed-probe.json';
const output = '/workspace/v3d-r4-media/seed-depth-probe-r1.json';
const loadStart = performance.now(), bytes = fs.readFileSync(input), cache = JSON.parse(bytes);
const loadMs = performance.now() - loadStart;
const config = {
  maximumPoints: 256, gridStride: 4, gridOrigin: 2.5,
  relativeDepthBounds: [0.85, 1.15], inverseDepthSamples: 13,
  patchSide: 3, fitCameras: 2, validationCameras: 1,
  minimumParallaxDegrees: 0.15, maximumParallaxDegrees: 12,
  minimumNormalFacingCosine: 0.15, minimumReferenceTexture: 0.015,
  sparseOcclusionRadiusPixels: 3, sparseOcclusionDepthRatio: 1.10,
  confidenceMaximumFitRmse: 0.08, confidenceRelativeFitGain: 0.10,
  confidenceAbsoluteFitGain: 0.003, confidenceSeparatedDepthDistance: 0.04,
  confidenceUniqueMargin: 0.002, rejectSearchEndpoints: true,
  parametersChosenBeforeReadingAgreementResults: true,
};
const dot = (a,b) => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub = (a,b) => a.map((x,k)=>x-b[k]);
const norm = a => Math.hypot(...a);
const unit = a => { const length=norm(a);return a.map(x=>x/length); };
const transpose = (r,p) => [r[0]*p[0]+r[3]*p[1]+r[6]*p[2],r[1]*p[0]+r[4]*p[1]+r[7]*p[2],r[2]*p[0]+r[5]*p[1]+r[8]*p[2]];
const cameras = cache.recon.cams.map((camera,index) => {
  const image=cache.frames[camera.imgIdx], scale=image.tw/image.fw;
  if(image.rgb.length!==image.tw*image.th*3)throw new Error('Wrong cached RGB dimensions');
  return {...camera,index,image,f:camera.f*scale,fy:(camera.fy??camera.f)*scale,
    cx:camera.cx==null?image.tw/2:camera.cx*scale,cy:camera.cy==null?image.th/2:camera.cy*scale,
    centre:transpose(camera.R,camera.t.map(x=>-x))};
});
function project(camera,p) {
  const r=camera.R,t=camera.t;
  const x=r[0]*p[0]+r[1]*p[1]+r[2]*p[2]+t[0],y=r[3]*p[0]+r[4]*p[1]+r[5]*p[2]+t[1],z=r[6]*p[0]+r[7]*p[1]+r[8]*p[2]+t[2];
  if(z<=0)return null;
  const u=camera.f*x/z+camera.cx,v=camera.fy*y/z+camera.cy;
  return u>=0.5&&v>=0.5&&u<camera.image.tw-0.5&&v<camera.image.th-0.5?[u,v,z]:null;
}
let sampleCalls=0,projectedPatchPoints=0;
function sample(camera,u,v) {
  sampleCalls++;
  const x=u-0.5,y=v-0.5,ix=Math.floor(x),iy=Math.floor(y),width=camera.image.tw,height=camera.image.th;
  if(ix<0||iy<0||ix+1>=width||iy+1>=height)return null;
  const dx=x-ix,dy=y-iy,rgb=camera.image.rgb,result=[0,0,0];
  for(const [xx,yy,weight] of [[0,0,(1-dx)*(1-dy)],[1,0,dx*(1-dy)],[0,1,(1-dx)*dy],[1,1,dx*dy]]) {
    const at=((iy+yy)*width+ix+xx)*3;
    if(rgb[at]<0||rgb[at+1]<0||rgb[at+2]<0)return null;
    for(let k=0;k<3;k++)result[k]+=rgb[at+k]*weight;
  }
  return result;
}
for(const camera of cameras) {
  camera.sparse=cache.recon.points.flatMap(point=>{const p=project(camera,point.X);return p?[p]:[];});
}
const preparationMs=performance.now()-loadStart-loadMs;
function visible(camera,p) {
  const uv=project(camera,p);
  if(!uv)return false;
  let front=Infinity;
  for(const sparse of camera.sparse)
    if(Math.abs(sparse[0]-uv[0])<=config.sparseOcclusionRadiusPixels&&Math.abs(sparse[1]-uv[1])<=config.sparseOcclusionRadiusPixels)
      front=Math.min(front,sparse[2]);
  return !Number.isFinite(front)||uv[2]<=front*config.sparseOcclusionDepthRatio;
}
const originCandidates=[0,5,10,15].map(index=>cameras[index]);
function chooseOrigin(position) {
  return originCandidates.flatMap(camera=>{
    const p=project(camera,position);if(!p)return [];
    const residual=Math.hypot(...p.slice(0,2).map(value=>{
      const grid=(value-config.gridOrigin)/config.gridStride;
      return (grid-Math.round(grid))*config.gridStride;
    }));
    return [{camera,p,residual}];
  }).sort((a,b)=>a.residual-b.residual)[0];
}
function normalOf(row) {
  const q=unit(row.slice(6,10)),[w,x,y,z]=q;
  return unit([2*(x*z+w*y),2*(y*z-w*x),1-2*(x*x+y*y)]);
}
function patch(reference,uv,normal,depthRatio) {
  const ray=transpose(reference.R,[(uv[0]-reference.cx)/reference.f,(uv[1]-reference.cy)/reference.fy,1]);
  const centre=reference.centre.map((x,k)=>x+ray[k]*uv[2]*depthRatio), numerator=dot(normal,sub(centre,reference.centre));
  const points=[],colors=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++) {
    const u=uv[0]+dx,v=uv[1]+dy;
    const direction=transpose(reference.R,[(u-reference.cx)/reference.f,(v-reference.cy)/reference.fy,1]);
    const denom=dot(normal,direction), distance=numerator/denom;
    if(!Number.isFinite(distance)||distance<=0||Math.abs(denom)<1e-8)return null;
    const color=sample(reference,u,v);if(!color)return null;
    points.push(reference.centre.map((x,k)=>x+direction[k]*distance));colors.push(color);
  }
  return {centre,points,colors};
}
function errorAgainst(referencePatch,others) {
  if(!referencePatch)return null;
  let square=0,count=0,centerSquare=0;
  for(const camera of others) {
    if(!visible(camera,referencePatch.centre))return null;
    for(let index=0;index<referencePatch.points.length;index++) {
      const p=project(camera,referencePatch.points[index]);projectedPatchPoints++;
      const color=p&&sample(camera,p[0],p[1]);if(!color)return null;
      for(let k=0;k<3;k++) {
        const delta=color[k]-referencePatch.colors[index][k];square+=delta*delta;count++;
        if(index===4)centerSquare+=delta*delta;
      }
    }
  }
  return {rmse:Math.sqrt(square/count),centerRmse:Math.sqrt(centerSquare/(others.length*3))};
}
const invMin=1/config.relativeDepthBounds[1],invMax=1/config.relativeDepthBounds[0];
const ratios=[...new Set([1,...Array.from({length:config.inverseDepthSamples},(_,i)=>1/(invMin+i*(invMax-invMin)/(config.inverseDepthSamples-1)))])].sort((a,b)=>a-b);
const chosen=Array.from({length:Math.min(config.maximumPoints,cache.seed.n)},(_,i)=>Math.round(i*(cache.seed.n-1)/(Math.min(config.maximumPoints,cache.seed.n)-1)));
const skips={}, rows=[];
const anisotropy=[];
const skip=reason=>{skips[reason]=(skips[reason]||0)+1;};
let maximumAnchorResidual=0,maximumReconstructionError=0;
function projectedShape(camera,position,normal,tangentSigma,normalSigma) {
  const p=project(camera,position),r=camera.R;
  if(!p)return null;
  const xz=(p[0]-camera.cx)/camera.f,yz=(p[1]-camera.cy)/camera.fy;
  const jx=[0,1,2].map(k=>camera.f/p[2]*(r[k]-xz*r[6+k]));
  const jy=[0,1,2].map(k=>camera.fy/p[2]*(r[3+k]-yz*r[6+k]));
  const tangent2=tangentSigma*tangentSigma,difference=normalSigma*normalSigma-tangent2;
  const nx=dot(jx,normal),ny=dot(jy,normal);
  const xx=tangent2*dot(jx,jx)+difference*nx*nx,yy=tangent2*dot(jy,jy)+difference*ny*ny,xy=tangent2*dot(jx,jy)+difference*nx*ny;
  const root=Math.sqrt((xx-yy)**2+4*xy*xy),major=Math.sqrt(Math.max(0,(xx+yy+root)/2)),minor=Math.sqrt(Math.max(1e-16,(xx+yy-root)/2));
  return {majorSigmaPixels:major,minorSigmaPixels:minor,axisRatio:major/minor};
}
const runStart=performance.now();
for(const index of chosen) {
  const row=cache.seed.data.slice(index*16,index*16+16),position=row.slice(0,3),normal=normalOf(row),origin=chooseOrigin(position);
  if(!origin||origin.residual>0.001){skip('no-unambiguous-cached-origin');continue;}
  const {camera:reference,p:uv}=origin;
  maximumAnchorResidual=Math.max(maximumAnchorResidual,origin.residual);
  const ray=unit(sub(position,reference.centre));
  const tangentSigma=Math.exp(row[3]),normalSigma=Math.exp(row[5]);
  if(Math.abs(row[3]-row[4])>1e-6)throw new Error('Cached tangent scales are not isotropic');
  anisotropy.push({index,reference:reference.index,normalFacingCosine:Math.abs(dot(normal,ray)),
    original:projectedShape(reference,position,normal,tangentSigma,normalSigma),
    cameraFacing:projectedShape(reference,position,ray,tangentSigma,normalSigma)});
  if(Math.abs(dot(normal,ray))<config.minimumNormalFacingCosine){skip('grazing-normal');continue;}
  const neighbors=cameras.flatMap(camera=>{
    if(camera===reference||!visible(camera,position))return [];
    const otherRay=unit(sub(position,camera.centre)),angle=Math.acos(Math.max(-1,Math.min(1,dot(ray,otherRay))))*180/Math.PI;
    return angle>=config.minimumParallaxDegrees&&angle<=config.maximumParallaxDegrees?[{camera,angle,distance:norm(sub(camera.centre,reference.centre))}]:[];
  }).sort((a,b)=>a.distance-b.distance||a.camera.index-b.camera.index);
  if(neighbors.length<3){skip('too-few-geometric-neighbors');continue;}
  const fit=neighbors.slice(0,2),validation=neighbors[2];
  const basePatch=patch(reference,uv,normal,1);if(!basePatch){skip('invalid-reference-patch');continue;}
  maximumReconstructionError=Math.max(maximumReconstructionError,norm(sub(basePatch.centre,position)));
  const gray=basePatch.colors.map(c=>0.299*c[0]+0.587*c[1]+0.114*c[2]),mean=gray.reduce((s,x)=>s+x,0)/gray.length;
  const texture=Math.sqrt(gray.reduce((s,x)=>s+(x-mean)**2,0)/gray.length);
  if(texture<config.minimumReferenceTexture){skip('low-reference-texture');continue;}
  const baseline=errorAgainst(basePatch,fit.map(x=>x.camera));
  if(!baseline){skip('baseline-fit-visibility');continue;}
  const candidates=ratios.flatMap(ratio=>{
    const data=patch(reference,uv,normal,ratio),error=errorAgainst(data,fit.map(x=>x.camera));
    return error?[{ratio,...error}]:[];
  }).sort((a,b)=>a.rmse-b.rmse||Math.abs(a.ratio-1)-Math.abs(b.ratio-1));
  if(!candidates.length){skip('no-fit-depth');continue;}
  const best=candidates[0],separated=candidates.filter(c=>Math.abs(c.ratio-best.ratio)>=config.confidenceSeparatedDepthDistance);
  const margin=separated.length?Math.min(...separated.map(c=>c.rmse))-best.rmse:0;
  const boundary=Math.abs(best.ratio-config.relativeDepthBounds[0])<1e-8||Math.abs(best.ratio-config.relativeDepthBounds[1])<1e-8;
  const confident=best.rmse<=config.confidenceMaximumFitRmse&&baseline.rmse-best.rmse>=config.confidenceAbsoluteFitGain&&best.rmse<=baseline.rmse*(1-config.confidenceRelativeFitGain)&&margin>=config.confidenceUniqueMargin&&!boundary;
  // The validation photograph is read only AFTER depth and confidence have been fixed.
  const validationBefore=errorAgainst(basePatch,[validation.camera]);
  const validationAfter=errorAgainst(patch(reference,uv,normal,best.ratio),[validation.camera]);
  const validationFacingNormal=errorAgainst(patch(reference,uv,ray,1),[validation.camera]);
  rows.push({index,reference:reference.index,fit:fit.map(x=>x.camera.index),validation:validation.camera.index,
    parallaxDegrees:{fit:fit.map(x=>x.angle),validation:validation.angle},texture,depthRatio:best.ratio,margin,boundary,confident,
    baselineFit:baseline,selectedFit:best,validationBefore,validationAfter,validationFacingNormal});
}
const elapsedMs=performance.now()-runStart;
const median=values=>{if(!values.length)return null;const v=values.slice().sort((a,b)=>a-b),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;};
const summarize=data=>{
  const valid=data.filter(r=>r.validationBefore&&r.validationAfter);
  const improvement=valid.map(r=>r.validationBefore.rmse-r.validationAfter.rmse);
  return {points:data.length,independentlyVisible:valid.length,
    fitBeforeMedian:median(data.map(r=>r.baselineFit.rmse)),fitAfterMedian:median(data.map(r=>r.selectedFit.rmse)),
    validationBeforeMedian:median(valid.map(r=>r.validationBefore.rmse)),validationAfterMedian:median(valid.map(r=>r.validationAfter.rmse)),
    pairedValidationImprovementMedian:median(improvement),validationImproved:improvement.filter(x=>x>1e-6).length,
    validationWorsened:improvement.filter(x=>x< -1e-6).length,
    validationCenterBeforeMedian:median(valid.map(r=>r.validationBefore.centerRmse)),validationCenterAfterMedian:median(valid.map(r=>r.validationAfter.centerRmse)),
    depthRatioMedian:median(data.map(r=>r.depthRatio)),endpointSelections:data.filter(r=>r.boundary).length};
};
const anisoSummary=field=>{
  const values=anisotropy.map(a=>a[field]).filter(Boolean),ratios=values.map(v=>v.axisRatio).sort((a,b)=>a-b);
  return {points:values.length,axisRatioMedian:median(ratios),axisRatioP90:ratios[Math.floor((ratios.length-1)*0.9)],
    axisRatioAbove3:ratios.filter(x=>x>3).length,axisRatioAbove5:ratios.filter(x=>x>5).length,
    majorSigmaPixelsMedian:median(values.map(v=>v.majorSigmaPixels)),minorSigmaPixelsMedian:median(values.map(v=>v.minorSigmaPixels))};
};
const normalPairs=rows.filter(r=>r.validationBefore&&r.validationFacingNormal);
const report={created:new Date().toISOString(),source:input,sourceSha256:createHash('sha256').update(bytes).digest('hex'),config,
  geometry:{sparsePoints:cache.recon.points.length,cameras:cameras.length,cachedSurfacePoints:cache.seed.n,trainingSizes:[...new Set(cameras.map(c=>`${c.image.tw}x${c.image.th}`))],intrinsics:'c.f and optional fy/cx/cy scaled by tw/fw; row-major world-to-camera R,t; RGB already undistorted; quaternion is cached w,x,y,z and local z is surface normal.',maximumAnchorResidualPixels:maximumAnchorResidual,maximumAnchorReconstructionError:maximumReconstructionError},
  cost:{loadMs,preparationMs,elapsedMs,selectedPoints:chosen.length,bilinearSampleCalls:sampleCalls,projectedPatchPoints,depthHypotheses:ratios.length,
    extrapolated2636PointsMs:elapsedMs/256*2636,extrapolated10000PointsMs:elapsedMs/256*10000,
    caveat:'Single Node/V8 CPU run under concurrent software rendering, not phone timing; extrapolations are arithmetic only and omit reusing geometric/reference-patch work.'},
  skipped:skips,all:summarize(rows),confident:summarize(rows.filter(r=>r.confident)),
  byReference:Object.fromEntries(originCandidates.map(c=>[c.index,summarize(rows.filter(r=>r.reference===c.index))])),
  projectedAnisotropy:{cameraDomain:'Raw projected covariance at cached320x180 training intrinsics, without raster minimum footprint/filter inflation. Cached tangent scales equal, thickness is sigmaNormal/sigmaTangent0.15.',original:anisoSummary('original'),cameraFacing:anisoSummary('cameraFacing'),
    normalFacingCosineBelow015:anisotropy.filter(a=>a.normalFacingCosine<0.15).length,normalFacingCosineBelow025:anisotropy.filter(a=>a.normalFacingCosine<0.25).length,normalFacingCosineBelow05:anisotropy.filter(a=>a.normalFacingCosine<0.5).length,rows:anisotropy},
  normalOnlyValidation:{points:normalPairs.length,beforeMedian:median(normalPairs.map(r=>r.validationBefore.rmse)),cameraFacingMedian:median(normalPairs.map(r=>r.validationFacingNormal.rmse)),pairedImprovementMedian:median(normalPairs.map(r=>r.validationBefore.rmse-r.validationFacingNormal.rmse)),improved:normalPairs.filter(r=>r.validationFacingNormal.rmse<r.validationBefore.rmse-1e-6).length,worsened:normalPairs.filter(r=>r.validationFacingNormal.rmse>r.validationBefore.rmse+1e-6).length},
  limitations:['Only one cached real capture; no retraining or rendered-quality measurement.','Third training camera is excluded from depth selection and confidence, but the original cached initializer used all views when admitting supported points.','Sparse occlusion guards can reject known foreground conflicts but do not prove visibility in unobserved regions.','Normal is fixed to the original sparse triangle; the sweep can test local depth only, not wrong normals, moving leaves, specular changes, or mismatched camera poses.','No benchmark-held-out photographs are read.'],rows};
fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,geometry:report.geometry,cost:report.cost,skipped:report.skipped,all:report.all,confident:report.confident,byReference:report.byReference,projectedAnisotropy:{...report.projectedAnisotropy,rows:undefined},normalOnlyValidation:report.normalOnlyValidation},null,2));
