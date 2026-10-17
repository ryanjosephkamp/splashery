import bisect,json,sys
from pathlib import Path

summary=Path(sys.argv[1]);monitor=Path(sys.argv[2])
data=json.loads(summary.read_text())
samples=[json.loads(line) for line in monitor.read_text().splitlines()]
footer=[r for r in samples if r.get('kind')=='observer-summary']
samples=[r for r in samples if 'wall_ms' in r]
times=[r['wall_ms'] for r in samples]
for row in data['rows']:
    d=row.get('diagnostic')
    if not d or not d['starts']:continue
    first=d['starts'][0]
    start=d['timeOrigin']+d['tapAt'];end=d['timeOrigin']+first['at']
    left=bisect.bisect_right(times,start)-1;right=bisect.bisect_left(times,end)
    if left<0 or right>=len(times):continue
    a,b=samples[left],samples[right]
    candidates=[p for p in (row.get('process_map') or {}).get('processInfo',[]) if p['type']=='renderer']
    renderer={}
    for p in candidates:
        pid=str(p['id']);x=a['renderers'].get(pid);y=b['renderers'].get(pid)
        if x and y:
            renderer[pid]={'cdp_cpu_time_s':p['cpuTime'],'runtime_delta_ms':(y['runtime_ns']-x['runtime_ns'])/1e6,'runqueue_wait_delta_ms':(y['runqueue_wait_ns']-x['runqueue_wait_ns'])/1e6,'slices_delta':y['slices']-x['slices']}
            for name in ['voluntary_ctxt_switches','nonvoluntary_ctxt_switches']:
                if name in x and name in y:renderer[pid][name+'_delta']=y[name]-x[name]
    row['scheduler_observation']={
        'bracket_wall_ms':[a['wall_ms'],b['wall_ms']],
        'bracket_duration_ms':b['wall_ms']-a['wall_ms'],
        'critical_interval_wall_ms':[start,end],
        'sampling_slack_before_ms':start-a['wall_ms'],
        'sampling_slack_after_ms':b['wall_ms']-end,
        'renderer_candidates':renderer,
        'cgroup_delta':{k:b['cgroup_cpu'][k]-a['cgroup_cpu'][k] for k in a.get('cgroup_cpu',{}) if k in b.get('cgroup_cpu',{})},
        'limitation':'Counters bracket the critical interval; they do not locate off-CPU time within the sampling slack.'
    }
data['observer_summary']=footer
data['observer_work_ms']={'samples':len(samples),'max':max(r['observer_work_ms'] for r in samples),'mean':sum(r['observer_work_ms'] for r in samples)/len(samples)}
summary.with_name('scheduler-summary.json').write_text(json.dumps(data,indent=2))
for row in data['rows']:
    if row.get('delay_ms',0)>=15:
        print(json.dumps({k:v for k,v in row.items() if k not in ['diagnostic','process_map']},separators=(',',':')))
print(json.dumps({'observer_summary':footer,'observer_work_ms':data['observer_work_ms']}))
