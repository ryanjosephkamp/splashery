// MIT. CPU-only validation of saved source-bound replay receipts and encoded movie metadata.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fingerprint} from '/workspace/splashery-v3d-bench-tools-r12/tools/v3d-bench-metrics.mjs';
import {verifyArtifacts,assertReferenceEvidence} from '/workspace/splashery-v3d-bench-tools-r12/tools/v3d-bench.mjs';
import {reviewSelection,matchedTimeline,assertReplayScene} from '/workspace/splashery-v3d-bench-tools-r12/tools/v3d-review.mjs';
const tools='/workspace/splashery-v3d-bench-tools-r12/tools';
const {PNG}=createRequire(path.join(tools,'v3d-review.mjs'))('pngjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p));
const hex=s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const inventory=directory=>{
 const files=[];
 const walk=(at,prefix='')=>{
  for(const item of fs.readdirSync(at,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
   const file=prefix?prefix+'/'+item.name:item.name,absolute=path.join(at,item.name);
   if(item.isDirectory())walk(absolute,file);
   else {assert.ok(item.isFile());const b=fs.readFileSync(absolute);files.push({file,bytes:b.length,sha256:sha(b)});}
  }
 };walk(directory);return files;
};
export function validateReview(directory,plan,{probe=true}={}){
 const report=read(path.join(directory,'review.json'));
 const manifestBytes=fs.readFileSync(path.join(tools,'v3d-corpus.json')),clips=JSON.parse(manifestBytes);
 assert.equal(report.provenance.toolSha256,sha(fs.readFileSync(path.join(tools,'v3d-review.mjs'))));
 assert.equal(report.provenance.toolSha256,'35ec88c4c384dd1e845760fd0e0e8c5c561aae2021cd28ecd2eb8868d4e2b7c7');
 assert.equal(report.profile,'phone');assert.equal(report.provenance.profile,'phone');
 assert.equal(report.provenance.paneWidth,390);assert.equal(report.provenance.paneHeight,844);assert.equal(report.provenance.fps,12);assert.equal(report.provenance.seconds,5);
 assert.equal(report.provenance.manifestSha256,sha(manifestBytes));
 const versions=report.provenance.versions;assert.deepEqual(versions.map(v=>v.name),['main','this-round']);
 assert.deepEqual(versions.map(v=>v.provenanceSha256),['7c714d23fd839129b6abbf718460cd7bf5bad59c34988292a26e4c5046aa05e6','b9cf187314d545233fda59b861bb8dfb7eeacdb722a7064a38e4442281984524']);
 assert.deepEqual(versions.map(v=>v.url),['http://127.0.0.1:4174/','http://127.0.0.1:4183/']);assert.deepEqual(versions.map(v=>v.preservePhotometric),[false,true]);
 assert.deepEqual(versions.map(v=>v.directory),plan.snapshots);
 const runs=versions.map(v=>read(path.join(v.directory,'run.json')));
 for(const [i,run] of runs.entries()){
  assert.equal(fingerprint(run.provenance),versions[i].provenanceSha256);assert.equal(run.provenanceSha256,versions[i].provenanceSha256);
  assert.equal(sha(fs.readFileSync(path.join(versions[i].directory,'run.json'))),plan.runSha256[i]);
 }
 assert.equal(runs[1].provenance.servedSource.sha256,'6d362ff52101541719cc6b639d48b394630113fa61b3467ddbecb78dbe8742b8');
 const selected=report.selection.selected.map(x=>x.id);assert.deepEqual(selected,plan.selected);assert.ok(selected.length>=1&&selected.length<=10);
 assert.deepEqual(report.selection,reviewSelection(clips,runs[0],runs[1],{profile:'phone',ids:selected}));assert.equal(report.selection.ranked,false);
 assert.equal(new Set(report.cases.map(x=>x.id)).size,report.cases.length);assert.ok(report.cases.every(x=>selected.includes(x.id)));
 const captured=[];
 for(const item of report.cases){
  if(item.status!=='captured')continue;
  const folder=path.join(directory,item.id+'-phone');assert.deepEqual(read(path.join(folder,'receipt.json')),item);
  assert.deepEqual(item.files.map(x=>x.file),['comparison.mp4','poster.jpg','attribution.txt','verification.json']);
  for(const f of item.files){assert.equal(path.basename(f.file),f.file);assert.equal(sha(fs.readFileSync(path.join(folder,f.file))),f.sha256);}
  assert.ok(fs.statSync(path.join(folder,'poster.jpg')).size<=1_000_000);
  assert.deepEqual(read(path.join(folder,'verification.json')),item.verification);
  assert.deepEqual(item.verification.map(x=>x.version),['main','this-round']);assert.deepEqual(item.modelMetadataSha256.map(x=>x.version),['main','this-round']);
  const rows=runs.map(run=>run.results.find(x=>x.id===item.id&&x.profile==='phone'));
  assert.equal(item.resultFingerprint,fingerprint(rows));const models=[];
  for(const [i,v] of versions.entries()){
   const row=rows[i],caseDir=path.join(v.directory,item.id+'-phone');verifyArtifacts(v.directory,row);
   const before=plan.bindings[item.id][i];assert.equal(before.version,i?'candidate':'main');assert.equal(before.rowFingerprint,fingerprint(row));
   const actualFiles=inventory(caseDir);assert.deepEqual(actualFiles,before.files);assert.equal(fingerprint(actualFiles),before.caseInventorySha256);
   if(i)assertReferenceEvidence(versions[0].directory,runs[0],row,runs[0].provenanceSha256);
   const bytes=fs.readFileSync(path.join(caseDir,'model.json')),model=JSON.parse(bytes);models.push(model);
   assert.equal(item.modelMetadataSha256[i].sha256,sha(bytes));assert.equal(fingerprint(model.stats),fingerprint(row.stats));
   const verification=item.verification[i];assertReplayScene(verification.scene,v.preservePhotometric);assert.equal(verification.frames.length,row.frames.length);assert.ok(row.frames.length>0);
   for(const [index,f] of verification.frames.entries()){
    const original=row.frames[index],png=fs.readFileSync(path.join(caseDir,'render-'+index+'.png'));
    assert.equal(f.index,index);assert.equal(f.time,original.time);assert.equal(f.savedSha256,original.renderSha256);assert.equal(f.savedSha256,sha(png));
    assert.equal(f.rgbaSha256,sha(PNG.sync.read(png).data));assert.ok(hex(f.replaySha256));assert.equal(f.byteIdentical,f.savedSha256===f.replaySha256);
   }
  }
  const timeline=matchedTimeline(models[0],models[1],{seconds:5,fps:12});assert.deepEqual(item.timeline,timeline);assert.equal(item.frames.length,timeline.frames);
  for(const [i,f] of item.frames.entries()){assert.equal(f.time,timeline.times[i]);assert.ok(hex(f.mainRgbaSha256)&&hex(f.candidateRgbaSha256));}
  let movie=null;
  if(probe){
   movie=JSON.parse(execFileSync('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height,nb_frames,r_frame_rate,duration','-of','json',path.join(folder,'comparison.mp4')],{encoding:'utf8',timeout:10000})).streams;
   assert.equal(movie.length,1);assert.equal(movie[0].width,784);assert.equal(movie[0].height,1004);assert.equal(Number(movie[0].nb_frames),timeline.frames);assert.equal(movie[0].r_frame_rate,'12/1');assert.ok(Math.abs(Number(movie[0].duration)-timeline.playbackSeconds)<0.001);
  }
  captured.push({id:item.id,frames:timeline.frames,movie,notice:'Saved PNG/RGBA hashes match the source-bound exact-replay receipt. Replay PNGs were not persisted and are not independently re-decoded here.'});
 }
 assert.equal(report.capturedClips,captured.length);
 return {verifiedAt:new Date().toISOString(),captured,allOriginalCapturedReceiptsVerified:true,ranked:false,reviewJsonSha256:sha(fs.readFileSync(path.join(directory,'review.json')))};
}
if(process.argv[1]===import.meta.filename){const [directory,planFile]=process.argv.slice(2);console.log(JSON.stringify(validateReview(directory,read(planFile))));}
