"""MIT. Pinned local ONNX bake-off. CPU results never stand in for WASM time.

Writes raw inverse depth separately, with model hashes, timings, and input hashes.
Truth scores use the existing disjoint calibration/evaluation split in the JS scorer.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import time

import cv2
import numpy as np
import onnxruntime as ort
from scipy.optimize import least_squares


def moge_depth(points, mask, scale):
    # The official MIT postprocessing objective: infer focal length and Z shift
    # from the predicted point map, without using a truth camera or truth depth.
    h, w = points.shape[:2]
    yy, xx = np.meshgrid(np.arange(h), np.arange(w), indexing='ij')
    uv = np.stack([(2*xx+1-w)/math.hypot(w,h), (2*yy+1-h)/math.hypot(w,h)], -1)
    ys, xs = (np.arange(64)*h//64), (np.arange(64)*w//64)
    p = points[ys[:,None],xs]
    u = uv[ys[:,None],xs]
    keep = mask[ys[:,None],xs] > .5
    xy, z, u = p[keep,:2], p[keep,2], u[keep]
    if len(z) < 2: return np.full((h,w), np.nan), None
    def residual(shift):
        proj = xy/(z+shift)[:,None]
        focal = (proj*u).sum()/(proj*proj).sum()
        return (focal*proj-u).ravel()
    shift = float(least_squares(residual, x0=0., ftol=1e-3, method='lm').x[0])
    proj = xy/(z+shift)[:,None]
    focal = float((proj*u).sum()/(proj*proj).sum())
    depth = (points[:,:,2]+shift)*float(scale)
    valid = (mask>.5)&(depth>0)&np.isfinite(depth)
    inverse = np.full((h,w),np.nan,dtype=np.float32)
    inverse[valid] = 1/depth[valid]
    return inverse, {'fovX':math.degrees(2*math.atan(w/math.hypot(w,h)/focal)), 'shift':shift}


def import_wasm(args, root, model):
    run=json.loads((args.wasm_outputs/'wasm.json').read_text())
    measured=next(r for r in run['models'] if r['id']==args.model)
    if measured['error'] or len(measured['rows'])!=12:raise ValueError('Need twelve complete browser truth outputs')
    if measured['modelSha256']!=hashlib.sha256(model.read_bytes()).hexdigest():raise ValueError('WASM model differs')
    manifest=json.loads(Path(args.manifest).read_text());items={r['id']:r for r in manifest}
    result={'model':args.model,'modelBytes':model.stat().st_size,'modelSha256':measured['modelSha256'],'backend':run['runtime'],
            'side':518,'tokens':measured.get('tokens',1200) if args.model=='moge-small' else None,'inputPipeline':'production browser tensors; verified RGB hash',
            'requestedInputs':len(manifest),'selectedInputs':12,'complete':False,'rows':[]}
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    for record in measured['rows']:
        item=items[record['id']];values={};began=time.perf_counter()
        for output in record['outputs']:
            raw=(args.wasm_outputs/output['file']).read_bytes()
            if hashlib.sha256(raw).hexdigest()!=output['sha256']:raise ValueError('WASM output bytes changed')
            values[output['name']]=np.frombuffer(raw,dtype='<f4').reshape(output['dims'])
        camera=None
        if args.model=='moge-small':inverse,camera=moge_depth(values['points'][0],values['mask'][0],values['scale'].ravel()[0])
        else:
            inverse=next(iter(values.values())).squeeze()
            if args.model=='distill':inverse=inverse[record['oy']:record['oy']+record['dh'],record['ox']:record['ox']+record['dw']]
            if args.model=='da3-small':inverse=np.where(inverse>0,1/np.maximum(inverse,1e-9),np.nan)
        target=out/(item['id']+'.f32');np.asarray(inverse,dtype='<f4').tofile(target)
        row={**item,'w':inverse.shape[1],'h':inverse.shape[0],'ms':float(np.median(record['times'])),'postprocessMs':(time.perf_counter()-began)*1000,
             'camera':camera,'inputRgbSha256':record['rgbHash'],'photoSha256':hashlib.sha256(Path(item['file']).read_bytes()).hexdigest(),'rawSha256':hashlib.sha256(target.read_bytes()).hexdigest()}
        (out/(item['id']+'.json')).write_text(json.dumps(row));result['rows'].append(row)
    result['selectionComplete']=True;(out/'depth.json').write_text(json.dumps(result,indent=2))


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--model',required=True,choices=['da2','distill','da3-small','moge-small'])
    parser.add_argument('--manifest',required=True)
    parser.add_argument('--out',required=True)
    parser.add_argument('--limit',type=int)
    parser.add_argument('--side',type=int,default=518)
    parser.add_argument('--model-file',type=Path)
    parser.add_argument('--tokens',type=int,default=1200)
    parser.add_argument('--quantize',action='store_true')
    parser.add_argument('--wasm-outputs',type=Path)
    parser.add_argument('--tensors',type=Path)
    args=parser.parse_args()
    root=Path(__file__).resolve().parents[1]
    paths={'da2':root/'vendor/depth-anything-v2-small/model_quantized.onnx',
           'distill':root/'.cache/photo-3d-next/models/FuryTMP--Distill-Any-Depth-Small-onnx.onnx',
           'da3-small':root/'.cache/photo-3d-next/models/josazar--da3-small-onnx.onnx',
           'moge-small':root/'.cache/photo-3d-next/models/Ruicheng--moge-2-vits-normal-onnx.onnx'}
    model=args.model_file or paths[args.model]
    if args.quantize:
        if not args.model_file:raise ValueError('--quantize requires an explicit research --model-file output')
        from onnxruntime.quantization import quantize_dynamic,QuantType
        if not model.exists():quantize_dynamic(str(paths[args.model]),str(model),weight_type=QuantType.QInt8,op_types_to_quantize=['MatMul'],extra_options={'MatMulConstBOnly':True})
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    if args.wasm_outputs:return import_wasm(args,root,model)
    opts=ort.SessionOptions();opts.intra_op_num_threads=1;opts.inter_op_num_threads=1
    session=ort.InferenceSession(str(model),sess_options=opts,providers=['CPUExecutionProvider'])
    inputs=json.loads(Path(args.manifest).read_text())
    requested_inputs=len(inputs)
    if args.limit:inputs=inputs[:args.limit]
    result={'model':args.model,'modelSha256':hashlib.sha256(model.read_bytes()).hexdigest(),'modelBytes':model.stat().st_size,
            'tokens':args.tokens if args.model=='moge-small' else None,'ort':ort.__version__,'backend':'native CPU, one thread; not WASM','side':args.side,'inputPipeline':'production browser tensors' if args.tensors else 'native Float32 area resize','requestedInputs':requested_inputs,'selectedInputs':len(inputs),'complete':False,'rows':[]}
    prior=out/'depth.json'
    if prior.exists():
        previous=json.loads(prior.read_text())
        for key in ['modelSha256','side','inputPipeline']:
            if previous.get(key)!=result[key]:raise ValueError('Cached run settings differ: '+key)
        if args.model=='moge-small' and previous.get('tokens',1200)!=args.tokens:raise ValueError('Cached token count differs')
    for item in inputs:
        file=Path(item['file']);target=out/(item['id']+'.f32')
        if target.exists() and (out/(item['id']+'.json')).exists():
            row=json.loads((out/(item['id']+'.json')).read_text())
            if row['photoSha256']!=hashlib.sha256(file.read_bytes()).hexdigest() or row['rawSha256']!=hashlib.sha256(target.read_bytes()).hexdigest():raise ValueError('Cached input or depth changed')
        else:
            if args.tensors:
                meta=args.tensors/(item['id']+'.json');began=time.monotonic()
                while not meta.exists():
                    if time.monotonic()-began>600:raise TimeoutError('Production input not ready: '+item['id'])
                    time.sleep(1)
                tensor_meta=json.loads(meta.read_text());iw,ih=tensor_meta['w'],tensor_meta['h']
                if max(iw,ih)!=args.side:raise ValueError('Production input side differs from requested side')
                raw=(args.tensors/(item['id']+'.f32')).read_bytes()
                if tensor_meta['photoSha256']!=hashlib.sha256(file.read_bytes()).hexdigest() or hashlib.sha256(raw).hexdigest()!=tensor_meta['rgbSha256']:raise ValueError('Production input identity changed')
                rgb=np.frombuffer(raw,dtype='<f4').reshape(ih,iw,3)
            else:
                image=cv2.cvtColor(cv2.imread(str(file)),cv2.COLOR_BGR2RGB);h,w=image.shape[:2]
                side=518 if args.model=='distill' else args.side;factor=side/max(h,w)
                iw=max(14,round(w*factor/14)*14);ih=max(14,round(h*factor/14)*14)
                rgb=cv2.resize(image.astype(np.float32)/255,(iw,ih),interpolation=cv2.INTER_AREA)
            if args.model!='moge-small':rgb=((rgb-np.array([.485,.456,.406]))/np.array([.229,.224,.225])).astype(np.float32)
            pad_y=pad_x=0
            if args.model=='distill':
                pad_y=(518-ih)//2;pad_x=(518-iw)//2
                rgb=np.pad(rgb,((pad_y,518-ih-pad_y),(pad_x,518-iw-pad_x),(0,0)))
            feeds={session.get_inputs()[0].name:np.ascontiguousarray(rgb.transpose(2,0,1)[None])}
            if args.model=='moge-small':feeds['num_tokens']=np.array(args.tokens,dtype=np.int64)
            began=time.perf_counter();outputs=session.run(None,feeds);ms=(time.perf_counter()-began)*1000
            camera=None
            if args.model=='moge-small':
                values=dict(zip([x.name for x in session.get_outputs()],outputs))
                inverse,camera=moge_depth(values['points'][0],values['mask'][0],values['scale'].ravel()[0])
            else:
                inverse=outputs[0].squeeze()
                if args.model=='distill':inverse=inverse[pad_y:pad_y+ih,pad_x:pad_x+iw]
                if args.model=='da3-small':inverse=np.where(inverse>0,1/np.maximum(inverse,1e-9),np.nan)
            inverse=np.asarray(inverse,dtype='<f4');inverse.tofile(target)
            row={**item,'w':inverse.shape[1],'h':inverse.shape[0],'ms':ms,'postprocessMs':(time.perf_counter()-began)*1000-ms,
                 'camera':camera,'photoSha256':hashlib.sha256(file.read_bytes()).hexdigest(),'rawSha256':hashlib.sha256(target.read_bytes()).hexdigest()}
            (out/(item['id']+'.json')).write_text(json.dumps(row))
        result['rows'].append(row)
        (out/'depth.json').write_text(json.dumps(result,indent=2))
        print(args.model,item['id'],round(row['ms']),flush=True)
    result['selectionComplete']=True;result['complete']=len(result['rows'])==requested_inputs;(out/'depth.json').write_text(json.dumps(result,indent=2))


if __name__=='__main__':main()
