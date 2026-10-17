"""MIT. Render the original 12 scenes at the atlas's actual nine camera poses.

The source median plane fixes one similarity transform, before target rendering.
No target RGB, target depth, or candidate score is used to fit a camera.
"""
import argparse
import gzip
import hashlib
import importlib.util
import json
import math
import shutil
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Matrix

ROOT = Path(__file__).resolve().parents[1]
source = ROOT / 'tools/studio-truth-generate.py'
spec = importlib.util.spec_from_file_location('generator', source)
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


def world_camera(base, camera, median):
    distance = base['K'][1][1] / base['height']
    scale = distance / median
    source_pose = np.array(base['camera_to_world'])
    signs = np.diag([1., -1., -1.])
    eye = np.array(camera['eye'])
    local = np.array([eye[0], -eye[1], distance-eye[2]]) / scale
    result = np.eye(4)
    result[:3, 3] = source_pose[:3, 3] + source_pose[:3, :3] @ local
    axes = np.column_stack([camera['right'], -np.array(camera['up']), camera['forward']])
    result[:3, :3] = source_pose[:3, :3] @ signs @ axes
    assert np.allclose(result[:3, :3].T @ result[:3, :3], np.eye(3), atol=1e-5)
    assert np.linalg.det(result[:3, :3]) > .99999
    return result


def focal_pixels(width, height, fov):
    # Stage.setCameraPose uses horizontal FOV only in portrait orientation.
    return min(width, height) / (2*math.tan(math.radians(fov)/2))


def rerender_colors(args):
    prior=Path(args.rerender_from)
    frozen=(prior/'targets.json').read_bytes();data=json.loads(frozen)
    if not data['complete'] or len(data['records'])!=216:raise ValueError('Need 216 verified frozen cameras')
    if any(j['settings']['generator_sha256']!=hashlib.sha256(source.read_bytes()).hexdigest() for j in data['jobs']):raise ValueError('Scene generator changed')
    out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
    identity={'frozenTargetsSha256':hashlib.sha256(frozen).hexdigest(),'generatorSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
              'adapterSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'blender':bpy.app.version_string,
              'blenderBuild':bpy.app.build_hash.decode(),'seed':56,'samples':args.samples,'denoiser':'OpenImageDenoise with albedo and normal guides',
              'cameraFit':'none; identical frozen physical cameras; source median calibration reused','threads':4}
    settings=out/'settings.json'
    if settings.exists() and json.loads(settings.read_text())!=identity:raise ValueError('Color render settings changed')
    generator.save_json(settings,identity)
    (out/'calibration.json.gz').write_bytes(gzip.compress(frozen))
    jobs=[{'id':j['id'],'settings':{**j['settings'],'colorRender':identity}} for j in data['jobs']]
    records=[]
    for index,(name,_,_) in enumerate(generator.SCENES):
        cam,_,_=generator.build(index,name)
        scene=bpy.context.scene;scene.render.threads=4;scene.cycles.samples=args.samples
        scene.cycles.use_denoising=True;scene.cycles.denoiser='OPENIMAGEDENOISE';scene.cycles.denoising_input_passes='RGB_ALBEDO_NORMAL';scene.cycles.denoising_prefilter='ACCURATE'
        for record in [r for r in data['records'] if r['scene']==name]:
            p=record['pose'];w,h=p['width'],p['height'];folder=out/record['folder'];folder.mkdir(parents=True,exist_ok=True)
            focal=focal_pixels(w,h,record['camera']['fov'])
            if abs(p['K'][0][0]-focal)>1e-8 or abs(p['K'][1][1]-focal)>1e-8:raise ValueError('Frozen projection differs')
            cam.matrix_world=Matrix(p['camera_to_world'])@Matrix.Diagonal([1,-1,-1,1])
            cam.data.lens=focal*cam.data.sensor_width/w
            scene.render.resolution_x=w;scene.render.resolution_y=h;scene.render.resolution_percentage=100
            scene.render.filepath=str(folder/p['rgb']);bpy.context.view_layer.update()
            if not (folder/p['rgb']).exists():bpy.ops.render.render(write_still=True)
            for key in ['mask','depth']:
                src=prior/record['folder']/p[key]
                if hashlib.sha256(src.read_bytes()).hexdigest()!=record['artifactHashes'][key]:raise ValueError('Frozen geometry artifact changed')
                shutil.copyfile(src,folder/p[key])
            updated={**record,'artifactHashes':{k:hashlib.sha256((folder/p[k]).read_bytes()).hexdigest() for k in ['rgb','mask','depth']},
                     'colorRender':identity,'geometryReuse':{'from':str(prior.resolve()),'identicalCamera':True,'maskAndDepthHashes':{k:record['artifactHashes'][k] for k in ['mask','depth']}}}
            updated.pop('reuse',None);records.append(updated)
            generator.save_json(out/'targets.json',{'complete':False,'jobs':jobs,'records':records,'colorRender':identity})
            print('GUIDED',name,record['profile'],record['camera']['yaw'],record['camera']['pitch'],flush=True)
    generator.save_json(out/'targets.json',{'complete':True,'jobs':jobs,'records':records,'colorRender':identity})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--capture')
    parser.add_argument('--rerender-from')
    parser.add_argument('--samples',type=int,default=16)
    parser.add_argument('--out', required=True)
    parser.add_argument('--scenes')
    parser.add_argument('--reuse-from')
    parser.add_argument('--raster',choices=['native','review'],default='native')
    args = parser.parse_args(sys.argv[sys.argv.index('--')+1:])
    if args.rerender_from:return rerender_colors(args)
    if not args.capture:parser.error('Use --capture or --rerender-from')
    capture_path = Path(args.capture)
    capture = json.loads(capture_path.read_text())
    if not capture['complete']: raise ValueError('Incomplete camera capture')
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    identity = {'capture_sha256': hashlib.sha256(capture_path.read_bytes()).hexdigest(),
                'generator_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
                'adapter_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                'blender': bpy.app.version_string, 'samples': 8, 'raster':args.raster,
                'calibration': 'source median plane; actual app camera, fit, FOV, and raster'}
    settings = out/'settings.json'
    if settings.exists() and json.loads(settings.read_text()) != identity:
        raise ValueError('Output belongs to another camera capture or generator')
    generator.save_json(settings, identity)
    reused = {}
    if args.reuse_from:
        prior = Path(args.reuse_from)
        if (prior/'targets.json').exists():
            old = json.loads((prior/'settings.json').read_text())
            for key in ['capture_sha256','generator_sha256','blender','samples','raster']:
                if old[key] != identity[key]: raise ValueError('Incompatible reuse: '+key)
            reused = {(r['scene'],r['profile'],r['camera']['yaw'],r['camera']['pitch']):r
                      for r in json.loads((prior/'targets.json').read_text())['records']}
    records = []
    for index, (name, _, _) in enumerate(generator.SCENES):
        if args.scenes and name not in args.scenes.split(','): continue
        rows = [r for r in capture['rows'] if r['id'] == 'truth-'+name]
        if not rows: continue
        base_dir = ROOT/'tests/fixtures/truth'/name/'still'
        base = json.loads((base_dir/'poses.json').read_text())['frames'][0]
        z = np.frombuffer(gzip.decompress((base_dir/base['depth']).read_bytes()), dtype='<f4')
        # Mask==1 only; do not use ambiguous glass/reflection/emission to calibrate.
        cam, eye, target = generator.build(index, name)
        generated_base = generator.pose(cam, eye, target, 'still', 0, base['width'], base['height'])
        if not np.allclose(generated_base['camera_to_world'], base['camera_to_world'], atol=1e-6):
            raise ValueError('Source scene camera changed')
        image = bpy.data.images.load(str(base_dir/base['mask']))
        image.colorspace_settings.name = 'Non-Color'
        pixels = np.empty(base['width']*base['height']*4, dtype=np.float32)
        image.pixels.foreach_get(pixels)
        mask = np.rint(pixels.reshape(base['height'],base['width'],4)[::-1,:,0]*255).ravel()
        bpy.data.images.remove(image)
        median = float(np.median(z[(mask == 1) & np.isfinite(z) & (z > 0)]))
        tree, flags = generator.geometry()
        scene = bpy.context.scene
        scene.render.threads = 2
        for row in rows:
            folder = out/name/row['profile']
            folder.mkdir(parents=True, exist_ok=True)
            for camera in row['targetCameras']:
                w, h = camera['width'], camera['height']
                if args.raster=='review':
                    w,h=(390,844) if row['profile']=='phone' else (720,450)
                    if abs(w/h-camera['width']/camera['height'])>1e-10:raise ValueError('Review raster must preserve the exact camera aspect ratio')
                c2w = world_camera(base, camera, median)
                stem = f"{camera['yaw']}-{camera['pitch']}"
                cam.matrix_world = Matrix(c2w.tolist()) @ Matrix.Diagonal([1,-1,-1,1])
                focal = focal_pixels(w,h,camera['fov'])
                cam.data.lens = focal * cam.data.sensor_width / w
                scene.render.resolution_x, scene.render.resolution_y = w, h
                scene.render.resolution_percentage = 100
                scene.render.filepath = str(folder/(stem+'.jpg'))
                bpy.context.view_layer.update()
                pose = {'width':w,'height':h,'K':[[focal,0,w/2],[0,focal,h/2],[0,0,1]],
                        'camera_to_world':c2w.tolist(),'world_to_camera':np.linalg.inv(c2w).tolist(),
                        'rgb':stem+'.jpg','mask':stem+'.mask.png','depth':stem+'.depth.f32.gz'}
                old = reused.get((name,row['profile'],camera['yaw'],camera['pitch']))
                copied = None
                if old and old['sourcePhotoHash'] == row['photoHash'] and old['camera'] == camera and np.allclose(old['pose']['K'],pose['K'],atol=1e-8,rtol=0) and np.allclose(old['pose']['camera_to_world'],c2w,atol=1e-10,rtol=0):
                    copied = {}
                    for key in ['rgb','mask','depth']:
                        src = Path(args.reuse_from)/old['folder']/old['pose'][key]
                        shutil.copyfile(src,folder/pose[key])
                        copied[key] = hashlib.sha256(src.read_bytes()).hexdigest()
                if not (folder/pose['rgb']).exists(): bpy.ops.render.render(write_still=True)
                if not (folder/pose['depth']).exists(): generator.depth(tree, flags, pose, folder, stem)
                frame = next(r for r in row['rows'] if r['yaw'] == camera['yaw'] and r['pitch'] == camera['pitch'])
                corners = json.loads(gzip.decompress((capture_path.parent/frame['boundaryFile']).read_bytes()))
                corners = [[p[0]*w/camera['width'],p[1]*h/camera['height'],*p[2:]] for p in corners]
                record = {'scene':name,'profile':row['profile'],'camera':camera,'sourceMedian':median,
                          'sourcePhotoHash':row['photoHash'], 'supportCorners':corners,
                          'folder':str(folder.relative_to(out)),'pose':pose}
                record['artifactHashes'] = {k:hashlib.sha256((folder/pose[k]).read_bytes()).hexdigest() for k in ['rgb','mask','depth']}
                if copied: record['reuse'] = {'from':str(Path(args.reuse_from).resolve()),'verifiedHashes':copied}
                records.append(record)
                generator.save_json(out/'targets.json', {'complete':False,'records':records})
                print(f'TARGET {name} {row["profile"]} {stem}', flush=True)
    generator.save_json(out/'targets.json', {'complete':True,'records':records})


if __name__ == '__main__': main()
