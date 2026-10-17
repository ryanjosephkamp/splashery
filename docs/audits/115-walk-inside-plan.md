# Walk inside implementation plan

Goal: walk through locally opened splat places on phones and desktops, with reliable floor support
and wall collision. Spec: [task 115](../codex/115-walk-inside.md).

Architecture: a lazy Studio recipe opens an isolated walking view. A module worker reads existing
formats, levels a robust floor plane, and builds a weighted 10 cm occupancy grid. A fixed-step
capsule controller consumes that grid. Rendering and the third-person character reuse Worlds modules
without editing them.

Constraints: static ES modules; no uploads or new runtime dependencies; labs only; new runtime code
in `src/walk/`; existing scenes and links unchanged. Evidence on `codex/walk-inside-clips`;
implementation on `codex/walk-inside`; draft PR only.

## Tasks

1. Worker geometry and movement (`src/walk/geometry.js`, `grid.js`, `body.js`, `rooms.js`;
   `tests/cdx-walk-physics.spec.mjs`). Write failing assertions for a tilted floor with outliers,
   sparse floaters, wall sliding, 25 cm steps, 35 degree slopes, unsupported edges, and ten
   repeatable walks in each room. Implement and run the physics spec before committing.
2. File IO and worker (`src/walk/io.js`, `ksplat.js`, `worker.js`, `client.js`;
   `tests/cdx-walk-files.spec.mjs`). Reuse `readSplatFile` and its WebP codec; implement KSPLAT
   decoding locally because the existing loader rejects it. Test real round trips, truncated/invalid
   data, cancellation, and worker timings at one and two million splats. Preserve full collision
   data independently of LOD.
3. Walking surface (`src/walk/recipe.js`, `main.js`, `view.js`, `controls.js`, `walk.css`; shared
   lists for this tool only; `tests/cdx-walk.spec.mjs`). Use the existing dynamic pack path to reach
   `../walk/recipe`; no engine hook needed. Test lazy loading, real keyboard/touch movement, pointer
   lock, tap targets, character view, leveling, file errors, close/reopen, and reduced motion.
4. Evidence and handback (`tools/walk-evidence.mjs`, audit report). Measure standing and walking
   frame times at phone/desktop profiles, record 20-second 1080 px 30 fps clips per room, inspect
   390×844 and 1440×900 screenshots, and report two-million-splat costs. Run task specs, required
   smoke/kit checks, formatting, English, and final preflight after merging origin/main. Open one
   draft PR.

## Review focus

- Non-finite or enormous coordinates must fail helpfully without allocating an unbounded grid.
- Openings, overhead geometry, floor holes, and steep surfaces must never become a traversable
  invented floor.
- Closing or switching places during work must release listeners, rendering, object URLs, and
  workers; stale replies must not replace the active place.
- Keyboard focus in controls must not move the body; blur and canceled touches must clear movement.
- Level/flip/scale changes must transform collision and visible splats together.

## Decisions and progress

- The supplied task is the implementation authority. Execute in this session.
- The asset manifest contains 65 captured toys, all objects or isolated plants; no shipped splat
  room/street/landmark scene is available. Photo samples are 2D images, some AI-made; they are not
  substituted for real captured places.
- KSPLAT is explicitly rejected by both existing loaders; add a format reader in the new subsystem
  rather than change shared loaders.
- New original test places are procedural kit assets, CC0, made by Ryan with Codex (GPT-6). No
  external art or library is added.
- Physics and format tests passed; browser input, close/reopen, reduced motion, and ten actual
  browser key scripts per room passed. A 35.2 degree boundary test found and fixed downward slope
  rounding. Partial KSPLAT buckets and captures far from the origin have dedicated regression tests.
- Auto drawing resolution trades splat-layer pixels for frame cadence; controls and the 10 cm
  collision grid retain their detail. Full resolution is opt-in.
- Ruling: the brief requires 30 fps on the phone and frame-time reporting on the desktop. Apply the
  frame-rate gate to the phone; record finite desktop cadence without adding a desktop 30 fps
  requirement. Software desktop rendering is slow and is reported explicitly; hardware GPU
  performance remains unmeasured.
- An independent code review found three important issues, reproduced by failing tests and fixed:
  rotated anisotropic splats now rasterize an ellipse instead of a maximum-scale square; count and
  compressed-expansion guards run before allocating readers; entering settings, losing focus, or
  hiding the page cancels held movement and tap walking. Unzipped SOG metadata also has a real
  round-trip regression. Existing engine and Worlds modules remain unchanged.
- The follow-up review found no remaining blocker in those three fixes. Final cadence coverage also
  checks standing and walking with the optional character, using the same phone 30 fps gate.
- Screenshot review also moved status messages into a separate banner above the view, so an open
  leveling panel cannot cover a failed-grid explanation. A real private-file browser regression
  verifies this failure state; native input validation remains in place.
