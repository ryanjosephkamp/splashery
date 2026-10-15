"""MIT. Publish the completed, independently decoded-pixel-verified sample cohort."""
import datetime as dt, gzip, hashlib, json, shutil
from pathlib import Path
r=Path('/workspace/v3d-r4-media');packet=r/'final-r12-report-preparation-r1/snapshot-partial-verification-0001'
source=packet/'sample-cohorts/postmerge-2773';target=Path('/workspace/splashery-r4-clips-public/review/video-3d-r4/evidence/postmerge-samples-r9')
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha((packet/'snapshot-freeze.json').read_bytes())=='586313d63d5bdd53447c41a5151b3db0acb67244c214645cfb00e0fd00296e16'
cohorts=json.loads(gzip.decompress((packet/'sample-cohorts.json.gz').read_bytes()));cohort=next(x for x in cohorts if x['name']=='postmerge-2773')
assert cohort['status']=='completed-and-independently-pixel-verified' and cohort['cases']==12 and cohort['views']==74
assert all(f['pixelIdentical'] for f in cohort['frames']) and len(cohort['frames'])==74
assert not target.exists()
def inventory(folder):
 rows=[]
 for p in sorted(folder.rglob('*')):
  assert not p.is_symlink()
  if p.is_file():
   b=p.read_bytes();rows.append({'file':str(p.relative_to(folder)),'bytes':len(b),'sha256':sha(b)})
 return rows
before=inventory(source)
for entry in json.loads((source/'restore-map.json').read_text()):
 b=(source/entry['storedRelativePath']).read_bytes();assert sha(b)==entry['storedSha256']
 original=gzip.decompress(b)
 assert sha(original)==entry['originalSha256'] and len(original)==entry['originalBytes']
shutil.copytree(source,target);assert before==inventory(source)==inventory(target)
(target/'root-publication.json').write_text(json.dumps({'publishedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'sourcePartialSnapshotFreezeSha256':sha((packet/'snapshot-freeze.json').read_bytes()),'sourceCohort':cohort,'copiedFiles':before,'notice':'Original cohort directory copied exactly after all stored/restored hashes verified. The partial native corpus capture is not promoted; this completed sample source remains separate.'},indent=2)+'\n')
print(json.dumps({'target':str(target),'files':len(before),'bytes':sum(x['bytes'] for x in before),'sampleViews':74}))
