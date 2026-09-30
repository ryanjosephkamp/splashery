# Fluids: liquids, smoke and flames made of splats

Lane Fluids, September 29, 2026 (Opus 5.5). The brief and the lane's state are in
[handoff/Fluids.md](handoff/Fluids.md); the recipe API is also in [PACKS.md](PACKS.md), "5e.
Fluids".

This is graphics physics: it moves in a believable way at phone size. It is not a validated
scientific solver, and the Fluid lab's About text says so.

## What it is

A kit toy declares fluids with `k.fluid({ ... })` in its `build`. When the toy opens, the player
loads `src/fluids/` (never before: the shelf and embeds don't fetch it), simulates the fluids on the
toy's own clock and draws them as one extra splat layer, one splat per particle, sorted with the
toy. The recipe's `drive()` steers them through `out.fluid`.

| File                     | What it does                                                                                                                                                                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/fluids/sim.js`      | The solvers: `Liquid` (position-based fluids), `Gas` (smoke, steam), `Flame`, the colliders (signed distances) and the splat-shape pass.                                                                                                |
| `src/fluids/world.js`    | `FluidWorld`: builds a toy's systems at its tier's budget, applies `out.fluid`, steps them and packs every particle for the renderer.                                                                                                   |
| `src/fluids/render.js`   | `FluidLayer`: the splat layer and its work-buffer program (GLSL and WGSL) that shapes, turns, lights and colors each splat.                                                                                                             |
| `src/fluids/runtime.js`  | `FluidRuntime`: runs the world in a Web Worker (people's devices) or on the page (the tools and tests, which step the clock by hand) and uploads it.                                                                                    |
| `src/fluids/worker.js`   | The worker.                                                                                                                                                                                                                             |
| `src/packs/fluid-lab.js` | The Fluid lab (labs, Lab shelf): a glass to pour into, a splash bowl, a candle and a hot cup.                                                                                                                                           |
| `src/fluids/gpu/`        | r4 (below): the GPU liquid (`mpm.js`, `liquid.js`), its foam and bubbles (`diffuse.js`), the liquid surface (`surface.js`) and the gas grid (`gas.js`, `gasscene.js`), tied together in `index.js`. Loaded only when a fluid toy opens. |

## The solvers

### Liquids: position-based fluids

Macklin and Müller, "Position Based Fluids" (2013). Each step:

1. Gravity, then a predicted move (at most 2.5 particle sizes a step). A fast particle marches along
   its move against the colliders, so it can't pass through a thin glass wall in one step.
2. Neighbors within the kernel (1.8 particle sizes) from a dense grid over the particles' bounds.
3. Three solver passes (two on the low tier): each particle's density from its neighbors (the poly6
   kernel), plus a **wall term** (the density a flat wall of rest particles would add at that
   distance, tabulated once), then the paper's λ and position corrections with its artificial
   pressure (s_corr) and relaxation. Without the wall term, particles pack against a glass's wall
   about a third tighter than elsewhere and the level drops; with it the settled level is within a
   few percent of the volume poured.
4. **Cohesion**: the density constraint may pull a little (down to −0.06 for water, −0.16 for
   honey), so a surface holds together instead of fraying into beads.
5. Velocities from the moves, then **viscosity** as XSPH: each velocity moves toward its neighbors'
   weighted mean by `1 − exp(−dt (4 + 900 v²))`, one to three passes. `v` runs from 0.02 (water) to
   0.9 (lava): water splashes, honey moves as one body, piles up and coils. Viscous liquids also
   hold back their slide along a wall (friction).
6. The color-field gradient gives each particle an outward normal and how much of a surface it is
   on.

Steps are at most 1/120 s, up to 2 (low), 3 (mid) or 4 (high, max) per frame; a device that can't
keep up runs the liquid in slow motion rather than taking longer steps.

**Diffuse particles** (after Ihmsen et al. 2012, much simplified): where fast liquid meets the
surface it throws off spray (ballistic drops) and foam (flecks carried by the liquid and held at its
top); a soda also nucleates bubbles that rise through the liquid, wobbling, and mostly pop at the
top, a few gathering as a thin ring. Each classifies itself every step by how deep in the liquid it
is (a bubble that reaches the top pops or turns to foam, spray that lands becomes foam).

Presets (`preset`): `water`, `soda` (fizz and a foam head), `syrup`, `honey`, `lava` (glows by its
heat, a dark crust where its surface cools). Any field can be overridden.

### Smoke and steam

Particles that rise (buoyancy that fades with age), slow toward a swirl field and spread and fade.
The swirl is the curl of a sum of moving sine vortices (each `e sin(k·p + ωt)`, whose curl is
`cos(k·p + ωt) (k × e)`): exactly divergence free and cheap. The swirl grows with height, so a plume
is laminar near its source and turbulent higher up (a candle's thin ribbon that breaks into curls).
`wind` pushes it, stronger higher up. `puff` sends a burst (a candle blown out).

### Flames

Short-lived particles (about 0.4 s) that rise from a disc at the wick, accelerating so they reach
the flame's height over their life, drawn in toward the axis into a tongue, swaying more near the
tip with a whole-flame flicker. The renderer colors them by age through the ramp of a real candle
flame: a blue base, yellow-white, yellow, orange, a dull red, fading out. Sparks now and then. A
flame hands its dying particles to a smoke system (`smoke: "<name>"`): barely a trace while it burns
(a clean candle flame makes almost no visible smoke), a thick curl when it is put out.

### Colliders

Signed distance functions in recipe units: `floor`, `box`, `sphere`, `cylinder`, `glass` (an
open-top glass or cup: `radius` inside, `wall`, `bottom`), `bowl` (a half sphere open at the top).
They don't move (yet).

## Drawing

One splat per particle, in a layer with its own work-buffer program, reading four small float
textures a frame (place; velocity and kind; turn; radii and material) and the toy's uniforms (the
camera, the whole-toy move and turn, the splat scale and exposure).

- **Liquid.** Each particle draws four smaller splats (`LIQUID_SUB`), which gives a crisper edge
  than one big one. Its place is smoothed toward its neighbors' (75%), and its normal is its
  neighbors' average (no mottling). Then, by where it is:
  - **A thin, fast stream** (few neighbors, fast): the four splats lie across the stream, each long
    along the flow by its speed (longer for honey and lava, whose threads thin as they fall), with
    the normal across the stream. A falling stream then reads as a glassy rod, with a rim and a
    highlight.
  - **The body and its surface:** a disc along the smoothed normal, flatter the more it is on the
    surface.
  - **Thin sheets, necks and threads:** the ellipsoid of its neighbors (Yu and Turk, "Reconstructing
    Surfaces of Particle-Based Fluids Using Anisotropic Kernels", 2013), clamped to 4:1.
  - **A lone drop:** round, stretched by its speed.

  Lit with an even body color, a bright rim where the surface turns away (Fresnel, weaker for a dark
  liquid such as cola, so it keeps its color), a highlight, full opacity. The toy uses the Lab
  lane's sharper splat edge (`kernel: "sharp"`).

- **The level sheet.** A thin liquid (viscosity up to 0.3) in a `glass` collider also draws its top
  as one even sheet of small flat splats at the calm liquid's level (the 96th percentile of the
  particles' heights in the glass). It fades in as the top layer calms and out while a pour or a
  splash stirs it, so a settled pool reads as one surface, not as the tops of particles. Honey and
  lava keep their mounds. Where the liquid has foam, the sheet is its head: the foam flecks near the
  level, counted on a coarse grid over the glass, color the sheet a fine, even cream (shown even
  while the surface is stirred), and foam spreads out from where it gathers, fading toward the wall.
- **Foam, bubbles, spray.** Small flat pale flecks; tiny bright dots; small drops of the liquid.
- **Smoke and steam.** Soft splats that grow and fade with age.
- **Flames.** Emissive, colored by age through the ramp above, narrowing toward the tip.
- **Glass** (`kind: "vessel"`): the engine can draw a `glass` collider itself, as even flat splats
  over its walls, lip and foot, and its rims as clean lines (splats long along each rim), clear
  where you look straight through and brighter toward the edges (Fresnel), with a highlight. Kit
  splats can't depend on the view, which is what makes glass read as glass; a kit-built glass showed
  its wall as a grain or a moiré.

WebGPU sorts the moved splats on the GPU. WebGL2 sorts on the CPU from stored places, so the layer
gives it the particles' new places every other frame.

## Budgets

The recipe's `budget` is the particle count on the high tier; the tiers scale it (low 0.35, mid
0.45, high 1, max 1.35). A liquid on a lower tier gets fewer, larger particles (its spacing grows
with the cube root), so the same volume pours. `tools/fl-measure.mjs` times the solver per tier with
Chromium's CPU throttling as the stand-in phone (low 6×, mid 4×, high 2×, max 1×):

## Measured

`node tools/fl-measure.mjs` on September 30, 2026 (after r3): the solver's time per 30 fps frame
(ms, median over 4 s after a tap; stepping, packing and the splat shapes), in Chromium with its CPU
slowed down as each tier's stand-in. A frame is 33 ms; the solver runs in a worker, so it doesn't
slow the drawing. The aim is about 22 ms on the stand-in (two thirds of a frame), leaving headroom.

| Scene      | low (6×) | mid (4×) | high (2×) | max (1×) |
| ---------- | -------- | -------- | --------- | -------- |
| Pour water | 16       | 20       | 37        | 21       |
| Pour soda  | 19       | 30       | 59        | 33       |
| Pour honey | 13       | 20       | 33        | 19       |
| Splash     | 14       | 14       | 31        | 9        |
| Candle     | 0.7      | 0.3      | 0.3       | 0.2      |
| Hot cup    | 0.1      | 0.1      | 0.1       | 0.1      |

The soda pour is the tightest (40 ms on its slowest tenth of frames on mid): its foam head is about
a third of its cost. Since r3, phones (low and mid) get 0.7 times the foam flecks, each counting for
more, so the head covers the same (`diffuse`); halving them would save about 3 ms more on mid.

What the stand-ins mean: every phone gets the mid tier (touch and a small screen), and so do
machines with 4 cores or 4 GB. Mid's stand-in, this build machine's processor slowed 4×, is roughly
a budget Android phone from about 2019; most phones in use are faster, so it is a cautious test.

Liquid particles at most (the glass, the splash): low 420 and 455, mid 540 and 585, high 1,200 and
1,300, max 1,620 and 1,755. The solver costs about 4.4 µs per particle per 1/120 s step on this
machine's CPU unthrottled. The high tier's stand-in (2×) is pessimistic for the desktops it covers;
at 1× the high budget takes about 17 ms. Drawing adds only the fluid's splats (at most a few
thousand, plus the glass) to the toy's own, and the toy asks for three quarters of its tier's splats
(`density: 0.75`).

## Checked against physics

`node tools/fl-physics.mjs` measures the solver in Node (real units: the Fluid lab's unit is 0.33 m)
and compares it with published values. Measured on September 30, 2026:

| Check                                      | Ours                        | Published                         | Source                                                              |
| ------------------------------------------ | --------------------------- | --------------------------------- | ------------------------------------------------------------------- |
| Candle flicker (the tip's height)          | 11 Hz                       | 10 to 12 Hz                       | Kitahata et al. 2009, J. Phys. Chem. A 113; Cetegen and Ahmed 1993  |
| Plume spread (half-width per height)       | smoke 0.125, steam 0.122    | 0.10 to 0.14                      | Morton, Taylor and Turner 1956, Proc. R. Soc. A 234                 |
| Bubble rise in soda                        | 14.1 cm/s                   | 10 to 20 cm/s (1 mm bubbles)      | Clift, Grace and Weber 1978, Bubbles, Drops and Particles           |
| A water blob spreading on a floor          | radius ∝ t^0.54             | t^0.5 (inertial)                  | Huppert and Simpson 1980, J. Fluid Mech. 99                         |
| Honey spreading                            | t^0.41, then stops at 22 cm | keeps creeping as t^1/8 (viscous) | Huppert 1982, J. Fluid Mech. 121                                    |
| Dam-break front (column 2:1, wide channel) | about 63% as far by T = 5.3 | Table 2                           | Martin and Moyce 1952, Phil. Trans. R. Soc. A 244                   |
| A falling stream narrows                   | keeps its width             | 64% of its width 26 cm down       | mass conservation (Eggers and Villermaux 2008, Rep. Prog. Phys. 71) |

- Fixed in this round: the flame's flicker was a 1.7 Hz sway; it now puffs at 11 Hz (the upper flame
  stretches and its tip pinches off, `flicker` and `pinch`). Smoke and steam spread twice too wide
  (0.26 and 0.29): the Fluid lab's swirl is calmer. A burning candle trailed a gray wisp; a clean
  flame now makes none (`smokeRate`, 0 by default).
- The dam break follows the measured front early (T = 1.2: 1.37 against 1.44) and then falls behind:
  position-based fluids lose a little energy each step for stability. Eight solver passes instead of
  three close part of the gap, at over twice the cost. A narrow channel (8 particles wide) drags the
  front further on its walls, so the test uses a wide one.
- Honey stops where real honey keeps creeping slowly: cohesion and wall friction hold it like a
  paste. In a glass the difference is too small to see.
- A stream only two or three particles wide can't thin as it falls; that needs more, smaller
  particles than the phone budget allows.

## r4: a GPU solver, a liquid surface and a gas grid

The owner's note of September 30, 2026, after r3: the fluids "still don't seem realistic enough". r4
changes three things. Browsers without WebGPU keep everything above, unchanged.

### Many more particles: MLS-MPM on the GPU

On a WebGPU device the liquid runs on the GPU with MLS-MPM (Hu et al., "A Moving Least Squares
Material Point Method", SIGGRAPH 2018, as in its compact "MLS-MPM88" form): particles carry mass,
velocity and an affine matrix (APIC); each substep scatters them to a grid (quadratic B-splines),
solves forces on the grid and gathers back. Fluid pressure is a Tait equation of state (power 7,
clamped so a free surface doesn't pull), viscosity a stress `μ(C + Cᵀ)` from each preset's real
kinematic viscosity (water and soda 1e-6 m²/s, syrup 1e-3, honey 4e-3, lava 1e-2). Colliders are the
same shapes as on the CPU, as signed distances on the grid (a glass's wall is at least three cells
thick for the solver, so nothing leaks through; the drawn glass keeps its own wall).

Why MLS-MPM and not position-based fluids on the GPU: MPM needs no neighbor search (a scatter with
atomic adds and a gather over a 3×3×3 stencil), so it maps directly onto compute shaders, and in a
short measurement (the dam break below, on the same harness) it followed Martin and Moyce more
closely than the CPU solver did.

| Tier | Cell (cm) | Particles at most | Substeps a frame | Foam and bubble budget |
| ---- | --------- | ----------------- | ---------------- | ---------------------- |
| low  | 1.3       | 12,000            | 14               | 0.5×                   |
| mid  | 1.0       | 40,000            | 24               | 0.7×                   |
| high | 0.73      | 120,000           | 36               | 1×                     |
| max  | 0.59      | 200,000           | 44               | 1.3×                   |

The CPU liquid has at most 1,755 particles (max) and 455 to 585 on phones, so the GPU path has 25 to
110 times as many. The substep is sized by the fastest motion (the sound speed of the equation of
state plus the fastest fall); a frame that would need more than its tier's substeps runs in slow
motion, and the emitter and drain follow the simulated time.

**How it talks to PlayCanvas.** The solver uses PlayCanvas's own WebGPU device (`pc.StorageBuffer`,
`pc.Compute`, `device.computeDispatch`), so its buffers never leave the GPU. Each frame the page
encodes the substeps (five compute dispatches each: clear, particle-to-grid mass, particle-to-grid
stress, grid update, grid-to-particle) and one more that writes every particle's place and speed
into a float texture. The surface pass reads that texture directly: no copy back to the CPU and no
upload. The page's cost is encoding the dispatches, about 1 ms a frame for 24 substeps (measured in
Chromium on this machine); the GPU's cost is the dispatches themselves (see "Measured, r4"). The
only read-back is for foam and bubbles (below), asynchronous and ten times a second, so a frame
never waits on it.

**Foam, bubbles and spray** stay particles (after Ihmsen et al. 2012, as on the CPU). Ten times a
second the liquid is read back into a coarse picture (how full each cell is, its mean velocity and
the top of the slow pool in each column). Foam forms where fast liquid plunges into the pool (not
along a falling stream), rides the pool's top and spreads; a soda nucleates bubbles deep in the
liquid that rise at their terminal speed and mostly pop at the top; spray is ballistic. They move on
the CPU every frame (a few thousand at most) and are drawn by the surface pass: foam and spray over
the liquid, bubbles inside it, tinted by it.

### A real liquid surface

Screen-space fluid rendering (Green, "Screen Space Fluid Rendering for Games", GDC 2010; van der
Laan, Green and Sainz, I3D 2009), after PlayCanvas has drawn the frame (`postrender`):

1. Each particle is drawn as a sphere into a depth texture and, added up, into a thickness texture,
   at half or three fifths of the screen's resolution. A sphere is never drawn smaller than 1.6
   texels (a far or small liquid would break into specks), keeping its volume in the thickness.
2. A bilateral filter (two passes) smooths the depth across particles but not across edges, so they
   merge into one surface.
3. The last pass rebuilds normals from the smoothed depth and shades the liquid over a copy of the
   frame: refraction of what is behind (offset by the normal), Beer–Lambert absorption by the
   thickness (so a deep cola is dark and its thin edges amber, and water tints only where it is
   deep), a Fresnel reflection of a soft studio sky, a specular highlight, and glow for lava.
4. The glass is traced analytically in the same pass (a cylinder: the front wall's Fresnel
   reflection and highlight, its silhouette lines, the far wall's faint reflection), so the liquid
   is seen through it.

### Real smoke and flames: a grid gas solver

Smoke, steam and flames run on a 3D grid on both WebGPU and WebGL2 (fragment shaders over a 3D grid
laid out as tiles in 2D half-float textures, so phones get it too): stable fluids (Stam, "Stable
Fluids", SIGGRAPH 1999) with semi-Lagrangian advection, buoyancy from temperature and smoke weight,
vorticity confinement (Fedkiw, Stam and Jensen, "Visual Simulation of Smoke", SIGGRAPH 2001), Jacobi
pressure iterations and an open top. A flame is fuel that burns into heat; its light comes from the
heat, through the color ramp (blue base where fuel meets air, then yellow-white, orange, dull red).
The volume is ray-marched in the surface pass.

- A flame gets its own fine grid (a candle flame is about a centimeter wide) stepped at 120 Hz;
  smoke and steam share a coarser one.
- A room's faint drafts (slow, smooth, stronger higher up) make a plume sway and meander instead of
  standing straight; the grid's edges fade out, so its box never shows.

| Tier | Smoke grid (cells a side) | Pressure iterations | Steps a second |
| ---- | ------------------------- | ------------------- | -------------- |
| low  | 24                        | 12                  | 30             |
| mid  | 32                        | 16                  | 30             |
| high | 44                        | 20                  | 45             |
| max  | 56                        | 24                  | 60             |

### Measured, r4

`node tools/fl-gpu-physics.mjs --profile=mid` on September 30, 2026: the dam break of "Checked
against physics" (a 2:1 water column in the same channel, real units) on the GPU solver, 32,000
particles, against Martin and Moyce's Table 2 (front Z = x/a at time T = t√(2g/a)):

| T    | Measured (1952) | GPU (r4) |
| ---- | --------------- | -------- |
| 1.19 | 1.44            | 1.24     |
| 1.91 | 2.33            | 1.85     |
| 2.58 | 3.22            | 2.61     |
| 3.26 | 4.11            | 3.52     |
| 3.92 | 5.00            | 4.51     |
| 4.61 | 5.89            | 5.58     |
| 5.32 | 6.76            | 6.64     |

RMS difference 0.46 over all 13 points (the CPU solver: 1.23, about 63% as far by T = 5.3). The GPU
front starts a little behind (the column needs a moment to collapse, as a real gate's lift does) and
then runs at the measured speed, reaching 98% of the measured distance by T = 5.3.

`?fluids=cpu` keeps the r3 path everywhere (the tests use it for the splat program on WebGPU).

## Limits and next steps

- Colliders don't move with a part yet (a tipping jug, a stirring spoon). The runtime would need the
  part's transform per frame, which `out.parts` already has.
- No two-way coupling: liquid doesn't push kit parts, tokens or floating objects.
- One liquid per system; two liquids in one glass would be two systems that don't feel each other.
- Honey coils only as far as the particle size allows; a finer thread needs more particles.
- The GPU liquid needs WebGPU compute; on WebGL2 the liquid is the CPU solver's splats (r3).
