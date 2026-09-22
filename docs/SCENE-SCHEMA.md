# Splashery scene files (schema version 2)

A Splashery scene is one JSON document. **Save JSON** downloads it, **Load JSON** (or dropping the
file on the page) restores it, and share links carry the same document compressed into the URL hash.
Validation lives in `src/state.js` (`normalizeScene`): unknown keys are dropped, numbers are clamped
to the ranges below, and anything missing falls back to its default, so hand-edited files are safe
to load. Files from Splashery v1 (the planet painter, `version: 1`) are refused with a message
pointing at the v1 branch.

## Shape

```json
{
  "app": "splashery",
  "version": 2,
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
  "autoplay": { "turntable": true, "effect": "none" }
}
```

## Fields

| Field       | Type   | Meaning                                                                                                     |
| ----------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| `app`       | string | Always `"splashery"`.                                                                                       |
| `version`   | number | Schema version, `2`.                                                                                        |
| `createdAt` | string | ISO time the file was saved (informational).                                                                |
| `seed`      | int    | 0 to 16,777,215. Seeds every per-splat random choice in the effects, idle pokes and paint splashes.         |
| `toy`       | object | Which toy; see below.                                                                                       |
| `look`      | object | Background, theme, accent colour, splat size and exposure.                                                  |
| `effects`   | object | Every effect's switch and slider values, whether or not it is on.                                           |
| `paint`     | object | `stamps`: the paint, as a list of brush stamps replayed in order (at most 4,000).                           |
| `camera`    | object | Orbit pose. `distance` is in multiples of the toy's radius, so it fits any toy.                             |
| `autoplay`  | object | `turntable` (slow spin when idle) and `effect`: `none`, `breeze`, `pokes`, `twist` or `dissolve` when idle. |

### `toy`

One of three kinds:

- `{ "kind": "builtin", "id": "cactus" }`: a toy from the shelf (`cactus`, `strawberry`, `cookie`,
  `bee`, `blob`, `donut`, `knot`, `planet`). The generated shelf toys use the device's default splat
  count.
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

### `paint.stamps`

Each stamp is `[x, y, z, radius, "#rrggbb", opacity]` in the toy's own coordinates. Replaying the
stamps in order on the GPU rebuilds the paint, including the droplets and drips a splash leaves.

## Links

Share links are `https://ryanjosephkamp.github.io/splashery/#s=<payload>`, where the payload is `d.`
followed by the base64url of the deflate-raw-compressed JSON (or `j.` and plain base64url JSON in
browsers without `CompressionStream`). If a scene is too long for a link (about 12 KB), the paint
and then the clay edits are left out and the app says so. The embed player takes the same payload:
`embed/#s=<payload>`.
