#!/usr/bin/env python3
"""Create a transparent partial envelope from saved receipts; originals are never rewritten."""
import argparse,datetime,hashlib,json,subprocess
from pathlib import Path

def sha(b):return hashlib.sha256(b).hexdigest()
def canonical(v):return json.dumps(v,sort_keys=True,separators=(',',':'),allow_nan=False)
def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--stem',default='buddha24-phone-loo200');ap.add_argument('--repo',type=Path,default=Path.cwd());args=ap.parse_args();repo=args.repo.resolve();base=repo/'.cache/photos3d/round2';runs=base/'runs'
 if Path(args.stem).name!=args.stem:ap.error('--stem must be a receipt basename')
 paths={'header':runs/(args.stem+'.json'),'folds':runs/(args.stem+'.folds.jsonl'),'checkpoint':runs/(args.stem+'.geometry.json')};raw={k:p.read_bytes() for k,p in paths.items()};header=json.loads(raw['header']);cp=json.loads(raw['checkpoint']);lines=raw['folds'].splitlines(keepends=True)
 if header.get('status')!='running':raise ValueError('Original header is not explicitly running')
 if not lines or any(not line.strip() for line in lines):raise ValueError('Expected nonempty, finished raw JSONL rows')
 folds=[json.loads(line) for line in lines]
 if any(f.get('status') not in ('complete','failed','unregistered') for f in folds):raise ValueError('An incremental row is unfinished or unknown')
 names=[f.get('heldOut') for f in folds]
 if len(names)!=len(set(names)):raise ValueError('Duplicate saved fold identities')
 sources=cp['sources'];planned=sorted(s['name'] for s in sources)
 if header['provenance']['options'].get('folds')!='all':raise ValueError('This recovery protocol requires an all-input fold plan')
 if not set(names)<=set(planned):raise ValueError('Saved fold outside input plan')
 cams=cp['recon']['cams'];registered={c['name'] for c in cams}
 for f in folds:
  if f['status']=='complete':
   if f.get('heldOut') not in registered or set(f['trainingNames'])!=registered-{f['heldOut']}:raise ValueError('Invalid completed fold training identities')
  elif f['status']=='unregistered' and f.get('heldOut') in registered:raise ValueError('Registered photo marked unregistered')
 counts={'planned':len(planned),'complete':sum(f['status']=='complete' for f in folds),'failed':sum(f['status']=='failed' for f in folds),'unregistered':sum(f['status']=='unregistered' for f in folds),'unfinished':len(planned)-len(folds)}
 out=runs/(args.stem+'-recovered.json');existing=json.loads(out.read_bytes()) if out.exists() else None
 origin=header['provenance']['commit'];ab=subprocess.check_output(['git','show',origin+':tools/assets.json'],cwd=repo);assets=json.loads(ab);record=next(r for r in assets['photos3dBenchmarks'] if r['id']==header['provenance']['options']['dataset']);runtime_record=record;current_commit=(existing or {}).get('recovery',{}).get('maskContext',{}).get('assetsCommit') or subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip();current_ab=subprocess.check_output(['git','show',current_commit+':tools/assets.json'],cwd=repo);current_assets=json.loads(current_ab);record=next(r for r in current_assets['photos3dBenchmarks'] if r['id']==runtime_record['id']);maskpath=repo/header['provenance']['options']['masks'];maskb=maskpath.read_bytes()
 if sha(maskb)!=record['evaluationMasks']['sha256']:raise ValueError('Current frozen annotation differs from the originating commit assets record')
 recovery={'schema':1,'derivedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Recover only finished incremental fold rows, in original JSONL order, from an interrupted running header. Geometry, camera identities, graph, lens/rejection records, and input hashes are copied from the completed checkpoint. Numeric fold values are copied without alteration. No elapsed total duration, missing view score, or completion result is inferred. All unobserved planned folds remain unfinished.','interruptionReason':'Owner-reported execution-environment interruption; the original Node client stopped before writing a final receipt.','rawInputs':{k:{'path':str(paths[k].relative_to(repo)),'bytes':len(b),'sha256':sha(b)} for k,b in raw.items()},'rawFoldLineHashes':[{'line':i+1,'bytes':len(line),'sha256':sha(line),'heldOut':folds[i].get('heldOut'),'status':folds[i]['status']} for i,line in enumerate(lines)],'plannedFrom':'All frozen input identities from checkpoint sources, sorted, matching the original folds=all invocation.','resultsStem':args.stem,'maskContext':{'path':str(maskpath.relative_to(repo)),'sha256':sha(maskb),'assetsCommit':current_commit,'assetsFileSha256':sha(current_ab),'runtimeAssetsCommit':origin,'runtimeAssetRecordContainsMaskHash':bool(runtime_record.get('evaluationMasks')),'dataset':record['id'],'basis':'Frozen annotation SHA from the later committed asset record, checked against the current cache annotation. The interrupted runtime did not reach its final mask-hash write, and its commit predates the mask-hash asset record. This is explicit present-day context, not proof of the bytes consumed by the interrupted runtime.'},'limitations':['Explicitly partial: unfinished folds have no measured result.','The total duration and first-view time of the interrupted invocation were not saved and are not reconstructed.','No final runtime mask hash was written, and the runtime commit predates the mask-hash asset record. Current frozen-mask context is checked, but is not direct proof of the mask bytes consumed by the interrupted runtime.']}
 chronology={}
 for role,p in [('mask',maskpath),('header',paths['header']),('folds',paths['folds'])]:
  values=subprocess.check_output(['stat','-c','%w|%y',str(p)],text=True).strip().split('|');st=p.stat();chronology[role]={'birth':values[0],'modified':values[1],'mtimeNs':st.st_mtime_ns,'bytes':st.st_size}
 chronology['maskModifiedBeforeHeader']=maskpath.stat().st_mtime_ns<paths['header'].stat().st_mtime_ns
 chronology['interpretation']='Supporting filesystem chronology only: the current annotation modification time precedes the running header, and JSONL later records completed folds. File timestamps do not establish the exact bytes consumed at runtime and do not substitute for a recorded runtime mask SHA.'
 recovery['filesystemChronology']=chronology
 if existing:recovery['derivedAt']=existing['recovery']['derivedAt']
 core={k:v for k,v in cp.items() if k not in ('sources','geometryProvenance','originalCheckpoint')}
 row={'kind':'task 104 round-two photo module; derived interrupted partial receipt','status':'interrupted','provenance':header['provenance'],'geometryProvenance':cp['geometryProvenance'],'recovery':recovery,'sources':sources,'settings':cp['settings'],'lenses':cp['lenses'],'rejected':cp['rejected'],'graph':cp['graph'],'decoded':[{'name':n} for n in cp['frameNames']],'cameras':cams,'points':len(cp['recon']['points']),'rmsBA':cp['recon'].get('rmsBA'),'checkpoint':core,'plannedFolds':planned,'folds':folds,'foldCounts':counts,'physicalPhone':False,'peakGpuMemory':None,'error':{'name':'InterruptedError','message':'Execution environment interrupted before final receipt; only saved finished folds are recovered. Unfinished planned folds are not scored.'}}
 # Prevent a concurrently resumed original from being mixed into this envelope.
 if any(paths[k].read_bytes()!=b for k,b in raw.items()):raise RuntimeError('Original artifact changed during recovery')
 data=(json.dumps(row,indent=2,allow_nan=False)+'\n').encode()
 if out.exists():
  existing=json.loads(out.read_bytes());a=existing.get('recovery',{}).copy();b=recovery.copy();a.pop('derivedAt',None);b.pop('derivedAt',None)
  if canonical(a)!=canonical(b) or canonical(existing.get('folds'))!=canonical(folds):
   old=a.copy();new=b.copy();new.pop('filesystemChronology',None)
   if 'filesystemChronology' not in old and canonical(old)==canonical(new) and canonical(existing.get('folds'))==canonical(folds):
    history=base/'recovery-history';history.mkdir(exist_ok=True);backup=history/(args.stem+'-recovered-before-chronology.json')
    if backup.exists() and backup.read_bytes()!=out.read_bytes():raise ValueError('History copy already differs')
    backup.write_bytes(out.read_bytes());tmp=out.with_suffix('.tmp');tmp.write_bytes(data);tmp.replace(out);print(json.dumps({'recovered':str(out.relative_to(repo)),'addedFilesystemChronology':True,'counts':counts,'sha256':sha(data)}));return
   raise ValueError('Existing recovery differs; refusing overwrite')
  print(json.dumps({'recovered':str(out.relative_to(repo)),'existingPreserved':True,'counts':counts,'sha256':sha(out.read_bytes())}));return
 out.write_bytes(data);print(json.dumps({'recovered':str(out.relative_to(repo)),'counts':counts,'sha256':sha(data)}))
if __name__=='__main__':main()
