# Photo views: Sharp picture and Splats

Photo to 3D and Moving photo to 3D (the Studio shelf, labs) turn a photo, a GIF or a video into a 3D
relief. A depth model guesses how near each part of the picture is, and the toy lifts each part by
that much. Since October 8, 2026, each toy can show the result two ways, picked in the Toy tab:

- **Sharp picture** (the default): the picture itself, at the size the toy keeps it, on a 3D surface
  lifted by the depth.
- **Splats**: the picture rebuilt from Gaussian splats, with a Detail choice of **Fine** or **One
  color per splat**.

This guide is for someone who knows the site but not its code. It says what each view is, when each
is better, what each costs, how they measure, how the choice is saved, and which files do the work.

## Why there are two

On October 8, 2026, the owner opened his own 29-second phone screen recording in Moving photo to 3D:
"Structurally, it looks extremely cool. But the detail is just not there. It's too blurry. I can't
read any of the text." At a phone's budget of about 200,000 to 400,000 splats, each splat stood for
about ten of the recording's 2.3 million pixels, so small letters merged.

Two lanes took it on the same day, from opposite ends:

- **Photo fidelity** made the splats themselves sharper. With Detail on Fine, each splat shows the
  photo's own pixels under it instead of one averaged color.
- **Photo sharp view** added a second view that draws the picture as a picture: a texture on a mesh,
  so every pixel kept is shown.

The owner compared both and made Sharp picture the default ("Make sharp the default"), with Splats a
tap away. Later the same day he asked for saved scenes to remember the choice.

## What each view is

### Sharp picture

The picture is drawn as a texture: the photo at the size the toy keeps it, or the playing video
itself, uploaded by the browser straight from the `<video>` element each time it shows a new frame.
The texture has mipmaps and anisotropic filtering, so it stays sharp when the view tilts.

It is wrapped onto a grid mesh, a flat sheet of small triangles over the picture, and each corner of
the grid is lifted by the depth at its place. The depth is a texture too, read on the graphics card,
so a video's depth changes from frame to frame without rebuilding anything. Three rules keep it
looking like a solid relief instead of a rubber sheet:

- **Cuts at depth steps.** Where the depth jumps (a leaf in front of a far tree), every triangle
  beside the jump is dropped, so no surface stretches from the near thing to the far one. A clean
  band is cut rather than scattered triangles, because the depth's edge and the picture's edge never
  line up exactly, and leftover triangles showed as specks.
- **A backing sheet.** Behind the surface lies a coarser sheet at the farthest depth near each
  place, colored from there. Seen face on it is hidden. When the view turns and a near thing pulls
  away from what is behind it, the gap shows the far side's colors, as the splats' own backing layer
  does.
- **A straight border.** Nothing is cut near the picture's edge, and the depth is softened there, so
  the outline stays straight. Moving photo to 3D keeps its thin dark frame, glued to that softened
  edge.

It moves as the splats do:

- the Depth slider;
- the tap (the layers rising and falling in Photo to 3D, play and pause in Moving photo to 3D);
- Layers, the sway and scrubbing;
- a pose in Hands-on.

The status line under the toy says "Sharp picture" instead of the splat count.

### Splats

The picture is rebuilt from Gaussian splats: soft, flat disks, each placed at its point of the
picture and lifted to its depth. Splats are what the rest of the site is made of, so the splat tools
and effects work on them. Splats' Detail choice (lane Photo fidelity) sets how each splat is
colored:

- **Fine** (the default): each splat shows the photo's own pixels under it. Face on that is the
  picture at full resolution; turned, each splat carries its own small patch of the picture.
- **One color per splat**: each splat takes one averaged color, the look of the first versions. It
  is softer and more painterly, and on a long video it skips the per-frame color work that Fine
  needs.

## When each is better

| You want                                                    | Use                                                         |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| To read small text: a screenshot, a screen recording, signs | Sharp picture                                               |
| The picture exactly as it is, sharp at any zoom             | Sharp picture                                               |
| A long video played smoothly                                | Sharp picture                                               |
| Poke, Paint, Magnet or Clay                                 | Splats (the toy switches to them by itself while one is on) |
| Hands-on (pick it up, toss it)                              | Splats (switched by itself)                                 |
| A Look effect (wind, twist, dissolve and the rest)          | Splats (switched by itself)                                 |
| The soft "made of splats" look                              | Splats, One color per splat                                 |
| Saving the toy as a splat file                              | Either (the file always holds the splats)                   |

While a tool, Hands-on or an effect needs the splats, the toy shows them even with Sharp picture
picked. The note under the switch says why ("Showing the splats while a tool, Hands-on or an effect
is on"), and Sharp picture comes back afterward.

## What each costs

Measured with `tools/psv-cost.mjs` at 390 by 844, device scale 3, on October 8, 2026. The frame
times come from SwiftShader, the software renderer in the build sandbox, so only the ratio between
the views means anything; a phone's GPU is far faster at both. Splat memory is an estimate (about 64
bytes a splat: its data, the work buffer and the sort keys). Sharp picture's memory is counted
exactly: the picture with its mipmaps, the depth and the two grids. The samples are the forest photo
(1,280 by 853) and the bunny clip (640 by 360). Splats are on Detail Fine.

{{COST}}

What each tier keeps:

| Tier | Splats (Photo to 3D) | Sharp picture grid (cells) | Sharp picture color                      |
| ---- | -------------------- | -------------------------- | ---------------------------------------- |
| low  | 90,000               | up to 60,000               | the picture at the size the toy keeps it |
| mid  | 210,000              | up to 120,000              | the same                                 |
| high | 300,000              | up to 200,000              | the same                                 |
| max  | 400,000              | up to 300,000              | the same                                 |

The grid is never finer than the depth. Sharp picture's color is the same on every tier, and its
size follows the picture:

- a photo is kept up to 2,048 pixels on its long side, about 16.8 MB with mipmaps at that size;
- a long video plays at its own size, so the owner's 1,056 by 2,178 recording takes about 12.3 MB.

Sharp picture draws each pixel once, from a texture, with no sorting. Splats are sorted by distance
and drawn with blending, many overlapping.

## How they measure

The test material is `tools/text-scroll-video.mjs`: a phone-sized page (1,080 by 2,340) of
Splashery's own docs, scrolled for 20 seconds, plus still frames. `tools/psv-legibility.mjs` renders
the toy paused at 390 by 844, device scale 3, mid tier, with the depth raised, and compares it with
the source frame scaled to the same size on screen:

- **Letters apart:** the share of the 12 to 16 px text lines whose letters stay separate. It counts
  the ink runs along each line's middle band and passes a line when 70 to 130% of the source's runs
  are there. Blur merges letters (too few runs); specks split them (too many).
- **SSIM:** the structural similarity of the text lines with the source, each line piece aligned on
  its own (the relief bends the page a little).

Measured on October 8, 2026, at the still 10 seconds in. "Own view" is the toy as it opens; "zoomed
in" is as far as a finger can zoom.

{{LEGIBILITY}}

For the record, the first Splats measured on the same text, before Detail Fine existed, kept 0 to 3%
of the lines' letters apart in Photo to 3D and 45 to 62% in Moving photo to 3D.

## The depth model and its limits

Both views use the same depth, from **Depth Anything V2 Small**, an open model (vendored in
`vendor/depth-anything-v2-small/`, run by ONNX Runtime Web). It loads the first time someone opens
their own picture, about 27 MB, and runs on the device: nothing is uploaded. The samples ship with
their depth worked out ahead.

- It guesses **relative** depth from one picture (nearer or farther), not distances in meters.
- It sees a small copy of the picture: 518 px on the long side for a photo, 196 or 294 px for a
  video's frames (by tier). Thin things (a twig, a railing, a letter) take the depth around them,
  and its edges are softer than the picture's, so a near thing's outline is cut a little outside its
  true edge.
- A flat page (a screenshot, a screen recording) has almost no real depth, and the model's guess
  there is small noise. For a picture someone opens, the toy keeps 30% of the relief when the depth
  is that flat, so the page bends gently instead of tearing (`reliefScale`, lane Photo fidelity).
  Lines of text still bend a little in Sharp picture, which is most of what the measure above
  misses.
- A long video's depth is worked out a few times a second (1, 2, 3 or 4 by tier) and blended
  between, so very fast motion can lead or trail the depth for a moment.

## How the choice is saved

The view is the toy option `view`: `"sharp"` or `"splats"`. Picking either in the Toy tab writes it
into the scene at once (the toy isn't rebuilt), so saving the scene as JSON, copying its `#s=` link
or embedding it keeps the choice, and opening it again shows the same view. A scene without the key
opens in Sharp picture. Every scene and link saved before October 8, 2026 is such a scene, and loads
exactly as before. Splats' Detail is the recipe option `detail` (`"photo"` for Fine, `"splats"` for
One color per splat), saved the same way. Both are listed in [SCENE-SCHEMA.md](SCENE-SCHEMA.md).

## Where it lives

**Sharp picture** (lane Photo sharp view):

- `src/live/relief-mesh.js`: the relief itself, in the class `ReliefMesh`.
  - `setColor` takes a photo's pixels or a playing video.
  - `setDepth` takes the depth texture.
  - `set` takes the shape and motion: lift, the morph channels, Layers, the fit and the sway.
  - `show` turns it on or off, and `cost` counts its memory.
  - The shaders are written twice, GLSL for WebGL2 and WGSL for WebGPU. The vertex shader reads the
    depth and softens it near the border (`psvSoft`, `psvRim`); the fragment shader drops triangles
    beside a depth step.
  - `gridMesh` and `frameMesh` build the surface, the backing and the dark frame.
- `src/packs/photo-sharp.js`: the glue between the relief and the two toys.
  - `sharpEntry` draws the Splats / Sharp picture switch.
  - `sharpPhoto` and `sharpClip` are called at the end of each toy's build, and `sharpDrive` at the
    end of its drive.
  - `sync` and `follow` keep the relief in step with the toy each frame.
  - `splatsNeeded` decides when the splats must show instead.
  - `setSharpView` and `fromScene` save and restore the choice.
  - `SHARP_CELLS` holds the grid budget per tier, and `PHOTO_CUT` and `CLIP_CUT` the size of a depth
    step that cuts.
- `src/app.js`: the status line asks `player.statusLabel` first, which is how it says "Sharp
  picture".
- Tests: `tests/psv.spec.mjs` (the view) and `tests/psv2.spec.mjs` (saving it).

**Splats** (lanes Photo to 3D, Live input and Photo fidelity):

- `src/packs/photo-3d-core.js`: the photo's splats. `buildPhotoSplats` places, sizes and cuts them;
  `normalizeDepth` and `reliefScale` shape the depth.
- `src/packs/moving-photo.js`: the clip's grid of relief splats and its frames, depth and video
  copy.
- `src/photo-splats.js`: Detail Fine's photo-textured splats, `PHOTO_FLAG` and `photoRender`.
- Tests: `tests/p3d.spec.mjs`, `tests/smd-moving.spec.mjs`, `tests/live3.spec.mjs`,
  `tests/phf.spec.mjs` and `tests/phf-engine.spec.mjs`.

**Both:** `src/packs/photo-3d-depth.js` and `src/live/depth-worker.js` (the depth model), and
`src/packs/photo-3d.js` (Photo to 3D's recipe), which calls the hooks above.

## Known limits

- **Sharp picture's edges aren't smoothed.** Its cut edges and outline aren't antialiased, because
  the stage has no multisampling. At a phone's pixel density the steps are about a pixel.
- **Flat pages bend.** On a flat page the depth model's gentle bumps bend lines of text a little in
  Sharp picture.
- **Background ribbons.** Where the depth's edge sits a little outside a near thing, a thin band of
  the background rides on it, in both views.
- **Some features need splats.** The tools (Poke, Paint, Magnet, Clay), Hands-on and the Look
  effects work on splats, so the toy shows splats while they are on.
- **`<splashery-toy>` elements show splats.** The element has no page-wide player, so it always
  shows the splats; the embed player shows Sharp picture.
- **Frame times are relative.** They come from a software renderer. The owner's phone is the real
  test: the Operator's run of his recording found the small text "fully readable" in Sharp picture.
