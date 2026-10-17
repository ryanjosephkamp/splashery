"""MIT. Offline reference rows only; no weights or new dependency ships."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys
import time

import cv2
import numpy as np
import torch
from safetensors.torch import load_file

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'.cache/photo-3d-next/DA3/src'))
sys.path.insert(0,str(ROOT/'.cache/photo-3d-next/MoGe'))
helper_spec=importlib.util.spec_from_file_location('depth_helper',ROOT/'tools/p3d-next-depth.py')
helper=importlib.util.module_from_spec(helper_spec);helper_spec.loader.exec_module(helper)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--model',required=True,choices=['da3-base','da3-mono-large','moge-large'])
    parser.add_argument('--manifest',required=True)
    parser.add_argument('--out',required=True)
    parser.add_argument('--limit',type=int)
    parser.add_argument('--tensors',type=Path)
    args=parser.parse_args()
    torch.set_num_threads(1);torch.set_num_interop_threads(1);torch.manual_seed(0)
    names={'da3-base':'depth-anything--DA3-BASE','da3-mono-large':'depth-anything--DA3MONO-LARGE','moge-large':'Ruicheng--moge-2-vitl-normal'}
    folder=ROOT/'.cache/photo-3d-next/models'/names[args.model]
    file=folder/('model.pt' if args.model=='moge-large' else 'model.safetensors')
    if args.model=='moge-large':
        from moge.model.v2 import MoGeModel
        weights=torch.load(file,map_location='cpu',weights_only=True)
        model=MoGeModel(**weights['model_config'])
        model.load_state_dict(weights['model'],strict=True)
    else:
        from depth_anything_3.cfg import create_object,load_config
        model_name=json.loads((folder/'config.json').read_text())['model_name']
        config=load_config(str(ROOT/'.cache/photo-3d-next/DA3/src/depth_anything_3/configs'/(model_name+'.yaml')))
        model=create_object(config)
        weights=load_file(file)
        weights={k.removeprefix('model.'):v for k,v in weights.items()}
        # Safetensors omits duplicate shared parameters. Fill only proven aliases
        # of the exact same Parameter object, never randomly initialized values.
        groups={}
        for name,param in model.named_parameters(remove_duplicate=False):groups.setdefault(id(param),[]).append(name)
        for names_ in groups.values():
            present=next((name for name in names_ if name in weights),None)
            if present:
                for name in names_:weights.setdefault(name,weights[present])
        model.load_state_dict(weights,strict=True)
    del weights
    model.eval()
    inputs=json.loads(Path(args.manifest).read_text())
    requested_inputs=len(inputs)
    if args.limit:inputs=inputs[:args.limit]
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    result={'model':args.model,'modelBytes':file.stat().st_size,'modelSha256':hashlib.sha256(file.read_bytes()).hexdigest(),
            'backend':'native PyTorch FP32 CPU, one thread; not WASM','side':518,'inputPipeline':'production browser tensors' if args.tensors else 'native Float32 area resize','strictWeights':True,'requestedInputs':requested_inputs,'selectedInputs':len(inputs),'complete':False,'rows':[]}
    with torch.inference_mode():
        for item in inputs:
            target=out/(item['id']+'.f32');meta=out/(item['id']+'.json')
            if target.exists() and meta.exists():row=json.loads(meta.read_text())
            else:
                photo=Path(item['file'])
                if args.tensors:
                    tensor_path=args.tensors/(item['id']+'.json');began=time.monotonic()
                    while not tensor_path.exists():
                        if time.monotonic()-began>600:raise TimeoutError('Production input not ready: '+item['id'])
                        time.sleep(1)
                    tensor_meta=json.loads(tensor_path.read_text());iw,ih=tensor_meta['w'],tensor_meta['h'];raw=(args.tensors/(item['id']+'.f32')).read_bytes()
                    if tensor_meta['photoSha256']!=hashlib.sha256(photo.read_bytes()).hexdigest() or hashlib.sha256(raw).hexdigest()!=tensor_meta['rgbSha256']:raise ValueError('Production input identity changed')
                    rgb=np.frombuffer(raw,dtype='<f4').reshape(ih,iw,3)
                else:
                    image=cv2.cvtColor(cv2.imread(str(photo)),cv2.COLOR_BGR2RGB);h,w=image.shape[:2];factor=518/max(h,w)
                    iw=max(14,round(w*factor/14)*14);ih=max(14,round(h*factor/14)*14)
                    rgb=cv2.resize(image.astype(np.float32)/255,(iw,ih),interpolation=cv2.INTER_AREA)
                if args.model!='moge-large':rgb=((rgb-np.array([.485,.456,.406]))/np.array([.229,.224,.225])).astype(np.float32)
                tensor=torch.from_numpy(np.ascontiguousarray(rgb.transpose(2,0,1)))[None]
                began=time.perf_counter();camera=None
                if args.model=='moge-large':
                    values=model.forward(tensor,num_tokens=1200)
                    ms=(time.perf_counter()-began)*1000
                    inverse,camera=helper.moge_depth(values['points'][0].numpy(),values['mask'][0].numpy(),values['metric_scale'].flatten()[0])
                else:
                    values=model(tensor[:,None]);ms=(time.perf_counter()-began)*1000
                    depth=values['depth'].squeeze().float().numpy()
                    inverse=np.where(depth>0,1/np.maximum(depth,1e-9),np.nan)
                inverse=np.asarray(inverse,dtype='<f4');inverse.tofile(target)
                row={**item,'w':inverse.shape[1],'h':inverse.shape[0],'ms':ms,'postprocessMs':(time.perf_counter()-began)*1000-ms,'camera':camera,
                     'photoSha256':hashlib.sha256(photo.read_bytes()).hexdigest(),'rawSha256':hashlib.sha256(target.read_bytes()).hexdigest()}
                meta.write_text(json.dumps(row))
            result['rows'].append(row);(out/'depth.json').write_text(json.dumps(result,indent=2))
            print(args.model,item['id'],round(row['ms']),flush=True)
    result['selectionComplete']=True;result['complete']=len(result['rows'])==requested_inputs;(out/'depth.json').write_text(json.dumps(result,indent=2))


if __name__=='__main__':main()
