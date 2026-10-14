# Fix12: main green again

## Brief

You are a Splashery worker session (lane "Fix12", prefix `fx12`), started by the Operator
(session_01UFMfX9RBAFMSqMHSrisZuo) for the owner, Ryan. Model: Opus 5.5, high effort. Repo:
ryanjosephkamp/splashery. Branch: `claude/lane-fix12` (and `claude/lane-fix12-engine` for an
"Engine: …" PR if a fix belongs in the engine). PR title: "Phase Fix12: main green again". Handoff
file: docs/handoff/Fix12.md (this brief under "## Brief", then "## State", "## Notes", "## Known
issues", "## For the Operator").

Read CLAUDE.md, docs/HANDOFF.md "Now", docs/OPERATOR.md ("Local test runs", "Known flaky tests"),
and docs/handoff/Fix11.md (the last lane that did this job, and how).

### The job: the tests red on plain main, fixed at their cause

1. **`tests/kit.spec.mjs:87`** (red since #603, circular QR): a circular Picture QR recipe throws
   "too much detail for a circular picture on this device" in the cloud browser. Codex already wrote
   a fix inside an unrelated PR: commit `c014e5cf6` on branch `codex/video-3d-r2` ("Preserve
   complete no-picture circular QR codes within small budgets", src/packs/qr-craft.js plus
   tests/cdx-qr-circle-budget.spec.mjs). Review it critically, port it (or a better fix) here with
   its test, and show kit:87 red before and green after. Ryan approved fixing it ("fix circle QR").
   Note: Codex tasks 79 and 80 are changing Picture QR right now; keep your change small and say
   exactly which lines it touches.
2. **`tests/smoke.spec.mjs:734`** ("rigs pick splats by colour, run effects and show add-ons; shelf
   shapes have rigs"): on plain main it fails every time in the Operator's container, e.g.
   `expect(received).toBeLessThan(expected)`, received 82,335 against an expected bound near 9,179
   (another run: 82,304 vs 22,801). It used to be an occasional flake. Find which merge made it
   consistent (bisect over main's recent merges: #617 full resolution within the device cap, #620,
   #621, #624 are candidates) and whether the toy or the test is wrong.
3. **`tests/tpg.spec.mjs:205`** ("toy pages (browser) › a sample of 25 pages loads, fits a phone
   and links on"): fails every time now with "page.evaluate: Test ended" (a timeout). Same approach.
4. **`tests/man5.spec.mjs:201`** fails only in Claude cloud containers, because #615 launches the
   PDF tool's Chromium with its sandbox on, and these containers run as root. **Never turn the
   sandbox off** and never make the test skip. Leave it, and say in the handoff that the GitHub
   Actions run (another lane is building it now) is where it runs green.

Rules: reproduce each failure first on plain main (`SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium
npx playwright test tests/<file>:<line> --reporter=line --workers=1`; never `playwright install`),
then fix the root cause. If a toy regressed, fix the toy and keep the test; if an approved change
legitimately changed behavior, update the test to check the new behavior just as strictly and name
the PR. Never skip, fixme, retry, loosen without proof, or edit `tests/taps.spec.mjs`. Don't change
how a toy looks beyond the fix. Run the touched files plus kit, smoke, tpg, help, unit, and taps at
the end, with `--repeat-each=3` on the three you fixed. Follow CLAUDE.md "Before every push".

The Operator merges after its own tests. Finish every turn with "READY:" (PR link, each test's root
cause and fix, the runs), "WORKING:" or "BLOCKED:". Aim for a first READY within about three hours.

## State

Model: Opus 5.5 (claude-opus-5-5), high effort. Branch `claude/lane-fix12` from main at `41b21e74`
(#626). No engine change, so no `-engine` branch.

The four tests (root cause and fix; the runs are in "Notes"):

1. **`kit:87`: the toy, two causes.**
   - The circle threw. The kit test builds every recipe in Node with 8,000 splats and no picture
     (`prepare` loads none without a document). The circle then needs a lattice of 159 × 159 cells
     (3 cells a module, 53 modules), at least 50,245 splats at its coarsest, so it threw. Ported
     Codex's `c014e5cf6` after checking its claim: without a picture `weave` forces every cell to its
     module's ink or paper (`!src` in `src/qr-craft/picture.js`), so one cell a module loses nothing.
     It applies only to a circle with no picture that is over the budget, so every circle with a
     picture and every square code look the same as before. Its test is
     `tests/fx12-qr-circle-budget.spec.mjs`, renamed from `cdx-qr-circle-budget` to this lane's
     prefix.
   - Then the test ran out of time. With the circle fixed, the test went on past Picture QR and hit
     its 600 s limit (main had failed at 6.3 min, at the throw). Picture QR alone took 87 s: for the
     square shape at 8,000 splats it built the 454k- and 200k-splat lattices (fine 3 and 2) only to
     throw them away. Now it skips building a lattice that is over the budget by itself, the way the
     circle already did. The square still takes the coarsest lattice as before, so the output is the
     same, and Picture QR builds in 10 s. Lines touched in `src/packs/qr-craft.js`: `pictureSplats`
     (the `make` signature, `encodedCount`, the quiet-zone spacing, the circle decoration's
     arguments, the layer loop, the fine-level loop's skip, and the new no-picture block before the
     throw).
2. **`smoke:734` (now at line 749): the test, timing.** Bisected over main's first-parent merges:
   it passes at October 2 and 5 and fails from October 6 on, but not on every commit (20a22840
   fails, the docs-only 953f6e44 after it passes). So it's timing, not one merge. Measured in the
   test: while the strawberry's pop plays, one canvas screenshot takes about 5 s (about 1 frame a
   second on SwiftShader with `profile=weak`) and the pixel count 1.7 s more. The poll's first
   sample is the effect's peak (about 66k to 82k pixels changed); with its 3 s interval, the second
   sample lands 11 to 14 s in, and when it passes the 15 s deadline Playwright reports the peak. The
   pulse runs on frame time (each frame moves it at most 0.1 s), so in a slow browser it outlasts
   the wall-clock allowance. Fix: the poll starts once the action's pulse has run out (motion state
   back to 0, a real ready signal), with the same bound (`< moved / 4`). The test also waits for the
   camera to finish easing into each toy's home view before its "rest" frame (`cameraStill`): with
   `?renderer=webgl2` the strawberry was still at yaw 0.267 of 0.25 after `waitForToy`'s 1.5 s. The
   toy is fine: its settled frame matches the rest frame exactly (0 pixels).
3. **`tpg:205`: the test.** `quietPlayers` stubs each toy page's player iframe with `page.route`.
   From the second page on, the site's service worker (site/sw.js) controls the page, and requests a
   service worker handles bypass `page.route`. So every "quiet" player loaded the whole app (43 to
   57 `/src/` modules, WebGPU set up), each page took 6 to 12 s, and the sample needed about 210 s
   of the 240 s limit here (it's slower in the Operator's container). It crossed the limit as the
   player grew. The worker has done this since it was added; no recent merge broke it. Fix: this
   test's context blocks service workers (`serviceWorkers: "block"`), so the players stay empty as
   the test intends. `site.spec.mjs` tests the worker. The sample now runs in about 10 s.
4. **`man5:201`: left as is.** It fails only in Claude cloud containers, which run as root, because
   since #615 the PDF tool keeps Chromium's sandbox on. Neither the sandbox nor the test was touched;
   the GitHub Actions run (task 77) is where it runs green.

## Notes

- Reproduced on plain main (41b21e74): kit:87 threw "too much detail for a circular picture"
  (6.3 min); smoke:734 failed with 82,359 (and 82,306 to 83,233 across the bisect); tpg:205 passed
  here in 3.5 min of its 4 min limit, with 6 to 12 s per page after the second (timed per page).
- Bisect of smoke:734 (its title, one run each): d7b2ef4b (October 2) pass, 26fd8a90 (October 5)
  pass, 50af44bd (October 6) pass, 20a22840 (October 6) fail, 953f6e44 (October 7) pass, 9bb2e68f,
  0bf4746a, 9101fa2f, a0b68bc3, 3ec2a578, 574a68d3, 58f3d8ed, 11d83626 fail.

## Known issues

- kit:87 is long: 8.8 min alone in this container, with Picture QR now 10 s. Its limit went from 10
  to 15 min (`test.setTimeout`, the way Ops raised it on October 6; no check changed).
  The other slow builds are Studio and QR toys (splat-toolkit 37 s, moving-photo-3d 32 s, photo-3d
  31 s, qr-anatomy and qr-damage 24 s each, enigma-machine 23 s, how-ct 24 s). See "For the
  Operator".

## For the Operator

- Picture QR: Codex tasks 79 and 80 touch `src/packs/qr-craft.js`. This lane changes only
  `pictureSplats` (listed under "State", item 1). `codex/video-3d-r2` carries the same port as
  `c014e5cf6`; whichever lands second should take this branch's version (the same code plus the
  fine-level skip).
