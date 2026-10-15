"""MIT. Check whole-media formatting again after the native evidence push."""
import datetime as dt, hashlib, json, subprocess, time
from pathlib import Path
r=Path('/workspace/v3d-r4-media');w=Path('/workspace/splashery-r4-clips-public');now=lambda:dt.datetime.now(dt.timezone.utc)
proof=r/'media-native-final-push-r9.json'
while not proof.is_file():
 if now()>=dt.datetime.fromisoformat('2026-10-15T16:26:00+00:00'):raise RuntimeError('The native publication push did not finish within the final formatting window.')
 time.sleep(1)
push=json.loads(proof.read_text());assert push['pushExitCode']==0
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip();assert head==push['commit']
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();files=[w/'review/video-3d-r4/README.md',w/'.prettierignore'];covered={str(p.relative_to(w)):sha(p) for p in files}
assert covered==json.loads((r/'media-r9-prettier-r6-receipt.json').read_text())['coveredFiles']
log=Path('/tmp/v3d-r4-media-r9-prettier-r7.log');started=now().isoformat();remaining=(dt.datetime.fromisoformat('2026-10-15T16:30:50+00:00')-now()).total_seconds();assert remaining>0
with log.open('wb') as output:result=subprocess.run(['npx','prettier','--check','.'],cwd=w,stdout=output,stderr=subprocess.STDOUT,timeout=min(540,remaining))
assert covered=={str(p.relative_to(w)):sha(p) for p in files}
assert head==subprocess.check_output(['git','rev-parse','HEAD'],cwd=w,text=True).strip()
receipt={'startedAt':started,'observedAt':now().isoformat(),'command':'npx prettier --check .','cwd':str(w),'exitCode':result.returncode,'afterPublishedHead':head,'log':str(log),'logSha256':sha(log),'coveredFiles':covered,'notice':'Fresh whole-repository check after the final native packet push and before the actual review/control push. Later ignored proof payloads do not change covered text.'}
out=r/'media-r9-prettier-r7-receipt.json';assert not out.exists();out.write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt),flush=True);assert result.returncode==0
