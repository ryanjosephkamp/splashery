"""MIT. Made by Ryan with Codex (GPT-6). Derive isolated R9 orchestration from tested R8 V3."""
from pathlib import Path
s=Path('/workspace/v3d-r4-media/follow-r8-v3.py').read_text()
s=s.replace('Native R8 continuation; original evidence unchanged.','Native R9 per-case continuation; all prior evidence unchanged.')
s=s.replace("REPO = Path('/workspace/splashery-v3d-bench-tools')","REPO = Path('/workspace/splashery-v3d-bench-tools-r9')")
s=s.replace('follow-r8-v3-control','follow-r9-v1-control').replace('candidate-r8-v3-shards','candidate-r9-v1-shards').replace('candidate-r8-paired-snapshots-v3','candidate-r9-paired-snapshots-v1').replace('candidate-r8-paired-master-v3','candidate-r9-paired-master-v1')
s=s.replace("INTEGRITY = ROOT / 'r8-follower-integrity.mjs'", "INTEGRITY = ROOT / 'r9-follower-integrity.mjs'")
s=s.replace("JOIN = Path('/workspace/splashery-r4-public/tools/v3d-bench-join.mjs')", "JOIN = REPO / 'tools/v3d-bench-join.mjs'")
s=s.replace("PAIRED = 'b80c296943b98d423b707e284c2b8b1167475cf84b94fc323c82808528c4607b'", 'PAIRED = None  # Learned from the independently prepared frozen R9 provenance.')
s=s.replace("UNPAIRED = '3051307eee7fbcca5b4b27fc3b8ab53de5560afebdaf1fe079dd0991d70d0914'", 'UNPAIRED = None')
s=s.replace("and observed['startTicks'] == binding['startTicks']\n                and observed['command'] == [item.encode() for item in binding['command']])", "and observed['startTicks'] == binding['startTicks'])")
a=s.index('def source_specs(');b=s.index('\ndef inspect(',a)
s=s[:a]+'''def source_specs(state):
    # R8 rows are deliberately never discovered or mixed into the new R9 cohort.
    sources = []
    for attempt in state['attempts']:
        directory = Path(attempt['output'])
        if directory.resolve().parent != SHARDS.resolve() or directory.is_symlink():
            raise RuntimeError('An attempt escaped the fresh R9 shard root.')
        if attempt['mode'] not in ('paired', 'unpaired'):
            raise RuntimeError('Unknown attempt mode.')
        sources.append({'directory': str(directory), 'kind': attempt['mode'],
                        'expected': PAIRED if attempt['mode'] == 'paired' else UNPAIRED})
    listed = {str(Path(row['directory']).resolve()) for row in sources}
    if SHARDS.exists() and any(str(entry.resolve()) not in listed for entry in SHARDS.iterdir()):
        raise RuntimeError('Unlisted evidence in the R9 shard root; no implicit retry or import.')
    return sources
''' +s[b:]
s=s.replace("request = {'manifest': str(MANIFEST), 'reference': str(REFERENCE),", "request = {'toolsRoot': str(REPO), 'allowedSourceRoot': str(SHARDS),\n               'manifest': str(MANIFEST), 'reference': str(REFERENCE),")
s=s.replace("'--url=http://127.0.0.1:4179/'", "'--url=http://127.0.0.1:4180/'")
s=s.replace(".candidate-r8-paired-master-v3-next", ".candidate-r9-paired-master-v1-next")
s=s.replace("never an original R8 process.", "never a prior R8 process or any other controller's process.")
a=s.index('def profile_ready(');b=s.index('\ndef main():',a)
s=s[:a]+'''def profile_ready(binding, descendants, alive=old_alive):
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
        raise RuntimeError('R9 source, templates, blocker receipt, and launch authorization must be frozen first.')
    if declaration['runnerCwd'] != str(REPO) or declaration['url'] != 'http://127.0.0.1:4180/' or declaration['reference'] != str(REFERENCE):
        raise RuntimeError('Unexpected R9 tools, source URL, or reference.')
    if declaration['deadline'] != LIMIT.isoformat() or declaration['baselineProvenanceSha256'] != BASELINE:
        raise RuntimeError('Unexpected deadline or baseline provenance.')
    ids = [row['id'] for row in read_json(MANIFEST)]
    if len(ids) != 20 or len(set(ids)) != 20 or declaration['ids'] != ids:
        raise RuntimeError('All20 frozen corpus IDs are required in manifest order.')
    PAIRED, UNPAIRED = declaration['pairedProvenanceSha256'], declaration['unpairedProvenanceSha256']
    if PAIRED == UNPAIRED or any(len(value)!=64 or any(c not in '0123456789abcdef' for c in value) for value in (PAIRED,UNPAIRED)):
        raise RuntimeError('Invalid distinct R9 provenance hashes.')
    for profile in PROFILES:
        if profile not in declaration['priorNativeBlockers']:
            raise RuntimeError('Missing explicitly observed per-profile prior native blockers.')

''' +s[b:]
s=s.replace("    state=read_json(CONTROL/'state.json')\n", "    state=read_json(CONTROL/'state.json')\n    configure(declaration)\n")
s=s.replace("'oldFollowersAlive':[b['pid'] for b in declaration['oldFollowers'] if old_alive(b)]", "'priorNativeAlive':{profile:[b['pid'] for b in ([declaration['priorNativeBlockers'][profile]['native']] if declaration['priorNativeBlockers'][profile]['native'] else []) + list(declaration['priorNativeBlockers'][profile]['descendants'].values()) if old_alive(b)] for profile in PROFILES}")
s=s.replace("        state['coordinatorStartedAt']=now().isoformat();", "        state['declarationSha256']=digest((CONTROL/'declaration.json').read_bytes());\n        shutil.copyfile(CONTROL/'declaration.json', CONTROL/'declaration-launched.json')\n        state['coordinatorStartedAt']=now().isoformat();")
Path('/workspace/v3d-r4-media/follow-r9-v1.py').write_text(s)
# Dynamic imports are confined by the launch declaration and its hashed exact immutable tools.
s=Path('/workspace/v3d-r4-media/r8-follower-integrity.mjs').read_text()
s=s.replace('R8 continuation','R9 continuation')
a=s.index("import {fingerprint,");b=s.index("const hash",a)
s=s[:a]+s[b:]
needle="const request = JSON.parse(fs.readFileSync(0, 'utf8'));"
s=s.replace(needle,needle+"\nconst toolsRoot=path.resolve(request.toolsRoot);\nconst {fingerprint,benchmarkCohort,accountedOutcome,rowKey}=await import(path.join(toolsRoot,'tools/v3d-bench-metrics.mjs'));\nconst {verifyArtifacts,assertReferenceEvidence,referenceEvidence}=await import(path.join(toolsRoot,'tools/v3d-bench.mjs'));\n")
s=s.replace("  const directory = fs.realpathSync(spec.directory), bytes", "  const directory = fs.realpathSync(spec.directory);\n  if(spec.kind!=='baseline'&&request.allowedSourceRoot&&path.dirname(directory)!==fs.realpathSync(request.allowedSourceRoot))throw new Error('Candidate source escaped the declared R9 root');\n  const bytes")
Path('/workspace/v3d-r4-media/r9-follower-integrity.mjs').write_text(s)
