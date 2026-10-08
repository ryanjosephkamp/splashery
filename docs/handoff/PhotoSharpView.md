# Lane Photo sharp view (prefix `psv`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Photo sharp view (prefix `psv`). Branch:
`claude/lane-photo-sharp-view` (engine changes on `claude/lane-photo-sharp-view-engine`). PR title:
"Phase Photo sharp view: full-resolution pictures in 3D". Handoff file:
docs/handoff/PhotoSharpView.md (create it; start it with this brief, word for word, under "##
Brief", then keep "## State", "## Notes", "## Known issues" and "## For the Operator" current).
Model: Opus 5.5, at the default effort.

### Brief (written by the Operator on October 8, 2026, from the owner's note)

The owner, on Moving photo to 3D with his own 29-second phone screen recording (1056x2178):
"Structurally, it looks extremely cool. But the detail is just not there. It's too blurry. I can't
read any of the text." Splats at a phone's budget (about 200k to 400k) can't show a 2-megapixel
picture's text: that needs about one splat per screen pixel. The Photo fidelity lane pushes the
splats as far as they go. Your job is the other route, a hybrid (CLAUDE.md allows one where it
clearly works better), offered as a choice beside the splats, never replacing them: the owner
decides from your clips which is the default.

Build a "Sharp" view for both Photo to 3D and Moving photo to 3D: the picture at its full resolution
as a texture on a 3D relief surface displaced by the same depth the splats use, so text reads as it
does in the original.

1. The surface: a grid mesh displaced by the depth (on the GPU from a depth texture, so a moving
   picture's depth updates without a rebuild), cut cleanly where the depth jumps (no rubber sheets
   stretched between near and far: drop or split triangles across a depth step, and fill the
   uncovered background from the far side, as the splats' backing layer does).
2. The color: the full-resolution photo, or for a video a video texture straight from the playing
   <video> (no per-frame CPU copy), with mipmaps and anisotropic filtering so it stays sharp when
   tilted.
3. It moves with the toys as they move now (the relief, the depth slider, the tap, play and pause,
   scrubbing), and it can switch back to the splats at any moment. Splats stay the default until the
   owner says otherwise.
4. Tell the owner what it costs: memory, frame time at 390x844 on the mid profile, and what each
   tier keeps.

Old scenes and links keep loading; the view choice is saved in scenes only if the owner agrees
(store nothing new until then).

You own: new files (for example src/packs/photo-sharp.js and src/live/relief-mesh.js),
tests/psv\*.spec.mjs, your handoff, and one small hook in each toy, made through your engine PR and
agreed with the Photo fidelity lane (which owns the toys' files). PlayCanvas is imported only
through src/pc.js.

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
(no republish), ids psv-…; always a before-and-after pair, and a paused close-up still of the text
so the owner can judge whether it reads. Before READY, re-read CLAUDE.md's "Effect quality rules"
(no blur, no speckle). The Operator runs the owner's own screen recording (private, never in the
repo) through your build at each READY and posts the comparison privately. Aim for a first READY
with measurements within about six hours. Your Operator is session_012GmKRUMZLir2nb27Bo8Cu2.

## State

Model: Opus 5.5 (claude-opus-5-5), default effort. Engine PR #402 ("Engine: a Sharp view hook in
Photo to 3D and Moving photo to 3D"; merge it first). Lane PR: see "For the Operator".

- October 8, 2026: first build done.
  - `src/live/relief-mesh.js`: the relief (a grid mesh, GLSL and WGSL; depth read in the vertex
    shader from an R8 texture; triangles across a depth step dropped in the fragment shader; a
    coarse backing sheet at the farthest depth near each place, colored from there; the color with
    mipmaps and up to 16x anisotropic filtering, a playing `<video>` uploaded by the browser).
  - `src/packs/photo-sharp.js`: the Splats / Sharp picture switch in each toy's panel, the glue that
    feeds the relief from each toy's build and drive, and hides the splats while it shows.
  - `tools/text-scroll-video.mjs` (the shared test material; this lane started it) and
    `tools/psv-legibility.mjs` (the measure).
  - `tests/psv.spec.mjs`; screenshots `tests/screenshots/psv-*-390x844.png` and `…-1440x900.png`.

## Notes

- How it moves with the toy: the relief takes the same lift and base as the splats (Photo to 3D:
  `z = relief × (d − 0.5)` on the splats' own smoothed depth `s.depth`; Moving photo to 3D:
  `z = full × nearness` of the frame on show), the four morph channels (blended by depth band, so a
  surface never tears while the layers rise), Layers, the recipe's fit and the body's sway. Its node
  copies the toy entity's transform every frame (a Hands-on pose moves it). While it shows, the
  toy's gsplat component is switched off and the recipe's data gets a `tapBox` so a tap on the
  relief still reaches the toy; both are put back when Splats is picked or the toy changes.
- The cut: in the fragment shader, the derivatives of the interpolated depth and picture coordinates
  give the triangle's depth slope (constant over a flat triangle); more than `PHOTO_CUT` (0.03) or
  `CLIP_CUT` (0.05) of the 0..1 depth per grid cell drops it.
- Colors: the photo's bytes go into a plain RGBA8 texture and come out unchanged (no lighting, no
  gamma change), as the splats show them.
- The view choice lives in memory only (`window.__psv` for tools); nothing goes into scenes.
- Video color: a long clip (over 8 s) already plays a muted copy of the file, which the relief uses
  directly. A short video gets its own muted copy of the file, kept on the clip's clock. A GIF (and
  the samples' sheets, if their video can't play) uses the clip's own frames.

## Known issues

- No antialiasing on the relief's cut edges and outline (the stage has no MSAA): at device scale 3
  the steps are about a pixel.
- The depth model gives a flat page (a screen recording) gentle bumps, so lines of text bend a
  little; they stay readable.
- In Moving photo to 3D the thin dark frame (splats) hides with the splats.

## For the Operator

(Filled at READY.)
