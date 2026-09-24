# Handoff

The current state and the next phase. The session that finishes a phase updates this file. The
ground rules are in [CLAUDE.md](../CLAUDE.md).

## Current state (2026-09-24)

- Phase A is done:
  - A1 is splashery PR #13, merged (`main` at `db8795f`).
  - A2 is the homepage embed PR in `ryanjosephkamp/ryanjosephkamp.github.io`, on branch
    `claude/phase-a-sharpness-embeds-r29cs3`. Check whether it is merged.
- The shelf still has **283 toys**. Scene schema is v3 (v2 still loads).
- **Sharpness (A1).**
  - Device tiers low / mid / high / max replace weak / strong (`TIERS`, `PIXEL_RATIO` and
    `detectProfile()` in `src/player.js`; splat counts in `PROFILES` in `src/generators.js`).
  - Phones are mid: 140k splats, pixel ratio 2, and full scan files. Desktops are high: 200k,
    ratio 2.
  - Detail: Auto / High / Max in the Look pane (`localStorage` key `splashery.detail`, never in
    links).
  - Adaptive resolution lives in `Stage.timeFrame()` / `setBusy()` in `src/stage.js`.
  - `?profile=low|mid|high|max` (weak and strong still work). `?adapt=off` is for tools and tests.
  - Kit splats: overlap factor 1.2 and default flatness 0.2 (`src/kit.js`).
- **Embeds (A1).**
  - Transparent embeds use `color-scheme: light` on both sides. `normal` is not enough on hosts that
    declare `light dark`.
  - The toy is framed at 80% of the shorter side. `?zoom=` or the `zoom` attribute scales it.
  - The plain wheel zooms after a click. There are + and − buttons (`?controls=0` or `controls="0"`
    hides them).
  - The snippet is responsive, with a size picker in Share.
- The honeybee is upright. Shelf thumbnails retry once, then show a plain tile.
- Tools:
  - `tools/check-packs.mjs`: builds and timing, at the high tier's count by default; `--count=`
    changes it.
  - `tools/contact-sheet.mjs`: review sheet.
  - `tools/make-thumbs.mjs`: thumbnails, by pack or id. Allow about 18 s per toy under SwiftShader.
    Run one process at a time: parallel runs are slower.
  - `tools/sharpness-crops.mjs` and `tools/sharpness-pairs.mjs`: before/after crops.
  - `tools/prepare-assets.mjs`: SOG packing.
  - `tools/mesh-to-splats.mjs`: glTF to PLY.
  - `tools/fetch-flags.mjs`: flags.
- All 47 Playwright tests pass on `main`, including the dark-mode transparent embed test.
- `HF_TOKEN` has still not been checked by any session. Check it (without printing it) before Phase
  D. If it is missing or rejected, tell the owner exactly what to change: the cloud environment menu
  in the session's title bar, then Edit, then an environment variable named `HF_TOKEN`.
- This helper is not in the repo. Rewrite it if needed:
  - A pack screenshot script: a Playwright page opens the app, clicks `.chip[data-category=…]` then
    `.toy-card[data-toy=…]`, waits until `#toy-status` starts with the toy's label, and takes the
    screenshot.
- In the cloud sandbox, headless Chromium cannot reach github.io. To screenshot a host page that
  embeds the live site, route `https://ryanjosephkamp.github.io/splashery/**` to the local server
  (`context.route` plus `route.fetch`).

Known issues carried forward:

- Storybook: a faint red strip on the left page when open.
- The sports car is a little small in its frame.
- The tractor's exhaust smoke is heavy.
- Flags on vehicles were never checked (windows and lights should stay unpainted).
- Splats are depth-sorted in their built pose, so large moving parts can draw out of order.
- Only 3 music toys exist.
- New in A1:
  - The tier thresholds and the 24 ms and 40 ms adaptive limits are guesses, not tuned on real
    phones.
  - Phones now build 140k-splat toys and download full scans, so they load more slowly.
  - Old transparent snippets with `color-scheme:normal` still show a white box on hosts that support
    dark mode. Re-copying the snippet fixes it.

## Phases

Each phase is one session and one PR, or a small stack of PRs.

| Phase | What                                                                                                                                                                                   | Repo(s)                                  |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| A     | Done: Sharpness (pixel density, splat counts, kit splat size, Detail setting) and embeds (transparency, framing, size, zoom); honeybee flip; thumbnail retry. Then the homepage embed. | splashery, then ryanjosephkamp.github.io |
| **B** | Mobile shelf grid (drag the shelf up into a full grid) and a "Find your own splat" help panel.                                                                                         | splashery                                |
| C     | More music toys (piano, trumpet, violin, maracas, harp, and others) plus the polish items above.                                                                                       | splashery                                |
| D     | AI image-to-3D trial with `HF_TOKEN`.                                                                                                                                                  | splashery                                |
| E     | Later: the gallery (plan in ROADMAP), multi-toy scenes, a liquid pour, the draw-order fix, more scans.                                                                                 | splashery                                |

## Phase B in detail: mobile shelf grid and "Find your own splat"

Phase A is written up in splashery PR #13 and the homepage PR. The sharpness crops are in
`tests/screenshots/sharpness/`, and screenshots of the homepage embed are in
`tests/screenshots/homepage-*.png`.

1. **Where the phone UI lives now.**
   - `index.html`:
     - `#sheet-handle` is the grab bar.
     - `#shelf` (`nav.shelf`) is the horizontal row of `.toy-card` buttons.
     - `#sheet-toggle` is the More/Done button.
     - `#panel-body` holds the tabs.
   - `src/ui.js`, "Bottom sheet" section (around line 790):
     - `setExpanded()` toggles `body.sheet-open`.
     - `bindSwipe()` handles swipes on the handle and on the scrolled controls.
     - `ui.collapseSheet()` runs after a toy is chosen.
   - `styles.css`: the phone rules are in the `max-width` media queries near the end.
2. **Shelf grid.** On phones only:
   - Dragging the handle or the shelf itself upward expands the shelf into a vertical grid of about
     4 columns that fills the sheet. The category chips and the search box stay pinned on top.
   - Tapping a toy loads it (`app.chooseToy`) and collapses the grid back to the row.
   - Dragging down, or the Done button, returns to the row.
   - Keep the More/Done panel working as it does now. The grid is a third state (row, grid, panel)
     or a mode of the shelf; pick whichever keeps the gestures simple.
   - Desktop is unchanged.
   - Thumbnails are lazy `<img>`s with one retry. A grid shows many at once, so check the loading is
     still smooth.
3. **"Find your own splat" help panel** in the Make pane (a collapsible section, plain text and
   links), covering:
   - Where to find files: superspl.at scenes with downloads on. Check each licence; only CC0, CC BY
     or public domain count for the shelf, but visitors can load anything they own.
   - Apps to make your own: Scaniverse (free), Polycam, Luma, KIRI Engine.
   - Formats: .ply, .splat, .spz, .sog. Crop stray splats in the SuperSplat editor first.
   - What works on uploads: Poke, Paint, Magnet, all effects, motion, and flag or pattern colours.
     The Detail setting and the adaptive resolution apply too.
   - What doesn't: toy-specific actions (open, blow out), and uploads can't go in share links.
   - No brand logos. App names as plain text are fine.
4. **Tests.**
   - Phone (390×844, touch): dragging the shelf up shows the grid (at least 3 columns and no
     horizontal overflow), and tapping a card loads that toy and collapses the grid. Swiping down
     restores the row.
   - 360 px: no horizontal overflow with the grid open.
   - Desktop: the shelf layout is unchanged.
   - The help panel exists in Make, and its links have the right `href`s.
   - Keep all 47 existing tests green, including "embed transfer ≤ 30 MB".
5. **Screenshots.** Take 390×844 with the grid open and closed, the Make pane with the help panel,
   and 1440×900 to show desktop is unchanged.

**Done when:** a phone visitor can drag the shelf up into a grid, pick a toy, and get back to the
row; the help panel is in Make; all tests pass; and prettier is clean.

## Phases C–E (outline)

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
