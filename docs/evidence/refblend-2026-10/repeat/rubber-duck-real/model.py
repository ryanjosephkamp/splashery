"""Fourth, blind picture-led build. No truth mesh, source dimensions, or source object list read.
Codex (GPT-6). Original generated geometry CC0. Pictures: Plat251, CC0.
"""
import math
from pathlib import Path
import bpy
from refblend import *
segments=24 if QUALITY=='draft' else 48 if QUALITY=='good' else 72
yellow=material('Yellow rubber','plastic',sample_color(Path(PACK_DIR)/PACK['images'][0]['file'],(.5,.25),.015),.48)
orange=material('Orange bill','plastic',sample_color(Path(PACK_DIR)/PACK['images'][0]['file'],(.5,.62),.01),.4)
black=material('Eyes','plastic',(.004,.004,.004),.25)


def ellipsoid(name,size,at,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=segments//2,location=at)
    obj=bpy.context.object;obj.name=name
    obj.scale=tuple(v/2 for v in size)
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    obj.data.materials.append(mat)
    for p in obj.data.polygons:p.use_smooth=True
    return obj

body=ellipsoid('Body',(.712,1.0,.49),(0,0,.235),yellow)
# Product photos show a flat base, rather than a sphere balanced on a point.
for v in body.data.vertices:
    if v.co.z < 0:
        v.co.z = -(.245*(abs(v.co.z)/.245)**.45)
    else:
        v.co.x *= 1-.15*v.co.z/.245
    v.co.z=max(v.co.z,-.225)
neck=ellipsoid('Neck',(.29,.30,.25),(0,-.07,.47),yellow)
head=ellipsoid('Head',(.48,.51,.48),(0,-.07,.71),yellow)
upper=ellipsoid('Upper bill',(.23,.30,.12),(0,-.32,.675),orange)
lower=ellipsoid('Lower bill',(.24,.28,.048),(0,-.34,.59),orange)
eyes=[]
for side in [-1,1]:
    eyes.append(ellipsoid('Eye '+str(side),(.034,.022,.05),(side*.125,-.269,.80),black))
moving_part('head',[head,upper,lower,*eyes],(0,-.07,.50))
tail=lathe('Tail',[(.09,.23),(.10,.31),(.08,.40),(.05,.50),(.015,.57),(.003,.59)],(0,.31,0),segments,yellow)
for v in tail.data.vertices:
    v.co.y += .10*(v.co.z-.23)/.36
if QUALITY=='best':
    for side in [-1,1]:
        ellipsoid('Wing '+str(side),(.03,.39,.25),(side*.345,.08,.25),yellow)
