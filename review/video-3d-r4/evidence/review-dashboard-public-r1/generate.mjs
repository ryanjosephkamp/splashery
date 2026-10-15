// MIT. Made by Ryan with Codex (GPT-6). Static evidence, never an acceptance substitute.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const toolRoot = '/workspace/splashery-v3d-bench-tools-r9/tools';
const { fingerprint, compareRuns, accountedOutcome } = await import(pathToFileURL(path.join(toolRoot, 'v3d-bench-metrics.mjs')));
const { verifyArtifacts, assertReferenceEvidence } = await import(pathToFileURL(path.join(toolRoot, 'v3d-bench.mjs')));
const sha = b => createHash('sha256').update(b).digest('hex');
export const safeJson = x => JSON.stringify(x).replaceAll('<', '\\u003c').replaceAll('\u2028', '\\u2028').replaceAll('\u2029', '\\u2029');
export function validateRun(run, manifest, baseline = null) {
  if (!run.provenance || fingerprint(run.provenance) !== run.provenanceSha256) throw Error('Invalid provenance');
  const inputs = new Map(manifest.map(x => [x.id, x.sha256]));
  if (inputs.size !== manifest.length || inputs.size !== 20) throw Error('Expected 20 unique manifest captures');
  if (fingerprint(run.cohort?.inputs) !== fingerprint(manifest.map(x => ({id:x.id,sha256:x.sha256}))) || fingerprint(run.cohort?.profiles) !== fingerprint(['phone','desktop'])) throw Error('Cohort differs from complete declared manifest');
  const seen = new Set();
  for (const r of run.results) {
    const key = `${r.id}-${r.profile}`;
    if (seen.has(key) || !['phone','desktop'].includes(r.profile) || inputs.get(r.id) !== r.sha256 || r.provenanceSha256 !== run.provenanceSha256) throw Error('Invalid, duplicate, or changed row: '+key);
    seen.add(key);
  }
  if (baseline && !compareRuns(baseline, run).provenanceCompatible) throw Error('Incompatible paired reference provenance');
}
export function allCases(manifest, runs) {
  return manifest.flatMap(m => ['phone','desktop'].map(profile => ({id:m.id, profile, versions:runs.map(r => ({name:r.name, row:r.run?.results.find(x=>x.id===m.id&&x.profile===profile)||null}))})));
}
export function validateCaseFiles(folder,row) {
  verifyArtifacts(folder,row);
  const f=path.join(folder,`${row.id}-${row.profile}`), result=path.join(f,'result.json');
  if (!fs.existsSync(result) || fingerprint(JSON.parse(fs.readFileSync(result)))!==fingerprint(row)) throw Error('Result bytes disagree with listed row '+result);
  const inventory=fs.readdirSync(f,{withFileTypes:true}).filter(x=>x.isFile()).map(x=>{
    const file=path.join(f,x.name), b=fs.readFileSync(file);
    return {file:x.name,sha256:sha(b),bytes:b.length};
  });
  verifyArtifacts(folder,row);
  if (inventory.some(x=>sha(fs.readFileSync(path.join(f,x.file)))!==x.sha256)) throw Error('Case artifact changed while reading');
  return {folder:f,result,inventory};
}
export async function generate({main, candidates=[], attempts=[], manifest, corpus, out, ci=[]}) {
  if (fs.existsSync(out)) throw Error('Output must be fresh');
  fs.mkdirSync(path.join(out,'inputs'),{recursive:true});
  const receipts=[];
  const capture = file => {
    const resolved=fs.realpathSync(file), bytes=fs.readFileSync(resolved), hash=sha(bytes);
    const name=hash+'-'+path.basename(resolved);
    fs.writeFileSync(path.join(out,'inputs',name),bytes);
    receipts.push({path:file,resolved,sha256:hash,bytes:bytes.length,capturedAt:new Date().toISOString(),copy:'inputs/'+name});
    return {bytes, receipt:receipts.at(-1)};
  };
  const credits=JSON.parse(capture(manifest).bytes);
  const link = p => fs.existsSync(p) ? encodeURI(path.relative(out, fs.realpathSync(p))).replaceAll('#','%23').replaceAll('?','%3F') : null;
  const checkFiles = (folder,row) => {
    const {folder:f,result,inventory}=validateCaseFiles(folder,row);
    return {inventory,links:{result:link(result),model:link(path.join(f,'model.ply')),metadata:link(path.join(f,'model.json')),outcome:link(path.join(f,'outcome.png')),render:link(path.join(f,'render-0.png')),reference:link(path.join(f,'reference-0.png'))}};
  };
  const load=(name,p,baseline=null)=>{
    const resolved=fs.realpathSync(p), cap=capture(path.join(resolved,'run.json')), run=JSON.parse(cap.bytes);
    validateRun(run,credits,baseline);
    const cases={};
    for(const row of run.results) {
      if(baseline) assertReferenceEvidence(mainResolved,baseline,row,baseline.provenanceSha256);
      cases[`${row.id}-${row.profile}`]=checkFiles(resolved,row);
    }
    const now=JSON.parse(fs.readFileSync(path.join(resolved,'run.json')));
    if(fingerprint(now.provenance)!==fingerprint(run.provenance) || run.results.some(r=>fingerprint(now.results.find(x=>x.id===r.id&&x.profile===r.profile))!==fingerprint(r))) throw Error('Captured rows changed while reading');
    return {name,path:p,resolved,run,receipt:cap.receipt,cases};
  };
  const mainResolved=fs.realpathSync(main), before=load('main',main), versions=[];
  for(const {name,path:p} of candidates) {
    if(fs.existsSync(p)) {const v=load(name,p,before.run);v.comparison=compareRuns(before.run,v.run);versions.push(v);}
    else versions.push({name,path:p,run:null,comparison:null,note:'No strict paired snapshot exists at capture time'});
  }
  const raw=[];
  for(const {name,path:p} of attempts) {
    if(!fs.existsSync(p)) continue;
    for(const entry of fs.readdirSync(p,{withFileTypes:true}).filter(x=>x.isDirectory()).sort((a,b)=>a.name.localeCompare(b.name))) {
      const dir=path.join(p,entry.name), file=path.join(dir,'run.json');
      if(!fs.existsSync(file)) continue;
      const item=load(name,dir); // Unpaired provenance stays separate; never added to comparison.
      if(item.run.results.length) raw.push(item);
    }
  }
  const ciReports=ci.map(file=>{const c=capture(file);return {text:c.bytes.toString(),...c.receipt,modifiedAt:fs.statSync(c.receipt.resolved).mtime.toISOString()};});
  const data={generatedAt:new Date().toISOString(),notice:'UNPROVEN: incomplete corpus evidence. No acceptance or recovered timing claim.',timingLimit:'4-core CPU quota; SwiftShader software GPU; overlapping host jobs. These are nonphysical phone/desktop viewport profiles, not measurements on a physical phone or desktop GPU.',manifest:credits.map(m=>({...m,video:link(path.join(corpus,m.file))})),baseline:before,versions,rawAttempts:raw,ci:ciReports,cases:allCases(credits,[before,...versions]),receipts};
  for(const file of ['v3d-bench.mjs','v3d-bench-metrics.mjs','v3d-bench-pixels.mjs','v3d-bench-samples.mjs','cdx-v3d-clarity-metrics.mjs'])capture(path.join(toolRoot,file));
  const template=fs.readFileSync(new URL('./template.html',import.meta.url),'utf8');
  fs.writeFileSync(path.join(out,'data.json'),JSON.stringify(data,null,2)+'\n');
  fs.writeFileSync(path.join(out,'index.html'),template.replace('/*DATA*/',safeJson(data)));
  fs.writeFileSync(path.join(out,'input-receipts.json'),JSON.stringify(receipts,null,2)+'\n');
  return {out,generatedAt:data.generatedAt,baselineRows:before.run.results.length,versions:versions.map(v=>({name:v.name,rows:v.run?.results.length||0,complete:v.comparison?.complete||false})),rawAttemptRows:raw.reduce((n,a)=>n+a.run.results.length,0),cases:data.cases.length};
}
if (process.argv[1] && path.resolve(process.argv[1])===import.meta.filename) {
  const values={candidates:[],attempts:[],ci:[]};
  for(const a of process.argv.slice(2)) {
    const i=a.indexOf('='), k=a.slice(2,i), v=a.slice(i+1);
    if(i<0)throw Error('Use --key=value');
    if(k==='candidate'||k==='attempts') {const j=v.indexOf(':');if(j<1)throw Error('Use NAME:/absolute/path');values[k==='candidate'?'candidates':'attempts'].push({name:v.slice(0,j),path:v.slice(j+1)});}
    else if(k==='ci')values.ci.push(v);else values[k]=v;
  }
  console.log(JSON.stringify(await generate(values),null,2));
}
