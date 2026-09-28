# Lane HelpTextA: toy help text for the science and nature shelves

Prefix `hta`. Owns the entries in `src/toy-help.js` for the Photoreal, Shapes, Space, Tiny world,
Atoms, Gems, Body, Nature, Weather & fire and Maths shelves, `tests/hta.spec.mjs` (if added), the
`hta-*` screenshots and this file. How lanes work: [OPERATING.md](../OPERATING.md). The style guide
is in [Help.md](Help.md), "Style guide for the text lanes".

## Brief

Written by the Operator on September 28, 2026, from the owner's request of September 27 and
ROADMAP.md, "Toy help", step 2 of the plan.

Your shelves (149 toys; 45 already have a how-to line and 7 an About text): Photoreal (32), Shapes
(4), Space (23), Tiny world (18), Atoms (5), Gems (9), Body (6), Nature (23), Weather & fire (13)
and Maths (16). Lane HelpTextB writes the other shelves at the same time. For the Maths toys, read
docs/handoff/Math.md; for the scans, src/rigs.js and the toy's credit; for the nature, weather,
space and tiny-world taps, the E-lane handoffs in docs/handoff/.

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

Lane Help (PR #57, merged September 28, 2026) built the line, the "?" button and the "About this
toy" section, and wrote the first entries in `src/toy-help.js`: 88 how-to lines and 13 About texts.
The owner approved them. Read docs/handoff/Help.md first, above all its "Style guide for the text
lanes": it is binding for this lane.

Your job: give every toy on your shelves both a how-to line (`howTo`) and an About text (`about`) in
`src/toy-help.js`.

1. Keep the approved entries. Change one only if it is wrong for what the toy does now (say which
   and why in the PR).
2. howTo: one or two short sentences, at most about 90 characters, starting with the action. For
   toys with only a tap, say what the tap does in a few words ("Tap it to peel back the skin.").
   Check the first tap of every toggle against the recipe's `default`.
3. about: 60 to 140 words in two short paragraphs. First what the thing is and what it shows or
   means; then what the toy does (its tap, drags, options, typing) and a fact or two. Plain words a
   curious ten-year-old could follow. No brand names, no jokes that date, no "we" or "you'll love".
4. Check every line against the toy itself: read its recipe (the comments above `action` describe
   the tap; `options` and `controls` are the Toy tab), its row in docs/TOY-PLAN.md ("Improved:" says
   what the tap really does now) and its lane's handoff notes; open a sample of toys in the app
   (python3 -m http.server 4173 --bind 127.0.0.1) and try them, and every toy whose recipe leaves
   you unsure. Never guess what a slider or option does.
5. Check every fact against a real source (an encyclopedia, a museum, a science agency, a
   university). Prefer round numbers with "about". Leave out a fact you can't confirm. For the
   photoreal scans, describe the real thing, not the scan's pedigree (the credits already name the
   source).
6. Nothing sensitive: toys stay friendly (anatomy stays friendly, medieval toys are about castles
   and craft, not fighting). Flags and places stay respectful.
7. American English (color, center, gray, meter, math, -ize). Run
   `node tools/us-english.mjs --diff`. Some Toy tab labels still use older British spelling: quote a
   label exactly only when you name that control ("Try the Colour slider…" is right if that is its
   label), otherwise write "color".
8. Work shelf by shelf and commit and push each shelf as you finish it, so the owner can start
   reading early.

REVIEW: THE HELP BOARD

The owner reads the texts on a new page the Operator publishes, the "Splashery Help Board": every
toy's thumbnail, its how-to line and its About text, with his marks. Its link comes to you in a
message from the Operator (from then on it is in docs/OPERATING.md, "Pages"). The Operator rebuilds
and republishes the board from your pushed branch at each check-in; you don't publish it, and you
don't post cards on the Effect review page (this lane changes no motion). His marks are in the
board's "verdicts" collection, one document per toy id: { verdict: "good" | "fix", note }. Read them
with the ArtifactData tool (action "list", collection "verdicts", url the board's link); never write
to "verdicts". After you have pushed your first shelf, check the marks about once an hour with a
scheduled check-in (send_later): fix every "fix" on your toys in the same PR, following his note,
and say what you changed in your handoff file. Stop the check-ins once your PR is merged or closed.

You own: your shelves' entries in src/toy-help.js (in each shelf's section; keep the sections in the
shelf order of CATEGORIES in src/toys.js, and add a section with the same comment style if your
shelf has none yet); tests/<prefix>.spec.mjs if you add a test; your `<prefix>-*` screenshots; and
your handoff file. Don't edit tests/help.spec.mjs, src/ui.js, styles.css, index.html, the recipes,
src/toys.js or the other shared lists. The other text lane writes the other shelves' entries in the
same file at the same time: when you merge main and src/toy-help.js conflicts, keep both sides (both
are additions), then run tests/help.spec.mjs.

HOW THIS LANE RUNS

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews and
  merges. Don't ask him anything or wait for him. Put questions and blockers in your final message,
  and the Operator answers or relays them. Messages that arrive in this session "From the Operator"
  come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort. Any helper you start uses the same model (don't pick
  another one). Use at most one helper at a time (a helper may draft a shelf; you check every line
  it writes).
- Language: every new public-facing text is in American English, including the handoff file, the PR
  title and body. Dates like "September 28, 2026". Leave code identifiers, file names and anything
  stored in links as they are, and don't rewrite older British text outside your entries; a single
  sweep does that later.
- Read first: CLAUDE.md (the ground rules), docs/OPERATING.md (file ownership, shared lists, tests,
  screenshots, merging), docs/handoff/Help.md (the style guide), docs/TOY-PLAN.md and
  docs/WORKSTREAMS.md.
- Your handoff file: create it. Start it with this brief, word for word, under "## Brief", then keep
  "## State

September 28, 2026: all ten shelves written; draft PR
[#60](https://github.com/ryanjosephkamp/splashery/pull/60).

| Shelf          | Toys | How-to lines | About texts |
| -------------- | ---- | ------------ | ----------- |
| Photoreal      | 32   | 32           | 32          |
| Shapes         | 4    | 3            | 4           |
| Space          | 23   | 23           | 23          |
| Tiny world     | 18   | 18           | 18          |
| Atoms          | 5    | 5            | 5           |
| Gems           | 9    | 9            | 9           |
| Body           | 6    | 6            | 6           |
| Nature         | 23   | 23           | 23          |
| Weather & fire | 13   | 13           | 13          |
| Maths          | 16   | 16           | 16          |
| **Total**      | 149  | 148          | 149         |

The one missing how-to line is the donut's (below, "For the Operator"). The owner's marks on the
[Help Board](https://claude.ai/artifact/P1NCWsGRE3MFqYTWTnTuqN): on September 28, 2026 he approved
every how-to line that was on the board at 04:32 UTC (all 148 of mine). No "fix" marks so far; he is
reading the About texts. An approved how-to line stays as it is unless he marks it "fix".

## Notes

- Approved entries are kept word for word; no approved line was changed.
- Every tap was described from the recipe's comment above `action`, the "Improved:" line in
  TOY-PLAN.md, and for sliders the code that reads them (Sparks sets how many sparks twinkle, Pupil
  the pupil's size, Breath how deep the resting breaths are). Toggles checked against `default`: the
  lantern starts dark, the candle lit, the geode and the pearl open, the Sierpinski tetrahedron and
  the Platonic solids closed, the Moon without its lander.
- Tried in the app (stills before and during the tap): pearl (with and without its shell), star (red
  dwarf), solar system, supernova, Venus, geyser, gyroid, Pythagoras proof, Mandelbulb, diatom,
  amethyst geode (both taps), candle (both taps), saguaro (the About tab at both sizes).
- Facts come from NASA and ESA, NOAA and the National Weather Service, the National Park Service,
  the NIH (NHGRI, NHLBI, NINDS), USGS, GIA, the Protein Data Bank, nobelprize.org and Britannica.
  Where a toy does something the real thing doesn't (a bacterium or a cell that joins back up, a
  diatom that opens like a clam, a virus that buds copies by itself), the text says "the toy" does
  it and describes the real thing separately.
- Helper: one Opus 5.5 helper drafted Space, Tiny world, Atoms and Gems, Weather & fire and Maths in
  the scratchpad, with a source for each fact; every line was checked and several were changed (less
  certain facts cut or softened, a match-and-candle fact swapped for the round candle flame in
  space).
- `tests/hta.spec.mjs`: every toy on these shelves has an entry of the right shape (the donut's
  how-to line excepted), and the About tab shows the saguaro's long text whole at 390x844 and
  1440x900 (`hta-about-*.png`).

## Known issues

- The donut has no how-to line yet (below).
- The star's Type option (red dwarf, yellow, blue giant, white dwarf) changes the look, but the tap
  runs the same Sun-like life for every type: a red giant, a shell and a white dwarf. The About text
  says "the life of a star like the Sun" so it stays true.
- The pearl with "Oyster shell" switched off: the tap shows nothing (checked in the app; the lid it
  opens isn't built). The text doesn't mention the switch.

## For the Operator

- **The donut's how-to line**: `tests/help.spec.mjs` (line 148) expects the donut's default line,
  "Tap it: Break apart.", in the old-link test. With my line ("Tap it to break it apart and put it
  back together.") that test fails, and this lane may not edit the file, so the donut has no `howTo`
  for now (the line waits in a comment in `src/toy-help.js`). The same test (line 325) expects the
  basketball's default line, which lane HelpTextB will hit. Suggested fix, in an Ops PR or lane
  Help's file: compare with `toyHelp(...)` for the toy instead of a fixed string, or use a toy that
  will never get an entry. Then add the donut's line and drop `NO_HOWTO` in `tests/hta.spec.mjs`.
- Recipe follow-ups for a later lane (not text): the star's tap for the other types, and the pearl's
  tap without its shell.
- Two approved lines say "round" (Möbius strip, Circle and waves: "send the rider round", "send the
  point round"); "around" reads more American. Left as approved.
