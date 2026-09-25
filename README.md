# Splashery

**Splats you can play with.** Splashery is a toy box of 3D Gaussian splats that runs entirely in the
browser: pick a toy (a real captured object, or one generated from a seed), spin it, poke it, blow
on it, splash paint on it, drop it, watch it fall apart and come back, make your own, and share it
as a link, an embed, a GIF or a video.

Live at **https://ryanjosephkamp.github.io/splashery/**. Static files and ES modules only: no build
step, no bundler, no framework, no server, no API keys. Rendering is the
[PlayCanvas engine](https://github.com/playcanvas/engine) (MIT), vendored under
`vendor/playcanvas/`, using WebGPU when the browser has it and WebGL2 otherwise.

Splashery v1, a planet you could paint, lives on the `checkpoint/v1-planet-painter` branch and in
[docs/SPEC-v1-planet-painter.md](docs/SPEC-v1-planet-painter.md). The v2 specification is
[SPEC.md](SPEC.md). What comes next (100+ toys, toys that move and open, patterns and flags) is in
[docs/ROADMAP.md](docs/ROADMAP.md); what is parked, and why, is in
[docs/BACKLOG.md](docs/BACKLOG.md).

## The toys

| Toy                           | Kind                  | Notes                                                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cactus                        | Captured              | CC0, steam studio / 3D SCAN STUDIO iris                                                                                                                                                                                                                                                                                                                                                                        |
| Strawberry                    | Captured              | CC BY 4.0, Dany Bittel                                                                                                                                                                                                                                                                                                                                                                                         |
| Heart cookie                  | Captured              | CC BY 4.0, Dany Bittel                                                                                                                                                                                                                                                                                                                                                                                         |
| Honeybee                      | Captured              | CC BY 4.0, YUMA Co., Ltd.                                                                                                                                                                                                                                                                                                                                                                                      |
| Jelly blob                    | Generated             | Noise blob, candy palette                                                                                                                                                                                                                                                                                                                                                                                      |
| Donut                         | Generated             | Torus with frosting and sprinkles                                                                                                                                                                                                                                                                                                                                                                              |
| Neon knot                     | Generated             | Trefoil knot                                                                                                                                                                                                                                                                                                                                                                                                   |
| Tiny planet                   | Generated             | Oceans, continents, ice caps and clouds: a tribute to Splashery v1                                                                                                                                                                                                                                                                                                                                             |
| Beating heart                 | Pack (Body)           | A stylised heart that beats; or a love heart                                                                                                                                                                                                                                                                                                                                                                   |
| Campfire                      | Pack (Weather & fire) | Flames that flicker, sparks and smoke; tap to stoke it                                                                                                                                                                                                                                                                                                                                                         |
| Treasure chest                | Pack (Open me)        | Tap to open the lid on glinting coins and gems                                                                                                                                                                                                                                                                                                                                                                 |
| 25 sports balls               | Pack (Balls)          | Basketball, soccer ball, American football, tennis ball, baseball, softball, beach ball, golf ball, rugby ball, volleyball, water polo ball, ping-pong ball, cricket ball, bowling ball, pool ball (cue and 1 to 15), pickleball, dodgeball, medicine ball, lacrosse ball, squash ball, bouncy ball, marble, hockey puck, shuttlecock and flying disc. Seams and stitching stay put under any flag or pattern. |
| 23 space toys                 | Pack (Space)          | The Sun, the eight planets (Saturn's and Uranus's rings, Jupiter's Great Red Spot), the Moon, an aurora world, a solar system that orbits, an asteroid, a comet, a meteor, a star, a pulsar, a black hole with its disc, a star cluster, a ring nebula, a nebula with its pillars, a supernova and a spiral galaxy.                                                                                            |
| 18 tiny-world toys            | Pack (Tiny world)     | Virus, bacteriophage (tap to inject DNA), bacterium, red and white blood cells, neuron (fire a signal), astrocyte, microglia, animal cell and mitochondrion with cutaways, DNA that unzips, chromosome, diatom, tardigrade, pollen grains, snowflakes, paramecium and amoeba.                                                                                                                                  |
| 4 atoms toys                  | Pack (Atoms)          | Electron orbitals (1s to 4f), a Bohr atom for 44 elements, molecules (water to caffeine and C60) and crystal lattices (salt, diamond, graphite, ice).                                                                                                                                                                                                                                                          |
| 9 gems                        | Pack (Gems)           | Diamond, ruby, emerald and sapphire cuts, an amethyst geode and a pearl in its oyster that open, a quartz cluster, opals and a crystal ball.                                                                                                                                                                                                                                                                   |
| 5 more body toys              | Pack (Body)           | Brain, eye (shine a light), lungs that breathe, tooth and kidney; Slice shows the insides.                                                                                                                                                                                                                                                                                                                     |
| 23 nature toys                | Pack (Nature)         | Oak (four seasons), pine, palm, cherry blossom, maple, bonsai, weeping willow, sunflower, rose, dandelion (blow the seeds), tulips, daisies, lotus, toadstool, fern, saguaro, coral reef, pinecone, acorns, succulent, bamboo, pebbles and kelp. Trees and flowers sway.                                                                                                                                       |
| 12 more weather and fire toys | Pack (Weather & fire) | Storm cloud with rain and thunder, lava lamp, snow globe (shake it), volcano (erupt), a melting ice swan, a candle to blow out or light, tornado, rainbow, iceberg, waterfall, ocean wave and geyser.                                                                                                                                                                                                          |
| 27 food toys                  | Pack (Food)           | Ice cream that melts, watermelon (take a slice), birthday cake (blow out the candles), popcorn that pops, jelly that wobbles, pancakes (flip the top one), cupcake, lollipop, candy canes, macarons, gummy bear (squish), pretzel, croissant, pizza, burger (explode view), sushi, taco, boiled egg (crack it), coffee (stir it), apple, bananas, orange, kiwi, pineapple, cherries, grapes and avocado.       |
| 15 toys                       | Pack (Toys)           | Building bricks (pop them apart), rubber duck (squeak), spinning top, dice (roll), Newton's cradle (lift and let go), teddy bear (wave hello), yo-yo, puzzle cube (twist the top), spring toy (make it walk), kite, paper plane, origami crane, balloon dog, soap bubbles and a wind-up robot.                                                                                                                 |
| Chess set                     | Pack (Games)          | A walnut board that plays Morphy's Opera Game (Paris, 1858), or any game from a PGN file you open or paste, move by move.                                                                                                                                                                                                                                                                                      |
| 11 maths toys                 | Pack (Maths)          | Lorenz attractor, Möbius strip, Klein bottle, Menger sponge, hypercube, torus knot, gyroid, Mandelbulb, Sierpinski tetrahedron, the five Platonic solids and a seashell spiral.                                                                                                                                                                                                                                |
| 10 more things that open      | Pack (Open me)        | Storybook, laptop, music box, alarm clock (ring the bell), gift box (open the present), umbrella, desk fan, desk lamp, potion bottle (pop the cork) and a telescope that extends.                                                                                                                                                                                                                              |
| 9 medieval toys               | Pack (Medieval)       | Sword in the stone (pull it), heraldic shield, bow and target, trebuchet (launch), crossbow, knight's helmet (open the visor), crown, dragon egg (hatch) and a wizard's orb (cast). No guns.                                                                                                                                                                                                                   |
| 13 animals                    | Pack (Animals)        | Jellyfish, school of fish, butterfly, pufferfish (poke it), nautilus, ladybug (open the wings), snail (hide in the shell), octopus (squirt ink), starfish, sea urchin, frog, penguin and owl (turn the head).                                                                                                                                                                                                  |
| 8 holiday toys                | Pack (Holidays)       | Jack-o'-lantern, snowman, fireworks (launch), decorated tree (lights on or off), patterned egg, paper lantern, diya and a menorah (light the candles).                                                                                                                                                                                                                                                         |
| 3 music toys                  | Pack (Music)          | Acoustic guitar (strum), snare drum (hit) and xylophone (play a scale).                                                                                                                                                                                                                                                                                                                                        |
| 14 vehicles                   | Pack (Vehicles)       | Rocket on its pad, helicopter, hot-air balloon, steam train, a generic ocean liner, sports car, school bus, propeller plane, jet airliner, sailboat, submarine, bicycle, tractor and a flying saucer.                                                                                                                                                                                                          |
| 16 landmarks                  | Pack (Landmarks)      | Eiffel Tower, Washington Monument, Pyramids of Giza, a twisting supertall, lighthouse, Statue of Liberty, White House, Leaning Tower of Pisa, Colosseum, Parthenon, Stonehenge, Big Ben, Taj Mahal, a castle, a pagoda and a windmill.                                                                                                                                                                         |
| 26 photoreal toys             | Captured (Photoreal)  | Twelve CC BY scans from SuperSplat and fourteen CC0 Poly Haven models turned into splats; see below and [CREDITS.md](CREDITS.md).                                                                                                                                                                                                                                                                              |

Captured toys are SOG files of up to 450,000 splats (about 5 MB each) with a lighter copy for
phones. The **Photoreal** shelf adds twelve more CC BY scans from SuperSplat (bugs, berries, a
grape, a star cookie, tomatoes, a basket and a fractal) and fourteen CC0 Poly Haven models turned
into splats (a rubber duck, a garden gnome, a ukulele, a boombox, a croissant and more). Full
credits are in [CREDITS.md](CREDITS.md) and in the app under **About & credits**.

**Make a toy** builds a new one in the browser: pick a shape (sphere, noise blob, torus, capsule,
knot), a palette, a seed, the number of splats (up to 300,000 on desktops, 240,000 on phones; see
Detail below), size jitter, roughness and colour noise. The **Clay** tool then adds lumps where you
drag, or erases them. Everything is seeded, so a saved scene rebuilds exactly the same toy.

### Toys from packs

Most new toys are **recipes** in `src/packs/<pack>.js`, built in your browser by the toy kit
(`src/kit.js`): a small library of shapes (spheres, ellipsoids, boxes, rounded boxes, cylinders,
cones, tori, discs, surfaces of revolution, tubes along curves, parametric and radial surfaces, and
free point clouds) that shares the splat budget by surface area so the whole toy has an even
density. A pack only downloads when one of its toys is picked. Recipes can give a toy:

- **behaviours** that run on the GPU per splat: orbit, beat, breathe, flame, rise, fall, twinkle,
  sway, grow, melt, a glow that pulses along a path, wave and glint;
- **parts** (up to 15 rigid groups) that hinge, spin or slide, driven by the recipe each frame (a
  turning part can hide its far side), and up to 48 **tokens** (pieces picked per splat: chess
  pieces, an asteroid's rubble, a molecule's atoms);
- **controls** (sliders, switches, one-shot pulses) and an **action** that a tap on the toy runs
  (open the lid, stoke the fire);
- **options** that rebuild the toy (a style, a colour).

Clay works on pack toys too.

## Motion, patterns and sound

- **Move** (Toy tab, any toy): still, bounce (with squash and stretch), spin, wobble or float, with
  a speed slider. Tapping a toy with the Orbit tool runs its action, or makes it hop.
- **Pattern** (Look tab, any toy, captured ones included): stripes, bands, polka dots, checks,
  stars, hearts, zigzag, gradient, rainbow, marble, or a **national flag** (196 public-domain flags
  from Wikimedia Commons). It wraps around the toy, across its front, like a globe, or from above
  over a flat toy (the chess board takes flag colours on its squares and pieces), keeps as much of
  the toy's own shading as you like, and leaves details such as flames or coins alone. The status
  line says "in the colours of …".
- **Sound** (the speaker button): every toy has its own tap sound, synthesised from a library of
  about 80 voices (plucked strings, bells, xylophone bars, drums, insect buzz, a quack and other
  creature voices, crunch, splash, wind, engines, horns) with a small note sequencer for tunes: the
  guitar strums a chord progression, Big Ben plays the Westminster quarters, the music box plays a
  melody. Pokes, paint, clay and the effect switches have their own soft sounds. Off until you turn
  it on; embeds are always silent.
- **Taps know where they land.** A toy can react to the spot you tap: tap one xylophone bar and the
  mallet strikes that bar and plays its note; tap elsewhere and it plays the scale.
- **Scan rigs.** Captured toys can have moving parts: the cat statue turns its head and flicks its
  tail, the bee buzzes its wings and lifts off, the horse rears. Rigs can also pick splats by colour
  (strawberry seeds, the cookie's jam heart), run whole-body effects (the raspberry's ripple, the
  star cookie crumbling, the blob splitting in three) and show a small kit-built add-on with the
  scan (the lantern's flame, the cactus's flowers, the marble bust's speech bubble). Every scan and
  shelf shape now has its own tap effect.
- **Space, atoms and gems.** Every one has its own tap: the Sun throws off a flare (and churns all
  the time), the planets line up while Mercury crosses the Sun, Earth turns through a night with its
  city lights, the Moon runs through its phases, Mars raises a dust storm, Jupiter's bands race,
  Saturn's rings ripple, the asteroid breaks into pieces and pulls back together, a star lives and
  dies, the pulsar strobes, the black hole swallows a star; an electron jumps to a higher orbital
  and drops back with a photon, a molecule's bonds shake when heated, a wave runs through a crystal
  lattice; the diamond flashes rainbow fire, the ruby glows red, a star glides over the sapphire.
- **Drag to stretch.** Drag the gummy bear (with the Orbit tool, starting on the bear) to stretch
  it; let go and it springs back. A drag that starts beside it still turns the view.
- Under a system setting for reduced motion, toys stay still until you switch motion on.

## Effects

Every effect runs on the GPU for every splat, every frame, through one PlayCanvas work-buffer
modifier (`GSplatComponent.setWorkBufferModifier`); the CPU only sets a few uniforms. Effects stack,
and each has one or two sliders.

- **Poke** (tool): tap the toy and a ripple rings out from the touch point and settles.
- **Wind**: a noisy breeze sways the top of the toy; strength and direction.
- **Dissolve**: splats fly apart and find their way home, over and over.
- **Drop**: splats fall screen-down and bounce on an invisible floor. Shake the toy (a quick
  back-and-forth drag, or shake your phone) or switch it off to rebuild it.
- **Magnet** (tool): hold the pointer near the toy; positive pulls splats in, negative scatters
  them.
- **Twist**: wrings the toy around the X, Y or Z axis, still or wobbling.
- **Slice**: a clipping plane sweeps through the toy with a glowing edge and shows what is inside.
- **Paint** (tool): drag to recolour splats. Each touch splashes droplets and drips run screen-down.
  Paint stays until you clear it.

## The panel

The shelf sits at the top of the panel: search it, filter it by category, or press **Surprise me**
for a random toy. Below the tools, tabs hold everything else: **Toy** (the main tab: the toy's
action, controls and options, Motion with the **Turntable when idle** switch, and Quick settings
with flag colours, **Detail** and **Reset everything**), **Tools** (the picked tool's settings,
which open by themselves when you pick Paint, Magnet, Poke or Clay, and the effects), **Look**,
**Make**, **Share** and **About** (the ⓘ). **Reset everything** (tap it twice) takes the toy back to
how it started: no flag colours or pattern, paint, clay, effects, option or look changes, Detail on
Auto and the view reset. On a wide screen, drag the panel's left edge to make it (and the shelf,
which gains columns) wider, and the grip under the shelf to show more rows; double-click either grip
for a big size. The sizes stay in this browser. On a phone the panel is a bottom sheet. The shelf
row and tools always show, with toy names on up to two lines. Dragging the handle or the row up
opens the shelf into a grid of toys that fills the sheet (the chips and search stay on top); picking
a toy folds it back to the row. **More** or a tab opens the rest. The toy shrinks to fit above the
sheet so you can watch your changes. Tap the toy, swipe down, press **Done** or Escape to close
either one again. The grid can be switched off with `SHELF_GRID` in `src/ui.js`; the handle then
opens the panel, as before.

## Controls

| Input                                 | Does                                             |
| ------------------------------------- | ------------------------------------------------ |
| Drag, one finger                      | Turn the toy (or use the picked tool on the toy) |
| Right-drag, Space + drag, two fingers | Always turn the toy                              |
| Wheel, pinch                          | Zoom, within limits around the toy               |
| Two-finger twist                      | Roll                                             |
| Double-click, double-tap              | Reset the view                                   |
| 1 to 5                                | Orbit, Poke, Paint, Magnet, Clay                 |
| P / R                                 | Poke a random spot / reset the view              |
| Arrows, + and −                       | Turn and zoom from the keyboard (canvas focused) |

The camera eases in and out, coasts after a flick, and turns slowly when you leave it alone (never
when your system asks for reduced motion).

## Bring your own splat

Drop a file anywhere on the page, or use **Your own splat → Open a splat file…**:

- **PLY** (including SuperSplat's compressed PLY) and **SOG**: loaded by the engine's own parsers.
- **SPLAT** (antimatter15) and **SPZ versions 1 to 3** (Niantic, gzip): decoded in the browser.
- Not supported yet: **KSPLAT**, and **SPZ version 4** (it needs a zstd decoder). Convert those to
  PLY or SOG with [SuperSplat](https://superspl.at/editor) or `splat-transform` first.

Files stay in your browser; nothing is uploaded. Big files (over 150 MB or 1.5 million splats; 60 MB
or 400,000 splats on phones) get a warning, and uncompressed binary PLY files can be loaded as a
lighter random subset instead. **Turn it upside down** fixes captures that load flipped. **Find your
own splat** (in the same section) says where to find files, which apps make them, and what works on
them.

## Look and autoplay

Background (page colour, transparent or any colour), theme (auto, light or dark; auto follows the
page), accent colour, splat size and exposure. When idle the toy can turn slowly and play one gentle
effect: a breeze, little pokes, a slow twist, or dissolve and rebuild.

**Detail** (Auto, High or Max) sets how many splats toys get and how sharp the canvas is. Auto picks
a tier for the device:

| Tier | Who gets it                               | Generated toys | Canvas pixel ratio |
| ---- | ----------------------------------------- | -------------- | ------------------ |
| low  | 2 GB of memory or less, or two cores      | 60k splats     | up to 1.5          |
| mid  | phones, and machines with 4 GB or 4 cores | 140k           | up to 2            |
| high | other desktops, and Detail: High          | 200k           | up to 2            |
| max  | Detail: Max                               | 280k           | up to 3            |

Captured toys use their lighter file only at the low tier. While the view moves and frames take more
than about 24 ms, the canvas drops to a lower resolution, and the first still frame is drawn sharp
again. If frames stay slow even then, an Auto tier steps down one level for the next toy. Detail is
kept in this browser only (in `localStorage`); it is never part of a link or a scene file, so a
shared link cannot force a heavy load on someone's phone.

## Sharing

In the **Share** tab:

- **Copy link**: the whole scene, deflate-compressed into `#s=` in the URL. For your own file the
  link carries the settings only and says so.
- **Save JSON / Load JSON**: the scene as a file (you can also drop it on the page). The format is
  documented in [docs/SCENE-SCHEMA.md](docs/SCENE-SCHEMA.md).
- **Save picture**: a PNG of the current view (transparent if the background is).
- **Save GIF**: a turntable or a short effect loop, 48 frames at 512 px by default, encoded in the
  browser with gifenc.
- **Save video**: a WebM turntable recorded from the canvas (hidden, with the reason, where the
  browser cannot record).
- **Embed**: an iframe snippet and a custom-element snippet, each with a Copy button.

### Embedding

The iframe works anywhere:

```html
<iframe
  src="https://ryanjosephkamp.github.io/splashery/embed/#s=PAYLOAD"
  title="Splashery toy"
  loading="lazy"
  style="width:100%;max-width:600px;aspect-ratio:4/3;border:0;border-radius:12px"
></iframe>
```

It fills its column at 4:3, up to a maximum width. The Share tab's size picker sets that width:
Small (360 px), Medium (600 px), Large (900 px) or Full width (no limit).

The embed player (`embed/index.html`) has no editing UI: it turns slowly when idle (not under
reduced motion), you can orbit it, it can autoplay one gentle effect, and it links back with **Open
in Splashery**. Query options: `?toy=cactus` (a shelf toy, when there is no `#s=`),
`?theme=light|dark`, `?bg=transparent`, `?autoplay=breeze|pokes|twist|dissolve`, `?turntable=off`,
`?zoom=0.5` to `2` (1 fits the toy to about 80% of the shorter side; 2 comes twice as close) and
`?controls=0` (hides the + and − zoom buttons in the top corner). For a transparent iframe, also
give the iframe `color-scheme: light` (the snippet does): the embed then uses a light scheme too,
and browsers keep it see-through even when the visitor's system is in dark mode. A host page can
switch the theme with
`iframe.contentWindow.postMessage({ type: "splashery:theme", theme: "dark" }, "*")`. Inside an embed
the mouse wheel scrolls the page until you click or tap the toy; after that it zooms until the
pointer leaves. Ctrl or ⌘ with the wheel, a pinch and the + and − buttons always zoom. The first
plain scroll shows a hint: "Pinch or Ctrl+scroll to zoom".

The `<splashery-toy>` element embeds a toy without an iframe, with one script tag:

```html
<script type="module" src="https://ryanjosephkamp.github.io/splashery/src/element.js"></script>
<splashery-toy toy="cactus" autoplay="breeze"></splashery-toy>
```

Attributes: `scene` (a share payload), `toy`, `theme` (`auto`, `light`, `dark`; auto follows the
page, including a `paper-theme-change` event on `document` and `data-resolved-theme` on `<html>`),
`background` (`transparent`, `page` or a colour), `autoplay`, `turntable="off"`, `zoom` (0.5 to 2),
`controls="0"` and `label`. It is 4:3 unless you size it, starts when scrolled into view and pauses
when scrolled away. See [embed/demo.html](embed/demo.html) for both side by side.

Built-in toys load in well under 30 MB (an embed with the heaviest captured toy transfers about 8
MB: the engine plus one SOG).

## Running locally

```sh
python3 -m http.server 4173 --bind 127.0.0.1
# open http://127.0.0.1:4173/
```

Any static server works. Useful query options: `?renderer=webgl2|webgpu` (force a renderer),
`?profile=low|mid|high|max` (force a detail tier; the old `weak` and `strong` mean low and high),
`?adapt=off` (no adaptive resolution or tier step-down; the tools use it, since SwiftShader is
slow).

## Preparing assets

Captured toys are prepared with the MIT
[`@playcanvas/splat-transform`](https://github.com/playcanvas/splat-transform) CLI, driven by
[tools/prepare-assets.mjs](tools/prepare-assets.mjs) and the sources in
[tools/assets.json](tools/assets.json):

```sh
npm install
node tools/prepare-assets.mjs            # all toys
node tools/prepare-assets.mjs bee        # one toy
```

For each toy it rotates the capture upright, drops spherical harmonics, measures robust bounds,
recentres and scales it, crops floaters, decimates to 450,000 splats and writes
`assets/toys/<id>/<id>.sog` plus a 120,000-splat `<id>-lite.sog`. The SuperSplat sources are fetched
from their public URLs; the cactus comes from the Steam Studio sample zip (see `sourceNote` in the
manifest). Thumbnails are rendered by the app itself:

```sh
SPLASHERY_CHROMIUM=/path/to/chrome node tools/make-thumbs.mjs
```

To add a toy: add it to `tools/assets.json` (CC0 or CC BY only), run both tools, add an entry with
its credit to `src/toys.js`, and add it to [CREDITS.md](CREDITS.md).

Some photoreal toys start as textured 3D models rather than scans.
[tools/mesh-to-splats.mjs](tools/mesh-to-splats.mjs) turns the CC0 models listed in
[tools/models.json](tools/models.json) into splats: it downloads each glTF from Poly Haven, scatters
splats over the surfaces by area, colours each one from the model's textures, skips glass so the
insides show, and writes `.cache/models/<id>/<id>.ply`, which `tools/prepare-assets.mjs` then packs
like any scan:

```sh
node tools/mesh-to-splats.mjs            # all models
node tools/mesh-to-splats.mjs ukulele    # one model
node tools/prepare-assets.mjs ukulele
```

It reads each texture at the mip level that matches a splat's footprint, so busy textures do not
alias into grain. Options per model in `tools/models.json` (documented at the top of the tool) can
bake soft studio light into the colours using the model's normal and occlusion maps, draw lenses as
dark glass, and paint out printed brand names.

`tools/toy-shots.mjs <out-dir> id ...` renders toys at their home view to PNG files for before and
after comparisons (`--size=`, `--bg=`, `--theme=light`, `--set=open=0` to set a control first).

`tools/effect-strip.mjs <out-dir> id ...` renders a toy's tap effect as a filmstrip: a frame before
the tap, then frames at fixed times after it (`--times=0.1,0.3,0.6,1,1.5,2.2,3`), in one PNG. It
steps the clock by hand, so the frames land at the same toy time on any machine.
`--taps=3 --gap=0.2` taps several times (for toys that react to fast taps). `--at=x,y,z` taps that
point (recipe coordinates) instead of pressing the action.

`tools/rig-map.mjs <out-dir> id ...` renders a scan from the front, right, top and back with an
orthographic camera and a world grid (0.1 apart), for placing rig regions; `--rig` tints the rig
parts and colour keys, `--at=0.9` taps and renders the pose that long after.

`tools/sound-check.mjs [id ...]` renders every toy's sound offline in headless Chromium and checks
that it is audible, does not clip and ends within 5 s (`--sheet=out.png` draws spectrograms,
`--wav=dir` writes WAV files, `--voices` re-measures each voice's level). `tools/sound-audit.mjs`
lists the toys without their own action or sound and how often each voice is used.

## Tests

```sh
npm install
SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test
```

The Playwright suite (`tests/smoke.spec.mjs`, `tests/unit.spec.mjs`) starts
`python3 -m http.server 4173` if nothing is listening and runs headless Chromium with SwiftShader,
so it needs no GPU. It checks that the app loads with no console errors or warnings, the shelf shows
its toys, making a toy and switching on effects change canvas pixels, paint, poke and clay work, a
JSON export imports back to the same scene, the shelf filters by category and search, the phone
sheet opens and closes by button, tap and swipe, the phone shelf opens into a grid (at 390 and 360
px) and folds back when a toy is picked, the "Find your own splat" links are right, the embed page
and the custom element load a scene, own files (PLY, SPLAT, SPZ, SOG) load, PNG/GIF/WebM exports
produce files, an embed stays under 30 MB, the canvas renders at the pixel ratio of its detail tier
(on 2x and 3x screens) and drops it only while frames are slow, Detail stays out of links, a
transparent embed stays see-through in dark mode, embeds take `?zoom=` and zoom by wheel after a
click and by buttons, the embed snippet is responsive, a failed thumbnail is retried, the no-GPU
poster shows, and there is no horizontal overflow at 390 and 360 px. It saves screenshots to
`tests/screenshots/`. WebGPU checks skip themselves with a message when Chromium offers no adapter.
Set `SPLASHERY_CHROMIUM` to use a specific Chromium; without it Playwright's own browser is used.

## Layout

```
index.html, styles.css          the app
embed/index.html, embed/demo.html   the embed player and an embedding demo
src/app.js, ui.js               app wiring and panel
src/player.js                   shared runtime (clock, camera, effects, tools, toys)
src/stage.js, paint.js          PlayCanvas device, toy entity, picking, capture; GPU paint
src/effects.js                  the per-splat effect shader (GLSL and WGSL) and its uniforms
src/generators.js, noise.js     procedural toys and clay
src/loaders.js                  SOG/PLY via the engine, SPLAT/SPZ decoders, downsampling
src/camera.js                   orbit camera and gestures
src/state.js, codec.js          scene schema v3 (loads v2) and link codec
src/kit.js, packs/              the toy kit and the recipe packs
src/motion.js, patterns.js      whole-toy motion, parts and controls; the pattern layer
src/sound.js, voices.js         WebAudio output and the voice library (sound specs)
src/toy-sounds.js               every toy's own sound spec
src/rig.js, rigs.js, rig-fx.js  rigs: parts, colour keys, effects and add-ons for scans and shapes
src/font.js                     5x7 bitmap font (storybook pages, speech bubble)
src/chess.js                    chess rules, SAN and PGN (the chess set's games)
src/exports.js                  PNG, GIF, WebM, links and embed snippets
src/viewer.js, embed.js, element.js   embed player and <splashery-toy>
src/pc.js, toys.js              engine import, toy shelf
assets/toys/                    captured toys (SOG) and thumbnails
assets/flags/                   public-domain national flags (SVG) and their sources
vendor/                         PlayCanvas 2.22.3 and gifenc 1.0.3
tools/                          asset, flag and thumbnail scripts
tests/                          Playwright tests and screenshots
```

Licences for vendored code are in [LICENSES.md](LICENSES.md).
