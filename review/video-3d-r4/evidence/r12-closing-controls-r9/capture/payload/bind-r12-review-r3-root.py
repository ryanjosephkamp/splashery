"""Actual root observation for the one authorized diagnostic review. MIT."""
import copy, importlib.util, json
from pathlib import Path
r=Path('/workspace/v3d-r4-media');c=r/'review-r12-r3-control';p=r/'review-r12-r1-control'
s=importlib.util.spec_from_file_location('queue',r/'queue-r12-review-r3.py');q=importlib.util.module_from_spec(s);s.loader.exec_module(q)
assert not (c/'root-timed-work-receipt.json').exists()
q.assert_prior_unreserved()
old=q.read(p/'root-timed-work-receipt.json');roots=copy.deepcopy(old['timedRoots'])
launch=q.read(r/'samples-postmerge-r1-control/launch.json')
roots['postmerge-samples']={'root':launch['controller'],'descendants':{str(launch['native']['pid']):launch['native']},'completeObservedDescendants':True}
observations={}
for role,row in roots.items():
    seen=[row['root'],*row['descendants'].values()]
    scan=q.scan_descendants(seen)
    assert not scan['enumerationUnresolved'],scan['enumerationUnresolved']
    assert not any(q.is_unresolved(x) for x in scan['observations'])
    for x in scan['observations']:
        if q.identity_key(x) not in {q.identity_key(b) for b in seen}:
            row['descendants'][str(x['pid'])]={k:x[k] for k in ('pid','startTicks','command')}
    observations[role]={'rootObservation':q.process_identity(row['root']['pid']),'currentDescendants':scan}
q.validate_roots(roots)
known={q.identity_key(b) for row in roots.values() for b in [row['root'],*row['descendants'].values()]}
global_scan=q.scan_graphics_blockers();assert not global_scan['enumerationUnresolved']
assert not any(q.is_unresolved(x) for x in global_scan['observations'])
extra=[]
for x in global_scan['observations']:
    if q.identity_key(x) in known:continue
    b={k:x[k] for k in ('pid','startTicks','command')}
    extra.append({'root':b,'descendants':{},'completeObservedDescendants':True,'capturedAt':q.now().isoformat(),'readOnly':True,'reason':'Actual live graphics process outside the five root descendant inventories. Global descendants are independently enumerated; this inventory grants no signaling ownership.'})
    known.add(q.identity_key(x))
receipt=q.read(c/'root-receipt-template.json');receipt.update(status='actual-root-observed',capturedAt=q.now().isoformat(),authorization='Root authorizes one R12 diagnostic review under task 88, after 16:15 UTC and all five timed roles, retained historical descendants, and read-only global graphics blockers are quiet. No timed-work signals or benchmark acceptance are authorized by this review receipt.',candidateProvenanceSha256=q.EXPECTED_CANDIDATE_PROVENANCE,candidateServedSourceSha256=q.EXPECTED_CANDIDATE_SOURCE,timedRoots=roots,extraQuietBlockers=extra,extraQuietInventoryComplete=True)
q.validate_extra_blockers(extra,True,roots)
ended=q.read(r/'review-r12-r1-exit-observation-r1.json');prior=ended['actualKernelObservation'];actual=q.process_identity(prior['pid']);assert actual['startTicks']==prior['startTicks'] and actual['state']=='Z'
t=q.read(c/'takeover-observed-ended-template.json');t.update(status='actual-root-observed-ended-no-signals',capturedAt=q.now().isoformat(),priorWatcher={'pid':prior['pid'],'startTicks':prior['startTicks'],'command':ended['originalCommandFromLaunchReceipt']},priorWatcherObservedEnded=True,timedRootsNotSignaled=True,noR1RenderReservation=True,noR1RenderOutput=True,watcherObservation=prior,r1DeclarationSha256=q.digest((p/'declaration.json').read_bytes()),r1RootReceiptSha256=q.digest((p/'root-timed-work-receipt.json').read_bytes()),r1RetiredQuietStateSha256=q.digest((p/'quiet-state.json').read_bytes()),r1ErrorLogSha256=ended['errorLogSha256'],r1OriginalLaunchSha256=q.digest((p/'queue-launch.json').read_bytes()),r1ExitObservationSha256=q.digest((r/'review-r12-r1-exit-observation-r1.json').read_bytes()))
q.validate_takeover(t);q.check_observed_ended_files(t)
q.write(r/'review-r12-r3-actual-root-receipt.json',receipt);q.write(r/'review-r12-r3-actual-takeover-receipt.json',t);q.write(r/'review-r12-r3-root-observations.json',{'capturedAt':q.now().isoformat(),'timed':observations,'global':global_scan,'signalsSent':[]})
print(json.dumps({'captured':True,'fiveRoots':{k:len(v['descendants']) for k,v in roots.items()},'globalGraphics':len(global_scan['observations']),'extraReadOnlyBlockers':len(extra),'signalsSent':[]}))
