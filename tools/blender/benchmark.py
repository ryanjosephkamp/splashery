"""MIT. CPU truth-scene seconds/frame at 512 and 1024 px, with no dataset timestamps.

bash tools/blender-cloud.sh --python tools/blender/benchmark.py -- --out .cache/benchmark
The original truth generator renders all 12 scenes, with beauty and geometry timed separately.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import sys
import time

import bpy

TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(TOOLS))
spec = importlib.util.spec_from_file_location('truth',TOOLS/'studio-truth-generate.py')
truth = importlib.util.module_from_spec(spec)
spec.loader.exec_module(truth)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--out',type=Path,required=True)
parser.add_argument('--backend',choices=['CYCLES','EEVEE'],default='CYCLES')
opt = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
if bpy.app.version != (4,5,3):
    parser.error('Use pinned Blender 4.5.3')
if opt.out.exists() and any(opt.out.iterdir()):
    parser.error('Output must be new or empty')
opt.out.mkdir(parents=True,exist_ok=True)
measurements=[]
for side in [512,1024]:
    width,height=side,side*9//16
    for index,(name,label,stress) in enumerate(truth.SCENES):
        started=time.monotonic()
        camera,eye,target=truth.build(index,name)
        tree,flags=truth.geometry()
        built=time.monotonic()
        scene=bpy.context.scene
        scene.render.resolution_x,scene.render.resolution_y=width,height
        scene.render.resolution_percentage=100
        scene.render.engine='CYCLES' if opt.backend=='CYCLES' else 'BLENDER_EEVEE_NEXT'
        scene.cycles.device='CPU'
        scene.cycles.samples=8
        folder=opt.out/str(side)/name
        folder.mkdir(parents=True)
        pose=truth.pose(camera,eye,target,'still',0,width,height)
        scene.render.filepath=str(folder/'still.jpg')
        bpy.ops.render.render(write_still=True)
        truth.canonical_jpeg(folder/'still.jpg')
        rendered=time.monotonic()
        truth.depth(tree,flags,pose,folder,'still')
        ended=time.monotonic()
        row={'scene':name,'width':width,'height':height,'samples':8 if opt.backend=='CYCLES' else scene.eevee.taa_render_samples,'backend':opt.backend,'build_seconds':built-started,
             'rgb_seconds':rendered-built,'truth_seconds':ended-rendered,'seconds_per_frame':ended-started}
        measurements.append(row)
        (opt.out/'timings.json').write_text(json.dumps(measurements,indent=2)+'\n')
        print(json.dumps(row),flush=True)
