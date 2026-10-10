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

1. `smoke:1504`: **a real defect in the phone shelf (with some fonts).** "Leaning Tower of Pisa"
   needs three lines in a 64 px phone card with this container's sans-serif (Inter), and the 2-line
   clamp cut it; main fails this way here back to October 3. The Operator's call (October 10, 19:42
   UTC): keep the name, fix the card. Fix ("Engine:", `src/ui.js`): a name that still needs a third
   line steps its font down from 10.5 px (10, 9.5, 9 px at the least); the card keeps its size,
   every other name is untouched, and the fit is measured again for the grid (wider cards, where the
   name fits at full size). Screenshots `tests/screenshots/fx11-shelf-row-390x844.png`,
   `…-grid-390x844.png`, `…-row-320x844.png`, `…-grid-320x844.png`: no public name cut at either
   width. Three labs names still need three lines at 9 px in the row ("Cherry blossom (photo)", "The
   solar system on real orbits", "Super-resolution microscope"; they fit in the 390 px grid): see
   "Known issues".
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
   sample goes to the balloon dog (same shelf, kit, lifts whole: lift, toss, land, settle and Reset
   all measured, no gaps, the same exterior gap, -0.012, run after run; the rubber duck, tried
   first, landed in a different pose each run and once missed the rest-height bound); every clothing
   toy is pieces mode now (hoodie, sunglasses, cap and shoe all measured "whole-pickup"), so the
   shoe stays the shelf's sample with an exact `["whole-pickup"]` in KNOWN, as the drum and the
   picture frame have.
5. `fl7:49` (and `:95`, the same cause): **timing.** `openLab` waited for `fluids.mode`, but the gas
   grid (`fx.gas`) comes after a dynamic import (`FluidRuntime.startGasFx`), so a busy machine read
   it as undefined. Fix: `openLab` waits until a scene with gas has its grid (a real ready signal);
   the checks are unchanged.
6. `hh4-vehicles:257`: **not fixed.** The drags are worked out in screen points once; the turntable
   changes where the cow lands (1.015 from the middle with the view still, 1.075 with it running),
   but holding the view still made it worse under load (4 of 4 failed beside 1 of 4 for the test as
   it was, same run, `.cache/fx11-h3`), and pausing the page's own frames so only the test's clock
   runs failed 3 of 3. Both were reverted; the test is as on main. Next step: find what in the
   page's real frames moves the cow between the drag and the clock steps.
7. `stm:366`: **timing.** The test waited for the model's name in the toy's data, which the build
   sets before the app draws the Toy tab again (`onToy` → `setToyPanel`). Under load the panel came
   back after the next file's message, replacing the shown warning with a fresh hidden one. Fix:
   after each model, wait for the input panel's line to name it (the redrawn panel); the warnings
   are checked as before.

Flaky:

- `hh3-engine2:122`: **not fixed.** Logged under load (`.cache/fx11-h2`): the strum starts, then the
  canvas gets a `lostpointercapture` part way through the drag (after 7 to 17 of the 24 moves),
  which ends the tool (`camera.js` treats it as a pointer up), so the later strings are never
  crossed. What drops the capture is not found yet (nothing in `src/` releases it). The turntable
  change was reverted; the test is as on main.
- `ai-engine:7`: **timing.** The failing check is the last one (after Clear, the read is all zeros).
  `read()`'s options go to `setToyOptions`, which rebuilds the toy and draws the Toy tab again with
  a new pad that starts from `value()`; on a busy machine the new pad came after the Clear click, so
  the second read had the starting drawing. Reproduced 1 in 10 on llvmpipe (`.cache/fx11-ai2`). Fix:
  the pad drawn on is marked, and Clear waits for the new pad; 15 of 15 after (`.cache/fx11-ai3`).
- `hh1-toys:182`: #494's settle (120 manual frames) fixed the main cause. Those two seconds of clock
  also start the turntable, which moved the crane under the pull a little (held angle 0.593 still,
  0.573 with the turntable running): the turntable stays off now.
- `smd-moving:101`: **timing (the measurement).** `played()` stamped each clip position when its 10
  ms polling loop next saw it. On a busy machine (two to five frames a second on the low tier) the
  frame drawn after the drive held the page for up to a third of a second, and that lag differed at
  the two ends: measured, the clip's position trailed the sound's clock by 0 to 0.35 s at the moment
  the loop saw it. Fix: `played()` wraps the recipe's drive and stamps each position there; the 3%
  bound stays. Under heavy extra load (three CPU-bound processes beside it, more than the suite's
  solo slot ever has) the sound itself plays slow (the audio element's `currentTime` gains 0.118 s
  in 0.179 s), and the picture follows the sound, as designed: a few runs still miss by 3 to 5%
  there.
- `phf-engine:260`: **a real bug** (WebGPU validation errors in the console; the test was right to
  fail). A stack taken at the failing frame: the engine makes its 1 × 1 fallback texture for an
  unset sampler on first use (`built-in-texture-pink`), here inside the photo toy's work-buffer
  pass; uploading it calls `device.submit()`, which finished the command encoder with the pass still
  open, so the frame's command buffer was invalid. Fix ("Engine:", `src/stage.js`): on WebGPU a
  submit asked for inside a render pass waits for the frame's own (the upload still goes through the
  queue); and the photo texture is uploaded when it is made, not at its first use. Under heavy load
  (three CPU-bound processes beside it, 12 repeats of the file): before, 2 to 3 failures in 60
  (`.cache/fx11-p2`, `-p6`, `-p7`); after, no command-buffer errors in 60 (`.cache/fx11-p10`).

## Notes

- `smoke:1504`: the clipped label is "Leaning Tower of Pisa" in the phone row: 3 lines at 10.5 px in
  a 64 px card (scrollHeight 36 against 24), so the 2-line clamp cuts it. It fails the same on main
  back to October 5 in this container (fonts: Inter is the system sans-serif here).

## Known issues

- Three labs names need a third line in the phone row even at 9 px and stay cut there: "Cherry
  blossom (photo)", "The solar system on real orbits" and "Super-resolution microscope" (they fit in
  the 390 px grid). The Operator's call (October 10, 2026, 20:33 UTC): leave them, no smaller font
  and no third line; their lanes can shorten them later. `smoke:1504` runs with labs off and passes.

- `phf-engine:260` failed once in 12 under the heavy extra load with a different check: the text's
  correlation came out -0.10 (0.8 needed), with no console error. It had come out NaN once before
  the engine fix too (`.cache/fx11-p2`), so it isn't from the fix; the suite runs the file alone.

- `phf-engine:219` failed once in 40 under heavy load with a WebGL error on leaving the photo toy
  (`GL_INVALID_OPERATION: glDrawElementsInstanced: Mismatch between texture format and sampler type`).
  Not one of the twelve; noted for the Photo fidelity work.

## For the Operator

- Merge the "Engine:" PR #502 first (`claude/lane-fix11-engine`: the phone card's name fit and the
  two WebGPU changes); #501 has it merged in.
