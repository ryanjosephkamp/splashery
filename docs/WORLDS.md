# Splashery Worlds

A world is a small place made entirely of Gaussian splats that you walk around in as a character, on
a phone or a computer. The ground, the water, the sky, the trees, the signs and the character are
all splats, built on the device from recipes and a seed. Only the menus and text (the start screen,
the cards, the list of places) are page text, and collision uses invisible simple shapes.

This page is for anyone building a world: the world file, the modules, how to add a prop or a
landmark, and the splat budgets. Worlds sit behind the labs switch for now:
`worlds/?labs=1&world=<id>` opens `worlds/<id>/world.json`, and the Test island
(`worlds/test-island/`) is the sandbox that shows every feature.

## Contents

1. [How a world works](#how-a-world-works)
2. [The world file](#the-world-file)
3. [Props](#props)
4. [Landmarks](#landmarks)
5. [The modules](#the-modules)
6. [Budgets and level of detail](#budgets-and-level-of-detail)
7. [Controls](#controls)
8. [Testing a world](#testing-a-world)
9. [Rules that still apply](#rules-that-still-apply)

## How a world works

1. The page (`worlds/index.html`, `src/worlds/main.js`) reads the world file and shows the start
   screen (title, welcome text, Enter) and the plain list of places straight away, before anything
   3D. The list works even where the browser can't draw the world.
2. The world is built on the device (`src/worlds/world.js`): the sky, the open sea, every prop (toy
   recipes baked into still splats), the signs and the character. The ground and the water are cut
   into square chunks, each built when the level-of-detail planner first needs it.
3. Behind the start screen the camera circles the whole world from the air. Enter puts the camera
   behind the character.
4. Every frame: the controls give a direction; collision moves the character (sliding along props,
   stopping at water and steep ground); the gait turns its joints; the camera follows; the planner
   picks each chunk's and prop's level; and walking into a landmark's circle opens its card.

Coordinates are meters: x east, y up, z south. Headings (`facing`, `turn`) are degrees about the
vertical, 0 facing south (+z), 90 facing east (+x), 180 north, 270 west.

## The world file

`worlds/<id>/world.json`. Every field is optional except where noted; `src/worlds/world-file.js`
(`normalizeWorld`) fills in the defaults, clamps numbers to safe ranges and ignores what it doesn't
know, so a typo can't break the page.

```json
{
  "version": 1,
  "id": "test-island",
  "title": "Test island",
  "welcome": "A small island made entirely of splats…",
  "enter": "Enter",
  "seed": 20260929,
  "colors": { "grass": "#6fa84a", "accent": "#1f6f8b" },
  "terrain": { "shape": "island", "size": 128, "radius": [34, 28], "height": 3.5, "hills": [] },
  "water": true,
  "sky": { "clouds": 0.5 },
  "spawn": { "at": [-4, 14], "facing": 180 },
  "character": { "shirt": "#e0533d", "trousers": "#35507a" },
  "props": [{ "id": "palm-1", "type": "palm", "at": [-26, 2], "size": 6.2, "turn": 20 }],
  "scatter": [{ "type": "bush", "count": 14, "on": "grass", "size": [0.8, 1.4] }],
  "landmarks": [{ "id": "welcome", "title": "Welcome", "words": "…", "at": [-2.5, 9] }]
}
```

### Top level

| Field       | Meaning                                                                       | Default        |
| ----------- | ----------------------------------------------------------------------------- | -------------- |
| `title`     | The world's name: the start screen, the bar at the top and the page title     | "A world"      |
| `welcome`   | The start screen's welcome text                                               | ""             |
| `enter`     | The Enter button's words                                                      | "Enter"        |
| `seed`      | Every random choice (the coast, the grass, scatter) comes from it             | 1              |
| `colors`    | Named colors as `#rrggbb` (below)                                             | a sunny island |
| `terrain`   | The ground (below)                                                            | an island      |
| `water`     | `false` for a world without water                                             | `true`         |
| `sky`       | `{ "clouds": 0..1 }`, how cloudy                                              | `0.5`          |
| `spawn`     | `{ "at": [x, z], "facing": degrees }`, where the character starts             | `[0, 0]`, 0    |
| `character` | The character's colors: `shirt`, `trousers`, `skin`, `hair`, `shoes`          | red shirt      |
| `props`     | Things placed one by one ([Props](#props))                                    | none           |
| `scatter`   | Many copies of a prop spread over a kind of ground ([Props](#props))          | none           |
| `landmarks` | Places with a sign and a card ([Landmarks](#landmarks))                       | none           |
| `credit`    | A line of credit for the world (shown nowhere yet; keep it for the lane's PR) | ""             |

### Colors

`sky`, `horizon` (the haze at the horizon and the page behind the canvas), `sand`, `wetSand`,
`seabed`, `grass`, `grassLight`, `grassDark`, `grassDry`, `rock`, `rockDark`, `snow`, `water`
(deep), `shallow`, `foam`, `cloud` and `accent` (the signs' boards). Any you leave out keep the
defaults in `DEFAULT_COLORS`.

### Terrain

The ground is a height field, the one truth for where the ground is: the splats are laid on it, and
collision and the camera read it.

| Field         | Meaning                                                                           | Default     |
| ------------- | --------------------------------------------------------------------------------- | ----------- |
| `shape`       | `"island"` (land in the sea) or `"flat"` (level ground at `base`, plus hills)     | `"island"`  |
| `size`        | The side of the square the world covers, in meters (chunks cover it; sea beyond)  | 160         |
| `chunk`       | The side of a chunk, in meters                                                    | 8           |
| `center`      | The island's middle, `[x, z]`                                                     | `[0, 0]`    |
| `radius`      | The island's radius to the shore: one number, or `[east-west, north-south]`       | 36          |
| `height`      | How high the inland rises above the beach                                         | 8           |
| `roughness`   | 0 smooth to 1 bumpy                                                               | 0.5         |
| `coast`       | How much the coastline wanders, 0 to 1                                            | 0.35        |
| `seaDepth`    | How deep the sea gets                                                             | 6           |
| `beachHeight` | The beach's height above the water                                                | 0.7         |
| `beach`       | Sand up to this height above the water; grass above                               | 1.3         |
| `waterLevel`  | The water's height                                                                | 0           |
| `clearDepth`  | The sea bed is drawn down to this depth; deeper water is opaque                   | 2.6         |
| `rockSlope`   | Ground steeper than this (rise over run) is rock                                  | 0.8         |
| `snowLine`    | Snow above this height                                                            | 1000 (none) |
| `hills`       | `[{ "at": [x, z], "radius": r, "height": h }]`, round hills added on the land     | none        |
| `flatten`     | `[{ "at": [x, z], "radius": r }]`, level circles (every landmark gets one of 3 m) | none        |
| `base`        | The ground's height for `"flat"` worlds                                           | 1           |

What covers the ground follows from height and slope: sand near the water (darker where wet), grass
above the beach, rock on slopes steeper than `rockSlope`, snow above `snowLine`, and a pale sea bed
under shallow water. A small, steep hill (radius 4 to 5 m, height 4 to 5 m) makes a rocky knoll the
character can't climb.

## Props

A prop is anything that stands in the world. Most are toys from the shelf: `src/worlds/props.js`
builds the toy's recipe with the kit, puts it in its rest pose (parts and loose pieces where a toy
at rest shows them), leaves out its looping particles (flames, falling snow) and its ground base
(the grass mound under a toy tree, the patch of sea round the lighthouse), and scales it to stand 1
m tall with its foot at the origin. Copies of the same type, seed and options share their splats, so
twenty bushes cost one bake.

| Field      | Meaning                                                                                    |
| ---------- | ------------------------------------------------------------------------------------------ |
| `id`       | A name, unique in the world (colliders and tests use it)                                   |
| `type`     | A key of `PROP_TYPES` (below). Required                                                    |
| `at`       | `[x, z]`: it stands on the ground there                                                    |
| `size`     | Its height in meters                                                                       |
| `turn`     | Its heading in degrees                                                                     |
| `tilt`     | A lean in degrees (−45 to 45), for a fallen log or a leaning post                          |
| `lift`     | Meters above (or below, negative) the ground                                               |
| `y`        | An exact height instead (the lighthouse stands on its rocks in the sea at `y` −0.25)       |
| `seed`     | Another seed gives another look of the same toy                                            |
| `options`  | The toy's options, as its recipe names them (the oak's `season`, say)                      |
| `detail`   | More (up to 3) or fewer (down to 0.25) splats than the type's own count: 1.8 for a big one |
| `collider` | `false` for none, or a shape (below); left out, the type's default                         |

### Prop types

`palm`, `pine`, `oak`, `pebbles`, `mushroom`, `tulip`, `sunflower` and `lighthouse` are toy recipes;
`boulder` and `bush` are world props built in `props.js`. To add a type, add a line to `PROP_TYPES`:

```js
cactus: { pack: "nature", recipe: "cactus", count: 20000, collider: "auto" },
```

`count` is the near level's splats at the high tier (the tier's `props` factor scales it).
`collider: "auto"` puts a capsule around the lowest quarter of the prop (a tree's trunk, a rock's
body), which suits most things; `false` means walk-through (flowers). Then look at it: open the Test
island with the new prop placed near the spawn point and walk round it. A recipe whose rest pose
shows something odd in a world (a toy's own floor that the "ground base" rule doesn't catch) gets
`base: false` or a world-only builder instead. A world-only prop is a `build(count, seed, options)`
function that returns `{ buf, foot }` (a `SplatBuffer` and the point it stands on), like
`buildBoulder`.

### Colliders

Collision shapes are upright and invisible. In a prop's `collider`, sizes are in units of the prop's
`size` (so they scale with it):

- `{ "shape": "capsule", "radius": 0.06, "height": 1 }`: an upright cylinder (a trunk, a post).
- `{ "shape": "sphere", "radius": 0.5 }`: a ball resting on the ground (only as wide as it is at the
  character's height).
- `{ "shape": "box", "size": [w, d], "height": 1 }`: a box turned with the prop (a wall, a table).
- `"offset": [x, z]` moves any of them from the prop's foot.

### Scatter

`{ "type", "count", "on", "size": [min, max], "spacing", "within": { "at", "radius" }, "seed", "options" }`
spreads `count` copies over one kind of ground (`"grass"`, `"sand"`, `"rock"`, `"snow"` or `"any"`),
at random sizes, at least `spacing` meters apart, clear of landmarks and the spawn point, optionally
only within a circle. Scattered props use three seeds, so they don't all look alike. They get the
type's default collider.

## Landmarks

A landmark is a place with a sign. Walking into its circle opens its card (page text); walking away
closes it again; tapping or clicking the sign opens it from afar. Every landmark is also in the
plain list (the Places button, and "See the places as a list" on the start screen), with a "Go
there" button.

| Field     | Meaning                                                                                     |
| --------- | ------------------------------------------------------------------------------------------- |
| `id`      | A name, unique in the world                                                                 |
| `title`   | The card's and the list's heading                                                           |
| `words`   | The card's text                                                                             |
| `label`   | What the sign's board says: up to 14 letters, digits and `.,'!?-` (default: the title)      |
| `at`      | `[x, z]`: where the sign stands (the ground there is leveled, 3 m round)                    |
| `facing`  | The heading the board faces, toward where people come from                                  |
| `radius`  | How near opens the card, in meters (default 3.2)                                            |
| `picture` | `{ "src", "alt" }`: an optional picture on the card (relative to `worlds/`, or a full link) |
| `link`    | `{ "href", "label" }`: an optional link on the card                                         |
| `sign`    | `false` for a landmark without a sign (the card still opens in its circle)                  |

Keep landmarks at least 8 m apart, on land, with nothing in their circle, and point the sign toward
the path people take. The board is painted in the `accent` color with pale letters.

## The modules

Everything is in `src/worlds/`. PlayCanvas is used only through `src/pc.js`, and splats are built
with the kit (`src/kit.js`). The pure modules have no engine imports, so tests and tools use them in
Node.

| Module          | What it does                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| `main.js`       | The page: labs check, start screen, list, cards, the frame loop, test hooks (`window.__world`)          |
| `world-file.js` | Reads a world file and fills in every default (pure)                                                    |
| `world.js`      | A running world: builds everything, moves the character, plans the levels, finds landmarks              |
| `terrain.js`    | The height field, what covers the ground, and each chunk's ground splats at each level (pure)           |
| `water.js`      | Water chunks, the open sea around the world and the sky dome (pure)                                     |
| `props.js`      | Prop types, baking toy recipes into still props, thinner far copies, the boulder, bush and signs (pure) |
| `character.js`  | The character's rigid parts and joints, and its gait: idle, walk and run angles (pure)                  |
| `physics.js`    | Collision: the ground, water, steep slopes, and upright boxes, spheres and capsules (pure)              |
| `camera.js`     | The follow camera: orbit, smoothing, never in the ground, sway when running (pure)                      |
| `lod.js`        | The level-of-detail planner (pure)                                                                      |
| `tiers.js`      | Device tiers and their budgets (pure)                                                                   |
| `controls.js`   | Keys, mouse and touch: the thumb stick, drag to look, pinch or wheel to zoom, tap to pick               |
| `render.js`     | The PlayCanvas side: the device, the camera, splat containers and entities                              |

### The character

Eleven joints (`JOINTS` in `character.js`): the hips, the torso, the head, two upper arms, two
forearms (elbows), two thighs and two shins (knees). The head has a face (eyes, brows, nose, mouth,
ears) and hair; the clothes have a collar, short sleeves, a belt and shoes. Each part is a kit-built
splat cloud around its own pivot, drawn by its own entity, and a joint only turns it: legs, arms and
head swing as solid pieces, and nothing bends or stretches. The gait's phase moves with the distance
walked, so the feet keep pace with the ground at any speed. Walking is 1.9 m/s and running (Shift,
or the stick pushed all the way) 4.6 m/s.

### The camera

It orbits the character at about 5 m, follows it smoothly, and shortens its distance when a hill
behind the character would hide it, so it never goes into the ground or the water. While running it
sways a little with the stride, unless the browser asks for reduced motion (then the start screen's
aerial view doesn't turn either).

## Budgets and level of detail

PlayCanvas 2.22.3 has its own level of detail and splat budget (`scene.gsplat.splatBudget`,
`lodRangeMin`/`lodRangeMax`), but they work on streamed octree files (SOG with LOD levels). A world
is built on the device from recipes, so it keeps its own levels and uses the engine's unified splat
mode (on by default) to draw and sort every chunk, prop and body part together.

- Ground and water chunks have five levels. Level 0 (near) has about 110 splats per square meter
  plus 110 grass blades (both times the tier's factors); each level after has about a quarter as
  many, larger splats. Chunks are 8 m square, so the rings of detail are fine-grained.
- Props and signs have three levels: all their splats, one in 4 and one in 16 (each larger).
- The sky, the open sea and the character are always drawn in full.
- The planner (`lod.js`) gives each chunk and prop a level from its distance to the point between
  the camera and the character (big props keep detail farther away) and adds up the splats. Over
  budget, it pulls every distance in until the plan fits, and as a last step leaves out the farthest
  props. It plans again when the camera moves 2.5 m or every 2 seconds, and a chunk keeps its old
  level on show until its new one is built.

The budget is the most splats drawn at once, set per device tier (`WORLD_BUDGETS` in `tiers.js`).
The tier comes from the same rules as the toy player's (`?profile=low|mid|high|max` forces one):

| Tier   | Budget    | Ground density | Near / middle distance | Prop detail | Grass | Pixel ratio |
| ------ | --------- | -------------- | ---------------------- | ----------- | ----- | ----------- |
| `low`  | 300,000   | 0.5            | 7 m / 30 m             | 0.6         | 0.4   | up to 1.5   |
| `mid`  | 550,000   | 0.75           | 9 m / 38 m             | 0.9         | 0.7   | up to 2     |
| `high` | 900,000   | 1              | 12 m / 50 m            | 1.2         | 1     | up to 3     |
| `max`  | 1,400,000 | 1.3            | 15 m / 64 m            | 1.5         | 1.3   | up to 3     |

### Render settings

- **Pixel ratio.** The canvas draws at the device's pixel ratio, up to the tier's cap (the table).
  Lane Sharpness measured (#107) that a 3x phone drawn at 3x has narrower edges and less speckle
  than at 2x, at about twice the cost, so only the high and max tiers go to 3. `?dpr=1.5` (or any
  number) overrides it.
- **Kernel.** Every tier draws with lane Lab's sharp kernel (`src/kernels.js`: a flatter top and a
  steeper edge than the Gaussian, blending back to the Gaussian for tiny splats). On the Test island
  it halves the measured speckle at no cost in splats. `?kernel=gaussian` shows the engine's own.
- **How the ground is built for sharpness.** An even, flat carpet: one splat per cell of a jittered
  grid, all nearly the same size and nearly round, lying on the ground and fully opaque, colored by
  smooth functions with almost no per-splat noise. Grass blades take the ground's own color, a
  little lighter or darker, so they read as texture rather than flecks. Water splats are round and
  even too, and the waves bring the moving light.
- **Measuring grain.** `node tools/world-grain.mjs <out-dir> --label=<name>` renders four fixed
  views (the ground, the shore, the props, the aerial view) at 390×844 and 2x and prints each one's
  speckle, the way lanes Lab and Sharpness measure toys.

The ground is at level 0 within the near distance, 1 within 2.2 times it, 2 within the middle
distance, 3 within 2.2 times that, and 4 beyond. Props (whose detail matters more) are at level 0
within 0.6 times the middle distance, 1 within 1.5 times it, and 2 beyond; a prop taller than 4 m
counts its distances in units of its height over 4.

Measured on the Test island (the test "each tier stays within its splat budget" prints them): see
the Worlds lane's PR for the numbers. Our test browser draws in software, so frame times there are
only relative; the owner's phone is the real test.

A world's props all count: a world with many big props should give them lower `detail`, use scatter
for small things, and check `window.__world.stats()` (below) at its busiest places.

## Controls

- **Phone:** the thumb stick (bottom left, shown after the first touch) walks, and pushed all the
  way runs; a drag anywhere else looks around; two fingers pinch to zoom; a tap on a sign opens its
  card.
- **Computer:** W, A, S and D or the arrow keys walk, Shift runs; drag with the mouse to look; the
  wheel zooms; a click on a sign opens its card.
- **Page text:** Places opens the list (a dialog: Escape closes it, and keys don't move the
  character while it is open); "?" shows the controls again; Escape closes a card.

## Testing a world

- `?clock=manual` stops the world's clock: time moves only when a tool steps it, so tests and clips
  run at real speed however slow the renderer is.
- `window.__world` (once `body[data-ready="true"]`): `enter()`, `stats()` (splats drawn, by kind and
  level, and the budget), `char()` (position, facing, speed, what blocked it), `ground(x, z)`,
  `place(x, z, facing)`, `step(input, seconds)` (moves the world by hand: `input` is
  `{ x, y, run }`, y forward), `tick(dt, input)` (one frame with the manual clock) and `card()` (the
  open card's landmark id).
- `node tools/world-clip.mjs <out-dir> walk landmark touch list` records the review clips at 390×844
  (the scenes are scripted at the top of the tool; add your own).
- `tests/wd.spec.mjs` has the engine's tests. A world lane adds its own in
  `tests/<prefix>.spec.mjs`.

## Rules that still apply

The ground rules and the effect quality rules in [CLAUDE.md](../CLAUDE.md) hold for worlds too:
everything seen is splats (tell the Operator, with clips, before thinking of any mesh), assets are
CC0, CC BY or public domain and credited, no logos or brand names, and new public text is in
American English. A world is a folder under `worlds/`; it doesn't change the toy box.
