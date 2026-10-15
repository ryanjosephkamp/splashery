#!/usr/bin/env python3
"""MIT. Made by Ryan with Codex (GPT-6). Finalize explicit root receipts, never launch/signals."""
import argparse
import copy
import importlib.util
import re
from pathlib import Path

ROOT=Path('/workspace/v3d-r4-media')
spec=importlib.util.spec_from_file_location('r10_follower',ROOT/'follow-r10-v1.py')
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)

def assemble(draft, preparation, handoff, expected, authorization):
    if draft.get('status')!='prepared-root-freeze-and-handoff-pending':
        raise RuntimeError('Only the fresh pending R10 declaration may be finalized.')
    if not authorization.strip():
        raise RuntimeError('Explicit root launch authorization is required.')
    for field in ('productCommit','toolsCommit','servedSourceSha256'):
        if preparation.get(field)!=expected[field]:
            raise RuntimeError('Explicit final identity disagrees with new preparation: '+field)
    for mode,field in [('paired','pairedProvenanceSha256'),('unpaired','unpairedProvenanceSha256')]:
        if preparation['templates'][mode]['provenanceSha256']!=expected[field]:
            raise RuntimeError('Explicit new provenance disagrees with preparation: '+mode)
    declaration=copy.deepcopy(draft)
    declaration.update(expected)
    declaration.update(status='frozen-launch-authorized',authorization=authorization,
                       finalizedAt=f.now().isoformat(),priorCoordinator=copy.deepcopy(handoff['coordinator']),
                       priorNativeBlockers={profile:{key:copy.deepcopy(handoff['profiles'][profile][key])
                                            for key in ('native','descendants')} for profile in f.PROFILES})
    return declaration

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    for field in ('product-commit','tools-commit','served-source','paired-provenance','unpaired-provenance','authorization'):
        parser.add_argument('--'+field,required=True)
    args=parser.parse_args()
    state=f.read_json(f.CONTROL/'state.json')
    if state.get('attempts') or state.get('coordinatorStartedAt') or state.get('workers'):
        raise RuntimeError('R10 state must remain fresh/unlaunched.')
    expected=dict(productCommit=args.product_commit,toolsCommit=args.tools_commit,
                  servedSourceSha256=args.served_source,pairedProvenanceSha256=args.paired_provenance,
                  unpairedProvenanceSha256=args.unpaired_provenance)
    declaration=assemble(f.read_json(f.CONTROL/'declaration.json'),f.read_json(f.CONTROL/'provenance-preparation.json'),
                         f.read_json(f.CONTROL/'prior-native-handoff.json'),expected,args.authorization)
    log=f.CONTROL/'cpu-tests-final.log'
    passed=re.search(r'Ran (\d+) tests in ([\d.]+)s\s+OK\s*$',log.read_text())
    if not passed:
        raise RuntimeError('Complete passing CPU-test receipt required.')
    declaration['cpuVerification']={'tests':int(passed[1]),'passed':int(passed[1]),'durationSeconds':float(passed[2]),
                                    'log':str(log),'noBrowserOrGpu':True,
                                    'testFixtureNotice':'Copied existing R8 case with frozen R9 protocol is CPU corruption fixture only, never a live R10 source.'}
    files=[ROOT/name for name in ('follow-r10-v1.py','test-follow-r10-v1.py','r10-follower-integrity.mjs',
                                  'prepare-r10-provenance.mjs','finalize-r10-declaration.py')]
    files += [f.CONTROL/name for name in ('cpu-tests-final.log','runtime-freeze.json','prior-native-handoff.json',
              'provenance-preparation.json','templates/paired.json','templates/unpaired.json')]
    files += [f.MANIFEST,f.JOIN]+[f.REPO/'tools'/name for name in ('v3d-bench.mjs','v3d-bench-metrics.mjs',
              'v3d-bench-samples.mjs','v3d-bench-pixels.mjs','cdx-v3d-clarity-metrics.mjs')]
    declaration['immutableFiles']={str(file):f.digest(file.read_bytes()) for file in files}
    f.configure(declaration)  # Read-only: rejects live old coordinator, wrong commit, or missing blockers.
    if (f.CONTROL/'declaration-prepared.json').exists():
        raise RuntimeError('Prior finalization evidence exists; preserve it and review explicitly.')
    (f.CONTROL/'declaration-prepared.json').write_bytes((f.CONTROL/'declaration.json').read_bytes())
    f.atomic_json(f.CONTROL/'declaration.json',declaration)
    print(__import__('json').dumps({'finalized':True,'declarationSha256':f.digest((f.CONTROL/'declaration.json').read_bytes()),
                                   'noNativeLaunch':True,'noSignals':True}))

if __name__=='__main__':main()
