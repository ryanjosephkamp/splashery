"""MIT; made by Ryan with Codex (GPT-6). Restore task 99's frozen truth cameras.

Regenerate uncommitted target rasters from the archived calibration, using the
same scene generator, 16 samples, and guided OpenImageDenoise. No camera fitting.
Run with Blender: --python tools/p3d-fill-truth.py -- --calibration FILE --out DIR.
"""
import argparse
import gzip
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

import bpy
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'tools/studio-truth-generate.py'
spec = importlib.util.spec_from_file_location('generator', SOURCE)
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def digest(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--calibration', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--scenes')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    calibration = Path(args.calibration)
    frozen = json.loads(gzip.decompress(calibration.read_bytes()))
    if not frozen['complete'] or len(frozen['records']) != 216 or len(frozen['jobs']) != 24:
        raise ValueError('Need the complete task 99 calibration')
    if any(j['settings']['generator_sha256'] != digest(SOURCE) for j in frozen['jobs']):
        raise ValueError('The calibrated scene generator changed')
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    identity = {
        'calibrationSha256': digest(calibration), 'generatorSha256': digest(SOURCE),
        'adapterSha256': digest(Path(__file__)), 'blender': bpy.app.version_string,
        'blenderBuild': bpy.app.build_hash.decode(), 'samples': 16, 'threads': 1,
        'denoiser': 'OpenImageDenoise with albedo and normal guides',
        'cameraFit': 'none; task 99 frozen cameras, support, and source median',
        'scenes': args.scenes,
    }
    settings = out / 'settings.json'
    if settings.exists() and json.loads(settings.read_text()) != identity:
        raise ValueError('Target settings changed; use a fresh folder')
    generator.save_json(settings, identity)
    records = []
    for index, (name, _, _) in enumerate(generator.SCENES):
        if args.scenes and name not in args.scenes.split(','):
            continue
        cam, _, _ = generator.build(index, name)
        tree, flags = generator.geometry()
        scene = bpy.context.scene
        scene.render.threads = 1
        scene.cycles.samples = 16
        scene.cycles.use_denoising = True
        scene.cycles.denoiser = 'OPENIMAGEDENOISE'
        scene.cycles.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
        scene.cycles.denoising_prefilter = 'ACCURATE'
        for row in (r for r in frozen['records'] if r['scene'] == name):
            p = row['pose']
            w, h = p['width'], p['height']
            folder = out / row['folder']
            folder.mkdir(parents=True, exist_ok=True)
            stem = Path(p['rgb']).stem
            cam.matrix_world = Matrix(p['camera_to_world']) @ Matrix.Diagonal([1, -1, -1, 1])
            cam.data.lens = p['K'][0][0] * cam.data.sensor_width / w
            scene.render.resolution_x = w
            scene.render.resolution_y = h
            scene.render.resolution_percentage = 100
            scene.render.filepath = str(folder / p['rgb'])
            bpy.context.view_layer.update()
            if not (folder / p['rgb']).exists():
                bpy.ops.render.render(write_still=True)
            if not (folder / p['depth']).exists() or not (folder / p['mask']).exists():
                generator.depth(tree, flags, p, folder, stem)
            updated = {**row, 'artifactHashes': {k: digest(folder / p[k]) for k in ['rgb', 'mask', 'depth']},
                       'colorRender': identity}
            updated.pop('geometryReuse', None)
            updated.pop('reuse', None)
            records.append(updated)
            generator.save_json(out / 'targets.json', {'complete': False, 'records': records, 'settings': identity})
            print('TARGET', name, row['profile'], row['camera']['yaw'], row['camera']['pitch'], flush=True)
    generator.save_json(out / 'targets.json', {'complete': len(records) == 216, 'records': records, 'settings': identity})


if __name__ == '__main__':
    main()
