"""Read-only scheduling diagnostics; does not create CPU load or alter affinity."""
from pathlib import Path
import json,os,resource,signal,sys,time

out=Path(sys.argv[1]).open('w',buffering=1)
running=True
def stop(*args):
    global running
    running=False
signal.signal(signal.SIGINT,stop)
signal.signal(signal.SIGTERM,stop)
pids=[]
next_scan=0
started=time.monotonic()
samples=0
while running:
    now=time.monotonic()
    if now>=next_scan:
        next_scan=now+1
        pids=[]
        for proc in Path('/proc').glob('[0-9]*'):
            try:
                cmd=(proc/'cmdline').read_bytes().replace(b'\x00',b' ')
                if b'--type=renderer' in cmd and b'chrome' in cmd:
                    pids.append(proc.name)
            except (OSError,ProcessLookupError):
                pass
    row={'wall_ms':time.time_ns()/1e6,'monotonic_ms':time.monotonic_ns()/1e6,'renderers':{}}
    try:
        row['cgroup_cpu']={line.split()[0]:int(line.split()[1]) for line in Path('/sys/fs/cgroup/cpu.stat').read_text().splitlines()}
    except OSError:
        pass
    for pid in pids:
        try:
            runtime,runqueue,slices=map(int,Path('/proc',pid,'schedstat').read_text().split())
            row['renderers'][pid]={'runtime_ns':runtime,'runqueue_wait_ns':runqueue,'slices':slices}
            status=Path('/proc',pid,'status').read_text().splitlines()
            for line in status:
                if line.startswith(('voluntary_ctxt_switches:','nonvoluntary_ctxt_switches:')):
                    name,value=line.split(':',1)
                    row['renderers'][pid][name]=int(value.strip())
        except (OSError,ValueError):
            pass
    row['observer_work_ms']=(time.monotonic()-now)*1000
    out.write(json.dumps(row,separators=(',',':'))+'\n')
    samples+=1
    remaining=.025-(time.monotonic()-now)
    if remaining>0:
        time.sleep(remaining)
usage=resource.getrusage(resource.RUSAGE_SELF)
out.write(json.dumps({'kind':'observer-summary','interval_ms':25,'samples':samples,'elapsed_s':time.monotonic()-started,'user_cpu_s':usage.ru_utime,'system_cpu_s':usage.ru_stime})+'\n')
out.close()
