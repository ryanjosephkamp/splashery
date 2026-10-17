"""A shared glTF mesh must be copied before world-space truth normalization."""
import json
import runpy
import sys
from pathlib import Path
import bpy
base=Path(sys.argv[sys.argv.index('--')+1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.mesh.primitive_cube_add(size=1,location=(-2,0,0))
a=bpy.context.object
b=a.copy();b.data=a.data;b.location.x=2;bpy.context.collection.objects.link(b)
a.select_set(True);b.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(base/'source.glb'),export_format='GLB',use_selection=True)
job={'id':'chess-set','source':str(base/'source.glb'),'pack':str(base/'pack'),'truth':str(base/'truth'),'size':16,'licenseChecked':'2025-04-03'}
(base/'job.json').write_text(json.dumps(job))
sys.argv=['blender','--',str(base/'job.json')]
runpy.run_path(str(Path(__file__).resolve().parents[1]/'tools/refblend/truth.py'),run_name='__main__')
p=json.loads((base/'pack/pack.json').read_text())
assert abs(p['size']['width']-1)<1e-5,p['size']
assert abs(p['size']['height']-.2)<1e-5,p['size']
print('Instanced source assembly retained its dimensions')

credit=json.loads((base/'truth/credit.json').read_text())
assert credit['checked']=='2025-04-03',credit['checked']
