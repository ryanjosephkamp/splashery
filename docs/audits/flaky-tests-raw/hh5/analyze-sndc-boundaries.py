from pathlib import Path
import json,re,sys

report=Path(sys.argv[1])
data=json.loads(report.read_text())
rows=[]
def walk(suites):
    for suite in suites:
        for spec in suite.get('specs',[]):
            for test in spec.get('tests',[]):
                for result in test.get('results',[]):
                    stdout=''.join(e.get('text','') for e in result.get('stdout',[]))
                    matches=re.findall(r'^SNDC_BOUNDARIES (.*)$',stdout,re.M)
                    d=json.loads(matches[-1]) if matches else None
                    maps=re.findall(r'^SNDC_PROCESS_MAP (.*)$',stdout,re.M)
                    process_map=json.loads(maps[-1]) if maps else None
                    row={'title':spec['title'],'repeat':test.get('repeatEachIndex'),'status':result['status'],'retry':result.get('retry'),'duration_ms':result.get('duration'),'error':result.get('error',{}).get('message'),'process_map':process_map,'diagnostic':d}
                    if d and d['starts']:
                        first=d['starts'][0]
                        wall=first['at']-d['tapAt'];lead=max(0,first['when']-first['now'])*1000
                        row.update(wall_ms=wall,native_lead_ms=lead,delay_ms=wall+lead,native_clock_read_before_dispatch=first['when']-.005,native_clock_at_start=first['now'])
                        events=[e for e in d['events'] if d['tapAt']<=e['at']<=first['at']]
                        events.append({'name':'Original.start:timestamp','at':first['at']})
                        gaps=[{'from':a['name'],'to':b['name'],'gap_ms':b['at']-a['at']} for a,b in zip(events,events[1:])]
                        row['largest_adjacent_gaps']=sorted(gaps,key=lambda a:a['gap_ms'],reverse=True)[:8]
                    rows.append(row)
        walk(suite.get('suites',[]))
walk(data.get('suites',[]))
out={'stats':data.get('stats'),'rows':rows}
report.with_name('boundary-summary.json').write_text(json.dumps(out,indent=2))
for row in rows:
    print(json.dumps({k:v for k,v in row.items() if k!='diagnostic'},separators=(',',':')))
