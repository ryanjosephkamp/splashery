#!/usr/bin/env python3
"""MIT. Made by Ryan with Codex (GPT-6). Audit original spec bytes against both recorded bases."""
import datetime
import hashlib
import json
import pathlib
import subprocess

REPO = pathlib.Path('/workspace/splashery-r4-public')
OUT = pathlib.Path('/workspace/v3d-r4-media/original-spec-byte-audit-r1')
BASE = '95da2ddb'
MERGED_MAIN = '67fa1ce3'

def git(*args):
    return subprocess.check_output(['git', '-C', str(REPO), *args])

def sha(data):
    return hashlib.sha256(data).hexdigest()

rows = []
for name in git('ls-tree', '-r', '--name-only', BASE, '--', 'tests/').decode().splitlines():
    if not name.endswith('.spec.mjs'):
        continue
    original = git('show', BASE + ':' + name)
    current = (REPO / name).read_bytes()
    same = original == current
    inherited = not same and git('show', MERGED_MAIN + ':' + name) == current
    if not same and not inherited:
        raise RuntimeError('Original spec changed by task: ' + name)
    rows.append({'file': name, 'taskStartSha256': sha(original), 'currentSha256': sha(current),
                 'byteExactTaskStart': same, 'byteExactNormallyMergedMain': inherited})
OUT.mkdir(exist_ok=False)
shutil_source = pathlib.Path(__file__)
(OUT / shutil_source.name).write_bytes(shutil_source.read_bytes())
(OUT / 'receipt.json').write_text(json.dumps({
    'at': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'taskStart': git('rev-parse', BASE).decode().strip(),
    'normallyMergedMain': git('rev-parse', MERGED_MAIN).decode().strip(),
    'currentCommit': git('rev-parse', 'HEAD').decode().strip(),
    'workingTreeSourceNotice': 'The only current source edit is optional background-fit recovery, with one new test file. Existing original spec files are read from the actual working tree.',
    'originalSpecCount': len(rows),
    'byteExactTaskStart': sum(r['byteExactTaskStart'] for r in rows),
    'inheritedMainOnly': [r['file'] for r in rows if r['byteExactNormallyMergedMain']],
    'taskChangedOriginalSpecs': [],
    'notice': 'This audits original spec file bytes, not pass status. New task tests and original failures remain subject to the full-suite gate. Main changes were merged normally, not rewritten.',
    'files': rows,
}, indent=2) + '\n')
print(json.dumps({'originalSpecs': len(rows), 'unchanged': sum(r['byteExactTaskStart'] for r in rows),
                  'inheritedMainOnly': [r['file'] for r in rows if r['byteExactNormallyMergedMain']]}))
