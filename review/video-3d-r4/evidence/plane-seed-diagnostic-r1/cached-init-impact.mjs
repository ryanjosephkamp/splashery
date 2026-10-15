// MIT. Made by Ryan with Codex (GPT-6). CPU-only radius/scale sensitivity; no training.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { initGaussians } from '/workspace/splashery-r4-public/vendor/splatjs/src/gs/init.js';
const root=new URL('./',import.meta.url), sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const raw=await fs.readFile('/workspace/v3d-r4-media/seed-probe.json');
if(sha(raw)!=='a58563911299803f7b9203214ac7a67a19817d6709dc4d1797d30bfa562d910f')throw Error('Cache changed');
const {recon}=JSON.parse(raw), points=recon.points;
const q=(v,p)=>{const s=v.toSorted((a,b)=>a-b);const x=(s.length-1)*p,i=Math.floor(x),f=x-i;return s[i]*(1-f)+s[Math.min(i+1,s.length-1)]*f;};
const quantiles=v=>Object.fromEntries([0,.1,.5,.9,.95,.99,1].map(p=>[p,q(v,p)]));
const result=[];
for(const robustBounds of [false,true]){
 const started=performance.now(),m=initGaussians(points,0,undefined,{robustBounds});const milliseconds=performance.now()-started;
 const sigma=Array.from({length:m.n},(_,i)=>Math.exp(m.data[i*16+3]));
 const originalRetained=points.every((p,i)=>p.X.every((x,k)=>Math.fround(x)===m.data[i*16+k]));
 const rows=Buffer.from(m.data.buffer,m.data.byteOffset,m.data.byteLength);
 await fs.writeFile(new URL(`cached-init-${robustBounds?'robust':'legacy'}.f32le`,root),rows);
 result.push({robustBounds,center:m.center,radius:m.radius,n:m.n,allOriginalPositionsRetained:originalRetained,cpuMilliseconds:milliseconds,dataSha256:sha(rows),sigmaQuantilesAll:quantiles(sigma),sigmaQuantilesExcludingFarPoint264:quantiles(sigma.filter((_,i)=>i!==264)),minimumScaleLaw:m.radius*3e-4,maximumScaleLaw:m.radius*.05,hashGridCell:m.radius/24,positionLrV1BeforeAdditionalScale:m.radius*3e-4,positionLrV2BeforeAdditionalScale:m.radius*2e-5,sigma});
}
const a=result[0],b=result[1],ratio=a.sigma.map((v,i)=>b.sigma[i]/v);
const report={created:new Date().toISOString(),cacheSha256:sha(raw),codeSha256:sha(await fs.readFile(new URL(import.meta.url))),initializerSource:'/workspace/splashery-r4-public/vendor/splatjs/src/gs/init.js',initializerSourceSha256:sha(await fs.readFile('/workspace/splashery-r4-public/vendor/splatjs/src/gs/init.js')),results:result.map(({sigma,...r})=>r),robustToLegacyRadiusRatio:b.radius/a.radius,sigmaRatioQuantiles:quantiles(ratio),normalPointCounts:{sameWithin1e6:ratio.filter((x,i)=>i!==264&&Math.abs(x-1)<1e-6).length,decreasedOver1Percent:ratio.filter((x,i)=>i!==264&&x<.99).length,increasedOver1Percent:ratio.filter((x,i)=>i!==264&&x>1.01).length},rawSigmaByPoint:result.map(r=>({robustBounds:r.robustBounds,sigma:r.sigma})),risks:['Read-only initializer sensitivity only; no renderer, optimizer, performance, or quality comparison.','Coordinate-median bounds retain far points and can represent multimodal or elongated scenes differently from mean bounds.','Same P90 order statistic and scale laws: changed radius affects spatial hash neighborhoods, scale clamps/fallback, and position learning rate.','Position learning-rate figures are algebraic setup values, not measured convergence; camera translation learning rates and scale floors also use scene radius.','No runtime flag enabled by this helper.'],noHeldoutImages:true,noGpu:true};
await fs.writeFile(new URL('cached-init-impact.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,rawSigmaByPoint:undefined},null,2));
