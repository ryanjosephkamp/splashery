"""MIT. Made by Ryan with Codex (GPT-6). Read-only sparse-cloud radius audit."""
from pathlib import Path
import hashlib,json,datetime
import numpy as np
ROOT=Path(__file__).resolve().parent
raw=Path('/workspace/v3d-r4-media/seed-probe.json').read_bytes();sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(raw)=='a58563911299803f7b9203214ac7a67a19817d6709dc4d1797d30bfa562d910f'
c=json.loads(raw);p=np.array([v['X'] for v in c['recon']['points']],dtype=float);mean=p.mean(0);median=np.median(p,axis=0)
centers={};dists={}
for key,center in [('arithmeticMean',mean),('coordinateMedian',median)]:
 d=np.linalg.norm(p-center,axis=1);dists[key]=d
 centers[key]={'center':center.tolist(),'linearQuantileRadii':{str(q):float(np.quantile(d,q)) for q in [.5,.9,.95,.99,1.]},'nativeP90OrderStatistic':float(np.sort(d)[int(len(p)*.9)]),'radiusFloorApplied':False}
order=np.argsort(dists['coordinateMedian'])[::-1]
camrows=[]
for cam in c['recon']['cams']:
 frame=c['frames'][cam['imgIdx']];scale=frame['tw']/frame['fw'];R=np.array(cam['R']).reshape(3,3);t=np.array(cam['t']);v=p@R.T+t;z=v[:,2]
 u=cam['f']*scale*v[:,0]/z+cam.get('cx',frame['fw']/2)*scale
 y=cam.get('fy',cam['f'])*scale*v[:,1]/z+cam.get('cy',frame['fh']/2)*scale
 front=z>1e-6;inside=front&(u>=.5)&(y>=.5)&(u<frame['tw']-.5)&(y<frame['th']-.5)
 camrows.append({'imgIdx':cam['imgIdx'],'z':z,'u':u,'v':y,'front':front,'inside':inside})
outliers=[]
for rank,index in enumerate(order[:20]):
 evidence=[{'imgIdx':a['imgIdx'],'depth':float(a['z'][index]),'u':float(a['u'][index]),'v':float(a['v'][index]),'positiveDepth':bool(a['front'][index]),'insideRgbImage':bool(a['inside'][index])} for a in camrows]
 outliers.append({'rankByMedianDistance':rank+1,'index':int(index),'X':p[index].tolist(),'rgb':c['recon']['points'][index]['rgb'],'distanceFromMedian':float(dists['coordinateMedian'][index]),'distanceFromMean':float(dists['arithmeticMean'][index]),'meanShiftIfRemovedNorm':float(np.linalg.norm((mean-p[index])/(len(p)-1))),'positiveDepthCameras':sum(e['positiveDepth'] for e in evidence),'insideRgbCameras':sum(e['insideRgbImage'] for e in evidence),'projections':evidence})
leverage=[]
for n in [1,2,5,10,20]:
 kept=np.delete(p,order[:n],axis=0);shift=kept.mean(0)-mean
 leverage.append({'removedMostDistantFromMedian':n,'newMean':kept.mean(0).tolist(),'shiftNorm':float(np.linalg.norm(shift)),'newMeanP90Radius':float(np.quantile(np.linalg.norm(kept-kept.mean(0),axis=1),.9)),'nativeP90OrderStatistic':float(np.sort(np.linalg.norm(kept-kept.mean(0),axis=1))[int(len(kept)*.9)])})
report={'created':datetime.datetime.now(datetime.timezone.utc).isoformat(),'cacheSha256':sha(raw),'codeSha256':sha(Path(__file__).read_bytes()),'n':len(p),'centers':centers,'centerSeparation':float(np.linalg.norm(mean-median)),'nativeToPlaneRadiusRatio':centers['arithmeticMean']['nativeP90OrderStatistic']/centers['coordinateMedian']['linearQuantileRadii']['0.9'],'coordinateQuantiles':{str(q):np.quantile(p,q,axis=0).tolist() for q in [0,.01,.05,.5,.9,.95,.99,1]},'worstOutliers':outliers,'meanLeverageRemoval':leverage,'allCloudProjectionSummary':[{'imgIdx':a['imgIdx'],'positiveDepth':int(a['front'].sum()),'insideRgbImage':int(a['inside'].sum()),'depthQuantiles':{str(q):float(np.quantile(a['z'],q)) for q in [0,.01,.5,.9,.99,1]}} for a in camrows],'interpretationLimits':['Projection inside an image does not certify actual accepted SfM track visibility.','No points are removed; leverage removal rows are read-only counterfactual arithmetic, not a proposed geometry filter.','Plane threshold remains the preregistered coordinate-median P90 radius; no refit with a looser threshold.'],'noHeldoutImages':True,'noGpu':True}
(ROOT/'radius-audit.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['worstOutliers','allCloudProjectionSummary']},indent=2));print(json.dumps({'worstOutliers':[ {k:v for k,v in v.items() if k!='projections'} for v in outliers[:5]]},indent=2))
