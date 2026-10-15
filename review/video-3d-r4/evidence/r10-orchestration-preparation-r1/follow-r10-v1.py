#!/usr/bin/env python3
"""MIT. Made by Ryan with Codex (GPT-6). Native R10 per-case continuation; all prior evidence unchanged."""
import argparse
import copy
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import threading
import time

ROOT = Path('/workspace/v3d-r4-media')
REPO = Path('/workspace/splashery-v3d-bench-tools-r10')
CONTROL = ROOT / 'follow-r10-v1-control'
SHARDS = ROOT / 'candidate-r10-v1-shards'
SNAPSHOTS = ROOT / 'candidate-r10-paired-snapshots-v1'
MASTER = ROOT / 'candidate-r10-paired-master-v1'
REFERENCE = ROOT / 'main-master-r1'
MANIFEST = REPO / 'tools/v3d-corpus.json'
NODE = '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node'
INTEGRITY = ROOT / 'r10-follower-integrity.mjs'
JOIN = REPO / 'tools/v3d-bench-join.mjs'
PAIRED = None  # Learned from the independently prepared frozen R10 provenance.
UNPAIRED = None
BASELINE = '7c714d23fd839129b6abbf718460cd7bf5bad59c34988292a26e4c5046aa05e6'
PROTOCOL = 'bf94e388a2d71f1d3f7c75dd5d1855a4d69ddd8ba946dc81905faa85746e57ad'
URL = 'http://127.0.0.1:4181/'
PRIOR_COORDINATOR = {'pid': 196899, 'startTicks': '1642582'}
LIMIT = dt.datetime(2026, 10, 15, 16, 15, tzinfo=dt.timezone.utc)
PROFILES = ('phone', 'desktop')
LOCK = threading.RLock()
EVENT_LOCK = threading.Lock()

def now():
    return dt.datetime.now(dt.timezone.utc)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def read_json(file):
    return json.loads(Path(file).read_text())

def atomic_json(file, value):
    file = Path(file)
    temp = file.with_name(file.name + '.next')
    temp.write_text(json.dumps(value, indent=2) + '\n')
    os.replace(temp, file)

def event(kind, **fields):
    row = {'at': now().isoformat(), 'event': kind, **fields}
    with EVENT_LOCK:
        with (CONTROL / 'events.jsonl').open('a') as output:
            output.write(json.dumps(row, sort_keys=True) + '\n')
            output.flush()
            os.fsync(output.fileno())
    print(json.dumps(row, sort_keys=True), flush=True)

def process_identity(pid):
    try:
        directory = Path(f'/proc/{pid}')
        fields = (directory / 'stat').read_text().rsplit(')', 1)[1].strip().split()
        return {'pid': pid, 'startTicks': fields[19], 'state': fields[0],
                'command': (directory / 'cmdline').read_bytes().split(b'\0')[:-1]}
    except OSError:
        return None

def old_alive(binding):
    observed = process_identity(binding['pid'])
    return bool(observed and observed['state'] != 'Z'
                and observed['startTicks'] == binding['startTicks'])

def choose_case(ids, profile, seen_paired, seen_unpaired, baseline):
    """No score-dependent selection. Every initial-unpaired case gets one eligible paired repeat."""
    choices = []
    for index, clip in enumerate(ids):
        key = (clip, profile)
        before = baseline.get(key)
        accountable = bool(before and before['accounted'])
        if key in seen_paired:
            continue
        if key in seen_unpaired and not accountable:
            continue
        mode = 'paired' if accountable else 'unpaired'
        choices.append((0 if accountable else 1 if before else 2, index, clip, mode,
                        'declared-unpaired-to-paired-repeat' if key in seen_unpaired else 'unseen-initial-attempt'))
    if not choices:
        return None
    _, _, clip, mode, reason = min(choices)
    return {'id': clip, 'profile': profile, 'mode': mode, 'reason': reason}

def source_specs(state):
    # Prior R9/R8 rows are never discovered or mixed into the new R10 cohort.
    sources = []
    for attempt in state['attempts']:
        directory = Path(attempt['output'])
        if directory.resolve().parent != SHARDS.resolve() or directory.is_symlink():
            raise RuntimeError('An attempt escaped the fresh R10 shard root.')
        if attempt['mode'] not in ('paired', 'unpaired'):
            raise RuntimeError('Unknown attempt mode.')
        sources.append({'directory': str(directory), 'kind': attempt['mode'],
                        'expected': PAIRED if attempt['mode'] == 'paired' else UNPAIRED})
    listed = {str(Path(row['directory']).resolve()) for row in sources}
    if SHARDS.exists() and any(str(entry.resolve()) not in listed for entry in SHARDS.iterdir()):
        raise RuntimeError('Unlisted evidence in the R10 shard root; no implicit retry or import.')
    return sources

def inspect(state, declaration):
    for file, expected in declaration['immutableFiles'].items():
        if digest(Path(file).read_bytes()) != expected:
            raise RuntimeError('Immutable orchestration/protocol input changed: ' + file)
    request = {'toolsRoot': str(REPO), 'allowedSourceRoot': str(SHARDS),
               'manifest': str(MANIFEST), 'reference': str(REFERENCE),
               'baselineExpected': BASELINE, 'sources': source_specs(state)}
    for retry in range(3):
        result = subprocess.run([NODE, str(INTEGRITY)], input=json.dumps(request), text=True,
                                capture_output=True, cwd=REPO, timeout=120)
        if not result.returncode:
            summary = json.loads(result.stdout)
            break
        if retry == 2:
            raise RuntimeError('Integrity inspection rejected evidence: ' + result.stderr[-6000:])
        time.sleep(0.5)  # A run.json append is a synchronous rewrite, not an atomic rename.
    with LOCK:
        state['knownSourceDirectories'] = sorted({*state.get('knownSourceDirectories', []),
                                                  *(run['directory'] for run in summary['runs'])})
        observed = state['observedImmutableRows']
        for run in [summary['baseline'], *summary['runs']]:
            # Baseline symlink targets advance; logical identity stays the original provenance.
            identity = 'baseline' if run is summary['baseline'] else run['directory']
            current = {row['id']+'/'+row['profile']: [row['rowFingerprint'], row['caseInventorySha256']]
                       for row in run['rows']}
            previous = observed.get(identity, {})
            if any(key not in current or current[key] != value for key, value in previous.items()):
                raise RuntimeError('An observed immutable row/artifact changed or disappeared: ' + identity)
            observed[identity] = current
        atomic_json(CONTROL / 'state.json', state)
    return summary

def attempted_sets(summary, state):
    paired, unpaired = set(), set()
    for run in summary['runs']:
        target = paired if run['provenanceSha256'] == PAIRED else unpaired
        for row in [*run['rows'], *run['attempts']]:
            target.add((row['id'], row['profile']))
    # A launched/reserved shard is never silently repeated after a coordinator interruption.
    for row in state['attempts']:
        (paired if row['mode'] == 'paired' else unpaired).add((row['id'], row['profile']))
    return paired, unpaired

def interrupt_owned(process):
    """Only this coordinator's newly launched subtree; never prior R9/R8 or another controller."""
    parents, identities = {}, {}
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit():
            continue
        try:
            identity = process_identity(int(entry.name))
            if not identity:
                continue
            fields = (entry / 'stat').read_text().rsplit(')', 1)[1].strip().split()
            parents[int(entry.name)] = int(fields[1])
            identities[int(entry.name)] = identity
        except OSError:
            pass
    owned = {process.pid}
    while True:
        more = {pid for pid, parent in parents.items() if parent in owned} - owned
        if not more:
            break
        owned |= more
    event('collection-deadline-interrupt-own-subtree', rootPid=process.pid,
          pids=sorted(owned), note='Partial original case remains unchanged; no benchmark outcome is invented.')
    for sig in (signal.SIGTERM, signal.SIGKILL):
        for pid in sorted(owned, reverse=True):
            observed = process_identity(pid)
            original = identities.get(pid)
            if observed and original and observed['startTicks'] == original['startTicks']:
                try:
                    os.kill(pid, sig)
                except ProcessLookupError:
                    pass
        if sig == signal.SIGTERM:
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                pass

def worker(profile, state, declaration):
    try:
        while now() < LIMIT:
            with LOCK:
                summary = inspect(state, declaration)
                paired, unpaired = attempted_sets(summary, state)
                before = {(row['id'], row['profile']): row for row in summary['baseline']['rows']}
                choice = choose_case(declaration['ids'], profile, paired, unpaired, before)
                if choice is None:
                    pending = [clip for clip in declaration['ids'] if (clip, profile) in unpaired
                               and (clip, profile) not in paired and (clip, profile) not in before]
                    if not pending:
                        state['workers'][profile] = {'status': 'coverage-and-available-repeats-complete', 'at': now().isoformat()}
                        atomic_json(CONTROL / 'state.json', state)
                        event('profile-complete', profile=profile, note='Incomplete and unpaired outcomes remain incomplete; no acceptance is inferred.')
                        return
                    choice = None
                if choice:
                    if shutil.disk_usage(ROOT).free < 2 * 1024**3:
                        raise RuntimeError('Less than2GiB free; preserve existing evidence rather than risk disk exhaustion.')
                    ordinal = len(state['attempts']) + 1
                    output = SHARDS / f'{ordinal:03d}-{choice["id"]}-{profile}-{choice["mode"]}'
                    output.mkdir(parents=True, exist_ok=False)
                    template = read_json(CONTROL / 'templates' / (choice['mode'] + '.json'))
                    template['created'] = now().isoformat()
                    template['selection'] = {'ids': [choice['id']], 'profiles': [profile]}
                    template['results'] = []
                    (output / 'run.json').write_text(json.dumps(template, indent=2) + '\n')
                    command = [NODE, 'tools/v3d-bench.mjs', 'run', 'tools/v3d-corpus.json',
                               str(ROOT / 'corpus'), str(output), '--url=http://127.0.0.1:4181/',
                               '--gpu=swiftshader', '--ids='+choice['id'], '--profiles='+profile]
                    if choice['mode'] == 'paired':
                        command.append('--reference='+str(REFERENCE))
                    attempt = {**choice, 'output': str(output), 'command': command,
                               'reservedAt': now().isoformat(), 'state': 'reserved',
                               'expectedProvenanceSha256': PAIRED if choice['mode'] == 'paired' else UNPAIRED,
                               'baselineEvidenceAtSelection': before.get((choice['id'], profile), {}).get('evidence')}
                    state['attempts'].append(attempt)
                    atomic_json(CONTROL / 'state.json', state)
            if not choice:
                time.sleep(5)
                continue
            log = CONTROL / f'attempt-{ordinal:03d}.log'
            if now() >= LIMIT:
                with LOCK:
                    attempt['state'] = 'collection-deadline-before-launch'
                    atomic_json(CONTROL / 'state.json', state)
                break
            with log.open('xb') as output_log:
                environment = os.environ.copy()
                environment['PATH'] = declaration['runnerPath']
                environment['SPLASHERY_CHROMIUM'] = '/usr/bin/chromium'
                process = subprocess.Popen(command, cwd=REPO, env=environment,
                                           stdout=output_log, stderr=subprocess.STDOUT, start_new_session=True)
                with LOCK:
                    attempt.update({'state': 'running', 'pid': process.pid, 'startedAt': now().isoformat()})
                    atomic_json(CONTROL / 'state.json', state)
                event('native-case-started', **{key: attempt[key] for key in ('id','profile','mode','reason','pid','output')})
                try:
                    code = process.wait(timeout=max(0.1, (LIMIT-now()).total_seconds()))
                except subprocess.TimeoutExpired:
                    interrupt_owned(process)
                    code = process.poll()
                    with LOCK:
                        attempt['collectionInterrupted'] = True
            with LOCK:
                attempt.update({'state': 'process-exited', 'returncode': code, 'endedAt': now().isoformat(), 'log': str(log)})
                summary = inspect(state, declaration)
                run = next(run for run in summary['runs'] if run['directory'] == str(Path(attempt['output']).resolve()))
                if len(run['rows']) > 1 or any(row['id'] != attempt['id'] or row['profile'] != profile for row in run['rows']):
                    raise RuntimeError('A single-case shard recorded an unexpected selection.')
                attempt['recordedRows'] = run['rows']
                attempt['nativeCaseDirectoryObserved'] = bool(run['attempts'])
                atomic_json(CONTROL / 'state.json', state)
                event('native-case-exited', id=attempt['id'], profile=profile, mode=attempt['mode'], returncode=code,
                      statuses=[row['status'] for row in run['rows']], output=attempt['output'])
                if not run['rows'] and not run['attempts']:
                    raise RuntimeError('Runner rejected preflight before opening the native case; halt this profile rather than consume the corpus with invalid attempts.')
        with LOCK:
            state['workers'][profile] = {'status': 'collection-deadline', 'at': now().isoformat()}
            atomic_json(CONTROL / 'state.json', state)
    except Exception as error:
        with LOCK:
            state['workers'][profile] = {'status': 'integrity-or-orchestration-blocked', 'reason': repr(error), 'at': now().isoformat()}
            atomic_json(CONTROL / 'state.json', state)
        event('profile-blocked', profile=profile, reason=repr(error))

def aggregate(state, declaration, force=False):
    with LOCK:
        summary = inspect(state, declaration)
        runs = [run for run in summary['runs'] if run['provenanceSha256'] == PAIRED]
        keys = {row['id']+'/'+row['profile'] for run in runs for row in run['rows']}
        signature = digest(json.dumps([[run['directory'], run['rows']] for run in runs], sort_keys=True).encode())
        prior = state.get('aggregate', {})
        if not keys or signature == prior.get('signature'):
            return
        if not force and len(keys) < prior.get('recordedRows', 0) + 5:
            return
        if shutil.disk_usage(ROOT).free < 4 * 1024**3:
            event('aggregate-deferred-disk', freeBytes=shutil.disk_usage(ROOT).free)
            return
        if len(runs) < 2:
            event('aggregate-not-feasible', reason='Public join requires at least2 genuine source runs; no source is fabricated.')
            return
        SNAPSHOTS.mkdir(exist_ok=True)
        ordinal = state.get('aggregateAttemptOrdinal', 0) + 1
        state['aggregateAttemptOrdinal'] = ordinal
        atomic_json(CONTROL / 'state.json', state)
        output = SNAPSHOTS / f'{ordinal:04d}'
        command = [NODE, str(JOIN), str(MANIFEST), str(output),
                   *[run['directory'] for run in runs], '--reference='+str(REFERENCE)]
        result = subprocess.run(command, cwd=REPO, capture_output=True, text=True, timeout=180)
        log = CONTROL / f'aggregate-{ordinal:04d}.log'
        log.write_text(result.stdout+result.stderr)
        if result.returncode:
            event('aggregate-rejected', returncode=result.returncode, log=str(log))
            return
        joined = read_json(output / 'run.json')
        if joined['provenanceSha256'] != PAIRED:
            raise RuntimeError('Joined candidate provenance changed.')
        comparison = CONTROL / f'comparison-{ordinal:04d}.json'
        compared = subprocess.run([NODE, 'tools/v3d-bench.mjs', 'compare', str(output/'join-reference'),
                                   str(output), str(comparison)], cwd=REPO, capture_output=True,
                                  text=True, timeout=120)
        (CONTROL / f'comparison-{ordinal:04d}.log').write_text(compared.stdout+compared.stderr)
        if compared.returncode:
            event('comparison-rejected', returncode=compared.returncode, snapshot=str(output))
        temporary = ROOT / '.candidate-r10-paired-master-v1-next'
        if temporary.is_symlink():
            temporary.unlink()
        temporary.symlink_to(output, target_is_directory=True)
        if MASTER.exists() and not MASTER.is_symlink():
            raise RuntimeError('Aggregate publication path is not our symlink.')
        os.replace(temporary, MASTER)
        state['aggregate'] = {'signature': signature, 'recordedRows': len(joined['results']),
                              'snapshot': str(output), 'publishedAt': now().isoformat(),
                              'runSha256': digest((output/'run.json').read_bytes()),
                              'comparison': str(comparison) if not compared.returncode else None,
                              'coverage': joined['join']['coverage']}
        atomic_json(CONTROL / 'state.json', state)
        event('paired-aggregate-published', **state['aggregate'])

def descendant_bindings(root_pids):
    # /proc task/children is unavailable in this environment. Enumerate PPid from status,
    # then inspect identities only within the explicitly owned old follower subtrees.
    parents = {}
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit():
            continue
        try:
            for line in (entry/'status').read_text().splitlines():
                if line.startswith('PPid:'):
                    parents[int(entry.name)] = int(line.split()[1])
                    break
        except OSError:
            pass
    owned = set(root_pids)
    while True:
        more = {pid for pid, parent in parents.items() if parent in owned} - owned
        if not more:
            break
        owned |= more
    found = {}
    for pid in owned - set(root_pids):
        identity = process_identity(pid)
        if identity:
            found[pid] = {'pid':pid,'startTicks':identity['startTicks'],
                          'command':[value.decode(errors='replace') for value in identity['command']]}
    return found


def profile_ready(binding, descendants, alive=old_alive):
    return (binding is None or not alive(binding)) and not any(alive(child) for child in descendants.values())


def ready_worker(profile, state, declaration):
    # Parent retired the Python followers separately. Only this profile's observed native
    # Node identity and descendants block it; the other profile and old Python parents do not.
    binding = declaration['priorNativeBlockers'][profile]['native']
    descendants = {int(pid): row for pid, row in declaration['priorNativeBlockers'][profile]['descendants'].items()}
    event('waiting-for-prior-native-profile', profile=profile, pid=binding['pid'] if binding else None)
    while now() < LIMIT:
        roots = [row['pid'] for row in ([binding] if binding else []) + list(descendants.values()) if old_alive(row)]
        descendants.update(descendant_bindings(roots))
        with LOCK:
            state.setdefault('observedPriorNativeDescendants', {})[profile] = descendants
            atomic_json(CONTROL/'state.json', state)
        if profile_ready(binding, descendants):
            event('prior-native-profile-concluded', profile=profile,
                  note='This native identity and all observed descendants exited naturally; the other profile need not be idle.')
            worker(profile, state, declaration)
            return
        time.sleep(5)
    with LOCK:
        state['workers'][profile] = {'status':'collection-deadline-waiting-for-prior-native-profile','at':now().isoformat()}
        atomic_json(CONTROL/'state.json',state)
    event('profile-deadline-before-readiness',profile=profile)


def configure(declaration):
    global PAIRED, UNPAIRED
    if declaration.get('status') != 'frozen-launch-authorized':
        raise RuntimeError('R10 source, templates, blocker receipt, and launch authorization must be frozen first.')
    validate_final_declaration(declaration)
    if declaration['runnerCwd'] != str(REPO) or declaration['url'] != 'http://127.0.0.1:4181/' or declaration['reference'] != str(REFERENCE):
        raise RuntimeError('Unexpected R10 tools, source URL, or reference.')
    if declaration['deadline'] != LIMIT.isoformat() or declaration['baselineProvenanceSha256'] != BASELINE:
        raise RuntimeError('Unexpected deadline or baseline provenance.')
    ids = [row['id'] for row in read_json(MANIFEST)]
    if len(ids) != 20 or len(set(ids)) != 20 or declaration['ids'] != ids:
        raise RuntimeError('All20 frozen corpus IDs are required in manifest order.')
    PAIRED, UNPAIRED = declaration['pairedProvenanceSha256'], declaration['unpairedProvenanceSha256']
    if PAIRED == UNPAIRED or any(len(value)!=64 or any(c not in '0123456789abcdef' for c in value) for value in (PAIRED,UNPAIRED)):
        raise RuntimeError('Invalid distinct R10 provenance hashes.')
    for profile in PROFILES:
        if profile not in declaration['priorNativeBlockers']:
            raise RuntimeError('Missing explicitly observed per-profile prior native blockers.')
    # Root retires only the old Python parent first. We never signal a predecessor.
    if old_alive(declaration['priorCoordinator']):
        raise RuntimeError('Prior coordinator is still alive; only root may retire it.')
    if subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=REPO, text=True).strip() != declaration['toolsCommit']:
        raise RuntimeError('Immutable R10 tools checkout commit changed.')
    for file, expected in declaration['immutableFiles'].items():
        if digest(Path(file).read_bytes()) != expected:
            raise RuntimeError('Final immutable receipt/file changed: ' + file)
    handoff = read_json(CONTROL/'prior-native-handoff.json')
    if any(handoff['coordinator'].get(key) != declaration['priorCoordinator'].get(key)
           for key in ('pid','startTicks','retiredByRoot')):
        raise RuntimeError('Retired coordinator identity disagrees with root handoff.')
    for profile in PROFILES:
        if any(handoff['profiles'][profile][key] != declaration['priorNativeBlockers'][profile][key]
               for key in ('native','descendants')):
            raise RuntimeError('Incomplete/changed prior profile blocker inventory: ' + profile)
    preparation = read_json(CONTROL/'provenance-preparation.json')
    if any(preparation[key] != declaration[key] for key in ('productCommit','toolsCommit','servedSourceSha256','protocolSha256')):
        raise RuntimeError('R10 source/protocol preparation does not match the final declaration.')
    for mode, expected in [('paired', PAIRED), ('unpaired', UNPAIRED)]:
        template_file = CONTROL/'templates'/(mode+'.json')
        if preparation['templates'][mode]['provenanceSha256'] != expected or read_json(template_file)['provenanceSha256'] != expected:
            raise RuntimeError('R10 template provenance changed: ' + mode)


def validate_final_declaration(declaration):
    """Pure checks: preparation placeholders and reused R9 provenance cannot authorize launch."""
    if declaration.get('status') != 'frozen-launch-authorized' or not declaration.get('authorization'):
        raise RuntimeError('Final explicit source freeze and root launch authorization are required.')
    valid_hash = lambda value, length: isinstance(value, str) and len(value) == length and all(c in '0123456789abcdef' for c in value)
    for field, length in [('productCommit',40),('toolsCommit',40),('servedSourceSha256',64),('pairedProvenanceSha256',64),('unpairedProvenanceSha256',64)]:
        if not valid_hash(declaration.get(field), length):
            raise RuntimeError('Missing final R10 freeze/provenance field: ' + field)
    if declaration.get('protocolSha256') != PROTOCOL or declaration.get('profiles') != list(PROFILES):
        raise RuntimeError('Both profiles and unchanged five-module protocol are required.')
    if declaration.get('runnerCwd') != str(REPO) or declaration.get('url') != URL or declaration.get('reference') != str(REFERENCE):
        raise RuntimeError('Unexpected R10 paths or URL.')
    if declaration.get('deadline') != LIMIT.isoformat() or declaration.get('baselineProvenanceSha256') != BASELINE:
        raise RuntimeError('Unexpected deadline or baseline.')
    old_provenance = {'fca50d7bc2b5d22bddecd7ee77d5c5bb0942444fe6ddf12f008d544bcb2d8ca0',
                      '6c337b4c990bb9d33da5b92f76245436cad75382b851d7e23b132c10f45f2835'}
    if declaration['pairedProvenanceSha256'] == declaration['unpairedProvenanceSha256'] or any(declaration[k] in old_provenance for k in ('pairedProvenanceSha256','unpairedProvenanceSha256')):
        raise RuntimeError('R10 provenance must be newly derived and paired/unpaired distinct.')
    prior = declaration.get('priorCoordinator', {})
    if any(prior.get(k) != value for k, value in PRIOR_COORDINATOR.items()) or prior.get('retiredByRoot') is not True:
        raise RuntimeError('Root must explicitly retire the exact prior coordinator identity.')
    blockers = declaration.get('priorNativeBlockers')
    if not isinstance(blockers, dict) or set(blockers) != set(PROFILES):
        raise RuntimeError('Concrete complete per-profile predecessor handoff is required.')
    seen = set()
    for profile in PROFILES:
        row = blockers[profile]
        if not isinstance(row, dict) or 'native' not in row or not isinstance(row.get('descendants'), dict):
            raise RuntimeError('Missing native/descendant identity inventory: ' + profile)
        for binding in ([row['native']] if row['native'] is not None else []) + list(row['descendants'].values()):
            if not isinstance(binding, dict) or not isinstance(binding.get('pid'), int) or binding['pid'] < 1 or not isinstance(binding.get('startTicks'), str) or not binding['startTicks'].isdigit() or not isinstance(binding.get('command'), list) or not binding['command']:
                raise RuntimeError('Invalid exact predecessor identity: ' + profile)
            identity = (binding['pid'],binding['startTicks'])
            if identity in seen:
                raise RuntimeError('A predecessor identity is duplicated across profile blockers.')
            seen.add(identity)
    required = [str(CONTROL/name) for name in ('runtime-freeze.json','prior-native-handoff.json','provenance-preparation.json','templates/paired.json','templates/unpaired.json')]
    required += [str(Path(__file__).resolve()), str(INTEGRITY), str(ROOT/'test-follow-r10-v1.py'),
                 str(ROOT/'prepare-r10-provenance.mjs'), str(ROOT/'finalize-r10-declaration.py'), str(MANIFEST), str(JOIN)]
    required += [str(REPO/'tools'/name) for name in ('v3d-bench.mjs','v3d-bench-metrics.mjs','v3d-bench-samples.mjs','v3d-bench-pixels.mjs','cdx-v3d-clarity-metrics.mjs')]
    if not isinstance(declaration.get('immutableFiles'), dict) or any(file not in declaration['immutableFiles'] for file in required):
        raise RuntimeError('Final source, template, and concrete handoff receipts must be hash-bound.')
    if any(not valid_hash(value,64) for value in declaration['immutableFiles'].values()):
        raise RuntimeError('Invalid final immutable-file digest.')


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
    declaration=read_json(CONTROL/'declaration.json')
    state=read_json(CONTROL/'state.json')
    configure(declaration)
    if args.check:
        summary=inspect(state,declaration)
        paired,unpaired=attempted_sets(summary,state)
        print(json.dumps({'validated':True,'pairedAttemptKeys':len(paired),'unpairedAttemptKeys':len(unpaired),
                          'baselineRows':len(summary['baseline']['rows']),'priorNativeAlive':{profile:[b['pid'] for b in ([declaration['priorNativeBlockers'][profile]['native']] if declaration['priorNativeBlockers'][profile]['native'] else []) + list(declaration['priorNativeBlockers'][profile]['descendants'].values()) if old_alive(b)] for profile in PROFILES}}))
        return
    # Fail closed on duplicate/restarted orchestration rather than overlap native cases.
    import fcntl
    with (CONTROL/'coordinator.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if state.get('coordinatorStartedAt'):
            raise RuntimeError('A coordinator was already started; review its recorded attempts before restarting.')
        state['declarationSha256']=digest((CONTROL/'declaration.json').read_bytes());
        shutil.copyfile(CONTROL/'declaration.json', CONTROL/'declaration-launched.json')
        state['coordinatorStartedAt']=now().isoformat();state['coordinatorPid']=os.getpid();atomic_json(CONTROL/'state.json',state)
        aggregate(state,declaration,force=True)
        threads=[threading.Thread(target=ready_worker,args=(profile,state,declaration),name=profile) for profile in PROFILES]
        for thread in threads:thread.start()
        while any(thread.is_alive() for thread in threads):
            time.sleep(5)
            try:aggregate(state,declaration)
            except Exception as error:event('aggregate-inspection-blocked',reason=repr(error))
        for thread in threads:thread.join()
        try:aggregate(state,declaration,force=True)
        except Exception as error:event('final-aggregate-blocked',reason=repr(error))
        event('continuation-finished',workers=state['workers'],attempts=len(state['attempts']))

if __name__=='__main__':
    main()
