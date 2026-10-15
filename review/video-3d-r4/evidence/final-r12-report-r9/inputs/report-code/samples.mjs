// MIT. CPU-only, source-separated preservation evidence. No browser is launched.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root='/workspace/v3d-r4-media',tools='/workspace/splashery-v3d-bench-tools-r12/tools';
const {assertSampleInventory,assertSampleCase,identicalPixels}=await import(pathToFileURL(path.join(tools,'v3d-bench-samples.mjs')));
const {PNG}=createRequire(path.join(tools,'v3d-bench-samples.mjs'))('pngjs');
const sha=b=>createHash('sha256').update(b).digest('hex');
export const SAMPLE_COHORTS=[{name:'R12-frozen64ec',folder:'samples-r12-r1',launch:'samples-r12-launch.json',completion:'samples-r12-completion-observation-r1.json',freeze:'runtime-r12-freeze.json',commit:'64ec9ad5b7a90b590b289f6a02f0bbd50138db08',source:'6d362ff52101541719cc6b639d48b394630113fa61b3467ddbecb78dbe8742b8',kind:'root-observed-completion'},
  {name:'postmerge-2773',folder:'samples-postmerge-r1',launch:'samples-postmerge-r1-control/launch.json',completion:'samples-postmerge-r1-control/result.json',freeze:'runtime-postmerge-samples-r1-freeze.json',commit:'2773a1c4458e9f1894f3d3cac11b5631c5325384',source:'5a27ac17adddd2f86b69c3295e8c4e3f747109b94f46c78a733ec5e7f7d450c8',kind:'owned-controller-completion'}];
export function completedSampleReceipt(spec,receipt,samplesHash){
  if(receipt.productCommit!==spec.commit||receipt.servedSourceSha256!==spec.source)throw Error('Sample completion/source differs');
  if(spec.kind==='owned-controller-completion')return receipt.nativeReturncode===0&&receipt.deadlineInterrupted===false;
  return receipt.samplesJsonSha256===samplesHash&&receipt.cases===12&&receipt.heldOutViews===74&&receipt.allPreserved===true&&!receipt.errors?.length&&receipt.processObservation?.state==='Z'&&receipt.processObservation?.kernelRawExitCode===0;
}
export function captureSamples({out,capture}){
  const rows=[],referenceFile=path.join(root,'samples-main-r1/samples.json'),referenceBytes=fs.readFileSync(referenceFile),reference=JSON.parse(referenceBytes),before=assertSampleInventory(reference);
  capture(referenceFile,'inputs/samples-main-reference.json');
  for(const spec of SAMPLE_COHORTS){
    const prefix='sample-cohorts/'+spec.name,source=path.join(root,spec.folder),file=path.join(source,'samples.json');
    if(!fs.existsSync(file)){rows.push({...spec,status:'missing',cases:0,views:0,notice:'No sample rows captured; no preservation claim.'});continue;}
    const cap=capture(file,prefix+'/samples.json'),records=JSON.parse(cap.bytes);if(!Array.isArray(records))throw Error('Invalid sample record array');
    capture(path.join(root,spec.launch),prefix+'/launch.json');
    const frozen=JSON.parse(capture(path.join(root,spec.freeze),prefix+'/runtime-freeze.json').bytes);
    if(frozen.productCommit!==spec.commit||frozen.servedSource?.sha256!==spec.source)throw Error('Sample cohort freeze differs');
    for(const name of ['CREDITS.md','LICENSES.md','LICENSE'])capture(path.join(tools,'..',name),prefix+'/'+name);
    const completion=path.join(root,spec.completion),receipt=fs.existsSync(completion)?JSON.parse(capture(completion,prefix+'/completion.json').bytes):null;
    if(!receipt||!completedSampleReceipt(spec,receipt,cap.receipt.sha256)){
      rows.push({...spec,status:'incomplete-or-interrupted',cases:records.length,views:records.reduce((n,r)=>n+(r.frames?.length??0),0),copy:prefix,notice:'No complete successful completion receipt. Rows are observational only; no preservation pass or PNG packet is inferred.'});continue;
    }
    assertSampleInventory(records);const frames=[];
    if(spec.kind==='owned-controller-completion'){
      const control=path.join(root,'samples-postmerge-r1-control');
      for(const entry of fs.readdirSync(control,{withFileTypes:true}))if(entry.isFile()&&!['launch.json','result.json'].includes(entry.name))capture(path.join(control,entry.name),prefix+'/control/'+entry.name);
      for(const name of ['samples-postmerge-r1-launch.json','run-postmerge-samples-r1.py'])capture(path.join(root,name),prefix+'/control/'+name);
      const log='/tmp/v3d-r4-samples-postmerge-r1.log';if(fs.existsSync(log))capture(log,prefix+'/control/native.log');
    }
    for(const record of records){
      const key=record.id+'/'+record.profile,baseline=before.get(key);assertSampleCase(record,baseline);
      for(const f of record.frames){
        const name=`${record.id}-${record.profile}/${f.index}.png`,original=path.join(source,name),b=fs.readFileSync(original),ref=baseline.frames.find(v=>v.index===f.index),refPath=path.join(root,'samples-main-r1',name),a=fs.readFileSync(refPath);
        if(sha(b)!==f.sha256||sha(a)!==ref?.sha256||!identicalPixels(PNG.sync.read(a),PNG.sync.read(b)))throw Error('Actual sample pixels/hash changed '+spec.name+' '+name);
        const copied=capture(original,prefix+'/'+name);if(copied.receipt.sha256!==f.sha256)throw Error('Sample changed while copying');
        frames.push({id:record.id,profile:record.profile,index:f.index,time:f.time,sha256:f.sha256,mainSha256:ref.sha256,pixelIdentical:true,byteIdentical:a.equals(b),copy:prefix+'/'+name});
      }
    }
    if(sha(fs.readFileSync(file))!==cap.receipt.sha256)throw Error('Completed sample rows changed during capture');
    rows.push({...spec,status:'completed-and-independently-pixel-verified',cases:records.length,views:frames.length,copy:prefix,frames,notice:'Separate sample preservation cohort. This does not establish native-video reconstruction quality or timing.'});
  }
  for(const row of rows)if(row.copy){
    const text=`# ${row.name} sample preservation evidence\n\nSource commit: ${row.commit}. Served source: ${row.source}.\n\nStatus: **${row.status}**. Captured cases: ${row.cases}/12; views: ${row.views}/74.\n\n${row.notice}\n\nThis sample cohort remains separate from native64ec video reconstruction evidence. [Original sample rows](samples.json.gz), [source freeze](runtime-freeze.json.gz), [original credits](CREDITS.md.gz), [license notices](LICENSES.md.gz). Raw files and oversized images use lossless gzip. The local restore-map.json binds every original/restored byte; it does not change images. This directory can be copied independently for publication.\n`;
    fs.writeFileSync(path.join(out,row.copy,'README.md'),text,{flag:'wx'});
  }
  fs.writeFileSync(path.join(out,'sample-cohorts.json'),JSON.stringify(rows,null,2)+'\n',{flag:'wx'});return rows;
}
