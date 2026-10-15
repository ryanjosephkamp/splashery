# Codex task 84: Evidence for the demo route (Photo to 3D, Moving photo to 3D, and the QR codes)

**Branch:** `codex/advisor-route-evidence`, cut from `main`. One draft PR against `main`.
Screenshots and clips over 1 MB go on `codex/advisor-route-evidence-clips`, never merged. Read
`AGENTS.md`, `builders/RULES.md`, CLAUDE.md, `docs/studio/photo-3d-checkpoint.md`, and the
checkpoint files for `moving-photo-3d`, `qr-code`, and `qr-picture` under `docs/studio/` once they
are on `main`.

## Why

The owner will show three things first: **Photo to 3D** (`photo-3d`), **Moving photo to 3D**
(`moving-photo-3d`), and the **QR codes** (`qr-code`, `qr-picture`, and `qr-three`, plus the share
QR in the share sheet). All are behind the labs switch (`?labs=1`). A recent outside review was a
static read of the code and could not open a browser, so nothing yet shows these routes working end
to end. This task builds a repeatable check that records real evidence, runs on GitHub Actions now,
and runs again later on the owner's Mac with a real graphics chip. It fixes nothing in the toys.

## The work

1. **A route runner,** `tools/adv-route.mjs` (Playwright, run on demand, not part of the suite),
   that walks the steps below and saves its evidence (screenshots, timings, decoded text, console
   errors, failed requests) to `docs/audits/advisor-route-2026-10/`. Every record names the build
   commit, the toy id and URL, the fixture and options, the browser, the graphics backend (`WebGL2`
   or `WebGPU`, and the renderer string), the labs and storage state, numbered steps, expected and
   actual results, and how many of three runs passed. Plus a short regression spec,
   `tests/cdx-adv.spec.mjs`, for what must always hold: each of the three toys opens with no console
   error, and each QR route's exported code decodes to its payload.
2. **Photo to 3D:** a fresh load (empty storage); the shipped sample; a local still (a fixture
   already in the repo); Sharp picture versus Splats; orbit and the depth slider; reset; back to the
   sample; save the scene and reopen it. Front and oblique screenshots with the exact settings.
   Describe depth as estimated, never as measured geometry.
3. **Moving photo to 3D:** first load; play, pause, and seek; loop and end; the sample and a local
   clip; switching sources five times; back to the still photo; reload. Record the time to the first
   drawn frame and the frame-time spread while playing, and say how you measured them. Don't use
   Video to 3D results for this toy.
4. **QR:** keep the share QR, Picture QR, and Three QR apart. Use one payload throughout (default
   `https://ryanjosephkamp.github.io/splashery/`, overridable with `ADV_PAYLOAD=...`). For each:
   decode the on-screen code from a screenshot and the exported PNG with jsQR and zxing (both are in
   `vendor/`), at phone size, with the theme, contrast, and quiet zone recorded, and report the
   decoded text exactly. A generated code or a screenshot is not a phone scan: mark "scanned with a
   second phone" as **blocked, needs the owner** in the report.
5. **A recipient opening a link:** open each route's share link in a fresh browser context with
   empty storage. For a scene built from a local file, record exactly what a recipient sees (the
   link carries settings and file details, not the file), and whether the message says so clearly.
6. **A report,** `docs/audits/advisor-route-2026-10/README.md`: a table with each step, its result
   (passed, failed, or blocked, with the smallest missing input), and links to the evidence. A
   failure gets a reproduction record and names the task that owns that toy (Photo to 3D: task 76,
   PR #622; Moving photo to 3D: task 48, PR #560; Picture QR: tasks 79 and 80; Three QR: task 72);
   don't fix it here.
7. **A real-device mode:** `ADV_REAL_GPU=1` skips the software-renderer settings so the owner's Mac
   can run the same script later. Note in the report which results the cloud's software renderer
   can't speak for (smoothness, real load times, WebGPU).

## Rules

No change under `src/`, `assets/`, or `vendor/`, and no change to these toys' tests. Images in the
repository at most 1 MB each. American English and the serial comma. Before you push:
`npx prettier --check .` and `node tools/us-english.mjs --diff` are clean, and the new spec passes.
A route step that fails is a finding for the report, never a reason to loosen a check. The test
suite on GitHub Actions runs the quick checks on your PR; the full suite runs on the Operator's
merge PR (or on yours when the Operator adds the `full-suite` label) and posts its result as a
comment. PR body with Summary, Verification, Deviations, Known issues, and What was cut.
