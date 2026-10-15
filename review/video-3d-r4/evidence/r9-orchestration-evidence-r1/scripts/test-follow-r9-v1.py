"""MIT. CPU-only orchestration/integrity tests, never opens a browser."""
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import unittest
from unittest import mock

spec=importlib.util.spec_from_file_location('follower', '/workspace/v3d-r4-media/follow-r9-v1.py')
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
# Existing real R8 data is copied ONLY as a corruption-test fixture; never a live R9 source.
f.PAIRED="b80c296943b98d423b707e284c2b8b1167475cf84b94fc323c82808528c4607b"
f.UNPAIRED="3051307eee7fbcca5b4b27fc3b8ab53de5560afebdaf1fe079dd0991d70d0914"

class PolicyTests(unittest.TestCase):
    def test_accountable_then_incomplete_then_manifest_order(self):
        ids=['first','second','third','fourth']
        before={('second','phone'):{'accounted':False},('third','phone'):{'accounted':True},('fourth','phone'):{'accounted':True}}
        self.assertEqual(f.choose_case(ids,'phone',set(),set(),before)['id'],'third')
        self.assertEqual(f.choose_case(ids,'phone',{('third','phone'),('fourth','phone')},set(),before)['id'],'second')
        self.assertEqual(f.choose_case(ids,'phone',{('second','phone'),('third','phone'),('fourth','phone')},set(),before)['id'],'first')

    def test_attempted_paired_failure_never_retried(self):
        before={('first','phone'):{'accounted':True}}
        self.assertIsNone(f.choose_case(['first'],'phone',{('first','phone')},set(),before))

    def test_unpaired_repeat_is_quality_independent_once_accountable(self):
        key=('first','phone')
        self.assertIsNone(f.choose_case(['first'],'phone',set(),{key},{key:{'accounted':False}}))
        choice=f.choose_case(['first'],'phone',set(),{key},{key:{'accounted':True}})
        self.assertEqual((choice['mode'],choice['reason']),('paired','declared-unpaired-to-paired-repeat'))
        self.assertIsNone(f.choose_case(['first'],'phone',{key},{key},{key:{'accounted':True}}))

    def test_case_folder_without_row_and_reserved_shard_are_consumed(self):
        summary={'runs':[{'provenanceSha256':f.UNPAIRED,'rows':[],'attempts':[{'id':'first','profile':'desktop'}]}]}
        state={'attempts':[{'id':'second','profile':'desktop','mode':'paired','state':'reserved'}]}
        paired,unpaired=f.attempted_sets(summary,state)
        self.assertEqual(paired,{('second','desktop')});self.assertEqual(unpaired,{('first','desktop')})

    def test_completed_old_follower_only_needs_reconciliation(self):
        ids=['first','second'];attempted={(i,'phone') for i in ids}
        self.assertIsNone(f.choose_case(ids,'phone',attempted,set(),{}))

    def test_process_identity_reuse_and_zombies_do_not_block(self):
        self.assertFalse(f.old_alive({'pid':999999999,'startTicks':'0','command':[]}))
        current=f.process_identity(__import__('os').getpid())
        binding={'pid':current['pid'],'startTicks':'different','command':[v.decode() for v in current['command']]}
        self.assertFalse(f.old_alive(binding))

    def test_phone_continues_while_desktop_old_follower_is_active(self):
        current=f.process_identity(__import__('os').getpid())
        desktop={'pid':current['pid'],'profile':'desktop','startTicks':current['startTicks'],
                 'command':[value.decode() for value in current['command']]}
        phone={'pid':999999999,'profile':'phone','startTicks':'0','command':[]}
        declaration={'priorNativeBlockers':{'phone':{'native':phone,'descendants':{}},'desktop':{'native':desktop,'descendants':{}}}}
        state={}
        self.assertTrue(f.old_alive(desktop))
        self.assertFalse(f.profile_ready(desktop,{}))
        with mock.patch.object(f,'worker') as native, mock.patch.object(f,'event'), mock.patch.object(f,'atomic_json'):
            f.ready_worker('phone',state,declaration)
            native.assert_called_once_with('phone',state,declaration)
        self.assertTrue(f.old_alive(desktop))

    def test_profile_waits_for_its_own_surviving_descendant(self):
        current=f.process_identity(__import__('os').getpid())
        child={'pid':current['pid'],'startTicks':current['startTicks'],
               'command':[value.decode() for value in current['command']]}
        parent={'pid':999999999,'startTicks':'0','command':[]}
        self.assertFalse(f.profile_ready(parent,{child['pid']:child}))
        self.assertTrue(f.profile_ready(parent,{}))

    def test_bound_process_title_change_does_not_release_ownership(self):
        current=f.process_identity(__import__('os').getpid())
        binding={'pid':current['pid'],'startTicks':current['startTicks'],'command':['former-process-title']}
        self.assertTrue(f.old_alive(binding))

    def test_no_r8_source_discovery_for_fresh_r9_state(self):
        self.assertEqual(f.source_specs({'attempts':[]}),[])

    def test_r8_source_cannot_be_registered_as_an_r9_attempt(self):
        state={'attempts':[{'output':str(f.ROOT/'candidate-r8-phone'),'mode':'paired'}]}
        with self.assertRaisesRegex(RuntimeError,'escaped'):
            f.source_specs(state)

    def test_profile_can_start_with_no_prior_native_even_if_old_parent_lives(self):
        declaration={'priorNativeBlockers':{'phone':{'native':None,'descendants':{}}}}
        state={}
        with mock.patch.object(f,'worker') as native, mock.patch.object(f,'event'), mock.patch.object(f,'atomic_json'):
            f.ready_worker('phone',state,declaration)
            native.assert_called_once_with('phone',state,declaration)

    def test_unknown_shard_is_not_silently_imported_or_retried(self):
        import tempfile
        with tempfile.TemporaryDirectory(prefix='r9-policy-',dir=f.CONTROL) as temporary:
            p=Path(temporary);(p/'unlisted-case').mkdir()
            with mock.patch.object(f,'SHARDS',p), self.assertRaisesRegex(RuntimeError,'Unlisted evidence'):
                f.source_specs({'attempts':[]})

    def test_own_profile_descendant_blocks_after_native_has_exited(self):
        child={'pid':11,'startTicks':'3','command':['renderer']}
        parent={'pid':10,'startTicks':'2','command':['node']}
        self.assertFalse(f.profile_ready(parent,{11:child},alive=lambda row:row['pid']==11))
        self.assertTrue(f.profile_ready(parent,{11:child},alive=lambda row:False))

class IntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fixture=f.CONTROL/('cpu-test-fixtures-'+str(__import__('os').getpid()))
        cls.fixture.mkdir(exist_ok=False)
        source=f.ROOT/'candidate-r8-phone'
        run=f.read_json(source/'run.json');row=next(r for r in run['results'] if r['id']=='cat-plays' and r['profile']=='phone')
        cls.case=cls.fixture/'cat-plays-phone';shutil.copytree(source/'cat-plays-phone',cls.case)
        run['results']=[row];cls.fixture_run=run
        (cls.fixture/'run.json').write_text(json.dumps(run)+'\n')
        (cls.fixture/'TEST-FIXTURE-ONLY.txt').write_text('A copied existing row and case for validator corruption tests. Not an accepted benchmark source.\n')

    def check(self):
        request={'toolsRoot':str(f.REPO),'manifest':str(f.MANIFEST),'reference':str(f.REFERENCE),'baselineExpected':f.BASELINE,
                 'sources':[{'directory':str(self.fixture),'kind':'paired','expected':f.PAIRED}]}
        return subprocess.run([f.NODE,str(f.INTEGRITY)],input=json.dumps(request),text=True,capture_output=True,timeout=60)

    def test_a_real_copied_case_passes_without_changing_bytes(self):
        result=self.check();self.assertEqual(result.returncode,0,result.stderr)
        data=json.loads(result.stdout);self.assertEqual(data['runs'][0]['rows'][0]['status'],'finished')

    def test_b_corrupted_model_is_rejected(self):
        model=self.case/'model.ply';original=model.read_bytes()
        try:
            model.write_bytes(bytes([original[0]^1])+original[1:]);result=self.check()
            self.assertNotEqual(result.returncode,0);self.assertIn('artifact',result.stderr.lower())
        finally:model.write_bytes(original)

    def test_c_corrupted_png_is_rejected(self):
        png=self.case/'render-0.png';original=png.read_bytes()
        try:
            png.write_bytes(bytes([original[0]^1])+original[1:]);result=self.check()
            self.assertNotEqual(result.returncode,0);self.assertIn('artifact',result.stderr.lower())
        finally:png.write_bytes(original)

    def test_d_provenance_mismatch_is_rejected(self):
        original=(self.fixture/'run.json').read_bytes();run=copy.deepcopy(self.fixture_run);run['provenance']['url']='http://invalid.example/'
        try:
            (self.fixture/'run.json').write_text(json.dumps(run));result=self.check()
            self.assertNotEqual(result.returncode,0);self.assertIn('provenance',result.stderr.lower())
        finally:(self.fixture/'run.json').write_bytes(original)

if __name__=='__main__':unittest.main(verbosity=2)
