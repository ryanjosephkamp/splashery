# Lane Manual: the splat equation toy and the Tinkerer's Manual

Prefix `man`. Branch `claude/lane-splat-manual`, PR "Phase Manual: the splat equation toy and the
Tinkerer's Manual". How lanes work: [OPERATING.md](../OPERATING.md). Earlier lessons:
[history.md](history.md).

## Brief

(Written by the Operator on September 28, 2026, from the owner's notes and the Pages into Splats plan he accepted the same day; step 3 of ROADMAP.md, "Pictures and pages")

The owner's words: "I'm wondering if we could maybe create, like, a tinkerer operator manual or something like that. You don't have to call it that, but it's something kind of like that where if somebody knows the math, they could actually, you know, program a Gaussian splat to do something using what we've provided." "I'd like to know if there's any way to kind of construct something so that people can submit their own, like, Gaussian splat equations and play around with that stuff here." "I'd like to know, you know, what the quote-unquote programming language is, and present it to people so that they can do this stuff themselves." The accepted plan: "the splat equation toy with a public Tinkerer's Manual that is also the book's default PDF."

Build two things:

1. **Splat equation** (`splat-equation`, on the Maths shelf, `labs: true`).
   - You type where the splats go and what color they are, as equations in u, v and time t: x(u, v, t), y(u, v, t), z(u, v, t), the ranges of u and v, a color (a hue expression, or r, g and b), a splat size and a splat count.
   - It uses lane Math's safe equation reader (src/equation.js: no eval, a 120-character cap, one friendly message per field). No code runs, so a link with equations is safe to share, and links carry them.
   - Famous presets: a sphere, a torus, a Möbius strip, a seashell, a trefoil knot, a wave, a spiral galaxy and a Klein bottle (figure-eight form).
   - t moves the shape in real time the way the graph and surface plotters bend with their a slider. Read docs/handoff/Math.md and reuse their method; don't invent a second one.
   - The tap plays one cycle of t, about 4 s.
   - If you truly need an engine change (for example, compiling the equations for the GPU), ask the Operator first (below).
2. **The Tinkerer's Manual**, a public page on the site: `manual/index.html` (with its own small stylesheet), at https://ryanjosephkamp.github.io/splashery/manual/.
   - It explains how to program splats, level by level, in plain American English for a curious teenager or adult:
     - **what a splat is**: a center, three sizes, a rotation, a color and an opacity. Each splat becomes a soft ellipse on screen, and all of them are sorted and blended back to front. Show the math with care, the Gaussian and the covariance built from the sizes and the rotation, with pictures;
     - **how a toy is built**: a short tour of the recipe format (the kit's shapes, colors from functions, parts that hinge, spin or slide, behaviors, controls and a tap action), with one small complete recipe;
     - **the splat equation language**: its grammar, functions and constants, the variables u, v and t, and a gallery of examples with links that open them in the toy;
     - **what comes later**: the Toy Workshop's "Code a toy" (full recipes, shared through a reviewed submission because running strangers' code from a link would be unsafe).
   - Pictures come from the site itself (screenshots of toys and diagrams you draw); no outside images unless CC0 and credited.
   - Link the manual from the About tab (one line in index.html, in a clearly marked block).
   - Print it to a PDF with Chromium (`tools/manual-pdf.mjs`) at manual/tinkerers-manual.pdf, laid out for print (letter size, page numbers, pictures that don't break across pages).
   - When lane Books has merged, merge main and make the manual the default book of Your book: change its sample to manual/tinkerers-manual.pdf in src/packs/pictures.js (that one line is yours then), and re-render the book's thumbnail. If Books hasn't merged by the time you're otherwise ready, say READY without it and tell the Operator.

Also give the splat equation toy:
- a sound (a soft rising tone as t plays);
- a how-to line and an About text;
- a toy-plan entry and a thumbnail;
- clips on the Effect review page: `man-equation` (typing an equation, then a preset) and `man-equation-play` (the tap);
- screenshots of the manual at 390×844 and 1440×900 as cards `man-manual-phone` and `man-manual-desktop`, plus the PDF's first two pages as a card `man-manual-pdf`.

You own:
- src/packs/splat-equation.js (new, category "maths");
- assets/toys/splat-equation/;
- manual/ (new) and tools/manual-pdf.mjs;
- the marked About-tab line in index.html;
- tests/man.spec.mjs, your `man-*` screenshots and docs/handoff/Manual.md;
- your lines in the shared lists;
- after lane Books merges, that one line in src/packs/pictures.js.

src/packs/maths.js and src/equation.js stay frozen. If the equation reader needs a new function, ask the Operator first. Lanes Books and Screens run at the same time. Leave their files alone.

### The engine you build on (lane Pictures, PR #64, merged before you start)

Read docs/handoff/Pictures.md first, above all "Design" and "For the Operator: picture sheets". A recipe shows a PDF, a picture, a GIF or a video on picture sheets:
- `pictures: { sample, accept }` names the media;
- `k.sheet({ id, center, width, height, normal, up, part, method, fit, align, leaf, lift, opacity })` places a sheet;
- `out.sheets[id] = { page, visible }` picks its page;
- `k.spine(...)`, `leaf: slot` and `out.leaves[slot] = { angle, curl }` turn and curl a page like paper (kind `leaf`; a leaf's sheet stays on part 0);
- `info.data.pictures` gives `page`, `count`, `kind`, `name`, `playing`, `next()`, `prev()`, `go(n)` and `togglePlay()`;
- the Toy tab's panel comes from `input: { title, media: { accept }, note }`.

The engine opens files and https addresses, builds each sheet in a worker, sharpens it as you zoom, frees pages you leave, keeps video sound on the speaker button, and puts `toy.media` in links. Budgets are per sheet and per device tier (`PICTURE_BUDGETS` in src/pictures.js). A toy that shows three or four sheets at once shows three or four times one page's splats, so check the splat count at each tier. The Picture lab (`src/packs/pictures.js`, labs only) is the working example.

Every new toy is `labs: true` in src/toys.js on the new "Pictures and pages" shelf (category as lane Pictures set it up), except where this brief names another shelf. The owner turns labs on with `?labs=1` and tries the toys on his phone. The labs switch comes off in a later small Ops change, when he says so.

The owner's words (docs/reviews/2026-09-28-pictures/review.md, word for word): "It should all still be Gaussian splats, like the rest of it is." "There needs to be enough resolution for it to still resemble the original article. It doesn't have to be perfectly legible." "It's okay if we allow the toys to be bigger than usual, possibly even larger in file size than usual, in order for the resolution and quality to be better." Samples only under CC0, CC BY or public domain, checked on the live source page and credited (CREDITS.md and the toy's in-app credit); no logos, brand names or insignia. The laptop stays exactly as it is.

HOW THIS LANE RUNS

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews clips and merges. Don't ask him anything or wait for him. Put questions and blockers in your final message, and the Operator answers or relays them. Messages that arrive in this session "From the Operator" come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort. Any helper you start uses the same model (don't pick another one). Use at most one helper at a time.
- Language: every new public-facing text is in American English: toy names and descriptions, help texts, credits, docs, the handoff file, PR titles and bodies. So color, center, gray, math, license, toward, catalog, -ize endings, and dates like "September 28, 2026". Leave code identifiers, file names and anything stored in links as they are, and don't rewrite existing British text; a single sweep does that later.
- Read first:
  - CLAUDE.md (the ground rules and "Effect quality rules" are binding);
  - docs/OPERATING.md (file ownership, shared lists, generated files, tests, screenshots, the Effect review page and "Steps for a lane", the help review, merging);
  - docs/PACKS.md (recipes, channels, draw order, effect quality);
  - docs/handoff/Pictures.md;
  - docs/WORKSTREAMS.md and docs/handoff/history.md (lessons from earlier lanes).
- Your handoff file: create it. Start it with this brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "## For the Operator" current, like the other lanes' files.
- Shared lists: edit only your own toys' entries in src/toys.js, src/toy-sounds.js, src/toy-help.js (a how-to line and an About text for each toy, following the style guide in docs/handoff/Help.md), tools/toy-plan.json, CREDITS.md and tools/assets.json. Regenerate docs/TOY-PLAN.md with `node tools/toy-plan.mjs`; never merge it by hand (on a conflict, take main's copy and run the tool again).
- Never edit tests/taps.spec.mjs. If one of your toys needs an exception there, say so in your final message, and the Operator adds it. Your own tests go in tests/<prefix>.spec.mjs.
- Engine changes: if you truly need one (media, pictures, player, stage, effects, kit, UI), keep it small, additive and tested, on its own branch (<your branch>-engine) with its own draft PR titled "Engine: …", which merges first. Say so in your final message. Two other picture lanes run beside you, so tell the Operator before you start one, in case another lane needs the same thing.
- Sounds: give each toy the sound its idea describes (src/toy-sounds.js, existing voices in src/voices.js). Don't polish them: the new toys get their own sound round later, and sound lanes may be editing other toys' lines at the same time (keep both sides when you merge).
- Review: post a clip of every toy's tap and its main play to the Effect review page, https://claude.ai/artifact/NCsg9V5SzFY3Mnwuwgq7pi, as OPERATING.md's "Steps for a lane" says. The Operator has made your lane's record. tools/pic-clip.mjs records picture toys. Judge every effect as motion at phone size against the effect quality rules before you post it. Don't republish the page, and never write to "verdicts".
- Before every push, follow "Before every push" in CLAUDE.md:
  - the full Playwright suite (SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test);
  - prettier and `node tools/us-english.mjs --diff`;
  - `node tools/check-packs.mjs <pack>`, a contact sheet and thumbnails;
  - your own screenshots at 390×844 and 1440×900.

  Then put back the standard screenshots (`node tools/upkeep.mjs --restore-shots`) and any other lane's screenshots your branch didn't change (`git checkout -- tests/screenshots/`, then re-add your own).
- PR: one draft PR against main with the five sections (Summary, Verification, Deviations, Known issues, What was cut). Never merge anything. When main moves, merge it into your branch (never rebase a pushed branch).
- After you post your cards, check the owner's marks (the "verdicts" collection, ids starting with your prefix) about once an hour with a scheduled check-in (send_later). Fix every "fix" in the same PR, post the new clip as a "-r2" card, and set replacedBy on the old one. Stop the check-ins once your PR is merged or closed.
- Finish every working turn with a short final message that starts with "READY:" (PR link, card ids, test results, anything for the Operator), "WORKING:" (what's left), or "BLOCKED:" (exactly what you need).

Start now: read the docs, docs/handoff/Math.md and src/equation.js, create docs/handoff/Manual.md, open your draft PR early, build the splat equation toy, then write the manual and its PDF. Post clips and cards as you finish each. When both are done and the checks pass (and, if lane Books has merged by then, the manual is the book's default), finish with "READY:".

## State

Started September 28, 2026. Branch `claude/lane-splat-manual`. Building the splat equation toy
first, then the manual and its PDF.

## Notes

## Known issues

## For the Operator
