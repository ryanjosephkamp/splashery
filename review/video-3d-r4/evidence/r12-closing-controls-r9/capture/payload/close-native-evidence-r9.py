"""MIT. Wait read-only for the declared cutoff, then capture and check closing evidence."""
import datetime as dt, hashlib, json, os, subprocess, time, traceback
from pathlib import Path
r=Path('/workspace/v3d-r4-media');control=r/'closing-native-publication-r9-control';control.mkdir(exist_ok=False)
node='/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node'
product=Path('/workspace/splashery-r4-public');cutoff=dt.datetime.fromisoformat('2026-10-15T16:15:00+00:00')
now=lambda:dt.datetime.now(dt.timezone.utc)
def write(name,value):
 p=control/name;temp=p.with_name(p.name+'.tmp');temp.write_text(json.dumps(value,indent=2)+'\n');temp.replace(p)
write('launch.json',{'startedAt':now().isoformat(),'pid':os.getpid(),'cutoffUtc':cutoff.isoformat(),'scriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'notice':'CPU-only publication. No browser, native launch, process signal, benchmark rewrite, or push. Waits for ended native orchestration and the actual review guard quiet observation.'})
steps=[]
def run(name,argv,cwd=r,timeout=180):
 started=now().isoformat();log=control/(name+'.log')
 write('state.json',{'at':started,'step':name,'completedSteps':steps})
 with log.open('wb') as output:result=subprocess.run(argv,cwd=cwd,stdout=output,stderr=subprocess.STDOUT,timeout=timeout)
 receipt={'step':name,'startedAt':started,'finishedAt':now().isoformat(),'argv':argv,'cwd':str(cwd),'returncode':result.returncode,'logSha256':hashlib.sha256(log.read_bytes()).hexdigest()}
 steps.append(receipt);write('steps.json',steps);print(json.dumps(receipt),flush=True)
 if result.returncode:raise RuntimeError(name+' failed; original output and partial files retained.')
try:
 while True:
  at=now();ready=False
  if at>=cutoff and (r/'main-review-stage-boundary-r1/control/result.json').is_file():
   events=[json.loads(line) for line in (r/'follow-r12-v1-control/events.jsonl').read_text().splitlines() if line.strip()]
   quiet=json.loads((r/'review-r12-r3-control/quiet-state.json').read_text())
   ready=any(event.get('event')=='continuation-finished' for event in events) and not quiet['liveBindings'] and not quiet['unresolved'] and dt.datetime.fromisoformat(quiet['at'])>=cutoff
  if ready:break
  if at>=dt.datetime.fromisoformat('2026-10-15T16:18:00+00:00'):raise RuntimeError('Native end/quiet evidence was not ready by the capture preparation limit; no unsafe snapshot or invented outcome.')
  time.sleep(1)
 # Allow the existing baseline collector to finish its next read-only alias update.
 time.sleep(6)
 write('readiness.json',{'observedAt':now().isoformat(),'quietObservation':quiet,'mainStageResult':json.loads((r/'main-review-stage-boundary-r1/control/result.json').read_text()),'r12ContinuationFinished':True})
 kit=r/'final-r12-report-preparation-r1';snapshot=kit/'snapshot-1615'
 run('01-capture',[node,str(kit/'report.mjs'),'--out='+str(snapshot),'--label=1615-cutoff-observation'])
 run('02-verify',[node,str(kit/'verify.mjs'),str(snapshot)])
 run('03-native-tables',[node,str(r/'native-outcome-table-addendum-r1/generate.mjs'),'--report='+str(snapshot/'report.json.gz'),'--out='+str(r/'native-outcomes-r12-final-r1'),'--raw-base=.'])
 run('04-causes',[node,str(r/'causes-addendum-r1/render-causes.mjs'),'--report='+str(snapshot/'report.json.gz'),'--out='+str(r/'causes-r12-final-r1'),'--raw-base=.'])
 run('05-publish',['python',str(r/'publish-final-r12-report-r9.py')])
 run('06-audit',['python',str(r/'update-closing-audit-r9.py')])
 run('07-format-audit',['npx','prettier','--write','docs/audits/video-3d-r4-2026-10.md'],cwd=product)
 run('08-product-prettier',['npx','prettier','--check','.'],cwd=product,timeout=480)
 run('09-product-english',[node,'tools/us-english.mjs','--diff'],cwd=product)
 run('10-product-whitespace',['git','diff','--check'],cwd=product)
 write('result.json',{'finishedAt':now().isoformat(),'status':'completed','steps':steps,'notice':'Actual final snapshot published and product audit checked. No push performed; root must verify and publish only concrete completed results.'})
except BaseException as error:
 write('failure.json',{'at':now().isoformat(),'error':repr(error),'traceback':traceback.format_exc(),'completedSteps':steps,'notice':'Original logs and partial outputs remain. No row, assertion, timeout, or result was rewritten to recover this publication.'})
 raise
