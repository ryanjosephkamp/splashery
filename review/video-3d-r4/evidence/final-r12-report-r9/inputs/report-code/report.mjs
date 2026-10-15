// MIT. Made by Ryan with Codex (GPT-6). CPU-only evidence reporting, never a benchmark substitute.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {captureSamples} from './samples.mjs';
import {archiveRaw,verifyArchived} from './storage.mjs';
import {dashboard} from './dashboard.mjs';

export const ROOT='/workspace/v3d-r4-media';
export const TOOLS='/workspace/splashery-v3d-bench-tools-r12/tools';
export const EXPECTED={main:'7c714d23fd839129b6abbf718460cd7bf5bad59c34988292a26e4c5046aa05e6',paired:'b9cf187314d545233fda59b861bb8dfb7eeacdb722a7064a38e4442281984524',unpaired:'67c313c67a131763572e3bcb4a07beec85a683063e3f9766ef1fec8d7de12319',source:'6d362ff52101541719cc6b639d48b394630113fa61b3467ddbecb78dbe8742b8',protocol:'bf94e388a2d71f1d3f7c75dd5d1855a4d69ddd8ba946dc81905faa85746e57ad',manifest:'bf0fcb849988aedc5ac20965d567e304adec88129b4f6e47fea21bcb0395dbca'};
export const {fingerprint,benchmarkCohort,compareRuns,accountedOutcome,rowKey}=await import(pathToFileURL(path.join(TOOLS,'v3d-bench-metrics.mjs')));
const {verifyArtifacts,assertReferenceEvidence}=await import(pathToFileURL(path.join(TOOLS,'v3d-bench.mjs')));
export const sha=b=>createHash('sha256').update(b).digest('hex');
const json=p=>JSON.parse(fs.readFileSync(p));
const write=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const same=(a,b)=>fingerprint(a)===fingerprint(b);
const profiles=['phone','desktop'];
const inside=(p,root)=>p===root||p.startsWith(root+path.sep);
const plain=v=>String(v??'—').replaceAll('|','\\|').replaceAll('\r',' ').replaceAll('\n',' ');
export function validateRun(run,clips,manifestSha,kind,{allowEmptySelection=false}={}){
  if(!EXPECTED[kind]||run.provenanceSha256!==EXPECTED[kind]||fingerprint(run.provenance)!==run.provenanceSha256)throw Error('Wrong or changed '+kind+' provenance');
  const p=run.provenance;
  if(manifestSha!==EXPECTED.manifest||run.manifestSha256!==manifestSha||p.manifestSha256!==manifestSha||!same(run.cohort,benchmarkCohort(clips))||clips.length!==20)throw Error('Manifest/cohort differs');
  if(p.protocolSha256!==EXPECTED.protocol||fingerprint(p.servedSource.files)!==p.servedSource.sha256||(kind!=='main'&&p.servedSource.sha256!==EXPECTED.source)||run.url!==p.url||!same(run.reference,p.reference)||!same(p.inputs,clips.map(({id,sha256,duration,file})=>({id,sha256,duration,file}))))throw Error('Source/protocol/input metadata differs');
  if((kind==='paired'&&p.reference?.provenanceSha256!==EXPECTED.main)||(kind!=='paired'&&p.reference!==null))throw Error('Paired/unpaired reference differs');
  const inputs=new Map(clips.map(c=>[c.id,c.sha256]));
  const emptyTemplate=allowEmptySelection&&run.results?.length===0&&run.selection?.ids?.length===0&&run.selection?.profiles?.length===0;
  if(!Array.isArray(run.results)||(!emptyTemplate&&(!Array.isArray(run.selection?.ids)||!run.selection.ids.length||new Set(run.selection.ids).size!==run.selection.ids.length||run.selection.ids.some(id=>!inputs.has(id))||!Array.isArray(run.selection.profiles)||!run.selection.profiles.length||new Set(run.selection.profiles).size!==run.selection.profiles.length||run.selection.profiles.some(p=>!profiles.includes(p)))))throw Error('Invalid selection');
  const seen=new Set();
  for(const r of run.results){
    const key=rowKey(r);
    if(seen.has(key)||!inputs.has(r.id)||!profiles.includes(r.profile)||!run.selection.ids.includes(r.id)||!run.selection.profiles.includes(r.profile)||r.sha256!==inputs.get(r.id)||r.provenanceSha256!==run.provenanceSha256||typeof r.status!=='string'||!r.status)throw Error('Invalid/duplicate row '+key);
    seen.add(key);
  }
  return run;
}
export function inventory(directory){
  if(fs.lstatSync(directory).isSymbolicLink()||!fs.lstatSync(directory).isDirectory())throw Error('Case root must be a real directory');
  const rows=[];
  const visit=(at,prefix='')=>{
    for(const entry of fs.readdirSync(at,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
      const file=path.join(at,entry.name),relative=prefix+entry.name;
      if(entry.isDirectory()){rows.push({path:relative,type:'directory'});visit(file,relative+'/');}
      else if(entry.isFile()){const b=fs.readFileSync(file);rows.push({path:relative,type:'file',bytes:b.length,sha256:sha(b)});}
      else throw Error('Symlink/special case artifact refused: '+file);
    }
  };visit(directory);return rows;
}
export function validateCase(directory,row){
  const folder=path.join(directory,`${row.id}-${row.profile}`);
  if(!same(json(path.join(folder,'result.json')),row))throw Error('Result does not equal recorded row '+rowKey(row));
  verifyArtifacts(directory,row);
  const check=(file,hash)=>{if(hash!==undefined&&(!/^[a-f0-9]{64}$/.test(hash)||sha(fs.readFileSync(path.join(folder,file)))!==hash))throw Error('Recorded artifact missing/changed '+rowKey(row)+' '+file);};
  check('model.ply',row.modelSha256);check('evaluation.json',row.evaluationSha256);
  for(const [i,f] of (row.frames||[]).entries())for(const kind of ['render','reference'])check(`${kind}-${i}.png`,f[`${kind}Sha256`]);
  return inventory(folder);
}
export function assertAppendOnly(captured,current){
  if(captured.provenanceSha256!==current.provenanceSha256||!same(captured.provenance,current.provenance))throw Error('Captured provenance changed');
  const rows=new Map(current.results.map(r=>[rowKey(r),r]));
  if(rows.size!==current.results.length)throw Error('Duplicate current rows');
  for(const r of captured.results)if(!rows.has(rowKey(r))||!same(r,rows.get(rowKey(r))))throw Error('Captured row changed/removed '+rowKey(r));
}
export function classifyAttempt(run,declaredMode){
  const mode=run.provenance.reference===null?'unpaired':'paired';
  if(mode!==declaredMode||run.provenanceSha256!==EXPECTED[mode])throw Error('Attempt mode/provenance differs');return mode;
}
export const controllerInventoryHash=rows=>fingerprint(rows.map(({path,...rest})=>({file:path,...rest})));
export function assertObservedBindings(observed,run,cases){
  for(const [key,record] of Object.entries(observed??{})){
    const row=run.results.find(r=>rowKey(r)===key);
    if(!row||record[0]!==fingerprint(row)||record[1]!==controllerInventoryHash(cases[key].inventory))throw Error('Previously observed row/case binding differs '+key);
  }
}
export function metrics(row){
  if(!row)return {status:'missing',reason:'No recorded run row at capture time; artifacts do not establish an outcome.',accounted:false};
  return {status:row.status,reason:row.reason??null,phase:row.phase??null,accounted:accountedOutcome(row),firstViewMs:row.firstViewMs??null,bakeMs:row.bakeMs??null,peakRssBytes:row.peakRssBytes??null,ssim:row.mean?.ssim??null,laplacian:row.mean?.laplacian??null,heldoutComplete:row.heldoutEvidence?.complete===true,consoleErrors:row.consoleErrors??[],timingScope:row.status==='finished'?'Original recorded successful timing; overlapping software-GPU host, nonphysical viewport profile.':'Original incomplete/rejected-attempt values only; no recovered successful timing.',originalRow:row};
}
export function caseTable(clips,main,paired,attempts){
  return clips.flatMap(c=>profiles.map(profile=>({id:c.id,profile,source:c,main:metrics(main.results.find(r=>r.id===c.id&&r.profile===profile)),paired:metrics(paired?.results.find(r=>r.id===c.id&&r.profile===profile)),rawAttempts:attempts.filter(a=>a.id===c.id&&a.profile===profile)})));
}
export function publishedLink(mapping,source,hash){
  const row=mapping?.[source];if(!row)return null;
  if(row.sha256!==hash||typeof row.url!=='string'||!/^https:\/\//.test(row.url)||/\s/.test(row.url)||/[<>"()]/.test(row.url))throw Error('Unverified publication link mapping '+source);
  return row.url;
}
export async function generate({out,label='partial-verification',publicationMap=null}={}){
  if(!out||fs.existsSync(out))throw Error('Fresh output required; existing snapshots are never replaced');
  out=path.resolve(out);
  if(!inside(out,path.join(ROOT,'final-r12-report-preparation-r1')))throw Error('Keep output in this outside-only reporting kit');
  fs.mkdirSync(path.join(out,'inputs'),{recursive:true});fs.mkdirSync(path.join(out,'evidence'));
  const started=new Date().toISOString(),receipts=[],bindings=[],mapping=publicationMap?json(publicationMap):{};
  const capture=(source,relative)=>{
    const resolved=fs.realpathSync(source),b=fs.readFileSync(resolved),hash=sha(b),target=path.join(out,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,b,{flag:'wx'});
    const row={source,resolved,copy:relative,bytes:b.length,sha256:hash,publishedUrl:publishedLink(mapping,source,hash)};receipts.push(row);return {bytes:b,receipt:row};
  };
  try{
    const manifest=capture(path.join(TOOLS,'v3d-corpus.json'),'inputs/manifest.json'),clips=JSON.parse(manifest.bytes);
    if(!Array.isArray(clips)||clips.length!==20)throw Error('Actual20 manifest required');
    // Bind original local input bytes, with no decoder/browser work or source-page claims.
    const corpus=clips.map(c=>{const f=path.join(ROOT,'corpus',c.file),cap=capture(f,'inputs/corpus/'+c.file);if(cap.receipt.sha256!==c.sha256)throw Error('Changed corpus input '+c.id);return {id:c.id,file:c.file,sha256:c.sha256,bytes:cap.bytes.length,sourcePath:f,copy:cap.receipt.copy};});
    for(const name of ['v3d-bench.mjs','v3d-bench-metrics.mjs','v3d-bench-pixels.mjs','v3d-bench-samples.mjs','cdx-v3d-clarity-metrics.mjs','v3d-bench-join.mjs'])capture(path.join(TOOLS,name),'inputs/tools/'+name);
    for(const file of ['report.mjs','samples.mjs','storage.mjs','dashboard.mjs'])capture(path.join(import.meta.dirname,file),'inputs/report-code/'+file);
    const control=path.join(ROOT,'follow-r12-v1-control');
    for(const name of ['declaration.json','provenance-preparation.json','templates/paired.json','templates/unpaired.json'])capture(path.join(control,name),'inputs/control/'+name);
    capture(path.join(ROOT,'runtime-r12-freeze.json'),'inputs/runtime-r12-freeze.json');
    const stateCapture=capture(path.join(control,'state.json'),'inputs/control/state.json'),state=JSON.parse(stateCapture.bytes);
    const decl=json(path.join(out,'inputs/control/declaration.json'));
    if(decl.servedSourceSha256!==EXPECTED.source||decl.pairedProvenanceSha256!==EXPECTED.paired||decl.unpairedProvenanceSha256!==EXPECTED.unpaired||decl.baselineProvenanceSha256!==EXPECTED.main||decl.protocolSha256!==EXPECTED.protocol)throw Error('R12 declaration differs');
    const freeze=json(path.join(out,'inputs/runtime-r12-freeze.json')),preparation=json(path.join(out,'inputs/control/provenance-preparation.json'));
    if(freeze.productCommit!==decl.productCommit||freeze.servedSource.sha256!==EXPECTED.source||fingerprint(freeze.servedSource.files)!==EXPECTED.source||preparation.protocolSha256!==EXPECTED.protocol||preparation.servedSourceSha256!==EXPECTED.source||!same(freeze.protocolFiles.slice().sort((a,b)=>a.file.localeCompare(b.file)),preparation.protocolFiles.slice().sort((a,b)=>a.file.localeCompare(b.file))))throw Error('Freeze/preparation binding differs');
    for(const p of freeze.protocolFiles)if(sha(fs.readFileSync(path.join(out,'inputs/tools',p.file)))!==p.sha256)throw Error('Frozen validation export bytes differ '+p.file);
    for(const mode of ['paired','unpaired'])validateRun(json(path.join(out,'inputs/control/templates',mode+'.json')),clips,manifest.receipt.sha256,mode,{allowEmptySelection:true});
    const load=(alias,kind,relative)=>{
      const resolved=fs.realpathSync(alias); // Resolve each alias ONCE; all following reads use this immutable path.
      const cap=capture(path.join(resolved,'run.json'),relative+'/run.json'),options={allowEmptySelection:relative.startsWith('evidence/raw/')},run=validateRun(JSON.parse(cap.bytes),clips,manifest.receipt.sha256,kind,options),cases={};
      for(const row of run.results){
        if(kind==='paired')assertReferenceEvidence(path.join(out,'evidence/main'),baseline.run,row,EXPECTED.main);
        const before=validateCase(resolved,row),folder=`${row.id}-${row.profile}`,target=path.join(out,relative,folder);
        fs.cpSync(path.join(resolved,folder),target,{recursive:true,errorOnExist:true,force:false,mode:fs.constants.COPYFILE_FICLONE});
        if(!same(inventory(target),before))throw Error('Copied case bytes differ '+folder);validateCase(path.join(out,relative),row);
        cases[rowKey(row)]={copy:relative+'/'+folder,rowFingerprint:fingerprint(row),inventory:before,newlyHashBoundMetadata:true,notice:'Full-case/model.json inventories are newly captured byte bindings; only hashes explicitly recorded in the original row are historical benchmark hashes.'};
      }
      const after=validateRun(json(path.join(resolved,'run.json')),clips,manifest.receipt.sha256,kind,options);assertAppendOnly(run,after);
      for(const row of run.results)if(!same(validateCase(resolved,row),cases[rowKey(row)].inventory))throw Error('Case changed during copy '+rowKey(row));
      assertObservedBindings(state.observedImmutableRows?.[kind==='main'?'baseline':alias],run,cases);
      if(run.join?.receipt){
        const receiptFile=path.join(resolved,run.join.receipt);if(path.basename(run.join.receipt)!==run.join.receipt)throw Error('Invalid join receipt path');
        const joined=JSON.parse(capture(receiptFile,relative+'/join.json').bytes);
        if(joined.runSha256!==cap.receipt.sha256||joined.provenanceSha256!==run.provenanceSha256||joined.manifestSha256!==manifest.receipt.sha256||joined.rows.length!==run.results.length)throw Error('Join receipt input binding differs');
        for(const row of run.results){const proof=joined.rows.find(r=>r.key===rowKey(row));if(!proof||proof.fingerprint!==fingerprint(row)||!same(proof.artifactInventory,cases[rowKey(row)].inventory))throw Error('Join row/full-case receipt differs '+rowKey(row));}
      }
      const loaded={alias,resolved,kind,copy:relative,run,runSha256:cap.receipt.sha256,cases,options};bindings.push(loaded);return loaded;
    };
    const baseline=load(path.join(ROOT,'main-master-r1'),'main','evidence/main');
    const candidateAlias=path.join(ROOT,'candidate-r12-paired-master-v1'),candidate=fs.existsSync(candidateAlias)?load(candidateAlias,'paired','evidence/paired-master'):null;
    const shards=path.join(ROOT,'candidate-r12-v1-shards'),directories=fs.readdirSync(shards,{withFileTypes:true}).filter(d=>d.isDirectory()).map(d=>d.name).sort();
    const attempts=[];const seenPaths=new Set();
    // Union captured controller reservations and actually present shard dirs; never invent rows.
    const declared=state.attempts??[];
    const sources=[...declared.map(a=>({path:a.output,state:a})),...directories.filter(n=>!declared.some(a=>path.resolve(a.output)===path.join(shards,n))).map(n=>({path:path.join(shards,n),state:null}))];
    for(const source of sources){
      if(!inside(path.resolve(source.path),shards)||seenPaths.has(path.resolve(source.path)))throw Error('Invalid/duplicate raw attempt directory');seenPaths.add(path.resolve(source.path));
      const name=path.basename(source.path),match=/^\d+-([a-z0-9_-]+)-(phone|desktop)-(paired|unpaired)$/.exec(name);
      if(!match||!clips.some(c=>c.id===match[1]))throw Error('Unknown raw shard '+name);
      const [id,profile,mode]=match.slice(1);if(source.state&&(source.state.id!==id||source.state.profile!==profile||source.state.mode!==mode||source.state.expectedProvenanceSha256!==EXPECTED[mode]))throw Error('Controller/shard identity differs');
      const file=path.join(source.path,'run.json');let item=null;
      if(fs.existsSync(file)){item=load(source.path,mode,'evidence/raw/'+name);classifyAttempt(item.run,mode);if(item.run.results.some(r=>r.id!==id||r.profile!==profile)||item.run.results.length>1)throw Error('Shard contains unexpected rows');}
      const row=item?.run.results[0]??null;
      if(source.state?.recordedRows?.length&&(!row||source.state.recordedRows.length!==1||!source.state.recordedRows.some(r=>r.rowFingerprint===fingerprint(row)&&r.caseInventorySha256===controllerInventoryHash(item.cases[rowKey(row)].inventory))))throw Error('Captured controller row/case fingerprint differs');
      const unlisted=fs.existsSync(source.path)?fs.readdirSync(source.path,{withFileTypes:true}).filter(e=>e.isDirectory()&&!item?.run.results.some(r=>e.name===`${r.id}-${r.profile}`)).map(e=>e.name):[];
      let logCopy=null;
      if(source.state?.endedAt&&source.state.log&&fs.existsSync(source.state.log)){
        logCopy='inputs/native-logs/'+name+'.log';const cap=capture(source.state.log,logCopy);
        if(sha(fs.readFileSync(cap.receipt.resolved))!==cap.receipt.sha256)throw Error('Completed native log changed during capture '+name);
      }
      attempts.push({name,id,profile,mode,source:source.path,copy:item?.copy??null,caseInventory:row?item.cases[rowKey(row)].inventory:null,logCopy,controllerState:source.state,outcome:metrics(row),unlistedCaseDirectories:unlisted,notice:row?'Original native row preserved; unpaired quality never enters strict comparison.':'No recorded native row at this capture; in-progress folders/models are not completion evidence.'});
    }
    // Enforce captured R12/master rows are actual identical paired raw outcomes.
    if(candidate)for(const r of candidate.run.results){const matches=attempts.filter(a=>a.mode==='paired'&&a.outcome.originalRow&&rowKey(a.outcome.originalRow)===rowKey(r));if(matches.length!==1||!same(matches[0].outcome.originalRow,r)||!same(matches[0].caseInventory,candidate.cases[rowKey(r)].inventory))throw Error('Strict master/raw row or artifact inventory differs or missing '+rowKey(r));}
    for(const b of bindings){
      assertAppendOnly(b.run,validateRun(json(path.join(b.resolved,'run.json')),clips,manifest.receipt.sha256,b.kind,b.options));
      for(const row of b.run.results)if(!same(validateCase(b.resolved,row),b.cases[rowKey(row)].inventory))throw Error('Captured case changed before final report '+rowKey(row));
    }
    const comparison=candidate?compareRuns(baseline.run,candidate.run):null;
    if(comparison&&!comparison.provenanceCompatible)throw Error('Strict comparison provenance incompatible');
    const sampleCohorts=captureSamples({out,capture});
    const cases=caseTable(clips,baseline.run,candidate?.run,attempts),finished=new Date().toISOString();
    const report={kind:'source-bound-CPU-snapshot-diagnostic-not-acceptance',label,captureStartedAt:started,captureFinishedAt:finished,notice:'Partial evidence remains partial. All40 cases are visible. No recovered timing, missing-status inference, or acceptance claim.',timingLimit:'4-core CPU quota; SwiftShader software GPU; overlapping local jobs. Phone/desktop are viewport profiles, not physical-device measurements.',source:{productCommit:decl.productCommit,servedSourceSha256:EXPECTED.source,protocolSha256:EXPECTED.protocol,baselineProvenanceSha256:EXPECTED.main,pairedProvenanceSha256:EXPECTED.paired,unpairedProvenanceSha256:EXPECTED.unpaired},manifest:clips,corpusInputHashes:corpus,baseline,candidate,attempts,cases,comparison,summary:{expectedCases:40,mainRows:baseline.run.results.length,pairedMasterRows:candidate?.run.results.length??0,rawAttempts:attempts.length,rawRecordedRows:attempts.filter(a=>a.outcome.originalRow).length,unpairedRows:attempts.filter(a=>a.mode==='unpaired'&&a.outcome.originalRow).length,rawPending:attempts.filter(a=>!a.outcome.originalRow).map(a=>a.name)},publication:{mode:publicationMap?'explicit-source/hash/HTTPS mappings; other links remain snapshot-relative':'No published URLs supplied. Markdown artifact links are copied snapshot-relative evidence, not claims of publication.',mapping},receipts};
    report.sampleCohorts=sampleCohorts;
    write(path.join(out,'report.json'),report);write(path.join(out,'strict-comparison.json'),comparison);write(path.join(out,'input-receipts.json'),receipts);
    write(path.join(out,'summary.json'),{capturedAt:finished,label,source:report.source,...report.summary,sampleCohorts:sampleCohorts.map(({name,status,cases,views,commit,source})=>({name,status,cases,views,commit,source}))});
    write(path.join(out,'gates.json'),{capturedAt:finished,notice:'Unchanged comparator values; incomplete evidence is UNPROVEN. RSS is recorded only.',complete:comparison?.complete??false,neverFails:comparison?.neverFails??false,provenanceCompatible:comparison?.provenanceCompatible??null,profiles:Object.fromEntries(profiles.map(p=>{const q=comparison?.profiles[p];return[p,q?Object.fromEntries(['complete','coverage','baselineMeasurable','pairedMeasurable','qualityEvidenceComplete','quality','noSlower','ssimGain','sharpnessGain','timing'].map(k=>[k,q[k]])):null];}))});
    fs.writeFileSync(path.join(out,'report.md'),markdown(report),{flag:'wx'});
    fs.writeFileSync(path.join(out,'index.html'),dashboard(report),{flag:'wx'});
    fs.writeFileSync(path.join(out,'README.md'),`# R12 source-bound reporting snapshot\n\nCaptured ${finished}; label ${label}. **UNPROVEN: incomplete evidence is not acceptance.**\n\n[All40 original native outcomes and raw attempts](report.md) · [Offline dashboard](index.html) · [Machine gates](gates.json) · [Summary](summary.json) · [Full report JSON, lossless gzip](report.json.gz) · [Restoration map](restore-map.json).\n\nNative source remains ${decl.productCommit}; postmerge sample evidence remains a separate cohort under sample-cohorts/. Phone and desktop are nonphysical SwiftShader viewport profiles under overlapping4-core host load. Desktop paired quality coverage is ${comparison?.profiles.desktop?.pairedMeasurable??0}; no missing quality result is inferred. Raw logs, original credits, and telemetry are exact lossless gzip; oversized images retain all original bytes. Copied relative links work when this complete directory is published. No absolute workspace path is presented as a published URL.\n`,{flag:'wx'});
    const originalReportSha256=sha(fs.readFileSync(path.join(out,'report.json'))),storageSources=Object.fromEntries(receipts.map(r=>[r.copy,r.resolved]));
    for(const b of bindings)for(const c of Object.values(b.cases))for(const file of c.inventory)if(file.type==='file')storageSources[c.copy+'/'+file.path]=path.join(b.resolved,c.copy.split('/').at(-1),file.path);
    const storage=archiveRaw(out,storageSources);write(path.join(out,'restore-map.json'),storage);const restored=verifyArchived(out,storage);write(path.join(out,'restoration-verification.json'),restored);
    for(const sample of sampleCohorts)if(sample.copy){const prefix=sample.copy+'/';write(path.join(out,prefix,'restore-map.json'),storage.filter(m=>m.originalRelativePath.startsWith(prefix)).map(m=>({...m,originalRelativePath:m.originalRelativePath.slice(prefix.length),storedRelativePath:m.storedRelativePath.slice(prefix.length)})));}
    const files=inventory(out);write(path.join(out,'snapshot-freeze.json'),{created:finished,kind:report.kind,label,reportSha256:originalReportSha256,files,restoration:restored,notice:'Every listed copied byte was verified. Raw JSON/logs and oversized images are lossless gzip with explicit restoration hashes. Metadata without original row hashes is newly hash-bound, not historically verified. This immutable snapshot is never updated.'});
    return {out,...report.summary,comparisonComplete:comparison?.complete??false,capturedAt:finished};
  }catch(error){write(path.join(out,'REJECTED.json'),{at:new Date().toISOString(),error:String(error.stack??error),notice:'Incomplete/rejected report preparation; not a valid report snapshot.'});throw error;}
}
function markdown(r){
  const n=x=>Number.isFinite(x)?String(x):'—',seconds=x=>Number.isFinite(x)?(x/1000).toFixed(3):'—',mib=x=>Number.isFinite(x)?(x/1048576).toFixed(2):'—';
  const row=(id,p,v,m,link)=>`| ${plain(id)} | ${p} | ${v} | ${plain(m.status)} | ${seconds(m.firstViewMs)} | ${seconds(m.bakeMs)} | ${mib(m.peakRssBytes)} | ${n(m.ssim)} | ${n(m.laplacian)} | ${m.status==='missing'?'No recorded native row':`Phase: ${plain(m.phase)}; full original reason retained`}${link?` [raw](${link}/result.json.gz)`:''} |`;
  const lines=['# R12 source-bound evidence snapshot','',`Captured ${r.captureStartedAt} to ${r.captureFinishedAt}; label: ${plain(r.label)}.`,'',r.notice,'',r.timingLimit,'',`Source commit \`${r.source.productCommit}\`; served source \`${r.source.servedSourceSha256}\`; protocol \`${r.source.protocolSha256}\`.`,`Baseline \`${r.source.baselineProvenanceSha256}\`; paired \`${r.source.pairedProvenanceSha256}\`; unpaired \`${r.source.unpairedProvenanceSha256}\`.`,'',`Recorded main ${r.summary.mainRows}/40; strict paired-master ${r.summary.pairedMasterRows}/40; raw attempts ${r.summary.rawAttempts}, recorded ${r.summary.rawRecordedRows}, unpaired recorded ${r.summary.unpairedRows}.`,'','## Strict gates','',`Unchanged compareRuns complete: **${r.comparison?.complete??false}**. Incomplete coverage means **UNPROVEN**, regardless of partial-pair medians. RSS is recorded, not an acceptance gate.`,'','| Profile | Paired measurable | Quality gate | Phone/desktop noSlower | SSIM median gain (partial pairs only if incomplete) | Laplacian median ratio (same scope) |','|---|---:|---|---|---:|---:|'];
  for(const p of profiles){const q=r.comparison?.profiles[p];lines.push(`| ${p} | ${q?.pairedMeasurable??0} | ${q?.quality??false} | ${q?.noSlower??false} | ${n(q?.ssimGain)} | ${n(q?.sharpnessGain)} |`);}
  lines.push('','Quality thresholds are +0.03 SSIM and1.5× Laplacian with full accounted cohort; phone timing median and worst must not regress. The comparator JSON is preserved unchanged; desktop timing is diagnostic. No partial median is presented as a completed-corpus median.','', '## All20 clips × both profiles: original strict outcomes','','First3D/bake values are original recorded seconds; RSS is MiB; sharpness is Laplacian variance. Incomplete-row values do not recover successful timing. Missing rows stay missing.','', '| Clip | Profile | Version | Original outcome | First3D s | Bake s | RSS MiB | SSIM | Sharpness | Original reason / copied raw evidence |','|---|---|---|---|---:|---:|---:|---:|---:|---|');
  for(const c of r.cases){lines.push(row(c.id,c.profile,'main',c.main,r.baseline.cases[`${c.id}/${c.profile}`]?.copy));lines.push(row(c.id,c.profile,'R12 strict paired',c.paired,r.candidate?.cases[`${c.id}/${c.profile}`]?.copy));}
  lines.push('','## Every raw R12 attempt, kept outside strict comparison','','Rows completed after the captured master may appear here only. An unpaired success cannot enter strict quality comparison. Captured controller state and original row status are preserved separately in JSON.','', '| Clip | Profile | Mode / shard | Original outcome | First3D s | Bake s | RSS MiB | SSIM | Sharpness | Original reason / copied raw evidence |','|---|---|---|---|---:|---:|---:|---:|---:|---|');
  for(const a of r.attempts)lines.push(row(a.id,a.profile,a.mode+' / '+a.name,a.outcome,a.outcome.originalRow?a.copy+'/'+a.id+'-'+a.profile:null));
  lines.push('','## Separate sample source cohorts','','| Source cohort | Source commit | Status | Cases | Views |','|---|---|---|---:|---:|');
  for(const s of r.sampleCohorts??[])lines.push(`| ${s.name} | ${s.commit} | ${s.status} | ${s.cases} | ${s.views} |`);
  lines.push('','Sample preservation is independent of native-video quality. Postmerge sample bytes stay in their separate source cohort; no native64ec row is relabeled. Oversized images are lossless gzip with restore-map.json, never resized.');
  lines.push('','## Source credits and licenses','','These facts are copied from the frozen manifest; this report does not claim new source-page verification.','', '| Clip | Author | License | Source |','|---|---|---|---|');
  for(const c of r.manifest)lines.push(`| ${plain(c.id)} | ${plain(c.author)} | [${plain(c.license)}](${c.licenseUrl}) | [source](${c.source}) |`);
  lines.push('','## Publication mapping','',r.publication.mode,'','Workspace source paths in JSON are provenance facts, not published hyperlinks. Root must publish copied relative artifacts or provide explicit source-path/byte-SHA/HTTPS mappings. Model metadata/full-case inventories are newly hash-bound unless the original row explicitly records the corresponding hash.','');return lines.join('\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename){
  const options={};for(const arg of process.argv.slice(2)){const m=/^--(out|label|publication-map)=(.+)$/.exec(arg);if(!m)throw Error('Use --out=FRESH --label=LABEL [--publication-map=FILE]');options[m[1]==='publication-map'?'publicationMap':m[1]]=m[2];}
  console.log(JSON.stringify(await generate(options),null,2));
}
