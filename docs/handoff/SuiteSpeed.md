# Lane Suite speed: a faster full test run

Prefix `spd`. Branch `claude/lane-suite-speed`. Model: Opus 5.5, default effort. Owns this file, the
"Running the suite fast" section of `docs/OPERATING.md`, and small, additive speed changes to the
test files and `playwright.config.mjs`. How lanes work: [OPERATING.md](../OPERATING.md).

## Brief

Written by the Operator on October 7, 2026 (the owner's pick).

The full Playwright suite
(`SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test --workers=1`) takes the
Integrators hours on every merge, and that is now the biggest steady cost on the owner's weekly
usage. Make it much faster without weakening any test.

1. Measure first: run the suite (or large slices) with a JSON or line reporter and record per-file
   and per-test wall time. Put the table in this file and find where the time goes (app boot per
   test, waiting on `data-ready`, toy builds, screenshots, fixed sleeps, repeated work).
2. Fix the biggest costs, safest first. Ideas to weigh: share one booted page across a file's tests
   where they don't depend on a fresh page (`test.describe.serial` with a shared page or a
   worker-scoped fixture), replace fixed waits with waits on a real condition, cache built assets
   the tests rebuild, skip duplicate boots, and check whether `--workers=2` or sharding is safe in
   the cloud container (memory, SwiftShader) and document the command. Never loosen an assertion,
   raise a limit, add retries or skip a test; every test still checks what it checked.
3. Never edit `tests/taps.spec.mjs` without a note in the PR explaining why it was needed (if it is
   the big cost, propose the change in "For the Operator" instead of making it).
4. Prove it: before and after wall times for the full suite on the same container, and the same
   pass/fail list before and after (list any flake you see; don't fix flakes here unless they block
   you).
5. Add a short "Running the suite fast" section to docs/OPERATING.md (the Integrators' command).

Shared test helpers you change are engine-like: keep each change small and additive.

## State

READY: October 8, 2026, 17:45 UTC. Measured, fixed and proved: the full run takes 2 h 45 min with
`node tools/suite.mjs --gl=llvmpipe --jobs=2` against 5 h 24 min before. PR #416 (draft).

## Notes

### The baseline (main at 95610620, October 7 to 8, 2026)

The cloud container: 4 CPUs, 15 GB, Chromium with SwiftShader. Each file ran on its own
(`--workers=1`), because a single run of the whole suite was lost twice to container restarts (the
container restarts when the session sits idle for a while; the first run died at test 797 of 1,556
after 2 h 42 min).

- 170 files, 1,556 tests: 1,551 passed, 5 failed (all flakes or one-offs, below).
- **5 h 24 min** in test files, one after another.
- The time is concentrated: the 10 slowest files take 34% of it, the 20 slowest 50%, the 80 slowest
  88%. The slowest 10% of tests take about 87% of the time. 36 files take under 15 s.
- App boot is cheap: the toy box reaches `data-ready` in 1 to 1.5 s and a toy switch takes about 3
  s. Booting a fresh page per test is not where the time goes.
- One worker already keeps about 3 of the 4 CPUs busy: Chromium's GPU process (SwiftShader) uses
  about 2.3 cores while a test draws.

Failures in the baseline (each passed in the earlier, lost full run, or on a rerun):

- `chs-engine:11` (energy read 0 after a fixed 200 ms wait: timing).
- `hl1:75` (jellyfish rest height: "Level 1 gaps").
- `qrs-toys:37`, `smoke:1504` (the phone shelf grid), `stm:366` (a sample's text).

### Where the time goes

1. **Worlds boot (fixed).** Every `/worlds/` page took about 54 s to `data-ready`, at every tier.
   The build awaits a drawn frame (`requestAnimationFrame`) about 50 times to paint its progress
   bar, and each frame of the loading view takes about a second in SwiftShader at 1280x720 (117 ms
   at 320x240). The main thread sat idle for 51 of the 56 s. `wd`, `wdh`, `wdr3` and `chr` boot it
   dozens of times. With `?clock=manual` (which only the tests and the clip tools use) the build now
   yields with a zero-delay timer instead: the boot takes about 5 s, and those four files went from
   2,992 s to 1,928 s (50 min to 32 min) with all 39 tests passing and their eight screenshots
   pixel-identical to the baseline's.
2. **Tracing** (`trace: "retain-on-failure"`) costs about 5%: a sample of eight files took 909 s
   with `--trace=off` against 983 s. Not worth losing the failure traces.
3. **Two files at once** on one container gives only about 1.2x (the same sample: 13 min against 16
   min), because each file runs about 1.5x slower: SwiftShader already fills the CPUs. Separate
   containers (`--shard`) scale; one container doesn't.
4. **The rest is drawing.** Traces of the 13 slowest other files (2 h 53 min of test time) show the
   time in `waitForFunction` (1,552 s of the first five files' 2,555 s) and `evaluate`: tests
   waiting for the app's clock to pass a moment of an effect (`player.time > t0 + 3.3` took 18.5 s),
   for sheets to build, or for a toy to build. The app steps at most 0.1 s per frame, and a heavy
   scene draws at about two frames a second in SwiftShader, so its clock runs about five times
   slower than the wall clock. Few fixed sleeps (`waitForTimeout` is 93 s of those 2,555 s). The
   cost is pixels drawn by a software renderer.
5. **llvmpipe** (Mesa, installed in the container image with Xvfb) draws the same frames faster than
   SwiftShader: the Worlds loading frame 379 ms against 1,219 ms; toy frames 1.3x to 2.6x faster
   (the photo album 268 ms against 700 ms, the book 131 ms against 258 ms). Chromium reaches it only
   through desktop GL, so the browser runs headed in Xvfb (`SPLASHERY_GL=llvmpipe` in
   `playwright.config.mjs`; in headless mode Chromium falls back to SwiftShader). It also leaves CPU
   for a second file: the eight-file sample took 767 s alone and 8 min with two at once, against 983
   s (16 min) for the baseline. Three at once took 6.4 min but failed `f:116` (the Newton's cradle
   swing), so two.
6. **The full run with llvmpipe and two at once** (main at 95610620 plus the Worlds change): 2 h 19
   min of wall time against 5 h 24 min, 1,543 of 1,556 passed. The 13 failures: the four that also
   failed in the baseline (`smoke:1504`, `qrs-toys:37`, `hl1:75`, `stm:366`), and nine new ones,
   sorted by running each file again on its own:
   - Pass alone on llvmpipe, so they fail only beside another file (wall-clock checks): `bk:920` (a
     page pulled across the spine), `smd-moving:101` x4 (a clip plays within 3% of real time),
     `hec:176` (the hood flops), `ui2:214` (the CNN pad). They are the `solo` list in
     `tools/suite.json`: with `--jobs` above 1 they run at the end, one at a time.
   - Fail on llvmpipe even alone: `sndc-engine:27` (3 of 3; the sound must suspend within 100 ms of
     a tap, and on llvmpipe a page call takes 64 ms against 19 ms because the app draws more frames,
     so it suspends at about 112 ms) and `phy:66` (3 of 5; the pebble cairn settles differently).
     Both pass on SwiftShader (headed or headless). They are the `swiftshader` list: they run on
     SwiftShader in an llvmpipe run.
   - `chs-engine:11`, a baseline flake, passed.
7. **The final full run** (main at c6e3f11e merged in, 183 files, 1,652 tests, the Integrators'
   command): **2 h 45 min** of wall time (5 h 15 min in files), against 5 h 24 min for the 170 files
   of the baseline (about 5 h 35 min for today's 183, counting the 13 new files at their measured
   time). 1,640 passed, 12 failed. `--recheck` ran each failed file again, alone:
   - Fail alone too, as in the baseline: `smoke:1504`, `qrs-toys:37` (failures on main, both
     renderers; Known issues).
   - Pass alone: `f:116`, `heb:117`, `fl7:109`, `math:368`, `phf-engine:213`, `phy:64`, `spg:139`,
     and the baseline's flakes `stm:366` and `chs-engine:11`. Wall-clock checks a busy CPU upsets: a
     different handful each run. The ones from both fast runs make the `solo` list (bk, f, fl7, hec,
     heb, math, phf-engine, phy, smd-moving, spg), which adds an estimated 10 minutes to the next
     run (about 3 h).
   - `ui2:214` and `ui2:361` failed alone on llvmpipe in 2 of 3 runs and pass on SwiftShader: the
     `swiftshader` list (with `phy` and `sndc-engine`).
   - The same pass/fail list as the baseline, once the lists apply: `smoke:1504` and `qrs-toys:37`
     fail; `hl1:75`, `stm:366` and `chs-engine:11` are flakes on both.
8. **Scrollbars.** Headed Chromium draws scrollbars that headless hides (Playwright adds
   `--hide-scrollbars` only for headless), which narrowed the panel. The llvmpipe setting adds it,
   after the final run; with it, `ui2` and `phy` passed 2 of 2 on llvmpipe and the UI-heavy files
   (smoke, site, help, spg, math, ui3, ui4, ui5) passed but for `smoke:1504` (as on main) and
   `ui3:129`, which then failed 1 of 2 alone on llvmpipe (a control's value must still be above 0.95
   right after a tap; faster frames let it fall further in the same wall time) and passed in the
   SwiftShader baseline: it joins the `swiftshader` list.

## Known issues

- `qrs-toys:37` fails on main in the cloud container, on both renderers, alone or not (4 of 4 runs):
  800 ms after the camera snaps front on, the canvas screenshot must scan as "Splashery QR" and
  reads nothing. A fixed sleep; the QR lane could wait for the camera and the effect to settle.
- `smoke:1504` (a phone: dragging the shelf up opens a grid) fails on main, 3 of 3.
- Flakes seen on main at one file at a time: `chs-engine:11` (a fixed 200 ms wait), `hl1:75`
  (jellyfish rest height), `stm:366`.
- Two at once, a different handful of wall-clock tests can fail each run beyond the `solo` list;
  `--recheck` says which. The list will need a line now and then.
- `sndc-engine:27` can't pass on llvmpipe as written (a 100 ms window for the sound to suspend; the
  page answers more slowly while llvmpipe draws more frames). It runs on SwiftShader.
- `--gl=llvmpipe` needs Mesa and Xvfb, which the cloud image has; on a computer without them, use
  the default.

## For the Operator

- **Engine-like change, your call:** `src/worlds/world.js` and `src/worlds/main.js` (lane Worlds'
  files), in its own commit "Worlds: with ?clock=manual the build yields without waiting for a drawn
  frame" (4b69497a). Additive: only `?clock=manual` (tests and clip tools) changes, and the Worlds
  screenshots came out pixel-identical. If you want it as a separate "Engine:" PR merged first,
  cherry-pick that commit.
- `playwright.config.mjs` (shared): an opt-in `SPLASHERY_GL=llvmpipe`; with it unset the flags are
  the same, in the same order.
- No spec file was edited (`tests/taps.spec.mjs` included).
- The Integrators' brief can say: `node tools/suite.mjs --gl=llvmpipe --jobs=2 --recheck` in the
  background, check every 30 to 60 minutes, rerun the same command after a container restart (it
  resumes), and read `.cache/suite/summary.md`. A plain `npx playwright test` run loses everything
  when the container restarts, which happened three times in this lane's first eight hours (the
  session's container is reclaimed while it sits idle).
- For more speed: `--shard=1/2` and `--shard=2/2` in two Integrator sessions would halve the wall
  time again (each container has its own 4 CPUs).
- Proposals for the lanes that own them (not done here): `qrs-toys:37` and `chs-engine:11` wait on
  the effect instead of a fixed sleep; `sndc-engine:27` a less tight window.
