"""Blender subprocess entry point. Only receives the public pack, never scorer truth paths."""
import json
import runpy
import random
import numpy as np
import sys
from pathlib import Path
import bpy
sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).parent))
import refblend as kit
from rendering import bounds, bake_colors

job = json.loads(Path(sys.argv[sys.argv.index('--')+1]).read_text())
output = Path(job['output'])
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(job['seed'])
np.random.seed(job['seed'])
runpy.run_path(job['model'], init_globals={'PACK': job['pack'], 'PACK_DIR': job['packDir'], 'QUALITY': job['quality'], 'SEED': job['seed']}, run_name='__main__')
objects = [o for o in bpy.context.scene.objects if o.type in {'MESH', 'CURVE'}]
if not objects:
    raise ValueError('Model script produced no geometry')
for move in job['pack'].get('moves', []):
    if move['part'] not in kit.PARTS:
        raise ValueError(f"Model must call moving_part for {move['part']}")
# Convert curves and apply all modifiers before measuring bounds and exporting.
bpy.ops.object.select_all(action='DESELECT')
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = objects[0]
bpy.ops.object.convert(target='MESH')
objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
cameras = kit.render_pack(job['pack'], output, job['size'], job['samples'], job['engine'])
bake_colors(objects, job['bakeSize'])
kit.export_glb(output/'result.glb', objects)
lo, hi = bounds(objects)
parts = []
for move in job['pack'].get('moves', []):
    part = kit.PARTS[move['part']]
    name = move['part']
    kit.export_glb(output/'parts'/f'{name}.glb', [part['object']])
    x, y, z = part['pivot']
    parts.append({'name': name, 'pivotMeters': [x, z, -y], 'motion': move, 'mesh': f'parts/{name}.glb'})
moving = {kit.PARTS[m['part']]['object'] for m in job['pack'].get('moves', [])}
static = [o for o in objects if o not in moving]
if static:
    kit.export_glb(output/'static.glb', static)
bpy.ops.wm.save_as_mainfile(filepath=str(output/'result.blend'))
(output/'model.json').write_text(json.dumps({'blenderVersion': bpy.app.version_string, 'parts': parts, 'static': bool(static), 'cameras': cameras, 'boundsBlender': [lo, hi]}, indent=2)+'\n')
