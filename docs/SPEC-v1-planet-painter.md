# Splashery v1 specification

Splashery is a pure-browser 3D paint toy: a high-resolution sphere the visitor can orbit, zoom into without limit, and paint on. Paint lands with a splash, runs downhill under world gravity, and dries into a permanent layer over a procedural planet template. Scenes export as JSON (re-importable), GIF and WebM (one full turn), and an iframe embed snippet. Hosted at https://ryanjosephkamp.github.io/splashery/ from the `main` branch of github.com/ryanjosephkamp/splashery. Tagline: "paint a planet".

No build step, no bundler, no framework, no server. Static files and ES modules only.

## Decisions (final, do not re-ask)

- Physics: wet paint that runs + splash on impact. Spin inertia and wet-color mixing are stretch goals only after everything below is complete and tested.
- Shape: sphere only. Structure the geometry/UV code so a torus and a rounded cube can be added later without rewriting the paint system.
- Templates: procedural only, seeded. At least: Rocky (noise + craters), Icy, Gas giant (bands + turbulence), Plain (single color). No image assets.
- Exports: JSON, GIF, WebM. Import: JSON (file picker and drag-and-drop).
- Embed: iframe snippet pointing at /splashery/embed/#s=<compressed scene>. A self-contained single-file HTML export is optional, only if cheap.
- Stack: Three.js pinned and vendored under vendor/three/, gifenc pinned and vendored under vendor/gifenc/, loaded through an import map. Third-party notices in LICENSES.md.

## Functional requirements

1. Scene. One sphere (UV sphere, at least 128 x 256 segments) with a physically based material: template as base color, dry paint composited over it, wet paint on top with a clearcoat/gloss so it reads as wet. Image-based lighting from a small generated environment (gradient sky through PMREM is fine), one soft key light, ACES tone mapping, sRGB output, device pixel ratio honored up to 2.
2. Camera. Orbit by drag or one finger. Zoom by wheel or pinch. Minimum distance just above the surface; no maximum. Damped motion. Double-click or double-tap resets the camera. Idle auto-rotate (slow) that pauses on interaction and is off under prefers-reduced-motion.
3. Modes. Paint mode and Orbit mode, switchable in the UI and with a keyboard shortcut. In Paint mode the primary pointer paints; holding Space (desktop) or using two fingers (touch) orbits without leaving Paint mode.
4. Painting. Pointer down and move stamps a brush into the paint system via raycast to UV. Brush controls: size, color, wetness (0 to 1), opacity. Paint textures 2048 x 2048 by default with a 4096 option and an automatic 1024 fallback on weak devices. Stamps must be seam-safe at the sphere's UV seam and pole-safe (no visible pinching at the poles is acceptable to leave as a known issue, but the seam must not show).
5. Wet layer simulation on the GPU with ping-pong render targets. Each frame: wet paint advects along the surface-tangent projection of world gravity (world -Y, so turning the ball changes where drips go), slowed by viscosity, with slight diffusion, and transfers into the dry layer at a drying rate (default full dry in about 4 seconds, adjustable). Drips must visibly run, thin, and stop. Simulation resolution equals the paint texture resolution.
6. Splash. On pointer down and whenever pointer speed crosses a threshold, spawn 8 to 40 droplets around the contact point, sizes and spread scaled by speed, stamped into the wet layer at random tangent-plane offsets.
7. Templates. Generated at load from a seed (canvas 2D or a GPU pass) into the base color texture, with optional roughness variation. Picker in the UI plus a Randomize button that draws a new seed. The seed and template name are part of the scene.
8. Undo and clear. At least 20 undo steps (texture snapshots or stroke-log replay), Clear paint, Reset camera.
9. JSON export and import. One file: { version, createdAt, template: { name, seed }, camera, lighting, brushDefaults, strokes: [ events with time, uv, size, color, wetness, opacity, splash flag ], snapshotPNG: data URI of the dry layer }. Import replays strokes when present (fast-forwarded, not real time), otherwise loads the snapshot. Import via file picker and drag-and-drop anywhere on the page.
10. GIF export. Render N frames (default 48) of one full rotation about the vertical axis at a chosen size (default 512 x 512) off-screen, encode in the browser with gifenc, and download. Show progress. Freeze the simulation during capture so every frame is consistent.
11. WebM export. The same rotation captured with MediaRecorder from canvas.captureStream, default 3 seconds, downloaded as .webm. If MediaRecorder is unavailable, hide the option and say why.
12. Embed. embed/index.html is a minimal player: no painting UI, slow auto-rotate (off under reduced motion), orbit allowed, a small "Open in Splashery" link. It loads the scene from the URL hash: #s= plus base64url of the deflate-compressed JSON (CompressionStream when available; fall back to uncompressed base64url with a flag). The main app's Export panel shows the iframe snippet with a Copy button. If the compressed hash would exceed about 8 KB, embed only the snapshot and settings (drop the stroke log) and tell the user; if still too large, say the JSON file is the way to share it.
13. Accessibility. All controls keyboard reachable with visible focus, labeled for screen readers, contrast at least 4.5:1, no page-level horizontal overflow at 360 px width, reduced-motion respected everywhere.
14. Theme. Light and dark following prefers-color-scheme, with tokens that match the personal site (page #ffffff / #101010, ink #111111 / #f2f2f2, accent #0b4f9c / #b8ccff, system sans-serif). Minimal, paper-like chrome that stays out of the way of the canvas; on phones the controls collapse into a bottom sheet or drawer.
15. Performance. 60 fps at 1080p with a 2048 paint system on a 2020-era laptop; degrade to 1024 automatically on weak GPUs and most phones. No dropped frames when opening panels. Textures and render targets are disposed when resolution changes.
16. WebGL2 is required. Without it, show a friendly message and a static poster image instead of a blank canvas.

## Repository layout

index.html, embed/index.html, styles.css, src/ (app.js, scene.js, paint.js, splash.js, templates.js, export.js, embed.js, ui.js, state.js), vendor/three/, vendor/gifenc/, tests/smoke.spec.mjs, playwright.config.mjs, package.json (devDependencies only: @playwright/test, prettier), README.md, SPEC.md, LICENSES.md, .gitignore.

## Quality bar

- Prettier-formatted. No console errors or warnings at load in Chromium.
- Playwright smoke test: the app loads with no console errors; a painted stroke changes canvas pixels; JSON export then import round-trips the scene; the embed page loads a scene from the hash; the page has no horizontal overflow at 390 px. Screenshots at 390 x 844 and 1440 x 900 saved under tests/screenshots. In headless Chromium use SwiftShader flags (--use-angle=swiftshader, --enable-unsafe-swiftshader); if WebGL2 is still unavailable in the sandbox, the test must skip the rendering assertions with a clear message rather than fail.
- Launch Chromium through an executablePath env var (SPLASHERY_CHROMIUM) so the config works both in the cloud sandbox (/opt/pw-browsers/chromium) and on a normal machine. Never run playwright install in the sandbox.
- README covers: what it is, controls, exports, the embed snippet, running locally (python3 -m http.server), running tests.

## Definition of done

Everything above implemented, the smoke test passing (or skipping only the WebGL assertions with a stated reason), the site pushed on a branch with a draft PR whose description has Summary, Verification (test output, screenshots), Known issues, and What was cut, and the Pages URL verified once main carries the site. Do not merge. Anything that genuinely cannot be done in the browser is named in the handoff, not silently dropped.

## Explicitly later (not v1)

Torus and rounded cube, real NASA maps with licensing notes, spin inertia with centrifugal smear, wet-color mixing, surface deformation, custom GLB import, polish on the self-contained HTML export, and embedding Ryan's chosen scene into ryanjosephkamp.github.io (the #splashery-slot placeholder in that repo's index.html), which is a separate PR on that repo.
