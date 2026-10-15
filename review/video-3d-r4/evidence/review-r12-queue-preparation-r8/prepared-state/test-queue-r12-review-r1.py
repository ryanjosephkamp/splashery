"""MIT. CPU-only controls; fake providers are unit fixtures, never process receipts."""
import copy
import importlib.util
import json
from pathlib import Path
import shutil
import signal
import subprocess
import tempfile
import unittest
from unittest import mock

spec=importlib.util.spec_from_file_location('queue_review','/workspace/v3d-r4-media/queue-r12-review-r1.py')
q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
if q.read(q.CONTROL/'declaration.json').get('status')!='prepared-awaiting-root-bindings':
    raise RuntimeError('Preparation-only CPU suite refuses finalized/live configuration; use --check without rerunning this suite.')
def fake_binding(pid,ticks='7'):
    return {'pid':pid,'startTicks':ticks,'command':['UNIT-TEST-FAKE-NOT-OBSERVED']}
def fake_live(binding,state='S',**extra):return {**binding,'state':state,**extra}
class GuardTests(unittest.TestCase):
    def draft(self):return q.read(q.CONTROL/'declaration.json')
    def valid(self):
        d=self.draft();d.update(status='root-authorized',authorization='UNIT TEST ONLY',
              candidateProvenanceSha256='a'*64,candidateServedSourceSha256='b'*64,rootReceiptSha256='c'*64,
              timedRoots={role:{'root':fake_binding(100+i),'descendants':{},'completeObservedDescendants':True} for i,role in enumerate(q.ROLES)})
        files=[Path(q.__file__).resolve(),q.PLANNER,q.ROOT/'test-queue-r12-review-r1.py',q.REVIEW,q.MANIFEST,q.CONTROL/'root-timed-work-receipt.json',q.CONTROL/'cpu-tests.log']
        files += [q.TOOLS/'tools'/name for name in ('v3d-bench.mjs','v3d-bench-metrics.mjs','v3d-bench-samples.mjs','v3d-bench-pixels.mjs','cdx-v3d-clarity-metrics.mjs')]
        d['immutableFiles']={str(p):'c'*64 for p in files};return d
    def test_pending_declaration_cannot_launch_or_inspect_processes(self):
        d=self.draft()
        with mock.patch.object(q,'process_identity') as inspected,mock.patch.object(q.subprocess,'Popen') as launched:
            with self.assertRaisesRegex(ValueError,'authorization'):q.run(d)
            inspected.assert_not_called();launched.assert_not_called()
    def test_reserved_single_invocation_never_relaunches(self):
        d=self.valid()
        with tempfile.TemporaryDirectory(dir=q.CONTROL,prefix='unit-reservation-') as temp:
            (Path(temp)/'launch.json').write_text('UNIT-TEST-RESERVATION-ONLY')
            with mock.patch.object(q,'CONTROL',Path(temp)),mock.patch.object(q,'validate_declaration'),mock.patch.object(q,'process_identity') as inspected,mock.patch.object(q.subprocess,'Popen') as launched:
                with self.assertRaisesRegex(ValueError,'Single invocation'):q.run(d)
                inspected.assert_not_called();launched.assert_not_called()
    def test_existing_partial_output_is_never_overwritten_or_retried(self):
        with tempfile.TemporaryDirectory(dir=q.CONTROL,prefix='unit-output-') as temp:
            directory=Path(temp);output=directory/'partial';output.mkdir();(output/'proof.txt').write_text('PRESERVE')
            watcher=mock.Mock();watcher.seen={};watcher.refresh.return_value=[]
            d=self.valid()
            with mock.patch.object(q,'CONTROL',directory),mock.patch.object(q,'OUTPUT',output),mock.patch.object(q,'validate_declaration'),mock.patch.object(q,'Watch',return_value=watcher),mock.patch.object(q,'now',return_value=q.QUIET),mock.patch.object(q,'plan',return_value={'selected':['unit']}),mock.patch.object(q.subprocess,'Popen') as launched:
                with self.assertRaisesRegex(ValueError,'must be fresh'):q.run(d)
                launched.assert_not_called();self.assertEqual((output/'proof.txt').read_text(),'PRESERVE')
    def test_actual_authorization_and_all_four_roles_required(self):
        q.validate_declaration(self.valid(),False)
        for value in (None,'','   '):
            d=self.valid();d['authorization']=value
            with self.assertRaises(ValueError):q.validate_declaration(d,False)
        for value in (None,{}):
            d=self.valid();d['timedRoots']=value
            with self.assertRaises(ValueError):q.validate_declaration(d,False)
        d=self.valid();del d['timedRoots']['r12-samples']
        with self.assertRaises(ValueError):q.validate_declaration(d,False)
    def test_null_or_incomplete_descendants_never_authorize(self):
        for field,value in [('root',None),('descendants',None),('completeObservedDescendants',False)]:
            d=self.valid();d['timedRoots']['main-native'][field]=value
            with self.assertRaises(ValueError):q.validate_declaration(d,False)
    def test_duplicate_and_miskeyed_process_bindings_reject(self):
        d=self.valid();d['timedRoots']['main-native']['descendants']={'50':fake_binding(51)}
        with self.assertRaisesRegex(ValueError,'key'):q.validate_declaration(d,False)
        d=self.valid();d['timedRoots']['main-native']['descendants']={'101':fake_binding(101)}
        with self.assertRaisesRegex(ValueError,'Repeated'):q.validate_declaration(d,False)
    def test_exact_ticks_and_original_command_required(self):
        for binding in ({'pid':1,'startTicks':None,'command':['x']},{'pid':True,'startTicks':'1','command':['x']},{'pid':1,'startTicks':'1','command':[]}):
            with self.assertRaises(ValueError):q.validate_binding(binding)
    def test_quiet_window_never_starts_early(self):
        self.assertEqual(q.window_state(q.QUIET-q.dt.timedelta(microseconds=1),[]),'before-quiet-window')
        self.assertEqual(q.window_state(q.QUIET,[]),'ready')
        self.assertEqual(q.window_state(q.QUIET,[fake_binding(1)]),'timed-work-live')
    def test_deadline_boundaries_block_new_render(self):
        self.assertEqual(q.window_state(q.SOFT-q.dt.timedelta(microseconds=1),[]),'ready')
        self.assertEqual(q.window_state(q.SOFT,[]),'cleanup-only')
        self.assertEqual(q.window_state(q.STOP,[]),'closed')
        d=self.valid();d['absoluteStop']=(q.STOP+q.dt.timedelta(seconds=1)).isoformat()
        with self.assertRaises(ValueError):q.validate_declaration(d,False)
    def test_pid_reuse_and_zombie_do_not_block_but_title_change_does(self):
        b=fake_binding(1)
        self.assertFalse(q.same_live(b,fake_live(fake_binding(1,'8'))))
        self.assertFalse(q.same_live(b,fake_live(b,'Z')))
        self.assertTrue(q.same_live(b,fake_live(b,command=['new title'])))
    def test_surviving_descendant_retained_after_root_exit(self):
        parent,child=fake_binding(1),fake_binding(2)
        current={1:fake_live(parent),2:fake_live(child)}
        watch=q.Watch([parent],current.get,lambda roots:[child] if roots else [])
        self.assertEqual({b['pid'] for b in watch.refresh()},{1,2})
        del current[1]
        self.assertEqual([b['pid'] for b in watch.refresh()],[2])
        del current[2];self.assertEqual(watch.refresh(),[])
        self.assertEqual(len(watch.seen),2)
    def test_new_grandchild_observed_from_retained_child_after_root_exit(self):
        p,c,g=map(fake_binding,(1,2,3));current={1:fake_live(p),2:fake_live(c)}
        def children(roots):return [c]+([g] if 3 in current else [])
        watch=q.Watch([p],current.get,children);watch.refresh();del current[1];current[3]=fake_live(g)
        self.assertEqual({b['pid'] for b in watch.refresh()},{2,3})
    def test_reused_descendant_does_not_release_another_live_descendant(self):
        a,b=fake_binding(1),fake_binding(2)
        watch=q.Watch([a,b],lambda pid:fake_live(fake_binding(pid,'8' if pid==1 else '7')),lambda roots:[])
        self.assertEqual([r['pid'] for r in watch.refresh()],[2])
    def test_permission_error_is_not_mistaken_for_quiet(self):
        def denied(pid):raise PermissionError('UNIT TEST')
        with self.assertRaises(PermissionError):q.Watch([fake_binding(1)],denied,lambda roots:[]).refresh()
    def test_no_cleanup_before_owned_deadline_and_no_early_hard_kill(self):
        b=fake_binding(1);w=q.Watch([b],lambda pid:fake_live(b),lambda roots:[]);sent=[]
        with self.assertRaises(ValueError):q.cleanup_owned(w,q.SOFT-q.dt.timedelta(microseconds=1),signal.SIGTERM,lambda *x:sent.append(x))
        with self.assertRaises(ValueError):q.cleanup_owned(w,q.SOFT,signal.SIGKILL,lambda *x:sent.append(x))
        self.assertEqual(sent,[])
        with self.assertRaises(ValueError):q.cleanup_owned(w,q.HARD-q.dt.timedelta(microseconds=1),signal.SIGKILL,lambda *x:sent.append(x))
        self.assertEqual(sent,[])
        q.cleanup_owned(w,q.HARD,signal.SIGKILL,lambda *x:sent.append(x))
        self.assertEqual(sent,[(1,signal.SIGKILL)])
    def test_cleanup_only_owns_bound_live_identity_no_reused_pids(self):
        a,b=fake_binding(1),fake_binding(2);sent=[]
        w=q.Watch([a,b],lambda pid:fake_live(fake_binding(pid,'8' if pid==1 else '7')),lambda roots:[])
        self.assertEqual(q.cleanup_owned(w,q.STOP,signal.SIGKILL,lambda *x:sent.append(x)),['2:7'])
        self.assertEqual(sent,[(2,signal.SIGKILL)])
    def test_natural_renderer_completion_never_signals(self):
        w=q.Watch([fake_binding(1)],lambda pid:None,lambda roots:[]);child=mock.Mock();child.poll.return_value=0;sent=[]
        result=q.monitor_render(child,w,clock=lambda:q.QUIET,sleep=lambda x:None,record=lambda x:None,emit=lambda *a,**k:None,send=lambda *x:sent.append(x))
        self.assertFalse(result['deadlineInterrupted']);self.assertEqual(sent,[])
    def test_absolute_stop_terms_then_kills_only_owned_render(self):
        b=fake_binding(10);w=q.Watch([b],lambda pid:fake_live(b),lambda roots:[]);child=mock.Mock();child.poll.return_value=None
        clock=iter([q.SOFT,q.STOP]);sent=[]
        result=q.monitor_render(child,w,clock=lambda:next(clock),sleep=lambda x:None,record=lambda x:None,emit=lambda *a,**k:None,send=lambda *x:sent.append(x))
        self.assertTrue(result['deadlineInterrupted']);self.assertTrue(result['hardKillRequested'])
        self.assertEqual(sent,[(10,signal.SIGTERM),(10,signal.SIGKILL)])
    def test_child_exit_waits_for_owned_browser_descendant_until_deadline(self):
        b=fake_binding(11);w=q.Watch([b],lambda pid:fake_live(b),lambda roots:[]);child=mock.Mock();child.poll.return_value=0;sent=[]
        result=q.monitor_render(child,w,clock=lambda:q.STOP,sleep=lambda x:None,record=lambda x:None,emit=lambda *a,**k:None,send=lambda *x:sent.append(x))
        self.assertTrue(result['deadlineInterrupted']);self.assertEqual(len(sent),2)
    def test_single_command_exact_parameters_no_retry(self):
        p={'selected':['first','second'],'ranked':False,'snapshots':['/actual/main','/actual/candidate']}
        cmd=q.render_command(p)
        for arg in ['--ids=first,second','--profile=phone','--size=390x844','--seconds=5','--fps=12','--timeout=90000','--main-url=http://127.0.0.1:4174/','--candidate-url=http://127.0.0.1:4183/']:self.assertIn(arg,cmd)
        self.assertNotIn('--retry',cmd);self.assertEqual(cmd.count('render'),1)
    def test_empty_duplicate_or_ranked_selection_rejects(self):
        for ids,ranked in [([],False),(['same','same'],False),(['x'],True),([str(i) for i in range(11)],False)]:
            with self.assertRaises(ValueError):q.render_command({'selected':ids,'ranked':ranked,'snapshots':['a','b']})
    def test_append_only_preserves_rows_and_every_previous_pair_binding(self):
        p={'observedRows':[{'a':'1'},{}],'provenanceSha256':['a','b'],'bindings':{'a':[1]}}
        c=copy.deepcopy(p);c['observedRows'][0]['b']='2';q.enforce_append(p,c)
        for change in ('remove','alter','artifact','provenance','absent'):
            c=copy.deepcopy(p)
            if change=='remove':c['observedRows'][0]={}
            if change=='alter':c['observedRows'][0]['a']='2'
            if change=='artifact':c['bindings']['a']=[2]
            if change=='provenance':c['provenanceSha256']=['a','c']
            if change=='absent':c={}
            with self.assertRaises(ValueError,msg=change):q.enforce_append(p,c)

class PlannerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory(prefix='review-r12-cpu-fixtures-',dir=q.CONTROL);cls.root=Path(cls.tmp.name)
        cls.main=cls.root/'main';cls.candidate=cls.root/'candidate';cls.main.mkdir();cls.candidate.mkdir()
        base=q.read(q.MAIN/'run.json');candidate=q.read(q.ROOT/'candidate-r8-phone/run.json')
        for directory,source,run in [(cls.main,q.MAIN,base),(cls.candidate,q.ROOT/'candidate-r8-phone',candidate)]:
            row=next(r for r in run['results'] if r['id']=='cat-plays' and r['profile']=='phone');run['results']=[row]
            shutil.copytree(source/'cat-plays-phone',directory/'cat-plays-phone');(directory/'run.json').write_text(json.dumps(run))
        cls.request={'toolsRoot':str(q.TOOLS),'manifest':str(q.MANIFEST),'main':str(cls.main),'candidate':str(cls.candidate),'mainUrl':base['url'],'candidateUrl':candidate['url'],'mainProvenance':base['provenanceSha256']}
    @classmethod
    def tearDownClass(cls):cls.tmp.cleanup()
    def call(self,request=None):return subprocess.run([q.NODE,str(q.PLANNER)],input=json.dumps(request or self.request),text=True,capture_output=True,timeout=60)
    def test_real_copied_case_is_verified_and_unranked(self):
        result=self.call();self.assertEqual(result.returncode,0,result.stderr);p=json.loads(result.stdout)
        self.assertEqual(p['selected'],['cat-plays']);self.assertFalse(p['ranked']);self.assertEqual(len(p['inventory']),20)
    def test_missing_master_returns_no_inferred_rows(self):
        request={**self.request,'candidate':str(self.root/'absent')};result=self.call(request)
        p=json.loads(result.stdout);self.assertEqual(p['status'],'waiting-for-actual-master');self.assertEqual(p['selected'],[]);self.assertNotIn('inventory',p)
    def test_corrupted_png_rejected_without_skip_to_later_pair(self):
        file=self.candidate/'cat-plays-phone/render-0.png';old=file.read_bytes()
        try:file.write_bytes(bytes([old[0]^1])+old[1:]);self.assertNotEqual(self.call().returncode,0)
        finally:file.write_bytes(old)
    def test_corrupted_model_is_rejected(self):
        file=self.candidate/'cat-plays-phone/model.ply';old=file.read_bytes()
        try:file.write_bytes(bytes([old[0]^1])+old[1:]);self.assertNotEqual(self.call().returncode,0)
        finally:file.write_bytes(old)
    def test_missing_saved_render_is_rejected(self):
        file=self.candidate/'cat-plays-phone/render-1.png';old=file.read_bytes()
        try:file.unlink();self.assertNotEqual(self.call().returncode,0)
        finally:file.write_bytes(old)
    def test_false_finished_status_or_incomplete_proof_not_selected(self):
        file=self.candidate/'run.json';old=file.read_bytes();run=json.loads(old);run['results'][0]['heldoutEvidence']['complete']=False
        try:
            file.write_text(json.dumps(run));result=self.call();self.assertEqual(result.returncode,0,result.stderr);self.assertEqual(json.loads(result.stdout)['selected'],[])
        finally:file.write_bytes(old)
    def test_same_reference_required(self):
        file=self.candidate/'run.json';old=file.read_bytes();run=json.loads(old);run['results'][0]['frames'][0]['referenceSha256']='0'*64
        try:
            file.write_text(json.dumps(run));result=self.call();self.assertEqual(result.returncode,0,result.stderr);self.assertEqual(json.loads(result.stdout)['selected'],[])
        finally:file.write_bytes(old)
    def test_wrong_candidate_provenance_fails(self):
        result=self.call({**self.request,'candidateProvenance':'0'*64});self.assertNotEqual(result.returncode,0);self.assertIn('provenance',result.stderr)
    def test_score_independent_first_ten_not_ranked(self):
        script="""import {selectFirstPairs} from '/workspace/v3d-r4-media/plan-r12-review-r1.mjs';
        const rows=Array.from({length:15},(_,i)=>({id:'unit-'+i,paired:i!==1,score:100-i}));
        const before=selectFirstPairs(rows); rows.forEach(r=>r.score=-r.score); const after=selectFirstPairs(rows);
        console.log(JSON.stringify({before,after}));"""
        result=subprocess.run([q.NODE,'--input-type=module','-e',script],text=True,capture_output=True,timeout=30)
        self.assertEqual(result.returncode,0,result.stderr);p=json.loads(result.stdout)
        self.assertEqual(p['before'],['unit-0',*[f'unit-{i}' for i in range(2,11)]]);self.assertEqual(p['before'],p['after'])
if __name__=='__main__':unittest.main(verbosity=2)
