// MIT. Read-only integrity adapter for the outside-worktree R9 continuation.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const request = JSON.parse(fs.readFileSync(0, 'utf8'));
const toolsRoot=path.resolve(request.toolsRoot);
const {fingerprint,benchmarkCohort,accountedOutcome,rowKey}=await import(path.join(toolsRoot,'tools/v3d-bench-metrics.mjs'));
const {verifyArtifacts,assertReferenceEvidence,referenceEvidence}=await import(path.join(toolsRoot,'tools/v3d-bench.mjs'));

const manifestBytes = fs.readFileSync(request.manifest), clips = JSON.parse(manifestBytes), cohort = benchmarkCohort(clips);
const inputs = new Map(clips.map(clip => [clip.id, clip]));
function inventory(directory) {
  const rows = [];
  const walk = (at, prefix = '') => {
    for (const item of fs.readdirSync(at, {withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))) {
      const relative = prefix ? prefix+'/'+item.name : item.name, file = path.join(at,item.name);
      if (item.isDirectory()) { rows.push({file:relative,type:'directory'}); walk(file,relative); }
      else if (item.isFile()) { const bytes=fs.readFileSync(file); rows.push({file:relative,type:'file',bytes:bytes.length,sha256:hash(bytes)}); }
      else throw new Error('Special file or link in evidence: '+file);
    }
  };
  walk(directory);
  return rows;
}
function inspect(spec, baseline = null) {
  const directory = fs.realpathSync(spec.directory);
  if(spec.kind!=='baseline'&&request.allowedSourceRoot&&path.dirname(directory)!==fs.realpathSync(request.allowedSourceRoot))throw new Error('Candidate source escaped the declared R9 root');
  const bytes = fs.readFileSync(path.join(directory,'run.json')), run = JSON.parse(bytes);
  if (run.provenanceSha256 !== spec.expected || fingerprint(run.provenance) !== spec.expected || run.manifestSha256 !== hash(manifestBytes) || run.provenance.manifestSha256 !== hash(manifestBytes) || fingerprint(run.cohort) !== fingerprint(cohort) || run.url !== run.provenance.url || !Array.isArray(run.results)) throw new Error('Run provenance/cohort/manifest mismatch: '+directory);
  if (fingerprint(run.provenance.inputs) !== fingerprint(clips.map(({id,sha256,duration,file})=>({id,sha256,duration,file})))) throw new Error('Input inventory mismatch');
  if (fingerprint(run.provenance.servedSource.files) !== run.provenance.servedSource.sha256) throw new Error('Source inventory mismatch');
  if (spec.kind === 'paired') {
    if (run.reference?.path !== request.reference || run.reference?.provenanceSha256 !== baseline.run.provenanceSha256 || fingerprint(run.reference) !== fingerprint(run.provenance.reference)) throw new Error('Reference identity mismatch: '+directory);
  } else if (run.reference !== null || run.provenance.reference !== null) throw new Error('Unexpected paired provenance: '+directory);
  const seen = new Set(), rows = [];
  for (const row of run.results) {
    const key=rowKey(row), clip=inputs.get(row.id);
    if (seen.has(key) || !clip || !cohort.profiles.includes(row.profile) || row.sha256 !== clip.sha256 || row.provenanceSha256 !== run.provenanceSha256) throw new Error('Invalid/duplicate row: '+key);
    seen.add(key);
    const folder=path.join(directory,`${row.id}-${row.profile}`), result=JSON.parse(fs.readFileSync(path.join(folder,'result.json')));
    if (fingerprint(result)!==fingerprint(row)) throw new Error('Result/run row mismatch: '+key);
    verifyArtifacts(directory,row);
    const check=(file,expected)=>{if(expected!==undefined && (!/^[a-f0-9]{64}$/.test(expected)||hash(fs.readFileSync(path.join(folder,file)))!==expected))throw new Error('Changed recorded artifact: '+key+'/'+file);};
    check('model.ply',row.modelSha256); check('evaluation.json',row.evaluationSha256);
    for(const [index,frame] of (row.frames||[]).entries())for(const kind of ['render','reference'])check(`${kind}-${index}.png`,frame[`${kind}Sha256`]);
    if (spec.kind==='paired') assertReferenceEvidence(baseline.directory,baseline.run,row,baseline.run.provenanceSha256);
    rows.push({id:row.id,profile:row.profile,status:row.status,accounted:accountedOutcome(row),rowFingerprint:fingerprint(row),caseInventorySha256:fingerprint(inventory(folder)),...(spec.kind==='baseline'&&accountedOutcome(row)?{evidence:referenceEvidence(directory,run,row.id,row.profile,run.provenanceSha256)}:{})});
  }
  const attempts=[];
  for(const item of fs.readdirSync(directory,{withFileTypes:true}))if(item.isDirectory())for(const clip of clips)for(const profile of cohort.profiles)if(item.name===`${clip.id}-${profile}`)attempts.push({id:clip.id,profile});
  return {directory,run,summary:{directory,provenanceSha256:run.provenanceSha256,runSha256:hash(bytes),rows,attempts}};
}
const baseline=inspect({directory:request.reference,expected:request.baselineExpected,kind:'baseline'});
const runs=request.sources.map(spec=>inspect(spec,baseline).summary);
process.stdout.write(JSON.stringify({baseline:baseline.summary,runs})+'\n');
