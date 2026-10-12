# Codex task 40: Video to 3D, a world you can walk through

**Branch:** `codex/video-3d-r2`, cut from `main`. One of five Studio tasks (37 to 41) running at the
same time.

**You may change:** `src/packs/video3d.js`, everything under `src/video3d/`, new sample files under
`assets/toys/video-3d/`, their entries in `tools/assets.json` and `CREDITS.md`, new
`tools/cdx-v3d-*.mjs` (and the existing `tools/v3d-*.mjs`), new `tests/cdx-v3d*.spec.mjs`, and a
report at `docs/audits/video-3d-r2-2026-10.md`. A change to the vendored Splat.js
(`vendor/splatjs/`, MIT) goes in its own commit with a note in `LICENSES.md`. Don't touch the other
Studio toys' files (tasks 37 to 39 and 41 own them).

## What the owner sees (his walkthrough of October 11, 2026, in the Operator's words)

Video to 3D trains real Gaussian splats in the browser (WebGPU, Splat.js) from a short clip. It has
two samples, "Statue, flown around" and "Street, walked". He hasn't found a video of his own that
works, and it takes a long time to learn whether one will. He sees the most potential here: a 3D
world, made from a video, that you can move around in. "Street, walked" hints at it. He wants that
built out as far as it can go.

Today (docs/handoff/Video3D.md): uploads up to 40 MB, a start slider of 0 to 300 s, lengths of 5,
10, 20 or 40 s, 16 to 90 frames by device tier, training stops after 8 minutes on a phone; known
issues are soft splats and floaters away from the camera's path, and rays in the sky on Street.

## Steps

1. **Know in seconds whether a video will work.** Before training, look at a few frames (camera
   motion and parallax, blur, exposure changes, moving people or cars, too little texture) and tell
   the person, in plain words, whether it will work and how to film one that will. Show it within
   about five seconds of opening the file. Add a short "How to film for Video to 3D" guide in the
   toy's panel (walk slowly around something, or walk forward down a street, steady, in even light).
2. **More samples that work.** Find 4 to 8 videos made for this: an orbit around an object or a
   statue, a slow walk down a street or a path, a room or a courtyard, a drone pass over a place.
   Licenses: only CC0, CC BY, CC BY-SA or public domain, checked on the live source page (Wikimedia
   Commons, the Internet Archive, NASA and similar). Pexels, Pixabay and similar custom licenses are
   **not** allowed (B1). No identifiable people (A2), no logos or brand names (A1). Bake each
   offline at a high setting so the sample looks its best; record the source, author, license, date
   checked and file hash (B2).
3. **A world to walk through.** A walk mode: on a phone, one thumb moves and the other looks; on a
   desktop, the keys and the mouse. Stay inside the part of the scene the video saw, ease every
   move, and never show the scene's ragged edge head-on. Longer clips (40 s and up, if you can make
   it work) make bigger worlds.
4. **Cleaner scenes.** Remove floaters and sky rays: prune splats seen from too few frames, clamp
   splats along the camera's path, and fill the sky with a soft dome from the video's own sky
   colors.
5. **Faster.** Show progress with a preview that improves while it trains; use the device's tier
   well; say plainly what a phone can do.
6. **Size.** Each sample's default load fits D4 in `builders/RULES.md` (aim for 15 MB or less; a
   bigger tier only when picked; no single file over 20 MB). The compact baked format from the Baked
   engine lane (`src/baked.js`, PR #549) may land during this task; if it is on `main`, use it for
   the samples.
7. **Tests.** `tests/cdx-v3d*.spec.mjs`: the suitability check on a good and a bad clip, walk mode
   moves and stays inside bounds, every sample loads. Keep green: `v3d`, `smd-compare`,
   `hh3-level1`, and the "embed transfer ≤ 30 MB" test in `smoke`.
8. **Report.** `docs/audits/video-3d-r2-2026-10.md`: each new sample with its source and license,
   what the suitability check looks at, before-and-after pictures of floaters and sky, and clips of
   walk mode at 390x844 (`tools/v3d-clip.mjs`) in the PR.

Before you push, run `npx prettier --check .` and `node tools/us-english.mjs --diff`. Open a draft
PR titled "Codex task 40: Video to 3D, a world you can walk through" with the five sections from
CLAUDE.md and a "Rule check" line (`builders/RULES.md`).
