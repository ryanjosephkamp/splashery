"""Agent modeling kit. Blender meters, Z up, front toward -Y; GLB/pack cameras are Y up.
Original code: Codex (GPT-6), MIT. Original generated assets: CC0.
"""
import math
import bpy
import bmesh
from mathutils import Vector

PARTS = {}


def _finish(obj, name, material=None):
    obj.name = name
    if material:
        obj.data.materials.append(material)
    for polygon in getattr(obj.data, 'polygons', []):
        polygon.use_smooth = True
    return obj


def box(name, size, at=(0, 0, 0), bevel=0.01, material=None):
    """Solid box with rounded physical edges, in meters."""
    if min(size) <= 0 or bevel < 0:
        raise ValueError('Box dimensions must be positive; bevel must be nonnegative')
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    obj = bpy.context.object
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = obj.modifiers.new('Real beveled edges', 'BEVEL')
        mod.width = min(bevel, min(size) * .49)
        mod.segments = 3
        mod = obj.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
        mod.keep_sharp = True
    return _finish(obj, name, material)


def lathe(name, profile, at=(0, 0, 0), segments=64, material=None, closed=False):
    """Turn an ordered (radius, height) outline around Z, with closed end caps."""
    if len(profile) < 2 or segments < 8 or any(r < 0 for r, z in profile):
        raise ValueError('Lathe needs at least two nonnegative radii and eight segments')
    vertices = [(r * math.cos(i * math.tau / segments), r * math.sin(i * math.tau / segments), z)
                for r, z in profile for i in range(segments)]
    faces = []
    for j in range(len(profile) if closed else len(profile) - 1):
        for i in range(segments):
            a, b = j * segments + i, j * segments + (i + 1) % segments
            faces.append((a, b, (b + segments) % len(vertices), (a + segments) % len(vertices)))
    if not closed:
        faces += [tuple(reversed(range(segments))), tuple((len(profile)-1)*segments+i for i in range(segments))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = at
    return _finish(obj, name, material)



def _closed_curve(obj):
    # Blender's curve caps duplicate their boundary vertices on conversion.
    # Weld the coincident cap seam so exported pieces are closed solids.
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=1e-7)
    bmesh.ops.recalc_face_normals(mesh, faces=list(mesh.faces))
    mesh.to_mesh(obj.data)
    mesh.free()
    return obj


def extrude(name, outline, depth, at=(0, 0, 0), bevel=.005, material=None):
    """Extrude an ordered XY outline, including concave outlines, along Z."""
    if len(outline) < 3 or depth <= 0:
        raise ValueError('Extrusion needs three outline points and positive depth')
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '2D'
    curve.fill_mode = 'BOTH'
    curve.extrude = depth / 2
    curve.bevel_depth = bevel
    curve.bevel_resolution = 3
    spline = curve.splines.new('POLY')
    spline.points.add(len(outline)-1)
    for point, (x, y) in zip(spline.points, outline):
        point.co = (x, y, 0, 1)
    spline.use_cyclic_u = True
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = at
    return _finish(_closed_curve(obj), name, material)


def tube(name, points, radius=.01, material=None):
    """A smooth tube along ordered XYZ points, with capped ends."""
    if len(points) < 2 or radius <= 0:
        raise ValueError('Tube needs two points and a positive radius')
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 4
    curve.use_fill_caps = True
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for p, co in zip(spline.bezier_points, points):
        p.co = co
        p.handle_left_type = p.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    return _finish(_closed_curve(obj), name, material)


def slats(name, count, size, start, step, material=None, bevel=.005):
    return [box(f'{name}-{i}', size, tuple(start[k]+i*step[k] for k in range(3)), bevel, material) for i in range(count)]


def legs(name, positions, profile, material=None, segments=48):
    return [lathe(f'{name}-{i}', profile, p, segments, material) for i, p in enumerate(positions)]


def cushion(name, size, at=(0, 0, 0), material=None, softness=.22, subdivisions=2):
    """Closed, rounded cushion with creased seams and subdivision."""
    obj = box(name, size, at, min(size)*softness, material)
    bpy.context.view_layer.objects.active = obj
    for modifier in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    crease = obj.data.attributes.new('crease_edge', 'FLOAT', 'EDGE')
    for edge in crease.data:
        edge.value = .15
    sub = obj.modifiers.new('Soft cushion subdivision', 'SUBSURF')
    sub.levels = sub.render_levels = subdivisions
    return obj


def sample_color(file, uv=(.5, .5), radius=.02):
    """Sample a picture patch. Choose a foreground patch by eye, away from highlights."""
    img = bpy.data.images.load(str(file), check_existing=True)
    w, h = img.size
    pixels = img.pixels[:]
    sums, count = [0., 0., 0.], 0
    srgb = img.colorspace_settings.name == 'sRGB'
    def linear(c):
        return c/12.92 if c <= .04045 else ((c+.055)/1.055)**2.4
    for y in range(max(0, int((uv[1]-radius)*h)), min(h, int((uv[1]+radius)*h)+1)):
        for x in range(max(0, int((uv[0]-radius)*w)), min(w, int((uv[0]+radius)*w)+1)):
            idx = (y*w+x)*4
            if pixels[idx+3] > .5:
                for k in range(3):
                    sums[k] += linear(pixels[idx+k]) if srgb else pixels[idx+k]
                count += 1
    if not count:
        raise ValueError('Color sample contains no foreground')
    return tuple(s/count for s in sums)


def material(name, kind='plastic', color=(.45, .25, .1), roughness=.5, grain=(3, 3, 45)):
    """Procedural wood/fabric/metal/plastic/glass/stone; color is linear RGB."""
    if kind not in {'wood', 'fabric', 'metal', 'plastic', 'glass', 'stone'}:
        raise ValueError(f'Unknown material: {kind}')
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    mat.diffuse_color = (*color, 1)
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    shader.inputs['Metallic'].default_value = 1 if kind == 'metal' else 0
    if kind == 'glass':
        shader.inputs['Transmission Weight'].default_value = 1
        shader.inputs['IOR'].default_value = 1.45
    if kind in {'wood', 'fabric', 'stone'}:
        tex = nodes.new('ShaderNodeTexCoord')
        mapping = nodes.new('ShaderNodeVectorMath')
        mapping.operation = 'MULTIPLY'
        mapping.inputs[1].default_value = grain if kind == 'wood' else (120, 120, 120) if kind == 'fabric' else (8, 8, 8)
        links.new(tex.outputs['Generated'], mapping.inputs[0])
        noise = nodes.new('ShaderNodeTexNoise')
        noise.inputs['Scale'].default_value = 2
        noise.inputs['Detail'].default_value = 3
        links.new(mapping.outputs['Vector'], noise.inputs['Vector'])
        ramp = nodes.new('ShaderNodeValToRGB')
        ramp.color_ramp.elements[0].color = (*[c*.65 for c in color], 1)
        ramp.color_ramp.elements[1].color = (*[min(1, c*1.2) for c in color], 1)
        links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
        links.new(ramp.outputs['Color'], shader.inputs['Base Color'])
        bump = nodes.new('ShaderNodeBump')
        bump.inputs['Strength'].default_value = .18 if kind != 'stone' else .3
        bump.inputs['Distance'].default_value = .001 if kind == 'fabric' else .003
        links.new(noise.outputs['Fac'], bump.inputs['Height'])
        links.new(bump.outputs['Normal'], shader.inputs['Normal'])
        if kind == 'fabric':
            wave = nodes.new('ShaderNodeTexWave')
            wave.wave_type = 'BANDS'
            wave.bands_direction = 'DIAGONAL'
            wave.inputs['Scale'].default_value = 80
            links.new(tex.outputs['Generated'], wave.inputs['Vector'])
            links.new(wave.outputs['Color'], bump.inputs['Height'])
            shader.inputs['Sheen Weight'].default_value = .3
    return mat


def moving_part(name, objects, pivot):
    """Join a rigid group into one object, with a model-space pivot. No soft weights."""
    if name in PARTS or len(pivot) != 3 or not all(math.isfinite(v) for v in pivot):
        raise ValueError('Duplicate part or invalid pivot')
    objects = [bpy.data.objects[o] if isinstance(o, str) else o for o in objects]
    if not objects:
        raise ValueError('A moving part needs geometry')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.convert(target='MESH')
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    bpy.context.scene.cursor.location = pivot
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    PARTS[name] = {'object': obj, 'pivot': list(pivot)}
    return obj


def render_pack(pack, output, size=256, samples=16, engine='CYCLES'):
    from rendering import render_pack as render
    return render(pack, output, size, samples, engine)


def export_glb(file, objects=None):
    objects = objects if objects is not None else [o for o in bpy.context.scene.objects if o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    if not objects:
        raise ValueError('Cannot export an empty model')
    bpy.ops.export_scene.gltf(filepath=str(file), export_format='GLB', use_selection=True, export_apply=True,
                              export_animations=False, export_cameras=False, export_lights=False, export_yup=True)
