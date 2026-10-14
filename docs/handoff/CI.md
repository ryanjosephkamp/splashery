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
  apt in each shard, and the container's own `56-prefer-inter.conf` (in no package: it draws
  `ui-sans-serif` and `sans-serif` in Inter) is written into `/etc/fonts/conf.d/`.
- Reports go to `$RUNNER_TEMP/ci-out/`: outside the checkout, since bld:57 checks every top-level
  folder against builders/REPO-MAP.md, and not under a dot folder, which upload-artifact leaves out.

## Known issues

- cdx-pics takes 35 to 37 minutes alone in its shard, so a run takes about 44 minutes however many
  shards there are; the other 15 shards finish in 11 to 27. Splitting that file is what would bring
  a run near 25 minutes.
- On Actions, run 2's report gave hh5-gems's tests lines 5 to 21 below where they are (133 for the
  crystal ball at 119); run 3 and local runs give the right lines. The cause is not found. The rerun
  finds a test by file and title, so it no longer depends on the line.
- man5:201 is red on main for a real reason, which Actions now shows. With the sandbox and Inter in
  place (run 4), the two prints match each other byte for byte, but not the shipped
  `manual/tinkerers-manual-85d32b96193ea275.pdf`: "run tools/manual-pdf.mjs again: the shipped PDF
  is out of date". A print in the cloud container (a scratch copy of the tool with the sandbox off)
  differs from it too (7,984,645 bytes against 7,792,711). The fix is a fresh print on main by the
  manual's owner, not this lane.

## For the Operator

Three runs on this PR, each 284 of 284 spec files and 2,435 tests. "Alone" is the rerun of the
failing test by itself in the same shard; ✓ passed alone, ✗ failed alone, blank passed outright.

| Run (head)  | Failed | Wall    | Notes                                                          |
| ----------- | -----: | ------- | -------------------------------------------------------------- |
| 1 (59e560d) |     10 | ~43 min | cdx-pics untimed; shared shard 12 (40 min).                    |
| 2 (cffe051) |     13 | ~40 min | Every file timed; cdx-pics alone in shard 1 (36 min).          |
| 3 (343bfe0) |     17 | ~44 min | Sandbox fixed; man5 then stopped on the missing Inter (fixed). |

| Test                    | Run 1 | Run 2 | Run 3 | Reading                                                                                                                                                                                                                           |
| ----------------------- | ----- | ----- | ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| kit:87                  | ✗     | ✗     | ✗     | Known red on main ("too much detail for a circular picture on this device").                                                                                                                                                      |
| man5:201                | ✗     | ✗     | ✗     | Known red. On Actions, AppArmor blocked Chromium's sandbox (fixed in run 3), then the runner lacked the container's Inter rule (fixed in run 4). Now it fails for its real reason: the shipped PDF is out of date (Known issues). |
| bld:57                  | ✗     |       |       | This lane's own `ci-out/` folder; fixed in run 2.                                                                                                                                                                                 |
| spg:138                 |       | ✗     | ✗     | Actions only: closing the context after the embed guide's live toy runs past 240 s. Passes in the cloud container (12 s alone, and the whole file on llvmpipe in 138 s). For its lane.                                            |
| ui3:50, ui3:129         | ✓     | ✓     | ✗     | Pause and resume with sound; failed alone in run 3. With sndc-engine:27, the audio-clock tests are unsteady on a busy runner. For its lane.                                                                                       |
| sndc-engine:27          | ✗     | ✗     | ✓     | The same audio-clock family; passes in the cloud container. For its lane.                                                                                                                                                         |
| scr2-engine:10          |       | ✗     |       | A held GIF frame; failed alone in run 2 only. Passes in the cloud container.                                                                                                                                                      |
| cdx-mir:329             | ✗     | ✓     |       | A draw-time bound (25.6 ms against 24.05); load.                                                                                                                                                                                  |
| smoke:734               |       |       |       | Passed in all three.                                                                                                                                                                                                              |
| tpg:205, ui4:42, phy:64 |       | ✓     | ✓     | Known flakes; passed alone.                                                                                                                                                                                                       |
| others                  | ✓     | ✓     | ✓     | Passed alone: hh3-engine2:122, img-engine:85, ops-text:41, qrc-picture:119, cdx-mir:294, fx4-engine:79, ui2:361, hh5-gems:133/147, live5:63, hh4-tiny:206, phy-engine:90, hh4-space:147, chs-engine:11.                           |

Until the fragile tests above are steadied, expect a few ✗ on every run. Read the comment's "Alone"
column: a ✗ that is not on this list is new and real.
