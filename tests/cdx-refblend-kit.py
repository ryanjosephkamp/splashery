"""Physical geometry checks inside Blender; no render mocks."""
import sys
from pathlib import Path
import bpy
import bmesh
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'tools/refblend'))
from refblend import *
bpy.ops.wm.read_factory_settings(use_empty=True)
wood=material('Wood','wood',(.3,.15,.06))
fabric=material('Fabric','fabric',(.4,.2,.1))
box('Beveled solid',(1,.6,.1),bevel=.02,material=wood)
lathe('Turned solid',[(.1,0),(.06,.3),(.08,.5)],material=wood)
lathe('Hollow ring',[(.1,0),(.15,0),(.15,.04),(.1,.04)],closed=True)
extrude('Concave solid',[(0,0),(1,0),(1,.3),(.3,.3),(.3,1),(0,1)],.1)
tube('Bent tube',[(0,0,0),(.2,0,.3),(.2,.2,.4)],.02)
slats('Back',3,(.05,.05,.5),(-.1,0,.25),(.1,0,0),wood)
legs('Feet',[(-.2,-.2,0),(.2,-.2,0)],[ (.03,0),(.02,.4)],wood)
cushion('Soft seat',(.5,.5,.12),(0,0,.6),fabric)
for kind in ['metal','plastic','glass','stone']:
    material(kind,kind,(.3,.4,.5),.4)
objects=[o for o in bpy.context.scene.objects if o.type in {'MESH','CURVE'}]
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0]
bpy.ops.object.convert(target='MESH')
for o in objects:
    assert len(o.data.polygons)>0,o.name
    mesh=bmesh.new();mesh.from_mesh(o.data)
    assert all(e.is_manifold for e in mesh.edges),f'{o.name} has an open edge'
    mesh.free()
print('All kit shapes are closed meshes with physical edges')

sample=sample_color(sys.argv[sys.argv.index('--')+1],(.5,.5),.1)
assert all(abs(c-.21586)<.001 for c in sample),sample
print('sRGB photo samples are converted to linear material colors')
