// MIT. Made by Ryan with Codex (GPT-6). Exact CPU-only seed path; stop before GPU ownership.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { Session } from '/workspace/splashery-r4-public/vendor/splatjs/src/session.js';
const root=new URL('./',import.meta.url),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const raw=await fs.readFile('/workspace/v3d-r4-media/seed-probe.json');
if(sha(raw)!=='a58563911299803f7b9203214ac7a67a19817d6709dc4d1797d30bfa562d910f')throw Error('Cache changed');
const context=JSON.parse(await fs.readFile(new URL('baseline-context.json',root))), full=context.results.find(r=>r.name==='full-context-all-16');
const surfaceBytes=await fs.readFile(new URL(full.rowFile,root));if(sha(surfaceBytes)!==full.rowSha256)throw Error('Surface changed');
const append=Float32Array.from(new Float32Array(surfaceBytes.buffer,surfaceBytes.byteOffset,surfaceBytes.byteLength/4));
const {recon}=JSON.parse(raw),results=[];
const quantiles=(values)=>{const s=values.toSorted((a,b)=>a-b);return Object.fromEntries([0,.1,.5,.9,.95,.99,1].map(p=>{const x=p*(s.length-1),i=Math.floor(x),f=x-i;return[p,s[i]*(1-f)+s[Math.min(i+1,s.length-1)]*f];}));};
for(const robustSeedBounds of [false,true]){
 const s=new Session({maskTraining:false,robustSeedBounds,initTarget:15000-full.n,trainer:{maxSplats:45000,shDeg:0}});
 s.recon=recon;const stop=new Error('Stopped at CPU/GPU boundary');let boundaryCalls=0;s._getGpu=async()=>{boundaryCalls++;throw stop;};
 try{
  try{await s.seed({initTarget:15000-full.n,seedLimit:15000,appendGaussians:{n:full.n,data:append}});throw Error('GPU boundary was not reached');}catch(e){if(e!==stop)throw e;}
  const m=s.model,base=m.n-full.n;if(m.n!==15000||boundaryCalls!==1||m.appendedSeedCount!==full.n)throw Error('Unexpected seed shape');
  const preserved=Buffer.from(m.data.buffer,m.data.byteOffset+base*16*4,full.n*16*4);if(!preserved.equals(surfaceBytes))throw Error('Surface rows changed');
  if(!recon.points.every((p,i)=>p.X.every((x,k)=>Math.fround(x)===m.data[i*16+k])))throw Error('Sparse original lost');
  const bytes=Buffer.from(m.data.buffer,m.data.byteOffset,m.data.byteLength);await fs.writeFile(new URL(`cached-session-${robustSeedBounds?'robust':'legacy'}.f32le`,root),bytes);
  results.push({robustSeedBounds,n:m.n,baseRows:base,appendedRows:full.n,center:m.center,radius:m.radius,positionsOfAll614SparseOriginalsRetained:true,appendedRowsByteIdentical:true,dataSha256:sha(bytes),baseSigmaQuantiles:quantiles(Array.from({length:base},(_,i)=>Math.exp(m.data[i*16+3]))),fullSigmaQuantiles:quantiles(Array.from({length:m.n},(_,i)=>Math.exp(m.data[i*16+3])))});
 }finally{s.dispose();}
}
const report={created:new Date().toISOString(),cacheSha256:sha(raw),surfaceSha256:full.rowSha256,sessionSourceSha256:sha(await fs.readFile('/workspace/splashery-r4-public/vendor/splatjs/src/session.js')),initSourceSha256:sha(await fs.readFile('/workspace/splashery-r4-public/vendor/splatjs/src/gs/init.js')),codeSha256:sha(await fs.readFile(new URL(import.meta.url))),results,noGpu:true,noHeldoutImages:true,limitations:['Actual unchanged Session.seed capacity/append/init code executes on CPU, with GPU creation replaced by a throwing boundary.','No decoding, solve, training, rendering, timing acceptance, or quality claim.','surfaceSeed RGB admission already saw all16 training cameras; no heldout images are accessed.']};
await fs.writeFile(new URL('cached-session-impact.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
