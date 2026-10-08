# Lane Photo fidelity: sharper Photo to 3D and Moving photo to 3D (prefix `phf`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Photo fidelity (prefix `phf`). Branch:
`claude/lane-photo-fidelity` (engine changes on `claude/lane-photo-fidelity-engine`). PR title:
"Phase Photo fidelity: sharper Photo to 3D and Moving photo to 3D". Handoff file:
docs/handoff/PhotoFidelity.md (create it; start it with this brief, word for word, under "## Brief",
then keep "## State", "## Notes", "## Known issues" and "## For the Operator

- Merge order: #405 (engine) first, then #406.
- Specs run on the lane branch (October 8, 2026), all passing in the latest run:
  - `phf` and `phf-engine`: `phf` 10 tests; `phf-engine` 5, with WebGPU 5 of 5 in a repeat run;
  - `p3d`, `smd-photo`, `smd-moving`, `lv7`, `lv7-long` and `live3`.
  - Two found and fixed on the way: `smd-moving`'s Speed test (Sharp drew too few frames a second in
    SwiftShader until each splat got one mip level), and `lv7-long`'s check that the picture comes
    from the video copy (the scratch canvas is still drawn, now on the GPU).
- Specs run on the engine branch alone: `phf-engine`, unit, kit, lab-engine, live3-engine,
  lv7-engine, p3d and smd-photo pass, and smoke passes but for two tests:
  - "rigs pick splats…" timed out under load and passes alone;
  - "dragging the shelf up opens a grid…" fails the same way on `main` (not this change).
- The owner's recording: open it in Moving photo to 3D (Detail: Sharp is the default), pause and
  pinch in. At the opening view a portrait video is only about 145 CSS px wide on a phone, as small
  as its source would be.
