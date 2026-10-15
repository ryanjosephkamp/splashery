#!/usr/bin/env python3
"""MIT. Made by Ryan with Codex (GPT-6). Read-only native drain, then strict CPU R9 join only."""
import copy
import datetime as dt
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import time

ROOT=Path('/workspace/v3d-r4-media')
CONTROL=ROOT/'follow-r9-final-reconcile-r1-control'
HANDOFF=ROOT/'follow-r10-v1-control/prior-native-handoff.json'
OLD_CONTROL=ROOT/'follow-r9-v1-control'
LIMIT=dt.datetime(2026,10,15,16,15,tzinfo=dt.timezone.utc)
spec=importlib.util.spec_from_file_location('r9_reconciliation_only',ROOT/'follow-r9-v1.py')
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
def digest(data):return hashlib.sha256(data).hexdigest()
def write(name,value):f.atomic_json(CONTROL/name,value)
def inventory(summary):
    return {row['directory']:{key:row[key] for key in ('provenanceSha256','runSha256','rows','attempts')} for row in summary['runs']}
def event(kind,**fields):
    row={'at':f.now().isoformat(),'event':kind,**fields}
    with (CONTROL/'events.jsonl').open('a') as out:out.write(json.dumps(row,sort_keys=True)+'\n')
    print(json.dumps(row,sort_keys=True),flush=True)
def main():
    if (CONTROL/'started.json').exists():raise RuntimeError('One reconciliation watcher only; preserve previous launch.')
    handoff_bytes=HANDOFF.read_bytes();handoff=json.loads(handoff_bytes)
    declaration_bytes=(OLD_CONTROL/'declaration.json').read_bytes();declaration=json.loads(declaration_bytes)
    state_bytes=(OLD_CONTROL/'state.json').read_bytes();state=json.loads(state_bytes)
    parent=handoff['coordinator']
    if parent['pid']!=196899 or parent['startTicks']!='1642582' or parent.get('retiredByRoot') is not True or f.old_alive(parent):
        raise RuntimeError('Root must retire the exact R9 Python parent; this watcher never signals it.')
    write('started.json',{'at':f.now().isoformat(),'pid':os.getpid(),'codeSha256':digest(Path(__file__).read_bytes()),
                          'handoffSha256':digest(handoff_bytes),'r9DeclarationSha256':digest(declaration_bytes),
                          'r9OriginalStateSha256':digest(state_bytes),'deadline':LIMIT.isoformat(),
                          'noSignals':True,'noNativeLaunch':True,'noR10StateMutation':True})
    (CONTROL/'root-handoff.json').write_bytes(handoff_bytes)
    (CONTROL/'r9-declaration-original.json').write_bytes(declaration_bytes)
    (CONTROL/'r9-state-original.json').write_bytes(state_bytes)
    bindings={profile:([row['native']] if row.get('native') else [])+list(row['descendants'].values())
              for profile,row in handoff['profiles'].items()}
    previous=None
    while f.now()<LIMIT:
        if f.old_alive(parent):raise RuntimeError('Exact retired R9 parent became live; do not reconcile.')
        for profile,known in bindings.items():
            roots=[row['pid'] for row in known if f.old_alive(row)]
            observed=f.descendant_bindings(roots)
            identities={(row['pid'],row['startTicks']) for row in known}
            known.extend(row for row in observed.values() if (row['pid'],row['startTicks']) not in identities)
        alive={profile:[row for row in known if f.old_alive(row)] for profile,known in bindings.items()}
        write('blockers.json',{'checkedAt':f.now().isoformat(),'bound':bindings,'alive':alive})
        key=tuple((profile,tuple((row['pid'],row['startTicks']) for row in live)) for profile,live in alive.items())
        if key!=previous:
            event('native-drain-status',alive={profile:[{'pid':row['pid'],'startTicks':row['startTicks']} for row in live] for profile,live in alive.items()})
            previous=key
        if not any(alive.values()):break
        time.sleep(5)
    else:
        write('result.json',{'status':'deadline-before-all-prior-native-exited','at':f.now().isoformat(),
                            'noSignals':True,'noNativeLaunch':True,'alive':alive})
        return
    # These are the unchanged frozen R9 exported orchestration functions. Never call main/worker.
    f.configure(declaration)
    f.CONTROL=CONTROL
    f.SNAPSHOTS=ROOT/'candidate-r9-final-reconcile-snapshots-r1'
    if f.SNAPSHOTS.exists():raise RuntimeError('Fresh final snapshot root required.')
    original_link=str(f.MASTER.resolve()) if f.MASTER.is_symlink() else None
    state['reconciliation']={'at':f.now().isoformat(),'originalStateSha256':digest(state_bytes),
                              'previousAggregate':copy.deepcopy(state.get('aggregate')),
                              'previousMasterTarget':original_link,'noNativeLaunch':True}
    state.pop('aggregate',None);state['aggregateAttemptOrdinal']=0
    write('state.json',state)
    before=f.inspect(state,declaration);write('validated-before.json',before)
    f.aggregate(state,declaration,force=True)
    if 'aggregate' not in state:raise RuntimeError('Strict R9 aggregate did not produce a final snapshot; inspect logs.')
    after=f.inspect(state,declaration);write('validated-after.json',after)
    if inventory(before)!=inventory(after):raise RuntimeError('R9 raw row/result/artifact bytes changed during reconciliation.')
    if (OLD_CONTROL/'state.json').read_bytes()!=state_bytes or (OLD_CONTROL/'declaration.json').read_bytes()!=declaration_bytes:
        raise RuntimeError('Original R9 control state/declaration changed; reconciliation expected no writers.')
    paired=[run for run in after['runs'] if run['provenanceSha256']==f.PAIRED]
    unpaired=[run for run in after['runs'] if run['provenanceSha256']==f.UNPAIRED]
    joined=f.read_json(Path(state['aggregate']['snapshot'])/'run.json')
    summary={'status':'strict-final-r9-paired-snapshot','at':f.now().isoformat(),
             'sourceRunCounts':{'paired':len(paired),'unpaired':len(unpaired)},
             'recordedRows':{'paired':sum(len(r['rows']) for r in paired),'unpaired':sum(len(r['rows']) for r in unpaired)},
             'snapshot':state['aggregate']['snapshot'],'runSha256':state['aggregate']['runSha256'],
             'pairedProvenanceSha256':f.PAIRED,'unpairedProvenanceSha256':f.UNPAIRED,
             'comparison':state['aggregate']['comparison'],'coverage':state['aggregate']['coverage'],
             'master':str(f.MASTER),'rows':[{'id':r['id'],'profile':r['profile'],'status':r['status'],'mean':r.get('mean')} for r in joined['results']],
             'unpairedRunsPreserved':unpaired,'originalControlUnchanged':True,'rawRowsArtifactsUnchanged':True,
             'noSignals':True,'noNativeLaunch':True,'noR10StateMutation':True,
             'limitations':'Missing/unaccounted cases still block strict acceptance; emulator shared-load timing is not physical-phone or isolated performance.'}
    write('result.json',summary);event('reconciliation-complete',snapshot=summary['snapshot'],rows=summary['recordedRows'],comparison=summary['comparison'])
if __name__=='__main__':
    try:main()
    except Exception as error:
        write('error.json',{'at':f.now().isoformat(),'error':repr(error),'noSignals':True,'noNativeLaunch':True})
        raise
