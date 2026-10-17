import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {compareRuns,summarize} from '../../tools/phone-speed-compare.mjs';
import {distribution} from '../../tools/pages/phone-speed-metrics.js';
import {TOYS} from '../../src/toys.js';
const root='.cache/phone-speed',read=async file=>JSON.parse(await fs.readFile(`${root}/${file}`,'utf8'));
const optional=async file=>read(file).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
const sha=b=>createHash('sha256').update(b).digest('hex');
const targets=await read('targets.json'),frozen=await read('freeze-readback.json'),repetitions=await read('repetitions.json');
assert.equal(sha(await fs.readFile(`${root}/targets.json`)),frozen.targetsSHA256);
assert.equal(sha(await fs.readFile(`${root}/before-readback/summary.json`)),frozen.baselineSHA256);
const protocol=await read('paired/protocol.json'), selected=new Set(targets.map(t=>t.id));
const groups=rows=>{const m=new Map();for(const r of rows){if(!m.has(r.id))m.set(r.id,[]);m.get(r.id).push(r);}return m;};
const combined={};
for(const phase of ['before','after']){
 const result=groups(await read(`paired/${phase}.json`));
 for(const [label,file] of [['targets',`targets-${phase}.json`],['five',`regression-5-${phase}.json`],['ten',`regression-10-${phase}.json`]]){
  const rows=label==='targets'?await read(file):await optional(file);
  for(const [id,set]of groups(rows)){
   assert.equal(selected.has(id),label==='targets',`Unexpected ${label} overlay: ${id}`);
   result.set(id,set);
  }
 }
 combined[phase]=[...result.values()].flat();
 for(const r of combined[phase]){assert.equal(r.source,protocol.sources[phase]);assert.equal(r.phase,phase);if(!r.error&&!r.errors?.length)assert.ok(r.heapBytes>0&&r.transferBytes>0&&r.bodyBytes>0&&r.heap?.usedSize>0,`Missing measured heap/bytes: ${phase}/${r.id}`);}
 await fs.writeFile(`${root}/final-${phase}.json`,JSON.stringify(combined[phase],null,2));
}
const visualBefore=await read('visual-before/scores.json'),visualAfter=await read('visual-after/scores.json');
assert.equal(visualBefore.source,protocol.sources.before);assert.equal(visualAfter.source,protocol.sources.after);
assert.deepEqual(visualBefore.protocol,visualAfter.protocol);
const changes=await read('render-changes.json');
const report=compareRuns(combined.before,combined.after,targets,visualAfter.rows,TOYS.map(t=>t.id),repetitions,changes);
report.sources=protocol.sources;report.freeze=frozen.frozenAt;report.generatedAt=new Date().toISOString();
await fs.writeFile(`${root}/final-gates.json`,JSON.stringify(report,null,2));
const flags=report.regressions.map(r=>({id:r.id}));
await fs.writeFile(`${root}/flagged-others.json`,JSON.stringify(flags,null,2));
const b=new Map(summarize(combined.before).map(r=>[r.id,r])),a=new Map(summarize(combined.after).map(r=>[r.id,r]));
const rawBefore=groups(combined.before),rawAfter=groups(combined.after),csv=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const median=(map,id,key)=>distribution((map.get(id)||[]).map(r=>r[key])).median;
const percent=n=>Number.isFinite(n)?n*100:null;
const headers=['id','label','kind','pack','repetitions','splatsBefore','splatsAfter','canvasBefore','canvasAfter','firstViewBeforeMs','firstViewAfterMs','firstViewGainPct','idleBeforeMs','idleAfterMs','idleGainPct','idleP95BeforeMs','idleP95AfterMs','tapBeforeMs','tapAfterMs','tapP95BeforeMs','tapP95AfterMs','heapBeforeMiB','heapAfterMiB','transferBeforeMiB','transferAfterMiB','bodyBeforeMiB','bodyAfterMiB','requestsBefore','requestsAfter','selected','valid'];
const data=[headers];
for(const toy of TOYS){
 const old=b.get(toy.id),next=a.get(toy.id),r=report.rows.find(r=>r.id===toy.id),rb=rawBefore.get(toy.id)?.[0],ra=rawAfter.get(toy.id)?.[0];
 const m=(obj,key)=>obj?.[key]??null,mem=(map,key)=>{const n=median(map,toy.id,key);return n===null?null:n/1048576;};
 data.push([toy.id,toy.label,toy.kind,toy.pack||'',repetitions[toy.id],rb?.splats,ra?.splats,rb?.canvas?.join('x'),ra?.canvas?.join('x'),m(old,'firstViewMs'),m(next,'firstViewMs'),percent(r?.changes.firstViewMs),m(old,'idle.median'),m(next,'idle.median'),percent(r?.changes['idle.median']),m(old,'idle.p95'),m(next,'idle.p95'),m(old,'tap.median'),m(next,'tap.median'),m(old,'tap.p95'),m(next,'tap.p95'),mem(rawBefore,'heapBytes'),mem(rawAfter,'heapBytes'),mem(rawBefore,'transferBytes'),mem(rawAfter,'transferBytes'),mem(rawBefore,'bodyBytes'),mem(rawAfter,'bodyBytes'),median(rawBefore,toy.id,'requests'),median(rawAfter,toy.id,'requests'),selected.has(toy.id),r?.valid]);
}
await fs.writeFile(`${root}/full-catalog.csv`,data.map(row=>row.map(csv).join(',')).join('\n')+'\n');
console.log(JSON.stringify({gates:report.gates,targets:report.optimized.map(r=>({id:r.id,gain:r.gain,appearance:r.appearance})),medianGain:report.medianGain,flagged:flags.length,coverage:report.rows.length},null,2));
