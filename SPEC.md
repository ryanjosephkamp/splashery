# Splashery v2 specification: splat toys

Splashery is a pure-browser toy built on 3D Gaussian splats. A visitor picks a small object made of splats (a real captured thing, or one generated in the browser), spins it, pokes it, blows on it, splashes paint on it, drops it, watches it fall apart and reassemble, personalizes it, and shares it as a link, an embed, a GIF or a video. Hosted at https://ryanjosephkamp.github.io/splashery/ from the `main` branch of github.com/ryanjosephkamp/splashery. Tagline: "splats you can play with" (the implementer may propose a better one).

v1 was a painted planet; it is preserved on branch `checkpoint/v1-planet-painter` and in `docs/SPEC-v1-planet-painter.md`. v2 replaces the app at the repository root but keeps its conventions: static files and ES modules only, no build step, no bundler, no framework, no server, no paid API, no API keys.

## Decisions (final unless a stated gate says otherwise)

- Runtime: the PlayCanvas engine (MIT), `playcanvas` 2.22.x pinned and vendored from the npm package's single-file ESM build (`build/playcanvas.mjs` or `build/playcanvas.min.mjs`) under `vendor/playcanvas/`, loaded through an import map. The hosted PlayCanvas Editor and PlayCanvas hosting are not used. Gate: if the spike (below) shows the engine cannot do per-splat GPU effects at the required frame rate, switch to three.js + `@sparkjsdev/spark` (MIT) and record the reason in the PR.
- Toys are objects the camera orbits, not environments the visitor walks through.
- Content is free and redistributable: captured splats under CC0 or CC BY (with attribution), plus procedural toys generated in the browser. Nothing requires photos from the owner. No paid generation services.
- Personalization, sharing and embedding keep the v1 shape: JSON scene files, a compressed URL hash, an iframe snippet, GIF and WebM exports, an `embed/` player.
- Discretion: the implementer may change tactics (effect list, UI layout, formats, helper libraries, the exact procedural generators) when something does not work or a better approach appears, as long as the product above still holds. Every such change is listed in the PR under "Deviations from the spec" with the reason.

## Functional requirements

1. Toy shelf. A gallery of 6 to 10 built-in toys with thumbnails: at least 3 captured splat objects (converted to SOG, each 25 MB or less) and at least 3 procedural toys (for example a noise blob, a knot or torus, a tribute planet). Selecting a toy loads it in under 3 seconds on a laptop with a fast connection; a progress indicator shows while it streams.
2. Make a toy. Procedural generators that produce a splat object in the browser (a procedural gsplat resource): base shape (sphere, torus, capsule, noise blob), splat count by device profile (up to 300k on strong devices, up to 120k on weak ones), size jitter, surface roughness, seeded palette and color noise. A "clay" mode adds or erases splat blobs where the pointer touches the surface. Everything is seeded and reproducible from the saved JSON.
3. Play. Per-splat effects computed on the GPU every frame (PlayCanvas `GSplatComponent.setWorkBufferModifier`, or Spark `dyno` after the gate), no per-splat CPU loops. Required set: poke (an impulse that ripples out from the touch point and settles), wind (noise-driven sway with strength and direction), dissolve and reassemble (splats fly apart and return to their home positions), drop (splats fall under gravity and bounce on an invisible ground plane; shaking the toy resets it), magnet (the pointer attracts or scatters nearby splats), twist (a warp deformer along an axis), slice (a sweeping clipping plane that reveals the inside), and paint (a brush recolors splats where it touches, with a splash of droplets on impact, persistent until cleared). Each effect has one or two sliders; compatible effects can be stacked; all effects are deterministic given the seed and time except for pointer input.
4. Camera. Orbit by drag or one finger, zoom by wheel or pinch with sensible limits around the object, two-finger twist rolls, damped motion, double-click or double-tap resets, slow idle turntable that pauses on interaction and is off under `prefers-reduced-motion`. Gravity for drop and paint is screen-down.
5. Bring your own. Drop a splat file anywhere on the page or pick it with a file input: PLY and SOG at minimum (native loaders); SPZ, SPLAT and KSPLAT if `@playcanvas/splat-transform`'s browser API or an equivalent makes conversion practical, otherwise the UI states which formats load. Files stay in the browser; nothing is uploaded anywhere. Files over a size limit get a warning and a downsample option if feasible.
6. Personalize. Look settings (background or transparent, theme light or dark following the page, accent color, splat size scale, exposure), the effect stack with its parameters, camera pose, and an autoplay idle behavior. All of it lives in one JSON document (schema version 2) with a stable, documented shape.
7. Share. Export JSON (re-importable via file input and drag-and-drop), export GIF (a turntable or a short effect loop, default 48 frames at 512 px, encoded in the browser with vendored gifenc), export WebM (MediaRecorder from the canvas, hidden with a reason if unavailable), export PNG of the current view, and an embed snippet with a Copy button. Sharing links use `#s=` with deflate-compressed base64url JSON as in v1; when a toy is a user file, the link carries the settings only and says so.
8. Embed. `embed/index.html` is a minimal player: no editing UI, idle turntable (off under reduced motion), orbit allowed, optional autoplay of one gentle effect, an "Open in Splashery" link, a `?theme=light|dark` override, and a transparent background option so it sits on the personal site. It must look good at 400 by 300 pixels and stay under 30 MB of total transfer for built-in toys. In addition to the iframe snippet, provide a `<splashery-toy>` custom element (one script tag plus one element) for embedding without an iframe; document both.
9. Accessibility and theme. All controls keyboard reachable with visible focus and labels, contrast at least 4.5:1, no horizontal overflow at 360 px, reduced motion respected, light and dark themes with the personal site's tokens (page #ffffff / #101010, ink #111111 / #f2f2f2, accent #0b4f9c / #b8ccff, system sans-serif). Paper-like chrome that stays out of the way; a bottom sheet on phones.
10. Rendering and performance. WebGPU when available, WebGL2 otherwise, both tested. 60 fps at 1080p on a 2020-era laptop with toys up to 500k splats; 30 fps on a recent phone with the weak profile; LOD or splat budgets where the engine offers them. GPU resources are disposed when toys change. Without WebGL2 or WebGPU, show a friendly message and a static poster (inline SVG, no image assets).
11. Assets and credits. Built-in captured toys are prepared with the `@playcanvas/splat-transform` CLI (documented commands or a script under `tools/`), stored under `assets/toys/<name>/`, and every asset's source URL, author and license is recorded in `CREDITS.md`. CC0 preferred; CC BY accepted with attribution shown in the app's credits panel; nothing with a stricter license. GitHub Pages does not serve Git LFS, so assets are plain files kept small.
12. Optional, time-boxed to 2 hours: "toy from a photo" through a free, public Hugging Face Space that turns a single image into 3D Gaussians (for example TRELLIS). Ship it only if it works reliably from the browser without a key; otherwise cut it and explain in the PR.

## Build sequence

1. Spike (2 hours at most): vendored PlayCanvas through an import map, one SOG toy loading from `assets/`, orbit camera, one work-buffer-modifier effect (poke or dissolve), verified in headless Chromium with SwiftShader and, if the sandbox allows it, with WebGPU flags. Apply the runtime gate here.
2. Core: toy shelf, procedural generators, the full effect set, camera, look settings, bring-your-own files.
3. Sharing: JSON, hash, embed player, custom element, GIF, WebM, PNG.
4. Polish: accessibility pass, phone layout, credits, README, tests, screenshots, PR.

## Repository layout (suggested, not binding)

index.html, embed/index.html, styles.css, src/ (app.js, scene.js, toys.js, generators.js, effects.js, effects/*.glsl or inline shader chunks, camera.js, loaders.js, exports.js, codec.js, ui.js, state.js, element.js, embed.js), assets/toys/, vendor/playcanvas/, vendor/gifenc/, tools/, tests/smoke.spec.mjs, tests/screenshots/, playwright.config.mjs, package.json (devDependencies only), README.md, SPEC.md, LICENSES.md, CREDITS.md, docs/.

## Quality bar

- Prettier-formatted. No console errors or warnings at load in Chromium.
- Playwright smoke test through `SPLASHERY_CHROMIUM` with SwiftShader flags: the app loads with no console errors; the shelf shows toys; generating a procedural toy changes canvas pixels; toggling an effect changes canvas pixels; JSON export then import round-trips the scene; the embed page loads a scene from the hash; no horizontal overflow at 390 px and 360 px; screenshots at 390 by 844 and 1440 by 900 saved under `tests/screenshots/`. Assertions that need WebGPU are skipped with a clear message when it is unavailable; WebGL2 assertions are not skipped in the sandbox, where SwiftShader provides WebGL2.
- README covers what it is, the toys and effects, controls, bring-your-own formats, exports, the embed snippet and the custom element, running locally (`python3 -m http.server`), preparing assets, and running tests.

## Definition of done

Everything above implemented or explicitly listed under "Deviations from the spec" or "What was cut" in the PR; the smoke test passing; the site pushed on a branch with a draft PR whose description has Summary, Verification (test output, screenshots), Deviations from the spec, Known issues, and What was cut; the Pages URL verified once main carries the site. Do not merge. Anything that genuinely cannot be done in the browser without a server or a key is named, not silently dropped.

## Explicitly later (not v2)

Rigid-body physics (throwing objects at toys, toys as colliders), soft-body or MPM deformation, multi-toy scenes, generated worlds from paid APIs, user accounts or cloud saves, and embedding the chosen toy into ryanjosephkamp.github.io (the `#splashery-slot` placeholder in that repo's index.html), which is a separate PR on that repo.
