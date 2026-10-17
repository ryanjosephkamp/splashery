"""Scorer-only CC0 truth factory. Never import this from an agent model script.
Run Blender --python truth.py -- job.json; source acquisition is separate and credited.
"""
import hashlib
from datetime import date
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector, Matrix
sys.path.insert(0, str(Path(__file__).parent))
from rendering import bounds, render_pack
from refblend import export_glb

job = json.loads(Path(sys.argv[sys.argv.index('--')+1]).read_text())
try:
    checked = date.fromisoformat(job['licenseChecked']).isoformat()
except (KeyError, TypeError, ValueError):
    raise ValueError('Truth source needs licenseChecked: YYYY-MM-DD after live license verification')
root = Path(__file__).resolve().parents[2]
record = next(m for m in json.loads((root/'tools/models.json').read_text())['models'] if m['id'] == job['id'])
if record['license'] != 'CC0 1.0':
    raise ValueError('Truth factory accepts only CC0 entries from tools/models.json')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=job['source'])
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
# Transform all world vertices together, preserving proportions and assembly.
lo, hi = bounds(objects)
scale = 1/max(hi[k]-lo[k] for k in range(3))
offset = Vector(((lo[0]+hi[0])/2, (lo[1]+hi[1])/2, lo[2]))
snapshots = [(obj, obj.matrix_world.copy(), obj.data.copy()) for obj in objects]
for obj, matrix, mesh in snapshots:
    obj.parent = None
    obj.matrix_world = Matrix.Identity(4)
    obj.data = mesh
    for vertex in obj.data.vertices:
        vertex.co = (matrix @ vertex.co - offset)*scale
    obj.data.update()
lo, hi = bounds(objects)
packdir = Path(job['pack'])
packdir.mkdir(parents=True, exist_ok=True)
(packdir/'images').mkdir(exist_ok=True)
truthdir = Path(job['truth'])
truthdir.mkdir(parents=True, exist_ok=True)
export_glb(truthdir/'truth.glb', objects)
center = [(a+b)/2 for a,b in zip(lo,hi)]
images = []
for i,(view,yaw,pitch) in enumerate([('front',0,0),('three-quarter',35,22),('right',90,5),('back',180,12)]):
    images.append({'file': f'images/{i:02}.png', 'mask': f'images/{i:02}-mask.png', 'view': view, 'camera': {'yaw': yaw, 'pitch': pitch, 'fov': 40, 'distance': 3, 'orthoScale': 1.5, 'target': [center[0],center[2],-center[1]]}})
pack = {'schema':1,'id':record['id'],'name':record['name'],'images':images,'size':{'width':hi[0]-lo[0],'depth':hi[1]-lo[1],'height':hi[2]-lo[2],'units':'m','source':'Normalized CC0 truth scale; largest dimension is one meter'},'notes':'Rebuild from the four pictures. Scorer truth geometry is stored separately.','parts':[],'moves':job.get('moves',[]),'budget':{'minutes':30,'quality':'good'},'license':{'images':'CC0','source':record['page'],'author':record['author']}}
render_pack(pack, packdir, job.get('size',256), 16)
# Keep foreground masks explicit; do not infer dark objects from their color.
for i,img in enumerate(images):
    source = packdir/'renders'/f'{i:03}.png'
    image = bpy.data.images.load(str(source), check_existing=False)
    w,h = image.size
    pixels = list(image.pixels)
    mask = bpy.data.images.new(f'mask-{i}',w,h,alpha=True)
    for j in range(0,len(pixels),4):
        foreground = 1. if pixels[j+3]>=.5 else 0.
        pixels[j:j+4] = [foreground,foreground,foreground,1.]
    mask.pixels = pixels
    mask.filepath_raw = str(packdir/img['mask'])
    mask.file_format = 'PNG'
    mask.save()
    source.rename(packdir/img['file'])
(packdir/'pack.json').write_text(json.dumps(pack,indent=2)+'\n')
credit = dict(record,checked=checked,sourceSha256=hashlib.sha256(Path(job['source']).read_bytes()).hexdigest(),truthSha256=hashlib.sha256((truthdir/'truth.glb').read_bytes()).hexdigest(),changes='Normalized assembly, product-photo renders, and foreground masks',credit='Codex (GPT-6)')
(truthdir/'credit.json').write_text(json.dumps(credit,indent=2)+'\n')
print('TRUTH_PACK',packdir)
