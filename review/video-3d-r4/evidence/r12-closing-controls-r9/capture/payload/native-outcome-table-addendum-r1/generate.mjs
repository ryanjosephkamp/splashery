// MIT. Made by Ryan with Codex (GPT-6). CPU-only additive native outcome presentation.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {fingerprint,accountedOutcome} from '/workspace/splashery-v3d-bench-tools-r12/tools/v3d-bench-metrics.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const same=(a,b)=>fingerprint(a)===fingerprint(b);
const profiles=['phone','desktop'];
const plain=x=>String(x??'—').replaceAll('|','\\|').replaceAll('\n',' ');
export function original(metric,id,profile){
  const row=metric?.originalRow;
  if(!row){if(metric?.status&&metric.status!=='missing')throw Error('Outcome without an original native row');return null;}
  if(row.id!==id||row.profile!==profile||row.status!==metric.status)throw Error('Original status/identity differs');
  return row;
}
export function latestAttempt(attempts){
  if(!attempts.length)return null;
  const rows=attempts.map(a=>{
    const m=/^(\d+)-/.exec(a.name??'');if(!m||Number(m[1])<1||!Number.isSafeInteger(Number(m[1])))throw Error('Actual reservation sequence required; no favorable fallback');
    const time=a.controllerState?.reservedAt??a.controllerState?.startedAt??a.outcome?.originalRow?.started??null;
    const milliseconds=time===null?null:Date.parse(time);if(time!==null&&!Number.isFinite(milliseconds))throw Error('Invalid chronology evidence');
    return {attempt:a,sequence:Number(m[1]),milliseconds};
  }).sort((a,b)=>a.sequence-b.sequence);
  if(new Set(rows.map(r=>r.sequence)).size!==rows.length)throw Error('Ambiguous duplicate reservation chronology');
  let previous=null;
  for(const r of rows)if(r.milliseconds!==null){if(previous!==null&&r.milliseconds<previous)throw Error('Reservation sequence contradicts timestamps');previous=r.milliseconds;}
  return rows.at(-1).attempt;
}
export function selectCandidate(c,attempts){
  const strict=original(c.paired,c.id,c.profile);
  if(strict)return {mode:'strict paired',row:strict,attempt:null,status:strict.status};
  const raw=latestAttempt(attempts.filter(a=>a.id===c.id&&a.profile===c.profile));
  if(!raw)return {mode:'unattempted / missing',row:null,attempt:null,status:'missing'};
  if(!['paired','unpaired'].includes(raw.mode))throw Error('Unknown raw mode');
  const row=original(raw.outcome,c.id,c.profile);
  return {mode:raw.mode==='paired'?'raw paired':'unpaired raw',row,attempt:raw,status:row?.status??'pending / no original native row'};
}
export function strictRatio(main,candidate,mode,source){
  const unavailable=reason=>({value:null,reason});
  if(mode!=='strict paired')return unavailable('Raw/unpaired scores use their own heldouts; no comparable gain.');
  if(!main||!candidate||main.status!=='finished'||candidate.status!=='finished'||!accountedOutcome(main)||!accountedOutcome(candidate))return unavailable('Both original rows must be successful and accounted.');
  if(main.heldoutEvidence?.complete!==true||candidate.heldoutEvidence?.complete!==true)return unavailable('Complete independent heldout evidence is required on both sides.');
  if(main.provenanceSha256!==source.baselineProvenanceSha256||candidate.provenanceSha256!==source.pairedProvenanceSha256||candidate.referenceEvidence?.provenanceSha256!==main.provenanceSha256||candidate.referenceEvidence?.resultFingerprint!==fingerprint(main)||candidate.referenceEvidence?.evaluationSha256!==main.evaluationSha256)return unavailable('Immutable reference binding differs.');
  if(!main.frames?.length||main.frames.length!==candidate.frames?.length||main.frames.some((f,i)=>f.time!==candidate.frames[i].time||f.referenceSha256!==candidate.frames[i].referenceSha256))return unavailable('Scored source frames/reference hashes differ.');
  if(!Number.isFinite(main.mean?.ssim)||!Number.isFinite(candidate.mean?.ssim)||!Number.isFinite(main.mean?.laplacian)||main.mean.laplacian<=0||!Number.isFinite(candidate.mean?.laplacian)||candidate.mean.laplacian<0)return unavailable('No finite comparable sharpness denominator/scores.');
  return {value:candidate.mean.laplacian/main.mean.laplacian,reason:'Source snapshot verified strict paired successes with identical scored references; per-case diagnostic only.'};
}
export function timings(row){
  const censored=!row||row.status!=='finished'||!accountedOutcome(row);
  return {censored,firstViewMs:censored?null:row.firstViewMs??null,bakeMs:censored?null:row.bakeMs??null,peakRssBytes:row?.peakRssBytes??null,originalRecorded:{firstViewMs:row?.firstViewMs??null,bakeMs:row?.bakeMs??null,peakRssBytes:row?.peakRssBytes??null},notice:censored?'Incomplete/rejected timing is censored; original recorded values remain in raw evidence.':'Original successful recorded timing; nonphysical software-GPU viewport profile.'};
}
export function tableData(report){
  if(report.cases?.length!==40||new Set(report.cases.map(c=>c.id+'/'+c.profile)).size!==40||report.manifest?.length!==20||report.manifest.some(c=>profiles.some(p=>!report.cases.some(r=>r.id===c.id&&r.profile===p))))throw Error('All20 captures × both profiles required');
  const rows=[];
  for(const clip of report.manifest)for(const profile of profiles){
    const c=report.cases.find(c=>c.id===clip.id&&c.profile===profile),main=original(c.main,c.id,c.profile),selected=selectCandidate(c,report.attempts??[]),candidate=selected.row;
    if(main&&!same(main,report.baseline.run.results.find(r=>r.id===clip.id&&r.profile===profile)))throw Error('Main original row differs from captured run');
    if(selected.mode==='strict paired'&&!same(candidate,report.candidate?.run.results.find(r=>r.id===clip.id&&r.profile===profile)))throw Error('Strict original row differs from captured master');
    rows.push({id:clip.id,profile,mainStatus:main?.status??'missing',candidateMode:selected.mode,candidateStatus:selected.status,selectedAttempt:selected.attempt?.name??null,chronology:selected.attempt?'Captured reservation ordinal, checked against available actual timestamps; latest pending is retained.':null,
      mainTiming:timings(main),candidateTiming:timings(candidate),mainSsim:main?.mean?.ssim??null,candidateSsim:candidate?.mean?.ssim??null,mainLaplacian:main?.mean?.laplacian??null,candidateLaplacian:candidate?.mean?.laplacian??null,sharpnessRatio:strictRatio(main,candidate,selected.mode,report.source),originalMainRow:main,originalCandidateRow:candidate,
      raw:selected.mode==='strict paired'?report.candidate.cases[clip.id+'/'+profile]?.copy+'/result.json.gz':selected.attempt?.outcome.originalRow?selected.attempt.copy+'/'+clip.id+'-'+profile+'/result.json.gz':null});
  }return rows;
}
export function markdown(report,rows,rawBase='.'){
  if(rawBase.startsWith('/workspace')||/^(file|javascript|data):/i.test(rawBase)||/[<>"\s]/.test(rawBase))throw Error('Unsafe/workspace publication URL');
  const fmt=(v,d=1)=>Number.isFinite(v)?(v/d).toPrecision(5):'—';
  const time=(x,k)=>x.censored?'censored':fmt(x[k],1000),pair=(r,k)=>time(r.mainTiming,k)+' → '+time(r.candidateTiming,k);
  const lines=['# Native R12 outcomes: all20 clips at both profiles','',`Source report captured ${report.captureStartedAt} to ${report.captureFinishedAt}; native source ${report.source.productCommit}.`,'','The table prefers an existing original strict paired-master row, including failed rows. Otherwise it displays the latest captured raw reservation, labeled raw paired or unpaired raw. A later pending attempt remains pending; an older favorable result never replaces it. Every attempt remains preserved in the original report and causes addendum.','', 'Raw/unpaired absolute SSIM uses its own heldout frames and is not a comparable gain. Sharpness ratios appear only for source-verified strict paired successes with identical references. No raw row is promoted into strict gates. Incomplete/rejected timing is censored; RSS is an original recorded peak, not an acceptance gate. Main → R12 timing uses seconds; RSS uses MiB.','',report.timingLimit??'Software-GPU viewport profiles are not physical-device measurements.',''];
  for(const p of profiles){
    lines.push('## '+p,'','| Clip | Main outcome | R12 mode / original outcome | First3D s main → R12 | Bake s main → R12 | RSS MiB main → R12 | Main SSIM | R12 absolute SSIM | Strict sharpness ratio | Original R12 evidence |','|---|---|---|---:|---:|---:|---:|---:|---:|---|');
    for(const r of rows.filter(r=>r.profile===p))lines.push(`| ${plain(r.id)} | ${plain(r.mainStatus)} | ${plain(r.candidateMode)} / ${plain(r.candidateStatus)} | ${pair(r,'firstViewMs')} | ${pair(r,'bakeMs')} | ${fmt(r.mainTiming.peakRssBytes,1048576)} → ${fmt(r.candidateTiming.peakRssBytes,1048576)} | ${fmt(r.mainSsim)} | ${fmt(r.candidateSsim)} | ${r.sharpnessRatio.value===null?'—':fmt(r.sharpnessRatio.value)+'×'} | ${r.raw?`[original](${rawBase.replace(/\/$/,'')}/${r.raw})`:'No original row'} |`);
    lines.push('');
  }
  lines.push('Strict comparator completion and gates are preserved unchanged in strict-comparison.json.gz. Per-case ratios do not establish corpus acceptance. Full original rows, failed timing values, all earlier attempts and heldout provenance remain in source-report.json.gz.','');return lines.join('\n');
}
export function generate({report:source,out,rawBase='.'}){
  const destination=path.resolve(out??'');if(!source||!out||fs.existsSync(destination)||!destination.startsWith('/workspace/v3d-r4-media/')||['final-r12-report-preparation-r1','causes-addendum-r1'].some(n=>destination.startsWith('/workspace/v3d-r4-media/'+n+'/')))throw Error('Fresh additive outside-kit output required');
  const stored=fs.readFileSync(source),bytes=gunzipSync(stored),report=JSON.parse(bytes),directory=path.dirname(source),freeze=JSON.parse(fs.readFileSync(path.join(directory,'snapshot-freeze.json')));
  if(report.kind!=='source-bound-CPU-snapshot-diagnostic-not-acceptance'||freeze.reportSha256!==sha(bytes)||fs.existsSync(path.join(directory,'REJECTED.json')))throw Error('Captured report/source SHA differs');
  const comparisonStored=fs.readFileSync(path.join(directory,'strict-comparison.json.gz')),comparison=JSON.parse(gunzipSync(comparisonStored));
  if(!same(comparison,report.comparison)||freeze.files.find(f=>f.path==='strict-comparison.json.gz')?.sha256!==sha(comparisonStored))throw Error('Original strict gates differ');
  const rows=tableData(report),text=markdown(report,rows,rawBase);fs.mkdirSync(destination,{recursive:true});
  fs.writeFileSync(path.join(destination,'native-outcomes.md'),text,{flag:'wx'});fs.writeFileSync(path.join(destination,'source-report.json.gz'),stored,{flag:'wx'});fs.writeFileSync(path.join(destination,'strict-comparison.json.gz'),comparisonStored,{flag:'wx'});
  const data={capturedAt:report.captureFinishedAt,source:report.source,rows,notice:'Presentation selection only. Original strict gates unchanged; raw/unpaired scores are absolute diagnostics with their own heldouts; incomplete timing censored.'},rawData=Buffer.from(JSON.stringify(data,null,2)+'\n'),packed=gzipSync(rawData,{level:9,mtime:0});if(!gunzipSync(packed).equals(rawData))throw Error('Lossless table data failed');fs.writeFileSync(path.join(destination,'table-data.json.gz'),packed,{flag:'wx'});
  const receipt={createdAt:new Date().toISOString(),source:path.resolve(source),sourceStoredSha256:sha(stored),sourceOriginalSha256:sha(bytes),sourceCaptureFinishedAt:report.captureFinishedAt,rows:rows.length,perProfile:profiles.map(profile=>({profile,rows:rows.filter(r=>r.profile===profile).length,modes:rows.filter(r=>r.profile===profile).reduce((counts,r)=>(counts[r.candidateMode]=(counts[r.candidateMode]??0)+1,counts),{})})),originalStrictComparisonStoredSha256:sha(comparisonStored),gatesUnchanged:true,rawRowsPromotedToStrict:0,sourceBytesUnchanged:true,rawLinkBase:rawBase,files:[{file:'native-outcomes.md',sha256:sha(Buffer.from(text))},{file:'table-data.json.gz',sha256:sha(packed),restoredSha256:sha(rawData)}]};fs.writeFileSync(path.join(destination,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return receipt;
}
if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename){const options={};for(const a of process.argv.slice(2)){const m=/^--(report|out|raw-base)=(.+)$/.exec(a);if(!m)throw Error('Use --report=CAPTURED/report.json.gz --out=FRESH [--raw-base=.]');options[m[1]==='raw-base'?'rawBase':m[1]]=m[2];}console.log(JSON.stringify(generate(options),null,2));}
