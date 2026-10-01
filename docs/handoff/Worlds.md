# Lane Worlds: the world engine and a sandbox island

Prefix `wd`. Branch `claude/lane-worlds-engine`, PR "Engine: Worlds, the world engine and a sandbox
island". How lanes work: [OPERATING.md](../OPERATING.md). Earlier lessons: [history.md](history.md).

## Brief (r3)

(Written by the Operator on September 30, 2026, from the owner's marks of September 29 and 30)

The owner's words on `wd-hybrid-character` (September 30, 2026): "This is looking much better. It's
still doesn't feel premium yet and while I know that I marked some of the other Island scenes as
looking right, the terrain was generally what I was referring to. The sand looks okay, but the
character and a lot of the other stuff in the environment could use some work. The character in
particular could use a lot of work. It looks way too simple and simplistic. I would also like to try
to improve the Fidelity or resolution or sharpness of the rest of the island." And on `wd-walk-r3`
and `wd-list-r3` (September 29): "make the character look much, much better; the player looks far
too low-poly here. I know you're capable of incredible character design, so please see what more you
can do here."

So the terrain, water, sky, shadows and depth pass (those cards are good). The character and the
props don't. Build, in this order, posting each part's cards as soon as it's done:

1. **A realistic, premium character (the main job).** An adult of ordinary proportions, not a
   big-headed game figure: believable face, hands and clothes, with proper materials lit by the
   world's sun and HDRI. It must read as premium at phone size, walking and close up.
   - The handoff's lead is MakeHuman or MPFB2. The base mesh and its bundled assets are CC0, but
     check each asset you use (skin, eyes, eyebrows, hair, clothes) on its live page, because
     contributed assets vary; record each in CREDITS.md and tools/assets.json. Build it in these
     containers with Blender as a Python module (pin the version; a build tool in `tools/`, never
     shipped; list it in LICENSES.md), bake textures to 1K–2K, keep it to roughly 15–30k triangles
     on high and a lighter version for low and mid, and export a GLB.
   - A neutral, invented face: no real person's likeness, no scans of real people unless CC0 with
     consent stated.
   - Animation: idle, walk and run that look like a real person moving, with feet that don't slide.
     Sources must be CC0, CC BY or public domain. The CMU motion-capture database uses its own
     custom terms, so it is not allowed. Good candidates to check on their live pages: the 100STYLE
     locomotion dataset (said to be CC BY 4.0), CC0 BVH packs on OpenGameArt, and Quaternius's
     Universal Animation Library (CC0, if you can reach a download that isn't Google Drive).
     Retarget in Blender. If nothing usable is reachable, say so in your message with what you
     tried.
   - Hair: cards or a sculpted cap that reads well. No stringy transparency artifacts.
   - Make it the default character in hybrid mode. In splats mode, try baking the same character
     into splats as rigid parts (sample the textured surface; give each splat to its dominant bone;
     hide the joints the way clothes do). Parts move as solid pieces: never skin or bend splats. If
     it doesn't look better than today's splat character, keep today's and say so.
2. **Sharper props.** The trees, bushes and rocks read as soft blobs at walking distance. In hybrid
   mode, use CC0 Poly Haven models (rocks, boulders, trunks, dead trees and plants) as lit, shadowed
   meshes with levels of detail, and give splat tree canopies darker, more varied greens and shade
   inside the crown. Keep splats where they're special: the lighthouse toy, breakable things,
   animated flowers. Scatter pebbles and shells on the beach, and add a foam strip at the shoreline.
3. **Island detail and grade.** Break the ground textures' tiling with a second, larger-scale
   sample; blend sand into grass by height. Try the vendored engine's CameraFrame (bloom, color
   enhance, vignette) and ambient occlusion on the high and max tiers only. Fix the handoff's known
   issues where cheap: gravel on steep sand, the gray horizon band, pale pebbles in the grass close
   up.
4. **A frame-rate readout for the owner's phone.** A small labs overlay (`?stats=1`) showing frames
   per second, the tier, the mode, splats and draw calls, so the owner can test on his phone and
   send the numbers. Measure your own frame times in the test browser as relative numbers, before
   and after, and say plainly that the phone is the real test.

Budgets: stay within each tier's splat budget; keep the hybrid assets for low and mid under about 10
MB in total, and say what high and max download. Keep the "embed transfer ≤ 30 MB" test green and
`tests/chr.spec.mjs` within its time limit.

Cards (clips at 390×844 unless noted, each labeled "built by Opus 5.5", in the lane record `Worlds`
on the Effect review page):

- `wd-character-r3`: the new character close up, turning, then idle, walk and run (and one still,
  side by side with the old one).
- `wd-character-walk-r3`: following the character along the beach and through the grass at the
  normal camera.
- `wd-props-r3`: walking past the new rocks, trees and beach detail.
- `wd-island-r3`: a wide view and a near view of the island, then the same at 1440×900.
- `wd-character-splats-r3`: the splat version of the character, if you build it.

Set `replacedBy` on `wd-hybrid-character`, `wd-walk-r3` and `wd-list-r3` to your new card ids.

Tests in tests/wdr3.spec.mjs: the character loads in each tier with its triangle and texture
budgets; the idle, walk and run clips play and the feet stay planted (measure foot slide against the
ground while walking); the props' levels of detail switch by distance; the assets are credited and
within the size budgets; the stats overlay shows; screenshots at 390×844 and 1440×900 (`wdr3-*`).
Keep tests/wd.spec.mjs and tests/wdh.spec.mjs green; if one of their numbers has to change, say
which and why in your message.

Docs: update docs/WORLDS.md for the new character and props. The handoff notes that two paragraphs
there ("Rules that still apply" and the intro) still describe splat-only worlds; leave those two to
the Operator.

## r3 state

Model: Opus 5.5 (default effort). Branch `claude/lane-worlds-r3`, PR "Phase Worlds r3: a premium
character and a sharper island".

- September 30, 2026: lane started; draft PR #135.
- **The person** (`tools/wd-character.py`, Blender 5.0.1 as a Python module with MPFB 2.0.17): a
  MakeHuman adult (CC0 system assets; logos painted out of the tee), MPFB's game-engine rig, motion
  capture from 100STYLE (CC BY 4.0: Neutral_FW walk, Proud_FR run, Neutral_ID idle) retargeted bone
  by bone. Walk and run are one cycle each, resampled to 1 s, in place; the world plays them at
  speed ÷ stride, so the standing foot slides 3–5% of the body's speed walking, 5–9% running
  (measured in the page). Two levels: high 30.8k triangles, 2.2 MB; low 17.2k, 1.2 MB. Default in
  hybrid mode (`character.model: "auto"`); `?character=kenney` keeps the old one; the person walks
  at 1.3 m/s and runs at 2.7 m/s (the splat character keeps 1.9 and 4.6).
- **The person as splats** (`?character=splat-person`): 90k splats sampled from its textured surface
  (hidden samples dropped by a ray test), one rigid piece per bone. At phone distance it reads as a
  real person; close up it is grainier (specks on the face, a light band at the waist) than the
  kit-built splat character, so that one stays splats mode's default. Card `wd-character-splats-r3`
  lets the owner judge.
- **Cards** (all WebM, 0.6–1.25 MB): `wd-character-r3` (replaces `wd-hybrid-character`),
  `wd-character-walk-r3` (replaces `wd-walk-r3` and `wd-list-r3`), `wd-props-r3`, `wd-island-r3`,
  `wd-island-r3-desktop` (1440×900, high tier, camera frame) and `wd-character-splats-r3`.
- `tests/wd.spec.mjs`, `wdh.spec.mjs` and `wdr3.spec.mjs`: 32 passed (47.6 min). Measured: the
  standing foot slides 0.047 m/s walking at 1.3 m/s and 0.16 m/s running at 2.7 m/s; hybrid download
  9.49 MB (low, mid) and 10.50 MB (high, max); frame times in the software renderer (mid, 390×844)
  about 2.1 s in both modes, as before (relative only; the phone is the real test: open
  `worlds/?labs=1&render=hybrid&stats=1`).
- Changed in `tests/wdh.spec.mjs` (mine): hybrid mode's character is the person now, so the "both
  modes" test checks its model casts shadows instead of splat parts, and the mesh-character test
  runs for `mesh` (the person, bone names `foot_l`, `head`; it starts in Idle) and `kenney`.
- Main merged after #127 (September 30, 2026).
- Full suite after merging main (October 1, 2026): 582 passed, 1 failed in 3.2 h. The failure,
  `tests/smoke.spec.mjs:730` (a toy's rig back at rest within 3 s), is in the toy app, which this
  branch doesn't touch, and passed on its own rerun (48 s). The Effect review page's asset storage
  was full (1.06 of 1.07 GB) when I started posting: my cards are WebM videos (`tools/wd-webm.mjs`,
  under 1 MB each instead of 10–20 MB GIFs).
- **Clip speed:** a phone-size clip takes about 15 s a frame in this container's software renderer
  (`--fast --dpr=1.5`), so a 10-second card takes 25–35 minutes.
- **Model props** (`tools/wd-props.py`, `src/worlds/mesh-props.js`): Poly Haven boulders, stones, a
  shell, driftwood and a stump (CC0), three levels each; 220 stones and 28 shells instanced on the
  sand. 3.0 MB. Tree and bush leaves regraded in hybrid mode (`gradeFoliage`).
- **Island:** second rotated texture sample against tiling, patchy sand-to-grass edge, no gravel
  near the water, grass pebbles held down, a shoreline foam strip, CameraFrame (bloom, color
  enhance, vignette, SSAO) on high and max (`?frame=0|1`), and `?stats=1`.
- Hybrid download: low and mid about 9.5 MB, high and max about 10.5 MB.

## Start here (Worlds r3, a fresh session)

Written on September 30, 2026 by the r1, r2 and hybrid session (Opus 5.5) for the session that runs
Worlds r3: a premium character and a sharper island. The rest of this file is the lane's history
(r1, r2, hybrid), kept as it was; this section is the current state.

### Where things stand

- #78 (r1, the engine) is merged. #108 (r2, a sharper island) and #127 (hybrid) are open. The
  Integrator tests main plus #127, then the Operator merges #108 and then #127. Don't push to either
  branch.
- r3 starts from `claude/lane-worlds-r3`, made from #127's head (07ae6a6 plus this file). Merge main
  in once #127 has merged.
- Character lane (#110, merged) rebuilt the splat character into `character.js` (the API),
  `character-rig.js` (21 joints and the rotation math), `character-body.js` (the parts and the
  palette) and `character-motion.js` (the gait). The "For the Character lane" notes further down are
  older than that.
- The owner's marks (Effect review page, lane record "Worlds"):
  - `wd-hybrid-walk`, `wd-hybrid-shore`, `wd-hybrid-shadows`, `wd-hybrid-sky` and `wd-hybrid-depth`
    are good.
  - `wd-hybrid-character` is fix (September 30, 2026), word for word: "This is looking much better.
    It's still doesn't feel premium yet and while I know that I marked some of the other Island
    scenes as looking right, the terrain was generally what I was referring to. The sand looks okay,
    but the character and a lot of the other stuff in the environment could use some work. The
    character in particular could use a lot of work. It looks way too simple and simplistic. I would
    also like to try to improve the Fidelity or resolution or sharpness of the rest of the island."
  - `wd-walk-r3` and `wd-list-r3` (September 29) were fix too: keep improving sharpness, and make
    the character look much better, "the player looks far too low-poly".
  - So for r3: the terrain passes; the character (both kinds) and the props don't.

### How the engine and the hybrid layer fit together

- **Page:** `worlds/index.html` loads `src/worlds/main.js`. It checks the labs switch, reads
  `worlds/<id>/world.json` (`?world=`, Test island by default) through `world-file.js`
  (`normalizeWorld`: every field defaulted and clamped), shows the start screen and the list of
  places at once, then builds the world.
- **Device tiers** (`tiers.js`): `detectTier()` picks low, mid, high or max (`?profile=` forces
  one). Each tier's row in `WORLD_BUDGETS` has the splat budget, the ground density, the near and
  middle distances, the props and grass factors, the pixel-ratio cap, the kernel, the shadow map
  size and the shadow reach.
- **The view** (`render.js`, `WorldView`):
  - It has the device (WebGPU or WebGL2), the app with the camera, gsplat, render, light and anim
    systems, and the texture, gsplat, container and anim handlers.
  - Layers, in drawing order:
    1. World opaque: the hybrid ground, the sign boards, splats mode's depth-only ground.
    2. Skybox: the hybrid sky dome.
    3. `WdSky`: the splat sky, with no fog; `material:created` sets `GSPLAT_NO_FOG`.
    4. `WdGround`: the ground's splats, or the near grass.
    5. `WdSurface`: the shadow catcher, or the hybrid water.
    6. World transparent: the props, the character, splats mode's water splats.
  - `container(buf)` turns a `SplatBuffer` into a `GSplatContainer`.
  - `entity(name, ct, { layer, shadows })` places splats.
  - `setPixelRatio`, `setKernel` (lane Lab's sharp kernel) and `waves()` (the splat water's
    work-buffer modifier) are here too.
- **The world** (`world.js`, `World`). `build()` runs in this order:
  1. `Lighting` (`lighting.js`): the sun, shadows, fog and the grade.
  2. Hybrid mode: `buildModels()` loads `hybrid.js` assets, with the HDRI as environment light and
     the sky dome, then the ground tiles and the water meshes. Splats mode: the splat sky, the
     ocean, and `lighting.buildCatcher()` (the depth-only ground and the catcher tiles).
  3. Chunks: 8 m cells, 5 levels, planned by `lod.js` under the tier's budget.
  4. Props: `props.js` bakes toy recipes, with three levels per prop.
  5. Signs.
  6. The character: `buildCharacter()` for splats, or `buildMeshCharacter()` (`mesh-character.js`).
  7. Spawn.
  8. The first plan.

  Every frame, `update()` moves the character through `physics.js` (the height field plus invisible
  shapes), runs the camera (`camera.js`), re-plans the levels, builds queued chunks, and updates the
  catcher tiles and the water's time.

- **Modes:**
  - `def.render` (`"splats"` by default) or `?render=splats|hybrid` picks the mode.
  - `def.character.model` or `?character=splats|mesh` picks the character.
  - `?shadows=0`, `?dpr=` and `?kernel=` override the tier.
  - `?clock=manual` puts the world on a manual clock, for tests and clips.
- **Test hooks:** `window.__world` has `enter`, `stats`, `char`, `ground`, `place`, `step`, `tick`,
  `catchUp`, `card`, `world`, `view` and `mode`. `stats()` gives the splats drawn by kind and level,
  the models drawn, the mode and the median frame time.
- **Pure modules**, safe in Node tests: `world-file`, `terrain`, `water`, `props`, `character*`,
  `physics`, `camera`, `lod` and `tiers`.

### How the character is built today

- **Splat character** (default; lane Character, #110):
  - Kit-built rigid parts, one splat cloud per joint (21 joints: hips, torso, chest, neck, head,
    arms, forearms, hands, fingers, thighs, shins, feet, toes).
  - Each part turns on its joint; nothing bends. The joints are hidden the way clothes do it.
  - The gait: `pose()` and `stepGait()` in `character-motion.js`. Walk is 1.9 m/s, run 4.6 m/s.
  - Splats: `CHARACTER_SPLATS` gives 40k on low, 64k on mid, 90k on high and 120k on max, always
    drawn in full.
  - Colors come from the world file's `character` field. It is ours and procedural, so no license is
    involved.
- **Mesh character** (`?character=mesh`, the hybrid round):
  - Kenney's "Animated Characters: Protagonists" (CC0; checked on
    kenney.nl/assets/animated-characters-protagonists and in the zip's License.txt).
  - One model (`characterMedium.fbx`, 58 bones, one skinned mesh) with the `skaterMaleA` skin.
  - `tools/world-character.mjs` runs three.js 0.186.1's FBX loader and glTF exporter in Chromium and
    builds `assets/worlds/character/character.glb` (834 kB) and `character.json`.
  - Clips:
    - idle 1.07 s;
    - run 0.67 s;
    - a walk made from the run: each joint half way back to the idle's first frame, the bounce at
      35%. Blending toward the rest pose instead gave a T-pose-armed walk.
  - `mesh-character.js`:
    - scales it to `BODY.height` (1.74 m) from its mesh bounds;
    - blends idle, walk and run by speed in a 1D blend tree (walk played at 0.72×, run at 1.05×);
    - advances the animation with the world's clock (`anim.playing = false`, then `anim.update(dt)`
      each frame);
    - makes it cast and receive shadows and take the fog.
  - The owner's verdict: better, but "way too simple". It is a stylized, big-headed game figure, not
    a realistic one.

### What was tried, and what it did (with numbers)

- **Splat grain (r2):**
  - Fidelity A's method helped: an even, flat, fully opaque ground carpet, blades in the ground's
    color, round water splats, sign letters at nine splats per font pixel.
  - The sharp kernel alone halved the speckle.
  - Speckle measured by `tools/world-grain.mjs`, before → after:
    - ground 0.07 → 0.03;
    - shore 0.09 → 0.05;
    - props 0.09 → 0.05.
  - The owner still found it grainy at phone size. Splats can't make flat ground or water look
    finished; that's why hybrid mode exists.
- **Hybrid (good marks):**
  - The model ground: 64 tiles of 16 m, a vertex every 0.5 m. Four CC0 Poly Haven textures (sand
    `sand_01`, grass `rocky_terrain_02`, rock `rock_ground`, wet sand `damp_beach_sand`) sit in a
    2048² atlas with 32 px of wrapped padding, each divided by its mean color, so they add detail
    over the terrain's own palette. Detail strength per texture: 0.85, 0.45, 0.9, 0.75.
  - The water: depth in the vertex alpha, foam, normal waves and Fresnel reflection.
  - The sky: an HDRI dome (the upper 60 percent of the 4K tone-mapped image, 468 kB JPEG). A
    sun-clamped 1K HDR (1.4 MB) lights the models.
  - Hybrid assets total about 6 MB, the character included.
- **Lessons from the hybrid build:**
  - An HDRI with its sun disk left in doubles the sun and washes out every shadow. Clamp the sun
    (tool option `--sky-cap=2.5`).
  - The environment light had to be scaled by the dome's exposure (1.6) to match it; without that
    the water's reflection read dark.
  - The fog color must match the dome's horizon (measured into `sky.json`).
- **Splats mode's light:**
  - Shadows through a multiplicative shadow catcher work well; the `wd-hybrid-shadows` card was
    marked good.
  - The cost in the test browser (mid tier, 390×844, per frame):

    | Build                                                 | Per frame                    |
    | ----------------------------------------------------- | ---------------------------- |
    | main before r2                                        | 1.04 s                       |
    | r2                                                    | 1.20 s                       |
    | hybrid branch, shadows on (before the cuts)           | about 1.6 s                  |
    | hybrid branch, splats and hybrid mode, after the cuts | about 2.0 s (in another run) |

  - The cuts: no tone map in splats mode, the catcher only within the shadows' reach, PCF3, only
    level-0 props cast, no shadows on low.
  - The splat shadow casters themselves cost almost nothing. The shadow light cost about 0.1 s and
    the catcher and depth models about 0.1 s.
  - The high tier at 1440×900 is the slow one: 76 s to load in the test browser.
  - `tests/chr.spec.mjs:249` needed #129's longer time limit.

- **Splats per tier** (splats mode, two places each):

  | Tier | Measured      | Budget |
  | ---- | ------------- | ------ |
  | low  | 273k / 297k   | 300k   |
  | mid  | 516k / 503k   | 550k   |
  | high | 815k / 808k   | 900k   |
  | max  | 1.34M / 1.31M | 1.4M   |

  Hybrid draws fewer, because only the near grass stays splats.

- **Frame times in hybrid mode:** 1.8 to 2.0 s in the test browser, about the same as splats mode.
  The owner's phone was never measured.
- **Character sources:**
  - Quaternius (CC0) was the first choice, but Google Drive answers "Quota exceeded" from these
    containers.
  - OpenGameArt has Quaternius's "Ultimate Animated Character Pack" (CC0; chibi, black faces: not
    better).
  - Kenney's `mini-characters` and `blocky-characters` are chibi or blocky.
  - Poly Pizza returned 403.

### Ideas for r3 (within the rules: CC0, CC BY or public domain; no BY-SA, NC or brands)

- **A realistic character (mesh), the biggest lever:**
  - **MakeHuman or MPFB2** (its Blender add-on): the base mesh and its bundled assets are CC0. Check
    each asset's license, since user-contributed ones vary.
    - Make a realistic adult with proper topology, skin and clothes textures and eyebrows, rigged
      with the game-engine skeleton.
    - Use Blender as a Python module in these containers (`pip install bpy==5.0.1`, the Operator's
      note). Build it there, bake the textures to 1K–2K, decimate to about 15–30k triangles and
      export a GLB.
    - Keep it a build tool: `tools/wdh-*.py`, the pinned version in LICENSES.md.
  - **Animations:**
    - CC0 motion capture: the CMU Graphics Lab motion capture database lets anyone use its data
      freely; check the terms on its live page before use. There are also CC0 BVH packs (for example
      on OpenGameArt).
    - Retarget walk, run and idle onto the rig in Blender.
    - Quaternius's "Universal Animation Library" (CC0) is on itch.io and Google Drive. If the owner
      or the Operator can fetch it into the repo's `.cache`, it fits a humanoid rig directly.
  - **Look:** physically based materials for skin, cloth and hair cards, lit by the same sun and
    HDRI. That is what reads as "premium" next to the lit ground. A soft rim light or skin
    subsurface isn't in PlayCanvas's standard material; the sheen parameter helps cloth.
  - **Faces:** keep the neutral expression, avoid anyone's likeness, and don't use scans of real
    people unless they're CC0 with consent stated.
- **Sharper props (the island's "other stuff"):**
  - Trees, bushes and rocks are splat bakes of toy recipes. At walking distance they read as soft,
    rounded blobs.
  - Option A, splats: raise the near props' density (`budget.props`), bake rocks as scanned-style
    splats with high-frequency color, and use the sharp kernel. Limited by the same grain problem.
  - Option B, hybrid: CC0 models from Poly Haven, which has rocks, boulders, tree trunks, dead trees
    and some plants (all CC0), as lit, shadowed meshes with LODs. Keep splats where they're special:
    the lighthouse toy, breakable things, flowers that animate.
  - Foliage: alpha-tested leaf cards on mesh trees look like games. Splat canopies can stay, but
    need darker, more varied greens and shadowing inside the crown.
- **Island detail:**
  - Blend a second, larger-scale texture sample on the ground to break the tiling.
  - Add parallax or height blending between sand and grass.
  - Scatter pebbles and shells (instanced meshes) on the beach.
  - Add shoreline foam as a textured strip.
- **Grade:**
  - The owner may want punchier contrast. A CameraFrame (bloom, color enhance, vignette) is in the
    vendored engine but costs a render target; try it on the high and max tiers.
  - Screen-space ambient occlusion would ground the props.

### Tools, tests and cards to reuse

- **Tools:**
  - `tools/world-clip.mjs`:
    - scenes include `hybrid-walk`, `-shore`, `-shadows`, `-sky`, `-depth` and `-character`;
    - `--modes` records splats and hybrid side by side;
    - `--left=`/`--right=` with `--labels=A,B` compares any two variants;
    - `noCards: true` keeps the landmark cards closed.
  - `tools/world-grain.mjs` measures speckle.
  - `tools/world-assets.mjs` fetches the Poly Haven ground atlas and sky; see `tools/hdr.mjs`.
  - `tools/world-character.mjs` builds the mesh character from FBX with three.js.
- **Tests:**
  - `tests/wd.spec.mjs`: the engine, the budgets and the r2 render settings.
  - `tests/wdh.spec.mjs`, eight tests:
    - the render switch;
    - the assets are small and credited;
    - both modes draw what they should;
    - depth order in each mode;
    - the mesh character;
    - frames per second;
    - the `wdh-*` screenshots.
  - `tests/chr.spec.mjs`: the Character lane's; it now has a 720 s limit. Never edit
    `tests/taps.spec.mjs`.
- **Cards** (Effect review page https://claude.ai/artifact/NCsg9V5SzFY3Mnwuwgq7pi):
  - Upload a GIF with the Artifact tool (`asset: true`), then set a `cards/<id>` document (asset,
    at, lane "Worlds", name, now, order, said). Never write `verdicts`, and never republish the
    page.
  - Hybrid cards: `wd-hybrid-walk`, `-shore`, `-shadows`, `-sky`, `-depth` and `-character` (orders
    60–65).
  - r3 cards could be `wd-character-r3`, `wd-props-r3` and `wd-island-r3`.
- **Running the suite:** about 2.7 h, 529 tests.
  - Run it detached (`setsid nohup … &`) and keep the session active with waits under 10 minutes. An
    idle session's container is reclaimed and the run dies.
  - Tests expect port 4173 (embed URLs and cross-origin checks), so serve the worktree there, not on
    another port.
  - Killing a server with a `pkill -f` pattern kills your own shell. Kill it by PID.
  - Run a clip or a test as its own job, one at a time. Parallel runs overload the 4 CPUs and cause
    timing failures, such as `smoke.spec.mjs:694`, the cat statue's head turn.

### Open risks

- Phone performance is unmeasured in every mode. The owner's phone is the real test; hybrid adds
  about 90 draw calls and 6 MB, and shadows cost a pass.
- Two paragraphs of `docs/WORLDS.md` still describe splats-only worlds: "Rules that still apply" and
  the intro. My edit was blocked by a permission check; the Operator should word the hybrid rule
  there.
- Google Drive downloads (Quaternius) fail from these containers; plan for other sources.
- A higher-detail mesh character costs more per frame in the test browser. Watch
  `tests/chr.spec.mjs` and the wd and wdh tests' time limits.
- Known hybrid issues:
  - gravel texture on steep sand;
  - a faint gray horizon band;
  - pale pebbles in the grass texture close up;
  - the mesh walk made from the run.
- Shadows are off on the low tier; the owner hasn't seen that trade-off yet.

## Brief

(Written by the Operator on September 29, 2026, from the owner's note "big new Splashery ideas" and
his answers on the Splashery Universe page the same night)

The owner's words: "I kind of want to make something that's like an actual universe, or like an open
world kind of game that runs in the browser using Gaussian splats. You know, somebody can actually
view it on their phone." "Somebody could make a personal website … the whole site is basically like
a Gaussian splat … they enter it as like … some character in like an open world, and the character
runs around … different landmarks or milestones … will be different parts of their portfolio."
"Maybe investing in the sandbox and the method and stuff like that before we try any really specific
templates or games would make more sense."

His answers (September 29, 2026): Worlds are built in this order: "The engine as a sandbox first
(Opus), then a small pilot game (Sonnet), then the first portfolio template (Sonnet), then more
templates two at a time." The pilot game will be "Toy Hunt Island: twelve toys have escaped the
shelf onto a small island; find them all." The first template will be "Forest trail (walk between
clearings)." On rendering: "Everything you see is splats. Only menus and text are page text, and
collision uses invisible simple shapes. The toy shelf stays pure splats." He added: "if that fails
and we really can't find a way to make it work, then I'd be willing to resort to one of the other
options" (meshes where splats look worse). If you reach that point, tell the Operator with evidence
(clips) before using any mesh you can see. On the site layout: "Add Studio, Worlds, Lab and Learn as
sections behind the labs switch. I decide when each goes public."

You build the engine that the Sonnet lanes will build the pilot game and the templates on, so design
it for them: clear modules, a documented world file, and a sandbox that shows every feature.

Build:

1. **A Worlds page**: `worlds/index.html` with its own small app (ES modules in `src/worlds/`),
   using PlayCanvas only through `src/pc.js` and our kit (`src/kit.js`) to build splats from
   recipes. It is a separate page; the toy app's behavior doesn't change. The toy app gets one
   labs-only link to it (a marked block in index.html: shown only with `?labs=1`).
2. **Worlds from recipes.** A world is a seed plus recipes, built on the device: terrain (a height
   field covered in splats: sand, grass, rock, snow by height and slope), water, a sky, and props.
   Props should reuse existing toy recipes where they fit (the palm, pine, oak, rocks, mushroom and
   more), placed and scaled by the world file. Draw everything as splats.
3. **Scale and detail.** Our vendored PlayCanvas 2.22.3 has level of detail and a splat budget for
   large scenes (look for `lodDistances`, `splatBudget` and the unified gsplat mode). Use them, or
   build chunked level of detail yourself, so near things are sharp and far things cost little. Set
   a splat budget per device tier (like `PICTURE_BUDGETS`) and measure the counts at each tier.
4. **A character**, kit-built, whose parts move as solid pieces (legs, arms and head swing on
   hinges; no warped shapes): idle, walk and run. A third-person camera follows it smoothly and
   never goes into the ground.
5. **Controls.** On a phone: a thumb stick on the left, drag to look on the right, tap a landmark to
   open it. On a computer: WASD or arrow keys, mouse drag to look, click a landmark. Both work with
   the page's own text menus. Honor prefers-reduced-motion for camera sway.
6. **Collision** with invisible simple shapes: the ground height, plus boxes, spheres and capsules
   around props. The character walks up gentle slopes, stops at steep ones and at water, and can't
   pass through props.
7. **Landmarks.** Places in the world with a sign. Walking near one (or tapping it) opens a card, as
   page text, with a title, words, an optional picture and a link. A **plain list view** (a button)
   shows every landmark as an ordinary list, for people in a hurry, screen readers and search
   engines. A **start screen** shows the world's title and welcome text with an "Enter" button.
8. **A world file** (`worlds/<id>/world.json`) holds the title, welcome text, colors, seed, terrain
   settings, props, landmarks (title, words, link, picture, position) and the spawn point. Document
   it in a new `docs/WORLDS.md`: the file format, the modules, how to add a prop or a landmark, and
   the budgets. The Sonnet lanes build on that page.
9. **The sandbox: "Test island"**, a small island with a beach, grass, a few trees and rocks, water
   around it, and four or five landmarks that show each feature. It opens behind the labs switch.

Honesty the owner asked for: our test browser renders in software, so you can't measure real frame
rates. Measure splat counts and frame times as relative numbers, keep within the budgets, and say
plainly in the PR that the owner's phone is the real test.

Clips and cards (390×844):

- `wd-walk`: walking around the island;
- `wd-landmark`: approaching a landmark and opening its card;
- `wd-touch`: the phone controls in use;
- `wd-list`: the list view and the start screen.

Show both a near view and a wide view somewhere in the clips.

Tests in `tests/wd.spec.mjs`:

- the world loads without console errors;
- keys move the character, and it stays on the ground;
- collision stops it at a prop and at water;
- a landmark opens its card;
- the list view lists every landmark;
- the budgets per tier;
- screenshots at 390×844 and 1440×900.

### You own

- worlds/ (new), src/worlds/ (new), docs/WORLDS.md (new), tests/wd.spec.mjs, your `wd-*` screenshots
  and docs/handoff/Worlds.md;
- the labs-only Worlds link in index.html (a clearly marked block);
- small, additive, tested changes in shared engine files (src/kit.js, src/stage.js, src/pc.js) only
  where the world truly needs them. Leave the toy player's behavior unchanged, and say what you
  changed and why in the PR.

The laptop is locked: its look and behavior stay exactly as they are. Lanes Books, Screens and
Viewer (Viewer changes the toy app's header, camera and index.html) run at the same time. Keep your
index.html change to the one marked block.

### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews clips
  and marks them. Don't ask him anything or wait for him. Put questions and blockers in your final
  message, and the Operator answers or relays them. Messages that arrive in this session "From the
  Operator" come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort (the owner's assignment of September 29, 2026: Opus
  5.5 builds the engine, the toys, sounds and fidelity; Sonnet 5.5 builds the Worlds content, the
  Studio converters, the docs and the Integrator). Any helper you start uses the same model. Use at
  most one helper at a time. CLAUDE.md still says "Opus 5.5 only" until the Operator's rules PR
  merges; this brief is the owner's newer word.
- Merging (the owner's rules of September 29, 2026): the Operator merges Ops PRs, anything behind
  the labs switch, and additive engine PRs once the full test run passes. Changes to toys the public
  already sees wait for the owner's "good" marks. Never merge anything yourself.
- Language: every new public-facing text is in American English (color, center, gray, math, license,
  toward, -ize endings, dates like "September 29, 2026"). Leave code identifiers, file names and
  anything stored in links as they are.
- Read first: CLAUDE.md (the ground rules and "Effect quality rules" are binding),
  docs/OPERATING.md, docs/PACKS.md, docs/WORKSTREAMS.md and docs/handoff/history.md (lessons from
  earlier lanes).
- Your handoff file: create it. Start it with this brief, word for word, under "## Brief", then keep
  "## State

Model: Opus 5.5 (default effort).

- September 29, 2026: lane started; draft PR #78 opened with this file.
- The engine is built: `worlds/index.html` with its app in `src/worlds/` (13 modules, listed in
  [WORLDS.md](../WORLDS.md)), the world file format, the Test island (`worlds/test-island/`), the
  labs-only link in the toy box (one marked block in `index.html`), `docs/WORLDS.md`,
  `tools/world-clip.mjs` (review clips) and `tests/wd.spec.mjs`.
- No shared engine file changed (`src/kit.js`, `src/stage.js`, `src/pc.js` untouched): the world has
  its own small PlayCanvas setup (`src/worlds/render.js`) and reuses the kit, the noise, the font
  and the pack recipes as they are.

- Full suite: 318 passed after merging main (then the bush fix and the touch clip's script changed;
  `tests/wd.spec.mjs` passed again, 14 of 14).
- Cards on the Effect review page (September 29, 2026): `wd-walk`, `wd-landmark`, `wd-touch`,
  `wd-list`. The owner marked `wd-landmark` and `wd-touch` good, `wd-walk` good with a note ("looks
  extremely grainy and basic. This must be an impeccable and high-fidelity game") and `wd-list` fix
  ("Needs better resolution and precision. Better character design").
- Fidelity pass: 8 m chunks with five levels, a much denser near ground and about three times the
  grass blades, less color noise, more detail per prop, raised budgets, the character redesigned
  (eleven joints, elbows, hands, a face, hair, collar, belt, shoes), the aerial view planned around
  the island, clips drawn at 2x. Posted `wd-walk-r2` and `wd-list-r2` (the old cards replaced).
- Full suite after merging main again: 361 passed, 2 failed; both pass on a rerun and neither
  touches worlds (a SwiftShader GL warning in `smoke.spec.mjs:1589`, a timing check in
  `sts.spec.mjs:189`). Splats drawn: low 254,719 / 281,578 of 300k; mid 456,801 / 527,797 of 550k;
  high 872,752 / 894,676 of 900k; max 1,318,315 / 1,214,354 of 1.4M.

- The Operator's fidelity notes (September 29, 2026): applied Fidelity A's lessons (limbs as lathes,
  since even spreading draws a lattice on cones; fully opaque solids, props included; clean colors),
  looked at Lab's sharp kernel (a small measured gain that would need wiring into the toy stage: not
  used). Posted `wd-character` (a close-up), `wd-walk-r3` and `wd-list-r3` (replacing the r2 cards,
  whose character was older).
- Full suite after merging main (#86): 391 passed. Splats drawn: low 254,719 / 281,578 of 300k; mid
  456,797 / 527,793 of 550k; high 872,752 / 894,676 of 900k; max 1,318,306 / 1,214,345 of 1.4M.

## Notes

- PlayCanvas 2.22.3's `lodDistances` and per-component `splatBudget` are no-ops now; the scene's
  `gsplat.splatBudget` and LOD work only on streamed octree (SOG with LOD) resources. A world is
  built on the device, so it has its own chunked levels (`lod.js`) and budgets (`tiers.js`), and
  uses the engine's unified splat mode (the default) so chunks, props and the character's parts all
  sort together.
- Props reuse toy recipes baked into their rest pose (`props.js`): parts and tokens where the toy's
  drive puts them at rest, looping particles and hidden pieces left out, and the toy's own ground
  (the grass mound, the lighthouse's patch of sea) found and dropped. Copies share splats.
- The character is nine joints, each a rigid kit-built part on its own entity; walking and running
  only turn joints (no bending). The knees fold on the forward swing.
- Clips and tests run the world on a manual clock (`?clock=manual`) and step it by hand.

## Known issues

- The water is still (no waves): moving water needs a work-buffer modifier on its own entities; left
  for a later engine step.
- Frame times in the test browser are software rendering (about 0.3 s a frame at 390×844, 1.3 s at
  1440×900) and mean nothing for a phone; the owner's phone is the real test.
- Building the Test island takes about 12 s in the test browser (most of it baking the toy recipes);
  on a phone it should be a few seconds.

## For the Operator

- ROADMAP/README: Worlds lives at `worlds/?labs=1`; `docs/WORLDS.md` is the guide for the Sonnet
  world lanes (Toy Hunt Island, the Forest trail template).
- The site layout the owner asked for (Studio, Worlds, Lab and Learn sections behind the labs
  switch) is not in this lane: the toy box only gets a labs-only link to Worlds in its About tab.

### For the Character lane

- The rig lives in `src/worlds/character.js`: `JOINTS` (eleven joints: hips, torso, head, armL/R,
  foreL/R, thighL/R, shinL/R, each with its parent and its pivot in meters, facing +z, feet at y 0)
  and `BODY` (sizes, and `radius` for collision). `buildCharacter(look, { count, seed })` returns
  one `SplatBuffer` per part name, each around its own pivot; `world.js` (`buildCharacter()`) makes
  one entity per joint and one splat entity per part under it. A new joint needs a line in `JOINTS`
  and a part of the same name.
- The animation hooks: `pose(gait, time)` returns `{ joints: { name: [x, y, z] degrees }, bob }`
  (positive x swings a hanging limb backward), and `stepGait(gait, speed, dt)` moves the phase with
  the distance walked. `world.placeCharacter()` applies them every frame. Walk is 1.9 m/s, run 4.6.
- The look comes from the world file's `character` colors (`shirt`, `trousers`, `skin`, `hair`,
  `shoes`).
- Budget: the character is always drawn in full, outside the level of detail. Today it is 60,000
  splats times the tier's `props` factor (0.6 to 1.25), about 54,000 on mid. It counts against the
  tier's budget (`fixedCount()` in `world.js`), so a bigger character leaves less for the ground.
- Lessons: build limbs as lathes (even spreading draws a lattice on `k.cone`), keep solids at
  opacity 1 and color noise low, and judge it with `tools/world-clip.mjs … character` (a close-up at
  2x).

## r2: a sharper island

Branch `claude/lane-worlds-r2`, PR "Phase Worlds r2: a sharper island". Built by Opus 5.5.

The owner's words (September 29, 2026), word for word: "My main criticism is about the worlds: still
just a bit too grainy, and the player/character looks way too low-poly and simplistic. But, the
mechanics are solid! So it primarily seems like design problems and sharpness, not physics and
mechanics."

The Operator's plan: the character goes to a new Character lane (it owns `src/worlds/character.js`
and the character section of docs/WORLDS.md). This round takes the grain out of everything else:

1. The ground, the grass, the sand and rocks, the water's surface, the sky and the signs, with
   Fidelity A's method (even placement, full opacity, full density at each tier, flat splats on flat
   ground, thin blades, clean colors with low noise).
2. The props rebaked from the 97 toys Fidelity A and B sharpened, checked at walking distance.
3. The render settings lane Sharpness measured (#107): the pixel-ratio cap, the resolution drop and
   the sharp kernel, applied in `src/worlds/render.js` where they help.
4. Within the tier budgets, measured.

Cards: `wd-island-r2`, `wd-ground-r2`, `wd-props-r2`, `wd-sky-r2`.

### r2 state

- September 29, 2026: branch restarted from main after #78 merged.
- The grain, measured (`tools/world-grain.mjs`, 390×844 at 2x, mid): speckle on the ground view 0.07
  → 0.03, the shore 0.09 → 0.05, the props 0.09 → 0.05 (lower is cleaner). Lab's sharp kernel alone
  halved it; the ground, water and sign changes make the rest visible as cleaner texture (see the
  before and after in `wd-island-r2`).
- Changes: an even, flat, nearly uniform ground carpet (sizes within ±7%, nearly round, fully
  opaque, color noise ±1%); grass blades in the ground's own color; round, even water splats with a
  soft, isotropic sheen; sign boards with a flat front face and letters placed exactly (nine splats
  per font pixel), kept at full detail to about 80 m; bushes as solid shells; the sharp kernel on
  every tier; the pixel ratio capped per tier (1.5, 2, 3, 3), with `?dpr=` and `?kernel=` to
  override.
- Cards: `wd-island-r2` (before and after), `wd-ground-r2`, `wd-props-r2`, `wd-sky-r2`.
- The props rebake from the packs on main, so they carry Fidelity A and B's fixes.

### r2 known issues

- A bush seen from very close reads as a smooth green shape (solid, but plain).
- The far sea under the aerial view is soft (large far-level splats), without grain.

## Hybrid: model ground, water and sky with splat props

Branch `claude/lane-worlds-hybrid` (from the r2 head; it merges after #108), PR "Phase Worlds
hybrid: model ground, water and sky with splat props (Opus 5.5)". Built by Opus 5.5. Labs only.

The owner's words on the r2 cards (September 29, 2026), word for word: "This continues to get
better, but the quality is still not at the level of a real video game. Is that an unrealistic
expectation for Gaussian splats? Are there other tools that we could integrate (i.e., by upgrading
your tech stack, etc.) to make the graphics better while maintaining Gaussian splat functionality?
Eventually, I do want to see how a hybrid approach would look, where we use Gaussian splats
strategically and use better game tools for other parts, and then integrate these together to build
games that can do things that are almost impossible without Gaussian splats. We can certainly
continue to build out the splat-only world, but if it can't achieve ~AAA graphics and gameplay, then
we can see if there's a way to do that with other tools." After the Operator's report, his answer:
"Hybrid yes." and "I am very interested in making a hyper-realistic hybrid game or simulation
world."

The Operator's brief (the report's steps 1 and 2):

1. Light, shadows and atmosphere in both modes: one sun, soft shadows from the character and the
   props (a shadow catcher over the ground in splats mode), shared haze and a color grade.
2. Hybrid mode: the ground as a lit, textured model of the same height field (near grass stays
   splats), depth-aware water, an HDRI sky that also lights the models, sign boards as models, and
   splats that hide correctly behind and in front of the models.
3. Frames per second and counts per tier in both modes; textures small (under about 10 MB).
4. Side-by-side clips (splats left, hybrid right): `wd-hybrid-walk`, `wd-hybrid-shore`,
   `wd-hybrid-shadows`, `wd-hybrid-sky`.

A world file's `render` (`"splats"` or `"hybrid"`) picks the mode and `?render=` overrides it; the
Test island stays in splats mode until the owner picks. How it works is in docs/WORLDS.md,
"Rendering".

### Hybrid state

- September 29, 2026: built. New modules `src/worlds/lighting.js` (sun, shadows, haze, grade, the
  shadow catcher) and `src/worlds/hybrid.js` (ground tiles and their atlas shader, water, sky dome,
  sign boards); `render.js` gained the mesh and light systems and three layers (`WdSky`, `WdGround`,
  `WdSurface`). No engine files changed (`src/pc.js`, `src/kit.js`, `src/stage.js` are untouched),
  so the toy box looks the same.
- Assets: four Poly Haven texture sets and one HDRI, all CC0, packed by `tools/world-assets.mjs`
  into `assets/worlds/` (about 5 MB); credited in CREDITS.md, `tools/assets.json` and the Worlds
  page's list of places.
- Depth: splats test against the models' depth. In splats mode an invisible depth-only ground model
  keeps a hill in front of the props behind it now that the ground's splats draw in their own layer.
  `tests/wdh.spec.mjs` checks it in both modes (taking away a bush behind the hill changes no
  pixel).
- The character A/B (the Operator's addendum of September 29, 2026, after the owner's marks on the
  Character cards: "Better, but still looks too low-poly. We can stop trying to perfect this for
  now. The hybrid simulation will hopefully enable better characters."): `?character=mesh` swaps in
  a lit, skinned character, Kenney's "Animated Characters: Protagonists" (CC0, checked on the live
  page and in the pack's license file), with idle, walk and run blended by speed and driven by the
  world's clock. The pack has no walk; `tools/world-character.mjs` makes one from the run.
  Quaternius packs were the first choice, but Google Drive refused the downloads here ("Quota
  exceeded") and the one Quaternius pack on OpenGameArt is the older chibi style. My pick for hybrid
  worlds: the mesh character (it reads as a finished game character at phone size), though it is
  stylized, not realistic. The owner decides from `wd-hybrid-character`.
- Cards (390×844, splats left, hybrid right, the same walk): `wd-hybrid-walk`, `wd-hybrid-shore`,
  `wd-hybrid-shadows`, `wd-hybrid-sky`, plus `wd-hybrid-depth` (the depth close-up) and
  `wd-hybrid-character` (splats and mesh characters in the hybrid island).
- Frames, in our software renderer at 390×844, 2x, mid tier (relative only): splats mode about 1.9 s
  a frame, hybrid about 1.8 s. Hybrid draws fewer splats (the ground is a model; only the near grass
  stays splats) and adds about 90 models (64 ground tiles, the water, the sky dome, the signs). The
  owner's phone is the real test.

### Hybrid known issues

- `tests/chr.spec.mjs:249` (the Character lane's island test, three tiers in one 240 s test) times
  out on this branch: splats mode's shadows and haze cost more per frame in the software renderer,
  and #108 alone already needs 3.9 of its 4 minutes. A proposed patch (`test.setTimeout(480_000)` in
  that test) is on the PR for the Operator to decide. Splats mode's light was made cheaper first: no
  tone map there, the catcher only within the shadows' reach, PCF3, only level-0 props cast, and no
  shadows on the low tier.
- Where the shore is steep, the hybrid sand picks up the gravel (rock) texture.
- A thin gray band can show at the horizon, where the sky photo's haze meets the far water.
- The grass texture (a meadow photo) shows small pale pebbles close up; its strength is lowered.
- The depth clip's bush is wholly behind the hill (the test checks it pixel by pixel); a bush only
  half hidden was not found on the island.
- The splat character is unchanged from main (#110 merges separately).
- Not in this round (the brief): time of day, a PlayCanvas upgrade, photos or scans as places, the
  pilot game.
