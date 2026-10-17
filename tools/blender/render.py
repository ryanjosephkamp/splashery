"""MIT. CPU Cycles views and geometric truth for a hash-checked, self-contained CC0 GLB.

Run: bash tools/blender-cloud.sh --python tools/blender/render.py -- --help
World coordinates remain in the source model's Blender import coordinates, in meters.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys
import time

import bpy
from mathutils import Vector
import numpy as np

TOOLS = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(TOOLS))
from studio_truth_camera import rays, write_depth
from studio_truth_images import canonical_png
spec = importlib.util.spec_from_file_location('truth', TOOLS / 'studio-truth-generate.py')
truth = importlib.util.module_from_spec(spec)
spec.loader.exec_module(truth)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def save_json(path, value):
    path.write_text(json.dumps(value, indent=2, sort_keys=True, allow_nan=False) + '\n')


def validate_model(model, record):
    required = ['source', 'author', 'license', 'checked', 'sha256', 'changes']
    if any(not isinstance(record.get(key), str) or not record[key] for key in required):
        raise ValueError('Asset record requires source, author, license, checked, sha256, and changes')
    if record['license'] != 'CC0-1.0':
        raise ValueError('This tool accepts recorded CC0-1.0 models only')
    if sha(model) != record['sha256']:
        raise ValueError('Model SHA-256 mismatch')
    data = model.read_bytes()
    if len(data) < 20 or struct.unpack_from('<4sII', data) != (b'glTF', 2, len(data)):
        raise ValueError('Expected a GLB 2.0 file')
    length, kind = struct.unpack_from('<II', data, 12)
    if kind != 0x4e4f534a or 20 + length > len(data):
        raise ValueError('GLB JSON chunk missing or truncated')
    document = json.loads(data[20:20+length])
    for entry in document.get('buffers', []) + document.get('images', []):
        if 'uri' in entry and not entry['uri'].startswith('data:'):
            raise ValueError('GLB must embed all buffers and textures; external URIs are unsupported')


def prepare_materials():
    fallback = bpy.data.materials.new('cloud-default')
    fallback.use_nodes = True
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            if not obj.data.materials:
                obj.data.materials.append(fallback)
            for slot in obj.material_slots:
                if slot.material is None:
                    slot.material = fallback
    for mat in bpy.data.materials:
        ambiguous = False
        if mat.use_nodes:
            for node in mat.node_tree.nodes:
                if node.type == 'BSDF_PRINCIPLED':
                    for key in ['Metallic', 'Transmission Weight', 'Alpha']:
                        value = node.inputs.get(key)
                        if value and (value.is_linked or (value.default_value < 1 if key == 'Alpha' else value.default_value > 0)):
                            ambiguous = True
                    strength, color = node.inputs['Emission Strength'], node.inputs['Emission Color']
                    if (strength.is_linked or strength.default_value > 0) and (color.is_linked or max(color.default_value[:3]) > 0):
                        ambiguous = True
                elif node.type in ['BSDF_GLASS', 'BSDF_REFRACTION', 'BSDF_TRANSPARENT', 'EMISSION']:
                    ambiguous = True
        mat['truth_appearance_ambiguous'] = ambiguous


def panorama_rays(width, height, c2w):
    longitude, latitude = np.meshgrid(
        (np.arange(width)+.5)/width*2*math.pi-math.pi,
        math.pi/2-(np.arange(height)+.5)/height*math.pi)
    local = np.stack((np.sin(longitude)*np.cos(latitude), -np.sin(latitude),
                      np.cos(longitude)*np.cos(latitude)), axis=-1)
    return local @ np.asarray(c2w)[:3,:3].T


def trace(tree, flags, pose, panoramic=False):
    w, h = pose['width'], pose['height']
    c2w = np.asarray(pose['camera_to_world'])
    directions = (panorama_rays(w, h, c2w) if panoramic else rays(pose['K'], c2w, w, h)).reshape(-1,3)
    origin = Vector(c2w[:3,3])
    forward = c2w[:3,2]
    z, mask = np.full(w*h, np.nan, dtype=np.float32), np.zeros(w*h, dtype=np.uint8)
    for i, direction in enumerate(directions):
        cosine = 1.0 if panoramic else float(np.dot(direction, forward))
        near, far = pose.get('clip_meters', [.05, 200])
        location, normal, face, distance = tree.ray_cast(
            origin+Vector(direction)*(near/cosine), Vector(direction), (far-near)/cosine)
        if location is not None:
            value = near + distance*cosine
            if near <= value <= far:
                z[i], mask[i] = value, flags[face]
    return z.reshape(h,w), mask.reshape(h,w)


def write_mask(path, mask):
    h, w = mask.shape
    image = bpy.data.images.new('cloud-mask', width=w, height=h, alpha=True)
    image.colorspace_settings.name = 'Non-Color'
    rgba = np.ones((h,w,4), dtype=np.float32)
    rgba[:,:,:3] = mask[:,:,None]/255
    image.pixels.foreach_set(rgba[::-1].ravel())
    image.filepath_raw, image.file_format = str(path), 'PNG'
    image.save()
    bpy.data.images.remove(image)


def camera_pose(camera, width, height, panoramic=False):
    bpy.context.view_layer.update()
    c2w = np.asarray(camera.matrix_world) @ np.diag([1,-1,-1,1])
    result = {'width': width, 'height': height, 'camera_to_world': c2w.tolist(),
              'world_to_camera': np.linalg.inv(c2w).tolist(),
              'clip_meters': [camera.data.clip_start, camera.data.clip_end],
              'projection': 'equirectangular' if panoramic else 'pinhole'}
    if panoramic:
        result.update(longitude_radians=[-math.pi,math.pi], latitude_radians=[math.pi/2,-math.pi/2],
                      depth_convention='radial distance, meters')
    else:
        f = width*camera.data.lens/camera.data.sensor_width
        result.update(K=[[f,0,width/2],[0,f,height/2],[0,0,1]], depth_convention='optical-axis Z, meters')
    return result


def render_view(out, stem, tree, flags, width, height, panoramic=False):
    scene = bpy.context.scene
    scene.render.resolution_x, scene.render.resolution_y = width, height
    camera = scene.camera
    camera.data.type = 'PANO' if panoramic else 'PERSP'
    if panoramic:
        camera.data.panorama_type = 'EQUIRECTANGULAR'
        camera.data.longitude_min, camera.data.longitude_max = -math.pi, math.pi
        camera.data.latitude_min, camera.data.latitude_max = -math.pi/2, math.pi/2
    pose = camera_pose(camera, width, height, panoramic)
    pose.update(rgb=f'{stem}.png', depth=f'{stem}.depth.f32.gz', mask=f'{stem}.mask.png', pose=f'{stem}.json')
    started = time.monotonic()
    scene.render.filepath = str(out / pose['rgb'])
    bpy.ops.render.render(write_still=True)
    canonical_png(out / pose['rgb'])
    rendered = time.monotonic()
    z, mask = trace(tree, flags, pose, panoramic)
    write_depth(out / pose['depth'], z)
    write_mask(out / pose['mask'], mask)
    canonical_png(out / pose['mask'])
    save_json(out / pose['pose'], pose)
    elapsed = time.monotonic() - rendered
    return pose, {'id': stem, 'rgb_seconds': rendered-started, 'truth_seconds': elapsed,
                  'pixels': width*height}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--model', type=Path, required=True)
    ap.add_argument('--asset-record', type=Path, required=True)
    ap.add_argument('--out', type=Path, required=True, help='New or empty directory; never resumes stale files')
    ap.add_argument('--width', type=int, default=640)
    ap.add_argument('--height', type=int, default=480)
    ap.add_argument('--views', type=int, default=8)
    ap.add_argument('--samples', type=int, default=16)
    ap.add_argument('--panorama-width', type=int, default=1280, help='2:1 panorama')
    ap.add_argument('--timings', type=Path, help='Write operational timings outside the deterministic output')
    opt = ap.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    if bpy.app.version != (4,5,3):
        ap.error('Use the pinned Blender 4.5.3 via tools/blender-cloud.sh')
    if not (1 <= opt.views <= 360 and 1 <= opt.samples <= 4096 and
            4 <= opt.width <= 8192 and 4 <= opt.height <= 8192 and
            8 <= opt.panorama_width <= 16384 and opt.panorama_width % 2 == 0):
        ap.error('Invalid dimensions, view count, or sample count')
    record = json.loads(opt.asset_record.read_text())
    validate_model(opt.model, record)
    out = opt.out.resolve()
    if out.exists() and any(out.iterdir()):
        ap.error('Output must be a new or empty directory')
    if opt.timings and (opt.timings.resolve() == out or out in opt.timings.resolve().parents):
        ap.error('Timings must be outside the deterministic output directory')
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(opt.model.resolve()), import_pack_images=True)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not meshes:
        ap.error('Model has no mesh geometry')
    for obj in list(bpy.context.scene.objects):
        if obj.type in ['LIGHT','CAMERA']:
            bpy.data.objects.remove(obj, do_unlink=True)
    prepare_materials()
    tree, flags = truth.geometry()
    bpy.context.view_layer.update()
    corners = np.asarray([tuple(o.matrix_world @ Vector(c)) for o in meshes for c in o.bound_box])
    low, high = corners.min(axis=0), corners.max(axis=0)
    center = (low+high)/2
    radius = float(np.linalg.norm(high-low)/2)
    if not np.isfinite(radius) or radius <= 0:
        ap.error('Model bounds are degenerate')
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples, scene.cycles.seed = opt.samples, 105
    scene.cycles.use_animated_seed = False
    scene.cycles.use_denoising = False
    scene.cycles.use_adaptive_sampling = False
    scene.render.threads_mode, scene.render.threads = 'FIXED', 4
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.render.image_settings.compression = 15
    scene.render.use_stamp = False
    scene.render.use_motion_blur = False
    scene.render.film_transparent = False
    scene.view_settings.view_transform, scene.view_settings.look = 'Standard', 'None'
    scene.view_settings.exposure, scene.view_settings.gamma = 0, 1
    scene.world = bpy.data.worlds.new('cloud-world')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.16,.16,.16,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .5
    lamp = bpy.data.lights.new('cloud-key', 'AREA')
    lamp.energy, lamp.size = 700*radius*radius, 4*radius
    obj = bpy.data.objects.new('cloud-key', lamp)
    scene.collection.objects.link(obj)
    obj.location = center + np.array([2,-3,4])*radius
    obj.rotation_euler = (Vector(center)-obj.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.object.camera_add()
    camera = bpy.context.object
    scene.camera = camera
    camera.data.lens, camera.data.sensor_width, camera.data.sensor_fit = 40, 36, 'HORIZONTAL'
    camera.data.clip_start, camera.data.clip_end = max(radius*.001, .00001), radius*20
    # Fit the bounding sphere using the smaller vertical/horizontal field of view.
    half_fov = math.atan(.5*36/40*min(1, opt.height/opt.width))
    distance = radius/math.sin(half_fov)*1.15
    # Far clipping must include the orbit distance even for very wide aspect ratios.
    camera.data.clip_end = max(radius*20, distance+radius*2)
    out.mkdir(parents=True, exist_ok=True)
    views, timings = [], []
    for i in range(opt.views):
        angle = 2*math.pi*i/opt.views
        direction = np.array([math.sin(angle), -math.cos(angle), .25])
        camera.location = center + direction/np.linalg.norm(direction)*distance
        camera.rotation_euler = (Vector(center)-camera.location).to_track_quat('-Z','Y').to_euler()
        view, timing = render_view(out, f'view-{i:03d}', tree, flags, opt.width, opt.height)
        views.append(view)
        timings.append(timing)
    # Same location/orientation as first perspective camera, covering the complete sphere.
    camera.location = center + np.array([0,-1,.25])/np.linalg.norm([0,-1,.25])*distance
    camera.rotation_euler = (Vector(center)-camera.location).to_track_quat('-Z','Y').to_euler()
    pano, timing = render_view(out, 'panorama', tree, flags, opt.panorama_width, opt.panorama_width//2, True)
    timings.append(timing)
    sources = {str(p.relative_to(TOOLS)): sha(p) for p in [Path(__file__).resolve(),
               TOOLS/'studio-truth-generate.py', TOOLS/'studio_truth_camera.py',
               TOOLS/'blender/install.py', TOOLS/'blender-cloud.sh', TOOLS/'studio_truth_images.py']}
    manifest = {'schema': 1, 'blender': bpy.app.version_string, 'engine': 'CYCLES', 'device': 'CPU',
                'threads': 4, 'samples': opt.samples, 'seed': 105, 'asset': record,
                'build_hash': bpy.app.build_hash.decode(), 'python': sys.version.split()[0],
                'numpy': np.__version__,
                'archive_sha256': '975c58fcb244273838534bba771e64ad87739216b0f9b39a888531a49a72d845',
                'source_sha256': sources, 'model_sha256': sha(opt.model),
                'world': 'Blender right-handed Z-up, meters; original imported model coordinates',
                'camera': '+X right, +Y down, +Z forward; row-major matrices acting on column vectors',
                'pixel_centers': '(x+0.5,y+0.5)', 'depth_encoding': 'gzip float32 LE, top row first; NaN for no hit',
                'mask': {'0': 'no geometric hit', '1': 'opaque geometric hit',
                         '3': 'geometric hit with ambiguous appearance (metal, glass, alpha, emission)'},
                'bounds': {'min': low.tolist(), 'max': high.tolist()}, 'views': views, 'panorama': pano,
                'determinism_scope': 'Identical pinned build, source, input, settings, CPU architecture, and libraries'}
    save_json(out/'manifest.json', manifest)
    save_json(out/'checksums.json', {p.name: {'sha256': sha(p), 'bytes': p.stat().st_size}
                                   for p in sorted(out.iterdir()) if p.is_file()})
    if opt.timings:
        opt.timings.parent.mkdir(parents=True, exist_ok=True)
        save_json(opt.timings, timings)
    print(f'CLOUD RENDER: {len(views)} calibrated views and one panorama in {out}', flush=True)


if __name__ == '__main__':
    main()
