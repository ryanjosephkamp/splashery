# Lane Photo to 3D: your photo, in depth (prefix `p3d`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Photo to 3D (prefix `p3d`). Branch: claude/lane-photo-3d. PR
title: "Phase Photo to 3D: your photo, in depth". Handoff file: docs/handoff/Photo3D.md.

## Brief (written by the Operator on September 29, 2026, from the owner's Splashery Universe answers and his "photo yes" that morning)

Studio turns anything into splats: a song (the song landscape), a 3D model (Model to splats, lane
Studio Models, #86). Next is a photo. The owner approved it on September 29, 2026, with the two new
vendored files it needs: an on-device depth model and a library to run it in the page. (The backlog
said: "Needs an on-device depth model and a library to run it in the page (both new vendored files);
the owner decides first." He said yes.)

Build **Photo to 3D** (`photo-3d`), a labs toy (`labs: true`) on the Studio shelf:

- Open a photo (JPEG, PNG or WebP, through the Toy tab's input panel with `input.binary`;
  docs/PACKS.md). On the device, a depth model estimates how far away each part of the picture is,
  and the photo is rebuilt as splats in 3D: each splat takes the photo's color at its place and sits
  at its depth, so turning the toy shows real parallax (near things move across far ones). Nothing
  is uploaded; the photo stays on the device.
- Quality: sharp, solid and clean at phone size (Fidelity A's method: even placement, full opacity,
  full density, clean colors), with no stretched "rubber sheet" between a near object and the far
  background: cut the surface where the depth jumps, so a near object stands as its own layer in
  front of the background. Keep the splat count within the tier budgets that picture toys use;
  measure and say what you chose.
- The tap: the picture starts flat, then its depth rises out of it layer by layer and the toy sways
  slowly to show the parallax (about 3 s); a second tap lays it flat again. A Depth option (how deep
  the relief is) and a Layers switch (show the separated layers pulled apart a little).
- Samples: two or three CC0 or public-domain photos with clear depth (a street, a forest path, a
  still life on a table; no people's faces, no logos), checked on the live source page and credited.

The depth model and the library:

- Pick a small monocular depth model whose license is CC0, public domain, MIT, BSD or Apache-2.0,
  checked on its live model card (for example Depth Anything V2 Small, which is Apache-2.0; its
  larger sizes are CC BY-NC, which we never use), in a quantized ONNX form small enough for a phone
  (aim for about 30 MB or less, and say its size and speed).
- Run it with a small, pinned library vendored in `vendor/` (for example ONNX Runtime Web, MIT, or
  transformers.js, Apache-2.0), WebGPU where the browser has it and WebAssembly otherwise. Load both
  only when someone opens a photo in this toy (like PDF.js), never on the shelf or in embeds; keep
  the "embed transfer ≤ 30 MB" test green.
- Record both in LICENSES.md, CREDITS.md and tools/assets.json, and add a line to CLAUDE.md's ground
  rules next to PDF.js and omggif ("… approved September 29, 2026, loaded only when someone turns a
  photo into 3D").
- You may download the model at build time with `HF_TOKEN` (a Hugging Face read token for build-time
  tools only). Never print it, commit it, or put it in logs, PRs or files. To check it, test that it
  is set (`[ -n "$HF_TOKEN" ]`), or call the whoami API and print only the account name and token
  role.
- No server, no API key in the page, no CDN: everything the page loads comes from our own files.

If the toy needs a change in the engine (src/pictures.js, src/player.js, src/stage.js and the like),
don't make it: describe it in "For the Operator" and the Operator (Opus 5.5) writes it as an
"Engine: …" PR, as for Studio Sound (#81) and Studio Models (#87). The Model to splats toy
(`src/packs/studio-models.js`, `src/packs/studio-models-core.js`) shows how a Studio recipe builds
splats from a file without engine changes.

A sound for the tap (a soft rising whoosh as the depth comes up), a how-to line and an About text
(what a depth model is, and that the photo never leaves the device), a toy-plan entry and a
thumbnail.

Clips and cards (390×844), each labeled "built by Sonnet 5.5", in the lane record `Photo3D` on the
Effect review page (the Operator made it): `p3d-sample` (each sample: the tap and a slow turn),
`p3d-open` (opening a photo of your own, as a phone would), `p3d-layers` (the Layers switch).

Tests in tests/p3d.spec.mjs: the toy builds from each sample, a photo opened through the panel
builds (with a tiny fixture photo), splats sit at different depths where the photo's depth differs,
nothing loads the model or library until a photo is opened, and screenshots at 390×844 and 1440×900.

## You own

- a new `src/packs/photo-3d.js` (and a core module beside it if you want one), the vendored library
  and model under `vendor/` (new folders only), `assets/toys/photo-3d/`, your toy's entries in the
  shared lists, the new lines in LICENSES.md, CREDITS.md and CLAUDE.md named above,
  tests/p3d.spec.mjs and its fixtures, your `p3d-*` screenshots and docs/handoff/Photo3D.md.

## State

Model: Sonnet 5.5 (default effort). Started September 29, 2026.

- Built: the toy (`src/packs/photo-3d.js`), the pure converter (`photo-3d-core.js`), the lazy depth
  runner (`photo-3d-depth.js`), three CC0 samples with precomputed depth maps, sound, help, plan
  entry, credits, licenses, `tests/p3d.spec.mjs`, tools `p3d-depth.mjs`, `p3d-views.mjs`,
  `p3d-fixtures.mjs`.
- Cards posted on the Effect review page (lane Photo3D, "built by Sonnet 5.5"): `p3d-sample`
  (forest), `p3d-sample-street`, `p3d-sample-still-life`, `p3d-open` and `p3d-layers`. Made with
  `tools/p3d-clip.mjs` and `tools/p3d-open-clip.mjs`.
- Tests: `tests/p3d.spec.mjs` (10 tests) and `tests/smoke.spec.mjs` (49, with the embed-size test)
  pass; `taps`, `unit`, `help` and `kit` pass (73 and the one fixed failure). The full 416-test run
  stalled twice in this session's container restarts and did not finish: the Integrator's combined
  run covers it.
- Still to do: read the owner's marks (ids starting `p3d`) and fix any "fix".

## Notes

- **Model:** Depth Anything V2 Small, `onnx-community/depth-anything-v2-small`,
  `onnx/model_quantized.onnx` (int8, 27,258,801 bytes; the uint8, int8 and quantized files are the
  same size). Apache-2.0 on both model cards.
- **Library:** onnxruntime-web 1.30.0, the plain WASM build (`ort.wasm.min.mjs` 50 KB, the runtime
  `.mjs` 24 KB, `.wasm` 14 MB). One thread (GitHub Pages is not cross-origin isolated). Whole
  first-open download: about 41 MB, only when a photo is opened.
- **Speed** (this container's CPU, single-thread WASM): 3.5 to 5 s for the network at 518 px on the
  long side (518×350, 518×392 or 518×490), plus about 6 s to fetch and start the model from a local
  server. A phone will be slower (an estimate, not measured).
- **WebGPU not used** (deviation): the WebGPU build of the runtime adds a 28 MB `.wasm`, and an int8
  model runs mostly on the CPU there anyway. The fp16 model is about 50 MB. One WASM path keeps the
  download at about 41 MB.
- **Method:** a regular grid of splats over the photo (about the tier budget, never finer than the
  photo). The model's depth is stretched between its 2nd and 98th percentile, enlarged to the grid
  by a joint bilateral filter guided by the photo (so its edges land on the photo's edges), then
  smoothed only along linked neighbors. Neighbors are linked when their disparity differs by at most
  0.015 (`CUT`; 0.03 left the street and still life in one piece); otherwise the surface is cut
  there. Connected pieces give the four depth bands (layers). A tiny piece (a flying pixel) takes
  the depth of the nearby large piece whose color is most like it. A splat's size is 1.12 times the
  mean 3D distance to its linked neighbors (a splat with none: 1.15 cells), capped at 1.7 cells, so
  nothing stretches across a jump. All splats face the viewer (so the flat pose is exactly the
  photo), opacity 1, flat 0.14, colors are the photo's area average at the grid.
- **Budgets:** the same as the Model to splats toy: density 1.5, so 90k, 210k, 300k and 400k splats
  on the low, mid, high and max tiers (the picture sheets' `PICTURE_BUDGETS` are per page and
  larger, but a kit toy is capped by `maxCount`).
- **The tap** is a toggle (`flat`, on at first, ease 3.2 s; the test in taps.spec.mjs needs the
  morph channels at 0 at rest, so the control is "flat" and the splats are built with their depth).
  Splats are built in the relief pose (so the draw order is right when it is risen) and morph to the
  flat plane; the toy rests flat (rise 0 morphs everything to flat). The four layers are the four
  morph channels, staggered far to near. The body yaws 0.3 rad and back as it rises or falls.
- **Layers** is a second toggle: each depth band is a kit part, moved along z by its offset.
- Sample photos are the 1,280 px versions Commons serves. Depth maps: `<id>.depth`, u16 with a small
  header (`packDepth` in `photo-3d.js`), made in Chromium with the same model and runtime by
  `tools/p3d-depth.mjs`.

## Known issues

- The depth model runs on the page's main thread, so the page stops for a few seconds while it works
  (3.5 to 5 s here, longer on a phone). A worker (`ort.env.wasm.proxy`) would fix it; not tried.
- Behind a near object the far surface is missing (no data), so a big turn shows a dark gap there.
  That is the cost of cutting instead of stretching.
- Thin near structures (leaves, twigs) come out ragged where the model's depth is coarse.
- The depth is relative (a guess from one photo), not measured.

## For the Operator

- Nothing needed from the engine.
- The forest sample's Commons page marks it CC0, but its credit line is a 2017 Pixabay upload; I
  took the Commons license as written and said so in CREDITS.md. Swap it if you would rather not
  rely on that.
- The street sample has parked cars with tiny, unreadable badges and one small license plate; no
  faces.
