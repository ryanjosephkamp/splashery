// MIT. Made by Ryan with Codex (GPT-6). CPU-only unchanged surfaceSeed coverage context.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { surfaceSeed } from '../runtime-r8/src/video3d/surface-seed.js';
const root = new URL('./', import.meta.url);
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const raw = await fs.readFile('/workspace/v3d-r4-media/seed-probe.json');
if (sha(raw) !== 'a58563911299803f7b9203214ac7a67a19817d6709dc4d1797d30bfa562d910f') throw Error('Cache changed');
const configBytes = await fs.readFile(new URL('preregistered-config.json', root));
const config = JSON.parse(configBytes);
const sourceBytes = await fs.readFile(config.baseline.source);
if (sha(sourceBytes) !== config.baseline.sha256) throw Error('Frozen surfaceSeed changed');
const {recon,frames} = JSON.parse(raw);
const budget = n => {
  const baseTarget = 15000 - n, np = recon.points.length;
  const desiredClones = Math.min(np < 5000 ? 200 : 24, Math.max(2, Math.round(baseTarget / np) - 1));
  const baseCount = Math.min(baseTarget, np * (Math.min(desiredClones, Math.max(0, Math.ceil(baseTarget / np) - 1)) + 1));
  return { totalCeiling:15000, appendedRows:n, baseTarget, sparsePointCount:np, desiredClones, retainedBaseRows:baseCount, totalRows:baseCount+n };
};
const results=[];
for (const [name,cams] of [['full-context-all-16',recon.cams],['restricted-independent-validation-15',recon.cams.filter(c => [0,5,10].includes(c.imgIdx))]]) {
  const start = performance.now();
  const result = surfaceSeed({...recon,cams},frames,{maxPoints:13800});
  const elapsed = performance.now()-start;
  if (result.data.length !== result.n*16 || !result.data.every(Number.isFinite)) throw Error('Invalid seed rows');
  const binary = Buffer.from(result.data.buffer,result.data.byteOffset,result.data.byteLength);
  const file = `${name}.f32le`;
  await fs.writeFile(new URL(file,root),binary);
  const coverage = [0,5,10,15].map(imgIdx => {
    const c = recon.cams.find(c => c.imgIdx===imgIdx), im=frames[imgIdx], s=im.tw/im.fw;
    const f=c.f*s, fy=(c.fy??c.f)*s, cx=c.cx==null?im.tw/2:c.cx*s, cy=c.cy==null?im.th/2:c.cy*s;
    const bins=new Set(); let projectedRows=0;
    for(let i=0;i<result.n;i++) {
      const p=Array.from(result.data.subarray(i*16,i*16+3));
      const v=[0,1,2].map(k=>c.R.slice(k*3,k*3+3).reduce((a,w,j)=>a+w*p[j],c.t[k]));
      const u=f*v[0]/v[2]+cx, y=fy*v[1]/v[2]+cy;
      if (!(v[2]>1e-6&&u>=.5&&y>=.5&&u<im.tw-.5&&y<im.th-.5)) continue;
      projectedRows++; bins.add(`${Math.floor(u/4)},${Math.floor(y/4)}`);
    }
    return {imgIdx,projectedRows,occupied4pxBins:bins.size,total4pxBins:Math.ceil(im.tw/4)*Math.ceil(im.th/4),projected4pxBinCoverage:bins.size/(Math.ceil(im.tw/4)*Math.ceil(im.th/4))};
  });
  results.push({name,cameraIndices:cams.map(c=>c.imgIdx),rowFile:file,rowSha256:sha(binary),n:result.n,candidates:result.candidates,supported:result.supported,cpuMilliseconds:elapsed,budget:budget(result.n),coverage,qualityScores:null,qualityScoresReason:'No accepted plane comparator exists. Projection coverage is context only and does not certify visibility or occupied surface.'});
}
const planeFit=JSON.parse(await fs.readFile(new URL('plane-fit-report.json',root)));
if (planeFit.acceptedPlanes.length) throw Error('This context-only branch expects failed plane gate');
const report={created:new Date().toISOString(),cacheSha256:sha(raw),configSha256:sha(configBytes),codeSha256:sha(await fs.readFile(new URL(import.meta.url))),baselineSourceSha256:sha(sourceBytes),node:process.version,results,planeProposals:{acceptedPlanes:0,rows:0,threeViewPatchScores:null,reason:'Stopped before reading diagnostic RGB because geometric support gate failed; no unsupported plane rows exported.',budgetIfNoReplacement:budget(0)},noHeldoutImages:true,noGpu:true};
await fs.writeFile(new URL('baseline-context.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
