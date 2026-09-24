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

Each phase is one session and one PR, or a small stack of PRs. The owner reviewed every toy on
2026-09-23 (raw notes and screenshots in [reviews/2026-09-23/](reviews/2026-09-23/review.md)). The
per-toy plan that came out of it is [TOY-PLAN.md](TOY-PLAN.md), generated from `tools/toy-plan.json`
by `node tools/toy-plan.mjs`. Keep that JSON current: when a phase finishes a toy, update its entry
(for example `"v": "keep"`) and regenerate.

**On 2026-09-24 the owner approved every proposal in the plan as written**, including the
sports-ball texture fixes added that day, and all toys are marked approved on the page below. Build
them as proposed; use judgement on details.

The owner can still mark a proposal Approve, Change or Skip (with notes) on a private page:
https://claude.ai/artifact/PNGPx7REMdhxLMHDXARhw8 ("Splashery Toy Plan"). Before starting a phase,
check the marks for its toys for any later change: with the `ArtifactData` tool, `list` the
collection `marks` (one document per toy id: `{mark: "yes" | "change" | "skip" | "", note, at}`). If
that tool is not available, ask the owner to press "Copy my marks and notes" on the page and paste
the text. A "change" note overrides the proposal in `tools/toy-plan.json`; update the JSON to match.
If the plan JSON changes, the page can be republished from it (`node tools/toy-plan.mjs --json`).

| Phase | What                                                                                                                                                                       | Repo(s)   |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| A     | Done: sharpness, Detail setting, embeds, honeybee, thumbnail retry, homepage embed.                                                                                        | both      |
| **B** | Mobile shelf grid (drag up into a full grid like desktop), thumbnail labels that don't cut off, and a "Find your own splat" help panel.                                    | splashery |
| C1    | Visual fixes from the review (26 toys: vintage camera, boombox, storybook, comet, Statue of Liberty crown, horse brightness, cookie orientation, sports-ball textures, …). | splashery |
| C2    | Make existing effects clearer or more dramatic (33 toys the owner found subtle or underwhelming: bacteriophage, Newton's cradle, Big Ben, bus, …).                         | splashery |
| D     | Effects and sound engine: a unique sound per toy, scan rigs (moving parts for captured toys), taps that know where they landed, drag-to-stretch.                           | splashery |
| E1–E6 | New tap effects for the 181 toys marked new (most only hop today), in six waves by category (see TOY-PLAN.md), each with its own sound.                                    | splashery |
| F     | Touch and drag interaction: a solvable puzzle cube, a chess set that plays a real game, a stretchy gummy bear, a draggable Newton's cradle, bricks.                        | splashery |
| G     | AI image-to-3D trial with `HF_TOKEN`.                                                                                                                                      | splashery |
| H     | Later: the gallery, multi-toy scenes, a liquid pour, the draw-order fix, more scans, more instruments, and the final homepage embed(s).                                    | both      |

What the owner asked for across the board (2026-09-23):

- **Every toy gets its own tap effect and its own sound.** Sounds can be similar within a category
  but should differ slightly. Toys with a twin (the two rubber ducks, the two croissants, the two
  alarm clocks, the cactus and the saguaro, the grape and the grapes) must act and sound different.
- Where the effect is already good, keep it (65 toys are marked keep in TOY-PLAN.md).
- Some effects should depend on where you touch or drag (puzzle cube, gummy bear, chess, Newton's
  cradle). Say so if something is not feasible; a good fallback is fine.
- Sharpness after A1 is "basically perfect"; the homepage embed works in light and dark mode.
- Later the homepage embed will change to a favourite maths toy (the Menger sponge or the hypercube;
  the voice transcript is ambiguous, ask) at the highest detail, maybe several embeds. That needs an
  owner-set embed option such as `?detail=high` (Detail is deliberately not in share links; an embed
  the site owner chooses is a different case). See BACKLOG.md.
- Stay respectful: nothing destructive or disrespectful on the White House or the Washington
  Monument, and no fighting or gore (the Colosseum gets a chariot race, not gladiators).

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
3. **Thumbnail labels.** On phones, long names end in "…" under the thumbnail (for example "Vintage
   c…"). Try two lines with a slightly smaller font and a clamp, so almost every name fits; the full
   name is in the card's `title` and on the status line. A scrolling (marquee) label only for the
   selected card is an option; skip it if it costs frame rate. Check 360 px.
4. **"Find your own splat" help panel** in the Make pane (a collapsible section, plain text and
   links), covering:
   - Where to find files: superspl.at scenes with downloads on. Check each licence; only CC0, CC BY
     or public domain count for the shelf, but visitors can load anything they own.
   - Apps to make your own: Scaniverse (free), Polycam, Luma, KIRI Engine.
   - Formats: .ply, .splat, .spz, .sog. Crop stray splats in the SuperSplat editor first.
   - What works on uploads: Poke, Paint, Magnet, all effects, motion, and flag or pattern colours.
     The Detail setting and the adaptive resolution apply too.
   - What doesn't: toy-specific actions (open, blow out), and uploads can't go in share links.
   - No brand logos. App names as plain text are fine.
5. **Tests.**
   - Phone (390×844, touch): dragging the shelf up shows the grid (at least 3 columns and no
     horizontal overflow), and tapping a card loads that toy and collapses the grid. Swiping down
     restores the row.
   - 360 px: no horizontal overflow with the grid open.
   - Desktop: the shelf layout is unchanged.
   - The help panel exists in Make, and its links have the right `href`s.
   - Keep all 47 existing tests green, including "embed transfer ≤ 30 MB".
6. **Screenshots.** Take 390×844 with the grid open and closed, the Make pane with the help panel,
   and 1440×900 to show desktop is unchanged.

The owner wants to try the grid and see how it feels; if it is less friendly than the row, it may be
reverted. Keep the change easy to switch off (one class or one function), and put phone screenshots
of both states in the PR.

**Done when:** a phone visitor can drag the shelf up into a grid, pick a toy, and get back to the
row; names are readable; the help panel is in Make; all tests pass; and prettier is clean.

## Phases C–H (outline)

- **C1, visual fixes.** The toys with a Fix line in TOY-PLAN.md. Notes:
  - Vintage camera and boombox look grainy, almost reverse-contrast (screenshot in the review
    folder). Both came through `tools/mesh-to-splats.mjs`; check which texture it samples (base
    colour vs. a packed metal/roughness or AO map), sRGB handling and splat size, and the wooden
    elephant with it. Re-run `prepare-assets` and `make-thumbs` for any rebuilt scan.
  - Horse statue: too bright. Add a per-toy exposure or tone setting for captured toys, or fix it in
    preparation.
  - Cinnamon star cookie: the bottom faces the camera. Flip it in `tools/assets.json` (like the bee)
    or set its camera preset.
  - Storybook: text is grey smudges and the cover is soft. Try readable lines from a tiny bitmap
    font (the kit also builds in Node for `check-packs`, so no canvas), smaller splats on pages, and
    a crisper cover. Also the known faint red strip.
  - Comet: overhaul (icy nucleus, coma, straight blue ion tail and curved dust tail).
  - Statue of Liberty: crown rays look squashed. Decorated tree: the star is a golden cloud.
  - Sports balls (added 2026-09-24): several look grainy instead of like their material. The tennis
    ball should be fuzzy felt; the American football should be pebbled pigskin leather with crisp
    laces. Check basketball, baseball, softball, rugby ball, cricket ball, soccer ball, volleyball
    and medicine ball too. Likely causes: colour noise and jitter too strong for their size, and
    discs too flat or too sparse for felt; try per-material splat size, opacity and a fine bump
    pattern in the colour function.
  - Lava lamp caps, flying disc sheen, diya detail, the dark-on-dark squash ball and hockey puck,
    and the carried-forward sports car framing and tractor smoke.
- **C2, clearer effects.** The toys marked "more" in TOY-PLAN.md. Several "do nothing" reports are
  pulse actions that are simply too small or too short (the bacteriophage's sheath slides 0.5 units
  for about 3 s). Rule of thumb: an effect should last at least 1.5 s, move at least ~10% of the
  toy's size or change its light clearly, and be obvious in the first half second. Windmill: faster.
- **D, effects and sound engine.**
  - Sound: today there are 12 shared synthesized sounds (`src/sound.js`) and toys pick one by name.
    Build a larger voice library (plucked strings, bells, buzz, squeak and quack formants, crunch,
    splash, drum hits, a note sequencer for tunes), let each toy declare its own sound as a small
    spec with pitch and timbre, and add a test that every toy has one and no two share the exact
    same spec. CC0 samples (for example Kenney's CC0 packs) are allowed for the few sounds synthesis
    does badly; ask the owner first (see Decisions). Embeds stay silent.
  - Scan rigs: captured toys are one splat cloud with no parts. Options: (a) region parts, where a
    few boxes or spheres per toy in `src/toys.js` sort splats into parts at load (an instance stream
    like `paintColor`), so wings, heads, legs and tails can move; (b) small kit-built add-ons (a
    lantern flame, a camera flash) drawn as a second splat entity; (c) whole-body effects (squash,
    crumble, glow) through the modifier. Most scan ideas in TOY-PLAN.md need (a) or (b).
  - Taps that know where they landed: pass the picked point to the action so a recipe can choose
    what happens (turn this layer, move this piece).
  - Drag-to-stretch: the Magnet effect already pulls splats; add a grab mode with a springy release
    (gummy bear, then others).
  - An audit tool or test listing toys without their own action or sound.
- **E1–E6, new effects.** One wave per session (about 30–45 toys each), following TOY-PLAN.md. Run
  `check-packs`, a contact sheet and `make-thumbs` for touched packs as usual. Thumbnails take about
  18 s per toy under SwiftShader; render only the toys you changed.
- **F, touch and drag interaction.** Puzzle cube: 26 cubies as parts (the part limit is 48), cube
  state in JavaScript, swipe on a face to turn a layer, plus scramble and a solved check. Chess set:
  it is a scan, so either region parts per square or a kit-built set; first a scripted famous
  public-domain game, then maybe tap-to-move. Gummy bear: drag to stretch. Newton's cradle: drag a
  ball back and let go. Bricks: build a random model each tap.
- **G, AI image-to-3D.**
  - Check `HF_TOKEN` (whoami, printing only name and role).
  - Try a public Space through its API from a tool script in `tools/`. TRELLIS outputs Gaussians
    directly; Hunyuan3D is an alternative.
  - Inputs are our own CC0 images, such as renders. Check the model and output licences.
  - Set a quality bar against the procedural toys, and only ship results that beat them.
  - The free GPU quota is limited. If anything would cost money, stop and ask the owner.
- **H, later.** The gallery (plan in ROADMAP), multi-toy scenes, a scripted liquid pour, the
  draw-order fix for moving parts, more scans, more instruments (piano, trumpet, violin, maracas,
  harp), and the final homepage embed(s) in ryanjosephkamp.github.io.

## Decisions

Settled on 2026-09-24, when the owner approved every recommendation:

- Sounds: synthesize by default; CC0 audio samples are fine for the few that synthesis does badly (a
  real quack, an alarm bell, a crowd). Record each sample in CREDITS.md.
- Pine tree: it shakes off a dusting of snow (the decorated tree keeps the lights).
- An owner-set `?detail=high` embed option for the homepage is approved for Phase H, capped by
  device tier.

Still open (ask when it comes up, in Phase H):

- The favourite maths toy for the homepage: Menger sponge or hypercube? One embed or several?
