"""Original CC0 Studio fixtures. Made by Ryan with Codex (GPT-6).

blender -b --factory-startup --threads 4 --python tools/studio-truth-generate.py -- \
    --out .cache/studio-truth/full --mode all

Native Blender 4.3.2, CPU Cycles only. No outside assets or downloads. Stills
are 1280x720; videos are 640x360, 30 fps. Full outputs belong in .cache/, never
in Git. See tests/fixtures/truth/README.md for calibration and storage.
"""

import argparse
import hashlib
import json
import math
from pathlib import Path
import random
import subprocess
import sys
import time

import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from studio_truth_camera import rays, write_depth
from studio_truth_images import canonical_jpeg

CANONICAL_DIR = Path(__file__).resolve().parent/'blender/truth-scenes'
CANONICAL_RECORD = Path(__file__).resolve().parent/'blender/truth-scenes.json'

SCENES = [
    ('still-life', 'Glass and metal still life', 'Transmission, reflections, and round depth edges'),
    ('room', 'Room interior', 'Large planes, corners, and foreground occlusion'),
    ('forest', 'Forest path', 'Repeated trunks, foliage, and distant geometry'),
    ('stairs', 'Stairs and railings', 'Thin rails and repeated depth steps'),
    ('coast', 'Cliff and sea', 'Rough rock, reflective water, and invalid sky'),
    ('desk', 'Cluttered desk', 'Overlapping small objects and narrow gaps'),
    ('fur', 'Fur on a sphere', 'Hundreds of short geometric fibers'),
    ('night', 'Night street and lamps', 'Emissive lights and low contrast'),
    ('lattice', 'Lattice and colored blocks', 'Subpixel bars and disocclusion'),
    ('arches', 'Arch corridor', 'Nested occlusion and a long depth range'),
    ('leaves', 'Leaves and pots', 'Thin leaves, texture, and foreground cuts'),
    ('steps', 'Depth edge blocks', 'Known planar steps and high-contrast edges'),
]


def material(name, color, metal=0, transmission=0, glow=0, texture=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Metallic'].default_value = metal
    p.inputs['Roughness'].default_value = .12 if metal or transmission else .65
    p.inputs['Transmission Weight'].default_value = transmission
    p.inputs['IOR'].default_value = 1.45
    p.inputs['Emission Color'].default_value = (*color, 1)
    p.inputs['Emission Strength'].default_value = glow
    m['truth_appearance_ambiguous'] = bool(metal or transmission or glow)
    if texture:
        noise = m.node_tree.nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 14
        ramp = m.node_tree.nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = tuple(c*.4 for c in color)+(1,)
        ramp.color_ramp.elements[1].color = (*color, 1)
        m.node_tree.links.new(noise.outputs['Fac'], ramp.inputs[0])
        m.node_tree.links.new(ramp.outputs[0], p.inputs['Base Color'])
    return m


def finish(obj, mat):
    obj.data.materials.append(mat)
    return obj


def box(center, scale, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    o = bpy.context.object
    o.scale = scale
    return finish(o, mat)


def sphere(center, radius, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=12, radius=radius, location=center)
    return finish(bpy.context.object, mat)


def rod(a, b, radius, mat, vertices=10):
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=(b-a).length, location=(a+b)/2)
    o = bpy.context.object
    o.rotation_euler = (b-a).to_track_quat('Z', 'Y').to_euler()
    return finish(o, mat)


def build(index, name):
    # Fixed serialized scene inputs stabilize Cycles sampling across fresh processes.
    if bpy.app.version == (4, 5, 3):
        record = json.loads(CANONICAL_RECORD.read_text())['scenes'][name]
        file = CANONICAL_DIR/f'{name}.blend'
        if hashlib.sha256(file.read_bytes()).hexdigest() != record['sha256']:
            raise ValueError('Canonical scene SHA-256 mismatch')
        bpy.ops.wm.open_mainfile(filepath=str(file), use_scripts=False)
        return bpy.context.scene.camera, np.array(record['eye']), np.array(record['target'])
    return build_procedural(index, name)


def build_procedural(index, name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rng = random.Random(5600+index)
    ground = material('ground', (.26, .29, .30), texture=True)
    wood = material('wood', (.38, .17, .07), texture=True)
    stone = material('stone', (.38, .42, .46), texture=True)
    green = material('leaf', (.10, .32, .08), texture=True)
    red = material('red', (.72, .13, .06))
    blue = material('blue', (.06, .22, .67))
    pale = material('pale', (.72, .65, .48))
    metal = material('metal', (.70, .72, .76), metal=1)
    glass = material('glass', (.75, .90, .94), transmission=1)
    lamp = material('lamp', (1, .54, .13), glow=8)
    ground_obj = box((0, 2, -.16), (24, 26, .3), ground)
    eye, target = (4, -6, 3.1), (0, 1, 1)
    if name == 'still-life':
        box((0, 1, .7), (3.4, 2.2, .15), wood)
        for x, m in [(-.9, glass), (0, metal), (.9, red)]:
            sphere((x, 1, 1.3), .48, m)
        rod((-.55, .4, .8), (-.55, .4, 1.5), .13, glass)
        box((.5, 1.7, .94), (.55, .55, .4), pale)
    elif name == 'room':
        box((0, 5, 2), (8, .2, 4), pale)
        box((-4, 1, 2), (.2, 8, 4), stone)
        box((0, 2, .45), (2.8, 1.2, .9), blue)
        box((1.9, .5, .85), (1.2, 1, .13), wood)
        for x in [1.4, 2.4]:
            for y in [.1, .9]: rod((x, y, 0), (x, y, .8), .04, wood)
        box((-2.5, 3.6, 1.4), (1.1, .5, 2.8), wood)
        for z in [.4, 1.2, 2]: box((-2.5, 3.25, z), (1.2, .25, .08), pale)
        eye, target = (2.7, -4, 2.2), (-.5, 2.5, 1.3)
    elif name == 'forest':
        box((0, 6, -.01), (1.9, 18, .04), wood)
        for i in range(30):
            x = (-1 if i%2 else 1)*rng.uniform(1.3, 4.8)
            y = rng.uniform(0, 17)
            height = rng.uniform(2.5, 4.7)
            rod((x,y,0), (x,y,height), .15, wood)
            sphere((x,y,height), rng.uniform(.6,1), green)
        eye, target = (.5, -3, 1.7), (0, 7, 1.5)
    elif name == 'stairs':
        for i in range(10):
            box((0, i*.5, (i+1)*.13), (2.4, .5, (i+1)*.26), stone)
            for x in [-1.2, 1.2]:
                rod((x,i*.5,(i+1)*.26), (x,i*.5,(i+1)*.26+1), .025, metal)
        for x in [-1.2,1.2]: rod((x,0,1.26), (x,4.5,3.6), .03, metal)
        eye, target = (3.3,-3,2.6), (0,2,1.6)
    elif name == 'coast':
        bpy.data.objects.remove(ground_obj, do_unlink=True)
        water = material('water', (.03,.22,.38), metal=.7)
        box((2,7,-.04), (30,30,.05), water)
        for i in range(20):
            o = sphere((-2+rng.uniform(-1,1), i*.55, -.3), rng.uniform(.6,1.5), stone)
            o.scale.z = rng.uniform(1,2)
        eye, target = (-3,-4,3.7), (0,4,.3)
    elif name == 'desk':
        box((0,1,.9), (3.8,2.3,.15), wood)
        for i in range(24):
            x,y = rng.uniform(-1.5,1.5), rng.uniform(.2,1.9)
            box((x,y,1.06+rng.uniform(0,.2)), (rng.uniform(.2,.6),rng.uniform(.2,.5),.15), [red,blue,pale][i%3])
        for i in range(8): rod((-.9+i*.12,.2,1), (-.4+i*.12,.7,1.1), .017, pale)
        rod((1,1.8,1), (1,1.8,1.7), .05, metal)
        eye, target = (3,-3,3.2), (0,1,1)
    elif name == 'fur':
        center = Vector((0,1,1.1))
        sphere(center, .65, wood)
        for i in range(650):
            z = rng.uniform(-1,1); theta = rng.uniform(0,2*math.pi)
            d = Vector((math.sqrt(1-z*z)*math.cos(theta),math.sqrt(1-z*z)*math.sin(theta),z))
            rod(center+d*.64, center+d*rng.uniform(.71,.79), .009, pale, vertices=5)
        eye, target = (2,-3,2), (0,1,1.1)
    elif name == 'night':
        for i in range(9):
            y = i*1.7
            for x in [-2.3,2.3]:
                rod((x,y,0),(x,y,2.8),.045, stone)
                sphere((x,y,2.8),.16,lamp)
                light('POINT', (x,y,2.7), 65)
            box((-4,y,1.7), (2.5,1.4,3.4), stone)
        eye, target = (.6,-3,1.6), (0,8,1.6)
    elif name == 'lattice':
        for x in np.linspace(-1.7,1.7,22): rod((x,0,.2),(x,0,2.7),.012,pale)
        for z in np.linspace(.2,2.7,15): rod((-1.7,0,z),(1.7,0,z),.012,pale)
        for i,m in enumerate([red,blue,green]): box((-1+i,2,1),(.8,.8,2),m)
        eye, target = (2,-4,2), (0,1,1.3)
    elif name == 'arches':
        for i in range(8):
            y = i*1.7
            for x in [-1.4,1.4]: box((x,y,1.1),(.3,.4,2.2),stone)
            for a in np.linspace(0,math.pi,16):
                sphere((1.4*math.cos(a),y,2.2+1.4*math.sin(a)),.19,pale)
        eye, target = (.3,-3,1.6), (0,7,1.8)
    elif name == 'leaves':
        for i in range(9):
            x,y = rng.uniform(-2,2), rng.uniform(0,5)
            rod((x,y,0),(x,y,.35),.22,red)
            rod((x,y,.3),(x,y,1.7),.02,green)
            for j in range(7):
                a = rng.uniform(0,2*math.pi)
                o = sphere((x+.32*math.cos(a),y+.32*math.sin(a),.6+j*.16),1,green)
                o.scale = (.38,.12,.016)
                o.rotation_euler = (.3,.4,a)
        eye, target = (3,-4,2.3), (0,2,1)
    else:
        for i in range(7):
            x = -2.1+i*.7
            box((x,1+i*.45,.5+i*.14),(.68,.5,1+i*.28),[pale,blue,red][i%3])
        rod((0,-.2,.1),(0,-.2,2.8),.016,pale)
        eye, target = (1,-5,2), (0,2,1.2)
    s = bpy.context.scene
    s.world = bpy.data.worlds.new('sky')
    s.world.use_nodes = True
    s.world.node_tree.nodes['Background'].inputs[0].default_value = (.09,.16,.24,1)
    s.world.node_tree.nodes['Background'].inputs[1].default_value = .035 if name=='night' else .4
    if name != 'night': light('AREA', (0,-3,7), 1500, size=6)
    light('AREA', (-4,4,5), 35 if name=='night' else 900, size=4)
    bpy.ops.object.camera_add(location=eye)
    cam = bpy.context.object
    cam.data.lens, cam.data.sensor_width = 40, 36
    cam.data.sensor_fit = 'HORIZONTAL'
    cam.data.clip_start, cam.data.clip_end = .05, 200
    s.camera = cam
    s.render.engine = 'CYCLES'
    s.cycles.device = 'CPU'
    s.cycles.samples = 8
    s.cycles.seed = 56
    s.cycles.use_animated_seed = False
    s.cycles.use_denoising = False
    s.cycles.use_adaptive_sampling = False
    s.render.threads_mode, s.render.threads = 'FIXED', 4
    s.render.use_persistent_data = True
    s.render.image_settings.file_format = 'JPEG'
    s.render.image_settings.quality = 92
    s.render.film_transparent = False
    s.render.use_motion_blur = False
    s.view_settings.view_transform = 'Standard'
    s.view_settings.look = 'None'
    s.view_settings.exposure, s.view_settings.gamma = 0,1
    return cam, np.array(eye), np.array(target)


def light(kind, pos, energy, size=1):
    data = bpy.data.lights.new('light', kind)
    data.energy = energy
    if kind == 'AREA': data.size = size
    o = bpy.data.objects.new('light', data)
    bpy.context.scene.collection.objects.link(o)
    o.location = pos
    o.rotation_euler = (Vector((0,2,0))-o.location).to_track_quat('-Z','Y').to_euler()


def geometry():
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    vertices, faces, flags = [], [], []
    for o in bpy.context.scene.objects:
        if o.type != 'MESH': continue
        eo = o.evaluated_get(dg)
        mesh = eo.to_mesh()
        mesh.calc_loop_triangles()
        offset = len(vertices)
        vertices.extend(eo.matrix_world @ v.co for v in mesh.vertices)
        for tri in mesh.loop_triangles:
            faces.append(tuple(offset+i for i in tri.vertices))
            m = mesh.materials[tri.material_index]
            flags.append(3 if m.get('truth_appearance_ambiguous') else 1)
        eo.to_mesh_clear()
    return BVHTree.FromPolygons(vertices, faces, all_triangles=True), flags


def pose(cam, eye, target, kind, frame, width, height):
    t = frame/30
    if kind == 'still': offset = np.zeros(3)
    elif kind == 'handheld': offset = np.array([.14*math.sin(t*.9), .04*math.sin(t*.7), .035*math.sin(t*1.3)])
    else:
        forward = target-eye
        forward[2] = 0
        forward /= np.linalg.norm(forward)
        offset = forward*(.9*t/10)+np.array([.06*math.sin(t*.8),0,.025*math.sin(t*1.4)])
    cam.location = eye+offset
    cam.rotation_euler = (Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update()
    c2w = np.array(cam.matrix_world) @ np.diag([1,-1,-1,1])
    f = width*cam.data.lens/cam.data.sensor_width
    return {'frame':frame,'time':t,'width':width,'height':height,
            'K':[[f,0,width/2],[0,f,height/2],[0,0,1]],
            'camera_to_world':c2w.tolist(),'world_to_camera':np.linalg.inv(c2w).tolist()}


def depth(tree, flags, p, folder, stem):
    w,h = p['width'],p['height']
    c2w = np.array(p['camera_to_world'])
    directions = rays(p['K'],c2w,w,h).reshape(-1,3)
    origin = Vector(c2w[:3,3])
    forward = c2w[:3,2]
    z = np.full(w*h,np.nan,dtype=np.float32)
    mask = np.zeros(w*h,dtype=np.uint8)
    for i,d in enumerate(directions):
        cosine = np.dot(d,forward)
        # Blender clips in camera Z, not in Euclidean distance along the ray.
        start = origin+Vector(d)*(.05/cosine)
        location,normal,face,distance = tree.ray_cast(start,Vector(d),(200-.05)/cosine)
        if location is not None:
            axial = .05+distance*cosine
            if .05 <= axial <= 200:
                z[i] = axial
                mask[i] = flags[face]
    write_depth(folder/f'{stem}.depth.f32.gz',z.reshape(h,w))
    # PNG mask encoded with Blender so bpy's Python needs no Pillow installation.
    image = bpy.data.images.new('mask',width=w,height=h,alpha=True)
    rgba = np.ones((h,w,4),dtype=np.float32)
    rgba[:,:,:3] = mask.reshape(h,w,1)/255
    image.colorspace_settings.name = 'Non-Color'
    image.pixels.foreach_set(rgba[::-1].ravel())
    image.filepath_raw = str(folder/f'{stem}.mask.png')
    image.file_format = 'PNG'
    image.save()
    bpy.data.images.remove(image)


def save_json(path,data):
    path.write_text(json.dumps(data,indent=2)+'\n')


def render(cam,eye,target,tree,flags,folder,kind,frames,width,height,samples):
    folder.mkdir(parents=True,exist_ok=True)
    s = bpy.context.scene
    s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage = width,height,100
    s.cycles.samples = samples
    poses=[]
    for frame in range(frames):
        stem = f'{frame:06d}' if kind!='still' else 'still'
        p = pose(cam,eye,target,kind,frame,width,height)
        p['rgb'] = f'{stem}.jpg'
        if kind!='walk':
            p.update(depth=f'{stem}.depth.f32.gz',mask=f'{stem}.mask.png')
        if not (folder/p['rgb']).exists():
            s.render.filepath=str(folder/p['rgb'])
            bpy.ops.render.render(write_still=True)
            canonical_jpeg(folder/p['rgb'])
        if kind!='walk' and not (folder/p['depth']).exists(): depth(tree,flags,p,folder,stem)
        poses.append(p)
        if frame%10==0: print(f'TRUTH {folder.parent.name} {kind} {frame+1}/{frames}',flush=True)
    save_json(folder/'poses.json',{'fps':30,'duration_seconds':frames/30 if kind!='still' else 0,'frames':poses})
    if kind!='still':
        subprocess.run(['ffmpeg','-v','error','-y','-threads','2','-framerate','30','-i',str(folder/'%06d.jpg'),
                        '-c:v','libx264','-threads','2','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(folder.parent/f'{kind}.mp4')],check=True)


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--out',default='.cache/studio-truth/full')
    ap.add_argument('--mode',choices=['still','clips','all'],default='all')
    ap.add_argument('--scenes',default=','.join(s[0] for s in SCENES))
    ap.add_argument('--samples',type=int,default=8)
    ap.add_argument('--clip-samples',type=int,default=2)
    ap.add_argument('--clip-side',type=int,default=640)
    ap.add_argument('--limit',type=int,default=0,help='Smoke build only; incomplete sequences are labeled')
    argv=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    opt=ap.parse_args(argv)
    out=Path(opt.out).resolve()
    out.mkdir(parents=True,exist_ok=True)
    settings = {'source_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                'camera_helper_sha256':hashlib.sha256((Path(__file__).parent/'studio_truth_camera.py').read_bytes()).hexdigest(),
                'canonical_scenes_sha256':hashlib.sha256(CANONICAL_RECORD.read_bytes()).hexdigest(),
                'image_helper_sha256':hashlib.sha256((Path(__file__).parent/'studio_truth_images.py').read_bytes()).hexdigest(),
                'blender':bpy.app.version_string,'samples':opt.samples,
                'clip_samples':opt.clip_samples,'clip_side':opt.clip_side,'limit':opt.limit,
                'ffmpeg':subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0],
                'python':sys.version.split()[0],'numpy':np.__version__}
    settings_path = out/'build-settings.json'
    if settings_path.exists():
        if json.loads(settings_path.read_text()) != settings:
            raise ValueError('Existing outputs use different source or settings; choose an empty output folder')
    elif any(out.iterdir()):
        raise ValueError('Existing outputs have no build-settings.json; choose an empty output folder')
    save_json(settings_path,settings)
    selection=opt.scenes.split(',')
    if not set(selection)<=set(s[0] for s in SCENES): ap.error('Unknown scene')
    manifest={'schema':1,'credit':'made by Ryan with Codex (GPT-6)','license':'CC0-1.0',
              'generator':{'blender':bpy.app.version_string,'seed_base':5600,'still_samples':opt.samples,
                           'clip_samples':opt.clip_samples,'cpu_threads':4,'source_sha256':settings['source_sha256'],
                           'camera_helper_sha256':settings['camera_helper_sha256'],
                           'image_helper_sha256':settings['image_helper_sha256'],
                           'canonical_scenes_sha256':hashlib.sha256(CANONICAL_RECORD.read_bytes()).hexdigest(),'ffmpeg':settings['ffmpeg'],
                           'python':settings['python'],'numpy':settings['numpy']},
              'depth':{'convention':'optical-axis Z, meters','encoding':'gzip float32 LE, row-major top-to-bottom','invalid':'NaN',
                       'mask_bits':{'1':'valid first-hit geometry','2':'appearance ambiguous: metal, transmission, or emission'}},
              'camera':{'world':'right-handed Blender Z-up, meters','local':'+X right, +Y down, +Z forward',
                        'pixel_centers':'(x+0.5,y+0.5)','distortion':'none','clip_meters':[.05,200]},
              'scenes':[]}
    for index,(name,label,stress) in enumerate(SCENES):
        if name not in selection: continue
        start=time.monotonic()
        cam,eye,target=build(index,name)
        tree,flags=geometry()
        folder=out/name
        if opt.mode in ['still','all']: render(cam,eye,target,tree,flags,folder/'still','still',1,1280,720,opt.samples)
        if opt.mode in ['clips','all']:
            for kind,count in [('handheld',120),('walk',300)]:
                render(cam,eye,target,tree,flags,folder/kind,kind,min(count,opt.limit) if opt.limit else count,
                       opt.clip_side,round(opt.clip_side*9/16),opt.clip_samples)
        manifest['scenes'].append({'id':name,'label':label,'stress':stress,'seed':5600+index,
                                  'smoke_only':bool(opt.limit),'still':'still/poses.json',
                                  'handheld':'handheld/poses.json','walk':'walk/poses.json'})
        save_json(out/'manifest.json',manifest)
        print(f'TRUTH DONE {name} {time.monotonic()-start:.1f}s',flush=True)
    files=[]
    for path in sorted(out.rglob('*')):
        if path.is_file() and path.name!='checksums.json':
            files.append({'path':str(path.relative_to(out)),'bytes':path.stat().st_size,
                          'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
    save_json(out/'checksums.json',files)


if __name__=='__main__': main()
