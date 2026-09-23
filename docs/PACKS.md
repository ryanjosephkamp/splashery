# Writing toys for Splashery packs

Most Splashery toys are **recipes**: small functions in `src/packs/<pack>.js` that describe a toy
with the toy kit (`src/kit.js`). The browser builds the toy from the recipe when someone picks it,
so a toy costs a few kilobytes of code instead of megabytes of splats, and every choice comes from a
seed, so it rebuilds exactly the same everywhere.

## 1. The two places a toy lives

**The catalogue** (`src/toys.js`, the `TOYS` array) holds metadata only. Add entries under your
pack's `// ---- Pack: <name> ----` marker:

```js
{
  id: "comet",                 // unique, lower-case words joined by hyphens
  label: "Comet",              // shelf name, short
  category: "space",           // one of CATEGORIES in src/toys.js
  kind: "kit",
  pack: "space",               // loads src/packs/space.js
  tags: "ice tail dust coma",  // extra search words
  camera: { yaw: 0.5, pitch: 0.3, roll: 0, distance: 5 }, // optional; distance is in toy radii
},
```

**The recipe** goes in `src/packs/<pack>.js`, which exports `RECIPES` keyed by id:

```js
import { mix, shade, smoothstep, spline } from "../kit.js";

export const RECIPES = {
  comet: {
    alive: true,                 // has behaviours that move by themselves
    options: [...],              // rebuild the toy (style, colour); optional
    controls: [...],             // change it live (sliders, switches, pulses); optional
    action: { key, label, sound }, // what a tap on the toy does; optional
    drive(t, c, out, info) {},   // per frame: parts, amounts; optional
    build(k, o) {},              // required: describe the toy with the kit
  },
};
```

## 2. Coordinates and size

- **+Y is up.** The default camera looks from the front-right, slightly above: +Z faces the viewer,
  +X is to the right.
- Model in any units around the origin. After `build`, the kit centres the toy and scales it to fit
  a sphere of radius 0.95, and moves part pivots with it. Keep proportions, not absolute sizes.
- Things that travel outside the toy's resting shape (rising flames, an opened lid, an orbit) should
  be declared with `k.reach([x, y, z])` so the camera frames them.

## 3. Shapes

Each call returns a shape; nothing is drawn until you `k.add` it.

| Call                                                          | Shape                                                                                                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `k.sphere(r)`                                                 | Sphere. Samples carry `u` (longitude 0..1) and `v` (0 at the top, 1 at the bottom).                                                            |
| `k.ellipsoid(a, b, c)`                                        | Ellipsoid with half-axes along X, Y, Z.                                                                                                        |
| `k.box(sx, sy, sz)`                                           | Box with full sizes. Samples carry `face` (0..5 for +X, −X, +Y, −Y, +Z, −Z) and face `u`, `v`.                                                 |
| `k.roundedBox(sx, sy, sz, power = 8)`                         | Rounded box (a superellipsoid: 2 is an ellipsoid, higher is boxier).                                                                           |
| `k.cylinder(r, h, { caps })`                                  | Cylinder along Y, centred. `caps`: `true`, `false`, `"top"` or `"bottom"`. Samples carry `side` or `cap` and `radial`.                         |
| `k.cone(r0, r1, h, { caps })`                                 | Cone frustum from radius r0 at the bottom to r1 at the top.                                                                                    |
| `k.torus(R, r)`                                               | Torus in the XZ plane.                                                                                                                         |
| `k.disc(r1, r0 = 0)`                                          | Flat disc (or ring) in the XZ plane, both sides.                                                                                               |
| `k.lathe([[r, y], ...], { grid })`                            | Surface of revolution around Y through a smooth profile (bottom to top). Vases, bottles, fruit, towers.                                        |
| `k.tube(curve, radius, { closed, caps })`                     | Tube along `curve(t) -> [x, y, z]`, t in 0..1; `radius` is a number or `(t) => r`. Stems, arms, knots.                                         |
| `k.param((u, v) => [x, y, z], { grid, flip, normal, thick })` | Any parametric surface on u, v in 0..1, sampled evenly by area. `flip` reverses normals.                                                       |
| `k.radial((dir) => r, { grid })`                              | A star-shaped surface: distance from the origin along each direction. With `implicitRadius(f)` it wraps an implicit surface `f(p) < 0` inside. |

Helpers exported by `src/kit.js`: `spline(points, { closed })` (smooth curve for tubes),
`mix(a, b, t)`, `shade(c, f)`, `ramp(stops, t)`, `rgb(c)`, `clamp`, `smoothstep`,
`fibonacciSphere(n)`, `quatEuler(x, y, z)`, `quatAxisAngle(axis, angle)`, `quatFromTo(a, b)`,
`quatRotate(q, v)`, `implicitRadius(f, far)`, and `vec` (add, sub, mul, dot, len, cross, unit).

## 4. Adding a shape

```js
k.add(shape, {
  pos: [x, y, z], rot: [degX, degY, degZ], // or quat: [x, y, z, w]
  scale: 1 | [sx, sy, sz],
  color: "#hex" | [r, g, b] | (c) => colour,
  weight: 1,        // density relative to the rest (2 = twice as many splats per area)
  share: 0.1,       // or: exactly this fraction of the whole budget
  size: 1,          // splat size multiplier
  flat: 0.25,       // splat thickness (0 flat discs .. 1 round blobs)
  stretch: 3,       // for tubes: splats elongated along the tube
  opacity: 0.95,
  jitter: 0.04,     // colour noise
  interior: 0.12,   // share of this shape's splats that fill its inside (for Slice)
  core: "#hex" | (c) => colour,   // colour of the inside
  part: index,      // from k.part(...)
  kind: "flame", params: [a, b] | (c) => [a, b],  // a behaviour (section 6)
  pattern: false,   // keep this shape's own colours under flags and patterns
});
```

The splat budget is shared between shapes by surface area times `weight`, so the toy has an even
density. Use `share` for small details that need a fixed number of splats, and `weight` > 1 for
small shapes that would otherwise look sparse (eyes, stitches, gems).

**The colour function** gets `c` with:

| Field                                         | Meaning                                                                      |
| --------------------------------------------- | ---------------------------------------------------------------------------- |
| `c.p`, `c.n`                                  | Position and normal after `pos`/`rot`/`scale` (in recipe coordinates).       |
| `c.lp`, `c.ln`                                | Position and normal in the shape's own coordinates.                          |
| `c.u`, `c.v`                                  | Surface coordinates from the shape (see the table above); `c.t` along tubes. |
| `c.s`                                         | The raw sample (`face`, `side`, `cap`, `radial`, `tangent`...).              |
| `c.rand()`                                    | Seeded random number (use this, never `Math.random`).                        |
| `c.noise(x, y, z)`, `c.fbm(x, y, z, octaves)` | Seeded smooth noise, roughly −1..1.                                          |
| `c.inside`                                    | True for interior splats.                                                    |

It returns a colour, or `null` to leave a hole (openings, cut-outs, a missing box face), or
`{ c: colour, keep: true, size: 0.8 }` to keep one splat out of the pattern layer (seams, stitches,
eyes, labels) or resize it.

**Clouds** are for free-form splats (stars, sparks, fur, crumbs, galaxies):

```js
k.cloud({ share: 0.2, size: 1 }, (rand, i, n) => ({
  p: [x, y, z],
  color: "#hex",
  size: 1,
  opacity: 0.9,
  n: [nx, ny, nz], // flat disc facing n; or dir: [..] and stretch: 3 for a streak; or neither for round
  kind: "twinkle",
  params: [0.5, rand() * 6],
  part: 0,
  pattern: false,
}));
```

`k.rand()` gives recipe-level random numbers (where to put the stones, how many petals).

## 5. Parts, controls, actions and options

**Parts** are rigid groups: `const lid = k.part("lid", { pivot: [0, 0.3, -0.4], axis: [1, 0, 0] })`,
then `part: lid` on the shapes. At most 15 parts. Each frame, `drive(t, c, out, info)` sets them:

```js
drive(t, c, out, info) {
  out.parts.lid = { angle: -1.9 * c.open };          // about the part's axis
  out.parts.rotor = { angle: t * 12 };               // t is the toy's own clock (seconds, times Speed)
  out.parts.arrow = { offset: [0, 0, 2 * c.fire], visible: c.fire < 1 ? 1 : 0 };
  out.parts.wing = { quat: quatAxisAngle([0, 0, 1], Math.sin(t * 8) * 0.6) };
  out.amount = 0.5 + c.size;   // scales beat, breathe, flame, rise, twinkle, sway and wave
  out.energy = c.melt;         // drives "melt" (0..1)
  out.grow = c.bloom;          // drives "grow" (0..1)
  out.glow = [r, g, b, strength]; // colour of the "pulse" glow
  out.body = { offset: [0, 0.1, 0], quat, squash };  // move the whole toy (in toy radii)
}
```

`t` only advances while the toy is alive (motion on); controls ease even when it is not.

**Controls** (`c` in `drive`), values 0..1:

- `{ key: "size", label: "Fire size", type: "slider", default: 0.5 }`
- `{ key: "open", label: "Open", type: "toggle", default: 0, ease: 1.1 }`: eases between 0 and 1
  over `ease` seconds.
- `{ key: "stoke", label: "Stoke", type: "pulse", ease: 1.5 }`: jumps to 1 and falls back to 0.

**Action**: `action: { key: "open", label: "Open or close", sound: { on: "open", off: "close" } }`
(or `sound: "fire"`). A tap on the toy (and the button in the Play tab) toggles a toggle or fires a
pulse. Sounds: poke, hop, bounce, paint, clay, drop, whoosh, chime, open, close, fire, pop,
heartbeat, click. Toys without an action hop when tapped.

**Options** rebuild the toy and are saved in the scene (`o` in `build`):

- `{ key: "color", label: "Colour", type: "color", default: "#d9632b" }`
- `{ key: "style", label: "Style", type: "select", default: "a", choices: [{ id: "a", label: "A" }] }`
- `{ key: "spots", label: "Spots", type: "switch", default: true }`
- `{ key: "petals", label: "Petals", type: "slider", min: 3, max: 12, step: 1, default: 5 }`

## 6. Behaviours

A behaviour moves each splat on the GPU, every frame. Set `kind` and `params: [a, b]` on a shape or
a cloud splat:

| kind      | What it does                                              | a                                     | b                                             |
| --------- | --------------------------------------------------------- | ------------------------------------- | --------------------------------------------- |
| `orbit`   | Turns around the toy's up axis.                           | turns per second at the rim (radians) | falloff: 0 rigid, 1.5 Keplerian               |
| `beat`    | Heartbeat swell from the centre.                          | amount (0.05)                         | phase                                         |
| `breathe` | Slow swell.                                               | amount                                | phase                                         |
| `flame`   | Rises, shrinks and reddens in a loop.                     | height in toy radii                   | phase (random)                                |
| `rise`    | Drifts up and fades (embers, bubbles, smoke).             | height                                | phase                                         |
| `fall`    | Falls and fades (rain, snow, petals).                     | distance                              | phase                                         |
| `twinkle` | Brightness flicker.                                       | amount (0.3 to 1)                     | phase                                         |
| `sway`    | Bends with height above a base (plants, tentacles, hair). | amount                                | base height (toy coordinates, before the fit) |
| `grow`    | Appears as `out.grow` passes a.                           | threshold 0..1                        | unused                                        |
| `melt`    | Slumps and spreads to the floor as `out.energy` rises.    | how easily (0..1)                     | unused                                        |
| `pulse`   | A glow (`out.glow`) runs along a path.                    | position along the path 0..1          | unused                                        |
| `wave`    | Ripples up and down.                                      | amount                                | phase                                         |
| `glint`   | Sparkles as the camera moves.                             | amount                                | unused                                        |

`amount` from `drive` multiplies beat, breathe, flame, rise, twinkle, sway and wave. Behaviours run
in the toy's rest pose, before parts move it.

## 7. House rules

- **Deterministic**: only `k.rand()`, `c.rand()` and the kit's noise. No `Math.random`, no dates.
- **Generic designs**: no logos, brands, league marks or named products. Landmarks may be modelled;
  modern named buildings become generic ("supertall"). Weapons are medieval or fantasy only. Anatomy
  is stylised and friendly, never gory.
- **Keep details**: seams, stitches, eyes, flames, coins and labels use `pattern: false` or `keep`.
- **Inside**: solid things get `interior: 0.08..0.15` with a sensible `core`, so Slice shows an
  inside (a cake has sponge, a planet has a core).
- **Fast**: `node tools/check-packs.mjs <pack>` must report every toy under 1.5 s at 160,000 splats.
  Avoid per-splat loops over hundreds of items; bucket or precompute.
- **Stable**: at most 15 parts; behaviour names from the table; positions finite.

## 8. Checking your work

```sh
node tools/check-packs.mjs <pack>                                   # builds, counts, times
python3 -m http.server 4173 --bind 127.0.0.1 &                      # serve the site
SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/make-thumbs.mjs <pack>
SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/contact-sheet.mjs sheet.png <pack>
SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test tests/kit.spec.mjs
```

Look at the contact sheet: every toy should be recognisable at 200 px, fill its square, and face the
viewer. `make-thumbs` renders with motion off, so behaviours show their resting pose.
