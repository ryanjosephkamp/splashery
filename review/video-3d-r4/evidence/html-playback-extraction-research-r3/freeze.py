# MIT. Made by Ryan with Codex (GPT-6). Inventory outside-only research evidence.
from pathlib import Path
import hashlib,json,datetime
root=Path(__file__).resolve().parent
hash_file=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
rows=[{'file':str(p.relative_to(root)),'bytes':p.stat().st_size,'sha256':hash_file(p)} for p in sorted(root.rglob('*')) if p.is_file() and p.name!='freeze.json']
result={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'Outside-only immutable R3 one-way exact-prefix/canonical hybrid research. No production/runtime/protocol/controller edits; no integration/acceptance claim. Media retain original per-source licenses in corpus-manifest.json. Own MIT code attribution in LICENSE and README.','inventorySha256':hashlib.sha256(json.dumps(rows,separators=(',',':')).encode()).hexdigest(),'files':rows,'totalBytes':sum(x['bytes'] for x in rows),'maxJpegBytes':max((x['bytes'] for x in rows if x['file'].endswith('.jpg')),default=0)}
(root/'freeze.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'files':len(rows),'bytes':result['totalBytes'],'maxJpegBytes':result['maxJpegBytes'],'freezeSha256':hash_file(root/'freeze.json')}))
