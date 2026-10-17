"""MIT. Explicit backend probe; never silently falls back from GPU Cycles to CPU.

bash tools/blender-cloud.sh --python tools/blender/probe.py -- --backend CUDA --out .cache/cuda.json
"""
import argparse
import json
from pathlib import Path
import sys
import time

import bpy

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--backend', choices=['CPU','CUDA','OPTIX','HIP','ONEAPI','METAL','EEVEE'], required=True)
parser.add_argument('--out', type=Path, required=True)
opt = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
result = {'blender': bpy.app.version_string, 'backend': opt.backend, 'status': 'failed', 'devices': []}
started = time.monotonic()
try:
    bpy.ops.wm.read_factory_settings(use_empty=False)
    scene = bpy.context.scene
    scene.render.resolution_x = scene.render.resolution_y = 64
    scene.render.resolution_percentage = 100
    scene.render.threads_mode, scene.render.threads = 'FIXED', 4
    scene.render.engine = 'BLENDER_EEVEE_NEXT' if opt.backend == 'EEVEE' else 'CYCLES'
    if opt.backend != 'EEVEE':
        scene.cycles.samples = 2
        scene.cycles.use_denoising = False
        scene.cycles.device = 'CPU' if opt.backend == 'CPU' else 'GPU'
        if opt.backend != 'CPU':
            prefs = bpy.context.preferences.addons['cycles'].preferences
            prefs.compute_device_type = opt.backend
            prefs.refresh_devices()
            for device in prefs.devices:
                device.use = device.type == opt.backend
                result['devices'].append({'name': device.name, 'type': device.type, 'enabled': bool(device.use)})
            if not any(d['enabled'] for d in result['devices']):
                raise RuntimeError(f'No {opt.backend} device; CPU fallback explicitly disabled')
    bpy.ops.render.render()
    result['status'] = 'rendered'
    if opt.backend == 'EEVEE':
        import gpu
        result['graphics'] = {'renderer': gpu.platform.renderer_get(),
                              'vendor': gpu.platform.vendor_get(), 'version': gpu.platform.version_get()}
except Exception as error:
    result['error'] = str(error)
finally:
    result['seconds'] = round(time.monotonic()-started, 4)
    opt.out.parent.mkdir(parents=True, exist_ok=True)
    opt.out.write_text(json.dumps(result, indent=2)+'\n')
    print(json.dumps(result), flush=True)
if result['status'] != 'rendered':
    sys.exit(1)
