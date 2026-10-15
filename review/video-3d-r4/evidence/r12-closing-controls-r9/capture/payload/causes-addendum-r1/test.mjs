// MIT. CPU-only presentation controls; in-memory UNIT-TEST fixtures are not native evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import {shorten,cause,entries,render} from './render-causes.mjs';
function fixture(){
  return {captureStartedAt:'UNIT-TEST',captureFinishedAt:'UNIT-TEST',source:{productCommit:'UNIT-TEST'},baseline:{cases:{}},candidate:{cases:{}},cases:Array.from({length:20},(_,i)=>['phone','desktop'].map(profile=>({id:'UNIT-TEST-'+i,profile,main:{status:'missing'},paired:{status:'missing'}}))).flat(),attempts:[]};
}
test('all40 missing cases stay missing without invented native reason',()=>{const r=entries(fixture());assert.equal(r.length,80);assert.ok(r.every(x=>x.status==='missing'&&x.reason.includes('No original native row')));});
test('actual error diagnostic/advice excerpts are shortened without changing source',()=>{
  const row={status:'explained',reason:'UNIT-TEST original camera failure',explanation:{diagnostic:'UNIT-TEST low overlap',advice:'UNIT-TEST walk slowly'}};const before=JSON.stringify(row),r=cause(row,{status:'explained'});
  assert.equal(r.status,'explained');assert.equal(r.reason,row.reason);assert.equal(r.diagnostic,row.explanation.diagnostic);assert.equal(r.advice,row.explanation.advice);assert.equal(JSON.stringify(row),before);
});
test('long stack is shortened to actual message with no synthetic causal claim',()=>{assert.equal(shorten('Error: UNIT-TEST original message\n    at UNIT-TEST:1'),'Error: UNIT-TEST original message');const x='UNIT-TEST '.repeat(100);assert.ok(shorten(x,50).endsWith('…'));assert.ok(shorten(x,50).length<=51);});
test('status or original identity mismatch fails closed',()=>{
  assert.throws(()=>cause({status:'harness-error'},{status:'finished'}));const r=fixture();r.cases[0].main={status:'explained',originalRow:{id:'WRONG',profile:'phone',status:'explained'}};assert.throws(()=>entries(r),/identity/);
  r.cases[0].main={status:'finished',originalRow:{id:'UNIT-TEST-0',profile:'phone',status:'harness-error'}};assert.throws(()=>entries(r),/status/);
});
test('unpaired and paired raw causes remain explicitly separate',()=>{
  const r=fixture();for(const mode of ['paired','unpaired'])r.attempts.push({id:'UNIT-TEST-0',profile:'phone',mode,name:'UNIT-TEST-'+mode,copy:'evidence/raw/UNIT-TEST-'+mode,outcome:{status:'harness-error',originalRow:{id:'UNIT-TEST-0',profile:'phone',status:'harness-error',reason:'UNIT-TEST original '+mode}}});
  const rows=entries(r);assert.equal(rows.at(-1).label,'R12 unpaired raw');assert.match(rows.at(-2).label,/outside master/);assert.equal(r.cases[0].paired.status,'missing');
});
test('duplicate or incomplete case inventory rejects',()=>{const r=fixture();r.cases.pop();assert.throws(()=>entries(r));const s=fixture();s.cases[1]=s.cases[0];assert.throws(()=>entries(s));});
test('actual raw links stay relative and no workspace URL is invented',()=>{const x=render(fixture(),'.').markdown;assert.ok(x.includes('source-report.json.gz'));assert.ok(!x.includes('/workspace'));assert.throws(()=>render(fixture(),'/workspace/raw'));assert.throws(()=>render(fixture(),'javascript:alert(1)'));});
test('finished outcomes are not relabeled as failures',()=>{const r=fixture();r.cases[0].main={status:'finished',originalRow:{id:'UNIT-TEST-0',profile:'phone',status:'finished'}};assert.equal(entries(r).length,79);});
test('original phase is shown even when timeout message retains an older setup label',()=>{
  const row={status:'harness-error',phase:'evaluation',reason:'Error: UNIT-TEST (setup) exceeded host deadline.'},c=cause(row,{status:'harness-error'});
  assert.equal(c.phase,'evaluation');assert.equal(c.reason,row.reason);
});
