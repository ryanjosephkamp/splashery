# Ops merge tool: one command for the Operator's merges

## Brief

You are a Splashery worker session, started by the Operator (session_012GmKRUMZLir2nb27Bo8Cu2).
Repo: ryanjosephkamp/splashery. Lane: Ops merge tool (prefix `opm`). Branch:
`claude/lane-ops-merge-tool`. PR title: "Phase Ops merge tool: one command for the Operator's
merges". Handoff file: docs/handoff/OpsMergeTool.md (start it with this brief under "## Brief"; keep
"## State", "## Notes", "## Known issues", "## For the Operator" current). Model: Opus 5.5, default
effort.

### Brief (the owner's pick, October 7, 2026)

Write `tools/op-merge.mjs`: one command that does the Operator's whole merge routine, so each merge
costs a fraction of the tokens. Today the Operator does by hand:

1. `git checkout -B claude/operator-merge-<topic> origin/main`, then for each PR head in order
   `git merge --no-ff <full sha> -m "Merge #<n> (<PR title>)"` with the commit trailer lines passed
   in.
2. Conflicts only in generated files (site/, docs/TOY-PLAN.md, src/showcase/facts.json, the Sound
   Board page file) are resolved by taking either side and regenerating; tools/sound-review.json
   conflicts are merged per toy (3-way, per key under "toys"); anything else stops with a clear
   report.
3. Checks: `node --check` on src/toys.js, src/toy-help.js, src/toy-sounds.js; JSON.parse on
   tools/toy-plan.json, tools/assets.json, tools/models.json, tools/sound-review.json.
4. Regenerate: `node tools/toy-plan.mjs`, `node tools/site-build.mjs`, `node tools/shw-facts.mjs`,
   `npx prettier --write site docs/TOY-PLAN.md src/showcase/facts.json tools/assets.json`, then
   `site-build --check` and `shw-facts --check`; commit "Ops: rebuild site/ after #a, #b" if
   anything changed.
5. Find the specs the merged PRs touched (changed tests/\*.spec.mjs, plus specs whose prefix matches
   changed files where that is cheap to know), run them with `SPLASHERY_CHROMIUM` and `--workers=1`,
   restore tests/screenshots afterwards, and run `npx prettier --check .` and
   `node tools/us-english.mjs --diff`.
6. Print a ready PR body (Summary listing each PR with its sha and title, Verification with the
   counts, Deviations, Known issues, What was cut) to a file the Operator can paste.

Inputs: `--topic <name> --pr <n>:<sha> ... [--trailer-file f] [--no-tests] [--dry-run]`. It never
pushes, never opens or merges PRs (the Operator does that through GitHub), and never touches a
branch other than the merge branch it makes. PR titles can come from a `--title <n>="…"` flag (no
network needed). Write `tests/opm.spec.mjs` (node-only tests on a temporary git repo built by the
test: a clean merge, a site/-only conflict regenerated, a sound-review per-toy merge, a real
conflict that stops) and a short section in docs/OPERATING.md. Finish every working turn with
"READY:", "WORKING:" or "BLOCKED:". Your Operator is session_012GmKRUMZLir2nb27Bo8Cu2.

## State

- Started October 7, 2026. Writing `tools/op-merge.mjs` and `tests/opm.spec.mjs`.

## Notes

## Known issues

## For the Operator
