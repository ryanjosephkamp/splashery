import fs from 'node:fs/promises';
import {distribution} from '../../tools/pages/phone-speed-metrics.js';
const root='.cache/phone-speed';
const read=async p=>fs.readFile(`${root}/${p}`,'utf8').then(JSON.parse).catch(e=>{if(e.code==='ENOENT'||e instanceof SyntaxError)return null;throw e;});
const targets=await read('targets.json'),steps=await read('pipeline-steps.json');
const result={at:new Date().toISOString(),stage:Object.entries(steps||{}).find(([,v])=>!v.ok)?.[0]||'none',targets:[],catalog:{},regressions:{}};
for(const {id}of targets||[]){
 const phases={};for(const phase of ['before','after'])phases[phase]=(await Promise.all(Array.from({length:5},(_,i)=>read(`paired/${id}/${i}-${phase}/${id}-0.json`)))).filter(Boolean);
 const complete=phases.before.length===5&&phases.after.length===5,failed=Object.values(phases).flat().some(r=>r.error||r.errors?.length);
 const b=distribution(phases.before.map(r=>r.idle?.median)).median,a=distribution(phases.after.map(r=>r.idle?.median)).median;
 result.targets.push({id,before:phases.before.length,after:phases.after.length,complete,failed,gain:complete&&!failed?1-a/b:null});
}
result.completedTargets=result.targets.filter(r=>r.complete&&!r.failed).length;
for(const phase of ['before','after']){const rows=await read(`paired/${phase}.json`);result.catalog[phase]=rows?{rows:rows.length,ids:new Set(rows.map(r=>r.id)).size,errors:rows.filter(r=>r.error||r.errors?.length).length}:null;const r=await read(`paired-regressions/${phase}.json`);result.regressions[phase]=r?{rows:r.length,ids:new Set(r.map(x=>x.id)).size}:null;}
const paused=await read('paired/paused.json');if(paused)result.catalog.paused=paused;
const g=await read('final-gates.json');if(g)result.gates=g.gates;
const done=result.targets.filter(r=>r.gain!==null);const gains=distribution(done.map(r=>r.gain));const compact={at:result.at,stage:result.stage,completedTargets:result.completedTargets,targetMinimum:done.length?Math.min(...done.map(r=>r.gain)):null,targetMedian:gains.median,activeTargets:result.targets.filter(r=>!r.complete&&(r.before||r.after)),failedTargets:result.targets.filter(r=>r.failed||r.gain!==null&&r.gain<.25),catalog:result.catalog,regressions:result.regressions,gates:result.gates};console.log(JSON.stringify(process.argv.includes('--full')?result:compact));
