// MIT. Made by Ryan with Codex (GPT-6). CPU-only review evidence planner.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const hash = b => createHash('sha256').update(b).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p));
export function selectFirstPairs(inventory) {
  if(!Array.isArray(inventory)||inventory.some(r=>typeof r.id!=='string')||new Set(inventory.map(r=>r.id)).size!==inventory.length)throw Error('Distinct manifest-order inventory required.');
  return inventory.filter(r=>r.paired===true).slice(0,10).map(r=>r.id);
}
function inventory(directory) {
  const files=[];
  const walk=(at,prefix='')=>{
    for(const item of fs.readdirSync(at,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
      const relative=prefix?prefix+'/'+item.name:item.name,file=path.join(at,item.name);
      if(item.isDirectory()) walk(file,relative);
      else if(item.isFile()){const bytes=fs.readFileSync(file);files.push({file:relative,bytes:bytes.length,sha256:hash(bytes)});}
      else throw Error('Special file/link in review evidence: '+file);
    }
  };walk(directory);return files;
}
export async function buildPlan(request) {
  if(!fs.existsSync(request.main)||!fs.existsSync(request.candidate)) return {
    status:'waiting-for-actual-master',selected:[],ranked:false,
    missing:[request.main,request.candidate].filter(p=>!fs.existsSync(p)),
    notice:'No benchmark rows or renderable successes inferred from an absent master.'};
  const tools=path.resolve(request.toolsRoot);
  const {reviewSelection}=await import(pathToFileURL(path.join(tools,'tools/v3d-review.mjs')));
  const {fingerprint}=await import(pathToFileURL(path.join(tools,'tools/v3d-bench-metrics.mjs')));
  const {verifyArtifacts,assertReferenceEvidence}=await import(pathToFileURL(path.join(tools,'tools/v3d-bench.mjs')));
  const manifestBytes=fs.readFileSync(request.manifest),clips=JSON.parse(manifestBytes);
  if(!Array.isArray(clips)||clips.length!==20)throw Error('All20 source entries required.');
  const main=fs.realpathSync(request.main),candidate=fs.realpathSync(request.candidate);
  const bytes=[main,candidate].map(d=>fs.readFileSync(path.join(d,'run.json'))),runs=bytes.map(b=>JSON.parse(b));
  for(const [index,run] of runs.entries()){
    if(run.manifestSha256!==hash(manifestBytes)||run.provenance?.manifestSha256!==hash(manifestBytes))throw Error('Manifest binding mismatch.');
    if(run.url!==(index?request.candidateUrl:request.mainUrl)||run.provenance.url!==run.url)throw Error('Wrong version URL.');
    if(fingerprint(run.provenance.inputs)!==fingerprint(clips.map(({id,sha256,duration,file})=>({id,sha256,duration,file}))))throw Error('Input inventory mismatch.');
    if(fingerprint(run.provenance.servedSource.files)!==run.provenance.servedSource.sha256)throw Error('Source inventory mismatch.');
  }
  if(runs[0].provenanceSha256!==request.mainProvenance)throw Error('Wrong main provenance.');
  if(request.candidateProvenance&&runs[1].provenanceSha256!==request.candidateProvenance)throw Error('Wrong candidate provenance.');
  if(request.candidateServedSource&&runs[1].provenance.servedSource.sha256!==request.candidateServedSource)throw Error('Wrong candidate source.');
  const available=reviewSelection(clips,runs[0],runs[1],{profile:'phone'});
  const paired=available.inventory.filter(r=>r.paired).map(r=>r.id); // inventory is manifest order, never score order
  const bindings={};
  for(const id of paired){
    bindings[id]=[];
    for(const [index,directory] of [main,candidate].entries()){
      const row=runs[index].results.find(r=>r.id===id&&r.profile==='phone');
      const folder=path.join(directory,id+'-phone');
      if(fingerprint(read(path.join(folder,'result.json')))!==fingerprint(row))throw Error('Result differs from recorded row: '+id);
      verifyArtifacts(directory,row);
      if(index)assertReferenceEvidence(main,runs[0],row,runs[0].provenanceSha256);
      if(fingerprint(read(path.join(folder,'model.json')).stats)!==fingerprint(row.stats))throw Error('Model metadata stats mismatch: '+id);
      const files=inventory(folder);
      bindings[id].push({version:index?'candidate':'main',rowFingerprint:fingerprint(row),caseInventorySha256:fingerprint(files),files});
    }
  }
  const selected=selectFirstPairs(available.inventory);
  if(selected.length)reviewSelection(clips,runs[0],runs[1],{profile:'phone',ids:selected});
  for(const [index,directory] of [main,candidate].entries())if(!fs.readFileSync(path.join(directory,'run.json')).equals(bytes[index]))throw Error('Captured run changed during planning.');
  return {status:selected.length?'verified-unranked-pairs-available':'waiting-for-verified-pairs',selected,ranked:false,
    notice:'First available verified phone pairs in manifest order; unranked diagnostics. Missing/failing outcomes remain visible. These are replay movies, not native timing or acceptance evidence.',
    inventory:available.inventory,pairedSuccesses:paired.length,limitations:available.limitations,
    manifestSha256:hash(manifestBytes),logicalInputs:{main:request.main,candidate:request.candidate},
    snapshots:[main,candidate],runSha256:bytes.map(hash),provenanceSha256:runs.map(r=>r.provenanceSha256),
    observedRows:runs.map(r=>Object.fromEntries(r.results.map(row=>[row.id+'/'+row.profile,fingerprint(row)]))),bindings};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const request=JSON.parse(fs.readFileSync(0,'utf8'));
  process.stdout.write(JSON.stringify(await buildPlan(request))+'\n');
}
