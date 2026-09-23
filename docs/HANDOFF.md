# Handoff

The current state and the next phase. The session that finishes a phase updates this file. The
ground rules are in [CLAUDE.md](../CLAUDE.md).

## Current state (2026-09-23)

- v3 has shipped. PRs #4–#11 are merged into `main` (at `e85dc1f`). The shelf has **283 toys**:
  - 4 generated shapes.
  - 248 recipe toys in 18 packs (`src/packs/*.js`).
  - 31 captured toys: 16 scans and 15 CC0 Poly Haven models turned into splats.
  - Kit toys carry motion, parts, actions, options, patterns and flags.
  - Scene schema is v3 (v2 still loads).
- Tools:
  - `tools/check-packs.mjs`: builds and timing.
  - `tools/contact-sheet.mjs`: review sheet.
  - `tools/make-thumbs.mjs`: thumbnails, by pack or id.
  - `tools/prepare-assets.mjs`: SOG packing.
  - `tools/mesh-to-splats.mjs`: glTF to PLY.
  - `tools/fetch-flags.mjs`: flags.
- All 38 Playwright tests pass on `main`.
- The owner added `HF_TOKEN` to the cloud environment on 2026-09-23, after the previous session
  started, so no session has seen it yet. Check it (without printing it) before Phase D. If it is
  missing or rejected, tell the owner exactly what to change: the cloud environment menu in the
  session's title bar, then Edit, then an environment variable named `HF_TOKEN`.
- These helpers were used in past sessions but are not in the repo. Rewrite them if needed:
  - A pack screenshot script: a Playwright page opens the app, clicks `.chip[data-category=…]` then
    `.toy-card[data-toy=…]`, waits until `#toy-status` starts with the toy's label, and takes the
    screenshot.
  - The embed transparency harness (see Phase A, item 6).

Known issues carried forward:

- Storybook: a faint red strip on the left page when open.
- The sports car is a little small in its frame.
- The tractor's exhaust smoke is heavy.
- Flags on vehicles were never checked (windows and lights should stay unpainted).
- Splats are depth-sorted in their built pose, so large moving parts can draw out of order.
- Only 3 music toys exist.

## Phases

Each phase is one session and one PR, or a small stack of PRs.

| Phase | What                                                                                                                                                                             | Repo(s)                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **A** | Sharpness (pixel density, splat counts, kit splat size, Detail setting) and embeds (transparency, framing, size, zoom); honeybee flip; thumbnail retry. Then the homepage embed. | splashery, then ryanjosephkamp.github.io |
| B     | Mobile shelf grid (drag the shelf up into a full grid) and a "Find your own splat" help panel.                                                                                   | splashery                                |
| C     | More music toys (piano, trumpet, violin, maracas, harp, and others) plus the polish items above.                                                                                 | splashery                                |
| D     | AI image-to-3D trial with `HF_TOKEN`.                                                                                                                                            | splashery                                |
| E     | Later: the gallery (plan in ROADMAP), multi-toy scenes, a liquid pour, the draw-order fix, more scans.                                                                           | splashery                                |

## Phase A in detail: sharpness and embeds

The owner finds the toys blurry, and the embeds blurrier still, on both phone and computer. The
previous session measured the causes:

1. **Pixel density cap. This is the main cause.**
   - `src/stage.js:58` sets `device.maxPixelRatio = Math.min(devicePixelRatio, weak ? 1 : 1.5)`.
     Phones have a pixel ratio of about 3 and count as weak, so they render at a third of the linear
     resolution.
   - Verified: on a 2× screen, a 400 px embed has a 400 px canvas.
   - Fix: render at the full pixel ratio up to a cap. Start at 2 on phones and 2 on desktop, and try
     3 on strong phones.
   - Add adaptive resolution. While the toy is dragged or animating, drop the ratio if frames take
     more than about 24 ms. Once it is still, redraw one frame at full ratio. `autoRender` is off
     and frames come from `requestRender`, so a still frame is cheap.
   - Keep the fixed-size capture path in `stage.js:141–156` working (PNG, GIF and WebM export).
2. **Device profile.**
   - `detectProfile()` in `src/player.js:31` calls every phone weak (`coarse && small`), as well as
     any device reporting 4 GB of memory or less, or 4 cores or fewer.
   - Weak means 60k splats for generated and kit toys (`PROFILES` in `src/generators.js:70`) instead
     of 160k, and the "lite" scans (`urlWeak`, `src/player.js:174`).
   - Replace this with tiers:
     - low: 2 GB of memory or less, or measured slow.
     - mid: most phones, around 140k splats, full scan files.
     - high: desktop, around 200k.
   - Measure the first few frames and step down if they are slow.
   - Keep the `?profile=` override and extend it with the new tier names.
   - Update the unit test "weak devices get at most 120k generated splats" to the new tiers, but
     keep its intent: the low tier stays bounded.
3. **Kit splat size.** `src/kit.js:732` sets `baseSize = sqrt(area / (count·π)) · 1.35`. With more
   splats this shrinks automatically. Also try a smaller overlap factor and flatter discs (thin
   along the surface normal), and check that no holes appear.
4. **Compare before and after.** Crop the same toys (basketball, animal cell, Taj Mahal, sunflower,
   diamond, the raspberry scan) at 390×844 with `deviceScaleFactor: 3` and at 1440×900 with
   `deviceScaleFactor: 2`. Put the pairs in the PR. SwiftShader is slow, so judge sharpness by
   pixels, not frame rate.
5. **Detail setting.** Add "Detail: Auto / High / Max" in the Look pane. It is a per-viewer
   preference kept in `localStorage`, not in scene links, so a shared link never forces a heavy
   load. Wrap storage access in try/catch.
6. **Embed transparency. The fix is known and was verified.**
   - `src/embed.js` sets `root.style.colorScheme = "normal"` for `?bg=transparent`. But `normal` on
     the root defers to `<meta name="color-scheme" content="light dark">`. In dark mode the embedded
     page is therefore dark while the iframe element is light, and the browser paints an opaque
     backdrop behind it. That is the black box the owner saw.
   - Fix: inside that `if`, add
     `document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", "normal");`.
   - Tested on a red host page with an `<iframe style="color-scheme:normal">`: in dark mode the box
     went from near-black to transparent, with both WebGL2 and WebGPU.
   - Add a Playwright test with a coloured host page, `colorScheme: "dark"`, and a sampled pixel
     inside the iframe's empty area.
7. **Embed framing.** The camera starts at 5× the toy's radius (`DEFAULT_CAMERA`,
   `src/camera.js:11`), so the toy fills about half the box. In embeds, fit the toy to about 80% of
   the shorter side for the frame's aspect ratio. Add a `?zoom=` parameter (0.5–2) and a `zoom`
   attribute on `<splashery-toy>`.
8. **Embed size.** `iframeSnippet()` in `src/exports.js:158` is fixed at 400×300.
   - Make the default snippet responsive:
     `style="width:100%;max-width:600px;aspect-ratio:4/3;border:0"`.
   - Add a size picker in Share (Small, Medium, Large, Full width).
   - Make sure the viewer re-renders on resize (use a ResizeObserver).
9. **Embed zoom.** Pinch already works. The mouse wheel only zooms with Ctrl or Cmd held
   (`src/viewer.js`, `onWheel`), so the page still scrolls normally.
   - After a click or tap, plain wheel should zoom until the pointer leaves.
   - Show a one-time hint: "Pinch or Ctrl+scroll to zoom".
   - Add small +/− buttons in a corner, hidden with `?controls=0`.
10. **Honeybee upside down.**
    - In `tools/assets.json` the bee has `rotate: [0, 0, 0]`; the other SuperSplat scans use
      `[180, 0, 0]`. Flip it with `[180, 0, 0]` or `[0, 0, 180]`, whichever keeps it facing the
      camera.
    - The crop runs after the rotation and is symmetric in y, so it still holds.
    - Run `node tools/prepare-assets.mjs bee` and `node tools/make-thumbs.mjs bee`, then check the
      result.
11. **Thumbnail retry.** Shelf thumbnails are lazy `<img>` tags (`src/ui.js:178`). The owner once
    saw Lotus without its image. Retry once on error with a cache-busting query, then show a neutral
    fallback tile.
12. **Tests and docs.**
    - Add tests: canvas backing size matches CSS size × expected ratio (contexts with
      `deviceScaleFactor` 2 and 3), the dark-mode transparent embed, the `zoom` parameter, and the
      snippet shape.
    - Keep every existing test and the embed ≤ 30 MB test.
    - Update README for the Detail setting and embed options, and SCENE-SCHEMA only if the schema
      changes (avoid that).

**A2: homepage embed** (repo `ryanjosephkamp/ryanjosephkamp.github.io`, after A1 merges):

- On `main`, `index.html` has an "Under construction" `.embed-slot` (`#splashery-slot`).
- An earlier donut iframe exists only on the unmerged branch `codex/homepage-splashery-embed`, made
  by another tool. Leave that branch alone.
- Open a PR that puts the new responsive, transparent snippet in the slot, keeping the site's
  styles. Run that repo's own tests (`tests/web-qa`).
- Ask the owner which toy or scene to embed. The donut is the default.

**Done when:** the before and after crops show a clearly sharper result on phone and desktop, a
transparent embed stays transparent in dark mode, embeds fill their box and can zoom, the bee is
upright, all tests pass, and prettier is clean.

## Phases B–E (outline)

- **B, mobile shelf grid.**
  - On phones, dragging the sheet handle or shelf up turns the horizontal row into a vertical grid
    of about 4 columns, with the chips and search pinned on top.
  - Tapping a toy loads it and collapses the sheet. Dragging down returns to the row. Desktop is
    unchanged.
  - Add a "Find your own splat" help panel (Make pane), covering:
    - Where to find files: superspl.at scenes with downloads (check each licence).
    - Apps to make your own: Scaniverse (free), Polycam, Luma, KIRI Engine.
    - Formats: .ply, .splat, .spz, .sog. Crop in the SuperSplat editor.
    - What works on uploads: Poke, Paint, Magnet, all effects, motion, and flag or pattern colours.
    - What doesn't: toy-specific actions, and uploads can't go in share links.
- **C, music and polish.**
  - About 6 more instruments, each with a playable action and soft WebAudio notes.
  - Fix the storybook strip, the sports car framing and the tractor smoke. Check flags on vehicles.
- **D, AI image-to-3D.**
  - Check `HF_TOKEN` (whoami, printing only name and role).
  - Try a public Space through its API from a tool script in `tools/`. TRELLIS outputs Gaussians
    directly; Hunyuan3D is an alternative.
  - Inputs are our own CC0 images, such as renders. Check the model and output licences.
  - Set a quality bar against the procedural toys, and only ship results that beat them.
  - The free GPU quota is limited. If anything would cost money, stop and ask the owner.
- **E, later.** The gallery (plan in ROADMAP), multi-toy scenes, a scripted liquid pour, the
  draw-order fix for moving parts, and more scans.
