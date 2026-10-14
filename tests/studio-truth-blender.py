"""Independent known-plane checks against the generator's actual Blender BVH."""

import importlib.util
from pathlib import Path
import tempfile
import unittest
import sys
import shutil
from unittest.mock import patch

import bpy
import numpy as np

path = Path(__file__).resolve().parents[1] / 'tools/studio-truth-generate.py'
spec = importlib.util.spec_from_file_location('truth_generator',path)
generator = importlib.util.module_from_spec(spec)
spec.loader.exec_module(generator)


class KnownGeometry(unittest.TestCase):
    def run_plane(self,metal=0,small=False,plane=2,near_occluder=False):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        mat=generator.material('test',(.5,.5,.5),metal=metal)
        size=(.1,.1,2) if small else ((500,500,2) if plane>100 else (4,4,2))
        generator.box((0,0,plane+1),size,mat)
        if near_occluder:generator.box((0,0,.015),(4,4,.02),mat)
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

    def test_far_clip_is_axial_not_euclidean_ray_length(self):
        depth,mask=self.run_plane(plane=195)
        np.testing.assert_allclose(depth,195,atol=1e-3)
        self.assertTrue(np.all(mask==1))

    def test_geometry_before_near_clip_does_not_hide_visible_geometry(self):
        depth,mask=self.run_plane(near_occluder=True)
        np.testing.assert_allclose(depth,2,atol=1e-6)
        self.assertTrue(np.all(mask==1))

    def test_geometry_after_far_clip_is_invalid(self):
        depth,mask=self.run_plane(plane=205)
        self.assertTrue(np.all(np.isnan(depth)))
        self.assertTrue(np.all(mask==0))

    def test_resume_rejects_changed_camera_helper_before_mutating_outputs(self):
        with tempfile.TemporaryDirectory() as folder:
            folder=Path(folder)
            driver=folder/path.name
            helper=folder/'studio_truth_camera.py'
            shutil.copyfile(path,driver)
            shutil.copyfile(path.parent/helper.name,helper)
            output=folder/'output'
            argv=['test','--','--out',str(output),'--mode','still','--scenes','not-a-scene']
            with patch.object(generator,'__file__',str(driver)),patch.object(sys,'argv',argv):
                # The invalid selection stops before rendering, after recording valid settings.
                with self.assertRaises(SystemExit):generator.main()
                file=output/'build-settings.json'
                original=file.read_bytes()
                helper.write_bytes(helper.read_bytes()+b'\n# Changed helper identity\n')
                with self.assertRaisesRegex(ValueError,'different source or settings'):
                    generator.main()
                self.assertEqual(file.read_bytes(),original)


if __name__=='__main__':
    unittest.main(argv=['studio-truth-blender'])
