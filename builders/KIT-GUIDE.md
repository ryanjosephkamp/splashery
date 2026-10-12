# Kit guide: writing a toy

A short, practical guide. It summarizes and links; it doesn't repeat
[docs/PACKS.md](../docs/PACKS.md), the full reference (about 1,600 lines, with every option). Read
this first, write your toy, and look things up there when you need them. The Tinkerer's Manual
explains the same ideas with live demos: Chapter 2, [How a toy is built](../manual/toy.html), and
Chapter 3, [The splat equation language](../manual/language.html).

## The two kinds of toy

1. **A kit recipe** describes the toy with code: shapes, colors, parts, motion. The browser builds
   it from a seed, so it costs a few kilobytes and rebuilds the same everywhere. Most toys are this.
2. **An asset-backed recipe** is a kit recipe whose body comes from a prepared file (a baked model
   or a scan) plus kit-built extras (water, ink, shadows). Real Objects
   (`src/packs/real-objects.js`) does this today.

Both are `kind: "kit"` in the catalog. The sections below take them in order.

## 1. A kit recipe

### The three places a toy lives

| Where                 | What                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `src/toys.js`         | One catalog entry: `id`, `label`, `category`, `kind: "kit"`, `pack`, `tags`.                          |
| `src/packs/<pack>.js` | The recipe, in `export const RECIPES = { "<id>": { … } }`.                                            |
| the shared lists      | The tap sound (`src/toy-sounds.js`), the words (`src/toy-help.js`), the plan (`tools/toy-plan.json`). |

Add only your own entries to the shared lists (see [REPO-MAP.md](REPO-MAP.md)). New toys open behind
the labs switch: put `labs: true` on the catalog entry.

### Coordinates

**+Y is up. +Z faces the viewer, +X is to the right.** Model in any units around the origin. After
`build`, the kit centers the toy and scales it to fit a sphere of radius 0.95, and moves part pivots
with it. Rotations are in degrees in `k.add` (`rot`) and quaternions in `drive` (`quat`, built with
`quatAxisAngle(axis, radians)` from `src/kit.js`). Something that travels outside the resting shape
(a flame, an opened lid) is declared with `k.reach([x, y, z])` so the camera frames it.

### The recipe

```js
export const RECIPES = {
  "my-toy": {
    alive: false,                  // true when it moves by itself (a flame, a spinner)
    options: [ … ],                // rebuild the toy: a style, a color
    controls: [ … ],               // change it live: sliders, toggles, pulses
    action: { key, label },        // what a tap does
    drive(t, c, out, info) {},     // each frame: set parts and amounts
    build(k, o) {},                // required: describe the toy with the kit
  },
};
```

- **Shapes**: `k.sphere`, `k.ellipsoid`, `k.box`, `k.roundedBox`, `k.cylinder`, `k.cone`, `k.torus`,
  `k.disc`, `k.lathe` (a profile turned round), `k.tube` (along a curve), `k.param` (a surface from
  a function), and more. `k.add(shape, { pos, rot, weight, color, part, flat, … })` places one. The
  splat budget is shared between shapes by surface area times `weight`, so density stays even.
- **Colors**: `color` is a hex string, or a function of the sample point, `(c) => …`, where `c` has
  the position `c.p`, the normal `c.n`, surface coordinates `c.u` and `c.v`, and `c.rand()`. Splats
  are unlit, so bake the light into the colors (`shade`, `mix`, and `ramp` in `src/kit.js`). Use
  `even: true` on smooth surfaces so thin spots don't show through as speckle.
- **Cloud**: `k.cloud(opts, sample)` is for free-form splats: your `sample(rand, i, n)` function
  returns each splat's position, color, and size (smoke, fur, a nebula, a trained splat's own
  shapes). Shapes are for surfaces; a cloud is for everything else.
- **Parts** are rigid groups:
  `const lid = k.part("lid", { pivot: [0, 0.35, -0.5], axis: [1, 0, 0] })`, then `part: lid` on the
  shapes. At most 15 parts. Everything in a part moves as one solid piece.
- **Controls** (`c` in `drive`, values 0 to 1): a `slider`, a `toggle` that eases between 0 and 1
  over `ease` seconds, or a `pulse` that jumps to 1 and falls back to 0.
- **Motion**: `drive(t, c, out, info)` sets `out.parts.<name> = { angle, offset, quat, visible }`,
  `out.body` (the whole toy), `out.amount`, `out.energy`, `out.grow`, and `out.glow`. `t` is the
  toy's own clock in seconds.
- **The tap**: `action: { key, label }` ties a tap on the toy to a control. A toy without an action
  just hops.
- **Randomness**: every choice comes from the seed. Use `c.rand()` and the kit's own noise, never
  `Math.random()`, so a toy rebuilds exactly the same.

### The sound and help entries

A toy needs a tap sound (a rule in `tests/unit.spec.mjs`: every shelf toy has its own sound, and no
two are exactly alike) and its words. Examples of the shape of each:

```js
// src/toy-sounds.js, one line in your section (a synthesized voice; recorded samples also exist)
"heart-donut": { voice: "squish", pitch: 1.3, bright: 0.5, decay: 0.5 },

// src/toy-help.js: a short how-to (under about 90 characters) and an About text (60 to 140 words)
diamond: {
  howTo: "Tap it to turn it in the light and flash its fire.",
  about: "A diamond is pure carbon, squeezed into a crystal deep underground …",
},

// tools/toy-plan.json: the planned tap effect and sound; "v": "keep" when finished
"diamond": { "v": "keep", "effect": "Fire: rainbow sparkles flash off the facets as it turns.", "sound": "A real bright glassy tap …" },
```

The voices are documented at the top of `src/voices.js`. The style guide for the words is in
`docs/handoff/Help.md`, "Style guide for the text lanes". Then run `node tools/toy-plan.mjs` to
regenerate `docs/TOY-PLAN.md`.

### A real recipe: the diamond

This is `diamond` from `src/packs/gems.js`, copied unchanged. It uses three small helpers defined in
that file (`addGem`, `starGlints`, `overlay`), but the structure is the one every recipe has: an
option, a pulse control, a tap action, a `drive` that sets two parts and a glow, and a `build` that
makes the parts.

```js
  diamond: {
    alive: true,
    options: [{ key: "color", label: "Tint", type: "color", default: "#dbe9ff" }],
    controls: [{ key: "fire", label: "Fire", type: "pulse", ease: 3.8 }],
    action: { key: "fire", label: "Turn it in the light" },
    // A tap turns it one way and the other in the light, as you would a
    // ring: facet after facet flashes with fire (rainbow colors, the light
    // split by the stone) and the star glints flare.
    drive(t, c, out) {
      const p = progress(c.fire);
      const on = c.fire > 0 ? 1 : 0;
      const u = band(p, 0, 1);
      const a = on * 0.75 * Math.sin(TAU * u) * (1 - 0.4 * u);
      const flare = on * bump(p, 0.02, 0.12, 0.7, 1);
      out.parts.stone = { angle: a };
      out.parts.glints = { angle: a, visible: 1 + 1.3 * flare };
      out.glow = [...hue((t * 1.7) % 1, 0.9, 1), 2.6 * flare];
    },
    build(k, o) {
      const q = quatEuler(6, 12, 0);
      const stone = k.part("stone");
      const shape = addGem(k, brilliant(), o.color, {
        quat: q,
        fire: 0.22,
        dark: 0.12,
        contrast: 0.8,
        light: "#ffffff",
        part: stone,
      });
      starGlints(k, shape, q, 7, { part: k.part("glints") });
      // Fire: points over the crown coloured as the stone is there, which
      // flash as a running glow of changing colour passes them (drive).
      overlay(k, shape, {
        share: 0.06,
        part: stone,
        keep: (s) => s.p[1] > 0,
        col: (c) => ({
          color: gemColor(c, o.color, shape.opts),
          kind: "pulse",
          params: [c.rand(), 0],
        }),
      });
    },
  },
```

Its catalog entry, in `src/toys.js`:

```js
{
  id: "diamond",
  label: "Diamond",
  category: "gems",
  kind: "kit",
  pack: "gems",
  tags: "gem jewel brilliant cut sparkle stone mineral",
},
```

### A smaller starter you can paste

This recipe uses nothing but the kit. It was built and run in Node (with `buildRecipe`, the same
call `tools/check-packs.mjs` makes) and produced the requested splat count. The box is the toy and
the lid is a part that swings open on a tap.

```js
import { shade } from "../kit.js";

export const RECIPES = {
  "gift-box": {
    alive: false,
    options: [{ key: "color", label: "Wrapping", type: "color", default: "#d94f4f" }],
    controls: [{ key: "open", label: "Open", type: "toggle", default: 0, ease: 1.1 }],
    action: { key: "open", label: "Open or close" },
    drive(t, c, out) {
      out.parts.lid = { angle: -1.9 * c.open }; // about the part's axis, in radians
    },
    build(k, o) {
      const lid = k.part("lid", { pivot: [0, 0.35, -0.5], axis: [1, 0, 0] });
      k.add(k.box(1, 0.7, 1), {
        weight: 6,
        color: (c) => shade(o.color, 0.9 + 0.2 * c.rand()),
      });
      k.add(k.box(1.1, 0.2, 1.1), { pos: [0, 0.45, 0], weight: 3, part: lid, color: o.color });
    },
  },
};
```

Check it: `node tools/check-packs.mjs <pack>` builds every toy in the pack and prints each splat
count and build time. Keep a build under 1.5 seconds.

## 2. An asset-backed recipe

Real Objects makes everyday things from real 3D models (CC0 and CC BY). The pipeline:

1. **Bake** the model into a compact file, `assets/toys/<id>/<id>.splats`, with
   `node tools/ro-bake.mjs <id>`. Each splat is tagged with the part it moves with, cut from the
   model with hard edges (by the mesh's separate pieces, its materials, or a plane). The file format
   is described at the top of `tools/ro-bake.mjs`.
2. **Load** it in the recipe's `prepare()` hook, which runs once before `build`:

   ```js
   async prepare() {
     await loadScan("water-bottle");   // fetches assets/toys/water-bottle/water-bottle.splats
   },
   ```

3. **Add** it as a cloud in `build`, one kit part per piece that moves:

   ```js
   build(k) {
     const scan = SCANS.get("water-bottle");
     const bottle = k.part("bottle", { pivot: WB.pivot, axis: [0, 0, 1] });
     const cap = k.part("cap", { pivot: [0, 0.6, 0], axis: [0, 1, 0] });
     addScan(k, scan, { share: 0.8, parts: [bottle, cap] });
     // … then kit-built extras: the water, the ink, a shadow
   },
   ```

4. **Credit** it: a `credits: […]` array on the recipe (title, source page, author, license), and
   the entries in `CREDITS.md` and `tools/models.json`. See [CREDITS-GUIDE.md](CREDITS-GUIDE.md).

`addScan` (in `src/packs/real-objects.js`) takes `share` (the part of the splat budget the scan
gets), `parts` (the kit part for each part number in the file), and options for color and sharpness.
The toy still moves as solid kit parts, and the rest of the recipe (controls, `drive`, tap, sound,
help) is exactly as in section 1.

Photo-scanned splat files (`.sog`) load a different way: a `kind: "captured"` catalog entry points
at the file (`url`, and a lighter `urlWeak` for phones) and carries its `credit`. The Bee in
`src/toys.js` is an example. Those toys get moving parts through `src/rigs.js`.

### Baked splats: coming with the engine PR

The owner's Baked engine lane is building a compact baked-splat format (rotation, three sizes,
color, opacity, part) that loads through the Kit at the device's budget, with parts on the same
one-entity path as above. It comes with a converter (`tools/port-convert.mjs`) and a checker
(`tools/port-check.mjs`). Until that PR merges, don't invent a format: bake with the Real Objects
tool, or hand back your splats as a Workshop package ([TOY-PACKAGE.md](TOY-PACKAGE.md)). The
Operator will update this section when the engine PR lands.

## The effect quality bar

Every new or changed effect is judged by these rules (the full list, with examples, is in
[docs/PACKS.md](../docs/PACKS.md), section 7b, and in [CLAUDE.md](../CLAUDE.md)):

- **Real motion, not a warped picture.** Parts move as solid pieces. Never bend a scan with soft
  regions. If a scan can't move a part cleanly, cut the part out with hard edges, swap in a
  kit-built part, or choose a different effect.
- **Separate things move separately** (each tomato, each chess piece).
- **Break-apart effects break into real pieces** that fall off and come back.
- **Instruments are played:** the strings, keys, or skins visibly move with each note.
- **Things that talk move their mouths.** Animals and statues move like the real thing.
- **Games follow real rules.** Balls and discs move like the real thing.
- **Materials look like the real material:** no see-through solids, no blur, no speckle.
- **The grape is the bar:** a clear, physical effect you read at a glance.
- **Judge effects as motion at phone size.** Render a clip of each changed effect (see
  [SETUP.md](SETUP.md), "An effect clip") and watch it. A filmstrip hides bending and smear.

## Where to read next

- [docs/PACKS.md](../docs/PACKS.md): every shape, option, control, behavior, and house rule.
  Sections 1 to 5 are the core; 7b is effect quality; 8 is checking your work; 9 is models to
  splats.
- [docs/SCENE-SCHEMA.md](../docs/SCENE-SCHEMA.md): the scene format (the file and the `#s=` link).
- The manual: [Chapter 2](../manual/toy.html) and [Chapter 3](../manual/language.html).
- A pack to read: `src/packs/shapes-torus.js` (one toy, heavily commented) and `src/packs/gems.js`.
