"""MIT. Update the product audit from the actual immutable closing native report."""
import datetime as dt, hashlib, json, re
from pathlib import Path
r=Path('/workspace/v3d-r4-media');p=Path('/workspace/splashery-r4-public/docs/audits/video-3d-r4-2026-10.md')
source=r/'final-r12-report-preparation-r1/snapshot-1615'
assert not (source/'REJECTED.json').exists()
s=json.loads((source/'summary.json').read_text());g=json.loads((source/'gates.json').read_text())
main=json.loads((r/'main-review-stage-boundary-r1/control/result.json').read_text())
assert s['label']=='1615-cutoff-observation'
assert all(c['cases']==12 and c['views']==74 and c['status']=='completed-and-independently-pixel-verified' for c in s['sampleCohorts'])
backup=r/'audit-before-closing-r9.md';assert not backup.exists();original=p.read_bytes();backup.write_bytes(original);text=original.decode()
media='https://github.com/ryanjosephkamp/splashery/blob/codex/video-3d-r4-clips/review/video-3d-r4/'
packet=media+'evidence/final-r12-report-r9/'
opening=f'''# Video to 3D on real clips: task 88

**The complete acceptance goal was not established within the bounded run.** Codex started on
October 15, 2026, at 04:32:25 UTC, with a hard limit of 16:32:25 UTC. The final native snapshot
finished capture at {s['capturedAt']}. The baseline remains task-start main `95da2ddb`.
Code lives on `codex/video-3d-r4`; footage, bakes, receipts, and review media live on
`codex/video-3d-r4-clips`, which must never be merged.

Frozen revision 12 is `64ec9ad5b7a90b590b289f6a02f0bbd50138db08`, served-source SHA-256
`6d362ff52101541719cc6b639d48b394630113fa61b3467ddbecb78dbe8742b8`. The closing capture retains
{s['mainRows']}/40 main rows, {s['pairedMasterRows']}/40 strict paired rows, and all {s['rawAttempts']} raw reservations:
{s['rawRecordedRows']} recorded rows, including {s['unpairedRows']} unpaired rows, and {len(s['rawPending'])} pending or interrupted reservations.
An unpaired result, saved model, host timeout, or missing row cannot establish acceptance.

Both revision 12 and the separate replay after normally merging main preserved all 74 sample views
exactly across the six samples and both profiles, without recorded browser errors. Their actual
processes completed with exit code zero; the final reporting kit independently decoded all rendered
pixels against main. This checks existing bakes and viewer behavior, rather than retraining samples.

The branch merged main `cb8a8315` normally as `2773a1c4`. Video to 3D modules, pack, and splatjs
still match frozen revision 12 exactly. The separate merged-app replay has source fingerprint
`5a27ac17adddd2f86b69c3295e8c4e3f747109b94f46c78a733ec5e7f7d450c8`; it never relabels the native
cohort. All 285 original specs were byte-audited: 266 match task-start main, nineteen match normally
merged main, and none was modified by this task. Latest full CI records 2,914 passes, five failures,
and one existing skip across 341 spec files. Every original failure remains counted.

The [closing evidence index]({packet}CLOSING-INDEX.md) links the exact original rows, all forty
outcomes, recorded causes and advice, unchanged machine gates, the offline dashboard, samples, CI,
and the actual review record. Earlier sections below retain explicitly labeled experiments and
negative results; the closing R12 tables supersede older primary results.

'''
heading='## Revision 12: validation-constrained environment color'
text=opening+heading+text.split(heading,1)[1]
fmt=lambda x:format(x,'.6g') if isinstance(x,(int,float)) else 'unavailable'
results=['## Results','','The following primary tables come from the final immutable R12 snapshot. Failed and rejected timings remain censored. Raw results retain their original outcomes and cannot enter strict comparison.','','| Profile | Strict scored pairs | Diagnostic sharpness ratio | Diagnostic SSIM median change | Complete coverage | Quality gate | Phone timing gate |','|---|---:|---:|---:|---|---|---|']
for profile in ['phone','desktop']:
 q=g['profiles'][profile];results.append(f"| {profile} | {q['pairedMeasurable']} | {fmt(q['sharpnessGain'])} | {fmt(q['ssimGain'])} | {str(q['coverage']).lower()} | {str(q['quality']).lower()} | {str(q['noSlower']).lower() if profile=='phone' else 'not applicable'} |")
results+=['','These subset medians are diagnostic, not corpus acceptance. Dropping a successful main reconstruction cannot earn a gain. Desktop has no comparable completed quality baseline. The original comparator leaves incomplete phone median and worst timing unavailable; individual faster bakes cannot recover that gate. The never-fails gate is also unmet. The software-GPU host and overlapping work do not establish isolated or physical-phone speed.','']
def publish_links(markdown):
 def link(match):
  value=match.group(1)
  if re.match(r'https?://',value):return match.group(0)
  assert not value.startswith(('/', '../','file:','javascript:')),value
  return ']('+packet+value.removeprefix('./')+')'
 return re.sub(r'\]\(([^)]+)\)',link,markdown)
native=(r/'native-outcomes-r12-final-r1/native-outcomes.md').read_text()
native=native.split('\n',1)[1].replace('\n## phone\n','\n### Phone\n').replace('\n## desktop\n','\n### Desktop\n')
causes=(r/'causes-r12-final-r1/failures-causes.md').read_text().split('\n',1)[1]
causes=re.sub(r'^## ', '### ', causes, flags=re.M)
results+=[publish_links(native),'','### Explanations and incomplete attempts','',publish_links(causes),'']
text=text[:text.index('## Results')]+ '\n'.join(results)+'\n'+text[text.index('## Samples and regressions'):]
ci=f'''The latest complete full-suite run for head `db81b107` tested GitHub merge
`b1179daf26dfd8ac81ed804d875eb55402e50adb`: all sixteen original shards completed, covering 341
spec files and 2,920 tests, with 2,914 passes, five failures, and one existing skip. The retained
[original logs and summary]({media}evidence/ci-db81-r9/README.md) count `spg:138` and `img-engine:85`
as timeouts, plus `man5:201` (shipped PDF), `smoke:881` (stretchy toy), and `live5:63` (video audio).
None is a Video to 3D spec, but the requirement that every existing spec pass remains unmet.
The final audit-only commit does not change runtime or test bytes. No assertion, threshold, or skip
was weakened, and no isolated passing rerun waives an original failure.

'''
text=text.replace('## Full-suite results\n\n','## Full-suite results\n\n'+ci,1)
render_launch=r/'review-r12-r3-control/launch.json'
if render_launch.exists():
 launch=json.loads(render_launch.read_text())
 capture_status='The queue has an actual render reservation; the closing record preserves its original launch and controller result.'
else:
 capture_status='At this audit generation, no render reservation was recorded. That is zero established current movies; any later capture must have its own original launch, controller result, and publication verification.'
review=f'''## Review media

The R3 queue was authorized at 14:22 UTC to launch at most one batch after 16:15 UTC and only after
all five bound timed roots, their observed descendants, and global graphics work cease.
{capture_status} It retains the exact held-out replay guards and asks
for up to ten verified phone pairs in manifest order, independent of scores. Each pane is 390 by
844 pixels, with five source seconds at 12 fps. The
[actual review record]({media}reviews/candidate-r12-unranked-r9/README.md) determines how many
movies completed and passed publication verification. A reservation, partial movie, or failed replay
does not count. Complete-corpus five-best/five-worst ranking is unavailable because paired coverage
is incomplete; every published current comparison remains explicitly unranked.

The first watcher exited on a process-identity validation error before capture. Its error and all
262 historical bindings remain. Root's first takeover attempt stopped before signaling. R2 was
prepared but never launched. R3 used the actual observed-ended root receipt, retained historical
bindings, and added the separate postmerge sample controller. All 80 CPU guard controls passed,
including the original 46 controls and their 102 assertions. Unresolved process reads and unrelated
graphics work block rendering. The review watcher never owns or signals timed bakes.

The execution service later lost its foreground sessions before closing capture. Root independently
observed the two CPU-only publication waiters exited with raw kernel signal 9, empty logs, and no
capture or publication. Their original launch receipts and explicit external exit observations remain
intact. Fresh detached CPU-only generations restored publication; no native bake, review guard,
benchmark row, per-case budget, or replay check was restarted or changed.

The separately declared baseline stage boundary at 16:15 UTC recorded
`stageInterrupted={str(main['stageInterrupted']).lower()}`, with {len(main['termSent'])} original-main identities sent TERM and
{len(main['killSent'])} sent KILL. This outer orchestration change does not alter any per-case host budget,
benchmark row, score, or status. Affected and unattempted work stays incomplete. The
[closing controls]({media}evidence/r12-closing-controls-r9/README.md) preserve actual outcomes,
failed preparation attempts, source-bound authorization, raw R12 history, and interrupted artifacts.
Rendering has its own absolute 16:31:30 UTC end; no new native cohort or source experiment follows.

Source attribution accompanies every actual movie. Publication validates original source, row and
case inventories, held-out saved PNG/RGBA replay receipts, camera times, artifact hashes, and encoded
movie metadata. The earlier r3 movie remains a separate 2 fps diagnostic and cannot satisfy this
round's ten-clip request.

'''
text=text[:text.index('## Review media')]+review+text[text.index('## Supplemental evaluation of stored timeout models'):]
text=text.replace('Final counts and any failures will be recorded here after the runs finish.','The closing sections above record the final native capture and latest complete CI; these earlier failures remain preserved.')
p.write_text(text)
receipt={'writtenAt':dt.datetime.now(dt.timezone.utc).isoformat(),'sourceSnapshot':str(source),'sourceSummarySha256':hashlib.sha256((source/'summary.json').read_bytes()).hexdigest(),'originalAuditSha256':hashlib.sha256(original).hexdigest(),'generatedAuditSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'notice':'Generated from actual closing evidence only. Existing historical negative experiments remain intact. Run unchanged whole-repository formatting and English checks before pushing.'}
(r/'closing-audit-generation-r9.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt))
