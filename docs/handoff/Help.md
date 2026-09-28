# Lane Help: how to play, and About this toy

Prefix `help`. Owns the help parts of `src/ui.js`, `styles.css` and `index.html` (in blocks marked
"Toy help"), `src/toy-help.js` (new), `tests/help.spec.mjs`, the `help-*` screenshots and this file.
How lanes work: [OPERATING.md](../OPERATING.md).

## Brief

Written by the Operator on September 28, 2026, from the owner's request of September 27 and
ROADMAP.md, "Toy help", step 2 of the plan.

The owner's words (docs/reviews/2026-09-27-ai-math/review.md): "When I open the site and go to a new
toy (or have refreshed the page, etc.), I'd like to briefly see information on the screen (not
overlapping the toy, if possible) that concisely tells the user how to play with the toy. For
example, if I open the puzzle cube, it would be nice to know that I can drag a row or column in a
direction to turn that; other examples: how to use the chess toy, how to play the xylophone, etc. We
will eventually have this brief type of instructions for every toy in the gallery. And within the
configuration panel, perhaps we can add a new tab or put the info in the main tab, etc., with a
proper description of what the toy shows or means, what you can do with it, etc. That way, if
someone sees something they don't recognize, they can learn a little bit about it without needing to
leave the site to search for it."

Build the engine part and a first set of text:

1. How to play. When a toy opens (picked from the shelf, opened from a link, or after a refresh),
   one short line says how to play with it: "Drag a row or column to turn it" (puzzle cube), "Tap a
   bar to play it" (xylophone). It sits beside the toy, not over it (on a phone, under the toy's
   name or in the top bar; on a wide screen, beside the stage), and fades after a few seconds. A
   small "?" button shows it again. It must never cover the toy at 390×844 or 1440×900. Respect
   reduced motion. Embeds stay clean: no line by default (an opt-in embed parameter is fine).
   Nothing goes into links or saved scenes.
2. About this toy. In the settings panel, a proper description of the toy: what it is and what it
   shows or means, what you can do with it (its tap, drags, options, typing), and a fact or two. The
   panel already has Toy, Tools, Look, Make, Share and About tabs. Decide the clearest home (an
   "About this toy" section at the top of the About tab, or a section in the Toy tab, or a new tab),
   show the owner your choice in screenshots, and say why in the card.
3. The text lives in a new shared list, src/toy-help.js, keyed by toy id: { howTo: "…", about: "…"
   }. Like src/toy-sounds.js, each later lane edits only its own toys' entries. Load it lazily
   (after first paint, or when needed) so the page stays light. A toy with no entry gets a sensible
   default line from what it has: a tap, drag play, an input panel, options. It never shows nothing
   and never guesses wrong.
4. Text in this PR: write a how-to line for every toy on main that does more than a tap. That
   includes the laptop, xylophone, chess set, puzzle cube, bricks, Newton's cradle, gummy bear, the
   molecule and protein toys, the graph and surface plotters, Fourier circles, circle and waves, the
   snail (a toggle), the looks toys (pencil, tin can) and anything else with a drag, typing, drawing
   or an option that changes play. Also write "about" texts for about ten toys across the shelves,
   to set the format and tone. Check every line against what the toy really does: open it, try it,
   and read its recipe. Keep facts accurate and plain; no brand names. Two later lanes, split by
   shelf, write the rest, so put a short style guide for them in your handoff (length, tone,
   American English, what to check).
5. Leave out the AI and computing toys: that lane (PR #52, still open) writes its own entries after
   you merge. It is moving the classic transformer's key off the toy into the Toy tab for now; the
   About text may take that job later.
6. Tests in tests/help.spec.mjs: the line appears on pick, link and refresh, and fades; "?" brings
   it back; it doesn't overlap the stage's toy at both sizes; the About text shows for a toy with an
   entry and the default for one without; embeds show no line; old #s= links and scene JSON still
   load; toy-help.js loads without blocking first paint; every toy gets a non-empty line.

You own: the help parts of src/ui.js, styles.css and index.html (keep your changes in clearly marked
blocks and don't touch other UI behavior); src/toy-help.js (new); tests/help.spec.mjs; your `help-*`
screenshots; and docs/handoff/Help.md. You don't edit src/toys.js, the packs, toy-sounds.js or the
plan, and you don't touch tests/taps.spec.mjs.

## State

September 28, 2026: built and tested; draft PR
[#57](https://github.com/ryanjosephkamp/splashery/pull/57). The line, the "?" button, "About this
toy" in the About tab and `src/toy-help.js` with 88 entries: a how-to line for every toy on main
that does more than a tap (drags, typing, a game, toggles, sliders and options that change play) and
13 About texts across the shelves (grape, black hole, tardigrade, molecule, heart, volcano, puzzle
cube, Newton's cradle, chess set, octopus, Fourier circles, xylophone, Eiffel Tower). Cards on the
Effect review page: `help-line-phone`, `help-line-desktop`, `help-about` and the clip
`help-line-clip`.

## Notes

How it works:

- `src/ui.js` (the "Toy help" block): `setToyPanel(info)` calls `setToyHelp(info)`, which imports
  `src/toy-help.js` the first time a toy opens (after the first paint) and fills the line and the
  About section. The line shows when the toy is new (its kind and id changed): a pick, a link, a
  refresh or an imported scene. A rebuild of the same toy (an option, the detail tier) only updates
  the text. It fades after 7 seconds; "?" toggles it; its "About this toy" link opens the About tab
  (and the sheet on a phone).
- Where it sits: under the name at the top left of the stage. On a phone that is under the toy's
  name line (top 74px), and it hides while the sheet is open, like the name. On a wide screen it is
  under "Splashery" (top 62px). "?" sits left of the sound button. The toy sits in the middle of the
  stage, so the corner stays clear; `tests/help.spec.mjs` checks six toys (the tall Eiffel Tower,
  the wide chess set among them) at 390×844 and 1440×900 by hiding everything over the stage and
  checking that the stage under the line's box is plain background.
- Why the About tab: it already holds the toy's credits and the controls, "About" is where a visitor
  looks for "what is this", and the Toy tab stays short for the controls. A new tab would not fit
  the phone's tab row (six tabs already fill 390px). The line's "About this toy" link is the way in.
- `toyHelp(info)` in `src/toy-help.js` returns the line, the About paragraphs and a short "what you
  can do" list read from the recipe (the tap's label, a drag or stretch, the Toy tab's settings,
  your own input), so the list is always right even for toys with no entry. A toy with no `howTo`
  gets a line from its recipe: "Tap it: <the tap's label>." plus "Drag on the toy to play with it."
  (a recipe drag), "Drag the toy to stretch it." (a grab), "Type your own in the Toy tab." (an input
  panel) or "More in the Toy tab." (options or sliders). A file of your own says it stays on your
  device; a toy you made points to the Make tab. A shelf shape edited into another shape (its rig
  gone) never gets the shelf toy's entry.
- In an automated browser (`navigator.webdriver`, as in the test suite) the line shows by itself
  only with `?help=show`; "?" works everywhere. Without that, the older tests that compare stage
  screenshots a few seconds apart (the lantern check in `tests/smoke.spec.mjs`) caught the line
  fading between shots, and the standard screenshots would change with the fade's timing.
- Nothing goes into links, scenes or storage. Embeds (`embed/index.html`) never load `ui.js`, so
  they have no line.

## Style guide for the text lanes

Each lane writes the entries for its own shelf's toys in `src/toy-help.js`, in that shelf's section,
keyed by toy id. Only your own toys' entries.

- **howTo**: one or two short sentences, at most about 90 characters (the test stops at 110). Start
  with the action: "Tap", "Drag", "Type", "Pick". Say what happens in plain words ("Tap it to squirt
  ink."), then the one thing beyond the tap if there is one ("Pick the kind of star in the Toy
  tab."). For a toggle, say both ways: "Tap to open the lid; tap again to close it." Check which way
  the first tap goes: a toggle's `default` in the recipe is where it starts (the book starts open,
  so "Tap to close the book; tap again to open it."). Where the second tap's effect is unclear, "tap
  again to go back" is always true. Name settings as the Toy tab shows them ("Try the Pupil slider
  in the Toy tab."), and never guess what a slider does: if the recipe doesn't make it plain, name
  the slider.
- **about**: 60 to 140 words (the test allows 40 to 180), in two short paragraphs separated by a
  blank line (`\n\n`). First what the thing is and what it shows or means; then what the toy does
  (its tap, drags, options, typing) and a fact or two. Plain words a curious ten-year-old could
  follow; no jokes that date, no brand names, no "we" or "you'll love".
- **Check every line** against the toy: open it, tap it, drag it, try its options; read its recipe
  (the comments above `action` describe the tap) and its row in `docs/TOY-PLAN.md` ("Improved:" says
  what the tap really does now). Check every fact against a real source (an encyclopedia, a museum,
  a science agency), and prefer round numbers with "about".
- **American English**: color, center, gray, meter, math, -ize. Run
  `node tools/us-english.mjs --diff`. Some of the Toy tab's own labels still use older British
  spelling; quote them only when you name a control, and otherwise write "color".
- Tests: `tests/help.spec.mjs` checks every entry (a shelf toy's id, the lengths, a capital and a
  period) and that every toy gets a line. Run it after editing.

## Known issues

- Some Toy tab labels still use British spelling (the color and flavor pickers); the About section's
  "Toy tab" row shows them as they are until the English sweep.

## For the Operator

- No opt-in embed parameter: the embed page (`embed/index.html`, `src/embed.js`) isn't this lane's,
  and the brief asked for a clean embed by default. It can be added later in an embed PR.
- No change to `tests/taps.spec.mjs` is needed.
- The `?help=show` switch for automated browsers is a test accommodation. If you'd rather the suite
  saw the line too, the stage-screenshot checks in `tests/smoke.spec.mjs` need to hide `#help-line`
  first; then the switch can go.
- The AI and computing toys (PR #52) get the default line until that lane adds its entries.
