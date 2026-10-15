"""MIT. Publish the fresh closing snapshot and additive presentations without changing raw proof."""
import datetime as dt, gzip, hashlib, json, math, re, shutil, subprocess
from pathlib import Path
r=Path('/workspace/v3d-r4-media');kit=r/'final-r12-report-preparation-r1';source=kit/'snapshot-1615';target=Path('/workspace/splashery-r4-clips-public/review/video-3d-r4/evidence/final-r12-report-r9')
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha((kit/'preparation-freeze.json').read_bytes())=='282b68a06de7ea96bd7fce9389d5d3420196001287e08fbff6867025d1621858'
assert not (source/'REJECTED.json').exists();assert not target.exists()
node='/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node'
verified=subprocess.run([node,str(kit/'verify.mjs'),str(source)],check=True,capture_output=True,text=True)
summary=json.loads((source/'summary.json').read_text());gates=json.loads((source/'gates.json').read_text())
assert summary['label']=='1615-cutoff-observation' and summary['source']['productCommit']=='64ec9ad5b7a90b590b289f6a02f0bbd50138db08'
assert summary['source']['servedSourceSha256']=='6d362ff52101541719cc6b639d48b394630113fa61b3467ddbecb78dbe8742b8'
def inventory(folder):
 result=[]
 for p in sorted(folder.rglob('*')):
  assert not p.is_symlink()
  if p.is_file():
   b=p.read_bytes();result.append({'file':str(p.relative_to(folder)),'bytes':len(b),'sha256':sha(b)})
 return result
before=inventory(source)
# Validate every late dependency before creating the final destination. A failed
# preflight leaves the source and original failed evidence available for review.
additive_hashes={}
checked_additions=[]
source_report=(source/'report.json.gz').read_bytes();source_original_sha=sha(gzip.decompress(source_report))
for folder,receipt_name in [(r/'native-outcomes-r12-final-r1','native-outcomes-receipt.json'),(r/'causes-r12-final-r1','failures-causes-receipt.json')]:
 payload={p.name:p.read_bytes() for p in sorted(folder.iterdir()) if p.is_file()}
 assert len(payload)==len(list(folder.iterdir())),'Unexpected nested additive output.'
 receipt=json.loads(payload['receipt.json']);assert receipt['sourceStoredSha256']==sha(source_report);assert receipt['sourceBytesUnchanged'] is True
 assert receipt['sourceOriginalSha256']==source_original_sha and receipt['sourceCaptureFinishedAt']==summary['capturedAt']
 assert payload['source-report.json.gz']==source_report
 if receipt_name=='native-outcomes-receipt.json':
  assert set(payload)=={'receipt.json','native-outcomes.md','table-data.json.gz','source-report.json.gz','strict-comparison.json.gz'}
  assert receipt['rows']==40 and receipt['gatesUnchanged'] is True and receipt['rawRowsPromotedToStrict']==0
  assert [row['file'] for row in receipt['files']]==['native-outcomes.md','table-data.json.gz']
  for row in receipt['files']:
   assert sha(payload[row['file']])==row['sha256'],'Additive output differs from its original receipt.'
   if 'restoredSha256' in row:assert sha(gzip.decompress(payload[row['file']]))==row['restoredSha256']
  original_comparison=(source/'strict-comparison.json.gz').read_bytes()
  assert payload['strict-comparison.json.gz']==original_comparison
  assert receipt['originalStrictComparisonStoredSha256']==sha(original_comparison)
 else:
  assert set(payload)=={'receipt.json','failures-causes.md','source-report.json.gz'}
  assert receipt['statusesUnchanged'] is True and receipt['sourceCommit']==summary['source']['productCommit']
  assert receipt['outputSha256']==sha(payload['failures-causes.md']),'Cause output differs from its original receipt.'
 for p in sorted(folder.iterdir()):
  assert p.is_file();name=receipt_name if p.name=='receipt.json' else p.name;existing=source/name;b=payload[p.name]
  if existing.exists():assert existing.read_bytes()==b,'Conflicting additive proof: '+name
  digest=sha(b)
  if name in additive_hashes:assert additive_hashes[name]==digest,'Conflicting addenda: '+name
  additive_hashes[name]=digest
  checked_additions.append((p,name,b))
for dependency in ['evidence/postmerge-samples-r9/README.md','evidence/ci-db81-r9/README.md','evidence/r12-closing-controls-r9/README.md','reviews/candidate-r12-unranked-r9/README.md']:
 assert (target.parent.parent/dependency).is_file(),dependency
assert (source/'inputs/report-code/storage.mjs').is_file() and not (source/'inputs/report-code/verify.mjs').exists()
shutil.copytree(source,target);assert before==inventory(source)==inventory(target)
additions=[]
for p,name,b in checked_additions:
 assert p.read_bytes()==b,'Validated additive source changed before publication.'
 out=target/name
 if out.exists():assert out.read_bytes()==b,'Refuse to overwrite a different original proof: '+name
 else:out.write_bytes(b)
 assert out.read_bytes()==b;additions.append({'source':str(p),'publishedName':name,'sha256':sha(b),'bytes':len(b)})
for p,name,b in checked_additions:assert p.read_bytes()==b,'Validated additive source changed during publication.'
verifier=target/'inputs/report-code/verify.mjs';assert not verifier.exists();assert (verifier.parent/'storage.mjs').is_file()
verifier_bytes=(kit/'verify.mjs').read_bytes();verifier.write_bytes(verifier_bytes);assert verifier.read_bytes()==verifier_bytes
additions.append({'source':str(kit/'verify.mjs'),'publishedName':str(verifier.relative_to(target)),'sha256':sha(verifier_bytes),'bytes':len(verifier_bytes)})
for row in before:assert sha((target/row['file']).read_bytes())==row['sha256']
fmt=lambda value:format(value,'.6g') if isinstance(value,(int,float)) and math.isfinite(value) else '—'
lines=['# Closing R12 evidence','',f"Captured {summary['capturedAt']} under the original twelve-hour bound. **The full acceptance goal is not established.**",'', '[All forty native outcomes](native-outcomes.md) · [Recorded causes and advice](failures-causes.md) · [Offline dashboard](index.html) · [Original full report](report.md) · [Unchanged machine gates](gates.json) · [Original snapshot instructions](README.md).','',f"Main has {summary['mainRows']}/40 captured rows. The strict paired master has {summary['pairedMasterRows']}/40. All {summary['rawAttempts']} raw attempts are preserved separately: {summary['rawRecordedRows']} recorded rows, {summary['unpairedRows']} unpaired recorded rows, and {len(summary['rawPending'])} pending or interrupted reservations. Raw results never enter strict gates merely because a model exists.",'','| Profile | Strict scored pairs | Partial-pair sharpness ratio | Partial-pair SSIM median change | Quality gate | Timing gate |','|---|---:|---:|---:|---|---|']
for profile in ['phone','desktop']:
 q=gates['profiles'][profile];lines.append(f"| {profile} | {q['pairedMeasurable']} | {fmt(q['sharpnessGain'])} | {fmt(q['ssimGain'])} | {str(q['quality']).lower()} | {str(q['noSlower']).lower()} |")
lines+=['','Partial-pair medians are diagnostic. Missing coverage, failed reference guards, or dropped baseline successes prevent a corpus pass. Incomplete timing remains censored. RSS is sampled aggregate browser memory, not GPU RAM or an acceptance gate.','',f"Frozen native source: `{summary['source']['productCommit']}`, served-source SHA-256 `{summary['source']['servedSourceSha256']}`. The separate merged-app sample replay does not relabel this cohort.",'','| Sample cohort | Cases | Views | Actual verification |','|---|---:|---:|---|']
for cohort in summary['sampleCohorts']:lines.append(f"| {cohort['name']} | {cohort['cases']} | {cohort['views']} | {cohort['status']} |")
lines+=['','[Post-merge sample proof](../postmerge-samples-r9/README.md) · [Latest full CI](../ci-db81-r9/README.md) · [Closing controls](../r12-closing-controls-r9/README.md) · [Actual paired review record](../../reviews/candidate-r12-unranked-r9/README.md).','', 'The latest complete CI retains 341 original shard spec files: 2,914 passes, five failures, and one existing skip. Failed assertions remain counted. No original project assertion, threshold, or skip was weakened by this report.','', 'The host provides a four-core CPU quota and SwiftShader software graphics. Phone and desktop are viewport profiles under overlapping host work. These observations do not establish physical-device or isolated timing gains.','', 'Verify copied and losslessly restored bytes with `node inputs/report-code/verify.mjs .`. Every copied source byte was checked before and after publication. The original snapshot freeze and restoration maps remain usable; new presentation receipts have distinct names and do not overwrite original proof. Raw logs, telemetry, and oversized images retain exact bytes through lossless archives. Source licenses and attribution remain in the captured manifest and credits.','', 'Rule check: none.']
index='\n'.join(lines)+'\n';(target/'CLOSING-INDEX.md').write_text(index)
for link in re.findall(r'\]\(([^)]+)\)',index):
 assert not link.startswith(('file:','javascript:'))
 if not re.match(r'https?://',link):assert (target/link).is_file(),link
report={'publishedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'source':str(source),'sourceSnapshotFreezeSha256':sha((source/'snapshot-freeze.json').read_bytes()),'allOriginalSnapshotBytesVerified':True,'sourceFiles':before,'additivePresentations':additions,'restorationVerifierOutput':json.loads(verified.stdout),'notice':'The frozen snapshot stays unchanged. All copied source files remain exact; added causes/native tables preserve source statuses and unchanged strict gates. Renamed additive receipts avoid overwriting each other.'}
(target/'root-publication.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'target':str(target),'sourceFiles':len(before),'sourceBytes':sum(x['bytes'] for x in before),'mainRows':summary['mainRows'],'strictRows':summary['pairedMasterRows'],'rawAttempts':summary['rawAttempts'],'gatesComplete':gates['complete']}))
