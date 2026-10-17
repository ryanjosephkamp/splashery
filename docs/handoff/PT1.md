# Lane PT1: Your name in splats and Shape morph, rebuilt

Built by Opus 5.5 at high effort. Prefix `pt1`. Branch `claude/pt1`; engine branch
`claude/pt1-engine` (PR #684, merged) and `claude/pt1-engine-2` (PR #691, to merge first).

## The brief (the Operator's, October 16, 2026)

The owner reviewed two of the new portfolio toys (Codex task 78, labs) and rejected them.

- **Your name in splats** (`src/packs/name-toy.js`) must look and feel just like the Toy Box name
  toy of his portfolio (`buildName()` and `toybox()` in `portfolios/toybox/main.js`): its five tools
  (Spin, Poke, Paint with eight swatches and "Wash it off", Drop, and Blow), sound on each action,
  rounded bold letters of soft splats. It accepts anything a person can type: any script, digits,
  punctuation, symbols, and emoji, including ZWJ sequences, flags, and skin tones.
- **Shape morph** (`src/packs/shape-morph.js`): any number of forms to morph between, in an order
  the person sets (shapes, words or names with emoji, QR text). A tap or click morphs to the next
  form. A clean new sound in place of the grainy one.
- Build order: a shared module `src/text-splats.js` (graphemes by `Intl.Segmenter`, canvas
  `fillText` in system fonts, inked pixels sampled with their colors, seeded, one range per
  grapheme); the name toy (old links' `name`, `verb`, `color`, `paints`, and `detail` still open,
  with a compat test; pieces move as solid pieces); then Shape morph (a list to add to, remove from,
  and reorder; a tap morphs to the next form at the tapped place's pace; the old forms stay; emoji
  through the shared module; a clean sound; the evidence file kept true).
- System rounded fonts, unless the owner approves Toy Box's Fredoka (OFL). Both toys stay behind
  labs. Clips go on Effect review page 2 under lane `PT1`.

## State

Ready for review (see the PR). Both toys are rebuilt, with the Operator's review fixed. Engine PR
#691 merges before #686.

### What was built

- **`src/text-splats.js`**: `graphemes`, `cleanText`, `textRows`, `layoutText`, `glyphRaster`,
  `textSplats`. Each grapheme is drawn on its own canvas. Drawing it in white and in black tells a
  color glyph (an emoji keeps its colors) from a plain one. A plain glyph gets a round-joined
  outline, which makes any font rounder and bolder. Splats form a slab like Toy Box's: a front face
  and a darker back face (an R2 sequence over the glyph's ink), plus a rim along the outline. Their
  sizes come from each part's spacing, and Toy Box's light is baked in. Node falls back to the 5×7
  bitmap font.
- **The name toy**: letters are tokens (up to 48); with Drop, each letter breaks into up to four
  pieces (Lloyd-relaxed cells of its splats). A small rigid-body simulation in `drive` (fixed 1/120
  s steps, Toy Box's springs K 46 and damping 5.5, gravity 7) moves them:
  - Poke: a ring runs out at 3.4 units a second. The touched letter pops toward you and rocks, and
    the others hop as the ring passes. Each touched letter plays its own bar note, up a major scale.
  - Drop: the pieces fall, land with an impulse and friction at their lowest outline point, and roll
    onto a side. Each landing knocks, and the pieces spring back together with a breath.
  - Blow: the letters are pushed away from a held finger, with a quiet wind.
  - Paint: stamps with the site's Painter (so they are kept in `#s=` links), at the letter's built
    place on the face the viewer sees. Wash it off clears them.
  - Spin: the site's orbit, and a tap pokes. The name sways gently once it is left alone, as in Toy
    Box.
  - The tools sit on the stage's new tool row (`recipe.toolbar`).
- **Shape morph**: `forms` (a JSON list of `lorenz`, `w:<word>`, `q:<qr text>` and so on) and `at`
  (which one is showing), with `form`, `word`, and `qrText` editing the form that is showing. A link
  without `forms` opens the original six at its form.
  - A tap (`action.at`) or Play (`action.play`) rebuilds to the next form. A chip on the stage jumps
    straight to its form.
  - The Toy tab's word box adds a word, and "Edit your forms" adds shapes or a QR code and moves or
    removes forms.
  - The flight starts at the tapped point: each splat waits 0.38 s per unit of distance (in the GPU
    program and in `posePoint`). In flight the cloud wears its teal-to-pink ink, and an emoji's own
    colors come in as it lands.
  - The new sound is a soft `pad` swell (E4, falling 6%).

### Tests

- `tests/pt1.spec.mjs` (18): the text module (RTL and joined scripts, text that draws nothing),
  names, builds, poke and drop physics, old links, the form list, the editor, tool colors and keys,
  the census, the fly-in and tick, and the browser at both sizes.
- `tests/pt1-engine.spec.mjs` (7, on the engine branches).
- `tests/cdx-pfd.spec.mjs` is brought up to date. It no longer requires that emoji are rejected or
  that names are uppercased, and the paint test uses the tool row. `cdx-pfc` and `cmp2-engine` pass
  unchanged.

### Clips

Effect review page 2, lane `PT1` (MP4s, 360 px): `pt1-name-toy-poke`, `pt1-name-toy-paint`,
`pt1-name-toy-drop`, `pt1-name-toy-blow`, `pt1-name-toy-emoji`, `pt1-name-toy-open`, and
`pt1-shape-morph`.

### The Operator's review (October 16, 2026)

- Cdx-pfd's Blow check (the gust stays inside the capture) is back.
- Text that draws nothing (U+3164, private-use code points): the word box refuses it, a link with it
  shows "?", and Shape morph shows SPLATS rather than a point.
- Right-to-left rows read right to left (Latin and digits inside keep their order). Words in joined
  scripts (Arabic, the Indic scripts, and others) are drawn whole, so the browser shapes them.
- Toy Box parity:
  - tool chips in Toy Box's colors, with keys 1 to 5 (engine PR #691);
  - a pop when a tool or color is picked, and a tick as the name turns;
  - the letters fly in when the name opens;
  - the census of splats per letter in the Toy tab;
  - bar notes from C5.
- A link's name is cut to 48 characters, and Shape morph's word box and Add both take 24.

## Known issues

- The name toy's letters use Fredoka (Latin subset); other scripts and emoji use the device's fonts.
  Shape morph keeps the system's rounded fonts.
- Dragging off the toy turns the view (the site's orbit), so Blow starts on the letters, not beside
  them as in Toy Box.
- Pieces dropped in a pile overlap a little; they do not collide with each other (neither do Toy
  Box's splats).

## For the Operator

- **An engine oddity seen while building (not changed here):** `Player.resortTokens()` gives a wrong
  order for a token moved well toward the camera (0.8 em in z). It sorted the letter behind its
  neighbor, with its back face drawn over its front. In-plane moves sort fine. The name toy
  therefore re-sorts only when dropped pieces come to rest and when they are home again. It is worth
  a look for PACKS.md 7b rule 12 (the reproduction: hold one name-toy letter at `d = [0, 0, 0.8]`
  and call `resortTokens()`).
- A lesson for PACKS.md: `recipe.toolbar` for a toy's own tools on the stage, and `{ paint }`
  results from drags for paint that is kept in links.
