"""MIT. Independent Blender projection checks for the true-target adapter.

Run with: blender -b --factory-startup --python-exit-code 1 --python tests/p3d-next-camera.py
No fixture, model, RGB fitting, or rendered target is needed.
"""
import importlib.util
import json
import math
import subprocess
from pathlib import Path
import sys

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Matrix, Vector
import numpy as np

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('target_adapter',ROOT/'tools/p3d-next-truth.py')
adapter=importlib.util.module_from_spec(spec);spec.loader.exec_module(adapter)

angle=.37
source=np.array([[math.cos(angle),-math.sin(angle),0,2],
                 [math.sin(angle),math.cos(angle),0,-3],[0,0,1,4],[0,0,0,1.]])
base={'width':1280,'height':720,'K':[[1000,0,640],[0,1000,360],[0,0,1]],'camera_to_world':source.tolist()}
median=10.;distance=1000/720
canonical={'eye':[0,0,distance],'right':[1,0,0],'up':[0,1,0],'forward':[0,0,-1]}
np.testing.assert_allclose(adapter.world_camera(base,canonical,median),source,atol=1e-12)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
data=bpy.data.cameras.new('projection-check')
camera=bpy.data.objects.new('projection-check',data)
scene.collection.objects.link(camera);scene.camera=camera
data.sensor_width=36;data.sensor_fit='HORIZONTAL'
# Obtain projection coefficients from the actual pinned engine, independently of adapter math.
script = """import * as pc from './src/pc.js';let rows=[];for(const [w,h] of [[390,844],[720,450]]) {const c=new pc.Camera();c.aspectRatioMode=pc.ASPECT_MANUAL;c.aspectRatio=w/h;c.fov=38;c.horizontalFov=w<h;const m=c.projectionMatrix.data;rows.push({w,h,fx:m[0]*w/2,fy:m[5]*h/2});}console.log(JSON.stringify(rows));"""
projections=json.loads(subprocess.check_output(['node','--input-type=module','-e',script],cwd=ROOT,text=True))
points=0;maximum=0.
for projection in projections:
    w,h=projection['w'],projection['h']
    scene.render.resolution_x=w;scene.render.resolution_y=h;scene.render.resolution_percentage=100
    focal=adapter.focal_pixels(w,h,38)
    assert abs(focal-projection['fx'])<.0001 and abs(focal-projection['fy'])<.0001
    data.lens=focal*36/w
    for yaw,pitch in [(0,0),(-20,0),(20,0),(-30,0),(30,0),(0,-20),(0,20),(0,-30),(0,30)]:
        y=math.radians(yaw);p=-math.radians(pitch)
        ry=np.array([[math.cos(y),0,math.sin(y)],[0,1,0],[-math.sin(y),0,math.cos(y)]])
        rx=np.array([[1,0,0],[0,math.cos(p),-math.sin(p)],[0,math.sin(p),math.cos(p)]])
        rotation=ry@rx
        eye=rotation@np.array([0,0,distance+1.])
        pose={'eye':eye.tolist(),'right':rotation[:,0].tolist(),'up':rotation[:,1].tolist(),'forward':(-rotation[:,2]).tolist()}
        camera.matrix_world=Matrix(adapter.world_camera(base,pose,median).tolist())@Matrix.Diagonal([1,-1,-1,1])
        bpy.context.view_layer.update()
        for u in np.linspace(.05,.95,8):
            for v in np.linspace(.05,.95,8):
                source_point=np.array([(u*1280-640)*median/1000,(v*720-360)*median/1000,median,1])
                world=source@source_point
                projected=world_to_camera_view(scene,camera,Vector(world[:3]))
                actual=np.array([projected.x*w,(1-projected.y)*h])
                recipe=np.array([(u-.5)*1280/720,.5-v,0])
                local=rotation.T@(recipe-eye)
                expected=np.array([w/2+projection['fx']*local[0]/-local[2],h/2-projection['fy']*local[1]/-local[2]])
                error=float(np.max(np.abs(actual-expected)));maximum=max(maximum,error);points+=1
                if error>.001:raise AssertionError(f'Blender and PlayCanvas differ: {actual} vs {expected}')
print(json.dumps({'sourceCameraRoundTrip':True,'orientations':2,'poses':9,'planePoints':points,'maxPixelError':maximum,'tolerancePixels':.001}),flush=True)
