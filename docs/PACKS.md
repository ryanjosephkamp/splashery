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
  jitter: 0.04,     // colour noise (keep it low, 0.01..0.02, on smooth materials)
  even: true,       // place surface splats evenly (spheres, boxes, cylinders, cones, lathes, param)
  interior: 0.12,   // share of this shape's splats that fill its inside (for Slice)
  core: "#hex" | (c) => colour,   // colour of the inside
  part: index,      // from k.part(...), or (c) => index to split a shape between parts
  kind: "flame", params: [a, b] | (c) => [a, b],  // a behaviour (section 6)
  pattern: false,   // keep this shape's own colours under flags and patterns
  fit: false,       // leave it out of the fit (see "Hidden pieces count in the fit")
});
```

The splat budget is shared between shapes by surface area times `weight`, so the toy has an even
density. Use `share` for small details that need a fixed number of splats, and `weight` > 1 for
small shapes that would otherwise look sparse (eyes, stitches, gems).

Splats are unlit, so a material reads from colour alone. Random placement leaves thin spots where
the far side of the toy shows through as dark speckle; `even: true` closes them (it made the sports
balls read as leather and rubber instead of grain). For smooth materials also bake a little light
into the colour (a key light from above, and a sheen for gloss) instead of adding noise: see `lit()`
and `grip()` in `src/packs/balls.js`. Parts that are hidden most of the time can have a low `weight`
so the faces people see get the splats (see the storybook's pages).

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

**Action**: `action: { key: "open", label: "Open or close" }`. A tap on the toy (and the button in
the Toy tab) toggles a toggle or fires a pulse. Toys without an action hop when tapped.

A tap also knows where it landed. `action.at(point, c)` gets the tapped point in the recipe's own
coordinates (never for the Play button) and may return another control to fire, `{ key, pick }` to
fire a control and pick an item, or nothing for the usual action. `drive` sees the last tap as
`info.tap = { point, key, pick, time, n }`. The xylophone uses it: a tap on bar `i` returns
`{ key: "strike", pick: i }` and its drive moves the mallet to that bar.

**Build data**: `build(k, o)` may leave data in `k.data` for `drive`, which sees it as `info.data`
(the molecule stores which atoms and bonds it built, so its vibration fits the molecule chosen).

**Game pieces and loose pieces**: a splat with `kind: "token"` and `params: [i, 0]` belongs to token
`i` (up to 48), which `out.tokens[i] = { base, offset, quat, visible }` moves and turns. A `params`
function can pick the token per splat, so one shape can break into many pieces (the asteroid's 18
cells, the meteor's fragments, the molecule's atoms).

**Sound**: each shelf toy's tap sound is a spec in `src/toy-sounds.js` (not in the recipe), built
from the voice library in `src/voices.js` (its header lists the parameters):

```js
"wooden-elephant": [
  { voice: "wood", f: 520, decay: 1.2 },               // a knock
  { voice: "brass", at: 0.15, f: "A4", decay: 1.8 },   // then a toy trumpet
],
lamp: { on: { voice: "switch", f: 3200 }, off: { voice: "switch", f: 2500 } }, // a toggle
xylophone: { voice: "bar", notes: "C5 D5 E5 F5 G5 A5 B5 C6", step: 0.32, at: 0.3 }, // a tune
```

A tap that picked item `i` plays only note `i` of the tune. Every toy needs an entry and no two may
be the same (the unit tests check). Old shared names ("chime", "pop" and so on) still work as specs.
Check a new sound with `node tools/sound-check.mjs <id> --sheet=out.png`.

**Flag colours**: `patternProjection: "top"` makes a toy lay flag colours on from above (a flat toy:
the chess board) when a flag is picked; `patternAmount: 0.3` lays them on gently and
`patternDetail: 1` keeps each splat's own light and dark under them (the chess board's light and
dark squares stay easy to tell apart). The app switches to the toy's way when it comes out with a
flag on, and back to the usual way for the next toy unless the look was changed. Splats a colour
function returns with `keep: true`, or with `pattern: false` on their shape, never take a pattern
(the chess pieces keep their own ivory and ebony under any flag).

**Games**: a recipe's `game` (the chess set) gets a panel under This toy and a bar under the stage:
`title()`, `tags()` and `setTags(partial)` for its details, `state()` (`{ played, n, over }`),
`step(±1)` and `jump("start" | "end")` for the buttons, `load(text)` and `reset()` for PGN.

**Grab**: `grab: { radius: 0.55, max: 0.9 }` (in toy radii) makes a toy stretchy: with the Orbit
tool, a drag that starts on it pulls the grabbed part (up to `max`) and it springs back when let go.

**Scan rigs** (`src/rigs.js`): a captured toy can have the same `controls`, `action` and `drive` as
a recipe, plus `parts`, each made of soft ellipsoid regions in world coordinates:

```js
"cat-statue": {
  parts: [{ name: "head", pivot: [0.05, 0.35, 0.4], axis: [0, 1, 0],
            regions: [{ at: [0.06, 0.74, 0.5], r: [0.48, 0.5, 0.4], soft: 0.3 }] }],
  controls: [{ key: "look", label: "Look", type: "pulse", ease: 2.4 }],
  action: { key: "look", label: "Look around" },
  drive(t, c, out) { out.parts.head = { angle: 0.5 * Math.sin(Math.PI * (1 - c.look)) } },
},
```

A GPU pass tags each splat with the region it falls in when the toy loads; `soft` (a fraction of the
radius) blends the edge so the part bends into the rest of the toy. Up to 15 parts and 12 regions.
Open the app with `?rig=show` to tint each part (and the colour keys) while placing regions, or
render `tools/rig-map.mjs <dir> --rig <id>` for front, side and top views on a world grid.
`out.body` (squash, offset, rotation) moves the whole scan, for squeezes and hops. Shelf shapes
(blob, donut, knot, planet) use rigs too.

More that a rig can do (Phase E1; the full reference is at the top of `src/rigs.js` and
`src/rig-fx.js`):

- A region can take only splats of one colour: `{ at, r, color: "#d84a34", tol: 0.4 }` (the alarm
  clock's red second hand).
- `keys: [{ color: "#c9b25a", tol: 0.2 }]` marks up to two sets of splats by colour (optionally only
  within `r` of `at`), or `{ long: 0.42 }` for long thin splats (the donut's sprinkles).
- A driven part takes `{ tint: "#ffb040", glow: 0.5, bright: 0.3 }` to light up and `{ scale: 1.1 }`
  to grow about its pivot.
- `fx` lists up to four whole-body effects for things too many or too small for parts: each picks
  splats (`select`: all, a key or a part; `mask`: half-space, strips, sphere or wedge), moves them
  (push, along, scatter, hop, shiver, turn, counter-rotating bands, bend, peel, split) and colours
  them (glow, recolour, brighten, sparkle, fade, darken), shaped by a pattern (a growing shell, a
  band, a stagger per piece, a swirl wipe, a wave). `drive()` sets
  `out.fx.<name> = { move, color, phase }` each frame.
- `addon: { count, build(k) }` builds a small kit toy in world coordinates, drawn with the scan and
  sorted with it (flames, flowers, a flash, a speech bubble, cut faces). Its parts move through
  `out.addon = { parts, glow }`; `visible: 0` or `scale: 0` hides them at rest.
- `alive: (c) => c.lit > 0` keeps frames coming only while the toy moves by itself.

**Options** rebuild the toy and are saved in the scene (`o` in `build`):

- `{ key: "color", label: "Colour", type: "color", default: "#d9632b" }`
- `{ key: "style", label: "Style", type: "select", default: "a", choices: [{ id: "a", label: "A" }] }`
- `{ key: "spots", label: "Spots", type: "switch", default: true }`
- `{ key: "petals", label: "Petals", type: "slider", min: 3, max: 12, step: 1, default: 5 }`
- `{ key: "flag", label: "Flag", type: "flag", default: "us" }`: a country picker from
  `assets/flags/flags.json` (the Moon landing's flag).
- `{ key: "source", label: "Your molecule", type: "text", default: "", hidden: true }`: printable
  text of up to 24,000 characters, kept as typed. `hidden: true` leaves an option out of the Toy
  tab; use it for data the toy's own panel fills in.

**Your own input**: `input` adds a panel to the Toy tab for something the user types or opens (the
molecule's name, formula or SMILES; the protein's PDB file). `read(text, fileName)` turns it into
option values (or throws an `Error` whose message is shown), and `shown()` names what is showing.

```js
input: {
  title: "Your own molecule",
  placeholder: "aspirin, H2O, or SMILES like CC(=O)O", // leave out for a file-only panel
  button: "Show it",
  fileButton: "Open a molecule file…",
  accept: ".mol,.sdf,.xyz,.pdb",
  note: "What works, in a sentence or two.",
  async read(text, fileName) { return { molecule: "custom", source: text }; },
  shown: () => "Aspirin (C9H8O4)",
},
```

Keep what goes into options small: it is saved in the scene and in `#s=` links. A big file (a
protein) can stay in the module instead, with only its name in an option; a link to it then falls
back to the toy's default.

**Loading first**: `async prepare(options)` runs before each build (in the browser and in the Node
tools), for toys that fetch a file (the protein toy reads `assets/proteins/*.pdb`). Cache what it
loads; `build` itself stays synchronous.

**Credits**: `credits: [{ label, title, source, author, license, licenseUrl }]` adds the toy's own
sources to the About tab (the protein toy's PDB entries).

## 6. Behaviours

A behaviour moves each splat on the GPU, every frame. Set `kind` and `params: [a, b]` on a shape or
a cloud splat:

| kind      | What it does                                              | a                                     | b                                |
| --------- | --------------------------------------------------------- | ------------------------------------- | -------------------------------- |
| `orbit`   | Turns around the toy's up axis.                           | turns per second at the rim (radians) | falloff: 0 rigid, 1.5 Keplerian  |
| `beat`    | Heartbeat swell from the centre.                          | amount (0.05)                         | phase                            |
| `breathe` | Slow swell.                                               | amount                                | phase                            |
| `flame`   | Rises, shrinks and reddens in a loop.                     | height in toy radii                   | phase (random)                   |
| `rise`    | Drifts up and fades (embers, bubbles, smoke).             | height                                | phase                            |
| `fall`    | Falls and fades (rain, snow, petals).                     | distance                              | phase                            |
| `twinkle` | Brightness flicker.                                       | amount (0.3 to 1)                     | phase                            |
| `sway`    | Bends with height above a base (plants, tentacles, hair). | amount                                | base height (recipe coordinates) |
| `grow`    | Appears as `out.grow` passes a.                           | threshold 0..1                        | unused                           |
| `melt`    | Slumps and spreads to the floor as `out.energy` rises.    | how easily (0..1)                     | unused                           |
| `pulse`   | A glow (`out.glow`) runs along a path.                    | position along the path 0..1          | unused                           |
| `wave`    | Ripples up and down.                                      | amount                                | phase                            |
| `glint`   | Sparkles as the camera moves.                             | amount                                | unused                           |
| `band`    | Glows (`out.glow`) as its channel passes a.               | where along the channel (0..1)        | band width (0.08)                |
| `fade`    | Fades out (alpha) as its channel passes a.                | where along the channel               | width; negative: fades in        |

`amount` from `drive` multiplies beat, breathe, flame, rise, twinkle, sway and wave. Behaviours run
in the toy's rest pose, before parts move it.

**Channels (E3).** `out.morph = [a, b, c, d]` sets four channels (0 at rest) that drive three more
kinds. They run with motion on or off (like parts), and a shape or cloud splat picks its channel
with `channel: 0..3` (or `(c) => n`):

- **Morph**: `to: (c) => [x, y, z]` (a cloud splat: `to: [x, y, z]`) gives each splat a target in
  recipe coordinates; it moves there in a straight line as its channel goes 0 → 1 (and beyond, or
  back past its rest place for negative values). Use it for soft things that really change shape: a
  red cell curling into a sickle, a cell pinching in two, a knot contorting. Return `null` to keep a
  splat still. Targets count in the fit. Splats keep the orientation they were built with, so where
  the surface turns a lot use rounder splats (`flat` 0.4 or more). Morph combines with a part (the
  part moves the morphed splat), not with another behaviour.
- **Band**: `kind: "band", params: [at, width]` adds the glow colour where the channel passes `at`:
  a wave of light that starts at the tap (a calcium wave, a sheen wiping across). Give each splat
  its `at` from its place (distance along an arm, height).
- **Fade**: `kind: "fade", params: [at, width]` clears a splat by its alpha as the channel passes
  `at` (a negative width makes it appear instead). Unlike `visible` and `grow`, it does not shrink
  splats, so a fading layer never turns to speckle.

**Skin**: `skin: (c) => [a, b, s]` makes a splat follow tokens `a` and `b` (their `offset` only),
blended by `s`: an edge between two moving corners stays a straight edge (the hypercube's edges
follow its sixteen corners, which are tokens). Use round splats: they are not turned.

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

## 7b. Effect quality

The owner's review of Phase E1 (`docs/reviews/2026-09-24-e1/review.md`) set these rules. The short
form is in CLAUDE.md.

- **Real motion, not a warped picture.** A part moves as a solid piece. A scan rig's soft regions
  (`soft` above about 0.1) bend the picture where a part meets the rest, and at any visible size
  that reads as a stretched photo (the E1 cat, horse, elephant trunk and tomatoes). Use soft edges
  only to hide a seam of a few percent of the toy. When a scan cannot move a part cleanly:
  1. cut the part out with hard edges (`soft: 0.02`, colour-keyed regions) and keep the move small
     enough that no gap shows;
  2. hide the scan's part (`visible: 0`) and show a kit-built stand-in from an `addon` that moves;
  3. rebuild the toy as a kit toy (a recipe) where every piece is its own part; or
  4. choose an effect that moves the whole scan, or its light, instead.
- **Separate things move separately.** Tomatoes on a plate, drupelets on a berry, shells in a basket
  and chess pieces each move as their own rigid piece, with their own path. A wave or ripple pattern
  over one surface is not "the tomatoes moving".
- **Breaking is real.** Pieces come off as whole pieces, fall under gravity, bounce or roll, and
  come back (or the toy regrows them). Crumbs are small solid bits, not a blur.
- **Instruments are played.** Each note shows its cause: a string is plucked and vibrates, a key
  goes down, a drum skin moves. Match the picture to the sound's notes and timing.
- **Faces and bodies.** Things that talk move their mouths in time with the sound. Animals and
  statues move like the real thing (a horse rears from its hips, a cat turns its head on its neck),
  not by bending the whole image.
- **Real rules.** Games follow the real game (chess moves are legal, from a real game). Thrown and
  hit things move like the real thing: a gridiron football spirals about its long axis, a rugby ball
  tumbles end over end, a shuttlecock spins nose first, a flying disc spins flat and glides.
- **Real materials.** Solid things are opaque (no see-through pool balls), gloss where the real
  thing is shiny, and have no blur or speckle at phone size.
- **The bar.** The grape's peel (strips of skin curl back to show pale flesh, then close) is the
  standard: one clear, physical idea that reads at a glance.
- **Judge motion, at phone size.** Filmstrips at 220 px hide bending, smear and speckle. Render a
  clip of every changed effect with `tools/effect-clip.mjs` and look at it at full size before
  showing it; the owner reviews the clips on the private "Effect review" page before merging.
- **Draw order (E2).** Splats are depth-sorted in the pose they were built in, so:
  1. A solid body turned more than a quarter turn draws its far side over its near side (it looks
     hollow). For a full turn, build it twice, the second copy half a turn round and coloured as the
     first would be there, and show whichever copy is within a quarter turn of its built pose
     (`spinParts` in `src/packs/space.js`: Venus, Jupiter, Neptune).
  2. A layer of splats above a turning body (clouds) draws wrongly even then: paint it onto the
     body, or split the body into latitude bands that turn at their own speeds.
  3. A body split into bands that turn at different speeds: one band's far side can draw over the
     next band's near side at the edge (flaps). Set `cull: true` on the parts while they turn (it
     hides splats on the far side of the part's pivot; the Jupiter, Venus and Neptune bands) and
     show them a little bigger (`visible: 1.2`) to close the gaps the far side used to fill. Put the
     bands that stay still in a part too, so they can be culled.
  4. A fixed layer over part of a turning body (Earth's night, Mercury's heat) is covered wherever
     the body's shown copy was built nearer the camera. Build four copies a quarter turn apart and
     show one that was built on the far side of where it is shown (`spinQuarters`: side -1 when the
     layer is on the side the ground turns towards, +1 when it turns away). Things that ride over
     that layer (Earth's city lights) are built where they first come into it, so they are always
     shown at or past their built pose.
  5. Splats inside a turning body (`interior`) draw over its turned surface: keep a turning body
     hollow and put its inside in a separate part that hides while it turns (`coreBall`). Its outer
     layer shows through gaps in a thin shell, so keep it dark or a little smaller.
  6. Rings that turn for ever: make their marks repeat every eighth of a turn and turn them by the
     angle modulo that (`ringAngle`), so they never move far from their built pose.
  7. A piece that moves in front of something must be built where it will be seen in front (the
     black hole's star is built where it plunges, the solar system's Mercury in front of the Sun).
  8. Turning about the view direction keeps the order (Uranus rolls that way).
- **Fading by size makes speckle.** `visible` and `kind: "grow"` both shrink splats, so a whole
  layer shrinking away turns into dots. Clear a layer as a moving front instead (run `out.grow` back
  down: the Mars dust storm), and give glow overlays bigger, fainter splats than the surface under
  them (the quartz points, the opal).
- **Hidden pieces count in the fit.** Every splat is used to fit the toy into its frame, hidden or
  not, so build an effect's pieces small (inside the toy's resting size) and grow them with their
  part's `scale` (the Sun's flare, the star's red giant and shell, the meteor's fireball), or add
  them with `fit: false` when they must be built off to one side and stay inside the view (the
  Möbius strip's riders, built in front of and behind the band for the draw order).
- **Light that plays over a surface.** A layer of splats coloured exactly as the surface is there
  (invisible at rest) with `kind: "pulse"` flashes as `out.glow` runs over it; change the glow's
  colour each frame for rainbow fire (diamond, opal) or keep it one colour for a running light
  (emerald, the aurora's folds). The glow runs at a fixed speed (a pass every 2.9 s at normal
  speed), so it suits loops and repeats, not a front that must start at the tap: for that, use
  `kind: "grow"` and `out.grow` (the Moon's terminator, the Mars dust front, the ruby's glow).

## 8. Checking your work

```sh
node tools/check-packs.mjs <pack>                                   # builds, counts, times
python3 -m http.server 4173 --bind 127.0.0.1 &                      # serve the site
SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/make-thumbs.mjs <pack>
SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/contact-sheet.mjs sheet.png <pack>
SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/effect-strip.mjs strips <id> ...  # tap effect over time
SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/effect-clip.mjs clips <id> ...    # tap effect as a clip
SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test tests/kit.spec.mjs
```

Look at the contact sheet: every toy should be recognisable at 200 px, fill its square, and face the
viewer. `make-thumbs` renders with motion off, so behaviours show their resting pose. Check a tap
effect with `effect-strip`: it should last at least 1.5 s, move at least about a tenth of the toy
(or change its light clearly), and be obvious within the first half second.
