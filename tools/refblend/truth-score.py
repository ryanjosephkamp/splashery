"""Scorer-only world-space voxel volume IoU. No truth input goes to the builder.
Blender --python truth-score.py -- result.glb truth.glb output.json [resolution=48]
Overlapping oriented solids use nonzero ray winding; reverse-oriented cavities remain empty.
"""
import json
import sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree


def load(file):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(file))
    trees = []
    all_lo, all_hi = np.full(3,np.inf), np.full(3,-np.inf)
    for obj in bpy.context.scene.objects:
        if obj.type != 'MESH':
            continue
        mesh = obj.to_mesh()
        mesh.calc_loop_triangles()
        verts = [obj.matrix_world @ v.co for v in mesh.vertices]
        triangles = [tuple(t.vertices) for t in mesh.loop_triangles]
        if not triangles:
            continue
        points = np.array(verts)
        lo,hi = points.min(axis=0),points.max(axis=0)
        trees.append((BVHTree.FromPolygons(verts,triangles,all_triangles=True),lo,hi))
        all_lo,all_hi = np.minimum(all_lo,lo),np.maximum(all_hi,hi)
        obj.to_mesh_clear()
    return trees,all_lo,all_hi


def occupancy(trees, points):
    occupied = np.zeros(len(points),dtype=bool)
    # Three oriented winding tests reduce tangency artifacts. Majority voting is explicit.
    directions = [Vector((1,.000013,.000027)).normalized(),Vector((.000017,1,.000031)).normalized(),Vector((.000019,.000023,1)).normalized()]
    for tree,lo,hi in trees:
        indices = np.flatnonzero(np.all(points>=lo,axis=1)&np.all(points<=hi,axis=1)&~occupied)
        for i in indices:
            votes = 0
            for direction in directions:
                origin = Vector(points[i])
                winding = 0
                for _ in range(128):
                    hit,normal,face,distance = tree.ray_cast(origin,direction)
                    if hit is None:
                        break
                    winding += 1 if normal.dot(direction) > 0 else -1
                    origin = hit+direction*1e-6
                votes += winding != 0
            occupied[i] = votes>=2
    return occupied


def compare(a,b,resolution=48):
    trees_a,lo_a,hi_a = a
    trees_b,lo_b,hi_b = b
    lo,hi = np.minimum(lo_a,lo_b),np.maximum(hi_a,hi_b)
    step = max(hi-lo)/resolution
    axes = [np.arange(lo[k]+step/2,hi[k],step) for k in range(3)]
    points = np.stack(np.meshgrid(*axes,indexing='ij'),axis=-1).reshape(-1,3)
    x,y = occupancy(trees_a,points),occupancy(trees_b,points)
    union = int(np.count_nonzero(x|y))
    return {'schema':1,'volumeIoU':int(np.count_nonzero(x&y))/union if union else 0,'resolution':resolution,'voxelMeters':step,'sampledVoxels':len(points),'occupiedResult':int(x.sum()),'occupiedTruth':int(y.sum()),'method':'Union per mesh; majority of three nonzero oriented BVH ray winding tests; fixed world-space grid; no alignment fitting','limitations':['Source open surfaces can make inside/outside ambiguous','Finite voxel resolution; not an exact Boolean volume']}


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--')+1:]
    if args == ['--self-test']:
        verts=[Vector((x,y,z)) for z in (0,1) for y in (0,1) for x in (0,1)]
        faces=[(0,1,3,2),(4,6,7,5),(0,4,5,1),(2,3,7,6),(0,2,6,4),(1,5,7,3)]
        a=([(BVHTree.FromPolygons(verts,faces),np.zeros(3),np.ones(3))],np.zeros(3),np.ones(3))
        shifted=[v+Vector((.5,0,0)) for v in verts]
        lo,hi=np.array([.5,0,0]),np.array([1.5,1,1])
        b=([(BVHTree.FromPolygons(shifted,faces),lo,hi)],lo,hi)
        assert compare(a,a,24)['volumeIoU']==1
        assert abs(compare(a,b,24)['volumeIoU']-1/3)<.04
        overlap=[v+Vector((.5,.5,.5)) for v in verts]
        combined = (BVHTree.FromPolygons(verts+overlap,faces+[tuple(i+8 for i in face) for face in faces]),np.zeros(3),np.full(3,1.5))
        assert occupancy([combined],np.array([[.75,.75,.75]]))[0], 'Overlapping solids in one rigid mesh must form a union'
        inner=[Vector((.25+.5*v.x,.25+.5*v.y,.25+.5*v.z)) for v in verts]
        hollow=(BVHTree.FromPolygons(verts+inner,faces+[tuple(i+8 for i in reversed(face)) for face in faces]),np.zeros(3),np.ones(3))
        assert not occupancy([hollow],np.array([[.5,.5,.5]]))[0], 'An oriented cavity must stay empty'
        assert occupancy([hollow],np.array([[.1,.5,.5]]))[0]
        print('Volume self-test passed')
    else:
        result = compare(load(args[0]),load(args[1]),int(args[3]) if len(args)>3 else 48)
        Path(args[2]).write_text(json.dumps(result,indent=2)+'\n')
        print(json.dumps(result))
