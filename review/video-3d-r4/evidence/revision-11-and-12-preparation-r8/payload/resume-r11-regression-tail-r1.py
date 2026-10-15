"""MIT. Record the interrupted local run, then repeat its affected final file unchanged."""
import pathlib,json,hashlib,shutil,subprocess,os,datetime
root=pathlib.Path('/workspace/v3d-r4-media');evidence=root/'r11-regressions-interrupted-r1';evidence.mkdir()
log=pathlib.Path('/tmp/v3d-r4-regressions-r11-tiles-r1.log');raw=log.read_bytes()
(evidence/'partial-run.log').write_bytes(raw)
result=pathlib.Path('/workspace/splashery-r4-staging/test-results')
if result.exists():shutil.copytree(result,evidence/'test-results')
receipt={'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'runtimeSourceCommit':'636a7605fd15f3aa1e41d43cc6b5ff35432750b6','plannedTests':258,'completedPassingCases':238,'failedCasesBeforeInterruption':0,'reason':'The managed execution tools reconnected around 12:26 UTC; the live execution session and its Playwright process were no longer available. The last log activity was12:25:10, inside tests/v3d.spec.mjs. This partial run is not a completed pass.','partialLogSha256':hashlib.sha256(raw).hexdigest(),'repeatScope':'Rerun the entire affected tests/v3d.spec.mjs with all original assertions. Earlier partial results stay recorded.'}
(evidence/'receipt.json').write_text(json.dumps(receipt,indent=2)+'\n')
env=os.environ.copy();env['PATH']='/home/agent/.npm/_npx/165bf73430067a31/node_modules/node/bin:'+env['PATH'];env['DISPLAY']=':99';env['FONTCONFIG_FILE']='/workspace/v3d-tools/fonts.conf';env['SPLASHERY_CHROMIUM']='/workspace/v3d-tools/chrome-linux64/chrome';env['SPLASHERY_GL']='llvmpipe';env['SPLASHERY_PORT']='4215'
command=['/home/agent/.npm/_npx/165bf73430067a31/node_modules/node/bin/node','node_modules/@playwright/test/cli.js','test','tests/v3d.spec.mjs']
repeat=root/'r11-regressions-tail-repeat-r1';repeat.mkdir()
with(repeat/'run.log').open('xb')as out:
 p=subprocess.Popen(command,cwd='/workspace/splashery-r4-staging',env=env,stdout=out,stderr=subprocess.STDOUT,close_fds=True)
 (repeat/'launch.json').write_text(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'pid':p.pid,'command':command,'sourceCommit':receipt['runtimeSourceCommit']},indent=2)+'\n')
 code=p.wait()
shutil.copytree(result,repeat/'test-results')
(repeat/'exit.json').write_text(json.dumps({'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'returncode':code},indent=2)+'\n')
