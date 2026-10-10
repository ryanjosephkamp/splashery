# Fix11: the suite's red and flaky tests

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session,
session_012GmKRUMZLir2nb27Bo8Cu2). Repo: ryanjosephkamp/splashery. Your lane: Fix11 (id `Fix11`,
prefix `fx11`). Branch: `claude/lane-fix11` (and `claude/lane-fix11-engine` for any change to the
app outside the named toys, as a small, additive "Engine: …" PR merged first). PR title: "Phase
Fix11: the suite's red and flaky tests". Handoff file: docs/handoff/Fix11.md (create it; start it
with this brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known
issues" and "## For the Operator" current). Model: Opus 5.5, at high effort (CLAUDE.md).

Read CLAUDE.md, docs/HANDOFF.md, docs/OPERATING.md, and docs/handoff/ScienceR3.md ("How this lane
runs", with your prefix and lane record).

### Brief (written by the Operator on October 10, 2026)

The full suite (`tools/suite.mjs`) has run six times on the Operator's batch merges in the last two
days. Seven tests fail on main every time, and five more fail only sometimes. Make every one of them
pass for the right reason.

Start from main at ad961bec. Batch 6 (#500: Kit lab and Live r9, both labs) is in its full suite
now; when it lands, merge main into your branch.

**Red on main** (the error each one gave on the Operator's runs):

1. `tests/smoke.spec.mjs:1504`, "dragging the shelf up opens a grid, and picking a toy folds it
   back": `Expected: 0, Received: 1`. It looks like one label is clipped in the phone grid.
2. `tests/qrs-toys.spec.mjs:37`, "How a QR code works: its code is the encoder's, and it scans": the
   decode returns `null` where it expects "Splashery QR". Find whether the toy's code really stopped
   scanning (a real bug, since QR r4 changed the QR family) or the test reads it the wrong way.
3. `tests/cmp2-engine.spec.mjs:9`, "every text option shipped before this change stays hidden":
   expected 1 entry, received 10. Find which text options now show and whether that's intended (a
   lane's approved change) or a leak out of labs.
4. `tests/hl1.spec.mjs:88`, "Hands-on: lift, toss, land, settle and Reset": "Level 1 gaps" for the
   teddy bear and the running shoe.
5. `tests/fl7.spec.mjs:49`, "the phone envelope …": `Expected: [20, 58, 20], Received: undefined`.
6. `tests/hh4-vehicles.spec.mjs:257`, "flying saucer: off the beam the cow stands on the grass;
   under it, it floats up": 0.944, where it needs more than 0.95.
7. `tests/stm.spec.mjs:366`, "a sample shows, a tap lifts and settles, opening your own models
   works": `.warning:visible` isn't visible.

**Flaky** (fail in the full suite, pass alone or on main some of the time):

- `tests/ai-engine.spec.mjs:7` (the drawing pad hands its drawing to `read()`: false).
- `tests/smd-moving.spec.mjs:101` (the bridge on a slow device: 0.0313, under 0.03 needed).
- `tests/phf-engine.spec.mjs:260` (it compiles and draws on WebGPU too).
- `tests/hh3-engine2.spec.mjs:122` (strings: a drag plucks each string in turn: none plucked).
- `tests/hh1-toys.spec.mjs:182` (origami crane: 0.443, over 0.5 needed). #494 changed this test on
  October 10; check it's settled.

How to do it:

- Reproduce each one first, under the suite's own load:
  `SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/suite.mjs --gl=llvmpipe --jobs=2 --files=<names> --out=.cache/fx11-<n>`
  (it runs each file in its own server; see the tool's header). For a flaky test, also run it five
  times under load (`-- --repeat-each=5`: anything after "--" goes to Playwright).
- Find the root cause, then decide whether the toy or the test is wrong:
  - If the toy broke (a real regression), fix the toy and keep the test as it was.
  - If the test checks something an approved change has since changed on purpose (find the PR and
    the owner's mark), update the test so it checks the new behavior just as strictly, and write in
    the commit and the handoff which PR changed it and why.
  - If it's timing, make the test deterministic (a fixed clock, waiting for a real ready signal,
    measuring after settling), as the Operator's earlier fixed-clock commits did. Lower a threshold
    only when you can show the measured value is right and the old bound was arbitrary, and say so.
- Never skip, disable, quarantine, or `test.fixme` a test, never add retries to hide a failure, and
  never edit `tests/taps.spec.mjs`. Never change what a toy looks like or does beyond the fix: these
  toys have the owner's "good" marks.
- These test files belong to other lanes, most of them finished. You may edit the seven failing
  tests and the five flaky ones, the toys they test, and `tests/fx11*.spec.mjs`. Don't edit anything
  a lane that is running now owns (WORKSTREAMS.md: Live r9, Kit lab, and anything newer) without
  asking the Operator first.
- Clips: only when a fix changes something you can see (for example, the shelf grid's label or the
  saucer's cow). Put them on Effect review page 2
  (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK), as docs/OPERATING.md, "Steps for a lane",
  says (no republish), with ids fx11-… and naming Opus 5.5.

At the end, run every file you touched plus `smoke`, `help`, `unit`, and `taps` with
`tools/suite.mjs` under load. Report each of the twelve tests with its root cause, the fix, and the
run that shows it green, in the PR's Summary.

How this lane runs: finish every working turn with "READY:", "WORKING:" or "BLOCKED:". For a long
job, schedule a check-in with send_later instead of going idle. Before READY, run CLAUDE.md's
"Before every push" steps. When main moves, merge it into your branch (never rebase). The Operator
merges your PR after its full suite. Aim for a first READY within about four hours. If a test needs
the owner's decision (a behavior he hasn't marked), put the question in your final message rather
than guessing.

## State

Model: Opus 5.5 (claude-opus-5-5), high effort. Branch `claude/lane-fix11` from main at ad961bec.

Reproduction run (October 10, 2026, `.cache/fx11-1`, llvmpipe, two at once): red as briefed for
`smoke:1504`, `qrs-toys:37`, `hl1:88`, `stm:366`; `hh3-engine2:122`, `smd-moving:101` (bridge and
dragon), `phf-engine:260` and `fl7:95` (the same race as `:49`) failed; `cmp2-engine`,
`hh4-vehicles`, `ai-engine` and `hh1-toys` passed in that run.

The twelve, one by one (root cause, fix, the run that shows it green):

1. `smoke:1504`: in progress (below, "Notes").
2. `qrs-toys:37`: **the test read it the wrong way.** The toy's code is right: the canvas shows
   exactly the encoder's 21 × 21 modules (sampled module by module: 0 differences), and jsQR reads
   it once the page's own words are out of the picture. The test screenshots the canvas element, and
   the HTML laid over it (the status line "How a QR code works · 43k splats" at the bottom left)
   came along; jsQR took a run of its letters for the third finder pattern (its locator returned a
   "finder" at (139, 695), the status line) and sampled a skewed 17 × 17 grid. Erasing just the
   status line from the same screenshot made it read. Not QR r4 (the QR lab's files don't use
   `src/qr/`), and main of October 5 fails the same way in this container. Fix: the screenshot hides
   everything but the canvas (Playwright's `style`), so it reads only the toy's pixels; the check is
   as strict as before.
3. `cmp2-engine:9`: **an approved change.** The one shown text option is the volume viewer's "Voxel
   size in mm (blank: the file's)", which #423 (lane Volume viewer, labs, merged October 8, 2026)
   shows on purpose: its brief has spacing "from the files … or typed in". Not a leak (the toy is
   labs). Fix: the test allows exactly that option by file and key, beside the Enigma's plugboard;
   any other shown text option still fails it.
4. `hl1:88`: **approved changes.** #433 (lane Hands-on H1, Toys) made the teddy bear a body piece
   with its arms and head on ropes, and #434 (Hands-on H1, Clothing) made the running shoe's laces
   ropes (pull a lace end to untie it), both pieces mode, merged October 9, 2026 in #457; a press
   takes a piece, not the whole toy. Fix, the file's own pattern: the teddy bear's place in the
   sample goes to the rubber duck (same shelf, kit, lifts whole: lift, toss, land, settle and Reset
   all measured, no gaps); every clothing toy is pieces mode now (hoodie, sunglasses, cap and shoe
   all measured "whole-pickup"), so the shoe stays the shelf's sample with an exact
   `["whole-pickup"]` in KNOWN, as the drum and the picture frame have.
5. `fl7:49` (and `:95`, the same cause): **timing.** `openLab` waited for `fluids.mode`, but the gas
   grid (`fx.gas`) comes after a dynamic import (`FluidRuntime.startGasFx`), so a busy machine read
   it as undefined. Fix: `openLab` waits until a scene with gas has its grid (a real ready signal);
   the checks are unchanged.
6. `hh4-vehicles:257`: passed in the first run; repeats under load pending.
7. `stm:366`: **timing.** The test waited for the model's name in the toy's data, which the build
   sets before the app draws the Toy tab again (`onToy` → `setToyPanel`). Under load the panel came
   back after the next file's message, replacing the shown warning with a fresh hidden one. Fix:
   after each model, wait for the input panel's line to name it (the redrawn panel); the warnings
   are checked as before.

Flaky:

- `hh3-engine2:122`: **timing.** The turntable starts after 2.5 s without a touch; under load the
  view turned under the drag and the finger ended short of the high string (0 to 4 plucked, not 5).
  Fix: the view holds still (turntable off, snapped to its target) before the string's screen points
  are worked out.
- `ai-engine:7`, `smd-moving:101`, `phf-engine:260`, `hh1-toys:182`: in progress.

## Notes

- `smoke:1504`: the clipped label is "Leaning Tower of Pisa" in the phone row: 3 lines at 10.5 px in
  a 64 px card (scrollHeight 36 against 24), so the 2-line clamp cuts it. It fails the same on main
  back to October 5 in this container (fonts: Inter is the system sans-serif here).

## Known issues

- None yet.

## For the Operator

- Nothing yet.
