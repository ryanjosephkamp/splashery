#!/usr/bin/env python3
"""MIT. Verify or restore every exact original helper-packet byte."""
import gzip
import hashlib
import json
from pathlib import Path
import sys

root = Path(__file__).resolve().parent
rows = json.loads(gzip.decompress((root / 'root-source-inventory.json.gz').read_bytes()))
storage = json.loads((root / 'root-storage-restoration.json').read_text())
archives = {row['originalPath']: row for row in storage['files']}
output = None if sys.argv[1:] == ['--check'] else Path(sys.argv[1]).resolve()
if output is not None:
    output.mkdir(exist_ok=False)
count = 0
total = 0
for row in rows:
    relative = Path(row['file'])
    assert not relative.is_absolute() and '..' not in relative.parts
    archive = archives.get(row['file'])
    if archive:
        encoded = (root / archive['archivePath']).read_bytes()
        assert hashlib.sha256(encoded).hexdigest() == archive['archiveSha256']
        data = gzip.decompress(encoded)
    else:
        data = (root / relative).read_bytes()
    assert len(data) == row['bytes'] and hashlib.sha256(data).hexdigest() == row['sha256'], row['file']
    if output is not None:
        path = output / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
    count += 1
    total += len(data)
print(json.dumps({'originalPacketFilesVerified': count, 'originalPacketBytesVerified': total, 'restoredTo': str(output) if output is not None else None}))
