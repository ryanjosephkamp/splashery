import csv,json,math,statistics
from pathlib import Path
root=Path('.cache/phone-speed')
def read(name):return json.loads((root/name).read_text())
plan=read('late-main-plan.json'); old=read('final-gates.json'); extra=read('late-main-gates.json'); catalog=read('merged-catalog.json'); index={x['id']:x for x in catalog}
with (root/'full-catalog.csv').open(newline='') as f:
 reader=csv.DictReader(f); fields=reader.fieldnames+['beforeSource','afterSource','collection']; rows=list(reader)
for row in rows:row.update(beforeSource=old['sources']['before'],afterSource=old['sources']['after'],collection='frozen-catalog')
before=read('late-main-paired/before.json'); after=read('late-main-paired/after.json')
for report in extra['rows']:
 id=report['id']; toy=index[id]; b=report['before']; a=report['after']; rb=[r for r in before if r['id']==id]; ra=[r for r in after if r['id']==id]
 assert report['valid'], 'Cannot publish a complete CSV with an invalid supplementary sample'
 def median(samples,key,scale=1):return statistics.median([r[key] for r in samples])/scale
 row={key:'' for key in fields}
 row.update(id=id,label=toy['label'],kind=toy['kind'],pack=toy.get('pack',''),repetitions=extra['repetitions'],splatsBefore=rb[0]['splats'],splatsAfter=ra[0]['splats'],canvasBefore='x'.join(map(str,rb[0]['canvas'])),canvasAfter='x'.join(map(str,ra[0]['canvas'])),firstViewBeforeMs=b['firstViewMs'],firstViewAfterMs=a['firstViewMs'],firstViewGainPct=100*report['changes']['firstViewMs'],idleBeforeMs=b['idle.median'],idleAfterMs=a['idle.median'],idleGainPct=100*report['changes']['idle.median'],idleP95BeforeMs=b['idle.p95'],idleP95AfterMs=a['idle.p95'],tapBeforeMs=b['tap.median'],tapAfterMs=a['tap.median'],tapP95BeforeMs=b['tap.p95'],tapP95AfterMs=a['tap.p95'],heapBeforeMiB=median(rb,'heapBytes',1048576),heapAfterMiB=median(ra,'heapBytes',1048576),transferBeforeMiB=median(rb,'transferBytes',1048576),transferAfterMiB=median(ra,'transferBytes',1048576),bodyBeforeMiB=median(rb,'bodyBytes',1048576),bodyAfterMiB=median(ra,'bodyBytes',1048576),requestsBefore=median(rb,'requests'),requestsAfter=median(ra,'requests'),selected='false',valid='true',beforeSource=plan['before'],afterSource=plan['after'],collection='main-addition')
 rows.append(row)
assert len(rows)==len(index)==len({r['id'] for r in rows})
assert set(index)=={r['id'] for r in rows}
with (root/'full-catalog-with-main.csv').open('w',newline='') as f:
 writer=csv.DictWriter(f,fieldnames=fields,quoting=csv.QUOTE_ALL); writer.writeheader(); writer.writerows(rows)
gates={**old['gates'],'coverage':old['gates']['coverage'] and extra['gates']['coverage'],'noRegressions':old['gates']['noRegressions'] and extra['gates']['noRegressions']}
report={'originalCount':len(old['rows']),'mergedCount':len(rows),'medianGain':old['medianGain'],'sources':{'frozen':old['sources'],'mainAddition':extra['sources']},'gates':gates,'regressions':[{'collection':'frozen-catalog',**r} for r in old['regressions']]+[{'collection':'main-addition',**r} for r in extra['regressions']]}
(root/'full-catalog-with-main-gates.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'mergedCatalog':len(rows),'gates':gates,'regressions':len(report['regressions'])}))
