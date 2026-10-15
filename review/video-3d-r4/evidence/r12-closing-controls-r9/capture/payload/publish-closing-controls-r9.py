"""MIT. Freeze ended orchestration controls with exact original-byte restoration maps."""
import datetime as dt, gzip, hashlib, json
from pathlib import Path
r=Path('/workspace/v3d-r4-media');target=Path('/workspace/splashery-r4-clips-public/review/video-3d-r4/evidence/r12-closing-controls-r9/capture')
review_publication=Path('/workspace/splashery-r4-clips-public/review/video-3d-r4/reviews/candidate-r12-unranked-r9/capture/publication.json')
assert review_publication.exists(),'Publish only after the review end-state was checked.'
assert (r/'main-review-stage-boundary-r1/control/result.json').exists(),'Baseline boundary outcome is still pending.'
native_control=r/'closing-native-publication-r9-r2-control'
assert (native_control/'result.json').is_file() or (native_control/'failure.json').is_file(),'Closing native publication controller is still running.'
events=[json.loads(line) for line in (r/'follow-r12-v1-control/events.jsonl').read_text().splitlines() if line.strip()]
assert any(row.get('event')=='continuation-finished' for row in events),'R12 coordinator finalization is still pending.'
assert not target.exists()
sha=lambda b:hashlib.sha256(b).hexdigest()
folders=['review-r12-r1-control','review-r12-r2-control','review-r12-r3-control','main-review-stage-boundary-r1','review-publication-preflight-r9','causes-addendum-r1','native-outcome-table-addendum-r1','follow-r12-v1-control','closing-native-publication-r9-control','closing-native-publication-r9-r2-control','closing-media-publication-r9-control']
files=['queue-r12-review-r1.py','queue-r12-review-r2.py','queue-r12-review-r3.py','test-queue-r12-review-r1.py','test-queue-r12-review-r2.py','test-queue-r12-review-r3.py','plan-r12-review-r1.mjs','plan-r12-review-r2.mjs','plan-r12-review-r3.mjs','bind-r12-review-r3-root.py','review-r12-r1-exit-observation-r1.json','review-r12-r3-actual-root-receipt.json','review-r12-r3-actual-takeover-receipt.json','review-r12-r3-root-observations.json','review-r12-r3-root-launch.json','publish-closing-review-r9-initial.py','publish-closing-review-r9.py','verify-closing-review-r9.mjs','publish-postmerge-samples-r9.py','publish-postmerge-samples-r9-initial.py.gz','publish-postmerge-samples-r9-initial-error.json','publish-closing-controls-r9.py','media-r9-prettier-r1-receipt.json','media-r9-prettier-r2-receipt.json','original-spec-byte-audit-r4/receipt.json','deduplicate-immutable-evidence-r1.py','immutable-evidence-storage-dedup-r1.json.gz','immutable-evidence-storage-dedup-r1-verification.json']
selected={}
files.append('media-r9-prettier-r3-receipt.json')
files.extend(['media-r9-prettier-r4-receipt.json','publish-final-r12-report-r9.py','update-closing-audit-r9.py','closing-audit-generation-r9.json','audit-before-closing-r9.md','build-final-pr-body-r9.py'])
files.append('viljandi-heldout-visual-observation-r1.json')
files.append('close-native-evidence-r9.py')
files.append('check-media-r9-r6.py')
files.append('check-media-r9-r7.py')
files.append('complete-closing-media-r9.py')
files.extend(['close-native-evidence-r9-r2.py','complete-closing-media-r9-r2.py','closing-publication-exec-service-exits-r1.json','closing-publication-r2-detached-launch.json'])
files.append('independent-closing-verification-r9.json')
files.append('git-publication-transport-r9.json')
for name in folders:
 folder=r/name
 assert folder.is_dir(),folder
 for p in sorted(folder.rglob('*')):
  assert not p.is_symlink()
  if p.is_file() and '__pycache__' not in p.parts:selected[str(p.relative_to(r))]=p
for name in files:
 p=r/name;assert p.is_file(),p;selected[name]=p
for p in sorted(r.glob('media-r9-prettier-r*-receipt.json')):
 selected[p.name]=p
 receipt=json.loads(p.read_text());log=Path(receipt['log']) if receipt.get('log') else None
 if log and log.is_file():selected['root-logs/'+log.name]=log
for name in ['v3d-r4-review-r12-queue-r1.log','v3d-r4-review-r12-queue-r3.log','v3d-r4-main-stage-boundary-r1.log','v3d-r4-media-r9-prettier-r2.log','v3d-r4-media-r9-prettier-r3.log','v3d-r4-media-r9-prettier-r4.log','v3d-r4-media-r9-english-r1.log']:
 p=Path('/tmp')/name
 if p.is_file():selected['root-logs/'+name]=p
# Retain interrupted native artifacts as artifacts only. A PLY without a recorded
# native row remains incomplete and never enters the strict comparison.
report=json.loads(gzip.decompress((r/'final-r12-report-preparation-r1/snapshot-1615/report.json.gz').read_bytes()))
partial_directories=[]
for attempt in report['attempts']:
 source=Path(attempt['source']);assert source.parent==r/'candidate-r12-v1-shards'
 for name in attempt['unlistedCaseDirectories']:
  assert name==Path(name).name
  partial_directories.append(source/name)
for name in ['main-r1','main-desktop-r1','main-phone-r2','main-desktop-r2']:
 source=r/name;run=json.loads((source/'run.json').read_text())
 recorded={row['id']+'-'+row['profile'] for row in run['results']}
 for folder in sorted(source.iterdir()):
  if folder.is_dir() and folder.name not in recorded and folder.name.endswith(('-phone','-desktop')):partial_directories.append(folder)
for folder in partial_directories:
 assert folder.is_dir() and not folder.is_symlink()
 for p in sorted(folder.rglob('*')):
  assert not p.is_symlink()
  if p.is_file():selected['interrupted-native-partials/'+str(p.relative_to(r))]=p
 selected['interrupted-native-partials/'+str((folder.parent/'run.json').relative_to(r))]=folder.parent/'run.json'
manifest=Path('/workspace/splashery-v3d-bench-tools-r12/tools/v3d-corpus.json')
selected['interrupted-native-partials/v3d-corpus.json']=manifest
clips={clip['id']:clip for clip in json.loads(manifest.read_text())}
credit_rows=[]
for folder in partial_directories:
 clip_id=folder.name.rsplit('-',1)[0];assert clip_id in clips
 credit_rows.append((str(folder.relative_to(r)),clips[clip_id]))
source_inventory=[{'file':name,'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for name,p in sorted(selected.items())]
target.mkdir(parents=True)
restoration=[]
for row in source_inventory:
 name=row['file'];p=selected[name];b=p.read_bytes();assert sha(b)==row['sha256'] and len(b)==row['bytes']
 archive=p.suffix in ('.json','.jsonl','.log','.md','.txt','.stdout','.stderr') or (p.suffix.lower() in ('.png','.jpg','.jpeg') and len(b)>1000000)
 output=target/'payload'/name
 if archive:output=output.with_name(output.name+'.gz');stored=gzip.compress(b,compresslevel=9,mtime=0);assert gzip.decompress(stored)==b
 else:stored=b
 output.parent.mkdir(parents=True,exist_ok=True);output.write_bytes(stored);assert output.read_bytes()==stored
 restoration.append({'originalPath':name,'storedPath':str(output.relative_to(target)),'originalBytes':len(b),'originalSha256':sha(b),'storedSha256':sha(stored),'gzip':archive})
for row in source_inventory:assert sha(selected[row['file']].read_bytes())==row['sha256'],'Control changed during capture.'
main=json.loads((r/'main-review-stage-boundary-r1/control/result.json').read_text())
movies=json.loads(review_publication.read_text())
restoration_bytes=(json.dumps(restoration,indent=2)+'\n').encode();(target/'restore-map.json.gz').write_bytes(gzip.compress(restoration_bytes,mtime=0));assert gzip.decompress((target/'restore-map.json.gz').read_bytes())==restoration_bytes
summary={'capturedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'files':len(restoration),'originalBytes':sum(x['originalBytes'] for x in restoration),'restorationMapSha256':sha(restoration_bytes),'baselineStageInterrupted':main['stageInterrupted'],'baselineTermSent':main['termSent'],'baselineKillSent':main['killSent'],'verifiedReviewClips':movies['capturedClips'],'interruptedNativeDirectories':[str(p.relative_to(r)) for p in partial_directories],'reviewRanked':False,'allSourceAndStoredBytesVerified':True,'notice':'Original R1 watcher failure and unsuccessful initial publisher drafts remain explicit. R2 was prepared but never launched; R3 used truthful observed-ended takeover, with no root-retirement claim. Only the separately declared main stage controller can own baseline cleanup. No benchmark row, score, per-case timeout, or test was rewritten by publication.'}
(target/'publication.json').write_text(json.dumps(summary,indent=2)+'\n')
cell=lambda value:str(value).replace('|','\\|').replace('\n',' ')
credits=['# Interrupted native asset attribution','','These artifacts remain incomplete and cannot establish a successful reconstruction or score. Images and models retain the corresponding original source license. Reporting and control code is MIT. The exact captured manifest is losslessly stored in payload/interrupted-native-partials/v3d-corpus.json.gz and listed in the restoration map.','','| Original partial directory | Author | Source license | Source |','|---|---|---|---|']
for folder,clip in credit_rows:credits.append('| '+cell(folder)+' | '+cell(clip['author'])+' | ['+cell(clip['license'])+']('+clip['licenseUrl']+') | [Original source]('+clip['source']+') |')
if not credit_rows:credits+=['','No unlisted native case directory existed at this capture.']
credits+=['','Source trims remove audio and scale to 480 pixels high at 24 fps; actual spans and transformation details remain in the original manifest. Derived reconstruction, screenshots, and partial export artifacts add no sharpening, invented camera path, or alternative source licensing.','']
(target/'INTERRUPTED-ASSET-CREDITS.md').write_text('\n'.join(credits))
(target/'README.md').write_text('''# Closing review and baseline controls

MIT code. Made by Ryan with Codex (GPT-6). Interrupted images and models retain their original source licenses and authors in [asset attribution](INTERRUPTED-ASSET-CREDITS.md). `publication.json` records actual closing outcomes. `restore-map.json.gz` maps each original file and SHA-256 to exact stored bytes; decompress marked payload files with Python gzip.decompress and verify originalSha256. Source and destination bytes were checked before and after copying. No raw receipt was formatted or rewritten.

The original R1 watcher exited on a process-observation validation error before a render reservation. Its original failure, queue launch, root exit observation, and all 262 historical identities remain intact. Root's first attempted takeover stopped before any signal. R2 remained unlaunched. R3's actual observed-ended takeover makes no false root-retirement claim, retains historical observations, binds five timed roots including the postmerge sample controller, and treats unresolved or global graphics work as read-only blockers. All 80 CPU guard controls passed before authorization. Preparation variants, failed initial drafts, and actual source-bound receipts remain separately labeled.

The review queue never owns timed bakes. The separate baseline stage boundary was declared during the bounded run for 16:15 UTC, preserving the original per-case host parameter. Its actual result records whether work ended naturally or any retained main-only identities were signaled. Any affected or unattempted case remains incomplete; no timing or quality is recovered. Original R12 coordinator outcomes remain in the final native reporting packet.

The movie publisher requires ended rendering work, retains partial output, and validates original source/version/row/metadata/case inventories, saved PNG/RGBA receipts, camera timelines, artifact hashes, and encoded movie metadata. Replay PNGs are not persisted, so publication does not claim to decode them independently. A source-bound preflight rejection advertises zero verified movies and retains the original rejection and output. The actual gallery determines completed clips; the ten-clip and complete-corpus ranking requests are never inferred from selected IDs.

The complete ended R12 control history includes original attempts, aggregate comparisons, event history, and deadline observations. Interrupted or unlisted native case directories are preserved separately under interrupted-native-partials, with exact original run.json and artifact bytes. Their presence establishes no completed row or recovered score. The additive cause renderer keeps original failures, phases, advice, and missing outcomes separate from raw unpaired diagnostics. Reporting controls do not replace any original project spec or benchmark guard.

The execution service also lost foreground sessions before closing capture. Root's external observation records both CPU-only publication waiters as zombies with raw kernel exit code 9 and empty logs; neither wrote a controller outcome or captured output. Original launch/control files remain unchanged. Fresh detached CPU-only generations restored publication, with separate controls and exact launch identities. No native bake or review guard was restarted or signaled, and no original benchmark or replay guard changed.

Rule check: none.
''')
print(json.dumps({'target':str(target),**summary}))
