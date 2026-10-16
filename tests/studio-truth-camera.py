"""Independent projection checks for the fixture's public camera contract."""

import importlib.util
from pathlib import Path
import unittest

import numpy as np


class CameraContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = Path(__file__).resolve().parents[1] / "tools/studio_truth_camera.py"
        spec = importlib.util.spec_from_file_location("truth_camera", path)
        cls.camera = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.camera)

    def test_plane_has_constant_axial_depth_but_varying_ray_distance(self):
        k = [[80, 0, 40], [0, 80, 30], [0, 0, 1]]
        directions = self.camera.rays(k, np.eye(4), 80, 60)
        t = 3 / directions[:, :, 2]
        points = directions * t[:, :, None]
        np.testing.assert_allclose(points[:, :, 2], 3, atol=1e-12)
        self.assertGreater(t[0, 0], t[30, 40])

    def test_known_rotation_translation_round_trip_and_pixel_centers(self):
        c2w = np.array([[0, 0, 1, 4], [0, 1, 0, 2], [-1, 0, 0, -3], [0, 0, 0, 1]])
        k = [[100, 0, 2], [0, 100, 1.5], [0, 0, 1]]
        rays = self.camera.rays(k, c2w, 4, 3)
        points = c2w[:3, 3] + rays * 7
        uv, z = self.camera.project(points, k, np.linalg.inv(c2w))
        expected = np.stack(np.meshgrid(np.arange(4) + .5, np.arange(3) + .5), axis=-1)
        np.testing.assert_allclose(uv, expected, atol=1e-10)
        self.assertTrue(np.all(z > 0))

    def test_depth_codec_preserves_nan_and_float32(self):
        import tempfile

        a = np.array([[1.234567, np.nan], [12.5, .25]], dtype=np.float32)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "depth.f32.gz"
            self.camera.write_depth(path, a)
            b = self.camera.read_depth(path, 2, 2)
            np.testing.assert_equal(a, b)
            first = path.read_bytes()
            self.camera.write_depth(path, a)
            self.assertEqual(first, path.read_bytes())


if __name__ == "__main__":
    unittest.main()
