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
- Run 1 (October 14, 2026, head 59e560d) finished: every file reported. Two of its failures were
  this lane's own setup (bld:57, and man5:201's sandbox and fonts), fixed in later pushes. The shard
  split now has a time for every file (`tools/suite.json`).

## Notes

- Playwright's own Chromium 1194 (Chrome 141) is installed in the runner, not the runner's Google
  Chrome: it is the build `/opt/pw-browsers` has, and man5:201 compares PDF bytes printed by
  "Skia/PDF m141".
- The checkout is the full history (`fetch-depth: 0`): `us-english --diff=origin/main` needs the
  merge base, and a live test runs `git show` on an older commit.
- `kernel.apparmor_restrict_unprivileged_userns=0` lets Chromium's sandbox start (man5:201 prints
  the manual with `chromiumSandbox: true`).
- ffmpeg (cdx-v3d), Xvfb, Mesa's llvmpipe and the cloud container's fonts (DejaVu, Inter,
  Liberation, Noto Color Emoji; `tools/manual-pdf.mjs` stops on any other set, man5:201) come from
  apt in each shard.
- Reports go to `$RUNNER_TEMP/ci-out/`: outside the checkout, since bld:57 checks every top-level
  folder against builders/REPO-MAP.md, and not under a dot folder, which upload-artifact leaves out.

## Known issues

- On Actions, the report gave hh5-gems's tests lines 5 to 21 below where they are (133 for the
  crystal ball at 119); locally the same file reports 119. The cause is not found yet. The rerun
  finds a test by file and title, so it no longer depends on the line.

- cdx-pics alone takes about 31 to 35 minutes, so a run can't finish faster than that however many
  shards there are. Splitting that file (or running its describe blocks apart) is what would bring a
  run near 20 minutes.
- Failing only on Actions, and failing alone too (they pass in the cloud container; findings, not
  skipped):
  - cdx-mir:329: `drawMs` after the fix must stay under 1.1 × before; the runner gave 25.6 ms
    against a limit of 24.05 ms. It is a wall-clock bound on a shared 4-vCPU runner.
  - sndc-engine:27: 800 ms after resume, the toy piano had scheduled no new sound (42, then 42).

## For the Operator

Run 1 (head 59e560d): 284 of 284 files, 2,435 tests: 2,424 passed, 10 failed, 1 skipped. About 43
minutes from push to comment; the shards took 12 to 26 minutes, except 12/16 at 40 (cdx-pics, at
2,085 s, had no time in suite.json and shared a shard). Checks took 3.5 minutes.

| Test                                                                 | Alone  | Why                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| bld:57                                                               | failed | This lane's: the reports' `ci-out/` folder at the top. Fixed (they go to `$RUNNER_TEMP`).                                                                                                                                                                       |
| man5:201                                                             | failed | Known red. Run 2 showed the cause: "No usable sandbox" (Ubuntu 24.04's AppArmor blocks the user namespaces `manual-pdf.mjs`'s sandboxed Chromium needs). The runner now lifts that restriction and installs the cloud container's fonts (the PDF's next check). |
| kit:87                                                               | failed | Known red on main ("too much detail for a circular picture on this device").                                                                                                                                                                                    |
| cdx-mir:329                                                          | failed | Actions only: a draw-time bound (see Known issues).                                                                                                                                                                                                             |
| sndc-engine:27                                                       | failed | Actions only: no new sound 800 ms after resume (see Known issues).                                                                                                                                                                                              |
| hh3-engine2:122, img-engine:85, ops-text:41, qrc-picture:119, ui3:50 | passed | Load on a busy runner.                                                                                                                                                                                                                                          |

smoke:734 and tpg:205 passed on Actions.
