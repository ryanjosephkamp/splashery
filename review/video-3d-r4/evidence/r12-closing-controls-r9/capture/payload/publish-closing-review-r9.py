"""MIT. Preserve one ended review invocation; expose only source-bound verified captures."""
import datetime as dt, gzip, hashlib, html, importlib.util, json, subprocess
from pathlib import Path
r=Path('/workspace/v3d-r4-media');out=Path('/workspace/splashery-r4-clips-public/review/video-3d-r4/reviews/candidate-r12-unranked-r9/capture')
sha=lambda b:hashlib.sha256(b).hexdigest()
esc=lambda s:html.escape(str(s),quote=True)
control=r/'review-r12-r3-control';source=r/'review-r12-r1'
spec=importlib.util.spec_from_file_location('quiet',r/'queue-r12-review-r3.py');q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
launch=q.read(r/'review-r12-r3-root-launch.json');watcher={k:launch[k] for k in ('pid','startTicks','command')}
actual=q.process_identity(watcher['pid']);assert not q.is_unresolved(actual) and not q.same_live(watcher,actual),'Review watcher still live or unresolved.'
render=q.read(control/'launch.json') if (control/'launch.json').exists() else None
owned_evidence={'observedAt':q.now().isoformat(),'watcherObservation':actual,'renderReserved':render is not None,'signalsSentByPublisher':[]}
if render:
 assert (control/'result.json').exists(),'A reserved render needs its actual controller outcome before publication.'
 assert render.get('pid') and render.get('startTicks'),'Reserved renderer was not identity-bound; root must reconcile it.'
 bindings=[{'pid':render['pid'],'startTicks':render['startTicks'],'command':render['command']}]
 if (control/'owned-render-state.json').exists():bindings+=q.read(control/'owned-render-state.json')['observedBindings']
 owned=q.Watch(bindings,read_only=True);live=owned.refresh()
 assert not live and not q.watch_unresolved(owned),'Owned renderer/descendants still live or unresolved.'
 graphics=q.scan_graphics_blockers();assert not graphics['observations'] and not graphics['enumerationUnresolved'],'Global graphics remains live or unresolved; do not copy possibly mutable output.'
 owned_evidence.update(ownedBindings=list(owned.seen.values()),ownedLive=live,ownedUnresolved=q.unresolved_state(owned),globalGraphicsAtPublication=graphics,controllerOutcome=q.read(control/'result.json'))
# The controller has ended and cannot spawn future work. Reject an unbound orphan writer too.
possible_writers=[]
for p in Path('/proc').iterdir():
 if not p.name.isdigit():continue
 x=q.process_identity(int(p.name))
 assert not q.is_unresolved(x),'Process observation unresolved during publication preflight.'
 if x and x.get('state') not in ('Z','X','x') and str(source) in x.get('command',[]) and str(q.REVIEW) in x.get('command',[]):possible_writers.append(x)
assert not possible_writers,'A review writer remains active.'
report=q.read(source/'review.json') if (source/'review.json').is_file() else None
preflight=None;preflight_error=None;captured=[]
if report:
 try:
  checked=subprocess.run([q.NODE,str(r/'verify-closing-review-r9.mjs'),str(source),str(control/'plan.json')],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=25)
 except subprocess.TimeoutExpired as error:
  as_text=lambda value:value.decode(errors='replace') if isinstance(value,bytes) else value or ''
  preflight_error={'returncode':None,'timeoutSeconds':25,'stdout':as_text(error.stdout),'stderr':as_text(error.stderr),'notice':'Publication verification exceeded its closing CPU budget. Original output is retained, and no movie is advertised as verified.'}
 else:
  if checked.returncode==0:
   preflight=json.loads(checked.stdout);captured=[x['id'] for x in preflight['captured']]
  else:preflight_error={'returncode':checked.returncode,'stdout':checked.stdout,'stderr':checked.stderr,'notice':'No captured movie is advertised when source-bound publication verification rejects the report. Original evidence remains unchanged.'}
assert not out.exists();out.mkdir(parents=True)
files=[]
def capture(path,relative):
 b=path.read_bytes();target=out/'payload'/relative;original=str(relative)
 archive=path.suffix in ('.log','.json','.jsonl','.html','.txt') or (path.suffix.lower() in ('.png','.jpg','.jpeg') and len(b)>1000000)
 if archive:target=target.with_name(target.name+'.gz');stored=gzip.compress(b,compresslevel=9,mtime=0);assert gzip.decompress(stored)==b
 else:stored=b
 target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(stored)
 assert path.read_bytes()==b and target.read_bytes()==stored
 files.append({'originalPath':original,'storedPath':str(target.relative_to(out)),'bytes':len(b),'sha256':sha(b),'storedSha256':sha(stored),'gzip':archive})
 return str(target.relative_to(out))
cards=[]
if source.exists():
 before={str(p.relative_to(source)):sha(p.read_bytes()) for p in source.rglob('*') if p.is_file()}
 for p in sorted(source.rglob('*')):
  assert not p.is_symlink()
  if p.is_file():capture(p,Path('review')/p.relative_to(source))
 assert before=={str(p.relative_to(source)):sha(p.read_bytes()) for p in source.rglob('*') if p.is_file()}
if report:
 for case in report.get('cases',[]):
  clip=case['clip'];folder='payload/review/'+case['id']+'-phone'
  if case['id'] in captured:media=f'<video controls playsinline preload="metadata" poster="{folder}/poster.jpg" src="{folder}/comparison.mp4"></video><p><a href="{folder}/attribution.txt.gz">Original full attribution</a></p>'
  else:media='<pre>'+esc(case.get('reason') or ('Publication verification rejected this report.' if preflight_error else 'No completed verified capture receipt.'))+'</pre>'
  cards.append('<article><h2>'+esc(clip['label'])+'</h2><p>Unranked · original status: '+esc(case['status'])+'</p>'+media+'<p>'+esc(clip['author'])+' · <a href="'+esc(clip['licenseUrl'])+'">'+esc(clip['license'])+'</a> · <a href="'+esc(clip['source'])+'">Source</a></p></article>')
for name in ['result.json','launch.json','render.log','owned-render-state.json','events.jsonl','quiet-state.json','plan.json','root-timed-work-receipt.json','root-takeover-receipt.json','declaration.json']:
 p=control/name
 if p.exists():capture(p,Path('control')/name)
for name in ['review-r12-r3-root-launch.json','queue-r12-review-r3.py','plan-r12-review-r3.mjs','publish-closing-review-r9.py','verify-closing-review-r9.mjs']:
 capture(r/name,Path('control')/name)
index='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>R12 verified paired review</title><style>body{font:16px system-ui;background:#171717;color:#eee;max-width:820px;margin:24px auto;padding:0 16px}a{color:#9bd0ff}video{width:100%;max-width:784px}pre{white-space:pre-wrap}article{margin:32px 0}</style><h1>R12 paired review</h1><p>'+str(len(captured))+' completed verified phone comparisons. Available pairs are selected in manifest order and remain unranked. Missing or failed captures do not satisfy the ten-clip request. Exact saved held-out pixels must match before capture; movies show replay, not native device speed.</p>'+''.join(cards)
if not report:index+='<p>No complete review report was produced. Any partial output is retained in payload; it cannot establish a completed movie.</p>'
if preflight_error:index+='<p>Publication verification rejected the report. No movie is advertised as verified; the rejection and original evidence are retained.</p>'
(out/'index.html').write_text(index+'\n')
summary={'publishedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'capturedClips':len(captured),'capturedIds':captured,'ranked':False,'sourceReviewExists':source.exists(),'sourceReportExists':report is not None,'ownedEndObservation':owned_evidence,'preflight':preflight,'preflightRejection':preflight_error,'allCopiedOriginalBytesVerified':True,'files':files,'notice':'Original bytes are preserved in payload, with lossless gzip where marked. The public gallery embeds only completed source-bound receipts and artifact hashes that verify. Saved PNG/RGBA hashes verify the exact-replay receipt; missing replay PNGs are not independently decoded. Partial files remain retained and unadvertised.'}
(out/'publication.json').write_text(json.dumps(summary,indent=2)+'\n')
(out/'README.md').write_text('# Closing R12 paired review\n\nMIT code. Made by Ryan with Codex (GPT-6). [Open the actual gallery](index.html). '+str(len(captured))+' verified phone comparisons finished. They are unranked, selected from available strict pairs in manifest order. Missing, failed, and interrupted cases cannot satisfy the requested ten movies or full-corpus best/worst ranking.\n\nOriginal reports, source-bound receipts, failures, partial files, and controller outcomes are retained in `payload`. `publication.json` maps every original SHA-256 and path to stored bytes and records any publication rejection. Decode marked gzip files with Python gzip.decompress and verify the original hash. Saved PNG/RGBA hashes are checked against the frozen exact-replay receipts; replay PNGs were not persisted and are not independently decoded here. No original row, score, render, or assertion was rewritten. Each derived asset retains its source license; the actual gallery and per-clip attribution name that source.\n\nRule check: none.\n')
print(json.dumps({'destination':str(out),'capturedClips':len(captured),'ids':captured,'files':len(files),'preflightRejected':preflight_error is not None}))
