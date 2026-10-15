"""MIT. Retire only the owned idle R1 watcher and bind all five actual timed roots."""
import copy
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import signal
import time

root = Path('/workspace/v3d-r4-media')
spec = importlib.util.spec_from_file_location('queue', root / 'queue-r12-review-r2.py')
queue = importlib.util.module_from_spec(spec)
spec.loader.exec_module(queue)
now = lambda: dt.datetime.now(dt.timezone.utc).isoformat()
sha = lambda data: hashlib.sha256(data).hexdigest()
old = root / 'review-r12-r1-control'
new = root / 'review-r12-r2-control'
takeover_out = root / 'review-r12-r2-takeover-actual.json'
receipt_out = root / 'review-r12-r2-root-actual.json'
quiet_out = root / 'review-r12-r1-final-quiet-for-r2.json'
assert all(not p.exists() for p in [takeover_out, receipt_out, quiet_out])
assert queue.now() < queue.QUIET
queue.assert_prior_unreserved()
launch = json.loads((old / 'queue-launch.json').read_text())
observed = queue.process_identity(393769)
assert observed and observed['state'] != 'Z' and launch['pid'] == observed['pid']
assert observed['command'] == launch['command']
watcher = {key: observed[key] for key in ['pid', 'startTicks', 'command']}
assert not queue.scan_descendants([watcher]), 'The idle watcher must have no render child.'
os.kill(watcher['pid'], signal.SIGTERM)
signals = ['SIGTERM']
until = time.monotonic() + 5
while time.monotonic() < until and queue.same_live(watcher, queue.process_identity(watcher['pid'])):
    time.sleep(.05)
if queue.same_live(watcher, queue.process_identity(watcher['pid'])):
    os.kill(watcher['pid'], signal.SIGKILL)
    signals.append('SIGKILL')
    until = time.monotonic() + 2
    while time.monotonic() < until and queue.same_live(watcher, queue.process_identity(watcher['pid'])):
        time.sleep(.05)
assert not queue.same_live(watcher, queue.process_identity(watcher['pid']))
retired = now()
queue.assert_prior_unreserved()
quiet_bytes = (old / 'quiet-state.json').read_bytes()
quiet = json.loads(quiet_bytes)
assert quiet_bytes == (old / 'quiet-state.json').read_bytes()
quiet_out.write_bytes(quiet_bytes)
takeover = {
    'status': 'actual-root-observed', 'generation': 'R12-review-r2-takeover',
    'capturedAt': now(), 'priorWatcher': watcher, 'retiredByRoot': True,
    'retiredAt': retired, 'priorWatcherObservedEnded': True,
    'onlyPriorWatcherRetired': True, 'timedRootsNotSignaled': True,
    'noR1RenderReservation': True, 'noR1RenderOutput': True,
    'r1DeclarationSha256': sha((old / 'declaration.json').read_bytes()),
    'r1RootReceiptSha256': sha((old / 'root-timed-work-receipt.json').read_bytes()),
    'r1RetiredQuietStateSha256': sha(quiet_bytes), 'signalsSentOnlyToPriorWatcher': signals,
    'scope': 'Only the exact observed idle watcher393769 was signaled. It had no render reservation or descendants. Baseline, R12 native work, and post-merge sample work were not signaled by this takeover.',
}
queue.validate_takeover(takeover)
takeover_out.write_text(json.dumps(takeover, indent=2) + '\n')
prior = json.loads((old / 'root-timed-work-receipt.json').read_text())
roots = copy.deepcopy(prior['timedRoots'])
for role, group in roots.items():
    seeds = [group['root'], *group['descendants'].values()]
    for row in queue.scan_descendants(seeds):
        binding = {key: row[key] for key in ['pid', 'startTicks', 'command']}
        group['descendants'][str(row['pid'])] = binding
    group['completeObservedDescendants'] = True
sample_launch = json.loads((root / 'samples-postmerge-r1-control/launch.json').read_text())
controller = sample_launch['controller']
current = queue.process_identity(controller['pid'])
assert queue.same_live(controller, current) and current['command'] == controller['command']
descendants = {str(row['pid']): {key: row[key] for key in ['pid', 'startTicks', 'command']} for row in queue.scan_descendants([controller])}
roots['postmerge-samples'] = {'root': controller, 'descendants': descendants, 'completeObservedDescendants': True}
queue.validate_roots(roots)
queue.validate_retired_history(roots, json.loads((new / 'r1-history/quiet-state-preparation-snapshot.json').read_text()), quiet, prior['timedRoots'])
receipt = {
    'status': 'actual-root-observed', 'generation': 'R12-review-r2', 'capturedAt': now(),
    'authorization': 'Root authorizes one R12 diagnostic review invocation under the user task88 request, after16:15UTC and all five actual timed roots plus all retained/new observed descendants have ceased. Original source, protocol, exact held-out replay guards, unranked manifest-order selection, and bounded owned-render cleanup remain unchanged. No timed-work signals or benchmark retries are authorized.',
    'candidateProvenanceSha256': queue.EXPECTED_CANDIDATE_PROVENANCE,
    'candidateServedSourceSha256': queue.EXPECTED_CANDIDATE_SOURCE,
    'timedRoots': roots, 'historicalQuietBindings': len(quiet['observedBindings']),
    'postmergeSampleSource': {'productCommit': sample_launch['productCommit'], 'servedSourceSha256': sample_launch['servedSourceSha256'], 'launchReceipt': str(root / 'samples-postmerge-r1-control/launch.json')},
    'notice': 'The original four root identities are retained exactly from R1. Current descendants were observed from /proc, all retired watcher history is separately retained, and the fifth actual controller plus its descendants is explicitly bound. No identities are inferred from absent processes.',
}
receipt_out.write_text(json.dumps(receipt, indent=2) + '\n')
print(json.dumps({'retiredOnlyWatcher': watcher['pid'], 'signals': signals, 'retainedQuietBindings': len(quiet['observedBindings']), 'fifthRoot': controller['pid'], 'receipt': str(receipt_out), 'takeover': str(takeover_out)}))
