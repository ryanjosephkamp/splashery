# Splashery

**paint a planet** — a pure-browser 3D paint toy.

Splashery puts a high-resolution planet in front of you. Orbit it, zoom in as far as you like, and
paint on it. Paint lands with a splash, runs downhill under gravity, and dries into a permanent
layer over a procedural planet template. Scenes export as JSON (re-importable), as a looping GIF or
a WebM clip of one full turn, and as an iframe embed.

Live: https://ryanjosephkamp.github.io/splashery/

There is no build step, bundler, framework or server. It is static files and ES modules; Three.js
and gifenc are vendored under `vendor/` and loaded through an import map. WebGL2 is required.

## Controls

| Action                 | Mouse / keyboard                      | Touch                                          |
| ---------------------- | ------------------------------------- | ---------------------------------------------- |
| Paint                  | Drag in Paint mode                    | One finger in Paint mode                       |
| Orbit                  | Drag in Orbit mode, or hold **Space** | One finger in Orbit mode, two fingers anywhere |
| Zoom (no maximum)      | Wheel, trackpad pinch, **+** / **−**  | Pinch                                          |
| Reset camera           | Double-click in Orbit mode, **R**     | Double-tap in Orbit mode                       |
| Switch mode            | **P** paint, **O** orbit              | Toolbar buttons                                |
| Undo                   | **Z** or Ctrl/Cmd+Z                   | Toolbar button                                 |
| Brush size             | **[** and **]**                       | Slider                                         |
| Turn from the keyboard | Arrow keys                            |                                                |

Dragging the planet turns the ball itself in front of a fixed camera, so "down" is always the bottom
of your screen and turning the planet changes where wet paint runs. The planet auto-rotates slowly
when idle; that stops while you interact and is off entirely under `prefers-reduced-motion`.

### Brush and paint

- **Size, color, wetness, opacity.** Wetness is how much of the stroke sits on top as a loose wet
  film that can run; opacity is the coverage of the stroke itself.
- **Dry time** (default 4 s) is how long a full-thickness film takes to dry completely.
  **Viscosity** slows the flow.
- **Splashes**: a burst of 8 to 40 droplets on pointer down and on fast flicks.
- **Undo** keeps up to 60 steps (bounded by memory), **Clear paint** empties both layers, **Reset
  camera** returns to the home view.

### Planets

Four procedural, seeded templates: **Rocky** (noise and craters), **Icy** (cracks and frost), **Gas
giant** (bands, turbulence and a storm) and **Plain**. **Randomize** draws a new seed; the template
name and seed are part of every saved scene, so a scene always reproduces its planet.

### Paint texture resolution

The paint layers default to 2048 × 2048, with 4096 available for strong GPUs and an automatic 1024
profile on phones, small GPUs and software renderers. Changing resolution resamples the current
painting and disposes the old render targets.

## Exports

All exports happen in the browser and download directly.

- **JSON** — the whole scene: template name and seed, camera, lighting, brush defaults, physics, the
  stroke log and a PNG snapshot of the dry layer. Load it back with **Load JSON** or by dropping the
  file anywhere on the page. When a stroke log is present, import replays it (fast-forwarded);
  otherwise the snapshot is loaded.
- **GIF** — one full turn of the planet, 24 to 72 frames at 256 to 768 px, encoded with gifenc. The
  simulation is frozen during capture so every frame is consistent.
- **WebM** — the same turn recorded with `MediaRecorder` from `canvas.captureStream`, 2 to 5 seconds
  at 512 px. If the browser cannot record WebM, the option is hidden and the reason is shown.
- **Embed** — an iframe snippet (see below).

### Scene JSON format

```json
{
  "version": 1,
  "createdAt": "2026-09-22T12:00:00.000Z",
  "template": { "name": "rocky", "seed": 3296183301 },
  "camera": { "rotation": [0, 0, 0, 1], "distance": 4.2 },
  "lighting": {
    "exposure": 0.95,
    "keyIntensity": 2.6,
    "keyAzimuth": -0.7,
    "keyElevation": 0.55,
    "envIntensity": 0.55
  },
  "brushDefaults": { "size": 0.05, "color": "#e63b2e", "wetness": 0.8, "opacity": 1 },
  "physics": { "dryTime": 4, "viscosity": 0.35 },
  "strokes": [
    {
      "size": 0.05,
      "color": "#e63b2e",
      "wetness": 0.8,
      "opacity": 1,
      "g": [0, -1, 0],
      "points": [
        [3042, 0.1254, 0.5556, 1],
        [3102, 0.1378, 0.5418, 0]
      ]
    }
  ],
  "snapshotPNG": "data:image/png;base64,..."
}
```

Each stroke carries its brush settings and the gravity direction in planet space at the time (`g`),
followed by pointer events as `[timeMs, u, v, splashFlag]`. Brush size is the geodesic radius in
radians on the unit sphere.

## Embedding a scene

Open **Export & share → Make snippet**. The snippet points the embed player at the scene through the
URL hash:

```html
<iframe
  src="https://ryanjosephkamp.github.io/splashery/embed/#s=d.…"
  width="480"
  height="360"
  title="Splashery scene"
  loading="lazy"
  style="border:0;border-radius:12px;max-width:100%"
></iframe>
```

The hash is `s=` plus base64url of the deflate-compressed scene JSON (prefix `d.`); when
`CompressionStream` is unavailable the JSON is base64url-encoded uncompressed with the prefix `j.`.
The embed carries the stroke log when it fits in about 8 KB, otherwise a 512, 384 or 256 px snapshot
of the dry paint with the settings; if even that is too large, the panel says so and the JSON file
is the way to share the scene. The embed player has no painting UI, orbits, auto-rotates slowly (not
under reduced motion) and links back to the app, which also accepts `#s=` and imports the scene. An
optional `?theme=light|dark` query on the embed URL is reserved for hosts that want to force a
theme.

## Running locally

Any static file server works. From the repository root:

```sh
python3 -m http.server 4173
```

Then open http://127.0.0.1:4173/ (the embed player is at http://127.0.0.1:4173/embed/).

## Running the tests

The smoke test uses Playwright and headless Chromium with SwiftShader so WebGL2 works without a GPU.

```sh
npm install
npm test
```

To use a Chromium you already have instead of Playwright's download, point `SPLASHERY_CHROMIUM` at
its executable (the cloud sandbox preinstalls one at `/opt/pw-browsers/chromium`):

```sh
SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npm test
```

The test checks that the app loads with no console errors, that a painted stroke changes canvas
pixels, that JSON export then import round-trips the scene, that the embed page loads a scene from
its hash, and that there is no horizontal overflow at 390 px. It also saves screenshots at 390 × 844
and 1440 × 900 under `tests/screenshots/`. If WebGL2 cannot be created in the browser at all, the
rendering assertions are skipped with a message rather than failing.

Formatting: `npm run format:check` (Prettier).

## Repository layout

```
index.html            main app shell
embed/index.html      embed player shell
styles.css            shared styles (light/dark tokens, bottom sheet on phones)
src/app.js            app wiring and frame loop
src/scene.js          renderer, camera, lights, environment, planet material
src/shape.js          paintable shape interface (sphere; torus/cube can be added)
src/paint.js          GPU paint system: stamps, wet simulation, snapshots, undo
src/splash.js         droplet generation
src/templates.js      seeded procedural planets (GPU pass)
src/controls.js       ball orbit controls and gesture recognizer
src/export.js         PNG, JSON, GIF, WebM, embed snippet
src/codec.js          scene <-> URL hash
src/ui.js             panel wiring
src/state.js          scene model, defaults, validation
src/embed.js          embed player entry
vendor/               three.js and gifenc (see LICENSES.md)
tests/smoke.spec.mjs  Playwright smoke test
SPEC.md               the v1 specification
```

## Known limitations

- Slight pinching of stamps at the two poles is expected for a UV sphere (the seam itself is
  handled). See SPEC.md for the full list of what is deliberately left for later.
- Replaying a long stroke log on import runs the simulation fast-forwarded and takes a few seconds
  on slow GPUs.
