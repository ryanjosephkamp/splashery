"""MIT. Share identical immutable binary copies; retain every path and original byte."""
import datetime as dt, gzip, hashlib, json, os, shutil, uuid
from pathlib import Path
r=Path('/workspace/v3d-r4-media');record=r/'immutable-evidence-storage-dedup-r1.json.gz';assert not record.exists()
roots=[r/name for name in ['publication-r8-r1','publication-r8-r1-restoration-check','final-r12-report-preparation-r1/snapshot-partial-verification-0001','final-r12-report-preparation-r1/restoration-check-partial-0001','main-joined-snapshots','candidate-r10-paired-snapshots-v1','candidate-r11-paired-snapshots-v1','candidate-r12-paired-snapshots-v1']]
roots+=[Path('/workspace/splashery-r4-clips-public/review/video-3d-r4/evidence'),Path('/workspace/splashery-r4-clips-public/review/video-3d-r4/measurements'),Path('/workspace/splashery-r4-clips-public/review/video-3d-r4/samples')]
sha=lambda b:hashlib.sha256(b).hexdigest();seen={};linked=[];skipped=[];count=0;before=shutil.disk_usage(r).free
for root in roots:
 assert root.is_dir(),root
 for p in sorted(root.rglob('*')):
  if p.is_symlink() or p.suffix.lower() not in ('.png','.jpg','.jpeg','.ply','.gz','.mp4','.rgba'):continue
  try:
   if not p.is_file():continue
   b=p.read_bytes();stat=p.stat();key=(len(b),sha(b));count+=1
   representative=seen.get(key)
   if representative is None:seen[key]=p;continue
   try:other=representative.stat()
   except FileNotFoundError:seen[key]=p;continue
   if (stat.st_dev,stat.st_ino)==(other.st_dev,other.st_ino):continue
   assert representative.read_bytes()==b
   temp=p.with_name(p.name+'.dedup-'+uuid.uuid4().hex)
   try:
    os.link(representative,temp)
    # A known immutable binary must still equal the initially captured bytes.
    assert p.read_bytes()==b and temp.read_bytes()==b
    os.replace(temp,p)
    assert sha(p.read_bytes())==key[1] and p.stat().st_ino==representative.stat().st_ino
   finally:
    if temp.exists():temp.unlink()
   linked.append({'path':str(p),'representative':str(representative),'bytes':len(b),'sha256':key[1],'previousInode':stat.st_ino,'sharedInode':p.stat().st_ino,'previousLinkCount':stat.st_nlink,'sameOriginalBytesBeforeAndAfter':True})
  except FileNotFoundError:skipped.append({'path':str(p),'reason':'An independently bounded snapshot collector pruned this duplicate while it was observed; no replacement claimed.'})
report={'finishedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'candidateFilesHashed':count,'linkedFiles':len(linked),'freeBytesBefore':before,'freeBytesAfter':shutil.disk_usage(r).free,'paths':linked,'skipped':skipped,'notice':'Only immutable publication, restoration-check, and completed joined-snapshot binary copies were considered. No source/runtime/protocol/test or original content changed. All logical paths remain regular files with exact original bytes; identical copies now share filesystem storage. No active raw shard, mutable run.json, log, metadata, or source-code file was linked.'}
record.write_bytes(gzip.compress((json.dumps(report,indent=2)+'\n').encode(),compresslevel=9,mtime=0));assert json.loads(gzip.decompress(record.read_bytes()))==report
print(json.dumps({k:v for k,v in report.items() if k not in ('paths','skipped')}))
