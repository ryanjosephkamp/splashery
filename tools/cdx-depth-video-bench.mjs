// Optional local research: requires the pinned Python environment and Video Depth Anything
// checkout described in the audit. Nothing here is imported by the site or ships model weights.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { SAMPLES } from "../src/packs/moving-photo.js";
const args = Object.fromEntries(process.argv.slice(2).map((s) => s.replace(/^--/, "").split("=")));
const dir = `.cache/cdx-depth/${args.label || "video"}`;
const side = Number(args.side) || 196;
const inputs = [
  ...["forest", "street", "still-life"].map((id) => ({
    id,
    file: `assets/toys/photo-3d/${id}.jpg`,
  })),
  ...SAMPLES.map((s) => ({
    id: `clip-${s.id}`,
    file: `assets/toys/moving-photo-3d/${s.file}-sheet-1.jpg`,
    w: s.w,
    h: s.h,
    cols: s.cols,
  })),
].filter((s) => !args.only || args.only.split(",").includes(s.id));
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(`${dir}/inputs.json`, JSON.stringify(inputs));
execFileSync(
  ".cache/cdx-depth/python/bin/python",
  [
    "-u",
    "-c",
    String.raw`
import sys, time, json, os
config=json.loads(sys.argv[1]);directory=config['dir'];side=config['side']
sys.path.insert(0, '.cache/cdx-depth/video-source')
import torch, numpy as np
from PIL import Image
from video_depth_anything.video_depth import VideoDepthAnything
torch.set_num_threads(2)
t0=time.perf_counter()
model=VideoDepthAnything(encoder='vits',features=64,out_channels=[48,96,192,384]).eval()
model.load_state_dict(torch.load('.cache/cdx-depth/video-source/checkpoints/video_depth_anything_vits.pth',map_location='cpu',weights_only=True))
load_ms=(time.perf_counter()-t0)*1000
result={'loadMs':load_ms,'torch':torch.__version__,'threads':2,'side':side,'contextFrames':32,'rows':[]}
for spec in json.load(open(directory+'/inputs.json')):
 image=Image.open(spec['file']).convert('RGB')
 if 'w' in spec:
  w,h=spec['w'],spec['h']
  frames=[image.crop(((i%spec['cols'])*w,(i//spec['cols'])*h,(i%spec['cols']+1)*w,(i//spec['cols']+1)*h)) for i in range(6)]
 else: frames=[image];w,h=image.size
 scale=side/max(w,h);dw=max(14,round(w*scale/14)*14);dh=max(14,round(h*scale/14)*14)
 rgb=[np.asarray(f.resize((dw,dh),Image.Resampling.BOX),dtype=np.float32)/255 for f in frames]
 px=np.stack([rgb[min(i,len(rgb)-1)] for i in range(32)])
 px=(px-np.array([.485,.456,.406],dtype=np.float32))/np.array([.229,.224,.225],dtype=np.float32)
 tensor=torch.from_numpy(px.transpose(0,3,1,2).copy()).unsqueeze(0)
 times=[]
 with torch.inference_mode():
  for _ in range(2):
   t=time.perf_counter();out=model(tensor);times.append((time.perf_counter()-t)*1000)
 d=out[0,:len(frames)].numpy()
 for i,depth in enumerate(d):
  depth.astype('<f4').tofile(directory+'/' +spec['id']+'-'+str(i)+'.f32')
  lo,hi=np.percentile(depth,[2,98]);pic=np.clip((depth-lo)/(hi-lo+1e-6),0,1)
  Image.fromarray((pic*255).astype('uint8')).save(directory+'/' +spec['id']+'-'+str(i)+'.png')
 row={'id':spec['id'],'output':[dw,dh],'frames':len(frames),'times':times}
 result['rows'].append(row);json.dump(result,open(directory+'/timings.json','w'),indent=2)
 print(row,flush=True)
`,
    JSON.stringify({ dir, side }),
  ],
  { stdio: "inherit" },
);
