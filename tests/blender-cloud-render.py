"""MIT. Independent camera checks, run through tools/blender-cloud.sh --python."""
import importlib.util
import math
from pathlib import Path
import sys
import tempfile
import unittest
import numpy as np
import bpy

path = Path(__file__).resolve().parents[1] / 'tools/blender/render.py'

class RenderContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('cloud_render', path)
        cls.renderer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.renderer)

    def test_panorama_center_and_cardinal_directions(self):
        r = self.renderer.panorama_rays(8, 5, np.eye(4))
        # Pixel-center latitude=0 on middle row; longitude at +/-22.5 degrees.
        np.testing.assert_allclose(r[2, 4], [math.sin(math.pi/8), 0, math.cos(math.pi/8)], atol=1e-7)
        np.testing.assert_allclose(r[2, 0], [-math.sin(math.pi/8), 0, -math.cos(math.pi/8)], atol=1e-7)
        self.assertGreater(r[0, 4, 1], -1)  # top row points up in +Y-down coordinates
        self.assertLess(r[0, 4, 1], 0)
        np.testing.assert_allclose(np.linalg.norm(r, axis=2), 1, atol=1e-7)

    def test_perspective_plane_depth_is_axial_and_panorama_depth_is_radial(self):
        m = self.renderer
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 3))
        bpy.context.object.scale = (100, 100, 2)  # nearest face z=2
        m.prepare_materials()
        tree, flags = m.truth.geometry()
        pose = {'width': 8, 'height': 5, 'K': [[6,0,4],[0,6,2.5],[0,0,1]],
                'camera_to_world': np.eye(4).tolist()}
        depth, mask = m.trace(tree, flags, pose, panoramic=False)
        np.testing.assert_allclose(depth, 2, atol=1e-6)
        self.assertTrue(np.all(mask == 1))
        radial, mask = m.trace(tree, flags, pose, panoramic=True)
        directions = m.panorama_rays(8, 5, np.eye(4))
        valid = directions[:,:,2] > 0
        np.testing.assert_allclose(radial[valid], 2/directions[:,:,2][valid], rtol=1e-6)
        self.assertTrue(np.all(np.isnan(radial[~valid])))
        self.assertTrue(np.all(mask[~valid] == 0))

    def test_black_emission_with_default_strength_is_opaque(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        mat = bpy.data.materials.new('opaque')
        mat.use_nodes = True
        node = mat.node_tree.nodes.get('Principled BSDF')
        node.inputs['Emission Color'].default_value = (0,0,0,1)
        node.inputs['Emission Strength'].default_value = 1
        self.renderer.prepare_materials()
        self.assertFalse(mat['truth_appearance_ambiguous'])

    def test_metal_and_glass_are_appearance_ambiguous(self):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        mat = bpy.data.materials.new('metal')
        mat.use_nodes = True
        mat.node_tree.nodes.get('Principled BSDF').inputs['Metallic'].default_value = 1
        self.renderer.prepare_materials()
        self.assertTrue(mat['truth_appearance_ambiguous'])


    def test_rendered_panorama_matches_the_camera_axes_and_radial_depth(self):
        m = self.renderer
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.mesh.primitive_cube_add(size=4)
        cube = bpy.context.object
        colors = [(1,0,0), (0,1,1), (0,1,0), (1,0,1), (0,0,1), (1,1,0)]
        for i, color in enumerate(colors):
            mat = bpy.data.materials.new(str(i))
            mat.use_nodes = True
            nodes = mat.node_tree.nodes
            nodes.clear()
            emission = nodes.new('ShaderNodeEmission')
            emission.inputs['Color'].default_value = (*color,1)
            output = nodes.new('ShaderNodeOutputMaterial')
            mat.node_tree.links.new(emission.outputs[0], output.inputs['Surface'])
            cube.data.materials.append(mat)
        for face in cube.data.polygons:
            axis = max(range(3), key=lambda i: abs(face.normal[i]))
            face.material_index = axis*2 + (0 if face.normal[axis] > 0 else 1)
        m.prepare_materials()
        tree, flags = m.truth.geometry()
        bpy.ops.object.camera_add(location=(0,0,0), rotation=(0,0,0))
        scene = bpy.context.scene
        scene.camera = bpy.context.object
        scene.camera.data.clip_start, scene.camera.data.clip_end = .05, 200
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = 1
        scene.cycles.use_denoising = False
        scene.render.resolution_percentage = 100
        scene.render.image_settings.file_format = 'PNG'
        scene.view_settings.view_transform = 'Standard'
        scene.view_settings.look = 'None'
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            pose, timing = m.render_view(out, 'test', tree, flags, 32, 16, True)
            image = bpy.data.images.load(str(out/'test.png'))
            pixels = np.asarray(image.pixels[:]).reshape(16,32,4)[::-1,:,:3]
            # Around the equator: back (+Z), left (-X), forward (-Z), right (+X).
            for x, expected in [(0,colors[4]),(8,colors[1]),(16,colors[5]),(24,colors[0])]:
                np.testing.assert_allclose(pixels[8,x], expected, atol=.01)
            np.testing.assert_allclose(pixels[0,16], colors[2], atol=.01)
            np.testing.assert_allclose(pixels[15,16], colors[3], atol=.01)
            bpy.data.images.remove(image)
            from studio_truth_camera import read_depth
            actual = read_depth(out/'test.depth.f32.gz',32,16)
            # Inside a 4m cube, the first intersection is at 2/max(|ray component|).
            directions = m.panorama_rays(32,16,pose['camera_to_world'])
            np.testing.assert_allclose(actual, 2/np.max(np.abs(directions),axis=2), rtol=1e-6)

if __name__ == '__main__':
    unittest.main(argv=['blender-cloud-render'])
