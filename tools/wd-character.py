#!/usr/bin/env python3
# Builds hybrid mode's realistic character (docs/WORLDS.md, "The mesh
# character"): a MakeHuman adult (MPFB 2.0.17 in Blender, the base mesh and
# its bundled assets CC0), rigged with MPFB's game-engine skeleton and
# animated with motion capture from the 100STYLE dataset (CC BY 4.0):
#
#   assets/worlds/character/human-high.glb   (high and max tiers)
#   assets/worlds/character/human-low.glb    (low and mid tiers)
#   assets/worlds/character/human.json       (clips, speeds, sizes, credits)
#
# Run it with Blender as a Python module (a build tool; nothing of Blender or
# MPFB ships in the page):
#
#   python3 -m venv .cache/bpy && .cache/bpy/bin/pip install bpy==5.0.1 pillow==12.3.0
#   .cache/bpy/bin/python tools/wd-character.py
#
# The sources are downloaded once into .cache/worlds/r3/ and checked against
# their SHA-256 sums:
#   - MPFB 2.0.17, from extensions.blender.org (GPL 3; used here to build, not
#     shipped);
#   - MakeHuman's system assets (makehuman_system_assets_cc0.zip, every asset
#     in it marked CC0 on its page and in its own files);
#   - 100STYLE (Mason, Starke and Komura, 2022; CC BY 4.0 on Zenodo record
#     8127870), of which three takes are used: Neutral_FW (the walk),
#     Proud_FR (the run: upright, the arms swinging) and Neutral_ID (idle).
#
# The motion: each take is read from its BVH, turned into Blender's axes and
# retargeted bone by bone (each target bone takes its source joint's rotation
# away from the T-pose, after the target's rest pose is turned onto the
# source's rest pose). The walk and the run are one gait cycle each, from one
# left heel strike to the next, cut from a straight stretch, made seamless and
# played in place; both are resampled to one second, so they blend in step.
# The world plays them at (speed / stride) cycles a second, so the standing
# foot stays put on the ground.

import hashlib
import json
import math
import os
import ssl
import subprocess
import sys
import urllib.request
import zipfile

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache/worlds/r3")
OUT = os.path.join(ROOT, "assets/worlds/character")
SOURCES = {
    "mpfb": {
        "file": "mpfb-2.0.17.zip",
        "url": "https://extensions.blender.org/download/sha256:4f0a879d64a39bf646fbf5f53601ac678855da329d650617dca5737548239a87/add-on-mpfb-v2.0.17.zip",
        "sha256": "4f0a879d64a39bf646fbf5f53601ac678855da329d650617dca5737548239a87",
    },
    "assets": {
        "file": "makehuman_system_assets_cc0.zip",
        "url": "http://files.makehumancommunity.org/asset_packs/makehuman_system_assets/makehuman_system_assets_cc0.zip",
        "sha256": "b542127a8e25547c7c29c19f2d1d2adb9a664c80396ecd694095dbc8028a0107",
    },
    "motion": {
        "file": "100STYLE.zip",
        "url": "https://zenodo.org/api/records/8127870/files/100STYLE.zip/content",
        "sha256": "2c3b4017f8e2397ee6904c9b9f43551d8b426d39ddc3558d121fee9e55cb2d58",
    },
}

# The person: an adult of ordinary build and an invented face (MakeHuman's
# macro sliders only; no scan, no likeness).
PHENOTYPE = {
    "gender": 1.0,
    "age": 0.5,
    "muscle": 0.55,
    "weight": 0.5,
    "proportions": 0.7,
    "height": 0.5,
    "race": {"asian": 0.3, "caucasian": 0.4, "african": 0.3},
}
OUTFIT = {
    "skin": "middleage_caucasian_male/middleage_caucasian_male.mhmat",
    "eyes": "brown",
    "eyebrows": "eyebrow001/eyebrow001.mhclo",
    "eyelashes": "eyelashes01/eyelashes01.mhclo",
    "hair": "short02/short02.mhclo",
    "clothes": ["male_casualsuit06/male_casualsuit06.mhclo", "shoes06/shoes06.mhclo"],
}
# The clips: (take, first frame, last frame, how it is placed). The frames
# are 60 a second; the walk and run spans are one cycle each (left heel strike
# to left heel strike, found by tools/wd-character.py --cycles).
CLIPS = {
    "idle": ("Neutral/Neutral_ID", 800, 1100, "still"),
    "walk": ("Neutral/Neutral_FW", 585, 665, "cycle"),
    "run": ("Proud/Proud_FR", 611, 662, "cycle"),
}
# The capture looks a little down (the head's rest in the take); these lift
# the head and neck (radians, about each bone's own x axis).
LIFT = {"head": -0.35, "neck_01": -0.12}
IDLE_LIFT = {"head": -0.4, "neck_01": -0.12}
# Speeds the world moves the mesh character at (m/s). The capture's own are
# about 0.9 (walk) and 1.9 (run); the clips play faster to match (about 1.4
# times), a brisk walk and a steady run.
WALK_SPEED = 1.3
RUN_SPEED = 2.7
CYCLE_KEYS = 32

# The levels: high and max use "high", low and mid use "low".
LEVELS = {
    "high": {"tex": {"skin": 2048, "cloth": 1024, "shoes": 512, "hair": 1024, "eyes": 256, "brows": 256},
             "decimate": {"body": 0.85, "shoes": 0.6, "hair_cap": 0.35}},
    "low": {"tex": {"skin": 1024, "cloth": 512, "shoes": 256, "hair": 512, "eyes": 128, "brows": 128},
            "decimate": {"body": 0.4, "cloth": 0.55, "shoes": 0.35, "hair": 0.5, "hair_cap": 0.4}},
}


def log(*a):
    print("[wd-character]", *a, flush=True)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def fetch(key):
    s = SOURCES[key]
    path = os.path.join(CACHE, s["file"])
    if not os.path.exists(path):
        os.makedirs(CACHE, exist_ok=True)
        log("downloading", s["url"])
        ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE"))
        with urllib.request.urlopen(s["url"], context=ctx) as r, open(path + ".part", "wb") as f:
            while True:
                b = r.read(1 << 20)
                if not b:
                    break
                f.write(b)
        os.replace(path + ".part", path)
    got = sha256(path)
    if got != s["sha256"]:
        raise SystemExit(f"{s['file']}: SHA-256 {got} doesn't match {s['sha256']}")
    return path


# ---- BVH --------------------------------------------------------------------------------


def bvh_rot(axis, a):
    c, s = np.cos(a), np.sin(a)
    R = np.zeros((a.shape[0], 3, 3))
    i, j = {"X": (1, 2), "Y": (2, 0), "Z": (0, 1)}[axis]
    k = 3 - i - j
    R[:, k, k] = 1
    R[:, i, i] = c
    R[:, i, j] = -s
    R[:, j, i] = s
    R[:, j, j] = c
    return R


def bvh_load(text):
    lines = text.split("\n")
    joints, stack, cur, i = [], [], None, 0
    while not lines[i].strip().startswith("MOTION"):
        t = lines[i].split()
        if t and t[0] in ("ROOT", "JOINT"):
            joints.append({"name": t[1], "parent": stack[-1] if stack else -1, "chan": []})
            cur = len(joints) - 1
        elif t and t[0] == "End":
            joints.append({"name": joints[stack[-1]]["name"] + "_end", "parent": stack[-1], "chan": []})
            cur = len(joints) - 1
        elif t and t[0] == "{":
            stack.append(cur)
        elif t and t[0] == "}":
            stack.pop()
        elif t and t[0] == "OFFSET":
            joints[cur]["off"] = np.array([float(x) for x in t[1:4]])
        elif t and t[0] == "CHANNELS":
            joints[cur]["chan"] = t[2:]
        i += 1
    n = int(lines[i + 1].split()[1])
    dt = float(lines[i + 2].split()[2])
    data = np.array([[float(x) for x in l.split()] for l in lines[i + 3 : i + 3 + n]])
    return joints, data, dt


def bvh_fk(joints, data):
    n = data.shape[0]
    R = np.zeros((n, len(joints), 3, 3))
    P = np.zeros((n, len(joints), 3))
    col = 0
    for j, jt in enumerate(joints):
        L = np.tile(np.eye(3), (n, 1, 1))
        t = np.tile(jt["off"], (n, 1))
        for c in jt["chan"]:
            v = data[:, col]
            col += 1
            if c.endswith("position"):
                t = t.copy()
                t[:, "XYZ".index(c[0])] = v
            else:
                L = L @ bvh_rot(c[0], np.radians(v))
        if jt["parent"] < 0:
            R[:, j], P[:, j] = L, t
        else:
            p = jt["parent"]
            R[:, j] = R[:, p] @ L
            P[:, j] = P[:, p] + np.einsum("nij,nj->ni", R[:, p], t)
    return R, P


def read_take(name):
    with zipfile.ZipFile(fetch("motion")) as z:
        return bvh_load(z.read(f"100STYLE/{name}.bvh").decode())


def find_cycles(name, a, b):
    """Straight gait cycles in a take (left heel strike to left heel strike)."""
    J, D, dt = read_take(name)
    names = [j["name"] for j in J]
    R, P = bvh_fk(J, D)
    h = P[:, 0]
    lv = np.linalg.norm(np.gradient(P[:, names.index("LeftAnkle")], axis=0), axis=1) / dt
    thr = np.percentile(lv[a:b], 25) * 1.5
    st = [f for f in range(a + 1, b) if lv[f] < thr and lv[f - 1] >= thr]
    yaw = np.degrees(np.arctan2(R[:, 0, 0, 2], R[:, 0, 2, 2]))
    out = []
    for f0, f1 in zip(st, st[1:]):
        if not 20 < f1 - f0 < 120:
            continue
        d = h[f1, [0, 2]] - h[f0, [0, 2]]
        path = np.sum(np.linalg.norm(np.diff(h[f0 : f1 + 1][:, [0, 2]], axis=0), axis=1))
        turn = (yaw[f1] - yaw[f0] + 180) % 360 - 180
        out.append((f0, f1, np.linalg.norm(d) / 100 / ((f1 - f0) * dt), np.linalg.norm(d) / max(path, 1e-6), turn))
    return out


# ---- Blender ----------------------------------------------------------------------------


def blender():
    import bpy  # noqa: F401  (Blender as a Python module)

    return bpy


def setup_mpfb(bpy):
    import importlib

    bpy.ops.extensions.package_install_files(filepath=fetch("mpfb"), repo="user_default", enable_on_install=True)
    data = bpy.utils.extension_path_user("bl_ext.user_default.mpfb")
    data = os.path.join(data, "data")
    if not os.path.exists(os.path.join(data, "skins")):
        with zipfile.ZipFile(fetch("assets")) as z:
            z.extractall(data)
    return importlib.import_module("bl_ext.user_default.mpfb.services.humanservice").HumanService, data


def make_human(bpy, HS):
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o)
    info = HS._create_default_human_info_dict()
    info["phenotype"].update(PHENOTYPE)
    info["rig"] = "game_engine"
    info["eyes"] = "high-poly/high-poly.mhclo"
    info["eyebrows"] = OUTFIT["eyebrows"]
    info["eyelashes"] = OUTFIT["eyelashes"]
    info["hair"] = OUTFIT["hair"]
    info["clothes"] = OUTFIT["clothes"]
    info["skin_mhmat"] = OUTFIT["skin"]
    info["skin_material_type"] = "MAKESKIN"
    st = HS.get_default_deserialization_settings()
    st["subdiv_levels"] = 0
    HS.deserialize_from_dict(info, st)
    rig = next(o for o in bpy.data.objects if o.type == "ARMATURE")
    parts = {}
    for o in bpy.data.objects:
        if o.type != "MESH":
            continue
        n = o.name
        kind = (
            "body" if n == "Human"
            else "eyes" if "high-poly" in n
            else "brows" if "eyebrow" in n
            else "lashes" if "eyelash" in n
            else "hair" if "short" in n
            else "shoes" if "shoes" in n
            else "cloth"
        )
        parts[kind] = o
    return rig, parts


def bake_mesh(bpy, o):
    """Shape keys mixed in, and the helper and hidden-under-clothes masks applied."""
    bpy.context.view_layer.objects.active = o
    for s in bpy.context.selected_objects:
        s.select_set(False)
    o.select_set(True)
    if o.data.shape_keys:
        bpy.ops.object.shape_key_remove(all=True, apply_mix=True)
    for m in list(o.modifiers):
        if m.type == "MASK":
            bpy.ops.object.modifier_apply(modifier=m.name)
    return o


def split_by_uv(bpy, o, test, name):
    """Moves the faces whose UV center passes test() into their own object."""
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(o.data)
    uv = bm.loops.layers.uv.active
    for f in bm.faces:
        c = sum((l[uv].uv for l in f.loops), start=__import__("mathutils").Vector((0, 0))) / len(f.loops)
        f.select = test(c)
    bm.to_mesh(o.data)
    bm.free()
    for s in bpy.context.selected_objects:
        s.select_set(False)
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.separate(type="SELECTED")
    bpy.ops.object.mode_set(mode="OBJECT")
    new = next(s for s in bpy.context.selected_objects if s != o)
    new.name = name
    return new


# ---- Textures ---------------------------------------------------------------------------


def clean_shirt(src, dst):
    """The tee and jeans texture without the printed logos, the label's text
    and the site address (no brands on anything that ships)."""
    from PIL import Image, ImageFilter

    im = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    H, W, _ = im.shape
    top = int(H * 0.42)
    reg = im[:top]
    mx, mn = reg.max(2), reg.min(2)
    sat = (mx - mn) / np.maximum(mx, 1)
    lum = reg.mean(2)
    ref = np.asarray(Image.fromarray(lum.astype(np.uint8)).filter(ImageFilter.MedianFilter(31))).astype(np.float32)
    mask = (sat > 0.12) | ((ref - lum > 18) & (ref > 150))
    mask = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))) > 0
    reg = fill_masked(reg, mask)
    out = im.copy()
    out[:top] = reg
    # The jeans' back label: its text smoothed away.
    y0, y1, x0, x1 = int(H * 0.452), int(H * 0.476), int(W * 0.493), int(W * 0.547)
    lab = out[y0:y1, x0:x1]
    llum = lab.mean(2)
    lmask = llum < np.median(llum) - 12
    lmask = np.asarray(Image.fromarray((lmask * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5))) > 0
    out[y0:y1, x0:x1] = fill_masked(lab, lmask)
    out[int(H * 0.96) :, int(W * 0.82) :] = out[int(H * 0.93) : int(H * 0.94), int(W * 0.82) :].mean((0, 1))
    Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(dst)


def fill_masked(reg, mask):
    from PIL import Image, ImageFilter

    fill = reg.copy()
    w = (~mask).astype(np.float32)
    for r in (4, 8, 16, 32, 64):
        if not mask.any():
            break
        num = np.stack(
            [np.asarray(Image.fromarray(np.clip(reg[..., c] * w, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) for c in range(3)],
            2,
        )
        den = np.asarray(Image.fromarray((w * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float32) / 255
        ok = (den > 0.05) & mask
        est = num / np.maximum(den[..., None], 1e-3)
        fill[ok] = est[ok]
        mask = mask & ~ok
    return fill


def with_ao(diffuse, ao, dst, strength=0.8):
    """The cloth's ambient occlusion multiplied into its color (folds read at
    phone size without a second texture)."""
    from PIL import Image

    d = np.asarray(Image.open(diffuse).convert("RGB")).astype(np.float32)
    a = np.asarray(Image.open(ao).convert("L").resize(d.shape[1::-1])).astype(np.float32)[..., None] / 255
    Image.fromarray(np.clip(d * (1 - strength + strength * a), 0, 255).astype(np.uint8)).save(dst)


def resized(src, size, dst):
    from PIL import Image

    im = Image.open(src)
    if im.size[0] > size:
        im = im.resize((size, size), Image.LANCZOS)
    im.save(dst)
    return dst


# ---- Materials --------------------------------------------------------------------------


def material(bpy, name, color=None, normal=None, rough=0.6, alpha=False, sheen=0.0, tint=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = 0.0
    if sheen:
        bsdf.inputs["Sheen Weight"].default_value = sheen
        bsdf.inputs["Sheen Roughness"].default_value = 0.6
    if color:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(color)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        if alpha:
            nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    elif tint:
        bsdf.inputs["Base Color"].default_value = (*tint, 1)
    if normal:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(normal)
        tex.image.colorspace_settings.name = "Non-Color"
        nm = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(tex.outputs["Color"], nm.inputs["Color"])
        nt.links.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
    return m


def set_material(o, m):
    o.data.materials.clear()
    o.data.materials.append(m)


# ---- Retargeting ------------------------------------------------------------------------

# Target bone: (source joint, the joint its direction points to).
BONE_MAP = {
    "pelvis": ("Hips", "Chest"),
    "spine_01": ("Chest", "Chest2"),
    "spine_02": ("Chest2", "Chest3"),
    "spine_03": ("Chest4", "Neck"),
    "neck_01": ("Neck", "Head"),
    "head": ("Head", "Head_end"),
}
for _s, _S in (("l", "Left"), ("r", "Right")):
    BONE_MAP.update(
        {
            f"clavicle_{_s}": (f"{_S}Collar", f"{_S}Shoulder"),
            f"upperarm_{_s}": (f"{_S}Shoulder", f"{_S}Elbow"),
            f"lowerarm_{_s}": (f"{_S}Elbow", f"{_S}Wrist"),
            f"hand_{_s}": (f"{_S}Wrist", f"{_S}Wrist_end"),
            f"thigh_{_s}": (f"{_S}Hip", f"{_S}Knee"),
            f"calf_{_s}": (f"{_S}Knee", f"{_S}Ankle"),
            f"foot_{_s}": (f"{_S}Ankle", f"{_S}Toe"),
            f"ball_{_s}": (f"{_S}Toe", f"{_S}Toe_end"),
        }
    )
# BVH (y up, +z forward, cm) to Blender (z up, -y forward).
AXES = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float)


def yaw_matrix(th):
    c, s = np.cos(th), np.sin(th)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def finger_curl(name):
    from mathutils import Quaternion

    if name.startswith(("index", "middle", "ring", "pinky")):
        return Quaternion((1, 0, 0), {"01": 0.35, "02": 0.5, "03": 0.35}[name.split("_")[1]])
    if name.startswith("thumb"):
        return Quaternion((1, 0, 0), 0.15)
    return Quaternion()


def retarget(rig, take, f0, f1, mode, lift, samples, dz=0.0):
    """Returns per-sample (basis, armature-space matrices) for every bone."""
    from mathutils import Matrix, Quaternion, Vector

    J, D, dt = read_take(take)
    names = [j["name"] for j in J]
    idx = {n: i for i, n in enumerate(names)}
    R, P = bvh_fk(J, D)
    Rb = np.einsum("ij,fkjl,ml->fkim", AXES, R, AXES)
    Pb = np.einsum("ij,fkj->fki", AXES, P) / 100
    hips = Pb[:, 0]
    if mode == "cycle":
        d = hips[f1] - hips[f0]
    else:
        d = (Rb[f0:f1, 0] @ np.array([0, -1.0, 0])).mean(0)
    Y = yaw_matrix(np.arctan2(d[0], -d[1])).T  # the way it walks (or faces) turned to -y
    Rb = np.einsum("ij,fkjl->fkil", Y, Rb)
    hips = np.einsum("ij,fj->fi", Y, hips)
    offs = {n: AXES @ J[i]["off"] / 100 for i, n in enumerate(names)}
    bones = rig.data.bones
    rest = {b.name: b.matrix_local.copy() for b in bones}
    align = {}
    for tb, (sj, sc) in BONE_MAP.items():
        b = bones[tb]
        align[tb] = (b.tail_local - b.head_local).normalized().rotation_difference(Vector(offs[sc]).normalized()).to_matrix()
    leg_t = (bones["thigh_l"].head_local - bones["calf_l"].head_local).length + (bones["calf_l"].head_local - bones["foot_l"].head_local).length
    leg_s = np.linalg.norm(offs["LeftKnee"]) + np.linalg.norm(offs["LeftAnkle"])
    scale = leg_t / leg_s

    def depth(b):
        k = 0
        while b.parent:
            b, k = b.parent, k + 1
        return k

    order = sorted((b.name for b in bones), key=lambda n: depth(bones[n]))
    out = []
    for u in samples:
        f = int(round(f0 + u * (f1 - f0)))
        if mode == "cycle":
            base = (hips[f0] + (hips[f1] - hips[f0]) * u) * scale
        else:
            base = hips[f0:f1].mean(0) * scale
        hp = hips[f] * scale
        hp = Vector((hp[0] - base[0], hp[1] - base[1], hp[2] + dz))
        M, B = {}, {}
        for n in order:
            b = bones[n]
            if b.parent is None:
                M[n], B[n] = rest[n].copy(), (Vector(), Quaternion())
                continue
            base_m = M[b.parent.name] @ (rest[b.parent.name].inverted() @ rest[n])
            if n in BONE_MAP:
                Q = Matrix(Rb[f, idx[BONE_MAP[n][0]]].tolist()) @ align[n] @ rest[n].to_3x3()
                if n in lift:
                    Q = Q @ Matrix.Rotation(lift[n], 3, "X")
                if n == "pelvis":
                    Mt = Matrix.Translation(hp) @ Q.to_4x4()
                    Bm = base_m.inverted() @ Mt
                    B[n], M[n] = (Bm.to_translation(), Bm.to_quaternion()), Mt
                    continue
                q = (base_m.to_3x3().inverted() @ Q).to_quaternion()
            else:
                q = finger_curl(n)
            B[n], M[n] = (Vector(), q), base_m @ q.to_matrix().to_4x4()
        out.append((B, M))
    return out, scale


def build_clip(bpy, rig, name, take, f0, f1, mode):
    from mathutils import Quaternion

    lift = IDLE_LIFT if name == "idle" else LIFT
    if mode == "cycle":
        n = CYCLE_KEYS
        samples = [k / n for k in range(n + 1)]
        duration = 1.0
    else:
        n = (f1 - f0) // 2
        samples = [k / n for k in range(n + 1)]
        duration = (f1 - f0) / 60
    out, scale = retarget(rig, take, f0, f1, mode, lift, samples)
    # The feet onto the ground: the balls of the feet at their rest height
    # when they stand.
    zz = np.array([[M["ball_l"].to_translation().z, M["ball_r"].to_translation().z] for B, M in out]).min(1)
    dz = rig.data.bones["ball_l"].head_local.z - np.percentile(zz, 10)
    out, scale = retarget(rig, take, f0, f1, mode, lift, samples, dz)
    # The stride: how far the standing foot travels (backward) in one cycle.
    fl = np.array([list(M["ball_l"].to_translation()) for B, M in out])
    fr = np.array([list(M["ball_r"].to_translation()) for B, M in out])
    step = duration / (len(out) - 1)
    stride = 0.0
    if mode == "cycle":
        v = []
        for fx in (fl, fr):
            vel = np.gradient(fx, axis=0) / step
            stand = fx[:, 2] < np.percentile(fx[:, 2], 30)
            v.append(np.median(vel[stand, 1]))
        stride = float(np.mean(v)) * duration
    rig.animation_data_create()
    act = bpy.data.actions.new(name)
    rig.animation_data.action = act
    first, last = out[0][0], out[-1][0]
    fps = bpy.context.scene.render.fps
    for i, (B, M) in enumerate(out):
        u = i / (len(out) - 1)
        for bn, (loc, q) in B.items():
            # Seamless: the last frame's small mismatch spread over the clip.
            q = Quaternion().slerp(first[bn][1] @ last[bn][1].inverted(), u) @ q
            if bn == "pelvis":
                loc = loc + (first[bn][0] - last[bn][0]) * u
            pb = rig.pose.bones[bn]
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = q
            pb.location = loc
            frame = 1 + u * duration * fps
            pb.keyframe_insert("rotation_quaternion", frame=frame)
            if bn == "pelvis":
                pb.keyframe_insert("location", frame=frame)
    act.use_fake_user = True
    # Feet: their slide while standing, relative to the stride (for the log).
    log(f"clip {name}: {take} {f0}-{f1}, {duration:.2f} s, stride {stride:.3f} m, scale {scale:.3f}, lift {dz:+.3f} m")
    return {"name": name, "duration": duration, "stride": round(stride, 4), "take": take, "frames": [f0, f1]}


# ---- Building -----------------------------------------------------------------------------


def tri_count(o):
    return sum(len(p.vertices) - 2 for p in o.data.polygons)


def decimate(bpy, o, ratio):
    for s in bpy.context.selected_objects:
        s.select_set(False)
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    m = o.modifiers.new("dec", "DECIMATE")
    m.ratio = ratio
    m.use_collapse_triangulate = True
    # Before the armature, so the weights are kept.
    bpy.ops.object.modifier_move_to_index(modifier="dec", index=0)
    bpy.ops.object.modifier_apply(modifier="dec")


def hair_cap(bpy, hair, color):
    """An opaque copy of the hair, pulled in a few millimeters: the scalp
    under the strands reads as hair, not skin, and nothing is see-through."""
    import bmesh

    cap = hair.copy()
    cap.data = hair.data.copy()
    cap.name = "hair_cap"
    bpy.context.collection.objects.link(cap)
    bm = bmesh.new()
    bm.from_mesh(cap.data)
    bm.normal_update()
    for v in bm.verts:
        v.co -= v.normal * 0.004
    bm.to_mesh(cap.data)
    bm.free()
    return cap


def mean_color(path, alpha_min=0.5):
    from PIL import Image

    im = np.asarray(Image.open(path).convert("RGBA")).astype(np.float32) / 255
    m = im[..., 3] > alpha_min
    c = im[..., :3][m].mean(0)
    return tuple(float(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92) for x in c)


def build(level):
    bpy = blender()
    HS, data = setup_mpfb(bpy)
    bpy.context.scene.render.fps = 30
    rig, parts = make_human(bpy, HS)
    tex_dir = os.path.join(CACHE, "tex")
    os.makedirs(tex_dir, exist_ok=True)
    sizes = LEVELS[level]["tex"]

    def t(src, key, name):
        return resized(src, sizes[key], os.path.join(tex_dir, f"{level}-{name}"))

    for o in parts.values():
        bake_mesh(bpy, o)
    # Skin.
    skin_dir = os.path.join(data, "skins", os.path.dirname(OUTFIT["skin"]))
    skin_png = next(f for f in os.listdir(skin_dir) if f.endswith("_diffuse.png"))
    set_material(parts["body"], material(bpy, "skin", color=t(os.path.join(skin_dir, skin_png), "skin", "skin.png"), rough=0.55))
    # Eyes.
    eye = os.path.join(data, "eyes/materials", f"{OUTFIT['eyes']}_eye.png")
    set_material(parts["eyes"], material(bpy, "eyes", color=t(eye, "eyes", "eyes.png"), rough=0.12))
    # Eyebrows and eyelashes (alpha-blended cards, small).
    for key in ("brows", "lashes"):
        o = parts[key]
        folder = os.path.join(data, "eyebrows" if key == "brows" else "eyelashes", o.name.split(".")[-1])
        png = next(f for f in os.listdir(folder) if f.endswith(".png") and "normal" not in f)
        set_material(o, material(bpy, key, color=t(os.path.join(folder, png), "brows", f"{key}.png"), rough=0.8, alpha=True))
    # Hair: the strands (alpha-tested) over an opaque cap.
    hdir = os.path.join(data, "hair", "short02")
    hcol = mean_color(os.path.join(hdir, "short02_diffuse.png"))
    cap = hair_cap(bpy, parts["hair"], hcol)
    set_material(cap, material(bpy, "hair_cap", tint=tuple(c * 0.8 for c in hcol), rough=0.7))
    parts["hair_cap"] = cap
    set_material(parts["hair"], material(bpy, "hair", color=t(os.path.join(hdir, "short02_diffuse.png"), "hair", "hair.png"),
                                         normal=t(os.path.join(hdir, "short02_normal.png"), "hair", "hair_n.png"), rough=0.55, alpha=True))
    # Clothes: the tee (tinted by the world's shirt color at run time) and
    # the jeans share one texture; they are split so each has its own
    # material.
    cdir = os.path.join(data, "clothes", "male_casualsuit06")
    clean = os.path.join(tex_dir, "shirt-clean.png")
    clean_shirt(os.path.join(cdir, "male_casualsuit06_diffuse.png"), clean)
    with_ao(clean, os.path.join(cdir, "male_casualsuit06_ao.png"), clean, 0.7)
    cloth_c = t(clean, "cloth", "cloth.png")
    cloth_n = t(os.path.join(cdir, "male_casualsuit06_normal.png"), "cloth", "cloth_n.png")
    from PIL import Image

    tex = np.asarray(Image.open(clean).convert("RGB")).astype(np.float32)

    def is_tee(uv):
        # The tee is the top of the texture and near white; denim is blue.
        x = min(tex.shape[1] - 1, max(0, int(uv.x * tex.shape[1])))
        y = min(tex.shape[0] - 1, max(0, int((1 - uv.y) * tex.shape[0])))
        c = tex[max(0, y - 3) : y + 4, max(0, x - 3) : x + 4].reshape(-1, 3).mean(0)
        sat = (c.max() - c.min()) / max(c.max(), 1)
        return uv.y > 0.62 or (uv.y > 0.5 and sat < 0.15)

    shirt = split_by_uv(bpy, parts["cloth"], is_tee, "shirt")
    parts["shirt"] = shirt
    set_material(shirt, material(bpy, "shirt", color=cloth_c, normal=cloth_n, rough=0.85, sheen=0.5))
    set_material(parts["cloth"], material(bpy, "trousers", color=cloth_c, normal=cloth_n, rough=0.8, sheen=0.3))
    sdir = os.path.join(data, "clothes", "shoes06")
    sd = next(f for f in os.listdir(sdir) if f.endswith("_diffuse.png"))
    sn = [f for f in os.listdir(sdir) if f.endswith("_normal.png")]
    set_material(parts["shoes"], material(bpy, "shoes", color=t(os.path.join(sdir, sd), "shoes", "shoes.png"),
                                          normal=t(os.path.join(sdir, sn[0]), "shoes", "shoes_n.png") if sn else None, rough=0.6))
    dec = LEVELS[level]["decimate"]
    if dec and level != "high":
        bpy.data.objects.remove(parts.pop("lashes"))
    if dec:
        for key, r in dec.items():
            keys = [key] if key != "cloth" else ["cloth", "shirt"]
            for k in keys:
                decimate(bpy, parts[k], r)
    tris = {k: tri_count(o) for k, o in parts.items()}
    log(level, "triangles", sum(tris.values()), tris)
    # Clips.
    clips = [build_clip(bpy, rig, name, *spec) for name, spec in CLIPS.items()]
    rig.animation_data.action = None
    for pb in rig.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.location = (0, 0, 0)
    # Height (the body's top of head above the soles).
    dg = bpy.context.evaluated_depsgraph_get()
    ev = parts["body"].evaluated_get(dg)
    zs = [(ev.matrix_world @ v.co).z for v in ev.data.vertices]
    height = max(zs) - min(zs)
    # One mesh, several materials; the rig as its parent.
    for s in bpy.context.selected_objects:
        s.select_set(False)
    for o in parts.values():
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts["body"]
    bpy.ops.object.join()
    body = bpy.context.view_layer.objects.active
    body.name = "human"
    rig.name = "rig"
    if level == "high":
        bake_splats(bpy, body, rig)
    os.makedirs(OUT, exist_ok=True)
    path = os.path.join(OUT, f"human-{level}.glb")
    for s in bpy.context.selected_objects:
        s.select_set(False)
    body.select_set(True)
    rig.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        use_selection=True,
        export_apply=False,
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_optimize_animation_size=True,
        export_skins=True,
        export_morph=False,
        export_tangents=True,
        export_image_format="WEBP",
        export_image_quality=88,
        export_def_bones=True,
        export_extras=False,
        export_cameras=False,
        export_lights=False,
    )
    patch_glb(path)
    log(level, "wrote", path, os.path.getsize(path), "bytes")
    return {"triangles": sum(tris.values()), "parts": tris, "bytes": os.path.getsize(path), "textures": sizes}, clips, height


# ---- The person as splats (splats mode) --------------------------------------------------

SPLATS = 90000


def bake_splats(bpy, body, rig):
    """Samples the person's textured surface at rest into splats, each given
    to the bone that moves it most (docs/WORLDS.md, "The person as splats"):

      assets/worlds/person-splats/human-splats.bin   (15 bytes a splat)
      assets/worlds/person-splats/human-splats.json  (bones, counts, layout)

    Each splat: its position at rest (float16 x3, the model's own axes, y up),
    its surface normal (int8 x3), its color (uint8 x3, sRGB, a little light
    baked in), a flag (1: the T-shirt, dyed by the world's shirt color) and
    its radius (uint16, tenths of a millimeter). Grouped by bone, in random
    order within a bone, so a tier can take the first part of each group."""
    rng = np.random.default_rng(7)
    me = body.data
    me.calc_loop_triangles()
    uv = me.uv_layers.active.data
    # Each material's color texture, as an array.
    images = []
    for slot in body.material_slots:
        m = slot.material
        img = None
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image and n.image.colorspace_settings.name != "Non-Color":
                img = n.image
                break
        if img is None:
            bsdf = m.node_tree.nodes["Principled BSDF"]
            c = bsdf.inputs["Base Color"].default_value
            # Linear to sRGB.
            images.append(("flat", [x ** (1 / 2.2) for x in c[:3]]))
        else:
            w, h = img.size
            px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
            images.append(("tex", px))
    names = [m.name for m in (s.material for s in body.material_slots)]
    tris = me.loop_triangles
    co = np.array([v.co[:] for v in me.vertices])
    idx = np.array([t.vertices[:] for t in tris])
    loops = np.array([t.loops[:] for t in tris])
    mats = np.array([t.material_index for t in tris])
    uvs = np.array([d.uv[:] for d in uv])
    a, b, c = co[idx[:, 0]], co[idx[:, 1]], co[idx[:, 2]]
    cross = np.cross(b - a, c - a)
    area = np.linalg.norm(cross, axis=1) / 2
    # Hidden parts (the lashes) and the strands of hair (the cap stands in).
    skip = np.isin(mats, [i for i, n in enumerate(names) if n in ("lashes", "hair")])
    area = np.where(skip, 0, area)
    n = SPLATS
    pick = rng.choice(len(tris), size=n * 3, p=area / area.sum())
    r1 = np.sqrt(rng.random(n * 3))
    r2 = rng.random(n * 3)
    wa, wb, wc = 1 - r1, r1 * (1 - r2), r1 * r2
    # (Sampled twice over: hidden and see-through samples are dropped below.)
    pos = wa[:, None] * a[pick] + wb[:, None] * b[pick] + wc[:, None] * c[pick]
    nrm = cross[pick] / np.maximum(np.linalg.norm(cross[pick], axis=1)[:, None], 1e-9)
    tuv = wa[:, None] * uvs[loops[pick, 0]] + wb[:, None] * uvs[loops[pick, 1]] + wc[:, None] * uvs[loops[pick, 2]]
    col = np.zeros((n * 3, 3), np.float32)
    alpha = np.ones(n * 3, np.float32)
    for mi, (kind, data) in enumerate(images):
        sel = mats[pick] == mi
        if not sel.any():
            continue
        if kind == "flat":
            col[sel] = data
            continue
        h, w = data.shape[:2]
        x = np.clip((tuv[sel, 0] % 1) * w, 0, w - 1).astype(int)
        y = np.clip((tuv[sel, 1] % 1) * h, 0, h - 1).astype(int)
        col[sel] = data[y, x, :3]
        alpha[sel] = data[y, x, 3]
    # Only what can be seen: a sample with another surface just above it
    # (skin under the T-shirt, the tee under the hair) is dropped, since
    # splats don't hide each other the way a model's depth test does.
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree

    # (Hair strands and lashes don't hide what is under them: the hair cap
    # stands in for the strands.)
    solid = [t.vertices[:] for t, sk in zip(tris, skip) if not sk]
    tree = BVHTree.FromPolygons([v.co[:] for v in me.vertices], solid, all_triangles=True)
    seen = np.ones(len(pos), bool)
    for i in range(len(pos)):
        if alpha[i] <= 0.5:
            continue
        o = Vector(pos[i]) + Vector(nrm[i]) * 0.0015
        seen[i] = tree.ray_cast(o, Vector(nrm[i]), 0.03)[0] is None
    keep = (alpha > 0.5) & seen
    for mi, nm in enumerate(names):
        sel = keep & (mats[pick] == mi)
        if sel.any():
            log(f"  {nm}: {int(sel.sum())} samples, mean color {np.round(col[sel].mean(0), 2)}")
    low = keep & (pos[:, 2] > 0.93) & (pos[:, 2] < 1.03) & (col[:, 1] > col[:, 0] + 0.08)
    log("  greenish at the waist, by material:", np.bincount(mats[pick][low], minlength=len(names)).tolist(), names)
    log("splats: hidden samples dropped", int((~seen).sum()), "of", len(pos))
    pos, nrm, col, pick = pos[keep][:n], nrm[keep][:n], col[keep][:n], pick[keep][:n]
    # A little light baked in (splats aren't lit): the tops lighter.
    col = np.clip(col * (0.8 + 0.2 * nrm[:, 2:3]), 0, 1)
    # The bone that moves each splat most (its triangle's weights, blended).
    groups = {g.index: g.name for g in body.vertex_groups}
    bones = [bn.name for bn in rig.data.bones if bn.use_deform]
    bone_ix = {nm: i for i, nm in enumerate(bones)}
    W = np.zeros((len(me.vertices), len(bones)), np.float32)
    for v in me.vertices:
        for g in v.groups:
            nm = groups.get(g.group)
            if nm in bone_ix:
                W[v.index, bone_ix[nm]] = g.weight
    tw = W[idx[pick, 0]] * wa[keep][:n, None] + W[idx[pick, 1]] * wb[keep][:n, None] + W[idx[pick, 2]] * wc[keep][:n, None]
    owner = tw.argmax(1)
    radius = np.sqrt(area.sum() / n / math.pi) * 1.35
    shirt = np.isin(mats[pick], [i for i, nm in enumerate(names) if nm == "shirt"]).astype(np.uint8)
    # Blender (z up, -y forward) to the model's axes (y up, +z forward).
    P = np.stack([pos[:, 0], pos[:, 2], -pos[:, 1]], 1)
    N = np.stack([nrm[:, 0], nrm[:, 2], -nrm[:, 1]], 1)
    order = np.lexsort((rng.random(len(owner)), owner))
    rec = np.zeros(len(order), dtype=[("p", "<f2", 3), ("n", "i1", 3), ("c", "u1", 3), ("f", "u1"), ("r", "<u2")])
    rec["p"] = P[order]
    rec["n"] = np.clip(np.round(N[order] * 127), -127, 127)
    rec["c"] = np.clip(np.round(col[order] * 255), 0, 255)
    rec["f"] = shirt[order]
    rec["r"] = np.round(np.full(len(order), radius) * 10000)
    counts = np.bincount(owner, minlength=len(bones))
    splat_dir = os.path.join(ROOT, "assets/worlds/person-splats")
    os.makedirs(splat_dir, exist_ok=True)
    with open(os.path.join(splat_dir, "human-splats.bin"), "wb") as f:
        f.write(rec.tobytes())
    meta = {
        "about": "The realistic person as splats (tools/wd-character.py): its textured surface sampled at rest, each splat given to the bone that moves it most. 15 bytes a splat: position (float16 x3, y up), normal (int8 x3), color (uint8 x3, sRGB), flag (uint8, 1: T-shirt), radius (uint16, 0.1 mm).",
        "stride": 15,
        "count": int(len(order)),
        "bones": [{"name": bones[i], "count": int(counts[i])} for i in range(len(bones)) if counts[i]],
    }
    with open(os.path.join(splat_dir, "human-splats.json"), "w") as f:
        json.dump(meta, f, indent=1)
        f.write("\n")
    log("splats", len(order), "on", len(meta["bones"]), "bones, radius", round(radius * 1000, 2), "mm")


def patch_glb(path):
    """Alpha modes the exporter doesn't infer: the hair strands are tested
    (no sorting, no see-through), the brows and lashes blended; thin cards
    two-sided."""
    import struct

    with open(path, "rb") as f:
        buf = f.read()
    n = struct.unpack_from("<I", buf, 12)[0]
    doc = json.loads(buf[20 : 20 + n])
    for m in doc.get("materials", []):
        name = m.get("name")
        if name == "hair":
            m["alphaMode"] = "MASK"
            m["alphaCutoff"] = 0.45
            m["doubleSided"] = True
        elif name in ("brows", "lashes"):
            m["alphaMode"] = "BLEND"
            m["doubleSided"] = True
        else:
            m.pop("alphaMode", None)
    js = json.dumps(doc, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    rest = buf[20 + n :]
    out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + len(rest)) + struct.pack("<II", len(js), 0x4E4F534A) + js + rest
    with open(path, "wb") as f:
        f.write(out)


def main():
    args = sys.argv[1:]
    if "--cycles" in args:
        for take, a, b in (("Neutral/Neutral_FW", 327, 7445), ("Proud/Proud_FR", 485, 4427)):
            print(take)
            for c in find_cycles(take, a, b):
                if abs(c[4]) < 6 and c[3] > 0.97:
                    print("  frames %d-%d  %.2f m/s  straight %.3f  turn %.1f" % c)
        return
    level = next((a.split("=")[1] for a in args if a.startswith("--level=")), None)
    if level is None:
        # Each level in its own Blender process (a fresh scene each time).
        meta = None
        for lv in LEVELS:
            subprocess.run([sys.executable, __file__, f"--level={lv}"], check=True)
        levels = {lv: json.load(open(os.path.join(CACHE, f"level-{lv}.json"))) for lv in LEVELS}
        meta = {
            "about": "Hybrid mode's realistic character (tools/wd-character.py): a MakeHuman adult (CC0) rigged with MPFB's game-engine skeleton, with idle, walk and run from the 100STYLE motion capture (CC BY 4.0).",
            "height": levels["high"]["height"],
            "walkSpeed": WALK_SPEED,
            "runSpeed": RUN_SPEED,
            "clips": {c["name"]: {"duration": c["duration"], "stride": c["stride"]} for c in levels["high"]["clips"]},
            "levels": {lv: levels[lv]["level"] for lv in LEVELS},
            "credits": [
                {"what": "Body, face, skin, eyes, eyebrows, eyelashes, hair, T-shirt, jeans and shoes", "name": "MakeHuman system assets", "authors": ["The MakeHuman team"], "page": "http://files.makehumancommunity.org/asset_packs/makehuman_system_assets/", "license": "CC0 1.0"},
                {"what": "Idle, walk and run (motion capture)", "name": "100STYLE", "authors": ["Ian Mason", "Sebastian Starke", "Taku Komura"], "page": "https://zenodo.org/records/8127870", "license": "CC BY 4.0"},
            ],
        }
        with open(os.path.join(OUT, "human.json"), "w") as f:
            json.dump(meta, f, indent=2)
            f.write("\n")
        log("wrote", os.path.join(OUT, "human.json"))
        return
    info, clips, height = build(level)
    with open(os.path.join(CACHE, f"level-{level}.json"), "w") as f:
        json.dump({"level": info, "clips": clips, "height": round(height, 4)}, f)


if __name__ == "__main__":
    main()
