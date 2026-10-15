"""MIT. Publish actual ended review output after the final fresh formatting check."""
import datetime as dt, hashlib, importlib.util, json, os, subprocess, time, traceback
from pathlib import Path
r=Path('/workspace/v3d-r4-media');w=Path('/workspace/splashery-r4-clips-public');control=r/'closing-media-publication-r9-control';control.mkdir(exist_ok=False)
now=lambda:dt.datetime.now(dt.timezone.utc);end=dt.datetime.fromisoformat('2026-10-15T16:32:17+00:00')
spec=importlib.util.spec_from_file_location('quiet',r/'queue-r12-review-r3.py');q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
def write(name,value):
 p=control/name;tmp=p.with_name(p.name+'.tmp');tmp.write_text(json.dumps(value,indent=2)+'\n');tmp.replace(p)
write('launch.json',{'at':now().isoformat(),'pid':os.getpid(),'scriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'absoluteEndUtc':end.isoformat(),'notice':'Publication only; launches no browser or native work, sends no process signals, and changes no original proof. Uses the already authorized single review batch and completed fresh whole-media formatting check.'})
steps=[]
def run(name,argv,timeout=60):
 remaining=(end-now()).total_seconds();assert remaining>0,'Closing publication time expired.'
 log=control/(name+'.log');started=now().isoformat();write('state.json',{'at':started,'step':name})
 with log.open('wb') as out:result=subprocess.run(argv,cwd=w,stdout=out,stderr=subprocess.STDOUT,timeout=min(timeout,remaining))
 item={'name':name,'startedAt':started,'finishedAt':now().isoformat(),'argv':argv,'returncode':result.returncode,'logSha256':hashlib.sha256(log.read_bytes()).hexdigest()};steps.append(item);write('steps.json',steps);print(json.dumps(item),flush=True)
 if result.returncode:raise RuntimeError(name+' failed; original logs and output remain.')
try:
 while True:
  receipt=r/'media-r9-prettier-r7-receipt.json';launch=q.read(r/'review-r12-r3-root-launch.json');binding={k:launch[k] for k in ('pid','startTicks','command')};observation=q.process_identity(binding['pid'])
  native_control=r/'closing-native-publication-r9-control'
  native_ended=(native_control/'result.json').is_file() or (native_control/'failure.json').is_file()
  if receipt.is_file() and native_ended and not q.is_unresolved(observation) and not q.same_live(binding,observation):break
  if now()>=dt.datetime.fromisoformat('2026-10-15T16:31:36+00:00'):raise RuntimeError('Ended review and fresh whole-media formatting evidence did not become ready within the final publication window.')
  time.sleep(1)
 check=q.read(receipt);assert check['exitCode']==0
 for name,digest in check['coveredFiles'].items():assert hashlib.sha256((w/name).read_bytes()).hexdigest()==digest
 assert (w/'review/video-3d-r4/evidence/final-r12-report-r9/root-publication.json').is_file()
 run('01-review',['python',str(r/'publish-closing-review-r9.py')],timeout=35)
 run('02-controls',['python',str(r/'publish-closing-controls-r9.py')],timeout=35)
 review=w/'review/video-3d-r4/reviews/candidate-r12-unranked-r9';movies=q.read(review/'capture/publication.json')
 (review/'README.md').write_text('# Actual closing R12 review\n\n[Verified movie gallery](capture/index.html) · [Exact capture and publication receipts](capture/README.md).\n\n'+str(movies['capturedClips'])+' phone comparisons completed and passed source-bound publication verification. Available pairs are selected in manifest order and remain unranked. Missing, failed, and interrupted captures are retained explicitly and cannot satisfy the ten-clip or complete-corpus best/worst requests. Original output, attribution, partial files, and any verification rejection remain in the capture packet.\n\nRule check: none.\n')
 folder=w/'review/video-3d-r4/evidence/r12-closing-controls-r9';boundary=q.read(folder/'capture/publication.json')
 (folder/'README.md').write_text('# Actual closing R12 controls\n\n[Closing control outcomes and exact restoration map](capture/README.md) · [Immutable authorization inputs](prepared/README.md).\n\nThe ended R3 guard, original failed watcher, separate main-only stage boundary, complete R12 coordinator history, and interrupted native artifacts are retained. The baseline stage reports stageInterrupted='+str(boundary['baselineStageInterrupted']).lower()+'. The actual review publication verifies '+str(boundary['verifiedReviewClips'])+' phone comparisons. This packet changes no original benchmark row, per-case host parameter, score, or test. Asset attribution accompanies interrupted images and models.\n\nRule check: none.\n')
 paths=['review/video-3d-r4/reviews/candidate-r12-unranked-r9','review/video-3d-r4/evidence/r12-closing-controls-r9']
 run('03-stage',['git','add',*paths])
 run('04-english',['node','tools/us-english.mjs','--diff'],timeout=15)
 for name,digest in check['coveredFiles'].items():assert hashlib.sha256((w/name).read_bytes()).hexdigest()==digest
 run('05-commit',['git','commit','-q','-m','evidence: retain actual guarded review and closing controls','--',*paths])
 run('06-push',['git','push','origin','codex/video-3d-r4-clips'],timeout=35)
 head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()
 write('result.json',{'finishedAt':now().isoformat(),'status':'completed','mediaHead':head,'verifiedMovies':movies['capturedClips'],'steps':steps,'notice':'Only actual completed source-bound captures advertised. Draft PR metadata remains root-owned.'})
except BaseException as error:
 write('failure.json',{'at':now().isoformat(),'error':repr(error),'traceback':traceback.format_exc(),'steps':steps,'notice':'Failure retained; no automatic movie recapture, benchmark rewrite, or unsafe retry.'})
 raise
