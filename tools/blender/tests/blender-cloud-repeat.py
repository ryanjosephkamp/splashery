"""MIT. Real fresh-process rendering and byte comparison; requires installed pinned Blender."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]

class RepeatedRendering(unittest.TestCase):
    def test_every_artifact_is_identical_and_bad_inputs_fail_without_output(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as tmp:
            tmp = Path(tmp)
            base = ['bash', str(ROOT/'tools/blender-cloud.sh'), '--python',
                    str(ROOT/'tools/blender/render.py'), '--', '--model',
                    str(ROOT/'assets/toys/model-splats/burger.glb'), '--asset-record',
                    str(ROOT/'tools/blender/burger.json'), '--width', '64', '--height', '48',
                    '--views', '2', '--samples', '2', '--panorama-width', '128']
            for folder in ['a', 'b']:
                subprocess.run(base + ['--out', str(tmp/folder)], cwd=ROOT, check=True,
                               stdout=subprocess.DEVNULL)
            def hashes(folder):
                return {str(p.relative_to(folder)): hashlib.sha256(p.read_bytes()).hexdigest()
                        for p in folder.rglob('*') if p.is_file()}
            self.assertEqual(hashes(tmp/'a'), hashes(tmp/'b'))
            self.assertEqual(len(hashes(tmp/'a')), 17)  # 3 views x 5 outputs + manifest + checksums
            m = json.loads((tmp/'a/manifest.json').read_text())
            self.assertEqual(m['panorama']['projection'], 'equirectangular')
            self.assertEqual(m['views'][0]['width'], 64)
            # Existing output must not be silently reused.
            result = subprocess.run(base + ['--out', str(tmp/'a')], cwd=ROOT, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            record = json.loads((ROOT/'tools/blender/burger.json').read_text())
            record['sha256'] = '0'*64
            bad = tmp/'bad.json'
            bad.write_text(json.dumps(record))
            command = base.copy()
            command[command.index('--asset-record')+1] = str(bad)
            result = subprocess.run(command+['--out',str(tmp/'bad-output')], cwd=ROOT, capture_output=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertFalse((tmp/'bad-output').exists())


    def test_canonical_truth_scenes_are_identical_across_fresh_processes(self):
        with tempfile.TemporaryDirectory(dir=ROOT / '.cache') as tmp:
            tmp = Path(tmp)
            for folder in ['a','b']:
                subprocess.run(['bash',str(ROOT/'tools/blender-cloud.sh'),'--python',
                                str(ROOT/'tools/studio-truth-generate.py'),'--',
                                '--out',str(tmp/folder),'--mode','clips','--scenes','forest,night',
                                '--limit','1','--clip-side','160'],cwd=ROOT,check=True,
                               stdout=subprocess.DEVNULL)
            def files(folder):
                return {str(p.relative_to(folder)):p.read_bytes() for p in folder.rglob('*') if p.is_file()}
            a,b = files(tmp/'a'),files(tmp/'b')
            self.assertEqual(set(a),set(b))
            self.assertEqual([name for name in a if a[name]!=b[name]],[])

if __name__ == '__main__':
    unittest.main()
