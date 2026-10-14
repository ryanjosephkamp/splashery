"""MIT. Required geometry truth cannot be omitted to pass archive validation."""
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('truth_assets',ROOT/'tools/studio-truth-assets.py')
assets=importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


class RequiredTruth(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.folder=Path(self.temp.name)/'truth'
        shutil.copytree(ROOT/'tests/fixtures/truth',self.folder)
        self.posefile=self.folder/'still-life/still/poses.json'
        self.sequence=json.loads(self.posefile.read_text())

    def tearDown(self):
        self.temp.cleanup()

    def test_missing_still_truth_is_rejected(self):
        p=self.sequence['frames'][0]
        del p['depth'],p['mask']
        self.posefile.write_text(json.dumps(self.sequence))
        with self.assertRaisesRegex(AssertionError,'missing required truth'):
            assets.validate(self.folder,False)

    def test_unpaired_mask_is_rejected(self):
        del self.sequence['frames'][0]['mask']
        self.posefile.write_text(json.dumps(self.sequence))
        with self.assertRaisesRegex(AssertionError,'Depth and mask'):
            assets.validate(self.folder,False)

    def test_missing_handheld_truth_is_rejected(self):
        p=self.sequence['frames'][0]
        frames=[{**p,'frame':i,'time':i/30,'rgb':'../still/still.jpg'} for i in range(120)]
        del frames[0]['depth'],frames[0]['mask']
        folder=self.folder/'still-life/handheld'
        folder.mkdir()
        (folder/'poses.json').write_text(json.dumps({'fps':30,'duration_seconds':4,'frames':frames}))
        with self.assertRaisesRegex(AssertionError,'missing required truth'):
            assets.validate(self.folder,True)


if __name__=='__main__':unittest.main()
