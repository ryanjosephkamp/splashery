# MIT. Made by Ryan with Codex (GPT-6). Small CPU controls for the fixed estimator.
import unittest
import numpy as np
import estimate

class RuleChecks(unittest.TestCase):
    def frames(self, even=(.6,.5,.4), odd=None):
        frames={}
        for i in estimate.PARAM['fitIndices']+estimate.PARAM['validationIndices']:
            frame=np.empty((24,32,3),dtype=np.float32)
            frame[:]=odd if odd is not None and i%2 else even
            frame[8:16,8:24]=[.1,.8,.1]
            frames[i]=frame
        return frames

    def test_single_lowtexture_surround_passes_and_retains_exact_rgb(self):
        result=estimate.evaluate('control-flat',self.frames(),{}, {})
        self.assertTrue(result['accepted'])
        np.testing.assert_array_equal(result['color'],np.asarray([.6,.5,.4],dtype=np.float32))
        self.assertEqual(result['split']['fit']['passFraction'],1)
        self.assertEqual(result['split']['validation']['passFraction'],1)

    def test_unused_validation_colors_can_reject_fit(self):
        result=estimate.evaluate('control-shift',self.frames(odd=(.1,.2,.7)),{}, {})
        self.assertFalse(result['accepted'])
        self.assertFalse(result['gates']['validation'])
        self.assertFalse(result['gates']['colorDrift'])
        np.testing.assert_array_equal(result['color'],np.asarray([.6,.5,.4],dtype=np.float32))

    def test_internal_holdout_is_not_accessed(self):
        frames=self.frames()
        self.assertNotIn(8,frames)
        result=estimate.evaluate('control-no-holdout',frames,{}, {})
        self.assertNotIn(8,[r['index'] for r in result['frames']])

if __name__=='__main__':
    unittest.main()
