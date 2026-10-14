"""Independent known-plane checks against the generator's actual Blender BVH."""

import importlib.util
from pathlib import Path
import tempfile
import unittest

import bpy
import numpy as np

path = Path(__file__).resolve().parents[1] / 'tools/studio-truth-generate.py'
spec = importlib.util.spec_from_file_location('truth_generator',path)
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class KnownGeometry(unittest.TestCase):
    def run_plane(self,metal=0,small=False):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        mat=generator.material('test',(.5,.5,.5),metal=metal)
        generator.box((0,0,3),(.1,.1,2) if small else (4,4,2),mat)
        tree,flags=generator.geometry()
        pose={'width':32,'height':24,'K':[[24,0,16],[0,24,12],[0,0,1]],'camera_to_world':np.eye(4).tolist()}
        with tempfile.TemporaryDirectory() as folder:
            out=Path(folder)
            generator.depth(tree,flags,pose,out,'plane')
            from studio_truth_camera import read_depth
            depth=read_depth(out/'plane.depth.f32.gz',32,24).copy()
            image=bpy.data.images.load(str(out/'plane.mask.png'))
            image.colorspace_settings.name='Non-Color'
            pixels=np.empty(32*24*4,dtype=np.float32)
            image.pixels.foreach_get(pixels)
            mask=np.round(pixels.reshape(24,32,4)[::-1,:,0]*255).astype(np.uint8)
            bpy.data.images.remove(image)
        return depth,mask

    def test_axial_depth_is_two_meters_even_at_oblique_pixels(self):
        depth,mask=self.run_plane()
        np.testing.assert_allclose(depth,2,atol=1e-6)
        np.testing.assert_equal(mask,np.ones((24,32),dtype=np.uint8))

    def test_metal_has_valid_geometry_and_ambiguous_appearance(self):
        depth,mask=self.run_plane(metal=1)
        np.testing.assert_allclose(depth,2,atol=1e-6)
        self.assertTrue(np.all(mask==3))

    def test_missing_geometry_is_nan_with_zero_mask(self):
        depth,mask=self.run_plane(small=True)
        self.assertTrue(np.any(mask==0))
        self.assertTrue(np.all(np.isnan(depth[mask==0])))
        self.assertTrue(np.any(mask==1))


if __name__=='__main__':
    unittest.main(argv=['studio-truth-blender'])
