# Lane Manual: the splat equation toy and the Tinkerer's Manual

Prefix `man`. Branch `claude/lane-splat-manual`, PR "Phase Manual: the splat equation toy and the
Tinkerer's Manual". How lanes work: [OPERATING.md](../OPERATING.md). Earlier lessons:
[history.md](history.md).

## r2 (October 4, 2026): the manual for a newcomer, and a fresh PDF

**Start here.** Model: **Sonnet 5.5** (docs are a Sonnet job under the owner's model split of
September 29, 2026). The Operator (Opus 5.5) checks every technical claim before merge, and the
owner reviews the pages on his phone. Branch `claude/lane-manual-r2`, one PR titled "Phase Manual
r2: the Tinkerer's Manual for a newcomer", prefix `man2`, tests in `tests/man2.spec.mjs` if you need
new ones.

Why: the owner will show the Tinkerer's Manual to his CS master's thesis advisor, someone who knows
computing but not Gaussian splats. Codex audited the manual for exactly that reader
(docs/audits/manual-audit-2026-10.md, merged as #244) and fixed 20 factual points in
`manual/index.html`; its teaching proposals were left for this round.

Do, in this order:

1. **Read the audit's "Proposed teaching additions for the newcomer" and "Capabilities now missing
   from the manual" sections** and the current `manual/index.html`.
2. **Add the newcomer material**, in the manual's own style (short sentences, plain words, American
   English):
   - the short "What is a 3D Gaussian?" box before Level 1's table, with the audit's distinction
     between a recipe's placed splats, a trained capture and the one-photo teaching fit;
   - a glossary (the audit's fourteen terms; each definition one or two sentences, checked against
     the code it describes);
   - "Further reading" with the audit's five sources: open each link live and keep only those that
     load, with authors, title, venue and year exactly as the source page gives them;
   - the approximation labels where the text describes the renderer ("affine around the center",
     "sorting uses centers", and the rest the audit lists);
   - one runnable recipe page: a complete module, its catalog entry, how to serve the folder and the
     exact URL to open, and what a tap should do. Run it yourself and say so in the PR.
3. **Three figures as inline SVG** (light and dark, readable at 390 px wide): representation →
   projection → blend; the three ways splats are made; the twelve copies and the detail budget.
   Every label must match the code (cite the file and line in an HTML comment beside each figure).
4. **A short chapter, "What else Splashery does now"**: one paragraph per capability the audit
   lists. Say plainly which parts are behind the labs switch. Describe only what is on main; never
   promise future work.
5. **Regenerate the PDF** with
   `SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/manual-pdf.mjs` while
   `python3 -m http.server 4173 --bind 127.0.0.1` serves the checkout. Check the page count, the
   figures, the links and the page breaks. Your book's sample opens this PDF
   (`src/packs/pictures.js`): check that it still opens, and re-render its thumbnail if the cover
   changed.
6. **Tests:** `tests/man.spec.mjs` and `tests/ln.spec.mjs` must pass; add `tests/man2.spec.mjs` for
   the new runnable example and the glossary anchors if useful. Screenshots
   `man2-manual-390x844.png` and `man2-manual-1440x900.png`.
7. **Cards:** make a lane record `ManualR2` on Effect review page 2 (title "Manual r2 · The
   Tinkerer's Manual for a newcomer (Sonnet 5.5)") and post three or four cards with phone-size
   screenshots (images, not clips) of the new box, a figure, the glossary and the new chapter, and
   one card with the PDF's first new page.

Rules for this round:

- Every new sentence about how Splashery works must be true of main today. Cite the file and line in
  your PR for each new technical claim, so the Operator can check them quickly.
- Don't claim quality or speed you haven't measured.
- If the manual doesn't say how it was written, don't add a credit line yourself. Propose one in
  your final message: the owner wants AI-assisted work labeled as such.
- You own `manual/`, `tools/manual-pdf.mjs` (small changes only), `tests/man2.spec.mjs`, your
  `man2-*` screenshots and this file. Leave every other file alone, apart from Your book's thumbnail
  if step 5 needs it.
- Usage on this account is tight this week: one careful pass, no helpers. Before every push, follow
  CLAUDE.md's checklist.
- End with READY:, WORKING: or BLOCKED:. Add a "## State" section at the top of this file and keep
  it current.

## Brief

(Written by the Operator on September 28, 2026, from the owner's notes and the Pages into Splats
plan he accepted the same day; step 3 of ROADMAP.md, "Pictures and pages")

The owner's words: "I'm wondering if we could maybe create, like, a tinkerer operator manual or
something like that. You don't have to call it that, but it's something kind of like that where if
somebody knows the math, they could actually, you know, program a Gaussian splat to do something
using what we've provided." "I'd like to know if there's any way to kind of construct something so
that people can submit their own, like, Gaussian splat equations and play around with that stuff
here." "I'd like to know, you know, what the quote-unquote programming language is, and present it
to people so that they can do this stuff themselves." The accepted plan: "the splat equation toy
with a public Tinkerer's Manual that is also the book's default PDF."

Build two things:

1. **Splat equation** (`splat-equation`, on the Maths shelf, `labs: true`).
   - You type where the splats go and what color they are, as equations in u, v and time t: x(u, v,
     t), y(u, v, t), z(u, v, t), the ranges of u and v, a color (a hue expression, or r, g and b), a
     splat size and a splat count.
   - It uses lane Math's safe equation reader (src/equation.js: no eval, a 120-character cap, one
     friendly message per field). No code runs, so a link with equations is safe to share, and links
     carry them.
   - Famous presets: a sphere, a torus, a Möbius strip, a seashell, a trefoil knot, a wave, a spiral
     galaxy and a Klein bottle (figure-eight form).
   - t moves the shape in real time the way the graph and surface plotters bend with their a slider.
     Read docs/handoff/Math.md and reuse their method; don't invent a second one.
   - The tap plays one cycle of t, about 4 s.
   - If you truly need an engine change (for example, compiling the equations for the GPU), ask the
     Operator first (below).
2. **The Tinkerer's Manual**, a public page on the site: `manual/index.html` (with its own small
   stylesheet), at https://ryanjosephkamp.github.io/splashery/manual/.
   - It explains how to program splats, level by level, in plain American English for a curious
     teenager or adult:
     - **what a splat is**: a center, three sizes, a rotation, a color and an opacity. Each splat
       becomes a soft ellipse on screen, and all of them are sorted and blended back to front. Show
       the math with care, the Gaussian and the covariance built from the sizes and the rotation,
       with pictures;
     - **how a toy is built**: a short tour of the recipe format (the kit's shapes, colors from
       functions, parts that hinge, spin or slide, behaviors, controls and a tap action), with one
       small complete recipe;
     - **the splat equation language**: its grammar, functions and constants, the variables u, v and
       t, and a gallery of examples with links that open them in the toy;
     - **what comes later**: the Toy Workshop's "Code a toy" (full recipes, shared through a
       reviewed submission because running strangers' code from a link would be unsafe).
   - Pictures come from the site itself (screenshots of toys and diagrams you draw); no outside
     images unless CC0 and credited.
   - Link the manual from the About tab (one line in index.html, in a clearly marked block).
   - Print it to a PDF with Chromium (`tools/manual-pdf.mjs`) at manual/tinkerers-manual.pdf, laid
     out for print (letter size, page numbers, pictures that don't break across pages).
   - When lane Books has merged, merge main and make the manual the default book of Your book:
     change its sample to manual/tinkerers-manual.pdf in src/packs/pictures.js (that one line is
     yours then), and re-render the book's thumbnail. If Books hasn't merged by the time you're
     otherwise ready, say READY without it and tell the Operator.

Also give the splat equation toy:

- a sound (a soft rising tone as t plays);
- a how-to line and an About text;
- a toy-plan entry and a thumbnail;
- clips on the Effect review page: `man-equation` (typing an equation, then a preset) and
  `man-equation-play` (the tap);
- screenshots of the manual at 390×844 and 1440×900 as cards `man-manual-phone` and
  `man-manual-desktop`, plus the PDF's first two pages as a card `man-manual-pdf`.

You own:

- src/packs/splat-equation.js (new, category "maths");
- assets/toys/splat-equation/;
- manual/ (new) and tools/manual-pdf.mjs;
- the marked About-tab line in index.html;
- tests/man.spec.mjs, your `man-*` screenshots and docs/handoff/Manual.md;
- your lines in the shared lists;
- after lane Books merges, that one line in src/packs/pictures.js.

src/packs/maths.js and src/equation.js stay frozen. If the equation reader needs a new function, ask
the Operator first. Lanes Books and Screens run at the same time. Leave their files alone.

### The engine you build on (lane Pictures, PR #64, merged before you start)

Read docs/handoff/Pictures.md first, above all "Design" and "For the Operator: picture sheets". A
recipe shows a PDF, a picture, a GIF or a video on picture sheets:

- `pictures: { sample, accept }` names the media;
- `k.sheet({ id, center, width, height, normal, up, part, method, fit, align, leaf, lift, opacity })`
  places a sheet;
- `out.sheets[id] = { page, visible }` picks its page;
- `k.spine(...)`, `leaf: slot` and `out.leaves[slot] = { angle, curl }` turn and curl a page like
  paper (kind `leaf`; a leaf's sheet stays on part 0);
- `info.data.pictures` gives `page`, `count`, `kind`, `name`, `playing`, `next()`, `prev()`, `go(n)`
  and `togglePlay()`;
- the Toy tab's panel comes from `input: { title, media: { accept }, note }`.

The engine opens files and https addresses, builds each sheet in a worker, sharpens it as you zoom,
frees pages you leave, keeps video sound on the speaker button, and puts `toy.media` in links.
Budgets are per sheet and per device tier (`PICTURE_BUDGETS` in src/pictures.js). A toy that shows
three or four sheets at once shows three or four times one page's splats, so check the splat count
at each tier. The Picture lab (`src/packs/pictures.js`, labs only) is the working example.

Every new toy is `labs: true` in src/toys.js on the new "Pictures and pages" shelf (category as lane
Pictures set it up), except where this brief names another shelf. The owner turns labs on with
`?labs=1` and tries the toys on his phone. The labs switch comes off in a later small Ops change,
when he says so.

The owner's words (docs/reviews/2026-09-28-pictures/review.md, word for word): "It should all still
be Gaussian splats, like the rest of it is." "There needs to be enough resolution for it to still
resemble the original article. It doesn't have to be perfectly legible." "It's okay if we allow the
toys to be bigger than usual, possibly even larger in file size than usual, in order for the
resolution and quality to be better." Samples only under CC0, CC BY or public domain, checked on the
live source page and credited (CREDITS.md and the toy's in-app credit); no logos, brand names or
insignia. The laptop stays exactly as it is.

HOW THIS LANE RUNS

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews clips
  and merges. Don't ask him anything or wait for him. Put questions and blockers in your final
  message, and the Operator answers or relays them. Messages that arrive in this session "From the
  Operator" come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort. Any helper you start uses the same model (don't pick
  another one). Use at most one helper at a time.
- Language: every new public-facing text is in American English: toy names and descriptions, help
  texts, credits, docs, the handoff file, PR titles and bodies. So color, center, gray, math,
  license, toward, catalog, -ize endings, and dates like "September 28, 2026". Leave code
  identifiers, file names and anything stored in links as they are, and don't rewrite existing
  British text; a single sweep does that later.
- Read first:
  - CLAUDE.md (the ground rules and "Effect quality rules" are binding);
  - docs/OPERATING.md (file ownership, shared lists, generated files, tests, screenshots, the Effect
    review page and "Steps for a lane", the help review, merging);
  - docs/PACKS.md (recipes, channels, draw order, effect quality);
  - docs/handoff/Pictures.md;
  - docs/WORKSTREAMS.md and docs/handoff/history.md (lessons from earlier lanes).
- Your handoff file: create it. Start it with this brief, word for word, under "## Brief", then keep
  "## State

Started September 28, 2026. Branch `claude/lane-splat-manual`; draft PR #65, "Phase Manual: the
splat equation toy and the Tinkerer's Manual". Both parts are built; clips and cards are on the
Effect review page (lane `Manual`, cards `man-*`).

- **Splat equation** (`splat-equation`, `src/packs/splat-equation.js`, its own pack, category
  `maths`, `labs: true`). A program is a set of fields: `x`, `y`, `z` (in u, v and t), the ranges
  `u` and `v`, `hue` or `r`, `g`, `b`, `size`, `count` (100 to 10,000) and `spread` (`grid` or
  `random`). Typed in the Toy tab's panel, one field or several split by `;` (a text file: one per
  line); fields left out keep what is showing. Eight programs to start from (the Program list):
  sphere, torus, Möbius strip, seashell, trefoil knot, wave, spiral galaxy, Klein bottle (figure
  eight). A t slider, a Light and shade switch, and the tap plays t from 0 to 2π in 4 s. A program
  without t is drawn again splat by splat on a tap. Sound: a soft pad rising an octave (4 s).
- **The Tinkerer's Manual**: `manual/index.html` with `manual/manual.css`, pictures in `manual/img/`
  (all rendered from the site), the example recipe in `manual/example-recipe.js` (tested), and
  `manual/tinkerers-manual.pdf` (25 letter pages, numbered) printed by `tools/manual-pdf.mjs`.
  Levels: what a splat is (the Gaussian, Σ = R S Sᵀ Rᵀ, a worked example, the projection J W Σ Wᵀ
  Jᵀ, back-to-front blending), how a toy is built (a tour and a complete recipe), the splat equation
  language (fields, expressions, a grammar, time, safety), a gallery of 15 programs with links, and
  "What comes later: Code a toy". Linked from the About tab (a marked block in index.html).
- **Your book's default**: not done yet; lane Books has not merged (main has not moved since this
  lane started).
- Cards: `man-equation`, `man-equation-play`, `man-manual-phone`, `man-manual-desktop`,
  `man-manual-pdf`.

## Notes

- **Real-time t, lane Math's method.** The program is built at 12 times t = 2πj/12; copy j is a part
  (`t0` … `t11`) whose splats morph on channel 1 exactly into copy j + 1, and drive() shows the copy
  for the moment. Each copy is built in its own pose, so a turning shape also sorts right. In the
  last hundredth of a step the next copy shows instead (the same shape), so a cycle ends on copy 0,
  the rest pose (the tap test needs it).
- **u and v with a frozen reader.** `src/equation.js` knows x, y, t, r, θ, a and b. No function or
  constant name holds a u or a v, and none holds a y or a θ, so the pack refuses a typed x, y or θ
  and hands u and v to the reader as θ and y; its messages are translated back (the quoted parts and
  the "Use …" hint). No engine change.
- **Budget.** `density: 2` gives the toy 120,000 splats at the low tier, so 12 copies × 10,000
  splats always fit: a program looks the same on every device. Each copy is a cloud with
  `share = count / budget`.
- **Size is in the program's own units.** A cloud splat's size is the recipe-unit size when no
  surface sets the kit's base size (0.01), so `size / 0.01` is passed per splat. On screen a splat
  reads about 2.5 sizes across, so a size of about 0.6 of the spacing closes a surface.
- **Grid spacing.** The rows are shared by the shape's length along u and along v (measured on a 12
  × 12 grid at t = 0), so splats sit about evenly apart.
- **Outliers.** Points farther than 3 × the 98th percentile of all distances are left out, so an
  asymptote doesn't shrink the shape.
- The manual's pictures come from `.cache/`-only scratch tools (not committed): a still renderer for
  any program, and a clip script for the two review clips (a caption band under typing).

## Known issues

- Between two of the 12 moments a splat moves in a straight line, so a turning shape dips inward by
  about 3 percent mid-step. It reads as smooth motion at phone size.
- A program whose shape at t = 2π differs from t = 0 (plain `t` in it) jumps back at the end of a
  tap. The manual says so ("Make it loop").
- Color and size are evaluated at each of the 12 moments, so if they use t they change in 12 small
  steps.
- The panel's file button reads a text file as a program (one field per line), which is the only
  file it takes.
- The t slider does nothing for a program without t.
- The gallery links point at the live site, so they work only after the merge.

## For the Operator

- Your book's default: when lane Books merges, this lane changes Your book's sample to
  `manual/tinkerers-manual.pdf` and re-renders its thumbnail (the brief's one line in
  `src/packs/pictures.js`).
- Engine idea (not needed now): `src/equation.js` could allow the variables u and v directly; the
  pack's letter swap would then go away.
- PACKS.md lesson: a recipe with only clouds has no base size, so a cloud splat's `size` is in
  recipe units times 100 (base 0.01); set it from your own units.
- README line: the manual is at `manual/` (and its PDF), linked from the About tab.
- No exceptions needed in `tests/taps.spec.mjs`.
- Two other lanes' spec files count toys and fail with this lane's new toy (only the Operator or
  their lanes edit them): `tests/hta.spec.mjs` expects 149 toys on its shelves (the Maths shelf now
  has one more: 150), and `tests/pic.spec.mjs` ("the Picture lab is a labs toy on its own shelf, and
  only it") expects Picture lab to be the only labs toy (now also `splat-equation`; lanes Books and
  Screens will add more). Suggested: count only the toys that aren't `labs`, and check that every
  labs toy is kit-built instead of listing them.
