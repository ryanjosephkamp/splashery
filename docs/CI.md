# The test suite on GitHub Actions

`.github/workflows/tests.yml` (lane CI, October 14, 2026) runs the checks on every PR to `main`, and
the full Playwright suite on every push to `main`, on demand, on the Operator's merge PRs
(`claude/operator-merge-*`), and on any PR labeled `full-suite` (the owner's call of October 15,
2026, so lane and Codex pushes don't queue up the runners). The repository is public, so GitHub's
runners cost nothing, and no Claude session has to run the suite for a merge. To run the whole suite
on another PR, add the `full-suite` label; each later push runs it again.

## What runs

- **Checks** (one job, a few minutes): `npm ci`, `npx prettier --check .`,
  `node tools/us-english.mjs --diff=origin/main` (on PRs), `node tools/site-build.mjs --check`,
  `node --check` on `src/toys.js`, `src/toy-help.js` and `src/toy-sounds.js`, and that the JSON
  lists (`tools/toy-plan.json`, `tools/assets.json`, `tools/models.json`, `tools/sound-review.json`,
  `tools/suite.json`) parse.
- **Suite 1/16 to 16/16** (16 jobs at once): each runs
  `node tools/suite.mjs --fresh --jobs=2 --shard=i/16` with Playwright's own Chromium (the same
  build, 1194, as `/opt/pw-browsers` in the cloud container) for the main project, and Chrome for
  the native-media project described below. WebGL2 uses Mesa's llvmpipe in a virtual display
  (`SPLASHERY_GL=llvmpipe`, as the Integrators run it), and WebGPU uses SwiftShader. The files on
  the `swiftshader` list in `tools/suite.json` run on SwiftShader, and the `solo` files run alone at
  the end, as in a local run. Then `node tools/ci-report.mjs recheck` runs each failing test once
  more, alone (by its file and title). The tests and the config are the same as locally: no retries,
  no extra skips.
- **Summary**: merges the 16 shard reports with `node tools/ci-report.mjs summary`, writes them as
  the run's job summary, and posts them as **one PR comment** that it updates in place on each run.
  The job fails when any test failed or a spec file sent no report.

The shards split the files by the times in `tools/suite.json` (`seconds`; a file with no time counts
as 120 s), longest first into the lightest shard. Each run's summary artifact has `times.json`, the
seconds per file on the runners: copy them into `tools/suite.json` when the shards come out uneven.
To change the number of shards, change `SHARDS`, the matrix list and the job name in the workflow
together.

Moving photo's `cdx-mp2*` specs run once in the `chromium-media` project. They use Chrome, already
installed on the
[Actions Ubuntu image](https://github.com/actions/runner-images/blob/ubuntu24/20261012.334/images/ubuntu/Ubuntu2404-Readme.md),
because the bundled Chromium cannot decode their H.264/AAC uploads. Other specs retain the
`chromium` project and its bundled browser. `SPLASHERY_CHROMIUM` still overrides the executable for
both projects, as in the cloud container. Moving photo's standalone measurement helpers use the same
native-media browser choice.

The suite and Playwright start `tools/cdx-mp2-server.mjs` on their configured port. It serves static
files with HTTP byte ranges, which Chromium needs to seek these video assets. Python's simple server
leaves their seekable range empty. Project routing runs each spec once, retaining the original
assertions, timeouts, and skip rules. The same checked-in configuration runs locally and on Actions.

## How long

About 35 to 45 minutes from push to comment: a few minutes of setup per shard, then the shards. The
longest file, cdx-pics (about 31 minutes on its own), sets the floor; the other shards take about 15
to 25 minutes each. Checks take about 4 minutes. The PR comment's "Time per shard" has each run's
times, and the first runs are in [handoff/CI.md](handoff/CI.md).

## Reading the comment

The comment starts with ✅ or ❌ and the commit it tested (the PR's head; the run itself tests the
PR merged into `main`, as GitHub does for every PR). Then:

- the counts: spec files that reported, tests passed, failed and skipped;
- **No report**: files that crashed, ran out of time, or whose shard was canceled. They count as
  failures;
- **Failed**: every failing test as `file:line` (the line where its `test(` starts, as the
  Operator's lists use) and its title, with the rerun alone (**passed alone**, failed, or not rerun)
  and the first line of the error. "(known on main)" marks a test on the `known` list in
  `tools/suite.json` (docs/OPERATOR.md, "Known flaky tests"). Every failure still counts: one that
  passed alone is likely a flake on a busy runner, one that failed alone too is real;
- the time per shard and the slowest files (folded).

A new push to the PR cancels the run in progress (a canceled run posts nothing) and starts again;
the comment updates when the new run ends.

## Rerunning

- On the run's page in GitHub's Actions tab: **Re-run failed jobs** reruns only the failed shards
  and the summary. Their reports replace the old ones in the comment (the artifacts carry the
  attempt number, and the newest report of each file wins).
- **Run workflow** on the Tests workflow page (the `workflow_dispatch` trigger) runs everything on a
  branch.
- A Claude session cannot press these buttons (its proxy can't reach the Actions API). It pushes a
  new commit instead, and never an empty one only to rerun CI.

## Artifacts

Each shard uploads `suite-<i>-a<attempt>`: the JSON report and log of each spec file, Playwright's
results folder (failure screenshots and traces), and the rerun reports. The summary uploads
`summary-a<attempt>` (`summary.md` and `times.json`). All are kept 7 days.

## Safety

Every action is pinned to a full commit SHA. The token is read-only (`contents: read`) except in the
summary job, which may also write PR comments and read the run's start time. No secrets, no
deployment. A PR from a fork gets a read-only token, so its comment step is allowed to fail; the job
summary still has the report. Each job has a time limit (checks 20 minutes, a shard 90, the summary
15).

## Known flakes

The `known` list in `tools/suite.json` holds the tests known to fail on plain `main` too (in the
cloud container, or only on Actions: docs/handoff/CI.md has the evidence), as `file:line`
(docs/OPERATOR.md, "Known flaky tests"): the report marks them but still counts them. Add one only
with evidence (it fails on `main` too), and take it off when it is fixed.

## Stress measurements

`.github/workflows/stress.yml` runs task 100's stress recipe independently of Tests. Add the
`stress-tests` label to measure all ten target families on the immutable PR head. Only adding that
label starts stress jobs; later pushes do not start another measurement. Each explicit measurement
has its own concurrency group, preserving its complete first-pass result. `tests.yml` retains its
normal cancellation behavior and full-suite triggers.

Once the workflow is on `main`, **Actions → Stress → Run workflow** also accepts a subject revision,
a JSON array of target families, repetitions per variant (default 30), receipt phase, and optional
PR number. An empty subject revision uses the selected branch. The runner harness comes from the
workflow checkout, while a separate subject checkout supplies the measured tests and source.

Each family runs with four fully parallel workers, two CPU burners, and zero retries. The browser,
software renderer, and setup match the existing stress campaign: llvmpipe except for Pebbles and
sample audio, which use SwiftShader. Seven-day artifacts contain the exact recipe, source hashes,
original reports, logs, and failure traces. When a PR number is available, its per-family receipt
comment records every first-pass failure; a later pass never replaces a failed repetition.

## Printing the manual's PDF

`.github/workflows/manual-pdf.yml` is a manual-only workflow with `contents: read`. It uses the
Tests workflow's Ubuntu 24.04, Node 22, Playwright Chromium, font packages, Inter aliases, and
Chromium sandbox setup. It runs `node tools/manual-pdf.mjs` without browser or font overrides,
checks the PDF's navigation and exact contents titles, rebuilds its edition links, and runs the full
`cdx-manual-pdf` and `man5` files against that fresh edition. It uploads the changed files and the
original check reports and traces. It never commits or pushes. The artifacts last seven days.

After this workflow is available on `main`, the Operator can:

1. Open **Actions → Manual PDF → Run workflow**, and select the branch to print. Or run
   `gh workflow run manual-pdf.yml --ref main`.
2. Wait for that run to pass, note its source commit, and download its `manual-pdf-<commit>`
   artifact with
   `gh run download <run-id> --name manual-pdf-<commit> --dir .cache/manual-pdf-artifact`. Review
   `manual-pdf-checks-<commit>` too: `manual-pdf-check.json` lists the exact contents checks and
   every remaining private-use text character by page, code point, font, and context. The suite's
   original JSON reports and traces are retained even when a check fails.
3. On a new branch from that same commit, copy the artifact's `manual/` folder into the checkout,
   and its `site/` folder too if present. Keep earlier immutable PDFs. `source-commit.txt` records
   which input was printed; it is provenance, not a site file to commit.
4. Review the PDF and the diff, run `node tools/manual-pdf-check.mjs`,
   `node tools/site-build.mjs --check`, the formatting and English checks, and `man5` on Actions.
   Commit the new edition, the legacy PDF copy, `manual/pdf-edition.js`, and the rebuilt pages in
   one draft PR. Remove `man5:201` from the known list only when that check passes.

The workflow itself does not refresh the PDF already committed on `main`. Its stale-edition failure
stays visible until the Operator reviews and commits the artifact.
