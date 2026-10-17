
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
for index,(width,length,height) in enumerate([(8,10,3),(10,7,4),(6,12,3.2),(12,14,5),(8,8,3.5),(14,9,4.2)]):
    sceneid=f"fresh-room-{index+1:02d}"
    folder=out/sceneid; folder.mkdir(exist_ok=True)
    cam,_,_=t.build(1,'room')
    for obj in list(bpy.data.objects):
        if obj!=cam: bpy.data.objects.remove(obj,do_unlink=True)
    floor=t.material('fresh-floor',(.32,.21,.12),texture=True)
    wall=t.material('fresh-wall',(.62-.03*index,.64-.04*index,.58),texture=index%2==0)
    ceiling=t.material('fresh-ceiling',(.78,.76,.69),texture=index%3==0)
    wood=t.material('fresh-wood',(.38,.18,.07),texture=True)
    pale=t.material('fresh-pale',(.74,.69,.53))
    blue=t.material('fresh-blue',(.05,.22,.58))
    t.box((0,0,-.12),(width,length,.24),floor)
    t.box((-width/2,0,height/2),(.18,length,height),wall)
    t.box((width/2,0,height/2),(.18,length,height),wall)
    t.box((0,-length/2,height/2),(width,.18,height),wall)
    t.box((0,length/2,height/2),(width,.18,height),wall)
    t.box((0,0,height),(width,length,.18),ceiling)
    # Independent furniture layout, fixed before any candidate result on these rooms.
    t.box((-width*.24,length*.21,.42),(width*.27,1.0,.84),blue)
    tx,ty=width*.22,length*.05
    t.box((tx,ty,.79),(1.5,1.0,.14),wood)
    for dx in [-.6,.6]:
        for dy in [-.35,.35]:t.rod((tx+dx,ty+dy,0),(tx+dx,ty+dy,.72),.045,wood)
    t.box((-width*.36,-length*.19,1.1),(.8,.48,2.2),wood)
    for z in [.4,.9,1.4,1.9]:t.box((-width*.36,-length*.19-.25,z),(.82,.3,.07),pale)
    for k in range(index+1):
        t.box((-width*.3+k*.43,length*.34,.2+.11*k),(.36,.4,.4+.22*k),pale if k%2 else blue)
    t.light('AREA',(0,-length*.15,height-.35),1000+150*index,size=3)
    t.light('AREA',(width*.35,length*.25,height-.5),500,size=2)
    eye=np.array([width*.11,-length*.21,1.55+.09*index])
    cam.location=eye
    angle=[0,.4,.9,1.7,2.5,3.8][index]
    forward=Vector((math.sin(angle),math.cos(angle),-.08))
    cam.rotation_euler=forward.to_track_quat('-Z','Y').to_euler()
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
    records.append({'id':sceneid,'roomDimensions':[width,length,height],'width':w,'height':h,'eye':eye.tolist(),'rotation':rotation.tolist(),'novelOffsets':[.3,.8]})
    print('PANO TRUTH DONE '+sceneid,flush=True)
(out/'manifest.json').write_text(json.dumps({'generator':'.cache/pano3d/fresh-room-truth.mjs: six fixed independent room layouts using helpers from tools/studio-truth-generate.py','blender':bpy.app.version_string,'license':'CC0 1.0','author':'Made by Ryan with Codex (GPT-6)','scenes':records},indent=2))
