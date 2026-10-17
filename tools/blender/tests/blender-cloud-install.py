"""MIT. Offline checks: corrupted bytes must never become an executable install."""
import importlib.util
import hashlib
from pathlib import Path
import tempfile
import unittest

path = Path(__file__).resolve().parents[3] / 'tools/blender/install.py'

class InstallIntegrity(unittest.TestCase):
    def test_installer_exists(self):
        self.assertTrue(path.exists(), 'Missing pinned Blender installer')

    def load(self):
        spec = importlib.util.spec_from_file_location('blender_install', path)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module

    def test_corrupt_archive_is_rejected(self):
        m = self.load()
        with tempfile.TemporaryDirectory() as tmp:
            archive = Path(tmp) / 'archive'
            archive.write_bytes(b'corrupt')
            with self.assertRaisesRegex(ValueError, 'SHA-256'):
                m.verify(archive, '0' * 64)

    def test_install_stops_before_extraction_on_a_corrupt_cached_archive(self):
        m = self.load()
        with tempfile.TemporaryDirectory() as tmp:
            cache = Path(tmp)
            (cache / m.ARCHIVE).write_bytes(b'corrupt archive bytes')
            with self.assertRaisesRegex(ValueError, 'SHA-256'):
                m.install(cache)
            self.assertFalse((cache / f'blender-{m.VERSION}-linux-x64').exists())
            self.assertFalse((cache / 'install.json').exists())

    def test_cache_detects_changed_and_added_files(self):
        m = self.load()
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'blender').write_bytes(b'original')
            expected = m.inventory(root)
            self.assertEqual(expected['blender'], hashlib.sha256(b'original').hexdigest())
            (root / 'blender').write_bytes(b'changed')
            self.assertNotEqual(m.inventory(root), expected)
            (root / 'blender').write_bytes(b'original')
            (root / 'extra.py').write_bytes(b'added')
            self.assertNotEqual(m.inventory(root), expected)

if __name__ == '__main__':
    unittest.main()
