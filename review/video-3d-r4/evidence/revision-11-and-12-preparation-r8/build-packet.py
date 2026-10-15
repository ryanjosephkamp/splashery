#!/usr/bin/env python3
"""MIT. Made by Ryan with Codex (GPT-6). Exact-byte completed-evidence packet builder."""
import datetime as dt
import gzip
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import re
import subprocess
import sys
sys.dont_write_bytecode=True

ROOT=Path('/workspace/v3d-r4-media')
PACKET=Path(__file__).resolve().parent
R11=Path('/workspace/splashery-v3d-bench-tools-r11')
PUBLIC=Path('/workspace/splashery-r4-public')
R11_COMMIT='636a7605fd15f3aa1e41d43cc6b5ff35432750b6'
WIRING_COMMIT='64ec9ad5b7a90b590b289f6a02f0bbd50138db08'
NODE='/opt/codex/runtimes/codex-primary-runtime/dependencies/node/bin/node'
def hash_bytes(value):return hashlib.sha256(value).hexdigest()
def stamp():return dt.datetime.now(dt.timezone.utc).isoformat()
def js(value):return (json.dumps(value,indent=2,ensure_ascii=False)+'\n').encode()
def gzip_bytes(value):
    target=io.BytesIO()
    with gzip.GzipFile(filename='',mode='wb',fileobj=target,mtime=0,compresslevel=9) as stream:stream.write(value)
    return target.getvalue()
def text_bytes(value):
    if b'\x00' in value:return False
    try:value.decode('utf8');return True
    except UnicodeDecodeError:return False

def main():
    if (PACKET/'payload').exists() or (PACKET/'mappings.jsonl.gz').exists():raise ValueError('Fresh packet payload required; preserve prior outputs.')
    rows=[];source_inventory=[];directories=[];known=set()
    def add(value,relative,source,readable=False):
        if relative in known:raise ValueError('Duplicate logical path: '+relative)
        known.add(relative)
        encoded=gzip_bytes(value)
        suffix=Path(relative).suffix.lower()
        image=suffix in ('.png','.jpg','.jpeg','.webp','.gif','.avif')
        machine_trace='/test-results/.playwright-artifacts-' in '/'+relative
        machine=suffix in ('.log','.jsonl','.trace','.network') or (suffix=='.json' and len(value)>=16384) or machine_trace
        compressed=(image and len(value)>1000000) or (not readable and machine and len(encoded)<len(value))
        # Repeated raw models/gradient arrays and other machine binaries are losslessly archived.
        if not readable and not text_bytes(value) and len(value)>=16384 and suffix!='.gz' and len(encoded)+64<len(value):compressed=True
        stored_relative='payload/'+relative+('.gz' if compressed else '')
        destination=PACKET/stored_relative;destination.parent.mkdir(parents=True,exist_ok=True)
        destination.write_bytes(encoded if compressed else value)
        stored=destination.read_bytes()
        row={'type':'file','source':source,'restoredPath':relative,'storedPath':stored_relative,'encoding':'gzip' if compressed else 'identity','originalBytes':len(value),'originalSha256':hash_bytes(value),'storedBytes':len(stored),'storedSha256':hash_bytes(stored)}
        if (gzip.decompress(stored) if compressed else stored)!=value:raise ValueError('Immediate byte restoration failed.')
        rows.append(row)
    def file(source,relative=None,readable=False):
        source=Path(source)
        if source.is_symlink() or not source.is_file():raise ValueError('Only actual regular source files: '+str(source))
        value=source.read_bytes();sha=hash_bytes(value)
        add(value,relative or str(source.relative_to(ROOT)),str(source),readable)
        source_inventory.append({'source':str(source),'bytes':len(value),'sha256':sha})
    def tree(source,relative=None):
        source=Path(source);relative=relative or str(source.relative_to(ROOT));before=[]
        for item in sorted(source.rglob('*')):
            if item.is_symlink():raise ValueError('No symlink in frozen evidence: '+str(item))
            logical=relative+'/'+str(item.relative_to(source))
            if item.is_dir():rows.append({'type':'directory','source':str(item),'restoredPath':logical});before.append((str(item.relative_to(source)),'directory',None))
            elif item.is_file():
                file(item,logical,readable=item.suffix.lower() in ('.py','.mjs','.js','.md','.txt') and '/test-results/' not in str(item))
                before.append((str(item.relative_to(source)),'file',hash_bytes(item.read_bytes())))
            else:raise ValueError('Special frozen evidence file.')
        directories.append((source,before))

    # Completed R11 native cohort and separately authorized, completed R12 sample proof.
    for name in ['follow-r11-final-reconcile-r1-control','candidate-r11-final-reconcile-snapshots-r1/0001','candidate-r11-v1-shards','samples-r11-r1','samples-r12-r1','background-shrink-preparation-r1','background-shrink-preparation-r2','background-shrink-integrated-evidence-r1','r11-regressions-interrupted-r1','r11-regressions-tail-repeat-r1','r11-calibration-isolated-r1','original-spec-byte-audit-r3']:tree(ROOT/name)
    for name in ['r11-regressions-coverage-r1.json','samples-r11-launch.json','runtime-r11-freeze.json','samples-r12-launch.json','samples-r12-completion-observation-r1.json','runtime-r12-freeze.json','reconcile-r11-final-r1.py','resume-r11-regression-tail-r1.py']:file(ROOT/name)
    for source,name in [('/tmp/v3d-r4-samples-r11-r1.log','samples-r11-r1.log'),('/tmp/v3d-r4-samples-r12-r1.log','samples-r12-r1.log'),('/tmp/v3d-r4-background-shrink-gpu-r1.log','background-shrink-gpu-r1.log'),('/tmp/v3d-r4-background-shrink-gpu-r2.log','background-shrink-gpu-r2.log')]:file(source,'logs/'+name)
    for name in ['LICENSE','LICENSES.md','CREDITS.md','tools/assets.json','tools/models.json','src/video3d/samples.js','tools/v3d-corpus.json','tools/v3d-bench.mjs','tools/v3d-bench-metrics.mjs','tools/v3d-bench-samples.mjs','tools/v3d-bench-pixels.mjs','tools/cdx-v3d-clarity-metrics.mjs','vendor/splatjs/LICENSE']:
        file(R11/name,'source-r11/'+name,readable=Path(name).suffix in ('.md','.js','.mjs') or name.endswith('LICENSE'))
    file(R11/'LICENSE','LICENSE',readable=True)
    sample_script="import {SAMPLES} from '/workspace/splashery-v3d-bench-tools-r11/src/video3d/samples.js';console.log(JSON.stringify(SAMPLES));"
    samples=json.loads(subprocess.check_output([NODE,'--input-type=module','-e',sample_script],text=True))
    add(js(samples),'source-r11/sample-credits.json','derived directly from immutable R11 SAMPLES export',True)

    # New source binding, never a claim of historically captured served bytes.
    wiring_log=Path('/tmp/v3d-r4-background-shrink-wiring-r1.log').read_bytes()
    clean=re.sub(r'\x1b\[[0-9;]*m','',wiring_log.decode())
    assert re.search(r'\b17 passed \(23\.7s\)',clean) and len(re.findall(r'✓\s+\d+ \[chromium\]',clean))==17
    file('/tmp/v3d-r4-background-shrink-wiring-r1.log','background-shrink-wiring-evidence-r1/run.log')
    source_paths=['src/video3d/run.js','src/video3d/background.js','src/video3d/deadline.js','vendor/splatjs/src/session.js','vendor/splatjs/src/gs/trainer.js','vendor/splatjs/src/gs/background-fit.js','tests/cdx-v3d-background-recovery.spec.mjs','tests/cdx-v3d-background-shrink.spec.mjs','tests/cdx-v3d-background-shrink-gpu.spec.mjs','tests/helpers/v3d-background-shrink-fixture.mjs']
    bound=[]
    for path in source_paths:
        value=subprocess.check_output(['git','show',WIRING_COMMIT+':'+path],cwd=PUBLIC)
        add(value,'background-shrink-wiring-evidence-r1/source/'+path,'git:'+WIRING_COMMIT+':'+path,True)
        bound.append({'file':path,'bytes':len(value),'sha256':hash_bytes(value)})
    wiring_receipt={'kind':'newly-captured-source-binding-for-existing-completed-log','capturedAt':stamp(),'sourceCommit':WIRING_COMMIT,'sourceBinding':'Actual Git object bytes read now; this newly captured receipt does not prove which bytes were historically served during the earlier test.','passed':17,'failed':0,'logSha256':hash_bytes(wiring_log),'logSource':'/tmp/v3d-r4-background-shrink-wiring-r1.log','sourceFiles':bound,'notice':'Wiring/engine controls only, not an R11 native corpus or full-suite acceptance result.'}
    add(js(wiring_receipt),'background-shrink-wiring-evidence-r1/receipt.json','new additive receipt '+stamp(),True)

    # Validate sample evidence and raw native rows using frozen checks, no browser.
    sample_proofs={}
    for generation in ['r11','r12']:
        sample_rows=json.loads((ROOT/f'samples-{generation}-r1/samples.json').read_text());views=0
        assert len(sample_rows)==12 and {(r['id'],r['profile']) for r in sample_rows}=={(s['id'],p) for s in samples for p in ['phone','desktop']}
        for row in sample_rows:
            assert row['preserved'] is True and row['errors']==[]
            for frame in row['frames']:
                assert frame['identicalToMain'] is True
                value=(ROOT/f'samples-{generation}-r1'/f"{row['id']}-{row['profile']}"/(str(frame['index'])+'.png')).read_bytes()
                assert hash_bytes(value)==frame['sha256'];views+=1
        assert views==74
        freeze=json.loads((ROOT/f'runtime-{generation}-freeze.json').read_text())
        sample_proofs[generation]={'sourceCommit':freeze['productCommit'],'cases':12,'viewsExact':74,'errors':[]}
    assert sample_proofs['r11']['sourceCommit']==R11_COMMIT and sample_proofs['r12']['sourceCommit']==WIRING_COMMIT
    add(js(sample_proofs),'separate-sample-proof-summary.json','new separate R11/R12 completed-view byte verification '+stamp(),True)
    verifier=r"""
import fs from 'node:fs';import path from 'node:path';
import {fingerprint} from '/workspace/splashery-v3d-bench-tools-r11/tools/v3d-bench-metrics.mjs';
import {verifyArtifacts,assertReferenceEvidence} from '/workspace/splashery-v3d-bench-tools-r11/tools/v3d-bench.mjs';
const root='/workspace/v3d-r4-media',snapshot=root+'/candidate-r11-final-reconcile-snapshots-r1/0001';
const read=p=>JSON.parse(fs.readFileSync(p)),joined=read(snapshot+'/run.json'),baseline=read(snapshot+'/join-reference/run.json');
const expected={paired:'1b3d8c578a0c06e1b20b79e90d61af9bcbd29aacc6fbe4d4dbd972096c23de5c',unpaired:'adfcf59a89a7ce8e7fd1bb34e62696ca48f03dc4c8810402218dbfedbec0bc42'};
const rows=[];for(const name of fs.readdirSync(root+'/candidate-r11-v1-shards').sort()){
 const directory=root+'/candidate-r11-v1-shards/'+name,run=read(directory+'/run.json'),mode=name.endsWith('-unpaired')?'unpaired':'paired';
 if(fingerprint(run.provenance)!==run.provenanceSha256||run.provenanceSha256!==expected[mode]||run.results.length!==1)throw Error('Wrong captured R11 provenance/row count');
 const row=run.results[0];if(fingerprint(read(directory+'/'+row.id+'-'+row.profile+'/result.json'))!==fingerprint(row))throw Error('Row changed');
 verifyArtifacts(directory,row);
 if(mode==='paired'){
  assertReferenceEvidence(snapshot+'/join-reference',baseline,row,baseline.provenanceSha256);
  if(fingerprint(joined.results.find(r=>r.id===row.id&&r.profile===row.profile))!==fingerprint(row))throw Error('Join row changed');
 }
 rows.push({directory:name,mode,id:row.id,profile:row.profile,status:row.status,provenanceSha256:run.provenanceSha256});
}if(rows.length!==13||joined.results.length!==8||rows.filter(r=>r.mode==='unpaired').length!==5)throw Error('Unexpected R11 counts');
console.log(JSON.stringify({verified:true,rows,strictPairedRows:8,unpairedRows:5}));
"""
    native=json.loads(subprocess.check_output([NODE,'--input-type=module','-e',verifier],text=True))
    add(verifier.encode(),'tools/verify-original-r11-rows.mjs','new CPU-only reproduction of completed-row validation',True)
    add(js(native),'r11-verified-row-summary.json','new CPU-only completed-evidence check '+stamp(),True)

    exclusions=[{'source':str(ROOT/'invalid-receipt-drafts-r1/background-shrink-placeholder.json'),'sha256':hash_bytes((ROOT/'invalid-receipt-drafts-r1/background-shrink-placeholder.json').read_bytes()),'reason':'Invalid quarantined placeholder is not copied or used as provenance.'},{'source':'all R12 native/snapshot/live-control paths','reason':'Explicitly outside this packet; only the separately authorized completed R12 sample proof is included.'},{'source':'ci-11c90-publication-r1','reason':'Separately prepared/root-owned; not duplicated.'},{'source':'learned-background-wiring-evidence-r1','reason':'Earlier R10 evidence; current shrink wiring17 is a separate newly bound64ec receipt.'}]
    (PACKET/'exclusions.json').write_bytes(js(exclusions))
    # Source byte and full directory inventory checks after copying/compression.
    for row in source_inventory:
        value=Path(row['source']).read_bytes()
        if len(value)!=row['bytes'] or hash_bytes(value)!=row['sha256']:raise ValueError('Original source changed: '+row['source'])
    for source,before in directories:
        after=[]
        for item in sorted(source.rglob('*')):
            if item.is_symlink():raise ValueError('New source link: '+str(item))
            after.append((str(item.relative_to(source)),'directory' if item.is_dir() else 'file',None if item.is_dir() else hash_bytes(item.read_bytes())))
        if before!=after:raise ValueError('Completed source directory changed during packet construction: '+str(source))
    (PACKET/'mappings.jsonl.gz').write_bytes(gzip_bytes(b''.join((json.dumps(row,separators=(',',':'),ensure_ascii=False)+'\n').encode() for row in rows)))
    (PACKET/'source-inventory.json.gz').write_bytes(gzip_bytes(js({'capturedAt':stamp(),'originalsUnchangedAfterCopy':True,'files':source_inventory})))
    spec=importlib.util.spec_from_file_location('restore_packet',PACKET/'restore-and-verify.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    result=module.verify(PACKET);result.update(checkedAt=stamp(),sourceFilesRechecked=len(source_inventory),sourceDirectoriesRechecked=len(directories),separateSampleProofs=sample_proofs,nativeRowsVerified=13)
    (PACKET/'restoration-verification.json').write_bytes(js(result))
    print(json.dumps(result,indent=2))
if __name__=='__main__':main()
