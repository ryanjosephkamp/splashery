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

September 28, 2026: started. Draft PR open; building the line, the "?" button and the About section.

## Notes

(To come.)

## Known issues

(None yet.)

## For the Operator

(Nothing yet.)
