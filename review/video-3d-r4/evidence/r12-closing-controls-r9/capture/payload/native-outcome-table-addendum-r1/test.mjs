// MIT. CPU-only UNIT-TEST fixtures and immutable real snapshot reads; no native work.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {latestAttempt,selectCandidate,strictRatio,timings,tableData,markdown,original} from './generate.mjs';
const source='/workspace/v3d-r4-media/final-r12-report-preparation-r1/snapshot-partial-verification-0001/report.json.gz';
const report=JSON.parse(gunzipSync(fs.readFileSync(source)));
const clone=x=>structuredClone(x);
const row=(status='finished')=>({id:'UNIT-TEST',profile:'phone',status,firstViewMs:100,bakeMs:200,peakRssBytes:300,mean:{ssim:.6,laplacian:.1}});
const metric=r=>({status:r?.status??'missing',...(r?{originalRow:r}:{})});
const candidate=paired=>({id:'UNIT-TEST',profile:'phone',paired:metric(paired)});
const attempt=(n,mode,r,extra={})=>({name:String(n).padStart(3,'0')+'-UNIT-TEST-phone-'+mode,id:'UNIT-TEST',profile:'phone',mode,outcome:metric(r),controllerState:{reservedAt:`2026-10-15T14:00:${String(n).padStart(2,'0')}Z`,...extra}});
test('genuine unpaired finished row is displayed when strict row is absent',()=>{
  const r=row(),a=attempt(1,'unpaired',r),s=selectCandidate(candidate(null),[a]);assert.equal(s.mode,'unpaired raw');assert.equal(s.status,'finished');assert.equal(s.row,r);
});
test('latest pending reservation stays pending and never uses older favorable score',()=>{
  const old=attempt(1,'unpaired',row()),pending=attempt(2,'paired',null),s=selectCandidate(candidate(null),[pending,old]);
  assert.equal(s.mode,'raw paired');assert.equal(s.row,null);assert.match(s.status,/pending/);assert.equal(s.attempt,pending);
});
test('strict row wins even when failed and a later raw row succeeded',()=>{
  const failed=row('harness-error'),s=selectCandidate(candidate(failed),[attempt(2,'unpaired',row())]);assert.equal(s.mode,'strict paired');assert.equal(s.row,failed);
});
test('raw selection is score independent and independent of array ordering',()=>{
  const a=attempt(1,'unpaired',row()),b=attempt(2,'paired',row('explained'));assert.equal(latestAttempt([b,a]),b);a.outcome.originalRow.mean.ssim=1;assert.equal(latestAttempt([a,b]),b);
});
test('missing timestamps never release a newer pending sequence',()=>{
  const a=attempt(1,'unpaired',row()),b=attempt(2,'paired',null);b.controllerState={};assert.equal(latestAttempt([a,b]),b);
});
test('ambiguous or contradictory chronology fails instead of choosing a favorable row',()=>{
  const a=attempt(1,'unpaired',row()),b=attempt(2,'paired',null,{reservedAt:'2026-10-15T13:00:00Z'});assert.throws(()=>latestAttempt([a,b]),/contradicts/);assert.throws(()=>latestAttempt([a,a]),/duplicate/);assert.throws(()=>latestAttempt([{...a,name:'NO-SEQUENCE'}]),/sequence/);
});
test('missing, status-mismatched and identity-mismatched outcomes cannot become finished',()=>{
  assert.equal(selectCandidate(candidate(null),[]).status,'missing');assert.throws(()=>original({status:'finished'},'UNIT-TEST','phone'));assert.throws(()=>original({status:'finished',originalRow:row('timeout')},'UNIT-TEST','phone'));assert.throws(()=>original(metric(row()),'WRONG','phone'));
});
test('failed/pending timing is censored while original recorded values stay intact',()=>{
  const x=row('harness-error'),t=timings(x);assert.equal(t.censored,true);assert.equal(t.firstViewMs,null);assert.equal(t.bakeMs,null);assert.equal(t.originalRecorded.firstViewMs,100);assert.equal(t.peakRssBytes,300);assert.equal(timings(null).censored,true);assert.equal(timings(row()).censored,false);
});
const actualCase=report.cases.find(c=>c.main.originalRow?.status==='finished'&&c.paired.originalRow?.status==='finished');
test('actual source-verified strict pair produces only its per-case sharpness ratio',()=>{
  assert.ok(actualCase);const a=actualCase.main.originalRow,b=actualCase.paired.originalRow,g=strictRatio(a,b,'strict paired',report.source);assert.equal(g.value,b.mean.laplacian/a.mean.laplacian);
});
test('raw/unpaired/mismatched/failed/incomplete evidence never gets a gain',()=>{
  const a=actualCase.main.originalRow,b=actualCase.paired.originalRow;
  for(const mode of ['raw paired','unpaired raw'])assert.equal(strictRatio(a,b,mode,report.source).value,null);
  for(const change of [r=>r.status='harness-error',r=>r.referenceEvidence.resultFingerprint='0'.repeat(64),r=>r.frames[0].referenceSha256='0'.repeat(64),r=>r.heldoutEvidence.complete=false]){const x=clone(b);change(x);assert.equal(strictRatio(a,x,'strict paired',report.source).value,null);}
});
test('actual partial snapshot yields exactly20rows/profile without changing strict gates',()=>{
  const before=JSON.stringify(report.comparison),rows=tableData(report);assert.equal(rows.length,40);assert.equal(rows.filter(r=>r.profile==='phone').length,20);assert.equal(rows.filter(r=>r.profile==='desktop').length,20);assert.equal(JSON.stringify(report.comparison),before);
  assert.ok(rows.some(r=>r.candidateMode==='unpaired raw'));assert.ok(rows.every(r=>r.candidateMode==='strict paired'||r.sharpnessRatio.value===null));
});
test('table clearly labels absolute raw scores, censorship and nonphysical timing',()=>{
  const text=markdown(report,tableData(report),'.');assert.match(text,/own heldout/);assert.match(text,/censored/);assert.match(text,/4-core/);assert.match(text,/## phone/);assert.match(text,/## desktop/);assert.throws(()=>markdown(report,tableData(report),'/workspace/not-public'));
});
