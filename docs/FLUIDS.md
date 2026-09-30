# Fluids: liquids, smoke and flames made of splats

Lane Fluids, September 29, 2026 (Opus 5.5). The brief and the lane's state are in
[handoff/Fluids.md](handoff/Fluids.md); the recipe API is also in [PACKS.md](PACKS.md), "5d.
Fluids".

This is graphics physics: it moves in a believable way at phone size. It is not a validated
scientific solver, and the Fluid lab's About text says so.

## What it is

A kit toy declares fluids with `k.fluid({ ... })` in its `build`. When the toy opens, the player
loads `src/fluids/` (never before: the shelf and embeds don't fetch it), simulates the fluids on the
toy's own clock and draws them as one extra splat layer, one splat per particle, sorted with the
toy. The recipe's `drive()` steers them through `out.fluid`.

| File                     | What it does                                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/fluids/sim.js`      | The solvers: `Liquid` (position-based fluids), `Gas` (smoke, steam), `Flame`, the colliders (signed distances) and the splat-shape pass.             |
| `src/fluids/world.js`    | `FluidWorld`: builds a toy's systems at its tier's budget, applies `out.fluid`, steps them and packs every particle for the renderer.                |
| `src/fluids/render.js`   | `FluidLayer`: the splat layer and its work-buffer program (GLSL and WGSL) that shapes, turns, lights and colors each splat.                          |
| `src/fluids/runtime.js`  | `FluidRuntime`: runs the world in a Web Worker (people's devices) or on the page (the tools and tests, which step the clock by hand) and uploads it. |
| `src/fluids/worker.js`   | The worker.                                                                                                                                          |
| `src/packs/fluid-lab.js` | The Fluid lab (labs, Lab shelf): a glass to pour into, a splash bowl, a candle and a hot cup.                                                        |

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
flame hands its dying particles to a smoke system (`smoke: "<name>"`): a thin wisp while it burns, a
thick curl when it is put out.

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

`node tools/fl-measure.mjs` on September 30, 2026 (after r2): the solver's time per 30 fps frame
(ms, median over 4 s after a tap; stepping, packing and the splat shapes), in Chromium with its CPU
slowed down as each tier's stand-in. A frame is 33 ms; the solver runs in a worker, so it doesn't
slow the drawing.

| Scene      | low (6×) | mid (4×) | high (2×) | max (1×) |
| ---------- | -------- | -------- | --------- | -------- |
| Pour water | 15       | 21       | 36        | 25       |
| Pour soda  | 18       | 31       | 56        | 34       |
| Pour honey | 12       | 18       | 31        | 21       |
| Splash     | 14       | 15       | 33        | 9        |
| Candle     | 0.9      | 0.5      | 0.4       | 0.2      |
| Hot cup    | 0.2      | 0.1      | 0.1       | 0.1      |

Measured again after r2 (four splats per particle, the level sheet and the soda's denser foam). The
soda pour is the tightest: its head takes up to 3.5 times the liquid's budget in foam flecks.

Liquid particles at most (the glass, the splash): low 420 and 455, mid 540 and 585, high 1,200 and
1,300, max 1,620 and 1,755. The solver costs about 4.4 µs per particle per 1/120 s step on this
machine's CPU unthrottled. The high tier's stand-in (2×) is pessimistic for the desktops it covers;
at 1× the high budget takes about 17 ms. Drawing adds only the fluid's splats (at most a few
thousand, plus the glass) to the toy's own, and the toy asks for three quarters of its tier's splats
(`density: 0.75`).

## Limits and next steps

- Colliders don't move with a part yet (a tipping jug, a stirring spoon). The runtime would need the
  part's transform per frame, which `out.parts` already has.
- No two-way coupling: liquid doesn't push kit parts, tokens or floating objects.
- One liquid per system; two liquids in one glass would be two systems that don't feel each other.
- Honey coils only as far as the particle size allows; a finer thread needs more particles.
- A GPU solver (WebGL2 ping-pong textures) would allow many more particles, but neighbor search
  without compute shaders is its own project; the worker solver meets the phone budget today.
