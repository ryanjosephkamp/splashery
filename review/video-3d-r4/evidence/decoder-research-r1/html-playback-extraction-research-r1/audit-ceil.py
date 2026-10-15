"""MIT. Made by Ryan with Codex (GPT-6). CPU-only timing audit, never relabels source times."""
from pathlib import Path
import json

ROOT=Path(__file__).resolve().parent
run=json.loads((ROOT/'results.json').read_text())
if not run.get('endedAt'):
    raise RuntimeError('Wait for closed research browser.')
rows=[]
for row in run['results']:
    times=[float(f['best_effort_timestamp_time']) for f in json.loads((ROOT/(row['id']+'-ffprobe.json')).read_text())['frames']]
    samples=[]
    if row.get('photos') and row['status']=='verified':
        for photo,receipt in zip(row['photos'],row['receipts']['matchedTraining']):
            expected=next(i for i,t in enumerate(times) if t>=photo['requestedTime']-1e-6)
            samples.append({'kind':'selected','requestedTime':photo['requestedTime'],'recordedTime':photo['presentedTime'],
                            'matchedSourceIndex':receipt['sourceIndex'],'ceilIndex':expected,
                            'framesAfterCeil':receipt['sourceIndex']-expected})
    for trial in row.get('progress',[]):
        if trial['kind']!='trial':
            continue
        index=next((i for i,t in enumerate(times) if abs(t-trial['actualTime'])<=1e-6),None)
        expected=next(i for i,t in enumerate(times) if t>=trial['requestedTime']-1e-6)
        samples.append({'kind':'trial','requestedTime':trial['requestedTime'],'recordedTime':trial['actualTime'],
                        'sourceIndexFromObservedTime':index,'ceilIndex':expected,
                        'framesAfterCeil':None if index is None else index-expected})
    rows.append({'id':row['id'],'profile':row['profile'],'method':row['method'],
                 'control':'cancel-after-first-actual-trial' if row.get('abortAfterTrials') else None,
                 'status':row['status'],'samples':samples})
(ROOT/'ceil-analysis.json').write_text(json.dumps({
    'notice':'Read-only audit only; R1 had no exact-ceil acceptance guard. Trial sourceIndex derives from observed PTS, not independent JPEG proof for unselected trials. No time or picture changed.',
    'rows':rows},indent=2)+'\n')
