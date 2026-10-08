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

## State

Model: Opus 5.5 (default effort). Started October 8, 2026, about 00:00 UTC.

- Test material: `tools/text-scroll-video.mjs` (this lane started it, so it owns it; the Sharp view
  lane reuses it). Writes `.cache/text-scroll/text-scroll.mp4` (1080 by 2340, 30 fps, 20 s, 600
  frames, 1.3 MB) and four stills.
- Measuring tool: `tools/phf-measure.mjs` (SSIM on the text and the letter-gap measure; its header
  defines both).
- Measuring the baseline (below).

## Notes

## Known issues

## For the Operator
