"""MIT. Made by Ryan with Codex (GPT-6). Fixed-parameter CPU plane-support diagnostic."""
from pathlib import Path
import hashlib,json,time,datetime
import numpy as np

ROOT=Path(__file__).resolve().parent
CONFIG=json.loads((ROOT/'preregistered-config.json').read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
raw=Path(CONFIG['cache']['file']).read_bytes()
assert sha(raw)==CONFIG['cache']['sha256']
cache=json.loads(raw);points=np.array([p['X'] for p in cache['recon']['points']],dtype=np.float64)
assert points.shape==(614,3) and np.isfinite(points).all()
center=np.median(points,axis=0);radius=float(np.quantile(np.linalg.norm(points-center,axis=1),0.9))
threshold=radius*CONFIG['planes']['distanceThresholdRobustRadiusFraction']
minimum=max(CONFIG['planes']['minimumInliers'],int(np.ceil(CONFIG['planes']['minimumOriginalCloudFraction']*len(points))))
state=CONFIG['planes']['randomSeed']
def random():
    global state
    state^=(state<<13)&0xffffffff;state^=state>>17;state^=(state<<5)&0xffffffff;state&=0xffffffff
    return state/4294967296
def canonical(normal):
    return -normal if normal[int(np.argmax(np.abs(normal)))]<0 else normal
def residuals(p,normal,offset):return np.abs(p@normal+offset)
def hull2(points):
    values=sorted(set(map(tuple,points.tolist())))
    def cross(o,a,b):return (a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0])
    lower=[]
    for p in values:
        while len(lower)>=2 and cross(lower[-2],lower[-1],p)<=0:lower.pop()
        lower.append(p)
    upper=[]
    for p in reversed(values):
        while len(upper)>=2 and cross(upper[-2],upper[-1],p)<=0:upper.pop()
        upper.append(p)
    return np.array(lower[:-1]+upper[:-1],dtype=float)
def summary(normal,offset,indices):
    support=points[indices];centroid=np.mean(support,axis=0)
    # Deterministic orthonormal plane basis. It has no image-facing geometry assumption.
    axis=np.eye(3)[int(np.argmin(np.abs(normal)))];x=np.cross(normal,axis);x/=np.linalg.norm(x);y=np.cross(normal,x)
    uv=np.stack([(support-centroid)@x,(support-centroid)@y],axis=1);hull=hull2(uv)
    area=abs(np.sum(hull[:,0]*np.roll(hull[:,1],-1)-hull[:,1]*np.roll(hull[:,0],-1)))/2 if len(hull)>=3 else 0
    errors=residuals(support,normal,offset)
    cam=cache['recon']['cams'][CONFIG['cameras']['source']];z=(support@np.array(cam['R']).reshape(3,3).T+cam['t'])[:,2]
    return {'normal':normal.tolist(),'offset':float(offset),'inlierIndices':indices.tolist(),'inliers':len(indices),'cloudFraction':len(indices)/len(points),'residualMedian':float(np.median(errors)),'residualRms':float(np.sqrt(np.mean(errors**2))),'residualP95':float(np.quantile(errors,.95)),'residualP95RadiusFraction':float(np.quantile(errors,.95)/radius),'center':centroid.tolist(),'basisX':x.tolist(),'basisY':y.tolist(),'fullAxisSpans':np.ptp(uv,axis=0).tolist(),'robustAxisSpansP05P95':(np.quantile(uv,.95,axis=0)-np.quantile(uv,.05,axis=0)).tolist(),'hull':hull.tolist(),'hullAreaWorldUnitsSquared':float(area),'sourceInlierDepthMinMax':[float(np.min(z)),float(np.max(z))]}

started=time.perf_counter();remaining=np.arange(len(points));trials=[];accepted=[]
for plane_index in range(CONFIG['planes']['maximumPlanes']):
    best=None;hypotheses=[];degenerate=0
    if len(remaining)<minimum:break
    for hypothesis in range(CONFIG['planes']['hypothesesPerPlane']):
        chosen=[]
        while len(chosen)<3:
            index=int(random()*len(remaining))
            if index not in chosen:chosen.append(index)
        indices=remaining[chosen];a,b,c=points[indices];normal=np.cross(b-a,c-a);length=np.linalg.norm(normal)
        if length<radius**2*CONFIG['planes']['degenerateTripleCrossNormMinRadiusSquaredFraction']:
            degenerate+=1;hypotheses.append({'triple':indices.tolist(),'status':'degenerate'});continue
        normal=canonical(normal/length);offset=-float(normal@a);errors=residuals(points[remaining],normal,offset);mask=errors<=threshold
        inliers=remaining[mask];median=float(np.median(errors[mask])) if mask.any() else float('inf')
        hypotheses.append({'triple':indices.tolist(),'inliers':len(inliers),'medianInlierResidual':median})
        if best is None or (-len(inliers),median)<(-len(best[2]),best[3]):best=(normal,offset,inliers,median)
    if best is None:
        trials.append({'planeIndex':plane_index,'status':'rejected','reason':'All deterministic triples degenerate','hypotheses':hypotheses});break
    normal,offset,inliers,_=best;initial_count=len(inliers)
    refits=[]
    for iteration in range(CONFIG['planes']['leastSquaresRefitPasses']):
        centroid=points[inliers].mean(axis=0);_,_,vt=np.linalg.svd(points[inliers]-centroid,full_matrices=False);normal=canonical(vt[-1]);offset=-float(normal@centroid)
        errors=residuals(points[remaining],normal,offset);inliers=remaining[errors<=threshold];refits.append({'iteration':iteration,'inliers':len(inliers)})
        if len(inliers)<3:break
    row={'planeIndex':plane_index,'initialRansacInliers':initial_count,'requiredInliers':minimum,'threshold':threshold,'refits':refits,'degenerateHypotheses':degenerate,'hypotheses':hypotheses,**summary(normal,offset,inliers)}
    row['status']='accepted-geometry-only' if len(inliers)>=minimum else 'rejected-insufficient-dominant-support'
    trials.append(row)
    if len(inliers)<minimum:break
    accepted.append({k:v for k,v in row.items() if k not in ['hypotheses','refits']})
    remaining=remaining[~np.isin(remaining,inliers)]
report={'created':datetime.datetime.now(datetime.timezone.utc).isoformat(),'cacheSha256':sha(raw),'configSha256':sha((ROOT/'preregistered-config.json').read_bytes()),'codeSha256':sha(Path(__file__).read_bytes()),'numpy':np.__version__,'pointCount':len(points),'robustCenter':center.tolist(),'robustRadius':radius,'distanceThreshold':threshold,'minimumRequiredSupport':minimum,'cpuFitMilliseconds':(time.perf_counter()-started)*1000,'acceptedPlanes':accepted,'trials':trials,'visibilityCertified':False,'status':'planes-ready-for-declared-photometric-diagnostic' if accepted else 'stopped-no-plane-passes-geometric-support-gate','newDenseRowsExported':0,'noHeldoutImages':True,'noGpu':True}
(ROOT/'plane-fit-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ['acceptedPlanes','trials']},indent=2))
print(json.dumps({'trials':[{k:v for k,v in row.items() if k not in ['hypotheses','inlierIndices','hull']} for row in trials]},indent=2))
