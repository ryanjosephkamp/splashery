# Splashery scene files (schema version 3)

A Splashery scene is one JSON document. **Save JSON** downloads it, **Load JSON** (or dropping the
file on the page) restores it, and share links carry the same document compressed into the URL hash.
Validation lives in `src/state.js` (`normalizeScene`): unknown keys are dropped, numbers are clamped
to the ranges below, and anything missing falls back to its default, so hand-edited files are safe
to load. Files from Splashery v1 (the planet painter, `version: 1`) are refused with a message
pointing at the v1 branch.

Version 3 added `pattern`, `motion`, and `options` and `clay` on shelf toys. Version 2 files and
links load unchanged: they are version 3 scenes with no pattern, the default motion, and no options.
Saving always writes version 3.

## Shape

```json
{
  "app": "splashery",
  "version": 3,
  "createdAt": "2026-09-22T19:49:30.000Z",
  "seed": 123456,
  "toy": { "kind": "builtin", "id": "cactus" },
  "look": {
    "background": "page",
    "theme": "auto",
    "accent": "auto",
    "splatScale": 1,
    "exposure": 1
  },
  "effects": {
    "poke": { "on": false, "strength": 0.6, "wobble": 0.5 },
    "wind": { "on": true, "strength": 0.55, "direction": 0 },
    "dissolve": { "on": false, "spread": 0.55, "speed": 0.5 },
    "drop": { "on": false, "bounce": 0.45, "scatter": 0.5 },
    "magnet": { "on": false, "strength": 0.7, "radius": 0.45 },
    "twist": { "on": false, "amount": 0.5, "wobble": 0.3, "axis": "y" },
    "slice": { "on": false, "position": 0, "sweep": 0.35, "axis": "x" },
    "paint": { "on": false, "size": 0.5, "splash": 0.5, "color": "#e63b2e" }
  },
  "paint": { "stamps": [[0.12, 0.3, 0.55, 0.06, "#e63b2e", 1]] },
  "camera": { "yaw": 0.55, "pitch": 0.32, "roll": 0, "distance": 4.5 },
  "autoplay": { "turntable": true, "effect": "none" },
  "pattern": {
    "id": "flag",
    "flag": "fr",
    "projection": "wrap",
    "repeats": 2,
    "colors": ["#ffffff", "#e63b2e", "#0b4f9c"],
    "scale": 0.5,
    "amount": 1,
    "detail": 0.6
  },
  "motion": { "alive": true, "move": "bounce", "speed": 0.5, "controls": { "open": 1 } }
}
```

## Fields

| Field       | Type   | Meaning                                                                                                     |
| ----------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| `app`       | string | Always `"splashery"`.                                                                                       |
| `version`   | number | Schema version, `3` (files with `2` load too).                                                              |
| `createdAt` | string | ISO time the file was saved (informational).                                                                |
| `seed`      | int    | 0 to 16,777,215. Seeds every per-splat random choice in the effects, idle pokes and paint splashes.         |
| `toy`       | object | Which toy; see below.                                                                                       |
| `look`      | object | Background, theme, accent colour, splat size and exposure.                                                  |
| `effects`   | object | Every effect's switch and slider values, whether or not it is on.                                           |
| `paint`     | object | `stamps`: the paint, as a list of brush stamps replayed in order (at most 4,000).                           |
| `camera`    | object | Orbit pose. `distance` is in multiples of the toy's radius, so it fits any toy.                             |
| `autoplay`  | object | `turntable` (slow spin when idle) and `effect`: `none`, `breeze`, `pokes`, `twist` or `dissolve` when idle. |
| `pattern`   | object | A design wrapped around the toy (version 3); see below.                                                     |
| `motion`    | object | How the toy moves (version 3); see below.                                                                   |

### `toy`

One of three kinds:

- `{ "kind": "builtin", "id": "cactus" }`: a toy from the shelf (see `src/toys.js` for every id).
  The generated shelf toys use the device's default splat count. Toys built from a pack recipe can
  also carry:
  - `options`: the recipe's choices, such as `{ "style": "love", "color": "#c42f3c" }`. At most 16
    keys; values are numbers, `true`/`false`, `#rrggbb` colours or short lower-case words. The
    recipe checks their meaning when it builds, so unknown options are ignored.
  - `clay`: clay edits, as for generated toys below.

  Both are left out when empty.

- `{ "kind": "procedural", "id": null, "generator": {…}, "clay": […] }`: a generated toy.
  - `generator.shape`: `sphere`, `blob`, `torus`, `capsule` or `knot`.
  - `generator.palette`: `candy`, `ocean`, `meadow`, `sunset`, `ink`, `neon`, `planet` or
    `frosting`.
  - `generator.seed`: 0 to 4,294,967,295.
  - `generator.count`: splats, 2,000 to 300,000 (clamped to 120,000 on weak devices).
  - `generator.sizeJitter`, `generator.roughness`, `generator.colorNoise`: 0 to 1.
  - `clay`: clay edits replayed in order after generation, each `["a" | "e", x, y, z, radius]` in
    the toy's own coordinates (`a` adds a lump, `e` erases everything inside the sphere). At most
    2,000.
- `{ "kind": "file", "file": { "name": "my.ply", "bytes": 123456 }, "flip": true }`: a splat file
  from the visitor's computer. Files are never uploaded, so a scene or link with a `file` toy
  carries the settings only: whoever opens it is asked to drop the same file in. `flip` turns the
  file upside down (most PLY captures need it).

### `look`

| Key          | Values                                                                             |
| ------------ | ---------------------------------------------------------------------------------- |
| `background` | `"page"` (the theme's page colour), `"transparent"`, or a colour like `"#f4efe6"`. |
| `theme`      | `"auto"` (follow the page or system), `"light"` or `"dark"`.                       |
| `accent`     | `"auto"` (the theme's accent) or a colour. Used by the slice edge and magnet glow. |
| `splatScale` | 0.3 to 2.5, multiplies every splat's size.                                         |
| `exposure`   | 0.3 to 2.5, multiplies colour.                                                     |

### `effects`

All sliders are 0 to 1 unless noted. Tools (`poke`, `magnet`, `paint`) act where the pointer touches
the toy; their `on` is always `false` in a file. Ambient effects run by themselves while `on`.
`drop` and `dissolve` never run together.

| Effect     | Keys                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------- |
| `poke`     | `strength`, `wobble` (how long the ripples ring)                                         |
| `wind`     | `strength`, `direction` (0 to 360 degrees; 0 blows towards the right edge of the screen) |
| `dissolve` | `spread`, `speed`                                                                        |
| `drop`     | `bounce`, `scatter`                                                                      |
| `magnet`   | `strength` (-1 to 1: negative scatters, positive attracts), `radius`                     |
| `twist`    | `amount` (-1 to 1), `wobble` (0 holds the twist still), `axis` (`x`, `y` or `z`)         |
| `slice`    | `position` (-1 to 1), `sweep` (0 holds the plane still), `axis` (`x`, `y` or `z`)        |
| `paint`    | `size`, `splash`, `color` (the brush)                                                    |

### `pattern`

| Key          | Values                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------- |
| `id`         | `none`, `flag`, `stripes`, `bands`, `dots`, `checks`, `stars`, `hearts`, `zigzag`, `gradient`, `rainbow` or `marble`. |
| `flag`       | For `flag`: a country code from `assets/flags/flags.json` (ISO 3166 alpha-2, plus `xk` for Kosovo).                   |
| `projection` | `wrap` (around the toy's up axis), `front` (straight through from the front) or `globe` (latitude and longitude).     |
| `repeats`    | 1 to 4: how many times the design goes around (not used by `front`).                                                  |
| `colors`     | Three colours for the patterns that use them.                                                                         |
| `scale`      | 0 to 1: how big the stripes, dots or checks are.                                                                      |
| `amount`     | 0 to 1: how strongly the pattern covers the toy's own colours.                                                        |
| `detail`     | 0 to 1: how much of the toy's own light and shade shows through.                                                      |

Seams, stitching, flames and similar details that a recipe marks keep their own colours.

### `motion`

| Key        | Values                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------- |
| `alive`    | `true` lets a pack toy's own behaviours run (flames flicker, hearts beat).                              |
| `move`     | `still`, `bounce`, `spin`, `wobble` or `float`: how the whole toy moves (any toy).                      |
| `speed`    | 0 to 1.                                                                                                 |
| `controls` | A pack toy's control values, 0 to 1 (for example `open` for the treasure chest's lid). At most 16 keys. |

Under a system setting for reduced motion, nothing moves by itself until the visitor turns motion
on.

### `paint.stamps`

Each stamp is `[x, y, z, radius, "#rrggbb", opacity]` in the toy's own coordinates. Replaying the
stamps in order on the GPU rebuilds the paint, including the droplets and drips a splash leaves.

## Links

Share links are `https://ryanjosephkamp.github.io/splashery/#s=<payload>`, where the payload is `d.`
followed by the base64url of the deflate-raw-compressed JSON (or `j.` and plain base64url JSON in
browsers without `CompressionStream`). If a scene is too long for a link (about 12 KB), the paint
and then the clay edits are left out and the app says so. The embed player takes the same payload:
`embed/#s=<payload>`.
