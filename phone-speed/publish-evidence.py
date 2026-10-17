from pathlib import Path
import hashlib,json,datetime,shutil
source=Path('/workspace/splashery/.cache/phone-speed')
destination=Path('/workspace/phone-speed-clips/phone-speed')
excluded={'RESUME.md','publication-console.log'}
count=0
for path in source.rglob('*'):
    if not path.is_file():continue
    relative=path.relative_to(source)
    if str(relative) in excluded or '__pycache__' in relative.parts:continue
    target=destination/relative
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(path,target)
    count+=1
shutil.copy2('/workspace/splashery/CREDITS.md','/workspace/phone-speed-clips/CREDITS.md')
records=[]
for path in sorted(destination.rglob('*')):
    if not path.is_file() or path.name in {'SHA256SUMS','publication.json'}:continue
    digest=hashlib.file_digest(path.open('rb'),'sha256').hexdigest()
    records.append({'path':str(path.relative_to(destination)),'bytes':path.stat().st_size,'sha256':digest})
(destination/'SHA256SUMS').write_text(''.join(r['sha256']+'  '+r['path']+'\n' for r in records))
receipt={'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'copiedFiles':count,'indexedFiles':len(records),'bytes':sum(r['bytes'] for r in records),'files':records}
(destination/'publication.json').write_text(json.dumps(receipt,indent=2)+'\n')
print(json.dumps({k:v for k,v in receipt.items() if k!='files'}))
