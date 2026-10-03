# Lane QR scan lab: does every splat QR code scan? (prefix `qrl`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: QR scan lab (prefix `qrl`). Branch: `claude/lane-qr-lab`. PR
title: "Phase QR scan lab: does every splat QR code scan?". Handoff file: docs/handoff/QRLab.md.
Model: Sonnet 5.5.

### Brief (written by the Operator on October 3, 2026)

Lane QR (Opus 5.5, `claude/lane-qr`, prefix `qr`) is building a QR code generator made of Gaussian
splats: a Studio toy where people style a code (dots, bricks, gems, neon, gradients, motion) that
must still scan. The owner said that night to go hard on it. Your lane answers one question with
evidence: **which styles and settings scan reliably, and under what conditions?**

#### What to build

1. **`tools/qr-scan-lab.mjs`.** For each style × error correction level × a few color schemes, it
   renders the QR toy (Playwright, the local server on port 4173, `?labs=1`). It uses the toy's test
   hook, which lane QR documents in `docs/handoff/QR.md`. It then makes simulated phone captures of
   each render:
   - tilt from 0° to 35°;
   - module sizes from 2 to 12 pixels;
   - Gaussian blur;
   - JPEG noise;
   - an uneven light gradient;
   - mild perspective.

   It decodes each capture with **two** readers: jsQR (Apache-2.0) and zxing-js (Apache-2.0), as
   pinned devDependencies, listed in `LICENSES.md`. It writes the raw results as CSV or JSON.

2. **The scorecard**, in `docs/audits/qr-scan-lab-2026-10.md`:
   - a summary of at most ten lines;
   - the decode rate per style and condition, worst first;
   - the settings that fail and why (contrast, soft edges, depth shadows, glow bleeding into the
     light modules);
   - **recommended safe defaults and warning thresholds** for lane QR (minimum contrast, the lowest
     error correction level per style, the smallest module size).
3. **A regression test**, `tests/qrl.spec.mjs`: a fast subset (each style at its default, front-on
   and at 20°, small and large) that must decode, so later changes can't silently break scanning.
4. **A card on the Effect review page**: a grid image per style showing the hardest conditions it
   still passes.

#### Timing

Lane QR pushes a first working toy early. Until it does:

- build the harness against reference codes you draw yourself on a canvas from a pinned encoder;
- check that the readers and the capture simulation behave as expected on those.

Then wildcard-fetch `origin/claude/lane-qr` and run against the real toy. Never push to lane QR's
branch or edit its files (`src/qr/`, `src/packs/qr.js`, `vendor/qrcodegen/`, `vendor/jsqr/`,
`tests/qr.spec.mjs`). If you need something from the toy, say so in your final message, and the
Operator relays it. Rerun the lab whenever lane QR pushes a meaningful change, and keep the
scorecard current.

#### You own

`tools/qr-scan-lab.mjs`, `tools/qr-scan-lab/` (data), `docs/audits/qr-scan-lab-2026-10.md`,
`tests/qrl.spec.mjs`, your entries in `LICENSES.md` and `package.json` (devDependencies only,
pinned), and this handoff file.

#### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator. Don't ask him
  anything or wait for him. Put questions and blockers in your final message ("READY:", "WORKING:"
  or "BLOCKED:"), and the Operator answers or relays them. Messages that arrive "From the Operator"
  come from the coordinator on the owner's behalf.
- Model: Sonnet 5.5 only, at the default effort (the owner's split: tools and converters on Sonnet).
  At most one helper at a time, same model. Usage is tight this week: work efficiently, and run long
  jobs in the background.
- Merging: the Operator merges after a full test run. Never merge anything yourself.
- Language: every new text is in American English.
- Read first: CLAUDE.md, docs/OPERATING.md ("Steps for a lane"), docs/handoff/QR.md (lane QR's
  brief, and the test hook once it's documented), `tools/effect-clip.mjs` (how tools drive the toy).
- Your handoff file: start it with this brief, word for word, under "## Brief", then keep "## State"
  current.
- Before every push: CLAUDE.md, "Before every push".

## State

Starting, October 3, 2026.
