#!/usr/bin/env python3
"""MIT. Capture actual root-owned timed-work identities for diagnostic review."""
import datetime as dt
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path('/workspace/v3d-r4-media')
spec = importlib.util.spec_from_file_location('queue', ROOT / 'queue-r12-review-r1.py')
queue = importlib.util.module_from_spec(spec)
spec.loader.exec_module(queue)

def read(path):
    return json.loads(path.read_text())

def binding(row):
    return {key: row[key] for key in ('pid', 'startTicks', 'command')}

declaration = read(ROOT / 'follow-r12-v1-control/declaration.json')
handoff_path = ROOT / 'follow-r12-v1-control/prior-native-handoff.json'
handoff = read(handoff_path)
state = read(ROOT / 'follow-r12-v1-control/state.json')
roots = {}
for role, pid, receipt_name in (
    ('main-native', 158994, None),
    ('r12-coordinator', 377288, 'follow-r12-v1-launch.json'),
    ('r12-samples', 377289, 'samples-r12-launch.json'),
):
    observed = queue.process_identity(pid)
    assert observed and observed['state'] != 'Z', (role, 'root must be observed live')
    if receipt_name:
        receipt = read(ROOT / receipt_name)
        assert receipt['pid'] == pid and receipt['command'] == observed['command']
    root = binding(observed)
    descendants = {str(row['pid']): binding(row) for row in queue.scan_descendants([root])}
    roots[role] = {'root': root, 'descendants': descendants, 'completeObservedDescendants': True}

prior = handoff['profiles']['desktop']
descendants = {str(pid): binding(row) for pid, row in prior['descendants'].items()}
for pid, row in state['observedPriorNativeDescendants']['desktop'].items():
    old = descendants.get(str(pid))
    assert old is None or old == binding(row)
    descendants[str(pid)] = binding(row)
roots['r11-remaining'] = {
    'root': binding(prior['native']), 'descendants': descendants,
    'completeObservedDescendants': True,
}
queue.validate_roots(roots)
receipt = {
    'status': 'actual-root-observed', 'generation': 'R12-review',
    'capturedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
    'authorization': 'Root authorizes one diagnostic R12 review batch under the user task-88 request, only after 16:15 UTC and every bound timed-work identity and observed descendant has ceased. No timed-work signals, protocol changes, retries, or acceptance claims are authorized by this receipt.',
    'candidateProvenanceSha256': declaration['pairedProvenanceSha256'],
    'candidateServedSourceSha256': declaration['servedSourceSha256'],
    'timedRoots': roots,
    'historicalIdentitySource': {
        'path': str(handoff_path), 'sha256': hashlib.sha256(handoff_path.read_bytes()).hexdigest(),
        'additionalDescendantsFrom': str(ROOT / 'follow-r12-v1-control/state.json'),
        'note': 'The R11 desktop root and descendants are preserved historical identities from the actual handoff and subsequent coordinator observations. They are not inferred from absent /proc entries. R11 phone ceased naturally before R12 phone started; its retained evidence remains in the prior handoff/state.',
    },
    'observationNotice': 'Live roots and complete currently observable descendants were read from /proc. The authorized queue retains these and discovers future children until the quiet gate; no process is signaled during observation.',
}
output = ROOT / 'review-r12-root-actual-receipt-r1.json'
assert not output.exists()
output.write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'receipt': str(output), 'capturedAt': receipt['capturedAt'], 'roles': {k: {'pid': v['root']['pid'], 'descendants': len(v['descendants'])} for k, v in roots.items()}}))
