// MIT. Made by Ryan with Codex (GPT-6). Additive CPU presentation of recorded causes only.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
const sha=b=>createHash('sha256').update(b).digest('hex');
const plain=v=>String(v??'').replaceAll('|','\\|').replaceAll('\r',' ').replaceAll('\n',' ');
export function shorten(value,limit=360){
  const first=String(value??'').trim().split(/\n\s*(?:at |Traceback|File ")/)[0].replace(/\s+/g,' ');
  if(first.length<=limit)return first;const cut=first.slice(0,limit),last=cut.lastIndexOf(' ');return cut.slice(0,last>limit/2?last:limit)+'…';
}
export function cause(row,metric){
  if(!row)return {status:'missing',phase:null,reason:'No original native row was recorded at capture time.',diagnostic:'',advice:''};
  if(metric?.status!==undefined&&metric.status!==row.status)throw Error('Displayed outcome differs from original status');
  return {status:row.status,phase:row.phase??null,reason:shorten(row.reason||row.explanation?.diagnostic||'No reason text was recorded.'),diagnostic:row.reason&&row.explanation?.diagnostic&&row.reason!==row.explanation.diagnostic?shorten(row.explanation.diagnostic):'',advice:shorten(row.explanation?.advice,240)};
}
export function entries(report){
  if(report.cases?.length!==40||new Set(report.cases.map(c=>c.id+'/'+c.profile)).size!==40)throw Error('All40 unique cases required');
  const out=[];
  for(const c of report.cases)for(const [key,label] of [['main','Main'],['paired','R12 strict paired master']]){
    const metric=c[key],row=metric?.originalRow;if(row&&(row.id!==c.id||row.profile!==c.profile))throw Error('Original row identity differs');
    if(row&&metric.status!==row.status)throw Error('Displayed outcome differs from original status');
    if(metric?.status==='finished')continue;
    const source=key==='main'?report.baseline:report.candidate;
    out.push({id:c.id,profile:c.profile,label,...cause(row,metric),raw:row?source?.cases[c.id+'/'+c.profile]?.copy+'/result.json.gz':null});
  }
  for(const a of report.attempts??[]){
    if(!['paired','unpaired'].includes(a.mode))throw Error('Unknown raw mode');
    if(a.outcome.originalRow&&a.outcome.status!==a.outcome.originalRow.status)throw Error('Raw displayed outcome differs from original status');
    if(a.outcome.status==='finished')continue;
    const row=a.outcome.originalRow;if(row&&(row.id!==a.id||row.profile!==a.profile))throw Error('Raw row identity differs');
    out.push({id:a.id,profile:a.profile,label:a.mode==='unpaired'?'R12 unpaired raw':'R12 paired raw; outside master comparison',shard:a.name,...cause(row,a.outcome),controllerState:a.controllerState?.state??null,raw:row?a.copy+'/'+a.id+'-'+a.profile+'/result.json.gz':a.logCopy??null});
  }return out;
}
export function render(report,rawBase='.'){
  if(rawBase.startsWith('/workspace')||/^(?:file|javascript|data):/i.test(rawBase)||/[<>"\s]/.test(rawBase))throw Error('No workspace or unsafe publication links');
  const rows=entries(report),lines=['# Recorded failure and pending causes','',`Captured native report: ${report.captureStartedAt} to ${report.captureFinishedAt}. Source ${report.source.productCommit}; strict paired evidence remains separate from all unpaired attempts.`,'','These are shortened excerpts of actual recorded reason, diagnostic and advice fields. Ellipses mark shortening. Full original text and original statuses remain unchanged in the source report and raw artifacts. Missing rows have no invented native cause. Explained rejections remain distinct from harness failures. No acceptance, timing recovery or corpus completion is claimed.',''];
  const labels=[...new Set(rows.map(r=>r.label))];
  for(const label of labels){
    lines.push('## '+label,'','| Clip | Profile | Original status | Recorded phase | Recorded reason / diagnostic | Recorded advice | Full raw evidence |','|---|---|---|---|---|---|---|');
    for(const r of rows.filter(r=>r.label===label)){
      const detail=[r.reason,r.diagnostic].filter(Boolean).join(' — ')+(r.controllerState?` [captured controller state: ${r.controllerState}]`:'');
      const link=r.raw?`[original](${rawBase.replace(/\/$/,'')}/${r.raw})`:'[full source report](source-report.json.gz)';
      lines.push(`| ${plain(r.id)}${r.shard?' / '+plain(r.shard):''} | ${plain(r.profile)} | ${plain(r.status)} | ${plain(r.phase)||'Not recorded'} | ${plain(detail)} | ${plain(r.advice)||'No advice recorded.'} | ${link} |`);
    }lines.push('');
  }return {markdown:lines.join('\n'),rows};
}
export function generate({report:source,out,rawBase='.'}){
  if(!source||!out||fs.existsSync(out))throw Error('Original captured report and fresh output required');
  const absolute=path.resolve(out);if(!absolute.startsWith('/workspace/v3d-r4-media/')||absolute.startsWith('/workspace/v3d-r4-media/final-r12-report-preparation-r1/'))throw Error('Keep additive output outside frozen reporting kit and repositories');
  const stored=fs.readFileSync(source),raw=gunzipSync(stored),report=JSON.parse(raw),freeze=JSON.parse(fs.readFileSync(path.join(path.dirname(source),'snapshot-freeze.json')));
  if(report.kind!=='source-bound-CPU-snapshot-diagnostic-not-acceptance'||freeze.reportSha256!==sha(raw)||fs.existsSync(path.join(path.dirname(source),'REJECTED.json')))throw Error('Source snapshot/report binding invalid');
  const rendered=render(report,rawBase);fs.mkdirSync(absolute,{recursive:true});
  fs.writeFileSync(path.join(absolute,'source-report.json.gz'),stored,{flag:'wx'});
  fs.writeFileSync(path.join(absolute,'failures-causes.md'),rendered.markdown,{flag:'wx'});
  const receipt={createdAt:new Date().toISOString(),source:path.resolve(source),sourceStoredSha256:sha(stored),sourceOriginalSha256:sha(raw),sourceCaptureFinishedAt:report.captureFinishedAt,sourceCommit:report.source.productCommit,rawLinkBase:rawBase,rows:rendered.rows.length,sourceBytesUnchanged:true,statusesUnchanged:true,notice:'Additive shortened original excerpts only; no raw/status/score mutations or acceptance claims.',outputSha256:sha(Buffer.from(rendered.markdown))};
  fs.writeFileSync(path.join(absolute,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});return receipt;
}
if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename){
  const options={};for(const a of process.argv.slice(2)){const m=/^--(report|out|raw-base)=(.+)$/.exec(a);if(!m)throw Error('Use --report=CAPTURED/report.json.gz --out=FRESH [--raw-base=.]');options[m[1]==='raw-base'?'rawBase':m[1]]=m[2];}
  console.log(JSON.stringify(generate(options),null,2));
}
