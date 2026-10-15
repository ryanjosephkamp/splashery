"""MIT. CPU-only orchestration/integrity tests, never opens a browser."""
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import unittest
from unittest import mock

spec=importlib.util.spec_from_file_location('follower', '/workspace/v3d-r4-media/follow-r10-v1.py')
f=importlib.util.module_from_spec(spec);spec.loader.exec_module(f)
# Existing real R8 data is copied ONLY as a corruption-test fixture; never a live R10 source.
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

    def test_no_r8_source_discovery_for_fresh_r10_state(self):
        self.assertEqual(f.source_specs({'attempts':[]}),[])

    def test_r8_source_cannot_be_registered_as_an_r10_attempt(self):
        state={'attempts':[{'output':str(f.ROOT/'candidate-r8-phone'),'mode':'paired'}]}
        with self.assertRaisesRegex(RuntimeError,'escaped'):
            f.source_specs(state)

    def test_old_r9_sources_cannot_enter_r10_attempts(self):
        state={'attempts':[{'output':str(f.ROOT/'candidate-r9-v1-shards/001-cat-plays-desktop-paired'),'mode':'paired'}]}
        with self.assertRaisesRegex(RuntimeError,'escaped'):
            f.source_specs(state)

    def test_profile_with_no_prior_native_needs_no_profile_barrier_after_parent_retirement(self):
        declaration={'priorNativeBlockers':{'phone':{'native':None,'descendants':{}}}}
        state={}
        with mock.patch.object(f,'worker') as native, mock.patch.object(f,'event'), mock.patch.object(f,'atomic_json'):
            f.ready_worker('phone',state,declaration)
            native.assert_called_once_with('phone',state,declaration)

    def test_unknown_shard_is_not_silently_imported_or_retried(self):
        import tempfile
        with tempfile.TemporaryDirectory(prefix='r10-policy-',dir=f.CONTROL) as temporary:
            p=Path(temporary);(p/'unlisted-case').mkdir()
            with mock.patch.object(f,'SHARDS',p), self.assertRaisesRegex(RuntimeError,'Unlisted evidence'):
                f.source_specs({'attempts':[]})

    def test_own_profile_descendant_blocks_after_native_has_exited(self):
        child={'pid':11,'startTicks':'3','command':['renderer']}
        parent={'pid':10,'startTicks':'2','command':['node']}
        self.assertFalse(f.profile_ready(parent,{11:child},alive=lambda row:row['pid']==11))
        self.assertTrue(f.profile_ready(parent,{11:child},alive=lambda row:False))

class FinalizationTests(unittest.TestCase):
    def valid(self):
        d=f.read_json(f.CONTROL/'declaration.json')
        d.update(status='frozen-launch-authorized',authorization='UNIT-TEST ONLY; no launch',
                 productCommit='a'*40,toolsCommit='b'*40,servedSourceSha256='c'*64,
                 pairedProvenanceSha256='d'*64,unpairedProvenanceSha256='e'*64,
                 priorCoordinator={**f.PRIOR_COORDINATOR,'retiredByRoot':True},
                 priorNativeBlockers={profile:{'native':None,'descendants':{}} for profile in f.PROFILES})
        required=[str(f.CONTROL/name) for name in ('runtime-freeze.json','prior-native-handoff.json','provenance-preparation.json','templates/paired.json','templates/unpaired.json')]
        required += [str(Path(f.__file__).resolve()),str(f.INTEGRITY),str(f.ROOT/'test-follow-r10-v1.py'),str(f.ROOT/'prepare-r10-provenance.mjs'),str(f.ROOT/'finalize-r10-declaration.py'),str(f.MANIFEST),str(f.JOIN)]
        required += [str(f.REPO/'tools'/name) for name in ('v3d-bench.mjs','v3d-bench-metrics.mjs','v3d-bench-samples.mjs','v3d-bench-pixels.mjs','cdx-v3d-clarity-metrics.mjs')]
        d['immutableFiles']={file:'f'*64 for file in required}
        return d

    def test_prepared_draft_cannot_configure_or_spawn_native_work(self):
        d=f.read_json(f.CONTROL/'declaration.json')
        with mock.patch.object(f.subprocess,'Popen') as spawned, self.assertRaisesRegex(RuntimeError,'frozen first'):
            f.configure(d)
        spawned.assert_not_called()

    def test_explicit_final_fields_are_required(self):
        f.validate_final_declaration(self.valid())
        for field in ['authorization','productCommit','toolsCommit','servedSourceSha256','pairedProvenanceSha256','unpairedProvenanceSha256','priorNativeBlockers']:
            d=self.valid();d[field]=None
            with self.assertRaises(RuntimeError,msg=field):f.validate_final_declaration(d)

    def test_old_r9_provenance_and_missing_profile_are_rejected(self):
        d=self.valid();d['pairedProvenanceSha256']='fca50d7bc2b5d22bddecd7ee77d5c5bb0942444fe6ddf12f008d544bcb2d8ca0'
        with self.assertRaisesRegex(RuntimeError,'newly derived'):f.validate_final_declaration(d)
        d=self.valid();d['profiles']=['phone']
        with self.assertRaisesRegex(RuntimeError,'Both profiles'):f.validate_final_declaration(d)

    def test_retirement_and_complete_precise_blockers_are_mandatory(self):
        d=self.valid();d['priorCoordinator']['retiredByRoot']=False
        with self.assertRaisesRegex(RuntimeError,'retire'):f.validate_final_declaration(d)
        d=self.valid();d['priorNativeBlockers']['phone']['descendants']={1:{'pid':1,'startTicks':None,'command':['renderer']}}
        with self.assertRaisesRegex(RuntimeError,'identity'):f.validate_final_declaration(d)
        d=self.valid();binding={'pid':1,'startTicks':'2','command':['renderer']}
        d['priorNativeBlockers']['phone']['descendants']={1:binding};d['priorNativeBlockers']['desktop']['descendants']={1:binding}
        with self.assertRaisesRegex(RuntimeError,'duplicated'):f.validate_final_declaration(d)

    def test_active_old_coordinator_blocks_even_otherwise_final_configuration(self):
        d=self.valid()
        with mock.patch.object(f,'MANIFEST',Path('/workspace/splashery-v3d-bench-tools-r9/tools/v3d-corpus.json')), \
             mock.patch.object(f,'validate_final_declaration'),mock.patch.object(f,'old_alive',return_value=True), \
             mock.patch.object(f,'PAIRED',f.PAIRED),mock.patch.object(f,'UNPAIRED',f.UNPAIRED), \
             mock.patch.object(f.subprocess,'Popen') as spawned, self.assertRaisesRegex(RuntimeError,'still alive'):
            f.configure(d)
        spawned.assert_not_called()

    def test_protocol_and_final_receipt_digests_are_required(self):
        d=self.valid();d['protocolSha256']='0'*64
        with self.assertRaisesRegex(RuntimeError,'protocol'):f.validate_final_declaration(d)
        d=self.valid();d['immutableFiles'].pop(str(f.CONTROL/'prior-native-handoff.json'))
        with self.assertRaisesRegex(RuntimeError,'hash-bound'):f.validate_final_declaration(d)

    def finalizer(self):
        s=importlib.util.spec_from_file_location('finalize_r10',f.ROOT/'finalize-r10-declaration.py')
        module=importlib.util.module_from_spec(s);s.loader.exec_module(module)
        return module

    def test_finalizer_requires_explicit_new_identities_and_copies_every_blocker(self):
        module=self.finalizer();draft=f.read_json(f.CONTROL/'declaration.json');valid=self.valid()
        expected={key:valid[key] for key in ('productCommit','toolsCommit','servedSourceSha256','pairedProvenanceSha256','unpairedProvenanceSha256')}
        prep={key:expected[key] for key in ('productCommit','toolsCommit','servedSourceSha256')}
        prep['templates']={mode:{'provenanceSha256':expected[field]} for mode,field in [('paired','pairedProvenanceSha256'),('unpaired','unpairedProvenanceSha256')]}
        child={'pid':7,'startTicks':'8','command':['renderer']}
        handoff={'coordinator':valid['priorCoordinator'],'profiles':copy.deepcopy(valid['priorNativeBlockers'])}
        handoff['profiles']['phone']['descendants']={'7':child}
        result=module.assemble(draft,prep,handoff,expected,'UNIT-TEST ONLY')
        self.assertEqual(result['priorNativeBlockers']['phone']['descendants'],{'7':child})
        self.assertEqual(draft['status'],'prepared-root-freeze-and-handoff-pending')
        prep['templates']['paired']['provenanceSha256']='0'*64
        with self.assertRaisesRegex(RuntimeError,'provenance'):module.assemble(draft,prep,handoff,expected,'UNIT-TEST ONLY')

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
        # R10 is not frozen yet. Use only the already-frozen identical protocol modules for
        # CPU validator fixtures; never populate a live R10 output/template from these R8 rows.
        fixture_tools=Path('/workspace/splashery-v3d-bench-tools-r9')
        request={'toolsRoot':str(fixture_tools),'manifest':str(fixture_tools/'tools/v3d-corpus.json'),'reference':str(f.REFERENCE),'baselineExpected':f.BASELINE,
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
