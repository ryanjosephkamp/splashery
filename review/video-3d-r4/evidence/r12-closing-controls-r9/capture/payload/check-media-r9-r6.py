"""MIT. Run a fresh whole-media formatting check before closing native publication."""
import datetime as dt, hashlib, json, subprocess, time
from pathlib import Path
r=Path('/workspace/v3d-r4-media');w=Path('/workspace/splashery-r4-clips-public');start=dt.datetime.fromisoformat('2026-10-15T16:03:00+00:00')
while dt.datetime.now(dt.timezone.utc)<start:time.sleep(1)
files=[w/'review/video-3d-r4/README.md',w/'.prettierignore'];sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();covered={str(p.relative_to(w)):sha(p) for p in files}
assert covered['review/video-3d-r4/README.md']=='ec2f353c458d93594911298c2878102754161d33ebb3b387c5cdfb53f47ade88'
assert covered['.prettierignore']=='1fc792bd64febb4ce971b9f4fa7356a8da7ed04c0ac1ccd17e2f0d6ee61f2a8a'
log=Path('/tmp/v3d-r4-media-r9-prettier-r6.log');started=dt.datetime.now(dt.timezone.utc).isoformat()
with log.open('wb') as output:result=subprocess.run(['npx','prettier','--check','.'],cwd=w,stdout=output,stderr=subprocess.STDOUT,timeout=540)
assert covered=={str(p.relative_to(w)):sha(p) for p in files}
receipt={'startedAt':started,'observedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'command':'npx prettier --check .','cwd':str(w),'exitCode':result.returncode,'log':str(log),'logSha256':sha(log),'coveredFiles':covered,'notice':'Fresh whole-repository check before the final native packet push. All later proof payloads are under the unchanged ignored evidence/reviews paths.'}
out=r/'media-r9-prettier-r6-receipt.json';assert not out.exists();out.write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps(receipt),flush=True)
assert result.returncode==0
