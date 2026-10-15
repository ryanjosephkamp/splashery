"""MIT. Apply the declared outer stage boundary to only the original main subtree."""
import datetime as dt, hashlib, importlib.util, json, os, signal, time
from pathlib import Path
r=Path('/workspace/v3d-r4-media');control=r/'main-review-stage-boundary-r1/control'
control.mkdir(exist_ok=False)
s=importlib.util.spec_from_file_location('owned',r/'queue-r12-review-r3.py');q=importlib.util.module_from_spec(s);s.loader.exec_module(q)
declaration=q.read(control.parent/'declaration.json');cutoff=dt.datetime.fromisoformat(declaration['cutoffUtc'])
receipt=q.read(r/'review-r12-r3-actual-root-receipt.json')
row=receipt['timedRoots']['main-native']
assert row['root']==declaration['baselineRoot']
bindings=[row['root'],*row['descendants'].values()]
watch=q.Watch(bindings)
assert not watch.read_only and watch.global_blockers is None
q.write(control/'launch.json',{'createdAt':q.now().isoformat(),'controller':{k:q.process_identity(os.getpid())[k] for k in ('pid','startTicks','command')},'cutoffUtc':cutoff.isoformat(),'declarationSha256':q.digest((control.parent/'declaration.json').read_bytes()),'ownershipModuleSha256':q.digest((r/'queue-r12-review-r3.py').read_bytes()),'seedBindings':bindings,'seedReceiptSha256':q.digest((r/'review-r12-r3-actual-root-receipt.json').read_bytes()),'seedScope':'Only main-native. No other timed role, global blocker, or full R1 quiet history is signaling-owned.'})
term=[];kill=[];interrupted=False
while True:
 live=watch.refresh();at=q.now()
 q.write(control/'state.json',{'at':at.isoformat(),'observedBindings':list(watch.seen.values()),'liveBindings':live,'unresolved':q.unresolved_state(watch),'cutoffUtc':cutoff.isoformat()})
 if not live and not q.watch_unresolved(watch):break
 if at>=cutoff:
  interrupted=True
  term=q.signal_owned(watch,signal.SIGTERM)
  q.write(control/'signal-term.json',{'at':q.now().isoformat(),'sent':term,'signal':'SIGTERM','reason':'Declared outer orchestration stage boundary; affected work remains incomplete.'})
  until=time.monotonic()+5
  while time.monotonic()<until and (watch.refresh() or q.watch_unresolved(watch)):time.sleep(.1)
  kill=q.signal_owned(watch,signal.SIGKILL)
  q.write(control/'signal-kill.json',{'at':q.now().isoformat(),'sent':kill,'signal':'SIGKILL','scope':'Only retained main-native identities with matching actual startTicks.'})
  break
 time.sleep(1)
q.write(control/'result.json',{'finishedAt':q.now().isoformat(),'stageInterrupted':interrupted,'termSent':term,'killSent':kill,'observedBindings':list(watch.seen.values()),'remainingLive':watch.refresh(),'unresolved':q.unresolved_state(watch),'notice':'No benchmark rows, per-case deadlines, scores, or statuses were rewritten. Natural drain sends no signal. Outer interruption and unattempted cases cannot satisfy benchmark acceptance.'})
