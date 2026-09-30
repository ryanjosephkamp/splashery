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
7. [Rendering](#rendering)
8. [Controls](#controls)
9. [Testing a world](#testing-a-world)
10. [Rules that still apply](#rules-that-still-apply)

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
| `render`    | `"splats"` or `"hybrid"` ([Rendering](#rendering)); `?render=` overrides it   | `"splats"`     |
| `light`     | The sun, shadows, haze and grade ([Rendering](#rendering))                    | a sunny day    |
| `sky`       | `{ "clouds": 0..1 }`, how cloudy                                              | `0.5`          |
| `spawn`     | `{ "at": [x, z], "facing": degrees }`, where the character starts             | `[0, 0]`, 0    |
| `character` | The character's colors: `shirt`, `trousers`, `skin`, `hair`, `shoes`; `model` | red shirt      |
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
| `only`     | `"hybrid"` or `"splats"`: placed only in that mode (the model-only props need `"hybrid"`)  |

### Prop types

`palm`, `pine`, `oak`, `pebbles`, `mushroom`, `tulip`, `sunflower` and `lighthouse` are toy recipes;
`boulder` and `bush` are world props built in `props.js`. In hybrid mode `boulder` and `pebbles` are
drawn as scanned models instead, and `stone`, `shell`, `driftwood` and `stump` exist only as models
(see "Model props" below; give them `"only": "hybrid"`). To add a type, add a line to `PROP_TYPES`:

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
type's default collider. `"only": "hybrid"` or `"splats"` limits a scatter to one mode. Scatters are
placed in the order they are listed, each clear of what is already placed, so list big things before
the hundreds of small ones.

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

| Module              | What it does                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| `main.js`           | The page: labs check, start screen, list, cards, the frame loop, test hooks (`window.__world`)          |
| `world-file.js`     | Reads a world file and fills in every default (pure)                                                    |
| `world.js`          | A running world: builds everything, moves the character, plans the levels, finds landmarks              |
| `terrain.js`        | The height field, what covers the ground, and each chunk's ground splats at each level (pure)           |
| `water.js`          | Water chunks, the open sea around the world and the sky dome (pure)                                     |
| `props.js`          | Prop types, baking toy recipes into still props, thinner far copies, the boulder, bush and signs (pure) |
| `character.js`      | The character: its API, the build shared out by area, and the splats per tier (pure; `character-*.js`)  |
| `physics.js`        | Collision: the ground, water, steep slopes, and upright boxes, spheres and capsules (pure)              |
| `camera.js`         | The follow camera: orbit, smoothing, never in the ground, sway when running (pure)                      |
| `lod.js`            | The level-of-detail planner (pure)                                                                      |
| `tiers.js`          | Device tiers and their budgets (pure)                                                                   |
| `controls.js`       | Keys, mouse and touch: the thumb stick, drag to look, pinch or wheel to zoom, tap to pick               |
| `render.js`         | The PlayCanvas side: the device, the camera, the layers, splat containers and entities                  |
| `lighting.js`       | Both modes: the sun and its shadows, the haze, the grade, and splats mode's shadow catcher              |
| `mesh-character.js` | The lit, skinned characters (the realistic person, Kenney's) and their idle, walk and run               |
| `mesh-props.js`     | Hybrid mode's model props: boulders, pebble heaps, driftwood and stumps with levels, instanced stones   |
| `hybrid.js`         | Hybrid mode's models: the ground tiles and their textures, the water, the sky dome and the sign boards  |

### The character

(Lane Character, September 29, 2026.) A person about 7.5 heads tall (1.74 m) in a long-sleeved crew
neck top, straight-leg trousers and sneakers, sculpted with the kit in four modules:

| Module                | What it holds                                                                                                    |
| --------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `character.js`        | The public API (`JOINTS`, `BODY`, `buildCharacter`, `pose`, `stepGait`, `CHARACTER_SPLATS`) and the build        |
| `character-rig.js`    | `BODY` (sizes, `radius` for collision, the shoe's heel and ball), `JOINTS`, and the rotation math (`solve`)      |
| `character-body.js`   | The sculpt: lofts, rods and signed-distance shapes for every part, and the colors that follow from the look      |
| `character-motion.js` | The gait: the feet's paths, the hips' height, two-bone reach for the legs, the spine, arms, head and idle motion |

**Joints.** Twenty-one (`JOINTS`): the hips, the abdomen (`torso`), the chest, the neck, the head,
the upper arms (`armL`, `armR`), forearms (`foreL`, `foreR`), hands, fingers (the four fingers of a
hand curl together at the knuckles; the thumb is part of the hand), thighs, shins, feet and toes
(the front of the shoe, hinged at the ball). `L` is the character's left, at +x. Each part is one
rigid splat cloud around its own pivot, drawn by its own entity; a joint only turns it. The joints
are hidden as real clothes hide them: a rounded cap of cloth centered on each pivot (the shoulders,
elbows and knees, the same from every angle, so turning never opens a gap), sleeves over the wrists,
trouser legs over the shoe tops, the top's hem over the waistband, and a short cylinder of shoe on
the toes' hinge. `tests/chr.spec.mjs` looks at every joint from every side through a walk and a run
and fails if a sight line gets through.

**The look.** The world file's `character` colors (`shirt`, `trousers`, `skin`, `hair`, `shoes`) set
everything; the soles, laces, lips, brows, socks and the eyes' color follow from them (`palette()`
in `character-body.js`: blue-gray eyes with light hair, brown with dark). The head is one
signed-distance shape (the skull, cheekbones, jaw, chin, brow ridge, eye sockets, nose and lips)
with painted brows, nostrils and a little warmth on the cheeks; the eyes have whites, irises,
pupils, a catch light and lids with a lash line. The hair is short at the sides (fading into the
skin) and longer on top with a side-swept fringe: a dark inner layer and an outer layer of long
splats laid along the hair's flow from the crown.

**Sharpness.** Fidelity A's method: even placement on every surface, full opacity, flat splats,
clean colors lit by one soft light, and one density over the whole figure (the splats are shared out
by area; the head, hands and shoes get more per square meter). Surfaces hidden inside others are
left out where their color differs (the sole's top under the upper), or they show through as
speckle.

**Motion.** The feet lead. A planted foot stays where it landed: it strikes with the heel (toes up),
rolls flat, then rolls onto the ball as the heel lifts, the toes staying flat on the ground; a
swinging foot leaves and lands at the ground's speed, and when running the heel folds up under the
hips on the way through. The hips ride as high as both legs allow (they dip as the legs spread;
running, they sink into each landing and float between), sway over the planted foot and turn with
the leg that reaches forward, with the shoulders turning against them. Each leg reaches its foot by
two-bone inverse kinematics (the knee bends forward), and the ankle and toes turn the shoe to match,
so the feet don't slide (the tests hold drift under 5 mm). The arms swing opposite the legs with the
elbows bent (about 90 degrees when running, with loose fists); the body leans a little into a run,
and the head keeps level. Standing, the character breathes, shifts its weight from foot to foot
every few seconds (the feet stay put) and now and then glances to one side. The phase moves with the
distance walked (`strideAt(speed)`: 1.4 m per stride walking, 3 m running), so the feet keep pace
with the ground at any speed. Walking is 1.9 m/s and running (Shift, or the stick pushed all the
way) 4.6 m/s.

`pose(gait, time)` returns `{ joints, bob, hips, feet }`: every joint's Euler angles in degrees (as
PlayCanvas applies them, `R = Rz · Ry · Rx`), the hips' rise from standing, their sideways sway
(`hips: [x, 0, z]`, which `world.placeCharacter()` applies) and each foot's state. `solve(pose)`
gives every joint's place and rotation in the character's space.

**Budget.** The character is always drawn in full, so its splats come from the tier
(`CHARACTER_SPLATS`): 40,000 on low, 64,000 on mid, 90,000 on high and 120,000 on max (the build
comes out about 5% under). Building it takes about a second on a computer.

**Tools.** `node tools/chr-view.mjs out.png --views=front,side,face` renders the character on its
own from named views (`--speed=1.9 --strip=8` for a strip through a stride), and
`node tools/chr-clip.mjs <dir> closeup idle walk run colors before-after` records the review clips
(the walk and run start on the Test island with the follow camera).

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

## Rendering

A world is drawn in one of two modes. The world file's `render` picks one (`"splats"` by default;
the Test island stays in splats mode); `?render=splats` or `?render=hybrid` overrides it for a
visit, which is how the clips compare them side by side.

| Drawn as                                 | Splats mode                       | Hybrid mode                                         |
| ---------------------------------------- | --------------------------------- | --------------------------------------------------- |
| Ground                                   | splats (a carpet, chunk by chunk) | a lit model of the same height field, textured      |
| Near grass                               | splats (blades)                   | splats (blades), on the model                       |
| Water                                    | splats, with moving waves         | a lit model that knows the depth below it           |
| Sky                                      | a dome of splats                  | a dome with a photo of the sky, which lights models |
| Signs                                    | splats                            | wooden boards with the title painted on             |
| Trees, bushes, flowers, the lighthouse   | splats                            | splats (the leaves in deeper, shaded greens)        |
| Rocks, stones, shells, driftwood, stumps | splats (rocks)                    | scanned models with three levels of detail          |
| The character                            | splats (the kit-built character)  | the realistic person, a lit, skinned model          |

Collision is the same in both: invisible shapes and the height field.

### Light, shadows and haze (both modes)

`light` in the world file (all optional):

| Field          | Meaning                                                                    | Default   |
| -------------- | -------------------------------------------------------------------------- | --------- |
| `sun`          | `{ "azimuth", "elevation" }` in degrees (azimuth clockwise from north, -z) | 232, 48   |
| `sunColor`     | The sunlight's color (lights hybrid mode's models)                         | `#fff3df` |
| `sunIntensity` | How bright the sun is on the models                                        | 0.95      |
| `shadow`       | How dark shadows are on splats mode's ground (0 to 1)                      | 0.42      |
| `haze`         | The haze's density (exponential squared, per meter)                        | 0.0045    |
| `hazeColor`    | The haze's color (hybrid mode uses the sky photo's horizon)                | `horizon` |
| `exposure`     | The grade's exposure                                                       | 1         |

- **One sun.** A directional light with soft (PCF) shadows. The character and the near props
  (levels 0) cast shadows; the shadow map's size and reach are set per tier (`shadows` and
  `shadowDistance` in `WORLD_BUDGETS`: none on low, 1024 and 26 m on mid, 2048 and 36 m on high,
  2048 and 48 m in two cascades on max). `?shadows=0` turns them off. In splats mode the catcher is
  drawn only within the shadows' reach of the camera, since every pixel it covers looks up the
  shadow map.
- **Splats aren't lit** (their colors carry their own light), so they only cast shadows. In hybrid
  mode the ground model receives them. In splats mode an invisible **shadow catcher** (a model of
  the ground whose material only darkens where shadows fall) is drawn over the ground's splats and
  under the props' and the character's.
- **Haze.** The engine's fog, which it applies to splats (by their centers' distance) and models
  alike, so far hills and the far sea fade into the same color. The splat sky has none.
- **Grade.** In hybrid mode, a neutral tone map (it leaves colors below about 0.8 as they are and
  rolls off the highlights of the lit models and the sky) and an exposure. Splats mode has no tone
  map: the splats' colors carry their own light and stay exactly as they are.
- **The camera frame** (hybrid mode on the high and max tiers; `?frame=0` or `?frame=1` overrides
  it): the engine's `CameraFrame` renders the scene to its own target and finishes it with a touch
  of bloom, a little more depth in the colors (vibrance, softer highlights, a little dehaze), soft
  ambient occlusion where models meet the ground, and a light vignette. It costs a pass and memory,
  so the low and mid tiers (phones) go without.

### Layers and depth

Splats don't write depth, so the order matters. `render.js` draws, in order: the opaque models (the
hybrid ground, the sign boards; in splats mode an invisible model of the ground that writes only
depth, 12 cm under the surface), the sky, the ground's splats (`WdGround`: the carpet or the near
grass), the surface (`WdSurface`: the shadow catcher, or the hybrid water, which writes depth), then
the props and the character. Every splat tests against the models' depth, so a hill hides the bush
behind it and the water's surface hides a wading character's legs, in both modes. Splats mode's
water splats draw with the props and the character, sorted together, as before.

### Hybrid mode's models (`hybrid.js`)

- **Ground.** Tiles 16 m square with a vertex every 0.5 m (1 m on the low tier), from the same
  height field. Each vertex carries the terrain's own color (`colorAt` without its baked light; the
  engine lights the model). Four CC0 textures in one atlas (sand, grass, rock, wet sand) add the
  detail: each pixel picks them by height and slope with the same rules as the splats, and each
  texture is divided by its mean color, so it adds detail without changing the world's palette. Each
  texture is sampled twice, the second time three times larger and turned, which breaks the repeat.
  Sand gives way to grass in noisy patches rather than along a smooth line, steep sand by the water
  stays sand (no gravel on the beach), and the grass photo's pale pebbles are held down. The detail
  fades out between 28 m and 70 m. Near grass stays splats (blades), so the ground isn't a flat
  carpet.
- **Water.** A grid over the world with the depth below each vertex, and a flat skirt to the
  horizon. Its shader makes it pale and clear over the shallows and dark blue at depth, draws foam
  at the shore (breaking bands, and a strip along the waterline that breathes in and out), and moves
  gentle waves in its normals; the sky's reflection comes from the image-based light, stronger at
  grazing angles (Fresnel).
- **Sky.** A dome around the camera with the upper part of a CC0 HDRI, turned so its sun sits at the
  world's sun. The same HDRI (with the sun's disk clamped, since the sun is a light of its own)
  lights the models and gives the water its reflection.
- **Signs.** Wooden posts and a board, the face painted in the `accent` color with the landmark's
  title in cream. The same size as the splat sign, so taps and collision match.

### The mesh character (`mesh-character.js`)

Hybrid mode's character is a realistic person: an adult of ordinary proportions made with MakeHuman
(its base mesh and bundled assets are CC0: the body, an invented face, skin, eyes, eyebrows,
eyelashes, short hair, a T-shirt, jeans and sneakers), lit by the same sun and sky and casting the
same shadows. `"character": { "model": "mesh" }` in the world file, or `?character=mesh`, asks for
it in either mode; `"auto"` (the default) means this person in hybrid mode and the splat character
in splats mode; `"splats"` and `"kenney"` (the stylized character of the hybrid round) are the
others. The world's `shirt` color dyes the white T-shirt.

- **Levels.** The high and max tiers load `human-high.glb` (about 31k triangles, a 2K skin texture),
  the low and mid tiers `human-low.glb` (about 17k, 1K). Both have the same skeleton (MPFB's
  game-engine rig, 53 bones) and clips.
- **Motion.** Motion capture from the 100STYLE dataset (CC BY 4.0): an idle, a walk (the neutral
  style) and a run (the "proud" style: upright, the arms swinging). The walk and the run are one
  gait cycle each, from one left heel strike to the next on a straight stretch, played in place and
  resampled to one second, so they blend in step. The idle cross-fades in when the character stops.
- **Planted feet.** `human.json` has each clip's stride (how far the standing foot travels in one
  cycle). The world plays the clips at speed ÷ stride cycles a second (`humanRate()`), so the
  standing foot stays put on the ground: it slides less than a tenth of the body's speed.
- **Speeds.** The person walks at 1.3 m/s and runs at 2.7 m/s (`walkSpeed` and `runSpeed` in
  `human.json`); the captured ones are about 0.9 and 1.9, played about 1.4 times faster. The splat
  character keeps 1.9 and 4.6.
- **Building it.** `tools/wd-character.py` runs in Blender as a Python module (`bpy` 5.0.1) with the
  MPFB 2.0.17 add-on: it makes the person, paints the logos out of the clothes' texture, gives every
  part a plain physically based material (the hair as strands over an opaque cap, so nothing shows
  through), retargets the capture onto the rig bone by bone, decimates the lighter level and exports
  both GLBs and `human.json`. Its header has the commands.

**The person as splats** (`?character=splat-person`, a trial for splats mode): the build tool
samples the person's textured surface at rest into 90,000 splats (flat, 4 mm across, facing out of
the surface), drops any sample with another surface just above it (skin under the T-shirt), and
gives each splat to the bone that moves it most (`human-splats.bin` and `.json`). In the page each
bone's splats are one rigid piece on that bone, driven by the same skeleton and clips (the model's
meshes are hidden), so parts turn as solid pieces and nothing bends; the tier's character budget
(`CHARACTER_SPLATS`) sets how many are drawn. At phone distance it reads as a real person; up close
it is grainier than the kit-built splat character, which stays splats mode's default.

The earlier mesh character (`?character=kenney`) is Kenney's "Animated Characters: Protagonists"
(CC0), built by `tools/world-character.mjs` into `character.glb`, with a walk made from its run.
Collision, the camera and the controls are the same for every character.

### Model props (`mesh-props.js`)

In hybrid mode, rocks and the things on the beach are scanned models from Poly Haven (CC0), built by
`tools/wd-props.py` into `assets/worlds/props/<kind>.glb`: boulders (two sources, three shapes),
stones (seven shapes), a shell, driftwood and a stump. Each shape is 1 m tall (or long) with its
foot at the origin and has three levels of detail (for a boulder about 4,000, 900 and 200
triangles), with its color, normal and roughness maps.

- `boulder` props are one model each; `pebbles` are a heap of four to six stones; `driftwood` and
  `stump` are one model each. They switch level by distance to the camera (`lodFor()`: level 0
  within about 14 m, level 1 within about 40 m, farther by the square root of their size and the
  tier's near distance), cast shadows and get colliders from their measured size.
- `stone` and `shell` are scattered by the hundred (the Test island has 220 stones and 28 shells on
  its sand) and drawn instanced, one draw per shape, half sunk in the sand.
- Splats stay where they are special: trees, bushes and flowers (which move and break), and the
  lighthouse toy. Their leaves are regraded in hybrid mode (`gradeFoliage()` in `props.js`): deeper,
  varied greens in clusters, shade inside the crown and lighter leaves on top.

`tools/world-assets.mjs` fetches the textures and the HDRI from Poly Haven and builds
`assets/worlds/ground/` (the atlases and `ground.json`: each texture's repeat, strength and mean
color) and `assets/worlds/sky/` (the lighting HDRI, the dome image and `sky.json`: where its sun
is). About 5 MB in all.

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
  (the scenes are scripted at the top of the tool; add your own). `--modes` records each scene in
  splats mode (left) and hybrid mode (right); `--render=hybrid` records one mode.
- `stats()` also gives the mode, the models drawn and the median frame time, and in hybrid mode
  `meshProps` (the model props, how many show each level, and how many are scattered).
- `?stats=1` shows a small readout on the page (frames per second, the tier, the mode, the
  character, splats drawn and draw calls), for testing on a phone: a screenshot carries the numbers.
- `?frame=0|1` turns hybrid mode's camera frame off or on; `?character=splats|mesh|kenney` picks the
  character.
- `tests/wd.spec.mjs` has the engine's tests, `tests/wdh.spec.mjs` the hybrid round's (the switch,
  both modes, depth order, shadows, frames per second, the assets) and `tests/wdr3.spec.mjs` round
  3's (the person in each tier, its clips and planted feet, the model props' levels, the stats
  readout, the assets' budgets and credits). A world lane adds its own in `tests/<prefix>.spec.mjs`.

## Rules that still apply

The ground rules and the effect quality rules in [CLAUDE.md](../CLAUDE.md) hold for worlds too:
everything seen is splats (tell the Operator, with clips, before thinking of any mesh), assets are
CC0, CC BY or public domain and credited, no logos or brand names, and new public text is in
American English. A world is a folder under `worlds/`; it doesn't change the toy box.
