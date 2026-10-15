"""MIT. One source-bound post-merge sample replay with owned, bounded cleanup."""
import datetime as dt
import importlib.util
import json
import os
from pathlib import Path
import signal
import subprocess
import time

root = Path('/workspace/v3d-r4-media')
control = root / 'samples-postmerge-r1-control'
control.mkdir(exist_ok=False)
spec = importlib.util.spec_from_file_location('owned_processes', root / 'queue-r12-review-r1.py')
ownership = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ownership)
now = lambda: dt.datetime.now(dt.timezone.utc)
stop = dt.datetime(2026, 10, 15, 15, 45, tzinfo=dt.timezone.utc)
assert now() < stop
receipt = json.loads((root / 'runtime-postmerge-samples-r1-freeze.json').read_text())
output = root / 'samples-postmerge-r1'
assert not output.exists()
command = ['/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node', 'tools/v3d-bench.mjs', 'samples', str(output), '--url=http://127.0.0.1:4184/', '--reference=/workspace/v3d-r4-media/samples-main-r1']
controller = ownership.process_identity(os.getpid())
environment = os.environ.copy()
environment['SPLASHERY_CHROMIUM'] = '/usr/bin/chromium'
with open('/tmp/v3d-r4-samples-postmerge-r1.log', 'xb') as log:
    child = subprocess.Popen(command, cwd=receipt['toolWorktree'], env=environment, stdin=subprocess.DEVNULL, stdout=log, stderr=subprocess.STDOUT, start_new_session=True, close_fds=True)
    binding = ownership.process_identity(child.pid)
    assert binding
    owned = ownership.Watch([{key: binding[key] for key in ('pid', 'startTicks', 'command')}])
    launch = {'created': now().isoformat(), 'controller': {key: controller[key] for key in ('pid', 'startTicks', 'command')}, 'native': {key: binding[key] for key in ('pid', 'startTicks', 'command')}, 'command': command, 'productCommit': receipt['productCommit'], 'servedSourceSha256': receipt['servedSource']['sha256'], 'ownedCleanupNotBefore': stop.isoformat(), 'purpose': 'Separate post-merge sample replay; no corpus timing or provenance replacement.'}
    (control / 'launch.json').write_text(json.dumps(launch, indent=2) + '\n')
    interrupted = False
    while True:
        live = owned.refresh()
        (control / 'owned-state.json').write_text(json.dumps({'at': now().isoformat(), 'observed': list(owned.seen.values()), 'live': live, 'nativeReturncode': child.poll()}, indent=2) + '\n')
        if child.poll() is not None and not live:
            break
        if now() >= stop:
            interrupted = True
            sent = ownership.signal_owned(owned, signal.SIGTERM)
            cleanup_until = time.monotonic() + 5
            while time.monotonic() < cleanup_until and owned.refresh():
                time.sleep(.1)
            killed = ownership.signal_owned(owned, signal.SIGKILL)
            (control / 'cleanup.json').write_text(json.dumps({'at': now().isoformat(), 'term': sent, 'kill': killed, 'notice': 'Only newly owned sample identities were signaled; interrupted output cannot establish sample preservation.'}, indent=2) + '\n')
            break
        time.sleep(1)
    result = {'finishedAt': now().isoformat(), 'nativeReturncode': child.poll(), 'deadlineInterrupted': interrupted, 'output': str(output), 'productCommit': receipt['productCommit'], 'servedSourceSha256': receipt['servedSource']['sha256'], 'observedBindings': list(owned.seen.values())}
    (control / 'result.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({key: value for key, value in result.items() if key != 'observedBindings'}), flush=True)
