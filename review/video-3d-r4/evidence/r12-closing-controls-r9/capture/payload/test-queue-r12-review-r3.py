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

spec=importlib.util.spec_from_file_location('queue_review','/workspace/v3d-r4-media/queue-r12-review-r3.py')
q=importlib.util.module_from_spec(spec);spec.loader.exec_module(q)
if q.read(q.CONTROL/'declaration.json').get('status')!='prepared-awaiting-root-bindings':
    raise RuntimeError('Preparation-only CPU suite refuses finalized/live configuration; use --check without rerunning this suite.')
def fake_binding(pid,ticks='7'):
    return {'pid':pid,'startTicks':ticks,'command':['UNIT-TEST-FAKE-NOT-OBSERVED']}
def fake_live(binding,state='S',**extra):return {**binding,'state':state,**extra}
def fake_takeover():
    value={'generation':'R12-review-r3-takeover','capturedAt':'2026-10-15T14:00:00+00:00','retiredAt':'2026-10-15T14:00:00+00:00',
           'priorWatcher':{'pid':q.EXPECTED_PRIOR_WATCHER_PID,'startTicks':'7','command':['UNIT-TEST-FAKE',str(q.ROOT/'queue-r12-review-r1.py')]}}
    value.update({field:True for field in ('retiredByRoot','priorWatcherObservedEnded','onlyPriorWatcherRetired','timedRootsNotSignaled','noR1RenderReservation','noR1RenderOutput')})
    value.update({field:'c'*64 for field in ('r1DeclarationSha256','r1RootReceiptSha256','r1RetiredQuietStateSha256')});return value
class GuardTests(unittest.TestCase):
    def draft(self):return q.read(q.CONTROL/'declaration.json')
    def valid(self):
        d=self.draft();d.update(status='root-authorized',authorization='UNIT TEST ONLY',
              candidateProvenanceSha256=q.EXPECTED_CANDIDATE_PROVENANCE,candidateServedSourceSha256=q.EXPECTED_CANDIDATE_SOURCE,rootReceiptSha256='c'*64,
              takeover=fake_takeover(),takeoverReceiptSha256='c'*64,retiredR1QuietStateSha256='c'*64,
              extraQuietBlockers=[],extraQuietInventoryComplete=True,
              timedRoots={role:{'root':fake_binding(100+i),'descendants':{},'completeObservedDescendants':True} for i,role in enumerate(q.ROLES)})
        d['timedRoots']['postmerge-samples']['root']['command'].append(str(q.ROOT/'run-postmerge-samples-r1.py'))
        files=[Path(q.__file__).resolve(),q.PLANNER,q.ROOT/'test-queue-r12-review-r3.py',q.REVIEW,q.MANIFEST,q.CONTROL/'root-timed-work-receipt.json',q.CONTROL/'cpu-tests.log']
        files += [q.TOOLS/'tools'/name for name in ('v3d-bench.mjs','v3d-bench-metrics.mjs','v3d-bench-samples.mjs','v3d-bench-pixels.mjs','cdx-v3d-clarity-metrics.mjs')]
        files += [q.CONTROL/name for name in ('root-takeover-receipt.json','r1-quiet-at-retirement.json','r1-history/declaration-snapshot.json','r1-history/root-receipt-snapshot.json','r1-history/quiet-state-preparation-snapshot.json')]
        files += [q.CONTROL/'negative-r1'/name for name in ('original-queue-launch.json','root-exit-observation.json','watcher-error.log')]
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
            with mock.patch.object(q,'CONTROL',directory),mock.patch.object(q,'OUTPUT',output),mock.patch.object(q,'validate_declaration'),mock.patch.object(q,'assert_takeover_ready'),mock.patch.object(q,'historical_bindings',return_value=[]),mock.patch.object(q,'Watch',return_value=watcher),mock.patch.object(q,'now',return_value=q.QUIET),mock.patch.object(q,'plan',return_value={'selected':['unit']}),mock.patch.object(q.subprocess,'Popen') as launched:
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

class TakeoverTests(unittest.TestCase):
    draft=GuardTests.draft
    valid=GuardTests.valid
    def test_fifth_postmerge_role_cannot_be_missing(self):
        d=self.valid();del d['timedRoots']['postmerge-samples']
        with self.assertRaisesRegex(ValueError,'five'):q.validate_declaration(d,False)
    def test_extra_sixth_root_is_rejected(self):
        d=self.valid();d['timedRoots']['unbound-extra']={'root':fake_binding(900),'descendants':{},'completeObservedDescendants':True}
        with self.assertRaisesRegex(ValueError,'extra'):q.validate_declaration(d,False)
    def test_fifth_root_cannot_duplicate_original_identity(self):
        d=self.valid();d['timedRoots']['postmerge-samples']['root']=copy.deepcopy(d['timedRoots']['main-native']['root'])
        d['timedRoots']['postmerge-samples']['root']['command'].append(str(q.ROOT/'run-postmerge-samples-r1.py'))
        with self.assertRaisesRegex(ValueError,'Repeated'):q.validate_declaration(d,False)
    def test_fifth_descendant_cannot_alias_another_role_root(self):
        d=self.valid();d['timedRoots']['postmerge-samples']['descendants']={'100':fake_binding(100)}
        with self.assertRaisesRegex(ValueError,'Repeated'):q.validate_declaration(d,False)
    def test_reused_pid_distinct_ticks_remains_a_distinct_live_fifth_root(self):
        d=self.valid();old=d['timedRoots']['main-native']['root'];fresh=fake_binding(old['pid'],'8');d['timedRoots']['postmerge-samples']['root']=fresh
        fresh['command'].append(str(q.ROOT/'run-postmerge-samples-r1.py'))
        q.validate_declaration(d,False)
        w=q.Watch([old,fresh],lambda pid:fake_live(fresh),lambda roots:[])
        self.assertEqual([q.identity_key(b) for b in w.refresh()],['100:8'])
        self.assertEqual(q.window_state(q.QUIET,w.refresh()),'timed-work-live')
    def test_missing_or_unretired_takeover_cannot_authorize(self):
        d=self.valid();d['takeover']=None
        with self.assertRaisesRegex(ValueError,'takeover'):q.validate_declaration(d,False)
        for field in ('retiredByRoot','priorWatcherObservedEnded','onlyPriorWatcherRetired','timedRootsNotSignaled','noR1RenderReservation','noR1RenderOutput'):
            d=self.valid();d['takeover'][field]=False
            with self.assertRaisesRegex(ValueError,'condition'):q.validate_declaration(d,False)
    def test_wrong_watcher_or_command_is_rejected(self):
        for field,value in [('pid',123),('command',['different-watcher'])]:
            t=fake_takeover();t['priorWatcher'][field]=value
            with self.assertRaisesRegex(ValueError,'exact'):q.validate_takeover(t)
    def test_active_r1_watcher_blocks_even_with_changed_title(self):
        d=self.valid();binding=d['takeover']['priorWatcher']
        with tempfile.TemporaryDirectory(dir=q.CONTROL,prefix='unit-r1-live-') as directory:
            with self.assertRaisesRegex(ValueError,'still alive'):
                q.assert_takeover_ready(d,identity=lambda pid:fake_live(binding,command=['changed title']),prior=directory,output=Path(directory)/'absent')
    def test_retired_watcher_pid_reuse_and_zombie_do_not_block(self):
        d=self.valid();binding=d['takeover']['priorWatcher']
        with tempfile.TemporaryDirectory(dir=q.CONTROL,prefix='unit-r1-gone-') as directory:
            for observed in (None,fake_live({**binding,'startTicks':'8'}),fake_live(binding,'Z')):
                q.assert_takeover_ready(d,identity=lambda pid:observed,prior=directory,output=Path(directory)/'absent')
    def test_r1_reservation_or_output_blocks_takeover_without_inspection(self):
        with tempfile.TemporaryDirectory(dir=q.CONTROL,prefix='unit-r1-reserved-') as directory:
            directory=Path(directory);file=directory/'launch.json';file.write_text('PRESERVE');inspected=mock.Mock()
            with self.assertRaisesRegex(ValueError,'reserved'):q.assert_takeover_ready(self.valid(),identity=inspected,prior=directory,output=directory/'absent')
            inspected.assert_not_called();self.assertEqual(file.read_text(),'PRESERVE');file.unlink()
            output=directory/'shared-output';output.mkdir()
            with self.assertRaises(ValueError):q.assert_takeover_ready(self.valid(),identity=inspected,prior=directory,output=output)
            inspected.assert_not_called()
    def test_retired_history_cannot_drop_a_previously_observed_descendant(self):
        d=self.valid();old={role:d['timedRoots'][role] for role in q.ORIGINAL_ROLES};child=fake_binding(999)
        before={'observedBindings':[child]}
        with self.assertRaisesRegex(ValueError,'dropped'):q.validate_retired_history(d['timedRoots'],before,{'observedBindings':[]},old)
        q.validate_retired_history(d['timedRoots'],before,{'observedBindings':[child,fake_binding(1000)]},old)
        with tempfile.TemporaryDirectory(dir=q.CONTROL,prefix='unit-retired-snapshot-') as directory:
            file=Path(directory)/'quiet-state.json';file.write_text('UNIT TEST FINAL SNAPSHOT')
            q.assert_retired_quiet_hash(q.digest(file.read_bytes()),directory)
            with self.assertRaisesRegex(ValueError,'actual final'):q.assert_retired_quiet_hash('0'*64,directory)
    def test_original_four_roots_cannot_be_replaced_during_rebinding(self):
        d=self.valid();old=copy.deepcopy(d['timedRoots']);d['timedRoots']['main-native']['root']=fake_binding(999)
        with self.assertRaisesRegex(ValueError,'replaced'):q.validate_retired_history(d['timedRoots'],{'observedBindings':[]},{'observedBindings':[]},old)
    def test_retained_r1_child_blocks_after_all_original_roots_exit(self):
        child=fake_binding(990);d=self.valid()
        bound=[row['root'] for row in d['timedRoots'].values()]+[child]
        w=q.Watch(bound,lambda pid:fake_live(child) if pid==990 else None,lambda roots:[])
        self.assertEqual([b['pid'] for b in w.refresh()],[990]);self.assertEqual(q.window_state(q.QUIET,w.refresh()),'timed-work-live')
    def test_postmerge_source_cannot_replace_frozen64ec_replay_source(self):
        request=q.planner_request(self.draft())
        self.assertEqual(request['candidateProvenance'],q.EXPECTED_CANDIDATE_PROVENANCE)
        self.assertEqual(request['candidateServedSource'],q.EXPECTED_CANDIDATE_SOURCE)
        for key in ('candidateProvenanceSha256','candidateServedSourceSha256'):
            d=self.valid();d[key]='0'*64
            with self.assertRaisesRegex(ValueError,'same frozen64ec'):q.validate_declaration(d,False)
    def test_fifth_role_cannot_bind_only_the_native_sample_child(self):
        d=self.valid();d['timedRoots']['postmerge-samples']['root']['command']=['node','tools/v3d-bench.mjs','samples']
        with self.assertRaisesRegex(ValueError,'controller root'):q.validate_declaration(d,False)

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
        script="""import {selectFirstPairs} from '/workspace/v3d-r4-media/plan-r12-review-r3.mjs';
        const rows=Array.from({length:15},(_,i)=>({id:'unit-'+i,paired:i!==1,score:100-i}));
        const before=selectFirstPairs(rows); rows.forEach(r=>r.score=-r.score); const after=selectFirstPairs(rows);
        console.log(JSON.stringify({before,after}));"""
        result=subprocess.run([q.NODE,'--input-type=module','-e',script],text=True,capture_output=True,timeout=30)
        self.assertEqual(result.returncode,0,result.stderr);p=json.loads(result.stdout)
        self.assertEqual(p['before'],['unit-0',*[f'unit-{i}' for i in range(2,11)]]);self.assertEqual(p['before'],p['after'])
def fake_stat(pid=1,ticks='7',state='S'):
    return {'pid':pid,'startTicks':ticks,'state':state,'ppid':0,'session':1}
def fake_unresolved(pid=1,ticks='7',stable=True):
    return {**fake_stat(pid,ticks),'command':[],'unresolved':True,'identityStable':stable,'issue':'UNIT-TEST-active-empty'}
def fake_observed_takeover():
    t=fake_takeover();t.update(kind='observed-ended',retiredAt=None,retiredByRoot=False,onlyPriorWatcherRetired=False,rootRetirementClaim=False,signalsSentByRoot=[],
        watcherObservation={'pid':q.EXPECTED_PRIOR_WATCHER_PID,'startTicks':'7','state':'Z','kernelRawExitCode':256},
        r1ErrorLogSha256='a'*64,r1OriginalLaunchSha256='b'*64,r1ExitObservationSha256='d'*64)
    return t
class StableObservationTests(unittest.TestCase):
    def observe(self,stats,commands,retries=3):
        a=iter(stats);b=iter(commands)
        def call(values):
            value=next(values)
            if isinstance(value,Exception):raise value
            return value
        return q.process_identity(1,lambda pid:call(a),lambda pid:call(b),retries)
    def test_exit_between_stat_and_command_is_terminal_not_empty_binding(self):
        row=self.observe([fake_stat(),fake_stat(state='Z')],[b''])
        self.assertEqual(row['state'],'Z');self.assertEqual(row['command'],[]);self.assertFalse(q.is_unresolved(row))
    def test_missing_after_command_is_ended(self):
        self.assertIsNone(self.observe([fake_stat(),FileNotFoundError()],[b'']))
    def test_pid_reuse_retries_and_reads_actual_new_command(self):
        row=self.observe([fake_stat(),fake_stat(ticks='8'),fake_stat(ticks='8'),fake_stat(ticks='8')],[b'OLD\0',b'NEW\0'])
        self.assertEqual(row['startTicks'],'8');self.assertEqual(row['command'],['NEW'])
    def test_unstable_generation_never_proves_quiet_or_binding(self):
        row=self.observe([fake_stat(ticks=str(i)) for i in range(6)],[b'X\0']*3)
        self.assertTrue(q.is_unresolved(row));self.assertFalse(row['identityStable']);self.assertEqual(row['command'],[])
    def test_active_empty_is_unresolved_after_finite_retries(self):
        row=self.observe([fake_stat()]*6,[b'']*3)
        self.assertTrue(q.is_unresolved(row));self.assertTrue(row['identityStable']);self.assertEqual(row['issue'],'active-empty-command')
    def test_transient_empty_recovers_without_fabricated_command(self):
        row=self.observe([fake_stat()]*4,[b'',b'ACTUAL\0--flag\0'])
        self.assertEqual(row['command'],['ACTUAL','--flag']);self.assertFalse(q.is_unresolved(row))
    def test_active_permission_error_is_unresolved(self):
        row=self.observe([fake_stat()]*6,[PermissionError()]*3)
        self.assertTrue(q.is_unresolved(row));self.assertEqual(row['command'],[])
    def test_stat_permission_error_never_claims_stable_identity(self):
        row=self.observe([PermissionError()]*3,[])
        self.assertTrue(q.is_unresolved(row));self.assertFalse(row['identityStable']);self.assertIsNone(row['startTicks'])
    def test_pending_child_is_retained_after_parent_exit(self):
        parent=fake_binding(1);current={1:fake_live(parent),2:fake_unresolved(2)}
        w=q.Watch([parent],current.get,lambda roots:[{**fake_unresolved(2),'expectedStartTicks':'7'}] if roots else [])
        w.refresh();self.assertTrue(w.has_unresolved);self.assertNotIn('2:7',w.seen)
        del current[1];w.refresh();self.assertTrue(w.has_unresolved)
        current[2]=fake_live(fake_binding(2));self.assertEqual([b['pid'] for b in w.refresh()],[2]);self.assertFalse(w.has_unresolved)
    def test_pending_reused_pid_is_not_adopted(self):
        current={2:fake_unresolved(2)};w=q.Watch([],current.get,lambda roots:[]);w._pending(current[2],'7')
        current[2]=fake_live(fake_binding(2,'8'));self.assertEqual(w.refresh(),[]);self.assertFalse(w.has_unresolved);self.assertEqual(w.seen,{})
    def test_pending_death_clears_only_after_actual_observation(self):
        w=q.Watch([],lambda pid:None,lambda roots:[]);w._pending(fake_unresolved(2),'7')
        self.assertTrue(w.has_unresolved);self.assertEqual(w.refresh(),[]);self.assertFalse(w.has_unresolved)
    def test_known_binding_empty_command_blocks_quiet_without_crashing(self):
        w=q.Watch([fake_binding(1)],lambda pid:fake_unresolved(),lambda roots:[])
        live=w.refresh();self.assertEqual(w.seen['1:7']['command'],['UNIT-TEST-FAKE-NOT-OBSERVED'])
        self.assertEqual(q.window_state(q.QUIET,live,w.has_unresolved),'process-observation-unresolved')
    def test_zombie_discovery_never_creates_an_empty_binding(self):
        w=q.Watch([],lambda pid:None,lambda roots:[{**fake_stat(state='Z'),'command':[]}])
        self.assertEqual(w.refresh(),[]);self.assertEqual(w.seen,{})
    def test_unresolved_prior_watcher_cannot_authorize(self):
        d={'takeover':fake_observed_takeover()}
        with tempfile.TemporaryDirectory(dir=q.CONTROL) as temp:
            with self.assertRaisesRegex(ValueError,'unresolved'):
                q.assert_takeover_ready(d,identity=lambda pid:fake_unresolved(pid),prior=temp,output=Path(temp)/'absent')
    def test_graphics_classifier_covers_browser_helpers_and_media_tools(self):
        for exe in ('/usr/lib/chromium/chromium','/opt/chrome/chrome','chrome-headless-shell','chrome-sandbox','google-chrome-beta','ffmpeg','ffprobe'):
            self.assertTrue(q.graphics_command([exe,'--type=renderer']),exe)
        for exe in ('chrome_crashpad_handler','/opt/chrome/chrome_crashpad_handler','python3','node'):
            self.assertFalse(q.graphics_command([exe]),exe)
    def test_global_scanner_retains_unattributed_and_excludes_crashpad_only(self):
        rows={1:fake_live({**fake_binding(1),'command':['chromium','--type=gpu-process']}),2:fake_live({**fake_binding(2),'command':['chrome_crashpad_handler']}),3:fake_live({**fake_binding(3),'command':['ffprobe']}),4:fake_live({**fake_binding(4),'command':['node']}),5:fake_live({**fake_binding(5),'command':['chrome']},'Z')}
        result=q.scan_graphics_blockers(lambda:list(rows),rows.get)
        self.assertEqual([r['pid'] for r in result['observations']],[1,3])
    def test_global_unknown_active_process_blocks_quiet(self):
        result=q.scan_graphics_blockers(lambda:[2],lambda pid:fake_unresolved(2))
        w=q.Watch([],lambda pid:fake_unresolved(2),lambda roots:[],read_only=True,global_blockers=lambda:result)
        self.assertEqual(w.refresh(),[]);self.assertTrue(w.has_unresolved)
        self.assertNotEqual(q.window_state(q.QUIET,[],w.has_unresolved),'ready')
    def test_global_new_orphan_is_observed_and_retained_after_scan_gap(self):
        child=fake_binding(8);current={8:fake_live(child)};available=[fake_live(child)]
        w=q.Watch([],current.get,lambda roots:[],read_only=True,global_blockers=lambda:{'observations':list(available),'enumerationUnresolved':[]})
        self.assertEqual(w.refresh(),[child]);available.clear();self.assertEqual(w.refresh(),[child]);del current[8];self.assertEqual(w.refresh(),[])
    def test_global_scan_rechecks_on_every_refresh(self):
        current={};g=mock.Mock(return_value={'observations':[],'enumerationUnresolved':[]});w=q.Watch([],current.get,lambda roots:[],read_only=True,global_blockers=g)
        w.refresh();current[9]=fake_live(fake_binding(9));g.return_value['observations']=[current[9]]
        self.assertEqual(w.refresh(),[fake_binding(9)]);self.assertEqual(g.call_count,2)
    def test_global_enumeration_failure_is_retryable_unresolved(self):
        def denied():raise PermissionError('UNIT TEST')
        result=q.scan_graphics_blockers(denied,lambda pid:None)
        self.assertEqual(result['observations'],[]);self.assertEqual(result['enumerationUnresolved'][0]['issue'],'PermissionError')
        g=mock.Mock(return_value=result);w=q.Watch([],lambda pid:None,lambda roots:[],read_only=True,global_blockers=g)
        w.refresh();self.assertTrue(w.has_unresolved)
        g.return_value={'observations':[],'enumerationUnresolved':[]};w.refresh();self.assertFalse(w.has_unresolved)
    def test_global_reused_pid_does_not_end_old_surviving_other_blocker(self):
        a,b=fake_binding(1),fake_binding(2);current={1:fake_live(fake_binding(1,'8')),2:fake_live(b)}
        w=q.Watch([a,b],current.get,lambda roots:[],read_only=True,global_blockers=lambda:{'observations':[],'enumerationUnresolved':[]})
        self.assertEqual(w.refresh(),[b]);self.assertEqual(q.window_state(q.QUIET,w.refresh()),'timed-work-live')
    def test_quiet_gate_rechecks_after_plan_before_single_spawn(self):
        import ast
        tree=ast.parse(Path(q.__file__).read_text());run=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='run')
        loop=next(n for n in ast.walk(run) if isinstance(n,ast.While))
        plan_call=next(n for n in ast.walk(loop) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='plan')
        checks=[n for n in ast.walk(loop) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr=='refresh']
        self.assertTrue(any(n.lineno<plan_call.lineno for n in checks));self.assertTrue(any(n.lineno>plan_call.lineno for n in checks))
    def test_read_only_blocker_watch_can_never_signal(self):
        b=fake_binding(1);w=q.Watch([b],lambda pid:fake_live(b),lambda roots:[],read_only=True);send=mock.Mock()
        with self.assertRaisesRegex(ValueError,'Read-only'):q.cleanup_owned(w,q.HARD,signal.SIGKILL,send)
        send.assert_not_called()
    def test_unresolved_unstable_identity_cannot_be_signaled(self):
        w=q.Watch([fake_binding(1)],lambda pid:fake_unresolved(stable=False),lambda roots:[]);send=mock.Mock()
        self.assertEqual(q.signal_owned(w,signal.SIGTERM,send),[]);send.assert_not_called()
    def test_unreadable_enumeration_blocks_quiet_without_inventing_binding(self):
        w=q.Watch([],lambda pid:None,lambda roots:{'observations':[],'enumerationUnresolved':[{'pid':7,'issue':'PermissionError'}]})
        self.assertEqual(w.refresh(),[]);self.assertTrue(w.has_unresolved);self.assertEqual(w.seen,{})
class ObservedEndedTests(unittest.TestCase):
    def test_observed_ended_accepts_actual_zombie_without_retirement_claim(self):q.validate_takeover(fake_observed_takeover())
    def test_observed_ended_rejects_retirement_or_signal_claim(self):
        for key,value in [('retiredByRoot',True),('rootRetirementClaim',True),('signalsSentByRoot',[15]),('retiredAt','2026-10-15T14:00:00Z'),('onlyPriorWatcherRetired',True)]:
            t=fake_observed_takeover();t[key]=value
            with self.assertRaisesRegex(ValueError,'no root retirement'):q.validate_takeover(t)
    def test_observed_ended_requires_matching_actual_zombie_identity(self):
        for key,value in [('pid',1),('startTicks','8'),('state','S'),('kernelRawExitCode',None)]:
            t=fake_observed_takeover();t['watcherObservation'][key]=value
            with self.assertRaisesRegex(ValueError,'zombie'):q.validate_takeover(t)
    def test_observed_ended_requires_error_launch_and_exit_hashes(self):
        for key in ('r1ErrorLogSha256','r1OriginalLaunchSha256','r1ExitObservationSha256'):
            t=fake_observed_takeover();t[key]=None
            with self.assertRaises(ValueError):q.validate_takeover(t)
    def test_unknown_takeover_kind_cannot_bypass_old_flags(self):
        t=fake_takeover();t['kind']='maybe-ended'
        with self.assertRaisesRegex(ValueError,'Unknown'):q.validate_takeover(t)
    def test_actual_saved_negative_evidence_binds_without_process_inspection(self):
        directory=q.CONTROL/'negative-r1';launch=(directory/'original-queue-launch.json').read_bytes();ended=(directory/'root-exit-observation.json').read_bytes();error=(directory/'watcher-error.log').read_bytes();receipt=json.loads(ended)
        t=fake_observed_takeover();t.update(priorWatcher={**receipt['actualKernelObservation'],'command':receipt['originalCommandFromLaunchReceipt']},watcherObservation=receipt['actualKernelObservation'],r1ErrorLogSha256=q.digest(error),r1OriginalLaunchSha256=q.digest(launch),r1ExitObservationSha256=q.digest(ended),r1RetiredQuietStateSha256=receipt['lastQuietSha256'])
        with mock.patch.object(q,'process_identity') as inspected:q.validate_takeover(t);q.validate_observed_ended_evidence(t,launch,ended,error);inspected.assert_not_called()
        with self.assertRaisesRegex(ValueError,'hash'):q.validate_observed_ended_evidence(t,launch,ended,error+b'CORRUPTION')
        bad=json.loads(launch);bad['pid']=1;raw=json.dumps(bad).encode();t['r1OriginalLaunchSha256']=q.digest(raw)
        with self.assertRaisesRegex(ValueError,'PID/command'):q.validate_observed_ended_evidence(t,raw,ended,error)
    def test_extra_blockers_require_explicit_complete_inventory(self):
        roots=GuardTests().valid()['timedRoots']
        for rows,complete in ((None,True),([],False),([],None)):
            with self.assertRaisesRegex(ValueError,'inventory'):q.validate_extra_blockers(rows,complete,roots)
        q.validate_extra_blockers([],True,roots)
    def test_extra_blockers_are_actual_read_only_unique_and_timestamped(self):
        roots=GuardTests().valid()['timedRoots'];row={'root':fake_binding(999),'descendants':{},'completeObservedDescendants':True,'readOnly':True,'reason':'UNIT-TEST-ROOT-OBSERVATION','capturedAt':'UNIT-TEST'}
        q.validate_extra_blockers([row],True,roots)
        for key,value in [('readOnly',False),('root',None),('capturedAt',None),('reason',None)]:
            bad={**row,key:value}
            with self.assertRaises(ValueError):q.validate_extra_blockers([bad],True,roots)
        with self.assertRaisesRegex(ValueError,'Repeated'):q.validate_extra_blockers([row,row],True,roots)
    def test_runtime_separates_global_discovery_from_owned_renderer(self):
        import ast
        tree=ast.parse(Path(q.__file__).read_text());run=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='run')
        calls=[n for n in ast.walk(run) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='Watch']
        self.assertEqual(len(calls),2)
        quiet=next(n for n in calls if any(k.arg=='global_blockers' for k in n.keywords));self.assertTrue(next(k.value.value for k in quiet.keywords if k.arg=='read_only'))
        owned=next(n for n in calls if n is not quiet);self.assertFalse(any(k.arg in ('global_blockers','read_only') for k in owned.keywords))
if __name__=='__main__':unittest.main(verbosity=2)
