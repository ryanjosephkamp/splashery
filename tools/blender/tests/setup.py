"""MIT. Browser-only setup must never invoke the optional Blender installer."""
import hashlib
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[3]

class OptionalBlender(unittest.TestCase):
    def run_setup(self, free, blender=False):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in ['tools/blender', 'tests', 'src', 'node_modules/.bin', 'bin']:
                (root/name).mkdir(parents=True)
            shutil.copy(ROOT/'tools/codex-setup.sh',root/'tools/codex-setup.sh')
            (root/'package.json').write_text('{}')
            (root/'package-lock.json').write_text('{}')
            (root/'node_modules/.codex-setup-lock').write_text(hashlib.sha256(b'{}').hexdigest())
            # Fake old Python on a host where the Blender installer is unavailable.
            stubs = {'python3': 'case "$1" in --version) echo "Python 3.8.0";; -c) exit 0;; *) touch "$PWD/blender-invoked"; exit 99;; esac',
                     'node': 'echo 24', 'npm': 'echo 11', 'playwright': 'echo "Version 1.56.1"',
                     'df': f'echo "Filesystem 1048576-blocks Used Available Capacity Mounted"; echo "fake 9000 0 {free} 0% /"',
                     'chromium': 'exit 0'}
            for name, script in stubs.items():
                file = root/('node_modules/.bin' if name == 'playwright' else 'bin')/name
                file.write_text('#!/bin/sh\n'+script+'\n')
                file.chmod(0o755)
            env = {**os.environ, 'PATH': str(root/'bin')+':'+os.environ['PATH'], 'SPLASHERY_CHROMIUM': str(root/'bin/chromium')}
            env.pop('CODEX_SETUP_MIN_FREE_MB',None)
            result = subprocess.run(['bash',str(root/'tools/codex-setup.sh'),'--skip-browser','--no-check']+(['--blender'] if blender else []),env=env,capture_output=True,text=True)
            return result, (root/'blender-invoked').exists()

    def test_browser_setup_accepts_old_python_and_does_not_invoke_blender(self):
        result, invoked = self.run_setup(4000)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertFalse(invoked)
        self.assertIn('need 3000 MB',result.stdout)

    def test_opt_in_requires_five_gigabytes(self):
        result, invoked = self.run_setup(4000,True)
        self.assertNotEqual(result.returncode,0)
        self.assertFalse(invoked)
        self.assertIn('need 5000 MB',result.stdout)

    def test_opt_in_reports_installer_failure(self):
        result, invoked = self.run_setup(6000,True)
        self.assertNotEqual(result.returncode,0)
        self.assertTrue(invoked)
        self.assertIn('Pinned Blender setup failed',result.stderr)

if __name__ == '__main__':
    unittest.main()
