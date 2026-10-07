# Ops merge tool: one command for the Operator's merges

## Brief

You are a Splashery worker session, started by the Operator (session_012GmKRUMZLir2nb27Bo8Cu2).
Repo: ryanjosephkamp/splashery. Lane: Ops merge tool (prefix `opm`). Branch:
`claude/lane-ops-merge-tool`. PR title: "Phase Ops merge tool: one command for the Operator's
merges". Handoff file: docs/handoff/OpsMergeTool.md (start it with this brief under "## Brief"; keep
"## State

- Started October 7, 2026. Draft PR #397.
- Done: `tools/op-merge.mjs` (all six steps, plus `--dry-run`, `--continue`, `--spec`, `--base`,
  `--no-fetch`, `--repo`), `tests/opm.spec.mjs` (4 node-only tests on a temporary git repo: a clean
  merge, a site/-only conflict rebuilt, a sound-review merge toy by toy, a real conflict that stops,
  with `--dry-run` and `--continue` checked in the same test) and "The merge tool" section in
  docs/OPERATING.md.
- Replayed the real merge of #367, #368, #370, #389 and #391 (base `f1994db9`) in a scratch
  worktree: the dry run predicted it (#367 settles a site/ conflict, the rest clean); the full run
  merged all five, settled the site/ conflict, committed the rebuild, ran 8 touched specs (61
  passed) and passed prettier and us-english. Its tree matches the hand merge (`3085258a`) except
  site/new/ and site/sw.js, which are built from the git history and differ only because the
  replay's history does.

## Notes

- Console output is one line per step; everything else goes to `.cache/op-merge/<topic>.log` (and
  `<topic>-tests.log`), so a merge costs the Operator a few lines.
- site/assets/ is hand-written (tools/site-build.mjs says so), so a conflict there stops like any
  other.
- A PR without `--title` falls back to its head commit's subject and says so under Deviations.
- Spec choice: changed tests/\*.spec.mjs, plus each spec whose prefix (its name without `-engine`)
  starts a changed file's name in src/, tools/ or tests/screenshots/. taps and smoke are never
  picked by prefix.

## Known issues

- None known.

## For the Operator

- Run `--dry-run` first: it costs under a second and says which merge stops and why.
- The PR body has no footer: add your session's own.
- Exit codes: 0 green, 1 stopped, 3 finished with a failing check.
