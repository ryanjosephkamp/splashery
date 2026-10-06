# ASCII capture (`AsciiCapture`, prefix `asc`)

Model: Opus 5.5, at the default effort.

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: ASCII capture (id `AsciiCapture`, prefix
`asc`). Model: Opus 5.5, at the default effort. Handoff file: docs/handoff/AsciiCapture.md (create
it; start it with this brief, word for word, under "## Brief", then keep "## State", "## Notes", "##
Known issues" and "## For the Operator" current).

### Brief (written by the Operator on October 6, 2026, from the owner's handoff of the Codex ASCII work)

The owner accepted a local demo, built with Codex, that turns a toy's animation into ASCII art and
exports it as a GIF. Two draft PRs hold that work: #335 (`src/export/ascii.js`, a deterministic
image-to-ASCII core, with a demo) and #352 (a capture and encoding prototype, evidence, and
`docs/audits/ascii-capture-encoding-prototype/integration-brief.md`). Read the integration brief
first, then #335's core and tests and #352's `capture-adapter.js`, `capture.mjs`, `encoders.js` and
`demo.js` (read them with
`git fetch origin codex/ascii-export-prototype codex/ascii-capture-encoding-prototype` and
`git show`). Don't push to the `codex/*` branches, don't edit or merge #335 or #352, and don't copy
their sample media.

Your job is a narrow browser-capture lab: a fresh four-second ASCII animation of one of three toys,
captured in a disposable same-origin iframe, converted with the one production ASCII core, and
downloaded as a GIF. Nothing else: no user files, no live input (camera, microphone, screen, device
motion), no sound, no custom scenes, no other toys, no capture of the person's current scene, no MP4
or WebM, no PDF or text-QR experiments, and no change to the existing export menu.

#### Three PRs, in this order (each a draft against `main`, merged by the Operator before the next one relies on it)

1. **Engine: the ASCII core** (branch `claude/lane-ascii-capture-core`). Allowed files, exactly:
   - `src/export/ascii.js`: byte-identical to #335's file at f2f02656 (sha256
     `04e436ddca7b011cc33f0233178b5048b6a369c7d2504faa74664f4487209950`). If review finds a real
     bug, fix it in a separate, named commit with a test, and say so in the PR.
   - `tests/asc-core.spec.mjs`: #335's first four tests from `tests/ascii-export.spec.js` (pixels,
     geometry and repeatability, bounds, canvas geometry and attribution), with the canvas test
     opening `/` instead of the audit demo, and nothing imported from `docs/audits/`. (#335's test
     file ends in `.spec.js`, which the suite's `testMatch` never runs.)
   - `docs/handoff/AsciiCapture.md`.
2. **Engine: a player's listeners leave with it** (branch `claude/lane-ascii-capture-engine`):
   `Player.init()` adds an anonymous `prefers-color-scheme` change listener and `watchDeviceShake()`
   an anonymous window `devicemotion` listener, and `destroy()` removes neither. The fix:
   `this.lifetime = new AbortController()` in `init()`, `{ signal: this.lifetime.signal }` on both
   `addEventListener` calls, and `this.lifetime?.abort()` in `destroy()`. Allowed files:
   `src/player.js` (those lines only; no other behavior change) and `tests/asc-engine.spec.mjs`.
   Small, additive and tested. The iframe host doesn't depend on it (removing the iframe drops its
   window's listeners), so it can run beside step 3.
3. **Phase ASCII capture: a fresh-toy ASCII GIF lab** (branch `claude/lane-ascii-capture`, labs).
   Allowed files, exactly:
   - `ascii-lab.html` (the lab page: the three presets, the ASCII settings the demo had (detail,
     color or mono), Capture, progress, Cancel, and the final explicit download) and
     `ascii-capture-host.html` (the minimal capture document: one fresh player, no app UI, not the
     embed page in `embed/`). Both use the same import map as `index.html`, carry
     `<meta name="robots" content="noindex">`, and are not linked from anywhere yet.
   - `src/ascii-capture/` (new): the job coordinator, the host script, the message protocol and its
     validation, a small GIF writer over the vendored `gifenc` (imported the way `src/exports.js`
     imports it; don't edit `src/exports.js` and don't add a second GIF library), and the credit
     footer. You may port #352's `gifDelays`, `validateFrames` and `withComment` from `encoders.js`
     (exact centisecond delays and the credit as a GIF comment block), naming their origin in a
     comment.
   - `tests/asc*.spec.mjs`, `tests/screenshots/asc-*.png`, `tools/asc-*.mjs` (for example a decode
     check and a device-evidence page or report), `docs/audits/ascii-capture-2026-10/` (small
     evidence files only: JSON, logs, a few screenshots; no video, at most 2 MB in all), and your
     handoff file.
   - Read-only (import, don't edit): `src/export/ascii.js`, `src/player.js`, `src/camera.js`
     (`getState`/`setState`), `src/pdf-export/capture.js` (its stepped clock), `src/toys.js` (each
     toy's `credit`), the packs, `src/pc.js`, `vendor/`. Not allowed: `src/exports.js`, the app's UI
     and export menu (`index.html`, `src/app.js`, `src/ui.js`), `embed/`, `site/`, `src/toys.js`
     entries, any pack, any other lane's files, and the shared lists (this lab is not a toy).

#### How it works

- Presets: `grapes`, `orange` (the whole orange) and `strawberry` (the credited CC BY 4.0 capture by
  Dany Bittel). Each is a fresh toy animation, labeled "Fresh toy animation": the fixed home camera,
  a single tap at frame 4, 420 pixels, 40 frames at 10 fps (four seconds), as in the prototype.
  Never call it a recording of what the person did.
- One job at a time: a second Capture is refused, not queued. Capture creates one same-origin iframe
  (renderable, noninteractive) for the job and removes it after success, Cancel, timeout, failure,
  the page becoming hidden, or navigation. Cleanup is idempotent and doesn't depend on a reply from
  the iframe; keep the iframe handle so teardown always works.
- Messages carry only a validated toy id, the known whole-orange option, the fixed capture settings
  and an opaque job id. Check each message's source window, origin, job id and type; bound payload
  sizes and the number of outstanding messages; ignore late messages from a finished job. Never pass
  a `Player` object or the main page's scene into the iframe.
- Don't port #352's `capture-adapter.js` as it is: it borrows a live player, keeps every frame as a
  PNG data URI, restores only part of the camera, and uses a flag lock
  (`stage.__asciiCaptureLocked`) that other captures ignore and a waiter wipe that can strand them.
  The host owns its own fresh player, so it needs no lock; build its fixed home camera and stepped
  clock on `camera.getState`/`setState` and the stepped clock in `src/pdf-export/capture.js`, and
  drop the test-hook expandos (`__asciiLastRestore`, `__asciiVideoCleanup`).
- Convert with a fixed `characterAspect` of 0.5 (not one measured from the device's fonts), so the
  grid is the same on every device; only the drawn glyphs may differ.
- The main page owns progress, Cancel, conversion (with `src/export/ascii.js`), the GIF encoding,
  attribution and the download. Convert each frame as it arrives and drop its pixels; keep one
  converted sequence and one output. Use a per-frame deadline and a 30-second job deadline; on
  failure say what happened and let the person retry, without silently lowering settings or offering
  a partial file. Revoke replaced object URLs.
- Every output frame shows the credit, read from the toy's `credit` in `src/toys.js` (title, author,
  license and changes for the strawberry; "Splashery, MIT" for the kit toys), and the GIF carries it
  as a comment block too, as the prototype did.
- Privacy: only local modules and assets; no permission prompts, no external requests, no uploads,
  and no writes to localStorage, sessionStorage or IndexedDB (a same-origin iframe can reach
  storage, so test it).
- If the lab page shows a live preview player, the capture must not write to it: its scene, camera,
  settings, controls and storage stay unchanged.

#### Acceptance (tests in `tests/asc*.spec.mjs`, evidence in your PR and handoff)

1. The three presets each capture, move, and keep their credit; changing the ASCII settings changes
   the output.
2. The downloaded GIF decodes (with the vendored `omggif` reader in the test): 40 frames, the
   expected size and delays, and the credit footer in every frame.
3. Success, failure and Cancel each leave no iframe, timers, owned listeners, object URLs or
   in-flight work, and offer no partial download.
4. Ten jobs in a row, and repeated Cancel mid-capture, show no growth in documents or owned handles;
   report measured memory (for example `performance.measureUserAgentSpecificMemory` where available,
   or the JS heap) rather than promising a GPU number.
5. Hiding the page or leaving it aborts the job, and no late message restarts it.
6. Without WebGL2 or with a failing renderer: a clear message, no claim of success.
7. Privacy checks above (request log, permission state, storage before and after).
8. The main page's preview player is unchanged by a capture.
9. The prototype's evidence is Mac-only (its CLI assumes Chrome.app and Metal, and its WebM test
   fails on Linux, where `video.duration` reads `Infinity`). Your tests must pass on this Linux
   container's Chromium.
10. Physical devices: you can't test real phones, so build `tools/asc-device-check.mjs` or a section
    on the lab page that shows the device's browser and version, the renderer, the job time, the
    output size and a decode result, for the owner to screenshot on his phone and send to the
    Operator. Record the desktop browsers you did run. A 390 by 844 viewport is not phone evidence.
11. Your specs and the scoped checks pass, `npx prettier --check .` and
    `node tools/us-english.mjs --diff` are clean, and the "embed transfer ≤ 30 MB" test stays green.
    Screenshots at 390 by 844 and 1440 by 900 as `tests/screenshots/asc-*.png`.

Post a short phone-size clip of each preset's GIF and of the lab page on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
(no republish).

#### What stays out (list it in your handoff as what remains before a release)

Wiring this into the existing export menu (the standing instruction keeps the menu as it is, so that
needs the owner's word), capture of the person's live scene, more toys, MP4 or WebM, the PDF and
text-QR experiments, a phone and browser matrix beyond the owner's spot checks, and the fate of #335
and #352 (the Operator closes or keeps them once your core PR merges).

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours), except that this brief's allowed files replace the
shared-list rule. Engine PRs merge after a full test run; the lab is labs, so the Operator merges it
after a full run too, and the owner decides any release. Finish every working turn with "READY:",
"WORKING:" or "BLOCKED:"; for a long job, schedule a check-in with send_later instead of going idle.
The push ends Wednesday, October 7, 2026, 4 p.m. ET (20:00 UTC): aim for the core PR within two
hours and the lab's first READY within about six.

## State

- Step 1, Engine: the ASCII core (`claude/lane-ascii-capture-core`): `src/export/ascii.js` copied
  byte for byte from #335 at f2f02656 (sha256 checked), `tests/asc-core.spec.mjs` with #335's first
  four tests (the canvas test opens `/`). 4 of 4 pass on this container's Chromium. Draft PR open.
- Step 2 (engine listeners) and step 3 (the lab): not started.

## Notes

- Review of the core found no bug that needs a fix commit. Two observations, left as they are:
  `renderTextCanvas` in color mode draws one `fillText` per cell (40,000 calls at 200 by 200), slow
  but correct; and a string `columns` such as `"96"` is rejected by the `Number.isFinite` check, as
  the bounds test expects.

## Known issues

- None yet.

## For the Operator

- Core PR ready for a full run and merge; nothing in it changes behavior elsewhere (a new module no
  page imports yet, and a new spec).
