"""Deterministic product-photo cameras and CPU rendering, shared by builder and truth factory."""
import json
import math
import time
from pathlib import Path
import bpy
from mathutils import Vector


def bounds(objects):
    bpy.context.view_layer.update()
    points = [o.matrix_world @ Vector(v) for o in objects for v in o.bound_box]
    lo = [min(p[k] for p in points) for k in range(3)]
    hi = [max(p[k] for p in points) for k in range(3)]
    return lo, hi


def configure(size, samples, engine='CYCLES'):
    scene = bpy.context.scene
    scene.render.engine = engine
    scene.render.resolution_x = scene.render.resolution_y = size
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.threads_mode = 'FIXED'
    scene.render.threads = 4
    if engine == 'CYCLES':
        scene.cycles.device = 'CPU'
        scene.cycles.samples = samples
        scene.cycles.seed = 1
        scene.cycles.use_animated_seed = False
        scene.cycles.use_adaptive_sampling = False
        scene.cycles.use_denoising = False
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    if not scene.world:
        scene.world = bpy.data.worlds.new('Studio world')
    scene.world.use_nodes = True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value = (.75, .75, .75, 1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value = .65
    if not any(o.type == 'LIGHT' for o in scene.objects):
        for name, at, power, scale in [('Key', (-3, -4, 5), 450, 4), ('Fill', (4, 1, 3), 250, 3)]:
            data = bpy.data.lights.new(name, 'AREA')
            data.energy, data.shape, data.size = power, 'DISK', scale
            obj = bpy.data.objects.new(name, data)
            scene.collection.objects.link(obj)
            obj.location = at
            obj.rotation_euler = (-obj.location).to_track_quat('-Z', 'Y').to_euler()
    return scene


def camera_for(image, objects):
    lo, hi = bounds(objects)
    center = [(a+b)/2 for a, b in zip(lo, hi)]
    extent = max(b-a for a, b in zip(lo, hi))
    hint = {'front': (0, 0), 'back': (180, 0), 'left': (-90, 0), 'right': (90, 0), 'top': (0, 89.9), 'three-quarter': (35, 20), 'detail': (35, 15), 'unknown': (35, 15)}
    yaw, pitch = hint[image['view']]
    c = dict(yaw=yaw, pitch=pitch, fov=40, distance=extent*2.5, target=[center[0], center[2], -center[1]])
    c.update(image.get('camera', {}))
    yaw, pitch = math.radians(c['yaw']), math.radians(c['pitch'])
    tx, ty, tz = c['target']
    target = Vector((tx, -tz, ty))
    delta = Vector((math.sin(yaw)*math.cos(pitch), -math.cos(yaw)*math.cos(pitch), math.sin(pitch))) * c['distance']
    data = bpy.data.cameras.new('Pack camera')
    data.angle = math.radians(c['fov'])
    if c.get('orthoScale'):
        data.type, data.ortho_scale = 'ORTHO', c['orthoScale']
    obj = bpy.data.objects.new('Pack camera', data)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = target + delta
    obj.rotation_euler = (target-obj.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.scene.camera = obj
    return obj, c


def render_pack(pack, output, size=256, samples=16, engine='CYCLES'):
    output = Path(output)
    (output/'renders').mkdir(parents=True, exist_ok=True)
    objects = [o for o in bpy.context.scene.objects if o.type in {'MESH', 'CURVE'}]
    if not objects:
        raise ValueError('Model script produced no geometry')
    scene = configure(size, samples, engine)
    cameras = []
    for i, img in enumerate(pack['images']):
        camera, c = camera_for(img, objects)
        scene.render.filepath = str(output/'renders'/f'{i:03}.png')
        start = time.monotonic()
        bpy.ops.render.render(write_still=True)
        cameras.append({'file': img['file'], 'camera': c, 'source': 'provided' if 'camera' in img else 'view-hint-unfitted', 'seconds': time.monotonic()-start, 'size': size, 'samples': samples, 'engine': engine})
        bpy.data.objects.remove(camera, do_unlink=True)
    (output/'cameras.json').write_text(json.dumps(cameras, indent=2)+'\n')
    return cameras


def bake_colors(objects, size=256):
    """Bake procedural base color, without light, into packed glTF textures."""
    scene = configure(size, 1)
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True
    scene.render.bake.margin = 4
    for obj in objects:
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        for mod in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=mod.name)
        # Joined primitives overlap in their original UVs. Make a fresh atlas while
        # retaining source UVs for any photo textures used by the input materials.
        bake_uv = obj.data.uv_layers.new(name='RefblendBake')
        obj.data.uv_layers.active = bake_uv
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.uv.smart_project(island_margin=.03)
        bpy.ops.object.mode_set(mode='OBJECT')
        if not obj.data.materials:
            continue
        # Unique material copies per object avoid overwriting another object's UV bake.
        for slot in obj.material_slots:
            if slot.material:
                slot.material = slot.material.copy()
        image = bpy.data.images.new(obj.name+' base color', size, size, alpha=False)
        for mat in obj.data.materials:
            if not mat or not mat.use_nodes:
                continue
            node = mat.node_tree.nodes.new('ShaderNodeTexImage')
            node.image = image
            mat.node_tree.nodes.active = node
        # Metal and glass have no diffuse lobe. Bake the base-color socket through
        # emission, or their exported textures become black even when renders look right.
        restore = []
        for mat in obj.data.materials:
            if not mat or not mat.use_nodes:
                continue
            shader = mat.node_tree.nodes.get('Principled BSDF')
            output = mat.node_tree.nodes.get('Material Output')
            if not shader or not output:
                continue
            emit = mat.node_tree.nodes.new('ShaderNodeEmission')
            base = shader.inputs['Base Color']
            if base.is_linked:
                mat.node_tree.links.new(base.links[0].from_socket, emit.inputs['Color'])
            else:
                emit.inputs['Color'].default_value = base.default_value
            previous = output.inputs['Surface'].links[0].from_socket if output.inputs['Surface'].is_linked else None
            mat.node_tree.links.new(emit.outputs[0], output.inputs['Surface'])
            restore.append((mat, output, previous, emit))
        bpy.ops.object.bake(type='EMIT', uv_layer=bake_uv.name)
        for mat, output, previous, emit in restore:
            if previous:
                mat.node_tree.links.new(previous, output.inputs['Surface'])
            mat.node_tree.nodes.remove(emit)
        image.pack()
        for mat in obj.data.materials:
            if not mat or not mat.use_nodes:
                continue
            shader = mat.node_tree.nodes.get('Principled BSDF')
            if shader:
                texture = mat.node_tree.nodes.active
                uv = mat.node_tree.nodes.new('ShaderNodeUVMap')
                uv.uv_map = bake_uv.name
                mat.node_tree.links.new(uv.outputs['UV'], texture.inputs['Vector'])
                mat.node_tree.links.new(texture.outputs['Color'], shader.inputs['Base Color'])
