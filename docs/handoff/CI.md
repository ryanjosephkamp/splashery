# Lane CI: the test suite on GitHub Actions

## Brief

(Written by the Operator on October 14, 2026; summarized.) Lane CI (prefix `ci`), Opus 5.5 at high
effort, branch `claude/lane-ci`, PR "Phase CI: the test suite on GitHub Actions". It takes over
Codex task 77 (docs/codex/77-ci-suite.md), which never opened a PR.

- Why: every merge waits on the Operator running Playwright in one 4-CPU container (a batch of five
  PRs over two hours, a full suite about 4.5 hours) and spends Claude usage. Sharded on GitHub's
  free runners, the full suite should take about 20 minutes per PR.
- Build `.github/workflows/tests.yml` (pull requests to main, pushes to main, on demand): a checks
  job (prettier, us-english, site-build --check, the shared lists), a suite job of 16 shards running
  `tools/suite.mjs --shard=i/N`, and a summary job that merges the reports, lists every failure with
  its file:line, reruns each failure alone, and writes the job summary and one PR comment updated in
  place. Artifacts kept 7 days.
- Safety: actions pinned by SHA, read-only token except PR comments on the summary job, no secrets,
  stale PR runs canceled, a time limit per job.
- Write docs/CI.md and change docs/OPERATOR.md's merge steps to wait for the CI comment, with the
  local run as the fallback.
- Prove it on the PR itself: wall time, per-shard times, and the failures against the known red list
  (kit:87, smoke:734, tpg:205, man5:201). Never skip, fixme, or edit `tests/taps.spec.mjs`. If the
  proxy refuses to push `.github/workflows/`, keep the file at `docs/ci/tests.yml` and give the
  owner steps.

## State

- `.github/workflows/tests.yml`, `tools/ci-report.mjs` (the rerun and the merged report),
  `docs/CI.md`, the CI wait in docs/OPERATOR.md's merge steps, and a `known` list in
  `tools/suite.json` (tests that fail on plain main too; the report marks them).
- First run: see "For the Operator".

## Notes

- Playwright's own Chromium 1194 (Chrome 141) is installed in the runner, not the runner's Google
  Chrome: it is the build `/opt/pw-browsers` has, and man5:201 compares PDF bytes printed by
  "Skia/PDF m141".
- The checkout is the full history (`fetch-depth: 0`): `us-english --diff=origin/main` needs the
  merge base, and a live test runs `git show` on an older commit.
- ffmpeg (cdx-v3d), Xvfb, Mesa's llvmpipe and the cloud container's fonts (DejaVu, Inter,
  Liberation, Noto Color Emoji; `tools/manual-pdf.mjs` stops on any other set, man5:201) come from
  apt in each shard.
- Reports go to `$RUNNER_TEMP/ci-out/`: outside the checkout, since bld:57 checks every top-level
  folder against builders/REPO-MAP.md, and not under a dot folder, which upload-artifact leaves out.

## Known issues

None yet.

## For the Operator

Pending the first run.
