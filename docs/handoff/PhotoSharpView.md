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
Photo to 3D and Moving photo to 3D"; merge it first). Sharp picture is the default (October 8,
2026). Lane PR: see "For the Operator".

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

- October 8, 2026, later: speckle fixed (the depth edge and the color edge don't line up exactly, so
  the cut left bits of background color on near things): every triangle touching a point beside a
  depth step is now dropped, a clean band the backing fills. The moving photo keeps its thin dark
  frame in Sharp picture (a white page needs its edge). Measured again after the fix (the table).
  `smd-moving.spec.mjs` failed three speed tests when run beside clip renders; alone, 16 of 16 pass.

- October 8, 2026, 04:00 UTC: the owner marked all 12 psv cards "good" (no notes). Main merged into
  both branches (it brought the AI-made samples and the on-stage depth slider to the toys; the hooks
  merged cleanly). After the merge: `tests/psv.spec.mjs` 8 of 8; on the engine branch `p3d`, `live3`
  and `smd-moving` 36 of 37, the one miss the Speed slider timing test, which passed 3 of 3 on
  repeat (the engine branch's hook is a no-op).

- October 8, 2026, 05:00 UTC, the Operator's two notes from the owner's recording, done: the status
  line says "Sharp picture" while it shows (engine: `src/app.js` asks `player.statusLabel` first, on
  #402), and the border is a straight clean edge (no cut within 1.5 cells of the rim, the depth
  softened within six cells of it, the moving photo's frame glued to that softened depth). `psv` and
  `p3d` specs: 18 of 18.

- October 8, 2026, 05:45 UTC, the owner's call (through the Operator): "Make sharp the default."
  Sharp picture is now the default in both toys, for the samples and for every picture or video
  opened; the Splats button beside it switches at any moment. Nothing goes into scenes or links, so
  old scenes and links open in Sharp picture too. Where the splats must stay they show instead, and
  the switch's note and the status line say so: while a tool that works on splats is picked (Poke,
  Paint, Magnet, Clay), in Hands-on, and while a Look effect is on (the pick buffer is redrawn when
  they come back). Saving the toy as a splat file is unaffected (it reads the splats, not the
  screen). Both toys' About lines now describe the view (`src/toy-help.js`).

- October 8, 2026, 16:40 UTC, round 2 (branch `claude/lane-photo-sharp-view-2`, PR "Phase Photo
  sharp view r2: saved view and the photo views guide"; Opus 5.5, high effort), on the owner's calls
  "I want saved scenes to remember sharp/splat" and "We will need to properly document this
  difference and our implementation":
  - The view is saved: the switch writes the toy option `view` (`"sharp"` or `"splats"`) into the
    scene without rebuilding the toy, and each build reads it back (`fromScene`). Splats' Detail was
    already the recipe option `detail`. A scene without `view` (all of them before) opens in Sharp
    picture. All in `src/packs/photo-sharp.js`, so no engine PR and no change to the toys' files.
    Documented in `docs/SCENE-SCHEMA.md`; tests in `tests/psv2.spec.mjs`.
  - `docs/PHOTO-VIEWS.md`: the guide to both views, linked from README.md. Its measurements were
    taken again on main with Detail Fine (`tools/psv-legibility.mjs --detail=`).
  - 17:58 UTC: PR #422 open (draft), head 2be1b2f5. Measured on main: face on, Splats on Fine read
    text as well as Sharp picture (92 to 100% of lines apart in both); Sharp picture draws frames 2
    to 6 times faster in SwiftShader. Clip pair `psv2-saved` / `psv2-reopened` on Effect review
    page 2. psv, psv2, p3d, smd-moving, live3, help and hta pass (one round 1 psv check now allows
    `view`).
- October 9, 2026, round 3 (branch `claude/lane-photo-sharp-view-3`, PR "Phase Photo sharp view r3:
  no WebGL error from Sharp picture to Splats, and clips loop at their end"; Opus 5.5, high effort),
  on lane Photo fidelity's report (its handoff, "For the Operator"): a rebuild from Sharp picture to
  Splats drew the splats' work-buffer pass with "glDrawElementsInstanced: Mismatch between texture
  format and sampler type".
  - The cause, traced with a WebGL hook that checks every unsigned sampler at each instanced draw:
    the build reads the saved view (`fromScene`), and a frame that lands before the stage swaps in
    the new toy ran `sync`, saw Splats and turned the old toy's splats back on. The swap then
    destroyed that entity, and with it its paint texture (PlayCanvas clears every uniform that
    pointed at a destroyed texture), but the just-enabled placement still had a frame or two in the
    work-buffer pass. That pass found `paintColor` empty, and PlayCanvas made its stand-in texture
    in the middle of the draw: making it uploads it on unit 0, where `uSubDrawData` (an
    unsigned-integer sampler) had just been bound. Only the first stand-in in a page does this, so
    the error showed in about one run in three.
  - The fix, in `src/packs/photo-sharp.js`: the splats come back at the stage's next update
    (`wake`), only for the toy's own entity and never while the player is building; a replaced
    entity is let go (the rebuild destroys it). A first version guarded only the build, and the
    merged phf-engine test (Splats picked with the switch, then the options changed at once) still
    hit the error: the same race from the other side, now covered too. No engine change.
  - `tests/psv3.spec.mjs`: both photo toys, Detail Fine and One color per splat, Sharp picture to
    Splats and back through rebuilds, with a frame's sync forced just before the swap. It fails on
    main (4 of 4: the old toy's splats are on at the swap) and passes with the fix (8 of 8). Lane
    Photo fidelity's own flow showed the WebGL error in about 1 run in 3 on main, 0 of 12 with the
    fix.
  - Second item, from the owner (October 9, 2026, about 03:35 UTC): "Moving photo to 3D doesn't loop
    properly when the video/GIF ends. It just gets stuck at the end of the clip and plays like the
    last 0.5 seconds over and over again." The cause, in the drive of `src/packs/moving-photo.js`:
    with a sound track (any video, with or without sound), the clip wrapped only on a frame that
    caught the sound in its last 20 ms. A frame that came later found the sound ended, and the
    silent clock sent the sound back to the last time shown, a moment before its end; while it
    sought there it still read as playing, so the next frame took its time again, and the cycle
    repeated for good, the video copy (and Sharp picture's live picture) pulled back to that time
    each time it ran ahead. The fix: the silent clock sends the sound back only where it has
    something left to play, else it runs on to the loop and the sound starts again there.
  - Tests in `tests/psv3.spec.mjs`: a short video with sound, one without and a GIF
    (`tests/fixtures/psv3/`, and the horse GIF) each play past their end at least twice, at 1 and
    1.75 times (the Speed slider's top; 2 times is out of its range), and the time must wrap to the
    start each time with the first frames after it. These pass on main too: the sandbox draws too
    few frames a second to hit the bug. So a second test runs the drive itself in Node at 30 frames
    a second against a media element that takes 60 ms to seek and stops at its end: on main 3 of its
    4 cases stay a moment before the end for good, and with the fix all 4 wrap. Clip `psv3-loop`
    (the bunny sample in Sharp picture, three loops) is on Effect review page 2.

### Measurements (October 8, 2026)

`tools/psv-legibility.mjs`, the text-scroll still at 10 s, 390 x 844 at device scale 3, mid profile,
WebGL2, paused with the depth raised. "Apart": the share of 12 to 16 px lines whose letters stay
apart (ink runs along the x-height band within 70 to 130% of the source's, each line piece aligned
on its own). SSIM: luminance, on the text lines.

| Toy, view                                    | Picture on screen (px) | Apart: splats → Sharp | SSIM: splats → Sharp |
| -------------------------------------------- | ---------------------- | --------------------- | -------------------- |
| Photo to 3D, its own view                    | 463 x 1004             | 3% → 86%              | 0.23 → 0.36          |
| Photo to 3D, zoomed in fully                 | 1284 x 2783            | 0% → 72%              | 0.40 → 0.43          |
| Moving photo to 3D (the video), its own view | 435 x 946              | 45% → 100%            | 0.42 → 0.69          |
| Moving photo to 3D, zoomed in fully          | 1150 x 2496            | 59% → 97%             | 0.38 → 0.50          |

Photo to 3D's Sharp misses come from the relief bending lines (its depth is stronger than the moving
toy's); the SSIM stays low for the same reason.

### Costs (`tools/psv-cost.mjs`, 390 x 844 at device scale 3)

Frame times are SwiftShader (software rendering in the sandbox), so only the ratio means anything:
Sharp draws 4 to 5 times faster than the splats (no sorting). Memory: the relief's own count (the
picture with mipmaps, the depth, the two grids); the splats at about 64 bytes each (an estimate).

| Profile | Toy          | Splats: ms, count, MB | Sharp: ms, grid (cells), triangles, MB |
| ------- | ------------ | --------------------- | -------------------------------------- |
| low     | Photo        | 218, 89k, 5.7         | 54, 300 x 200, 132k, 8.4               |
| low     | Moving photo | 222, 99k, 6.3         | 63, 327 x 184, 131k, 3.7               |
| mid     | Photo        | 642, 207k, 13.2       | 127, 424 x 283, 252k, 10.8             |
| mid     | Moving photo | 565, 171k, 10.9       | 133, 462 x 260, 251k, 5.9              |
| high    | Photo        | 778, 293k, 18.7       | 173, 548 x 365, 412k, 13.9             |
| high    | Moving photo | 753, 297k, 19.0       | 178, 596 x 335, 410k, 8.8              |
| max     | Photo        | 929, 388k, 24.8       | 215, 671 x 447, 612k, 17.7             |
| max     | Moving photo | 764, 297k, 19.0       | 230, 640 x 360, 471k, 10.0             |

What each tier keeps: the color is always the picture at the size the toy keeps it (a photo up to
2,048 px on its long side, about 16.8 MB with mipmaps at that size; a long video at its own size:
the owner's 1056 x 2178 recording is about 12.3 MB); the grid follows the tier (`SHARP_CELLS`: 60k,
120k, 200k, 300k cells) and is never finer than the depth.

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
- Where the depth model's edge sits a little outside a near thing, a thin ribbon of the background
  rides on it (as with the splats); it is a solid band now, not speckle.

## For the Operator

- First READY, October 8, 2026. Cards on Effect review page 2 under "Photo sharp view (psv)": text
  pairs (Photo to 3D clip and still, Moving photo to 3D clip and still) and sample pairs (forest,
  bunny), each before (splats) and after (Sharp picture).
- To run the owner's recording: open Moving photo to 3D (labs) and open the file; it shows in Sharp
  picture by default (Splats beside it). `tools/psv-legibility.mjs` measures any text video laid out
  like the test material; for another video the clip tool works:
  `node tools/psv-clip.mjs out.mp4 --toy=moving-photo-3d --open=<file> --view=sharp --from=<s>`.
  Playwright's Chromium plays no H.264: give it a WebM.
- The owner marked every card "good" and made Sharp picture the default (October 8, 2026). Still
  open for the owner: should the choice be saved in scenes (one new option key)? Until then nothing
  is stored.
