# The brass orrery for the Splat Fidelity Plan, Stage 2 (lane Fidelity): builds the model from
# scratch in Blender, then renders every moving part on its own (and the whole object) from
# cameras on a sphere, as NeRF-synthetic datasets a splat trainer (Brush, msplat) reads.
#
#   blender -b --factory-startup --python tools/fidelity/orrery.py -- --out ~/splashery-fidelity/orrery
#     [--res 1024] [--train 200] [--test 25] [--samples 256] [--device GPU|CPU]
#     [--parts all|whole|base,sun,...] [--cache ~/splashery-fidelity/cache] [--quick] [--blend]
#
# Writes, per dataset <out>/<part>/: train/r_NNN.png and test/r_NNN.png (RGBA, transparent
# background), transforms_train.json and transforms_test.json (camera_angle_x, and per frame
# file_path and Blender's camera-to-world transform_matrix), and points3d.ply (surface points
# with colors, for trainers that start from a cloud). Also <out>/parts.json: each part's name,
# pivot, axis and turning period in Splashery's coordinates (y up), which the toy reads.
#
# The model is ours (CC0): procedural geometry and procedural brass, enamel and glow. Two
# textures and the light come from Poly Haven, all CC0 (checked on the live pages on October 3,
# 2026): the HDRI "Studio Small 09" (Sergej Majboroda), "Dark Wood" (Dario Barresi, Dimitrios
# Savva, Rico Cilliers) for the plinth, and "Rock Surface" (Amal Kumar) for the stone planets.
# They are downloaded once into --cache.
#
# Light: the HDRI plus a point light inside the sun. Each part is rendered with the other parts
# hidden, so no part carries another's shadow (it would be wrong once the parts turn); the sun's
# light stays on for every part, so each planet's lit side faces the sun and stays facing it as
# its arm turns around the sun.

import argparse
import json
import math
import os
import sys
import time
import urllib.request

import bmesh
import bpy
from mathutils import Matrix, Vector

# ---- Options --------------------------------------------------------------------------------

argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
ap = argparse.ArgumentParser(description="Build and render the brass orrery.")
ap.add_argument("--out", default=os.path.expanduser("~/splashery-fidelity/orrery"))
ap.add_argument("--cache", default=os.path.expanduser("~/splashery-fidelity/cache"))
ap.add_argument("--res", type=int, default=1024)
ap.add_argument("--train", type=int, default=200)
ap.add_argument("--test", type=int, default=25)
ap.add_argument("--samples", type=int, default=256)
ap.add_argument("--device", default="GPU", choices=["GPU", "CPU"])
ap.add_argument("--parts", default="all", help="all, or a comma list of part names and 'whole'")
ap.add_argument("--points", type=int, default=200000, help="points in each points3d.ply")
ap.add_argument("--quick", action="store_true", help="tiny test run: 96 px, 8 + 2 views, 8 samples")
ap.add_argument("--blend", action="store_true", help="also save the scene as orrery.blend")
ap.add_argument("--no-render", action="store_true", help="build, write parts.json and stop")
opt = ap.parse_args(argv)
if opt.quick:
    opt.res, opt.train, opt.test, opt.samples, opt.points = 96, 8, 2, 8, 4000

# ---- The design (meters, Blender's z up) ------------------------------------------------------

SUN_Z = 0.36  # the sun's center, and the plane the planets turn in
PLINTH_R = 0.2
# name, label, orbit radius, planet radius, arm height, start angle (degrees), seconds per turn
# in the toy, finish
PLANETS = [
    ("mercury", "Mercury", 0.085, 0.011, 0.305, 20, 2.4, "stone"),
    ("venus", "Venus", 0.12, 0.016, 0.28, 135, 3.6, "venus"),
    ("earth", "Earth", 0.16, 0.017, 0.255, 250, 5.0, "earth"),
    ("mars", "Mars", 0.2, 0.013, 0.23, 320, 7.2, "mars"),
    ("jupiter", "Jupiter", 0.25, 0.032, 0.205, 75, 12.0, "jupiter"),
    ("saturn", "Saturn", 0.305, 0.026, 0.18, 190, 18.0, "saturn"),
]
MOON = {"orbit": 0.036, "r": 0.006, "period": 1.6}
GEARS = [  # name, center (x, y), pitch radius, teeth
    ("gear-a", (0.0, 0.0), 0.075, 48),
    ("gear-b", (0.075 + 0.034, 0.0), 0.034, 22),
]
COLUMN_R = 0.011

# ---- Small helpers ----------------------------------------------------------------------------

PARTS = {}  # part name -> list of objects


def tag(obj, part):
    obj["part"] = part
    PARTS.setdefault(part, []).append(obj)
    return obj


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def mesh_object(name, bm, part, mat, smooth_angle=35):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    smooth(obj, smooth_angle)
    return tag(obj, part)


def smooth(obj, angle=35):
    for p in obj.data.polygons:
        p.use_smooth = True
    # Sharp edges where faces meet at more than `angle` (Blender 4.1+ has no auto smooth flag).
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(angle):
            e.smooth = False
    bm.to_mesh(obj.data)
    bm.free()


def bevel(obj, width=0.0012, segments=3):
    m = obj.modifiers.new("bevel", "BEVEL")
    m.width = width
    m.segments = segments
    m.limit_method = "ANGLE"
    m.harden_normals = False
    return obj


def cylinder(r, h, z0=0.0, segs=64, x=0.0, y=0.0, r_top=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(
        bm, cap_ends=True, segments=segs, radius1=r, radius2=r if r_top is None else r_top, depth=h
    )
    bmesh.ops.translate(bm, verts=bm.verts, vec=(x, y, z0 + h / 2))
    return bm


def sphere(r, center, segs=64, rings=32):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    bmesh.ops.translate(bm, verts=bm.verts, vec=center)
    return bm


def box(size, center):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=center)
    return bm


def torus(R, r, center, segs=96, ring=16):
    bm = bmesh.new()
    verts = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        row = []
        for j in range(ring):
            b = 2 * math.pi * j / ring
            p = Vector(
                (
                    (R + r * math.cos(b)) * math.cos(a),
                    (R + r * math.cos(b)) * math.sin(a),
                    r * math.sin(b),
                )
            )
            row.append(bm.verts.new(p + Vector(center)))
        verts.append(row)
    for i in range(segs):
        for j in range(ring):
            a, b = verts[i][j], verts[(i + 1) % segs][j]
            c, d = verts[(i + 1) % segs][(j + 1) % ring], verts[i][(j + 1) % ring]
            bm.faces.new((a, b, c, d))
    return bm


def annulus(r0, r1, thick, segs=128):
    """A flat ring (Saturn's) in the xy plane, centered at the origin."""
    bm = bmesh.new()
    ring = []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        c, s = math.cos(a), math.sin(a)
        ring.append(
            [bm.verts.new((r * c, r * s, z)) for r, z in ((r0, -thick / 2), (r1, -thick / 2), (r1, thick / 2), (r0, thick / 2))]
        )
    for i in range(segs):
        a, b = ring[i], ring[(i + 1) % segs]
        for k in range(4):
            bm.faces.new((a[k], b[k], b[(k + 1) % 4], a[(k + 1) % 4]))
    return bm


def gear(r, teeth, thick, z0, center, hub=0.3, spokes=5):
    """A spur gear: involute-ish teeth on a rim, a hub and spokes (cut as gaps in the web)."""
    bm = bmesh.new()
    depth = 2.2 * r / teeth
    outline = []
    for t in range(teeth):
        for f, rr in ((0.0, r - depth * 0.55), (0.18, r + depth * 0.45), (0.32, r + depth * 0.45), (0.5, r - depth * 0.55)):
            a = 2 * math.pi * (t + f) / teeth
            outline.append((rr * math.cos(a), rr * math.sin(a)))
    # The web between rim and hub: spokes, drawn as the rim's inner edge with gaps.
    rim_in = r - depth * 2.2
    hub_r = r * hub

    def ring_faces(points, z_lo, z_hi):
        lo = [bm.verts.new((center[0] + x, center[1] + y, z0 + z_lo)) for x, y in points]
        hi = [bm.verts.new((center[0] + x, center[1] + y, z0 + z_hi)) for x, y in points]
        return lo, hi

    o_lo, o_hi = ring_faces(outline, 0, thick)
    n = len(outline)
    inner = [(rim_in * math.cos(2 * math.pi * i / n), rim_in * math.sin(2 * math.pi * i / n)) for i in range(n)]
    i_lo, i_hi = ring_faces(inner, 0, thick)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((o_lo[i], o_lo[j], o_hi[j], o_hi[i]))  # outer wall
        bm.faces.new((i_hi[i], i_hi[j], i_lo[j], i_lo[i]))  # inner wall
        bm.faces.new((o_hi[i], o_hi[j], i_hi[j], i_hi[i]))  # top
        bm.faces.new((i_lo[i], i_lo[j], o_lo[j], o_lo[i]))  # bottom
    # The hub and spokes as separate solids (they overlap the rim slightly).
    hub_bm = cylinder(hub_r, thick * 1.6, z0 - thick * 0.3, 48, center[0], center[1])
    me = bpy.data.meshes.new("tmp")
    hub_bm.to_mesh(me)
    hub_bm.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    for s in range(spokes):
        a = 2 * math.pi * s / spokes
        length = rim_in - hub_r + depth
        mid = (hub_r + rim_in) / 2
        sb = box((length, r * 0.12, thick * 0.7), (0, 0, 0))
        bmesh.ops.rotate(sb, verts=sb.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, "Z"))
        bmesh.ops.translate(
            sb, verts=sb.verts, vec=(center[0] + mid * math.cos(a), center[1] + mid * math.sin(a), z0 + thick / 2)
        )
        me = bpy.data.meshes.new("tmp")
        sb.to_mesh(me)
        sb.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


# ---- Assets (Poly Haven, CC0) ----------------------------------------------------------------


def fetch(url, name):
    os.makedirs(opt.cache, exist_ok=True)
    path = os.path.join(opt.cache, name)
    if not os.path.exists(path):
        print(f"Downloading {url}", flush=True)
        req = urllib.request.Request(url, headers={"User-Agent": "splashery-fidelity"})
        with urllib.request.urlopen(req) as r, open(path + ".part", "wb") as f:
            f.write(r.read())
        os.replace(path + ".part", path)
    return path


def polyhaven_texture(asset, res="2k"):
    with urllib.request.urlopen(
        urllib.request.Request(f"https://api.polyhaven.com/files/{asset}", headers={"User-Agent": "splashery-fidelity"})
    ) as r:
        files = json.load(r)
    out = {}
    for key, map_name in (("diff", "Diffuse"), ("rough", "Rough"), ("nor", "nor_gl")):
        url = files[map_name][res]["jpg"]["url"]
        out[key] = fetch(url, os.path.basename(url))
    return out


def polyhaven_hdri(asset, res="2k"):
    return fetch(f"https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/{res}/{asset}_{res}.hdr", f"{asset}_{res}.hdr")


# ---- Materials --------------------------------------------------------------------------------


def new_material(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    return m, nt, bsdf


def noise(nt, scale, detail=6.0, coords="Object"):
    tc = nt.nodes.new("ShaderNodeTexCoord")
    nz = nt.nodes.new("ShaderNodeTexNoise")
    nz.inputs["Scale"].default_value = scale
    nz.inputs["Detail"].default_value = detail
    nt.links.new(tc.outputs[coords], nz.inputs["Vector"])
    return nz


def ramp(nt, src, stops):
    cr = nt.nodes.new("ShaderNodeValToRGB")
    els = cr.color_ramp.elements
    while len(els) < len(stops):
        els.new(0.5)
    for el, (pos, col) in zip(els, stops):
        el.position = pos
        el.color = (*col, 1.0)
    nt.links.new(src, cr.inputs["Fac"])
    return cr


def brass(name="brass", color=(0.78, 0.56, 0.25), rough=(0.14, 0.3)):
    m, nt, b = new_material(name)
    b.inputs["Metallic"].default_value = 1.0
    nz = noise(nt, 90.0, 8.0)
    tint = ramp(nt, nz.outputs["Fac"], [(0.35, tuple(c * 0.9 for c in color)), (0.65, color)])
    nt.links.new(tint.outputs["Color"], b.inputs["Base Color"])
    rr = ramp(nt, nz.outputs["Fac"], [(0.3, (rough[0],) * 3), (0.7, (rough[1],) * 3)])
    nt.links.new(rr.outputs["Color"], b.inputs["Roughness"])
    m["swatch"] = color
    return m


def textured(name, tex, tint=(1, 1, 1), scale=6.0, rough_mul=1.0, coat=0.0):
    m, nt, b = new_material(name)
    tc = nt.nodes.new("ShaderNodeTexCoord")
    mp = nt.nodes.new("ShaderNodeMapping")
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    nt.links.new(tc.outputs["Object"], mp.inputs["Vector"])

    def img(path, non_color=False):
        n = nt.nodes.new("ShaderNodeTexImage")
        n.image = bpy.data.images.load(path, check_existing=True)
        if non_color:
            n.image.colorspace_settings.name = "Non-Color"
        n.projection = "BOX"
        n.projection_blend = 0.25
        nt.links.new(mp.outputs["Vector"], n.inputs["Vector"])
        return n

    diff = img(tex["diff"])
    mul = nt.nodes.new("ShaderNodeMix")
    mul.data_type = "RGBA"
    mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    nt.links.new(diff.outputs["Color"], mul.inputs[6])
    mul.inputs[7].default_value = (*tint, 1.0)
    nt.links.new(mul.outputs[2], b.inputs["Base Color"])
    rough = img(tex["rough"], True)
    if rough_mul != 1.0:
        mm = nt.nodes.new("ShaderNodeMath")
        mm.operation = "MULTIPLY"
        mm.inputs[1].default_value = rough_mul
        nt.links.new(rough.outputs["Color"], mm.inputs[0])
        nt.links.new(mm.outputs[0], b.inputs["Roughness"])
    else:
        nt.links.new(rough.outputs["Color"], b.inputs["Roughness"])
    nor = img(tex["nor"], True)
    nm = nt.nodes.new("ShaderNodeNormalMap")
    nt.links.new(nor.outputs["Color"], nm.inputs["Color"])
    nt.links.new(nm.outputs["Normal"], b.inputs["Normal"])
    b.inputs["Coat Weight"].default_value = coat
    m["swatch"] = tint
    return m


def enamel(name, stops, scale=18.0, bands=False, caps=False):
    """Glossy colored enamel under a clear coat; the colors from noise (or bands)."""
    m, nt, b = new_material(name)
    if bands:
        tc = nt.nodes.new("ShaderNodeTexCoord")
        wv = nt.nodes.new("ShaderNodeTexWave")
        wv.bands_direction = "Z"
        wv.inputs["Scale"].default_value = scale
        wv.inputs["Distortion"].default_value = 4.0
        wv.inputs["Detail"].default_value = 3.0
        nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
        src = wv.outputs["Fac"]
    else:
        src = noise(nt, scale, 6.0).outputs["Fac"]
    cr = ramp(nt, src, stops)
    color_out = cr.outputs["Color"]
    if caps:
        # White polar caps: object z beyond 0.82 of the radius.
        tc = nt.nodes.new("ShaderNodeTexCoord")
        sep = nt.nodes.new("ShaderNodeSeparateXYZ")
        nt.links.new(tc.outputs["Normal"], sep.inputs[0])
        ab = nt.nodes.new("ShaderNodeMath")
        ab.operation = "ABSOLUTE"
        nt.links.new(sep.outputs["Z"], ab.inputs[0])
        cap = ramp(nt, ab.outputs[0], [(0.8, (0, 0, 0)), (0.86, (1, 1, 1))])
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        nt.links.new(cap.outputs["Color"], mix.inputs["Factor"])
        nt.links.new(color_out, mix.inputs[6])
        mix.inputs[7].default_value = (0.92, 0.94, 0.96, 1)
        color_out = mix.outputs[2]
    nt.links.new(color_out, b.inputs["Base Color"])
    b.inputs["Roughness"].default_value = 0.28
    b.inputs["Coat Weight"].default_value = 1.0
    b.inputs["Coat Roughness"].default_value = 0.04
    m["swatch"] = stops[len(stops) // 2][1]
    return m


def glow(name="sun"):
    m, nt, b = new_material(name)
    nz = noise(nt, 40.0, 10.0)
    cr = ramp(nt, nz.outputs["Fac"], [(0.3, (0.95, 0.3, 0.04)), (0.5, (1.0, 0.5, 0.1)), (0.75, (1.0, 0.72, 0.3))])
    b.inputs["Base Color"].default_value = (1.0, 0.6, 0.15, 1)
    nt.links.new(cr.outputs["Color"], b.inputs["Emission Color"])
    b.inputs["Emission Strength"].default_value = 0.9
    b.inputs["Roughness"].default_value = 0.5
    m["swatch"] = (1.0, 0.7, 0.25)
    return m


# ---- Build ------------------------------------------------------------------------------------


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    wood = textured("wood", polyhaven_texture("dark_wood"), scale=5.0, coat=0.6)
    rock = polyhaven_texture("rock_surface")
    mats = {
        "brass": brass(),
        "bronze": brass("bronze", (0.55, 0.36, 0.17), (0.22, 0.4)),
        "steel": brass("steel", (0.62, 0.62, 0.64), (0.12, 0.22)),
        "wood": wood,
        "stone": textured("stone", rock, (0.75, 0.72, 0.68), 30.0),
        "mars": textured("mars", rock, (0.95, 0.45, 0.25), 30.0),
        "moon": textured("moon", rock, (0.8, 0.8, 0.8), 40.0),
        "venus": enamel("venus", [(0.35, (0.85, 0.7, 0.42)), (0.5, (0.93, 0.83, 0.6)), (0.7, (0.98, 0.93, 0.78))], 10.0),
        "earth": enamel(
            "earth",
            [(0.48, (0.05, 0.2, 0.55)), (0.52, (0.12, 0.42, 0.2)), (0.62, (0.35, 0.5, 0.22)), (0.7, (0.7, 0.6, 0.4))],
            14.0,
            caps=True,
        ),
        "jupiter": enamel(
            "jupiter",
            [(0.2, (0.62, 0.38, 0.22)), (0.45, (0.92, 0.82, 0.66)), (0.6, (0.78, 0.55, 0.35)), (0.85, (0.96, 0.9, 0.8))],
            30.0,
            bands=True,
        ),
        "saturn": enamel("saturn", [(0.3, (0.8, 0.68, 0.45)), (0.6, (0.93, 0.85, 0.62))], 26.0, bands=True),
        "sun": glow(),
    }

    # The base: a turned wooden plinth with a brass band and feet, a brass drum around the gear
    # train, and the column the arms turn on.
    o = mesh_object("plinth", cylinder(PLINTH_R, 0.05, 0.012, 128, r_top=PLINTH_R * 0.94), "base", mats["wood"])
    bevel(o, 0.004, 4)
    o = mesh_object("band", torus(PLINTH_R * 0.985, 0.0045, (0, 0, 0.022)), "base", mats["brass"])
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        o = mesh_object(f"foot{i}", sphere(0.016, (0.16 * math.cos(a), 0.16 * math.sin(a), 0.012), 32, 16), "base", mats["brass"])  # noqa: E501
    o = mesh_object("drum", cylinder(0.05, 0.03, 0.062, 96), "base", mats["brass"])
    bevel(o, 0.0015)
    o = mesh_object("column", cylinder(COLUMN_R, SUN_Z - 0.04 - 0.092, 0.092, 48), "base", mats["steel"])
    o = mesh_object("collar", torus(COLUMN_R + 0.002, 0.003, (0, 0, 0.096)), "base", mats["brass"])

    # The gear train on top of the plinth, beside the drum (the big gear rings the drum).
    for name, (cx, cy), r, teeth in GEARS:
        z0 = 0.062 if name == "gear-a" else 0.064
        o = mesh_object(name, gear(r, teeth, 0.006, z0, (cx, cy)), name, mats["brass" if name == "gear-a" else "bronze"], 25)  # noqa: E501
        bevel(o, 0.0006, 2)
        if name == "gear-b":
            o = mesh_object("gear-b-pin", cylinder(0.005, 0.016, 0.062, 32, cx, cy), name, mats["steel"])

    # The sun.
    o = mesh_object("sun", sphere(0.042, (0, 0, SUN_Z), 96, 48), "sun", mats["sun"])
    o.visible_shadow = False  # its light is the point light inside
    o = mesh_object("sun-cap", cylinder(0.006, 0.012, SUN_Z - 0.052, 32), "sun", mats["brass"])
    light = bpy.data.lights.new("sun-light", "POINT")
    light.energy = 18.0
    light.shadow_soft_size = 0.03
    light.color = (1.0, 0.82, 0.6)
    lo = link(bpy.data.objects.new("sun-light", light))
    lo.location = (0, 0, SUN_Z)

    # The arms: a sleeve on the column, a bar out to the orbit, a post up to the ecliptic, and
    # the planet on top. Each arm is one part and turns about the column.
    for name, _label, orbit, pr, h, start, _period, finish in PLANETS:
        part = name
        rot = Matrix.Rotation(math.radians(start), 4, "Z")
        objs = []
        objs.append(mesh_object(f"{name}-sleeve", cylinder(COLUMN_R + 0.004, 0.012, h - 0.006, 48), part, mats["brass"]))
        bar = box((orbit, 0.006, 0.004), (orbit / 2, 0, h))
        objs.append(mesh_object(f"{name}-bar", bar, part, mats["brass"]))
        post_h = SUN_Z - h - pr * 0.8
        objs.append(mesh_object(f"{name}-post", cylinder(0.0022, post_h, h, 24, orbit, 0), part, mats["steel"]))
        objs.append(mesh_object(f"{name}-cup", cylinder(0.004, 0.004, SUN_Z - pr - 0.003, 24, orbit, 0, 0.0055), part, mats["brass"]))  # noqa: E501
        objs.append(mesh_object(f"{name}", sphere(pr, (orbit, 0, SUN_Z), 96, 48), part, mats[finish]))
        if name == "saturn":
            ring = annulus(pr * 1.35, pr * 2.25, 0.0012)
            bmesh.ops.rotate(ring, verts=ring.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.radians(27), 3, "Y"))
            bmesh.ops.translate(ring, verts=ring.verts, vec=(orbit, 0, SUN_Z))
            objs.append(mesh_object("saturn-ring", ring, part, mats["brass"]))
        if name == "earth":
            # The moon's arm rides on Earth's post: its own part, turning about Earth.
            m_objs = [
                mesh_object("moon-bar", box((MOON["orbit"], 0.003, 0.002), (orbit + MOON["orbit"] / 2, 0, SUN_Z - pr - 0.006)), "moon", mats["brass"]),  # noqa: E501
                mesh_object("moon-post", cylinder(0.0014, pr + 0.006, SUN_Z - pr - 0.006, 16, orbit + MOON["orbit"], 0), "moon", mats["steel"]),  # noqa: E501
                mesh_object("moon", sphere(MOON["r"], (orbit + MOON["orbit"], 0, SUN_Z), 48, 24), "moon", mats["moon"]),
            ]
            for ob in m_objs:
                ob.matrix_world = rot @ ob.matrix_world
        for ob in objs:
            ob.matrix_world = rot @ ob.matrix_world
    return mats


# ---- Scene, cameras and rendering -------------------------------------------------------------


def setup_render(hdri):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    sc.cycles.device = opt.device
    if opt.device == "GPU":
        prefs = bpy.context.preferences.addons["cycles"].preferences
        for kind in ("METAL", "OPTIX", "CUDA", "HIP", "ONEAPI"):
            try:
                prefs.compute_device_type = kind
                prefs.get_devices()
                if any(d.type == kind for d in prefs.devices):
                    for d in prefs.devices:
                        d.use = d.type == kind
                    print(f"Rendering on {kind}", flush=True)
                    break
            except TypeError:
                continue
    sc.cycles.samples = opt.samples
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = opt.res
    sc.render.resolution_percentage = 100
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "8"
    # Display-referred sRGB, as a trainer and the browser expect (not AgX or Filmic).
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    world = bpy.data.worlds.new("studio")
    sc.world = world
    world.use_nodes = True
    nt = world.node_tree
    env = nt.nodes.new("ShaderNodeTexEnvironment")
    env.image = bpy.data.images.load(hdri)
    nt.links.new(env.outputs["Color"], nt.nodes["Background"].inputs["Color"])
    nt.nodes["Background"].inputs["Strength"].default_value = 0.9
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens_unit = "FOV"
    cam_data.angle = math.radians(40)
    cam_data.clip_start = 0.005
    cam = link(bpy.data.objects.new("cam", cam_data))
    sc.camera = cam
    return cam


def fibonacci(n, offset=0.0):
    """n directions spread evenly over the sphere (views from below too: the toy turns)."""
    out = []
    golden = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        y = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(max(0.0, 1 - y * y))
        a = golden * i + offset
        out.append(Vector((r * math.cos(a), r * math.sin(a), y)))
    return out


def look_at(cam, eye, target):
    d = (Vector(target) - Vector(eye)).normalized()
    q = d.to_track_quat("-Z", "Y")  # the camera's up as close to world z as it can be
    cam.matrix_world = Matrix.Translation(eye) @ q.to_matrix().to_4x4()


def bounds(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    lo = Vector((1e9, 1e9, 1e9))
    hi = -lo
    for ob in objs:
        ev = ob.evaluated_get(dg)
        for v in ev.to_mesh().vertices:
            w = ev.matrix_world @ v.co
            lo = Vector(map(min, lo, w))
            hi = Vector(map(max, hi, w))
        ev.to_mesh_clear()
    c = (lo + hi) / 2
    return c, (hi - lo).length / 2


def show_only(names):
    for ob in bpy.data.objects:
        if "part" in ob:
            ob.hide_render = ob["part"] not in names


def write_points(path, objs, n):
    """Surface points with their material's color, area weighted (a trainer's starting cloud)."""
    import random

    rnd = random.Random(1)
    dg = bpy.context.evaluated_depsgraph_get()
    tris = []
    for ob in objs:
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        me.calc_loop_triangles()
        col = ob.active_material.get("swatch", (0.7, 0.7, 0.7)) if ob.active_material else (0.7, 0.7, 0.7)
        col = tuple(int(255 * max(0, min(1, c)) ** (1 / 2.2)) for c in col)
        mw = ev.matrix_world
        for t in me.loop_triangles:
            a, b, c = (mw @ me.vertices[i].co for i in t.vertices)
            area = (b - a).cross(c - a).length / 2
            if area > 0:
                tris.append((area, a, b, c, col))
        ev.to_mesh_clear()
    total = sum(t[0] for t in tris)
    pts = []
    for area, a, b, c, col in tris:
        k = area / total * n
        m = int(k) + (1 if rnd.random() < k - int(k) else 0)
        for _ in range(m):
            u, v = rnd.random(), rnd.random()
            if u + v > 1:
                u, v = 1 - u, 1 - v
            p = a + (b - a) * u + (c - a) * v
            pts.append((p, col))
    with open(path, "w") as f:
        f.write("ply\nformat ascii 1.0\n")
        f.write(f"element vertex {len(pts)}\n")
        f.write("property float x\nproperty float y\nproperty float z\n")
        f.write("property uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n")
        for p, c in pts:
            f.write(f"{p.x:.6f} {p.y:.6f} {p.z:.6f} {c[0]} {c[1]} {c[2]}\n")


def render_set(cam, name, members, directory):
    objs = [ob for ob in bpy.data.objects if ob.get("part") in members]
    show_only(members)
    center, radius = bounds(objs)
    dist = radius / math.sin(cam.data.angle / 2) * 1.08
    os.makedirs(directory, exist_ok=True)
    timing = {}
    for split, n, offset in (("train", opt.train, 0.0), ("test", opt.test, 1.234)):
        os.makedirs(os.path.join(directory, split), exist_ok=True)
        frames = []
        t0 = time.time()
        for i, d in enumerate(fibonacci(n, offset)):
            look_at(cam, center + d * dist, center)
            stem = f"{split}/r_{i:03d}"
            bpy.context.scene.render.filepath = os.path.join(directory, stem + ".png")
            bpy.ops.render.render(write_still=True)
            frames.append({"file_path": "./" + stem, "transform_matrix": [list(r) for r in cam.matrix_world]})
            print(f"{name} {split} {i + 1}/{n}", flush=True)
        timing[split] = round(time.time() - t0, 1)
        with open(os.path.join(directory, f"transforms_{split}.json"), "w") as f:
            json.dump({"camera_angle_x": cam.data.angle, "frames": frames}, f, indent=1)
    write_points(os.path.join(directory, "points3d.ply"), objs, opt.points)
    return {
        "center": list(center),
        "radius": radius,
        "seconds": timing,
        "views": {"train": opt.train, "test": opt.test},
    }


def yup(v):
    """Blender (x, y, z up) to Splashery (x, y up, z toward the viewer): (x, z, -y)."""
    return [round(v[0], 6), round(v[2], 6), round(-v[1], 6)]


def manifest():
    parts = [{"name": "base", "label": "Base", "pivot": [0, 0, 0], "axis": [0, 1, 0], "period": 0}]
    for name, (cx, cy), r, teeth in GEARS:
        parts.append({"name": name, "label": "Gear", "pivot": yup((cx, cy, 0.065)), "axis": [0, 1, 0], "teeth": teeth, "radius": r})  # noqa: E501
    parts.append({"name": "sun", "label": "Sun", "pivot": yup((0, 0, SUN_Z)), "axis": [0, 1, 0], "period": 30.0})
    for name, label, orbit, pr, h, start, period, _f in PLANETS:
        a = math.radians(start)
        parts.append(
            {
                "name": name,
                "label": label,
                "pivot": [0, 0, 0],
                "axis": [0, 1, 0],
                "period": period,
                "planet": yup((orbit * math.cos(a), orbit * math.sin(a), SUN_Z)),
                "size": pr,
            }
        )
        if name == "earth":
            parts.append({"name": "moon", "label": "Moon", "pivot": yup((orbit * math.cos(a), orbit * math.sin(a), SUN_Z)), "axis": [0, 1, 0], "period": MOON["period"], "rides": "earth"})  # noqa: E501
    return parts


def main():
    t0 = time.time()
    build()
    hdri = polyhaven_hdri("studio_small_09")
    cam = setup_render(hdri)
    os.makedirs(opt.out, exist_ok=True)
    if opt.blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(opt.out, "orrery.blend"))
    names = [p["name"] for p in manifest()]
    want = names + ["whole"] if opt.parts == "all" else opt.parts.split(",")
    info = {
        "model": "Brass orrery (Splashery, CC0), built by tools/fidelity/orrery.py",
        "frame": "Splashery coordinates: y up; Blender (x, y, z) is (x, z, -y) here",
        "blender": bpy.app.version_string,
        "settings": {k: getattr(opt, k) for k in ("res", "train", "test", "samples", "device", "points")},
        "light": "Poly Haven HDRI studio_small_09 (CC0) at 0.9, and an 18 W point light in the sun",
        "parts": manifest(),
        "datasets": {},
    }
    if not opt.no_render:
        for name in want:
            members = names if name == "whole" else [name]
            info["datasets"][name] = render_set(cam, name, members, os.path.join(opt.out, name))
    info["seconds"] = round(time.time() - t0, 1)
    with open(os.path.join(opt.out, "parts.json"), "w") as f:
        json.dump(info, f, indent=1)
    print(f"Done in {info['seconds']} s: {opt.out}", flush=True)


main()
