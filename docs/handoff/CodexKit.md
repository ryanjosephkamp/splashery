# Lane Codex kit: a working Codex cloud setup and new Codex tasks (prefix `cdx`)

## Brief

Written by the Operator (session_012GmKRUMZLir2nb27Bo8Cu2), the owner's pick of October 7, 2026.
Model: Sonnet 5.5, default effort. Branch: `claude/lane-codex-kit`. PR title: "Phase Codex kit: a
working Codex cloud setup and new Codex tasks".

After this week the owner moves some work to Codex, which he runs himself in Codex's cloud. His
first try at a Codex cloud environment for this repo's private copy failed during setup.

1. `tools/codex-setup.sh`: idempotent, fails loudly at each step, installs what the tests need
   (`npm ci`, `npx playwright install --with-deps chromium`), checks `python3`, prints a summary,
   stays fast on a 1.1 GB repository (no asset rebuilds), has a flag to skip the browser install for
   testing here. `docs/codex/SETUP.md`: plain numbered steps for the owner on his phone, what each
   likely failure means and how to fix it, and what could not be verified.
2. Ten new Codex tasks, `docs/codex/22-*.md` to `31-*.md`, in the house format, each a bounded job
   of a few hours; no new toys or effects. Update `docs/codex/README.md`.
3. Copy the script and SETUP.md to `ryanjosephkamp/splashery-sandbox` on `claude/codex-setup`, with
   a draft PR against its main.

## State

- Done: the script, SETUP.md, tasks 22 to 31, the README table.
- Script tested in a fresh `--depth 1` clone (2.0 GB on disk): `--skip-browser` run 10 s, second run
  1 s (skips `npm ci`), failure messages checked for low disk and a missing python3, and
  `tests/help.spec.mjs` passed (14 tests) in that clone.
- Sandbox copy: see "For the Operator".

## Notes

- Tasks: 22 evidence for Earth and maps, and Imaging; 23 evidence for landmarks, vehicles, medieval;
  24 game and sport rules; 25 American English sweep report; 26 broken links and dead assets; 27
  keyboard and screen-reader check of the site pages; 28 coverage gaps and a pure-module test file;
  29 root causes of the intermittent tests; 30 docs checked against code; 31 credits records checked
  against each other. New files they may add use the `cdx` or task-named prefixes.
- Tasks 22 to 24 cover shelves that tasks 16 to 20 skip. The balls' physical constants are already
  in `tools/hands-on-materials.json` (task 11).

## Known issues

- Not verified (can't run Codex): the Codex settings screens, GitHub app access, `--with-deps` (it
  was never run here), the setup time limit and the container's disk. SETUP.md says so.
- The setup-timeout fix in SETUP.md (a trimmed copy for Codex) is a proposal, not built.

## For the Operator

- Merge order doesn't matter. The Codex environment's branch must be `main`, so the script has to be
  merged before the owner's first run.
- Please check task 22 to 24's overlap with whatever the Space, Games and Arcade lanes have queued.
