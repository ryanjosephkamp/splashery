"""MIT. Compare the three small ONNX exports to their official source weights.

Two named truth stills are a bounded parity check, not universal export validation.
Discrepancies are reported separately from the requested truth and cost gates.
"""
import json
from pathlib import Path
import sys

import cv2
import numpy as np
import onnxruntime as ort
import torch
from safetensors.torch import load_file

ROOT=Path(__file__).resolve().parents[1];CACHE=ROOT/'.cache/photo-3d-next'
sys.path.insert(0,str(CACHE/'DA3/src'));sys.path.insert(0,str(CACHE/'MoGe'))
torch.set_num_threads(1);torch.set_num_interop_threads(1);torch.manual_seed(0)
MODELS=[('distill','xingyang1--Distill-Any-Depth-Small-hf','FuryTMP--Distill-Any-Depth-Small-onnx.onnx'),
        ('da3-small','depth-anything--DA3-SMALL','josazar--da3-small-onnx.onnx'),
        ('moge-small','Ruicheng--moge-2-vits-normal','Ruicheng--moge-2-vits-normal-onnx.onnx')]
result={'scope':'Two stills per model, common preprocessing, FP32 CPU, one thread','rtol':.001,'atol':.0001,'models':[]}
for kind,source,export in MODELS:
    row={'model':kind,'rows':[],'error':None};result['models'].append(row)
    try:
        folder=CACHE/'models'/source
        if kind=='distill':
            from transformers import AutoModelForDepthEstimation
            model,info=AutoModelForDepthEstimation.from_pretrained(folder,local_files_only=True,output_loading_info=True)
            if info['missing_keys'] or info['unexpected_keys']:raise ValueError('Official source did not load exactly: '+str(info))
        elif kind=='da3-small':
            from depth_anything_3.cfg import create_object,load_config
            model=create_object(load_config(str(CACHE/'DA3/src/depth_anything_3/configs/da3-small.yaml')))
            state={k.removeprefix('model.'):v for k,v in load_file(folder/'model.safetensors').items()}
            aliases={}
            for name,param in model.named_parameters(remove_duplicate=False):aliases.setdefault(id(param),[]).append(name)
            for names in aliases.values():
                known=next((name for name in names if name in state),None)
                if known:
                    for name in names:state.setdefault(name,state[known])
            model.load_state_dict(state,strict=True);del state
        else:
            from moge.model.v2 import MoGeModel
            state=torch.load(folder/'model.pt',map_location='cpu',weights_only=True)
            model=MoGeModel(**state['model_config']);model.load_state_dict(state['model'],strict=True);del state
            model.onnx_compatible_mode=True
        model.eval()
        options=ort.SessionOptions();options.intra_op_num_threads=1;options.inter_op_num_threads=1
        session=ort.InferenceSession(str(CACHE/'models'/export),sess_options=options,providers=['CPUExecutionProvider'])
        with torch.inference_mode():
            for scene in ['room','lattice']:
                image=cv2.cvtColor(cv2.imread(str(ROOT/'tests/fixtures/truth'/scene/'still/still.jpg')),cv2.COLOR_BGR2RGB)
                h,w=image.shape[:2];iw=518;ih=round(h*518/w/14)*14
                rgb=cv2.resize(image,(iw,ih),interpolation=cv2.INTER_AREA).astype(np.float32)/255
                if kind!='moge-small':rgb=(rgb-np.array([.485,.456,.406],np.float32))/np.array([.229,.224,.225],np.float32)
                if kind=='distill':rgb=np.pad(rgb,(((518-ih)//2,(518-ih)//2),(0,0),(0,0)))
                array=np.ascontiguousarray(rgb.transpose(2,0,1)[None]);tensor=torch.from_numpy(array)
                if kind=='distill':official={'output':model(pixel_values=tensor).predicted_depth.numpy().squeeze()}
                elif kind=='da3-small':official={'depth':model(tensor[:,None])['depth'].numpy().squeeze()}
                else:
                    output=model.forward(tensor,num_tokens=1200)
                    official={k:v.numpy().squeeze() for k,v in output.items() if v is not None}
                    official['scale']=official.pop('metric_scale')
                feeds={session.get_inputs()[0].name:array}
                if kind=='moge-small':feeds['num_tokens']=np.array(1200,dtype=np.int64)
                actual=dict(zip([x.name for x in session.get_outputs()],session.run(None,feeds)))
                checks=[]
                for key,a in official.items():
                    if key not in actual:continue
                    b=actual[key].squeeze()
                    if a.shape!=b.shape:checks.append({'output':key,'passed':False,'shape':[list(a.shape),list(b.shape)]});continue
                    checks.append({'output':key,'passed':bool(np.allclose(a,b,rtol=.001,atol=.0001)),
                                   'maxAbsoluteError':float(np.max(np.abs(a-b))), 'relativeRmse':float(np.sqrt(np.mean((a-b)**2))/(np.sqrt(np.mean(a*a))+1e-12))})
                if not checks:raise ValueError('No corresponding official output')
                row['rows'].append({'scene':scene,'checks':checks})
                print(kind,scene,json.dumps(checks),flush=True)
        del model,session
    except Exception as error:row['error']=str(error);print(kind,'ERROR',str(error),flush=True)
    row['passed']=row['error'] is None and len(row['rows'])==2 and all(c['passed'] for r in row['rows'] for c in r['checks'])
    (CACHE/'export-check.json').write_text(json.dumps(result,indent=2))
