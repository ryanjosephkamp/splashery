"""MIT. Preserve the completed single review invocation and expose only verified captures."""
import datetime as dt, gzip, hashlib, html, json
from pathlib import Path
from PIL import Image
r=Path('/workspace/v3d-r4-media');out=Path('/workspace/splashery-r4-clips-public/review/video-3d-r4/reviews/candidate-r12-unranked-r9')
sha=lambda b:hashlib.sha256(b).hexdigest()
esc=lambda s:html.escape(str(s),quote=True)
control=r/'review-r12-r3-control';source=r/'review-r12-r1'
# A completed controller outcome or a naturally exited no-render watcher is required.
launch=json.loads((r/'review-r12-r3-root-launch.json').read_text())
proc=Path('/proc')/str(launch['pid'])/'stat'
if proc.exists():
 fields=proc.read_text().rsplit(')',1)[1].split()
 assert fields[19]!=launch['startTicks'] or fields[0] in ('Z','X','x'),'Review watcher still live; do not copy mutable output.'
assert not out.exists();out.mkdir(parents=True)
files=[]
def capture(path,relative):
 b=path.read_bytes();target=out/'payload'/relative;original=str(relative)
 archive=path.suffix=='.log' or path.suffix=='.json' or (path.suffix.lower() in ('.png','.jpg','.jpeg') and len(b)>1000000)
 if archive:target=target.with_name(target.name+'.gz');stored=gzip.compress(b,compresslevel=9,mtime=0);assert gzip.decompress(stored)==b
 else:stored=b
 target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(stored)
 assert path.read_bytes()==b and target.read_bytes()==stored
 files.append({'originalPath':original,'storedPath':str(target.relative_to(out)),'bytes':len(b),'sha256':sha(b),'storedSha256':sha(stored),'gzip':archive})
 return str(target.relative_to(out))
report=None;captured=[];cards=[]
if source.exists():
 report=json.loads((source/'review.json').read_text());assert report['profile']=='phone' and report['selection']['ranked'] is False
 for case in report['cases']:
  folder=source/(case['id']+'-phone')
  if case['status']=='captured':
   assert json.loads((folder/'receipt.json').read_text())==case
   for f in case['files']:assert sha((folder/f['file']).read_bytes())==f['sha256']
   assert (folder/'poster.jpg').stat().st_size<=1000000
   assert json.loads((folder/'verification.json').read_text())==case['verification']
   assert len(case['verification'])==2
   assert report['provenance']['toolSha256']==sha((Path('/workspace/splashery-v3d-bench-tools-r12/tools/v3d-review.mjs')).read_bytes())=='35ec88c4c384dd1e845760fd0e0e8c5c561aae2021cd28ecd2eb8868d4e2b7c7'
   for version,verified in zip(report['provenance']['versions'],case['verification']):
    assert version['name']==verified['version']
    directory=Path(version['directory']);run=json.loads((directory/'run.json').read_text())
    row=next(x for x in run['results'] if x['id']==case['id'] and x['profile']=='phone')
    assert len(row['frames'])==len(verified['frames']) and len(verified['frames'])>0
    for index,(original,observed) in enumerate(zip(row['frames'],verified['frames'])):
     image=directory/(case['id']+'-phone')/('render-'+str(index)+'.png')
     assert observed['index']==index and observed['time']==original['time']
     assert observed['savedSha256']==original['renderSha256']==sha(image.read_bytes())
     with Image.open(image) as png:assert observed['rgbaSha256']==sha(png.convert('RGBA').tobytes())
     assert len(observed['replaySha256'])==64 and all(ch in '0123456789abcdef' for ch in observed['replaySha256'])
   captured.append(case['id'])
 assert len(captured)==report['capturedClips']
 before={str(p.relative_to(source)):sha(p.read_bytes()) for p in source.rglob('*') if p.is_file()}
 for p in sorted(source.rglob('*')):
  assert not p.is_symlink()
  if p.is_file():capture(p,Path('review')/p.relative_to(source))
 assert before=={str(p.relative_to(source)):sha(p.read_bytes()) for p in source.rglob('*') if p.is_file()}
 for case in report['cases']:
  clip=case['clip'];folder='payload/review/'+case['id']+'-phone'
  if case['id'] in captured:media=f'<video controls playsinline preload="metadata" poster="{folder}/poster.jpg" src="{folder}/comparison.mp4"></video><p><a href="{folder}/attribution.txt">Full attribution</a></p>'
  else:media='<pre>'+esc(case.get('reason','No completed capture receipt.'))+'</pre>'
  cards.append('<article><h2>'+esc(clip['label'])+'</h2><p>Unranked · '+esc(case['status'])+'</p>'+media+'<p>'+esc(clip['author'])+' · <a href="'+esc(clip['licenseUrl'])+'">'+esc(clip['license'])+'</a> · <a href="'+esc(clip['source'])+'">Source</a></p></article>')
for name in ['result.json','launch.json','render.log','owned-render-state.json','events.jsonl','quiet-state.json','plan.json','root-timed-work-receipt.json','root-takeover-receipt.json','declaration.json']:
 p=control/name
 if p.exists():capture(p,Path('control')/name)
for name in ['review-r12-r3-root-launch.json','queue-r12-review-r3.py','plan-r12-review-r3.mjs','publish-closing-review-r9.py']:
 capture(r/name,Path('control')/name)
index='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>R12 verified paired review</title><style>body{font:16px system-ui;background:#171717;color:#eee;max-width:820px;margin:24px auto;padding:0 16px}a{color:#9bd0ff}video{width:100%;max-width:784px}pre{white-space:pre-wrap}article{margin:32px 0}</style><h1>R12 paired review</h1><p>'+str(len(captured))+' completed verified phone comparisons. Available pairs are selected in manifest order and remain unranked. Missing or failed captures do not satisfy the ten-clip request. Exact saved held-out pixels must match before capture; movies show replay, not native device speed.</p>'+''.join(cards)
(out/'index.html').write_text(index+'\n')
summary={'publishedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'capturedClips':len(captured),'capturedIds':captured,'ranked':False,'sourceReviewExists':source.exists(),'allCopiedOriginalBytesVerified':True,'files':files,'notice':'Original bytes are preserved in payload, with lossless gzip where marked. The public index is a separate derived gallery that embeds only cases whose original completed receipts and listed artifact hashes verified. Partial movies are retained but never embedded as completed.'}
(out/'publication.json').write_text(json.dumps(summary,indent=2)+'\n')
(out/'README.md').write_text('# Closing R12 paired review\n\nMIT code. Made by Ryan with Codex (GPT-6). [Open the actual gallery](index.html). '+str(len(captured))+' verified phone comparisons finished. They are unranked, selected from available strict pairs in manifest order. Missing, failed, and interrupted cases cannot satisfy the requested ten movies or full-corpus best/worst ranking.\n\nThe original report, source-bound receipts, failures, partial files, and controller outcome are retained in `payload`. `publication.json` maps every original SHA-256 and path to its stored bytes. Decode marked gzip files with Python gzip.decompress and verify the original hash. No original row, score, render, or assertion was rewritten. Each derived asset retains its source license; the actual gallery and per-clip attribution name that source.\n\nRule check: none.\n')
print(json.dumps({'destination':str(out),'capturedClips':len(captured),'ids':captured,'files':len(files)}))
