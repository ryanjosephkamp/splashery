#!/usr/bin/env python3
"""MIT. Made by Ryan with Codex (GPT-6). One authorized, quiet-window R12 review invocation."""
import argparse
import copy
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time

ROOT=Path('/workspace/v3d-r4-media')
CONTROL=ROOT/'review-r12-r1-control'
TOOLS=Path('/workspace/splashery-v3d-bench-tools-r12')
MANIFEST=TOOLS/'tools/v3d-corpus.json'
REVIEW=TOOLS/'tools/v3d-review.mjs'
PLANNER=ROOT/'plan-r12-review-r1.mjs'
NODE='/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node'
MAIN=ROOT/'main-master-r1'
CANDIDATE=ROOT/'candidate-r12-paired-master-v1'
OUTPUT=ROOT/'review-r12-r1'
BASELINE='7c714d23fd839129b6abbf718460cd7bf5bad59c34988292a26e4c5046aa05e6'
ROLES=('main-native','r12-coordinator','r12-samples','r11-remaining')
QUIET=dt.datetime(2026,10,15,16,15,tzinfo=dt.timezone.utc)
SOFT=dt.datetime(2026,10,15,16,31,25,tzinfo=dt.timezone.utc)
STOP=dt.datetime(2026,10,15,16,31,30,tzinfo=dt.timezone.utc)
HARD=STOP-dt.timedelta(seconds=1) # Leave a host scheduling margin before the absolute stop.

def now():return dt.datetime.now(dt.timezone.utc)
def digest(data):return hashlib.sha256(data).hexdigest()
def read(file):return json.loads(Path(file).read_text())
def write(file,value):
    file=Path(file);temp=file.with_name(file.name+'.next')
    temp.write_text(json.dumps(value,indent=2)+'\n');os.replace(temp,file)
def event(kind,**fields):
    row={'at':now().isoformat(),'event':kind,**fields}
    with (CONTROL/'events.jsonl').open('a') as stream:
        stream.write(json.dumps(row,sort_keys=True)+'\n');stream.flush();os.fsync(stream.fileno())
    print(json.dumps(row),flush=True)
def identity_key(binding):return str(binding['pid'])+':'+binding['startTicks']
def validate_binding(binding):
    if (not isinstance(binding,dict) or type(binding.get('pid')) is not int or binding['pid']<1
        or not isinstance(binding.get('startTicks'),str) or not binding['startTicks'].isdigit()
        or not isinstance(binding.get('command'),list) or not binding['command']
        or any(not isinstance(arg,str) or not arg for arg in binding['command'])):
        raise ValueError('Actual PID/startTicks/original-command binding required.')
def validate_roots(roots):
    if not isinstance(roots,dict) or set(roots)!=set(ROLES):raise ValueError('All four root-bound timed-work roles required.')
    seen=set()
    for role,row in roots.items():
        if not isinstance(row,dict) or row.get('completeObservedDescendants') is not True or not isinstance(row.get('descendants'),dict):
            raise ValueError('Complete explicit descendant receipt required: '+role)
        validate_binding(row.get('root'))
        for pid,child in row['descendants'].items():
            validate_binding(child)
            if str(child['pid'])!=str(pid):raise ValueError('Descendant key differs from actual PID.')
        for binding in [row['root'],*row['descendants'].values()]:
            key=identity_key(binding)
            if key in seen:raise ValueError('Repeated root/descendant identity in authorization.')
            seen.add(key)
def same_live(binding,observed):
    return bool(observed and observed['startTicks']==binding['startTicks'] and observed['state']!='Z')
def process_identity(pid):
    try:
        p=Path('/proc')/str(pid);fields=(p/'stat').read_text().rsplit(')',1)[1].strip().split()
        return {'pid':pid,'startTicks':fields[19],'state':fields[0],'ppid':int(fields[1]),
                'session':int(fields[3]),'command':[v.decode(errors='replace') for v in (p/'cmdline').read_bytes().split(b'\0') if v]}
    except (FileNotFoundError,ProcessLookupError):return None
def scan_descendants(roots):
    # Used ONLY by an explicitly authorized running queue. Preparation/tests never call it.
    parents={}
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit():continue
        try:
            fields=(entry/'stat').read_text().rsplit(')',1)[1].strip().split();parents[int(entry.name)]=int(fields[1])
        except (FileNotFoundError,ProcessLookupError):pass
    active={b['pid'] for b in roots if same_live(b,process_identity(b['pid']))}
    owned=set(active)
    while True:
        more={pid for pid,parent in parents.items() if parent in owned}-owned
        if not more:break
        owned|=more
    found=[]
    for pid in sorted(owned-active):
        row=process_identity(pid)
        if row and row['state']!='Z':found.append({k:row[k] for k in ('pid','startTicks','command')})
    return found
class Watch:
    def __init__(self,bindings,identity=process_identity,descendants=scan_descendants):
        self.seen={identity_key(b):copy.deepcopy(b) for b in bindings};self.identity=identity;self.descendants=descendants
    def refresh(self):
        active=[b for b in self.seen.values() if same_live(b,self.identity(b['pid']))]
        for binding in self.descendants(active):
            validate_binding(binding);self.seen.setdefault(identity_key(binding),copy.deepcopy(binding))
        return [b for b in self.seen.values() if same_live(b,self.identity(b['pid']))]
def window_state(at,live):
    if at>=STOP:return 'closed'
    if at>=SOFT:return 'cleanup-only'
    if at<QUIET:return 'before-quiet-window'
    return 'timed-work-live' if live else 'ready'
def validate_declaration(d,check_files=True):
    if d.get('status')!='root-authorized' or not isinstance(d.get('authorization'),str) or not d['authorization'].strip():
        raise ValueError('Nonempty root authorization required; prepared declarations cannot run.')
    validate_roots(d.get('timedRoots'))
    if d.get('quietNotBefore')!=QUIET.isoformat() or d.get('cleanupStarts')!=SOFT.isoformat() or d.get('hardCleanup')!=HARD.isoformat() or d.get('absoluteStop')!=STOP.isoformat():
        raise ValueError('Fixed quiet/cleanup/absolute-stop times required.')
    if d.get('output')!=str(OUTPUT) or d.get('toolsRoot')!=str(TOOLS) or d.get('main')!=str(MAIN) or d.get('candidate')!=str(CANDIDATE):
        raise ValueError('Only the declared fresh R12 review paths are allowed.')
    for field in ('candidateProvenanceSha256','candidateServedSourceSha256','rootReceiptSha256'):
        value=d.get(field)
        if not isinstance(value,str) or len(value)!=64 or any(c not in '0123456789abcdef' for c in value):raise ValueError('Actual frozen hash required: '+field)
    expected=[str(Path(__file__).resolve()),str(PLANNER),str(ROOT/'test-queue-r12-review-r1.py'),str(REVIEW),str(MANIFEST),str(CONTROL/'root-timed-work-receipt.json'),str(CONTROL/'cpu-tests.log')]
    expected += [str(TOOLS/'tools'/name) for name in ('v3d-bench.mjs','v3d-bench-metrics.mjs','v3d-bench-samples.mjs','v3d-bench-pixels.mjs','cdx-v3d-clarity-metrics.mjs')]
    if not isinstance(d.get('immutableFiles'),dict) or any(file not in d['immutableFiles'] for file in expected):raise ValueError('Code/tool/manifest/CPU/root receipt must be hash-bound.')
    if d['immutableFiles'][str(CONTROL/'root-timed-work-receipt.json')]!=d['rootReceiptSha256']:raise ValueError('Root receipt hash disagrees.')
    if check_files:
        for file,expected_hash in d['immutableFiles'].items():
            if digest(Path(file).read_bytes())!=expected_hash:raise ValueError('Changed immutable queue input: '+file)
        receipt=read(CONTROL/'root-timed-work-receipt.json')
        if receipt['timedRoots']!=d['timedRoots'] or receipt['authorization']!=d['authorization']:raise ValueError('Actual root receipt differs from declaration.')
def planner_request(d):
    return {'toolsRoot':str(TOOLS),'manifest':str(MANIFEST),'main':str(MAIN),'candidate':str(CANDIDATE),
            'mainUrl':'http://127.0.0.1:4174/','candidateUrl':'http://127.0.0.1:4183/','mainProvenance':BASELINE,
            'candidateProvenance':d.get('candidateProvenanceSha256'),'candidateServedSource':d.get('candidateServedSourceSha256')}
def enforce_append(previous,current):
    if 'observedRows' not in previous:return
    if 'observedRows' not in current:raise ValueError('Previously observed master disappeared.')
    if previous['provenanceSha256']!=current['provenanceSha256']:raise ValueError('Review source/provenance changed.')
    for before,after in zip(previous['observedRows'],current['observedRows']):
        if any(after.get(key)!=value for key,value in before.items()):raise ValueError('Observed immutable row altered/removed.')
    for id,binding in previous['bindings'].items():
        if current['bindings'].get(id)!=binding:raise ValueError('Observed pair artifacts altered/removed: '+id)
def plan(d):
    result=subprocess.run([NODE,str(PLANNER)],input=json.dumps(planner_request(d)),text=True,capture_output=True,timeout=120,cwd=TOOLS)
    if result.returncode:raise ValueError('Strict CPU review planning rejected evidence: '+result.stderr[-6000:])
    current=json.loads(result.stdout);old=read(CONTROL/'plan.json') if (CONTROL/'plan.json').exists() else {}
    enforce_append(old,current)
    current['plannedAt']=now().isoformat();write(CONTROL/'plan.json',current)
    with (CONTROL/'plan-history.jsonl').open('a') as stream:stream.write(json.dumps(current)+'\n')
    return current
def render_command(plan_row):
    ids=plan_row.get('selected',[])
    if not 1<=len(ids)<=10 or len(ids)!=len(set(ids)) or plan_row.get('ranked') is not False:raise ValueError('One to ten distinct verified unranked pairs required.')
    return [NODE,str(REVIEW),'render',str(MANIFEST),*plan_row['snapshots'],str(OUTPUT),'--profile=phone','--ids='+','.join(ids),
            '--size=390x844','--seconds=5','--fps=12','--timeout=90000','--main-url=http://127.0.0.1:4174/','--candidate-url=http://127.0.0.1:4183/']
def signal_owned(watch,sig,send=os.kill):
    sent=[]
    for b in watch.refresh():
        if same_live(b,watch.identity(b['pid'])):
            try:send(b['pid'],sig);sent.append(identity_key(b))
            except ProcessLookupError:pass
    return sent
def cleanup_owned(watch,at,sig,send=os.kill):
    if at<SOFT:raise ValueError('No owned-render cleanup before its deadline.')
    if sig not in (signal.SIGTERM,signal.SIGKILL):raise ValueError('Unsupported cleanup signal.')
    if sig==signal.SIGKILL and at<HARD:raise ValueError('Hard cleanup only within the final cleanup margin.')
    return signal_owned(watch,sig,send)
def monitor_render(child,owned,clock=now,sleep=time.sleep,record=None,emit=event,send=os.kill):
    """The deadline applies to only this invocation; timed-work bindings never enter owned."""
    if record is None:record=lambda row:write(CONTROL/'owned-render-state.json',row)
    terminated=False
    while True:
        live=owned.refresh();at=clock();code=child.poll()
        record({'at':at.isoformat(),'observedBindings':list(owned.seen.values()),'liveBindings':live,'returncode':code})
        if code is not None and not live:return {'returncode':code,'deadlineInterrupted':terminated}
        if at>=SOFT and not terminated:
            emit('own-render-deadline-term',sent=cleanup_owned(owned,at,signal.SIGTERM,send));terminated=True
        if at>=HARD:
            emit('own-render-hard-cleanup-before-absolute-stop',sent=cleanup_owned(owned,at,signal.SIGKILL,send))
            return {'returncode':child.poll(),'deadlineInterrupted':True,'hardKillRequested':True}
        sleep(min(.25,max(0.001,(HARD-at).total_seconds())))
def finalize(receipt_file):
    draft=read(CONTROL/'declaration.json')
    if draft.get('status')!='prepared-awaiting-root-bindings' or (CONTROL/'root-timed-work-receipt.json').exists():raise ValueError('Fresh pending declaration/receipt required.')
    receipt_bytes=Path(receipt_file).read_bytes();receipt=json.loads(receipt_bytes)
    if receipt.get('generation')!='R12-review' or not receipt.get('capturedAt'):raise ValueError('Actual timestamped root R12 review receipt required.')
    validate_roots(receipt.get('timedRoots'))
    draft.update(status='root-authorized',authorization=receipt.get('authorization'),timedRoots=receipt['timedRoots'],
                 candidateProvenanceSha256=receipt.get('candidateProvenanceSha256'),candidateServedSourceSha256=receipt.get('candidateServedSourceSha256'),
                 rootReceiptSha256=digest(receipt_bytes),finalizedAt=now().isoformat())
    import re
    tested=re.search(r'Ran (\d+) tests in ([\d.]+)s\s+OK\s*$',(CONTROL/'cpu-tests.log').read_text())
    if not tested or int(tested[1])<31:raise ValueError('Passing complete CPU test receipt with all31 controls required.')
    files=[Path(__file__).resolve(),PLANNER,ROOT/'test-queue-r12-review-r1.py',REVIEW,MANIFEST,CONTROL/'cpu-tests.log']
    files += [TOOLS/'tools'/name for name in ('v3d-bench.mjs','v3d-bench-metrics.mjs','v3d-bench-samples.mjs','v3d-bench-pixels.mjs','cdx-v3d-clarity-metrics.mjs')]
    draft['immutableFiles']={str(p):digest(p.read_bytes()) for p in files}
    draft['immutableFiles'][str(CONTROL/'root-timed-work-receipt.json')]=digest(receipt_bytes)
    validate_declaration(draft,check_files=False)
    (CONTROL/'root-timed-work-receipt.json').write_bytes(receipt_bytes)
    (CONTROL/'declaration-prepared.json').write_bytes((CONTROL/'declaration.json').read_bytes())
    write(CONTROL/'declaration.json',draft)
    print(json.dumps({'finalized':True,'nativeOrBrowserLaunch':False,'livePidInspection':False}))
def run(d):
    validate_declaration(d)
    import fcntl
    with (CONTROL/'queue.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if (CONTROL/'launch.json').exists():raise ValueError('Single invocation already reserved; preserve evidence, never retry automatically.')
        bound=[b for row in d['timedRoots'].values() for b in [row['root'],*row['descendants'].values()]]
        watch=Watch(bound)
        while True:
            live=watch.refresh();at=now()
            write(CONTROL/'quiet-state.json',{'at':at.isoformat(),'observedBindings':list(watch.seen.values()),'liveBindings':live,'window':window_state(at,live)})
            if at>=SOFT:event('no-render-window-remaining');return
            if window_state(at,live)=='ready':break
            time.sleep(1)
        validate_declaration(d)
        selected=plan(d)
        if not selected.get('selected'):event('no-verified-pairs-no-render',status=selected['status']);return
        if window_state(now(),watch.refresh())!='ready':raise ValueError('Quiet/deadline gate changed before launch.')
        if OUTPUT.exists() or OUTPUT.is_symlink():raise ValueError('Review output must be fresh; partial evidence is never overwritten/retried.')
        command=render_command(selected)
        receipt={'reservedAt':now().isoformat(),'command':command,'selected':selected['selected'],'ranked':False,
                 'planSha256':digest((CONTROL/'plan.json').read_bytes()),'declarationSha256':digest((CONTROL/'declaration.json').read_bytes()),
                 'quietBindings':list(watch.seen.values()),'queueSentNoTimedWorkSignals':True}
        write(CONTROL/'launch.json',receipt) # Reserve BEFORE spawning; interruption never causes a retry.
        env=os.environ.copy();env['SPLASHERY_CHROMIUM']='/usr/bin/chromium'
        with (CONTROL/'render.log').open('xb') as log:
            child=subprocess.Popen(command,cwd=TOOLS,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
            binding=process_identity(child.pid)
            if not binding:raise ValueError('Could not bind newly owned renderer; preserve reserved attempt.')
            owned=Watch([{k:binding[k] for k in ('pid','startTicks','command')}])
            receipt.update(pid=child.pid,startTicks=binding['startTicks'],startedAt=now().isoformat());write(CONTROL/'launch.json',receipt)
            outcome=monitor_render(child,owned)
            write(CONTROL/'result.json',{'finishedAt':now().isoformat(),**outcome,
                    'output':str(OUTPUT),'selected':selected['selected'],'ranked':False,'notice':'Only captured review receipts establish finished movies; partial evidence is retained. No benchmark status/timing/quality acceptance is changed.'})
def main():
    parser=argparse.ArgumentParser(description=__doc__);mode=parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--plan',action='store_true');mode.add_argument('--check',action='store_true');mode.add_argument('--run',action='store_true');mode.add_argument('--finalize-root-receipt')
    args=parser.parse_args()
    if args.finalize_root_receipt:finalize(args.finalize_root_receipt);return
    d=read(CONTROL/'declaration.json')
    if args.plan:print(json.dumps(plan(d),indent=2));return
    validate_declaration(d)
    if args.check:print(json.dumps({'valid':True,'noLaunch':True,'noLivePidInspection':True}));return
    run(d)
if __name__=='__main__':main()
