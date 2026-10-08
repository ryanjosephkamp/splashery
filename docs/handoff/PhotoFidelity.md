# Lane Photo fidelity: sharper Photo to 3D and Moving photo to 3D (prefix `phf`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Photo fidelity (prefix `phf`). Branch:
`claude/lane-photo-fidelity` (engine changes on `claude/lane-photo-fidelity-engine`). PR title:
"Phase Photo fidelity: sharper Photo to 3D and Moving photo to 3D". Handoff file:
docs/handoff/PhotoFidelity.md (create it; start it with this brief, word for word, under "## Brief",
then keep "## State", "## Notes", "## Known issues" and "## For the Operator" current). Model: Opus
5.5, at the default effort.

### Brief (written by the Operator on October 8, 2026, from the owner's note)

The owner, on Moving photo to 3D with his own 29-second phone screen recording (1056x2178, a feed
scrolled at a normal pace): "Structurally, it looks extremely cool. But the detail is just not
there. It's too blurry. I can't read any of the text. If I pause the effect, I can't read any of
it." He wants a big push on Photo to 3D and Moving photo to 3D sharpness, and to know what the input
has to be for it to work.

What limits them today (check each in the code; the Operator found these): Moving photo keeps each
frame at CLIP_AREAS (60k to 230k pixels, so his 2.3-megapixel frames are cut to about a tenth), the
depth model sees DEPTH_SIDES (196 or 294 px), and the grid is one relief splat per kept pixel
(src/live/relief.js). Photo to 3D caps photos at 2048 px but its splats at the tier budgets
(PHOTO_BUDGETS, about 210k to 400k), so a phone screenshot gets about one splat per eight or nine
pixels. Text needs roughly one splat per screen pixel at reading size.

Your job is the splat side: make both toys as sharp as splats honestly can at a smooth phone frame
rate, and measure it.

1. Measure first (below), and write the numbers per tier into your handoff.
2. Spend the splats where the detail is: an adaptive grid (fine splats on edges, text and texture;
   coarse ones on flat color), sized from the color image at full resolution, not the depth's
   resolution. Photo to 3D already splits some 2x2 blocks (SPLIT_SHARE); go much further, driven by
   local contrast.
3. Raise what each tier keeps where memory allows. A long video is streamed (its frames aren't all
   held), so its frame size can be far larger than a short clip's; work out the real ceilings per
   tier (memory, the splat sort, frame time at 390x844 on the mid profile) and use them.
4. Depth at the model's native 518 px where the tier can afford it, upsampled edge-aware against the
   full-resolution colors (a joint bilateral or guided filter), so edges stay where the picture's
   edges are.
5. Anything else that sharpens without blur or speckle (anisotropic splats along edges, the
   sharpening pass tuned per tier, less overlap where the grid is fine).
6. A short "What makes a good input" section in the toys' About text and docs: resolution, frame
   rate, motion, what the tiers keep.

Keep old scenes and links loading. Keep it smooth on a phone (state the frame rate you measured).

You own: src/packs/photo-3d-core.js, src/packs/photo-3d.js, src/packs/photo-3d-depth.js,
src/packs/moving-photo.js, src/live/depth-worker.js (coordinate with the Sharp view lane, which adds
new files and only a small hook), tests/phf\*.spec.mjs, your handoff. The Live lane (Live r8) is
finishing in src/packs/live.js and studio.js; don't touch those without asking the Operator.

The test material (shared by both photo lanes; whichever lane starts it first owns
`tools/text-scroll-video.mjs`, the other reuses it): a script that renders a phone-sized (1080x2340)
page of Splashery's own text (docs/ROADMAP.md and README.md as plain rendered HTML in Playwright:
our own text, no third-party content), scrolls it at a normal reading pace for about 20 seconds, and
writes an H.264 MP4 at 30 fps with ffmpeg (a build tool; installed in the container) plus a few
still PNGs. It goes under `.cache/` (git-ignored), never in the repo. Measure legibility as: the toy
rendered paused at 390x844, device scale 3, compared with the source frame scaled to the same
on-screen size, with SSIM on the text area and the share of 12-to-16 px text lines whose letters
stay separate (a simple stroke-contrast measure you define and document). Report the numbers before
and after for each change.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Changes to the app outside your own files go in a
small, additive "Engine: …" PR on your `-engine` branch, merged first. Photo to 3D and Moving photo
to 3D are labs toys, so the Operator merges after a full test run (the Integrators run it) and the
owner's marks on your cards. Finish every working turn with "READY:", "WORKING:" or "BLOCKED:";
Splashery has no CI to wait for; for a long job, schedule a check-in with send_later instead of
going idle. Clips at phone size (390x844, device scale 3) go on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
(no republish), ids phf-…; always a before-and-after pair, and a paused close-up still of the text
so the owner can judge whether it reads. Before READY, re-read CLAUDE.md's "Effect quality rules"
(no blur, no speckle). The Operator runs the owner's own screen recording (private, never in the
repo) through your build at each READY and posts the comparison privately. Aim for a first READY
with measurements within about six hours. Your Operator is session_012GmKRUMZLir2nb27Bo8Cu2.

### Round 2 brief (the Operator, October 8, 2026, 11:15 UTC)

> #405 and #406 merged via Ops #417 (main c6e3f11e); 125/125 specs on the merge. Thank you. You may
> start the follow-up round now: branch claude/lane-photo-fidelity-2 from main c6e3f11e (engine
> changes, if any, on claude/lane-photo-fidelity-2-engine), PR title "Phase Photo fidelity r2:
> adaptive grid and edge-aware depth". Scope: the adaptive grid for "One color per splat" and
> edge-aware depth upsampling for short clips, measured the same way, before-and-after clips on
> Effect review page 2 (ids phf2-…), Sharp picture stays the default view. Keep the handoff current.
> Reply with your usual READY/WORKING/BLOCKED line.

## State

- October 8, 2026, 12:40 UTC, round 2 (`claude/lane-photo-fidelity-2`, Opus 5.5, high effort):
  working. The adaptive grid for One color per splat is built (`adaptiveGrid` in
  `src/packs/photo-3d-core.js`) and being measured; edge-aware depth for short clips (`guidedDepth`
  in `src/packs/moving-photo.js`) is built and measured (`tools/phf-depth-edges.mjs`): it helps
  little, because the depth model's input size, not the enlarging, sets where the edges are (see
  Notes, "Round 2").

- October 8, 2026, 10:30 UTC: the Detail choice Sharp is now Fine (the Operator's naming call). The
  "What makes a good photo/clip" paragraphs came out of the About texts: with the Sharp view lane's
  wording each About is at 171 and 176 of its 180 words (tests/help.spec.mjs). The guide stays in
  this file, under Notes. phf, phf-engine, p3d, psv, smd-moving, live3, help and hta pass.

- October 8, 2026, 09:20 UTC: main (#414, Photo sharp view) merged in, their hook calls kept as they
  are. Sharp picture is the default view now, so the phf test, measure and clip tools pick Splats
  explicitly. p3d, psv, live3, smd-moving, phf and phf-engine pass (57 of 57 after the fix).

Model: Opus 5.5 (default effort). Started October 8, 2026, about 00:00 UTC. First READY October 8,
2026, about 05:30 UTC.

- **Engine PR #405** (`claude/lane-photo-fidelity-engine`): photo-textured splats
  (`src/photo-splats.js`, the work-buffer write in src/effects.js, the stage and player wiring, kit
  flag 32). `tests/phf-engine.spec.mjs` passes on that branch alone (5 tests, WebGPU 5 of 5 in a
  repeat run). The broader specs touching its files are in "For the Operator".
- **Lane PR #406** (`claude/lane-photo-fidelity`, the engine branch merged in):
  - both toys' Detail option (Fine by default);
  - Moving photo's video copy;
  - `LONG_AREAS`;
  - the relief rule for flat pictures (`reliefScale`);
  - the offsets-only screen in Sharp mode;
  - the About text;
  - `tests/phf.spec.mjs`, and the tools below.
- **The owner's marks (read October 8, 2026, 07:30 UTC):** all 10 `phf-` cards marked "good". Main
  was merged into both branches again (#413).
- **Cards:** on Effect review page 2, lane record `PhotoFidelity`, 10 cards. Moving photo text video
  and Photo to 3D text screenshot before and after (clips and paused close-ups), and the street
  sample before and after.
- **Test material:** `tools/text-scroll-video.mjs`. This lane started it, so it owns it; the Sharp
  view lane reuses it. It writes `.cache/text-scroll/text-scroll.mp4` (1080 by 2340, 30 fps, 20 s,
  600 frames, 1.3 MB), a VP9 `.webm` of the same frames (Playwright's Chromium can't decode H.264)
  and four stills.
- **Tools:** `tools/phf-measure.mjs` (its header defines SSIM on the text and the letter-gap
  measure) and `tools/phf-clip.mjs` (phone-size clips with your own photo or video).
- **Next:** the owner's marks; the adaptive grid for One color per splat (brief item 2); guided
  depth upsampling for short clips (item 4).

## Notes

### What limited the sharpness (checked in the code)

The Operator's list was right. The deeper limit is that a splat is one color: 2.3 megapixels of text
at a phone's 210,000 splats is one splat per 11 pixels. No grid, adaptive or not, makes small
letters out of that. Measured at reading size before any change, the letters were blotchy, not just
soft: the 2 by 2 blocks merged into big splats, and the sharpening pass darkened them.

### Photo-textured splats (the engine change)

Each marked splat keeps its place, depth, size and Gaussian falloff, and its fragments read the
photo at the point under them. Face on, that is the photo at full resolution, and the overlap no
longer softens anything, because overlapping splats read the same place. Turned, each splat carries
its own patch, so the parallax is still the splats'.

- **Path:** the per-splat (u, v) reaches the render pass through a 32-bit work-buffer stream. The
  screen-to-picture mapping reaches the fragments through two PlayCanvas user varyings, and the
  photo is sampled with explicit gradients from a mipmapped texture.
- **Engine findings:**
  - an extra work-buffer stream must be written by every effects program, or WebGL drops the draw
    (so `writeSplat` is wrapped);
  - WebGPU allows 32 bytes of color attachments per splat, and the work buffer takes 24 (so the
    stream is one packed 32-bit value);
  - the renderer copies the splat material's parameters only when the material is updated (so the
    per-frame mapping goes to the device's uniform scope);
  - the compute renderer has no varyings hook (so the raster renderer is used while a photo toy
    shows).

### Measurements (Photo to 3D)

Setup: the text page's still `still-1.png`, the picture zoomed to fill the 390 px phone width (the
reading size), 390 by 844 at device scale 3, SwiftShader. "Before" is `main`; "after" is this branch
with Detail on Fine. "Lines" are the 12 to 16 px lines whose letters stay separate (80% of their
gaps kept).

| tier | splats  | SSIM before | SSIM after | lines before | lines after | gaps kept before | gaps kept after |
| ---- | ------- | ----------- | ---------- | ------------ | ----------- | ---------------- | --------------- |
| low  | 85,500  | 0.111       | 0.834      | 0 of 12      | 11 of 11    | 14%              | 99.7%           |
| mid  | 199,500 | 0.155       | 0.976      | 0 of 12      | 11 of 11    | 53%              | 100%            |
| high | 285,000 | 0.182       | 0.976      | 1 of 12      | 11 of 11    | 63%              | 100%            |
| max  | 380,000 | 0.202       | 0.976      | 1 of 12      | 11 of 11    | 68%              | 100%            |

After the change, the splat count no longer sets the sharpness face on. The low tier stays at 0.834
because it renders at a pixel ratio of 1.5 (`PIXEL_RATIO` in src/player.js), so its canvas has half
the pixels of the others: the screen limits it there, not the splats. (The registration differs by a
line at the picture's edge, so "after" counts 11 lines and "before" 12.)

### Measurements (Moving photo to 3D)

Setup: the text video (`.cache/text-scroll/text-scroll.webm`, 20 s, so the long, streamed path),
paused at the still's moment and zoomed to fill the width, at 390 by 844, device scale 3. "Lines"
are the 12 to 16 px lines.

| tier | grid before | SSIM before | lines before | gaps kept before | SSIM after | lines after | gaps kept after |
| ---- | ----------- | ----------- | ------------ | ---------------- | ---------- | ----------- | --------------- |
| low  | 166 by 361  | 0.058       | 0 of 6       | 10%              | 0.436      | 6 of 6      | 96%             |
| mid  | 254 by 551  | 0.088       | 0 of 6       | 27%              | 0.400      | 5 of 6      | 91%             |
| high | 304 by 658  | 0.077       | 0 of 6       | 38%              | 0.554      | 6 of 6      | 97%             |
| max  | 326 by 707  | 0.095       | 0 of 6       | 46%              | 0.453      | 6 of 6      | 95%             |

The first "after" pass (photo-textured, without the relief rule below) was sharp but warped: SSIM
0.11 to 0.19, 0 to 3 of 6 lines. The depth model gives a flat page a relative depth that spans only
0.21 to 0.23 of its nearest, and the toy stretched that noise to the full relief, so lines bent and
letters tore at the steps. Now a picture whose depth spans 0.25 or less keeps 30% of its relief (a
gentle bend, so a feed recording keeps some of the shape the owner liked), and one spanning 0.45 or
more (every real scene measured: 0.51 to 1) keeps all of it (`reliefScale`). This applies only to
photos and clips people open; the samples stay as approved. The rest of the SSIM gap is that bend:
the letters themselves match.

### What makes a good input (here only: each About text is capped at 180 words, tests/help.spec.mjs, and the Sharp view lane's text fills it)

**Photo to 3D.**

- A photo with near and far things in it.
- Up to 2,048 px on the long side is kept (a larger photo is scaled down).
- With Detail on Fine, every pixel kept is shown face on, so a phone screenshot's text reads when
  zoomed in.
- The depth model sees 518 px across, so thin things take the depth behind them, and a page of text
  stays nearly flat.
- Splats per tier (One color per splat): 90,000, 210,000, 300,000 and 400,000.

**Moving photo to 3D.**

- A steady video with near and far things, scrolled or panned slowly: a fast scroll is blurred in
  the video itself.
- With Detail on Fine, the video shows at its own full size (the owner's 1056 by 2178 recording
  keeps all 2.3 megapixels), paused or playing.
- A clip up to 8 s keeps 12, 15, 24 or 24 frames a second (low to max) and holds its frames at 60k,
  140k, 200k or 230k pixels for the depth and the plain look.
- A longer video plays at its own frame rate and is streamed. Its depth is worked out 1, 2, 3 or 4
  times a second, and its grid is 72k, 168k, 240k or 320k pixels.
- The depth model sees 196 px across (low and mid) or 294 px (high and max).

### Frame time

SwiftShader (this container's software GPU) says little about a phone's GPU, so these are relative.

- **The GPU side:** Moving photo's horse sample at 390 by 844, low tier, draws 3.2 frames a second
  with Detail on Fine and 4.4 with one color per splat (27% slower). Sampling the photo per fragment
  with gradients made it 1.8; one mip level per splat, worked out in its vertex, brought it to 3.2.
  On a phone's GPU the extra cost is one texture read per fragment.
- **The CPU side (a long video playing, mid):** with Sharp, a frame's work is 18 ms to draw the
  offsets and 2 ms to upload the video frame (frames every 42 ms here, under load). With one color
  per splat it is 700 to 990 ms (frames every 900 ms here): that path (Live r7's) reads every video
  frame back from the GPU to work out the splats' colors. Sharp skips that, because its fragments
  read the video itself, so a long video plays far more smoothly with Sharp.
- Not measured: a real phone. The Operator's run of the owner's recording on his phone is the test
  that counts.

### Depth model speed (why Moving photo keeps 196 and 294 px)

A portrait frame, single-thread WebAssembly, this container under load: 196 px 1.1 s, 294 px 2.0 s,
392 px 4.4 s, 518 px 10.4 s. Photo to 3D already runs at 518 (one picture).

## Known issues

- **WebGPU renderer.** While a photo toy shows on WebGPU, it draws with PlayCanvas's raster renderer
  (CPU sort) instead of the compute one, because the compute renderer has no hook for the varyings.
  That renderer in PlayCanvas 2.22.3 drops a frame (an invalid command buffer) when a fixed-size
  capture resizes it: 6 of 6 runs on `main`, forced to that renderer, without any photo code. Fixed
  sizes are used for GIF, video and thumbnail capture. The engine test captures WebGPU at the page's
  own size for that reason.
- **The relief rule is a measured heuristic.** A picture whose depth spans 0.25 or less of its
  nearest keeps 30% of its relief (`FLAT_SPAN`, `FLAT_KEEP`). A real but shallow scene could be
  flattened a little; every real scene measured spans 0.51 or more. Samples are exempt.
- **Edges.** At the picture's border the outermost splats' soft edge shows as a slight feathering,
  as before.
- **Clip timing.** In the two Moving photo clips the scroll position differs by about a second (both
  are paused frames of the same video).

## For the Operator

- Merge order: #405 (engine) first, then #406.
- Specs run on the lane branch (October 8, 2026), all passing in the latest run:
  - `phf` (10 tests) and `phf-engine` (5; WebGPU 5 of 5 in a repeat run);
  - `p3d`, `smd-photo`, `smd-moving`, `lv7`, `lv7-long` and `live3`.
  - Two were found failing and fixed on the way: `smd-moving`'s Speed test (Sharp drew too few
    frames a second in SwiftShader until each splat got one mip level), and `lv7-long`'s check that
    the picture comes from the video copy (the scratch canvas is still drawn, now on the GPU).
- Specs run on the engine branch alone: `phf-engine`, unit, kit, lab-engine, live3-engine,
  lv7-engine, p3d and smd-photo pass, and smoke passes except two tests:
  - "rigs pick splats…" timed out under load and passes alone;
  - "dragging the shelf up opens a grid…" fails the same way on `main` (not this change).
- The owner's recording: open it in Moving photo to 3D (Detail: Fine is the default), pause and
  pinch in. At the opening view a portrait video is only about 145 CSS px wide on a phone, as small
  as its source would be.
- Naming: next to the Photo sharp view lane's "Sharp picture" view, this lane's Detail choice
  "Sharp: each splat shows the photo's own pixels" may read as a second "Sharp". Say which words to
  use.
