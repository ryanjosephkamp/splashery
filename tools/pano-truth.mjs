// Local task-56 Blender scenes, adapted to spherical captures; evaluation only.
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
const out = path.resolve(process.argv[2] || ".cache/pano3d/truth");
await fs.mkdir(out, { recursive: true });
const file = path.join(out, "generate.py");
await fs.writeFile(
  file,
  String.raw`
import sys, math, json, importlib.util
from pathlib import Path
import bpy, numpy as np
from mathutils import Vector
root=Path.cwd()
sys.path.insert(0, str(root/'tools'))
spec=importlib.util.spec_from_file_location('truth', str(root/'tools/studio-truth-generate.py'))
t=importlib.util.module_from_spec(spec); spec.loader.exec_module(t)
out=Path(sys.argv[sys.argv.index('--')+1])
records=[]
for index,name in enumerate(['room','desk','stairs','arches','steps','lattice']):
    folder=out/name; folder.mkdir(exist_ok=True)
    cam,eye,target=t.build([s[0] for s in t.SCENES].index(name),name)
    cam.rotation_euler=(Vector(target)-Vector(eye)).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update()
    rotation=np.array(cam.matrix_world)[:3,:3]
    tree,flags=t.geometry()
    s=bpy.context.scene
    s.render.resolution_percentage=100
    s.render.resolution_x=768; s.render.resolution_y=384
    cam.data.type='PANO'; cam.data.panorama_type='EQUIRECTANGULAR'
    s.render.filepath=str(folder/'pano.jpg')
    if not (folder/'pano.jpg').exists(): bpy.ops.render.render(write_still=True)
    w,h=384,192
    depths=np.zeros((h,w),dtype='<f4'); mask=np.zeros((h,w),dtype=np.uint8)
    for y in range(h):
        lat=(.5-(y+.5)/h)*math.pi
        for x in range(w):
            lon=((x+.5)/w-.5)*2*math.pi
            local=np.array([math.sin(lon)*math.cos(lat),math.sin(lat),-math.cos(lon)*math.cos(lat)])
            ray=rotation@local
            hit,normal,face,distance=tree.ray_cast(Vector(eye),Vector(ray),200)
            if hit is not None:
                depths[y,x]=distance; mask[y,x]=flags[face]
    depths.tofile(folder/'radial.f32'); mask.tofile(folder/'mask.u8')
    for shift in [.3,.8]:
        cam.location=eye+rotation@np.array([shift,0,0])
        cam.data.type='PERSP'; cam.data.lens=36/(2*math.tan(math.radians(72)/2))
        s.render.resolution_x=256; s.render.resolution_y=256
        s.render.filepath=str(folder/f'novel-{shift}.jpg')
        if not Path(s.render.filepath).exists(): bpy.ops.render.render(write_still=True)
    records.append({'id':name,'width':w,'height':h,'eye':eye.tolist(),'rotation':rotation.tolist(),'novelOffsets':[.3,.8]})
    print('PANO TRUTH DONE '+name,flush=True)
(out/'manifest.json').write_text(json.dumps({'generator':'tools/pano-truth.mjs importing tools/studio-truth-generate.py','blender':bpy.app.version_string,'license':'CC0 1.0','author':'Made by Ryan with Codex (GPT-6)','scenes':records},indent=2))
`,
);
const child = spawn(
  "blender",
  [
    "-b",
    "--factory-startup",
    "--threads",
    "4",
    "--python-exit-code",
    "1",
    "--python",
    file,
    "--",
    out,
  ],
  { stdio: "inherit" },
);
process.exitCode = await new Promise((r) => child.on("exit", r));
