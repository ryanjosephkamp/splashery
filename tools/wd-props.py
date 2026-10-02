#!/usr/bin/env python3
# Builds hybrid mode's model props (docs/WORLDS.md, "Model props"): scanned
# rocks, stones, a shell, driftwood and a stump from Poly Haven (every asset
# there is CC0), each with three levels of detail, into one GLB per kind:
#
#   assets/worlds/props/<kind>.glb   (nodes v<variant>_lod<level>)
#   assets/worlds/props/props.json   (kinds, variants, sizes, credits)
#
# Run it with Blender as a Python module (a build tool; nothing of Blender
# ships in the page), after tools/wd-character.py's setup:
#
#   .cache/bpy/bin/python tools/wd-props.py
#
# Each model is downloaded once (its 1K glTF) into .cache/worlds/r3/polyhaven/,
# stood on its base, scaled to 1 m (its height, or its longest side for small
# things), decimated to each level's triangle count (the UVs kept, so its
# color, normal and roughness maps still fit) and its textures shrunk.

import json
import os
import ssl
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = os.path.join(ROOT, ".cache/worlds/r3/polyhaven")
OUT = os.path.join(ROOT, "assets/worlds/props")
API = "https://api.polyhaven.com"

# kind: its sources (Poly Haven id, the pieces to use or None for the whole
# model), how each is scaled ("height" or "long": the longest side to 1 m),
# the triangles of each level and the texture size.
KINDS = {
    "boulder": {
        "sources": [("rock_moss_set_02", 2), ("namaqualand_boulder_05", None)],
        "fit": "height",
        "tris": [4000, 900, 200],
        "tex": 1024,
    },
    "stone": {
        "sources": [("namaqualand_stones_01", 4), ("rock_moss_set_01", 3)],
        "fit": "long",
        "tris": [600, 160, 40],
        "tex": 256,
    },
    "shell": {"sources": [("lambis_shell", None)], "fit": "long", "tris": [900, 240, 60], "tex": 256},
    "driftwood": {"sources": [("dead_tree_trunk_02", None)], "fit": "long", "tris": [3000, 700, 160], "tex": 512},
    "stump": {"sources": [("tree_stump_01", None)], "fit": "height", "tris": [2500, 600, 150], "tex": 512},
}


def log(*a):
    print("[wd-props]", *a, flush=True)


def get(url, path=None):
    ctx = ssl.create_default_context(cafile=os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE"))
    req = urllib.request.Request(url, headers={"User-Agent": "splashery-build-tools (github.com/ryanjosephkamp/splashery)"})
    with urllib.request.urlopen(req, context=ctx) as r:
        data = r.read()
    if path:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(data)
    return data


def fetch(pid):
    """The model's 1K glTF and its files; its info (name, authors, license)."""
    folder = os.path.join(CACHE, pid)
    info_path = os.path.join(folder, "info.json")
    if not os.path.exists(info_path):
        files = json.loads(get(f"{API}/files/{pid}"))["gltf"]["1k"]["gltf"]
        get(files["url"], os.path.join(folder, os.path.basename(files["url"])))
        for rel, f in files["include"].items():
            get(f["url"], os.path.join(folder, rel))
        info = json.loads(get(f"{API}/info/{pid}"))
        info["gltf"] = os.path.basename(files["url"])
        with open(info_path, "w") as f:
            json.dump(info, f)
    with open(info_path) as f:
        return folder, json.load(f)


def build():
    import bpy
    from mathutils import Vector

    os.makedirs(OUT, exist_ok=True)
    meta = {
        "about": "Hybrid mode's model props (tools/wd-props.py): scanned models from Poly Haven (CC0), each with three levels of detail, 1 m tall (or long) with its foot at the origin.",
        "kinds": {},
        "credits": [],
    }
    for kind, spec in KINDS.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        variants = []
        for pid, pieces in spec["sources"]:
            folder, info = fetch(pid)
            before = set(bpy.data.objects)
            bpy.ops.import_scene.gltf(filepath=os.path.join(folder, info["gltf"]))
            objs = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
            for o in objs:
                o.data.transform(o.matrix_world)
                o.matrix_world.identity()
                o.parent = None
            # A set of rocks: its biggest pieces, one variant each.
            objs.sort(key=lambda o: -max(o.dimensions))
            if pieces:
                for o in objs[pieces:]:
                    bpy.data.objects.remove(o)
                objs = objs[:pieces]
                groups = [[o] for o in objs]
            else:
                groups = [objs]
            for g in groups:
                variants.append((pid, g))
            authors = info.get("authors", {})
            if not any(c["id"] == pid for c in meta["credits"]):
                meta["credits"].append({"id": pid, "name": info.get("name", pid), "authors": sorted(authors), "page": f"https://polyhaven.com/a/{pid}", "license": "CC0 1.0"})
        out_variants = []
        for i, (pid, g) in enumerate(variants):
            # One mesh per variant, stood on its base and centered.
            for s in bpy.context.selected_objects:
                s.select_set(False)
            for o in g:
                o.select_set(True)
            bpy.context.view_layer.objects.active = g[0]
            if len(g) > 1:
                bpy.ops.object.join()
            o = bpy.context.view_layer.objects.active
            pts = [v.co for v in o.data.vertices]
            lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
            hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
            size = hi - lo
            k = 1 / (size.z if spec["fit"] == "height" else max(size))
            o.data.transform(__import__("mathutils").Matrix.Translation(-Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))))
            o.data.transform(__import__("mathutils").Matrix.Scale(k, 4))
            base = o
            tris0 = sum(len(p.vertices) - 2 for p in base.data.polygons)
            lods = []
            for lv, want in enumerate(spec["tris"]):
                c = base.copy()
                c.data = base.data.copy()
                bpy.context.collection.objects.link(c)
                c.name = f"v{i}_lod{lv}"
                have = sum(len(p.vertices) - 2 for p in c.data.polygons)
                if have > want:
                    m = c.modifiers.new("dec", "DECIMATE")
                    m.ratio = want / have
                    m.use_collapse_triangulate = True
                    for s in bpy.context.selected_objects:
                        s.select_set(False)
                    bpy.context.view_layer.objects.active = c
                    c.select_set(True)
                    bpy.ops.object.modifier_apply(modifier="dec")
                lods.append(sum(len(p.vertices) - 2 for p in c.data.polygons))
            bpy.data.objects.remove(base)
            dims = [round(x * k, 3) for x in (size.x, size.z, size.y)]  # x, height, depth (y up)
            out_variants.append({"source": pid, "size": dims, "tris": lods, "scanTris": tris0})
            log(kind, f"v{i}", pid, "tris", tris0, "->", lods, "size", dims)
        # Textures shrunk on disk (a copy per size), then reloaded.
        from PIL import Image

        for img in list(bpy.data.images):
            src = bpy.path.abspath(img.filepath)
            if not img.filepath or not os.path.exists(src):
                continue
            # (RGB always: the WebP writer takes no one-channel images.)
            dst = os.path.join(CACHE, "small", str(spec["tex"]), os.path.splitext(os.path.basename(src))[0] + ".png")
            if not os.path.exists(dst):
                os.makedirs(os.path.dirname(dst), exist_ok=True)
                im = Image.open(src).convert("RGB")
                if im.size[0] > spec["tex"]:
                    im = im.resize((spec["tex"], spec["tex"]), Image.LANCZOS)
                im.save(dst)
            # (The importer packs its images: a new one takes their place.)
            new = bpy.data.images.load(dst)
            new.colorspace_settings.name = img.colorspace_settings.name
            new.name = img.name + "-" + str(spec["tex"])
            img.user_remap(new)
        path = os.path.join(OUT, f"{kind}.glb")
        bpy.ops.export_scene.gltf(
            filepath=path,
            export_format="GLB",
            export_apply=True,
            export_image_format="WEBP",
            export_image_quality=85,
            export_tangents=True,
            export_animations=False,
            export_cameras=False,
            export_lights=False,
            export_extras=False,
        )
        meta["kinds"][kind] = {"fit": spec["fit"], "variants": out_variants, "bytes": os.path.getsize(path)}
        log(kind, "wrote", path, os.path.getsize(path))
    with open(os.path.join(OUT, "props.json"), "w") as f:
        json.dump(meta, f, indent=2)
        f.write("\n")


if __name__ == "__main__":
    build()
