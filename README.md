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

| Toy             | Kind                  | Notes                                                                                                                                                                                                                                                                                                                                                                                                          |
| --------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cactus          | Captured              | CC0, steam studio / 3D SCAN STUDIO iris                                                                                                                                                                                                                                                                                                                                                                        |
| Strawberry      | Captured              | CC BY 4.0, Dany Bittel                                                                                                                                                                                                                                                                                                                                                                                         |
| Heart cookie    | Captured              | CC BY 4.0, Dany Bittel                                                                                                                                                                                                                                                                                                                                                                                         |
| Honeybee        | Captured              | CC BY 4.0, YUMA Co., Ltd.                                                                                                                                                                                                                                                                                                                                                                                      |
| Jelly blob      | Generated             | Noise blob, candy palette                                                                                                                                                                                                                                                                                                                                                                                      |
| Donut           | Generated             | Torus with frosting and sprinkles                                                                                                                                                                                                                                                                                                                                                                              |
| Neon knot       | Generated             | Trefoil knot                                                                                                                                                                                                                                                                                                                                                                                                   |
| Tiny planet     | Generated             | Oceans, continents, ice caps and clouds: a tribute to Splashery v1                                                                                                                                                                                                                                                                                                                                             |
| Beating heart   | Pack (Body)           | A stylised heart that beats; or a love heart                                                                                                                                                                                                                                                                                                                                                                   |
| Campfire        | Pack (Weather & fire) | Flames that flicker, sparks and smoke; tap to stoke it                                                                                                                                                                                                                                                                                                                                                         |
| Treasure chest  | Pack (Open me)        | Tap to open the lid on glinting coins and gems                                                                                                                                                                                                                                                                                                                                                                 |
| 25 sports balls | Pack (Balls)          | Basketball, soccer ball, American football, tennis ball, baseball, softball, beach ball, golf ball, rugby ball, volleyball, water polo ball, ping-pong ball, cricket ball, bowling ball, pool ball (cue and 1 to 15), pickleball, dodgeball, medicine ball, lacrosse ball, squash ball, bouncy ball, marble, hockey puck, shuttlecock and flying disc. Seams and stitching stay put under any flag or pattern. |
| 23 space toys   | Pack (Space)          | The Sun, the eight planets (Saturn's and Uranus's rings, Jupiter's Great Red Spot), the Moon, an aurora world, a solar system that orbits, an asteroid, a comet, a meteor, a star, a pulsar, a black hole with its disc, a star cluster, a ring nebula, a nebula with its pillars, a supernova and a spiral galaxy.                                                                                            |

Captured toys are SOG files of up to 450,000 splats (about 5 MB each) with a 120,000-splat copy for
phones. Full credits are in [CREDITS.md](CREDITS.md) and in the app under **About & credits**.

**Make a toy** builds a new one in the browser: pick a shape (sphere, noise blob, torus, capsule,
knot), a palette, a seed, the number of splats (up to 300,000 on strong devices, 120,000 on phones),
size jitter, roughness and colour noise. The **Clay** tool then adds lumps where you drag, or erases
them. Everything is seeded, so a saved scene rebuilds exactly the same toy.

### Toys from packs

Most new toys are **recipes** in `src/packs/<pack>.js`, built in your browser by the toy kit
(`src/kit.js`): a small library of shapes (spheres, ellipsoids, boxes, rounded boxes, cylinders,
cones, tori, discs, surfaces of revolution, tubes along curves, parametric and radial surfaces, and
free point clouds) that shares the splat budget by surface area so the whole toy has an even
density. A pack only downloads when one of its toys is picked. Recipes can give a toy:

- **behaviours** that run on the GPU per splat: orbit, beat, breathe, flame, rise, fall, twinkle,
  sway, grow, melt, a glow that pulses along a path, wave and glint;
- **parts** (up to 15 rigid groups) that hinge, spin or slide, driven by the recipe each frame;
- **controls** (sliders, switches, one-shot pulses) and an **action** that a tap on the toy runs
  (open the lid, stoke the fire);
- **options** that rebuild the toy (a style, a colour).

Clay works on pack toys too.

## Motion, patterns and sound

- **Move** (Play tab, any toy): still, bounce (with squash and stretch), spin, wobble or float, with
  a speed slider. Tapping a toy with the Orbit tool runs its action, or makes it hop.
- **Pattern** (Look tab, any toy, captured ones included): stripes, bands, polka dots, checks,
  stars, hearts, zigzag, gradient, rainbow, marble, or a **national flag** (196 public-domain flags
  from Wikimedia Commons). It wraps around the toy, across its front, or like a globe, keeps as much
  of the toy's own shading as you like, and leaves details such as flames or coins alone. The status
  line says "in the colours of …".
- **Sound** (the speaker button): soft synthesised sounds for pokes, paint, clay, drops, hops and
  actions. Off until you turn it on; embeds are always silent.
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
for a random toy. Below the tools, five tabs hold everything else: **Play** (the tool's settings and
the effects), **Make** (make a toy, or open your own splat file), **Look**, **Share** and **About**.
On a phone the panel is a bottom sheet. The shelf and tools always show; **More**, a tab, or swiping
the handle up opens the rest. The toy shrinks to fit above the sheet so you can watch your changes.
Tap the toy, swipe down, press **Done** or Escape to close it again.

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
lighter random subset instead. **Turn it upside down** fixes captures that load flipped.

## Look and autoplay

Background (page colour, transparent or any colour), theme (auto, light or dark; auto follows the
page), accent colour, splat size and exposure. When idle the toy can turn slowly and play one gentle
effect: a breeze, little pokes, a slow twist, or dissolve and rebuild.

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
  width="400"
  height="300"
  title="Splashery toy"
  loading="lazy"
  style="border:0;border-radius:12px;max-width:100%"
></iframe>
```

The embed player (`embed/index.html`) has no editing UI: it turns slowly when idle (not under
reduced motion), you can orbit it, it can autoplay one gentle effect, and it links back with **Open
in Splashery**. Query options: `?toy=cactus` (a shelf toy, when there is no `#s=`),
`?theme=light|dark`, `?bg=transparent`, `?autoplay=breeze|pokes|twist|dissolve`, `?turntable=off`.
For a transparent iframe, also give the iframe `color-scheme: normal` (the snippet does) so browsers
keep it see-through in dark mode. A host page can switch the theme with
`iframe.contentWindow.postMessage({ type: "splashery:theme", theme: "dark" }, "*")`. Inside an embed
the mouse wheel scrolls the page; hold Ctrl or ⌘ (or pinch) to zoom.

The `<splashery-toy>` element embeds a toy without an iframe, with one script tag:

```html
<script type="module" src="https://ryanjosephkamp.github.io/splashery/src/element.js"></script>
<splashery-toy toy="cactus" autoplay="breeze"></splashery-toy>
```

Attributes: `scene` (a share payload), `toy`, `theme` (`auto`, `light`, `dark`; auto follows the
page, including a `paper-theme-change` event on `document` and `data-resolved-theme` on `<html>`),
`background` (`transparent`, `page` or a colour), `autoplay`, `turntable="off"` and `label`. It is
4:3 unless you size it, starts when scrolled into view and pauses when scrolled away. See
[embed/demo.html](embed/demo.html) for both side by side.

Built-in toys load in well under 30 MB (an embed with the heaviest captured toy transfers about 8
MB: the engine plus one SOG).

## Running locally

```sh
python3 -m http.server 4173 --bind 127.0.0.1
# open http://127.0.0.1:4173/
```

Any static server works. Useful query options: `?renderer=webgl2|webgpu` (force a renderer),
`?profile=weak|strong` (force the device profile).

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
sheet opens and closes by button, tap and swipe, the embed page and the custom element load a scene,
own files (PLY, SPLAT, SPZ, SOG) load, PNG/GIF/WebM exports produce files, an embed stays under 30
MB, the no-GPU poster shows, and there is no horizontal overflow at 390 and 360 px. It saves
screenshots to `tests/screenshots/`. WebGPU checks skip themselves with a message when Chromium
offers no adapter. Set `SPLASHERY_CHROMIUM` to use a specific Chromium; without it Playwright's own
browser is used.

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
src/sound.js                    WebAudio sound effects
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
