"""MIT. Removing volatile metadata must preserve the encoded image bytes exactly."""
import importlib.util
from pathlib import Path
import struct
import tempfile
import unittest
import zlib

path = Path(__file__).resolve().parents[3] / 'tools/studio_truth_images.py'

class ImageMetadata(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('images',path)
        cls.images = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.images)

    def test_jpeg_comments_removed_without_touching_scan_or_color_profile(self):
        # Header segments and entropy-coded scan are opaque bytes to the canonicalizer.
        profile = b'\xff\xe2\x00\x05ICC'
        scan = b'\xff\xda\x00\x02encoded\xff\x00pixels\xff\xd9'
        for comment in [b'date a',b'date b and different render duration']:
            with tempfile.TemporaryDirectory() as tmp:
                p=Path(tmp)/'image.jpg'
                p.write_bytes(b'\xff\xd8'+profile+b'\xff\xfe'+struct.pack('>H',len(comment)+2)+comment+scan)
                self.images.canonical_jpeg(p)
                self.assertEqual(p.read_bytes(),b'\xff\xd8'+profile+scan)

    def test_png_pixels_and_color_profile_survive_metadata_removal(self):
        def chunk(kind,data):
            return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data))
        stable=b'\x89PNG\r\n\x1a\n'+chunk(b'iCCP',b'profile')+chunk(b'IDAT',b'encoded pixels')+chunk(b'IEND',b'')
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'image.png'
            p.write_bytes(stable[:8]+chunk(b'tEXt',b'Date\0today')+stable[8:])
            self.images.canonical_png(p)
            self.assertEqual(p.read_bytes(),stable)

if __name__ == '__main__':
    unittest.main()
