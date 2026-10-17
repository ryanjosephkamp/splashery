import os,subprocess,json,re
from pathlib import Path
source='9cf1e832c3bba2f3e86c66b4c92e3058f0cec4ec';base='ea9a9d193de529e6c75264123bb04b7e862b7162';dest=Path('/workspace/phone-speed-public');cache=Path('/workspace/splashery/.cache/phone-speed')
identity=json.loads((cache/'public-identity.json').read_text());email=f"{identity['id']}+{identity['login']}@users.noreply.github.com"
env={**os.environ,'GIT_AUTHOR_EMAIL':email,'GIT_COMMITTER_EMAIL':email}
def git(*args,**kw):return subprocess.check_output(['git',*args],cwd=dest,env=env,**kw)
def copy(path):
 target=dest/path;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(git('show',f'{source}:{path}'))
def commit(message,paths):
 subprocess.run(['git','add',*paths],cwd=dest,env=env,check=True)
 subprocess.run(['git','commit','-m',message],cwd=dest,env=env,check=True)
changed=git('diff','--name-only','--diff-filter=AM',base,source,text=True).splitlines()
tools=[p for p in changed if p.startswith('tools/')]
for path in tools:copy(path)
full=git('show',f'{source}:tests/cdx-speed.spec.mjs',text=True)
starts=[m.start() for m in re.finditer(r'^test\(',full,re.M)]
blocks=[full[a:b] for a,b in zip(starts,starts[1:]+[len(full)])]
engine=['idle redraws reuse GPU work','clock-driven and unknown','completed idle draws skip','imported spherical harmonics','retagging a settled rig','recipe render settings','picture toys reuse only']
measurement=[b for b in blocks if not any(name in b.split('\n',1)[0] for name in engine)]
assert len(blocks)==16 and len(measurement)==9
(dest/'tests/cdx-speed.spec.mjs').write_text(full[:starts[0]]+''.join(measurement))
commit('Add completed-draw phone measurements and a local device check page',tools+['tests/cdx-speed.spec.mjs'])
engine_paths=[p for p in changed if p.startswith('src/') and not p.startswith('src/packs/')]+['tests/cdx-speed.spec.mjs','docs/PACKS.md']
for path in engine_paths:copy(path)
commit('Engine: reuse settled splat surfaces with complete invalidation and tier budgets',engine_paths)
recipes=[p for p in changed if p.startswith('src/packs/')]
for path in recipes:copy(path)
commit('Bound Liberty and Photo album fill on the low tier',recipes)
covered=set(tools+engine_paths+recipes)
remaining=[p for p in changed if p not in covered]
for path in remaining:copy(path)
audit=dest/'docs/audits/phone-speed-2026-10.md'
s=audit.read_text().replace('git worktree add --detach ../splashery-phone-before 36f5df601963f418f71b98ee460783ea6191b0bc','git worktree add --detach ../splashery-phone-before ceb51de7a015377d7f350119c27a792fc1a8a66d')
s=s.replace('## Earlier work','''## Source provenance

GitHub rejected the initial publication because the checkout's commit email was private. The
original local branches and commits remain intact. This public branch adds new commits to public
main using GitHub's noreply address; no existing commit or branch history was rewritten, and no
force push was used.

The raw measurements retain their original local source IDs. Original runtime
`36f5df601963f418f71b98ee460783ea6191b0bc` has the same app bytes as public main
`ceb51de7a015377d7f350119c27a792fc1a8a66d`. The raw branch's
`measured-runtime-072.patch` reconstructs the original measured candidate from that public base,
without commit metadata. `runtime-manifest.json` records every runtime file's SHA-256. The public
candidate's shared engine and target recipe bytes match the measured candidate; incoming main's
Neuron specimen is covered by a separate source-pinned comparison. These mappings reproduce the
measured code without exposing private commit metadata or relabeling observations as new runs.

## Earlier work''')
audit.write_text(s)
commit('Document measured target gains, phone QA, and source provenance',remaining)
subprocess.run(['git','diff','--exit-code',source,'HEAD','--','src','vendor','assets','index.html','styles.css','tests','tools'],cwd=dest,check=True)
new=git('rev-parse','HEAD',text=True).strip(); emails=git('log',f'{base}..HEAD','--format=%ae%n%ce',text=True).splitlines();assert emails and all(x==email for x in emails)
proof=json.loads((cache/'history-preservation-proof.json').read_text());proof['after']={ref:git('rev-parse',ref,text=True).strip() for ref in proof['before']};assert proof['before']==proof['after'];proof['publicHead']=new;proof['publicBase']=base;proof['newCommits']=int(git('rev-list','--count',f'{base}..HEAD',text=True));proof['runtimeAndTestInputsMatch']=source
(cache/'history-preservation-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
print(json.dumps({'publicHead':new,'newCommits':proof['newCommits'],'originalReferencesUnchanged':True,'runtimeAndTestInputsMatch':source}))
