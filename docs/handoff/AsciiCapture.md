# ASCII capture (`AsciiCapture`, prefix `asc`)

Model: Opus 5.5, at the default effort.

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: ASCII capture (id `AsciiCapture`, prefix
`asc`). Model: Opus 5.5, at the default effort. Handoff file: docs/handoff/AsciiCapture.md (create
it; start it with this brief, word for word, under "## Brief", then keep "## State

- Step 1, Engine: the ASCII core: PR #356 (`claude/lane-ascii-capture-core`). `src/export/ascii.js`
  byte for byte from #335 at f2f02656 (sha256 checked), `tests/asc-core.spec.mjs` with #335's first
  four tests (the canvas test opens `/`). 4 of 4 pass. Ready for a full run and merge.
- Step 2, Engine: a player's listeners leave with it: PR #357 (`claude/lane-ascii-capture-engine`).
  `tests/asc-engine.spec.mjs` passes on the branch and fails on main. Ready for a full run and
  merge.
- Step 3, Phase ASCII capture: PR #358 (`claude/lane-ascii-capture`, labs). It carries #356's commit
  until #356 merges, then merges main. Built and tested:
  - `ascii-lab.html` and `ascii-capture-host.html` (noindex, unlinked, the index.html import map).
  - `src/ascii-capture/`: `protocol.js` (presets, fixed settings, message checks), `host.js` (one
    fresh player, stepped clock, home camera held with `camera.setState`), `job.js` (one job, one
    iframe, deadlines, teardown), `gif.js` (gifenc; `gifDelays`, `validateFrames`, `withComment`
    ported from #352), `credit.js`, `lab.js` (the page and its device check).
  - Specs: `tests/asc.spec.mjs` (5 tests, all pass), `tests/asc-unit.spec.mjs` (4, all pass),
    `tests/asc-repeat.spec.mjs` (ten jobs and five cancels).
  - `tools/asc-clips.mjs` renders the review clips.
  - Evidence in `docs/audits/ascii-capture-2026-10/` (624 KB): the ten-job and five-Cancel
    measurements (`repeat-jobs.json`, flat: 1 document, 31 listeners, JS heap 2.7 to 2.8 MB) and a
    contact sheet of each preset's GIF.
  - Clips posted on Effect review page 2 (lane record `AsciiCapture`): `asc-grapes`, `asc-orange`,
    `asc-strawberry` (each preset's GIF, 72 columns, color) and `asc-lab-page` (the lab at 390 by
    844 during a capture).
  - Checks run: `tests/asc.spec.mjs` 5 of 5, `tests/asc-unit.spec.mjs` 4 of 4,
    `tests/asc-repeat.spec.mjs` 1 of 1 (6.4 minutes), `tests/asc-core.spec.mjs` 4 of 4, the embed
    transfer test (8.9 MB), `npx prettier --check .` and `node tools/us-english.mjs --diff` clean.
    The full suite was not run here.

## Notes

- Review of the core found no bug that needs a fix commit. Two observations, left as they are:
  `renderTextCanvas` in color mode draws one `fillText` per cell (40,000 calls at 200 by 200), slow
  but correct; and a string `columns` such as `"96"` is rejected by the `Number.isFinite` check, as
  the bounds test expects.
- How a job runs: Capture makes one iframe (140 by 140 CSS pixels, visible so it keeps rendering,
  `inert`, `pointer-events: none`, `allow` denying camera, microphone, display capture, location,
  the motion sensors and fullscreen). The host says `ready` (its job id comes in the URL hash), the
  lab sends `start` (toy id, the whole-orange option, the fixed settings), the host loads a fresh
  player (WebGL2, the device's own profile, no adaptive step-down) and says `loaded` with the
  renderer and profile, then sends one frame's pixels at a time (a transferred 420 by 420 RGBA
  buffer) and waits for the lab's `next`. The lab checks source, origin, job id, type, shape and
  order, at most 43 messages a job, converts each frame at once (`characterAspect` 0.5) and drops
  its pixels, removes the iframe after frame 40, encodes the GIF and offers one download. Every
  ending (success, Cancel, a deadline, a host error, a protocol error, `visibilitychange` to hidden,
  `pagehide`) goes through one idempotent teardown: both timers cleared, the AbortController that
  owns every listener aborted, the iframe removed.
- Deadlines: 8 seconds a frame once the toy has loaded; 30 seconds for the whole job. `?deadline=`
  (30 to 180 seconds) and `?profile=` on the lab URL are test and diagnosis knobs, not settings for
  people (the Operator's call of October 6, 2026). This container renders on SwiftShader (CPU): a
  job takes about 35 seconds (grapes, orange) and about 106 (strawberry, about 2.5 seconds a frame),
  so the tests use `?deadline=180`.
- The lab page has no live preview player of its own (acceptance 8 then holds by construction): the
  test checks that the lab document never makes a WebGL or WebGPU context; only the iframe does.
- Privacy test: every frame logs storage writes (`setItem`, `removeItem`, `clear`, IndexedDB `open`
  and `deleteDatabase`) and media, location and motion-permission calls; the test expects none, the
  same localStorage, sessionStorage and IndexedDB names before and after, the same permission
  states, and no request outside the origin.
- The GIF footer check compares bands with a tolerance of 24 levels: each frame has its own
  quantized palette, so edge grays move a little between frames.
- Desktop browsers run: Chromium 141.0.7390.37 (Playwright's, on Linux, SwiftShader). No other
  browser was available here.

- Levels (the owner's note of October 6, 2026, on the grapes, orange and strawberry clips: "seems
  visually dim or dark. Can we make this brighter somehow?"): `src/ascii-capture/levels.js`. The
  first frame sets the job's `contrast` (the 95th percentile of its lit pixels maps to 95% of the
  character ramp, between the core's 1.3 and 3); in color mode every glyph color is scaled (hue
  kept) until its top channel reaches 250, then tinted 15% toward white. The core is unchanged (only
  its `contrast` option is passed), and the GIF's comment records the contrast. Mean glyph luminance
  before and after: grapes 60 to 103, orange 94 to 109, strawberry 66 to 100; the credit footer is
  unchanged (`docs/audits/ascii-capture-2026-10/brightness.json`).

## Known issues

- (Fixed October 6, 2026, the Operator's call) The capture used to force the "high" profile. It now
  uses the profile the app would pick for the device at start (`detectProfile()` in `src/player.js`,
  read-only), held for the whole job (no adaptive step-down) and shown in the Device check, so a
  phone loads the light strawberry. Tests force `?profile=high` for repeatable output.
- The capture iframe logs "Potential permissions policy violation" lines in the console (one per
  denied feature) and "devicemotion events are blocked": that is the `allow` policy working.

## What remains before a release

- Wiring this into the existing export menu (needs the owner's word), capture of the person's live
  scene, more toys, MP4 or WebM, the PDF and text-QR experiments, a phone and browser matrix beyond
  the owner's spot checks, and the fate of #335 and #352 (the Operator's call once #356 merges).
- Phone evidence: open `ascii-lab.html` on the phone, tap Capture, and screenshot the Device check
  box.

## For the Operator

- #356 and #357 are ready for a full run and merge. #358 merges main after #356.
- The `?deadline=` override is confirmed (the Operator, October 6, 2026) as a test and diagnosis
  knob.
