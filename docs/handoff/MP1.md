# Lane MP1: Moving photo to 3D, fixed, sharper, and measured for its depth over time

## Brief

(Written by the Operator on October 17, 2026; summarized.) Lane MP1 (prefix `mp1`), Opus 5.5 at high
effort, branch `claude/mp1`, PR "Phase MP1: Moving photo to 3D fixes, sharper, and a depth-stability
study". The toy is labs.

1. Fix the Start slider and the Sharp view's lag on the short Big Buck Bunny clip, with tests.
2. Sintel as the default sample; old links that name a sample still open it.
3. Sharpness: find why the films are soft at 400k splats and why Sharp looks worse than Splats; fix
   what is in the toy; check Max depth against an older commit and restore it if it regressed;
   measure before and after.
4. Depth over time: measure frame-to-frame jitter and depth range on the riding-horse GIF and two
   other samples; try temporal smoothing, a steadier depth scale, and keyframes; ship the best
   behind an option if it clearly wins; write the rest up in
   `docs/audits/moving-photo-depth-2026-10.md` for a Codex follow-up.
5. More and longer clips under licenses the site can use, recorded in CREDITS.md and
   tools/assets.json. Ask the Operator before dropping anything.

Files: the Moving photo to 3D code, its samples and records, and `tests/mp1.spec.mjs`. Not Video to
3D or Photo to 3D.

## State

- WORKING. See "What changed" and "Open questions for the Operator".

## What changed

- **The short bunny's lag in the Sharp view.** Its sound was the Screen toy's MP4, and since round 4
  (October 16) that video element was also the Sharp view's picture: each frame read a playing video
  into the texture. On a low tier in the test browser that held the Sharp view to about 3 frames a
  second, against about 8 for Sintel's short clip (and 10 to 16 with the bunny's video taken out).
  The bunny now has its own MP3 (`bunny.mp3`, cut from the same six seconds) like the other four
  short samples, and its Sharp view draws its own frames. Opened clips keep their video.
- **Sintel's 30-second film is the default** (`DEFAULT_CLIP`). A link or scene that names a clip
  (`clip: "sample"` among them) still opens it.
- **Max depth.** It did regress: Codex task 32 (October 10) set one depth range for the whole clip,
  which squeezed clips whose model scale wanders (Sintel's short clip went from 0.79 to 0.27 of the
  Depth slider's range, Inside the machine from 0.86 to 0.34). See "Depth over time".
- **Depth over time** (`STEADY`, the Toy tab's "Depth over time"): the default is now a rolling
  range in each shot (`rollingRanges` and `shotStarts` in `src/live/clip-stabilize.js`), which
  restores most of the relief at the same twitch-to-relief ratio as October 10's way; that way stays
  as "Steadiest". Measured by `tools/mp1-depth-study.mjs`.
- **Sharper films.** The 30-second films were cut from archive.org's 240-pixel derivatives (564 by
  240 for Sintel, 416 by 240 for the bunny). They are now cut from the masters on the same
  archive.org items and encoded 960 pixels wide (`tools/cdx-mp2-samples.mjs --video-only`), and
  their depth baked again from every frame (`tools/cdx-mp2-r4-bake.mjs`).
- **Two more films** from Blender Studio (CC BY 4.0): a pink forest from Cosmos Laundromat (30 s)
  and a camp in the woods from Sprite Fright (one minute).

## Open questions for the Operator

- The "Start (s)" slider is Video to 3D's (`src/packs/video3d.js`), which this lane may not touch.
  Moving photo to 3D has no Start slider; its seek slider works (tested). Should Video to 3D's be
  looked at by another lane?
- "Forest path, walked" is a Video to 3D sample too (`src/video3d/samples.js`), not Moving photo to
  3D; left alone.
