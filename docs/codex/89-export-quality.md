# Codex task 89: Exports at full quality (the GIF, the video, and Record)

**Branch:** `codex/export-quality`, cut from `main`. One draft PR against `main`. Clips and sample
exports over 1 MB go on `codex/export-quality-clips`, never merged. Read `AGENTS.md`,
`builders/RULES.md`, CLAUDE.md, and `docs/SCENE-SCHEMA.md` first.

## Why

The owner's walkthrough of the Share tab on October 15, 2026 (his notes are private; this is the
Operator's summary). Exports should default to high quality everywhere, and people can lower it if
they want. What's special about each toy is its effect, so the effect loop should be the default,
not the turntable. A recording is the main thing people will share, so it must look great on a phone
after it's saved. The Operator checked today's code on `main` (`5c83a287`):

- **GIF** (`app.exportGIF`, `src/exports.js` `encodeGIF`): Turntable by default; 24, 48 (default),
  or 72 frames over a 4-second loop; 256, 384, or 512 px (default 512), always square. It renders on
  the main `#stage` canvas at size × size (`stage.setFixedSize`, pixel ratio 1) and reads each frame
  back. The 512 cap goes back to the v1 spec; nothing in the code needs it.
- **WebM** (`app.exportWebM`, `recordWebM`): 3, 5 (default), or 8 seconds, always a turntable, 720 ×
  720, MediaRecorder at 6 Mb/s. Frames are paced in real time at 30 fps, so a slow device drops
  frames.
- **Record** (`app.startRecord`, `startRecording`): `RECORD_LIMIT = 60` seconds. Size is the CSS
  size × min(devicePixelRatio, tier cap, 1920 / long side); the low tier caps at 1.5. At most 30
  fps, video at 8 Mb/s, audio at 128 kb/s. H.264 MP4 first, then VP9 or VP8 WebM.
- **Overlays:** all four exports read only the WebGL canvas, so the depth slider (`#stage-dial`) and
  every other on-page control are already left out. Nothing locks that in yet.

## The work

1. **One table of choices and defaults:** `src/export/presets.js` lists every export choice and its
   default (kinds, frames, sizes, lengths, frame rates, quality levels), with a short comment on why
   each limit exists. The Share tab, the exporters, and the batch export (task 90) all read it. Keep
   today's element ids (`gif-kind`, `gif-frames`, `gif-size`, `webm-seconds`, `record-start`,
   `import-json`) and fill their choices from the table, because a Claude lane is redesigning the
   Share tab's layout at the same time (see "Who owns what").
2. **The GIF:**
   - Effect loop is the default. Keep Turntable as a choice.
   - Frames: 48, 72 (the default), 96, and 144.
   - Sizes: 512, 720 (the default), and 1080 px. Add **Match the picture**: for a toy with a source
     picture or clip (Photo to 3D, Moving photo to 3D, Video to 3D), the GIF keeps the source's
     shape, with its long side at the chosen size. Other toys stay square.
   - Encode frame by frame so memory stays flat: never hold every frame in memory at once.
   - Before saving, show an estimated file size, and refuse with a plain message when a choice can't
     fit on this device (say why). Measure the real sizes and times on the software renderer for
     three toys and report them.
3. **The video (today's WebM button):**
   - Render frames on a stepped clock, not in real time, the way `tools/effect-clip.mjs` does. Every
     frame is drawn, so a slow device takes longer but never drops a frame.
   - Encode H.264 MP4 with WebCodecs where the browser has it, because MP4 plays on every phone. Use
     VP9 WebM where it doesn't.
   - A muxer library may be vendored under MIT, Apache-2.0, or BSD (Vanilagy's `mp4-muxer` and
     `webm-muxer` are MIT). Load it only when someone saves a video, and list it in `LICENSES.md`.
     Ask the Operator first for anything else.
   - Effect loop (the default) or Turntable.
   - Lengths of 4, 8 (the default), 15, and 30 seconds. A clip longer than its effect plays the
     effect again from the start.
   - Sizes of 720, 1080 (the default), and 1440 px, plus Match the picture as for the GIF. 30 fps by
     default, with a 60 fps choice.
   - A bitrate that scales with the size (for example about 12 Mb/s at 1080p30). Say what you chose
     and why.
   - The button's label says "Video" (not "WebM") once the file can be MP4.
4. **Record:**
   - Raise the limit from 1 minute to 10 minutes. Add a size budget that stops the take with a clear
     notice before the device runs short of memory, with a warning at 80%. Measure it, and pick
     separate budgets for phones and computers. Say whether a long take is held in memory or written
     to disk as it goes.
   - Quality: keep today's rules as **Standard**. Add **High** (the new default: the long side up to
     2560 px on a computer and the full screen size on a phone, with the bitrate scaled to match)
     and **Max** (computers only, the long side up to 3840 px, when the device keeps up). The tier
     cap may not lower High or Max below what the screen shows.
   - Measure the result: record a fixed scene at each level, then compare the saved file's frames
     with the live canvas (sharpness and SSIM). Report the numbers.
   - Hand the finished recording to the UI as a `Blob` with its type, length, and size, so the Share
     lane can add a preview player. Don't build the preview yourself.
5. **No overlays in any export, locked in by a test:** in a new `tests/cdx-export.spec.mjs`, open
   Photo to 3D with its depth slider showing, save a PNG, a GIF, a video, and a short Record take,
   and check that no frame contains the slider (compare the slider's screen area with a render that
   has no slider, or use a marker color). Do the same for the "Show the original" card and the toy
   slider.
6. **Old saves keep working:** scene JSON v2 and v3 and old `#s=` links load as before. Export
   settings are never written into a saved scene.
7. **Tests:** the new spec also checks the defaults (Effect loop, 72 frames, 720 px, and an 8-second
   1080p video), Match the picture on Photo to 3D, the stepped video's frame count (length × fps,
   none dropped), and the Record limit (with a test-only short budget, as `ui5-engine` does today).
   Where an existing test asserts an old default (`ui5-engine.spec.mjs:114` expects "/ 1:00"),
   update it to the new default and say so in the PR. Never loosen what it checks.

## Who owns what

- **Codex owns:** `src/exports.js`, a new `src/export/` folder, the export functions in `src/app.js`
  (`exportGIF`, `exportWebM` or its successor, `startRecord`, `withCapture`), and the `<option>`
  lists of the existing export controls.
- **The Claude lane "Share" owns** the Share tab's layout, the tab order, and the recording preview
  (its handoff file is `docs/handoff/Share.md`). Don't move or restyle the Share tab's controls.
- **Merges:** whichever PR merges second merges `main` into its branch and settles the overlap. A
  change to `src/stage.js` or `src/player.js` (the engine) goes in its own small "Engine: …" commit,
  additive, with a test showing nothing else changes.

## Rules

This changes what the public sees, so the PR waits on the owner's look. Show him phone-size and
desktop clips of each export at its new default, and before and after file sizes, on the clips
branch. No server, no network calls, nothing uploaded. Files are saved only where the person
chooses. American English and the serial comma. Before you push, `npx prettier --check .`,
`node tools/us-english.mjs --diff`, and your new spec are clean. The test suite on GitHub Actions
runs the quick checks on your PR. The full suite runs on the Operator's merge PR (or on yours when
the Operator adds the `full-suite` label), and any failure not marked "(known on main)" is yours to
fix. PR body with Summary, Verification, Deviations, Known issues, and What was cut.
