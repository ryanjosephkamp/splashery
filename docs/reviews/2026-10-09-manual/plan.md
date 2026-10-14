# The Tinkerer's Manual: the plan after the October 9 review

The owner reviewed the Tinkerer's Manual on October 9, 2026. His notes stay private at his request.
This file is the Operator's summary in the Operator's words, and the plan that follows from it. The
facts behind the answers come from the code on main at `7f435756`.

## What the owner wants

- **Keep everything that's there.** He likes the web version a great deal. Nothing gets removed
  unless it is wrong.
- **Fix and expand what's there:**
  - define the terms a newcomer won't know;
  - explain why each number is what it is;
  - give sources a proper References section.
- **Add what Splashery has gained since the last update:** the Sharp view, hands-on play, the
  Studio, codes and pages, science and imaging, the arcade, and more.
- **Make the web version interactive.** The demos come later. This round only marks where each demo
  goes and what it shows, so text changes can't break a finished demo. The PDF keeps static figures.
- **The cycle.** Codex audits text, figures, and demos, then the owner reviews, and the cycle
  repeats until it all checks out.
- **Two writing rules from now on:**
  - The serial (Oxford) comma: "a, b, and c". This is now in CLAUDE.md.
  - Every link from the manual opens in a new tab: links to the app (the Splashery Playground), to
    GitHub, and to any other site.
- **The owner's names for the two web locations:**
  - **the Splashery Playground:** the app at the site's root
    (https://ryanjosephkamp.github.io/splashery/);
  - **the Splashery site:** the pages under `site/` and the manual.
- **Experiments stay separate.** Other choices of the kit's numbers (budgets, parts, fields, field
  length, moments, view-dependent color) may be explored only as separate experiments. They must
  never replace what works.

## Manual r3 (`man3`, Sonnet): the text round

Files: `manual/index.html`, `manual/manual.css`, `tools/manual-pdf.mjs` (small changes), and
`tests/man3*.spec.mjs`. The web version is the hand-written `manual/index.html`. The PDF is printed
from it by `tools/manual-pdf.mjs`.

### 1. The owner's own edits, as he worded them

- **Level 1, the first paragraph**, becomes: "A **splat** is a small cloud of color floating in
  space. Up close, it looks like a soft ellipse, bright in the middle and fading at the edges. On
  its own, it is nothing much. Put thousands side by side, however, and they melt into surfaces: a
  torus, a seashell, a cat – practically any object imaginable can be built from splats!"
- "A splat is not a surface of triangles and not a rigid little ball" becomes "A splat is neither a
  surface of triangles nor a rigid little ball."
- "In one dimension, a bell…" becomes "In one data dimension, a bell…". Add a line that the data are
  one-dimensional while the drawing needs two.
- "In three dimensions the width…" gets a comma after "dimensions".
- **The colors sentence** becomes: "A color can be a fixed quantity or vector (`"#9c3b2c"`, or
  `[r, g, b]` with each from 0 to 1; there are no color names), or it can be a function that the kit
  calls for every splat."
- **The aliases paragraph** becomes a "Flexibility" list:
  - the alternative names (`color` for `hue`; `red`, `green`, and `blue` for `r`, `g`, and `b`;
    `splats` for `count`; `x(u,v,t)` for `x`; also `colour` and `n`, which the code accepts);
  - the three ways to write a range;
  - names are not case-sensitive;
  - notes after a `#`.
- **The grammar's introduction** becomes: "Here is the core grammar. Note: words in quotes must be
  typed exactly as written below."

### 2. Definitions a newcomer needs

Define each of these where it first appears, and in the glossary:

- **The kit:** Splashery's toy-building library. A recipe names shapes, colors, and moving parts.
  The kit fills them with splats in the browser, spreading the budget evenly by area. A kit toy is
  built this way; a scan or capture is loaded from a file.
- **The weight field and the positive widths:** a number at every point, 1 at the center and falling
  off. The three widths are the splat's sizes along its own axes. They must be above zero.
- **Quadratic form:** with a two-dimensional example.
- **Affine:** a straight-line map plus a shift.
- **Tilt:** the off-diagonal terms of Σ. Say "rotation" where the manual means a splat's own turn,
  and keep "Tilt lock" for the camera control.
- **Smoothstep,** with a link to Wikipedia's article.
- **The grammar's notation:** what `=`, `|`, `{ }`, `[ ]`, and quotes mean, and what an atom is.
- **u and v:** the coordinates of the flat sheet of points before the equations bend it into shape.
  These are parametric-surface parameters, not a substitution.

### 3. "Why this number?" notes

One short note each, with where it lives:

- **The splat budgets and what Auto does.** Auto reads memory, cores, and screen size, never picks
  Max, and steps down when frames are slow. More splats help a toy's shape, not its grain.
- **One color per splat:** kit splats have nothing to learn view-dependent color from, and the
  engine version turns it off for generated toys.
- **Fifteen parts:** the 4-bit part number and the shader's space.
- **Twelve fields:** links keep 16 option keys per toy.
- **The 120-character limit:** our choice, for link length.
- **Twelve moments:** 12 copies × 10,000 points fit the weakest device; each moment is a part.
- **Twelve bits:** real binary digits; two 12-bit numbers fit exactly in one 32-bit float.
- **The two clocks:** t runs over 0 to 2π, while a play takes about 4 seconds of real time.

### 4. Corrections

- **The printed grammar is slightly out of date.** Add the `[ ]` and `{ }` brackets and arcsin,
  arccos, and arctan, and give the real rule for bare arguments ("sin 2u", "sin u cos u", "sin
  u^2").
- **Rewrite "Any field you leave out keeps what is showing"**: if you type only a new hue, the shape
  stays and only the color changes.
- **Add the opening line's context.** It still holds; mention that the Sharp view is a second view
  of the photo toys, which are still splats.

### 5. Structure

- **A level map at the start:** a ladder from one splat up to making your own.
- **New levels for what Splashery has gained.** The proposal below goes to the owner first, as a
  placeholder:
  - Level 6, moving things: hands-on play, joints, and physics.
  - Level 7, real data as splats.
  - Level 8, photos and video into 3D.
  - Level 9, codes and pages.
  - Level 10, make your own.
- **A References section near the end.** Numbered entries in a consistent citation style. Link each
  source where it is cited.
- **New-tab links.** Every link from the manual opens in a new tab, including "Back to Splashery"
  and the cover link. Reuse `newTabLinks()` from `tools/site-pages.mjs`, or edit by hand, and extend
  the `st2` test to cover `manual/index.html`.
- **Roomier figures.** Figures 2 and 3 are drawn at 360 units wide and feel cramped. Widen them on
  the web, and keep the PDF's layout.
- **"Run it yourself" with a prompt.** Beside the steps, add a prompt the reader can paste into a
  coding assistant to do the same steps.

### 6. Demo placeholders (web only)

Each placeholder is a clearly marked box saying what the demo will show, so Codex and the owner can
check the plan before anything is built:

- A 3D Gaussian, shown instead of told.
- The numbers in one splat (center, sizes, rotation, color, opacity), each with its own control.
- The 1D bell growing into the 3D bell, and G(p) at a point.
- A valid and an invalid covariance (the matrix falls off, or doesn't).
- The covariance built from sizes and a rotation (the existing figure, made interactive).
- From 3D to the screen: what the projection does to an ellipsoid.
- Sorting and blending, back to front.
- Where each part of a recipe shows on the windmill.
- The (u, v) grid turning into the torus, dot by dot.
- The fields of a program, labeled on the toy, with a small simulator.
- The order of operations, as a tree.
- The grammar as a railroad diagram.
- The t slider, looping, and the 12 moments (the existing Figure 3, made interactive).

Prototypes of three of these are on the Operator's private answers page. They show the size and feel
intended.

### 7. Expansion (after 1 to 6)

A chapter or a level for each part of Splashery added since the last update: the Sharp view,
hands-on play, the Studio tools, codes and pages, science and imaging, the arcade, and the labs.
Each gets short text, one picture, and a link to try it.

### The order of work

1. The text round (1 to 6) on one branch, with the PDF reprinted.
2. Codex audits it (a later task, like task 13).
3. The owner reviews.
4. The expansion (7).
5. The demos are built and audited last.

## Separate experiments (not this round)

A future **Kit lab** lane behind the labs switch, with every default unchanged. Its pages compare
choices side by side:

- a Detail slider from Low to Max;
- view-dependent color on a few kit toys, from our own data and shader with no engine edit;
- 15 and 24 moments of t;
- 240-character fields and one more field (opacity);
- more than 15 parts. This is the largest change: it needs an Engine PR and a check on real phones.

## The program gallery

Level 4's gallery becomes a first-class page on the Splashery site, with many more programs. It is
written for Codex as task 33 (docs/codex/33-program-gallery.md). It is also a test of how well Codex
writes recipes.

## The owner's answers of October 10, 2026

The owner read the Operator's answers to his manual questions and approved nearly all of them for
the manual. His notes stay private. This is the Operator's summary.

- **The answers go into the manual.** Nearly everything on the answers page belongs in the manual,
  in the manual's voice: the budgets table and what Auto does, one color per splat, the kit's
  definition, the field and moment limits, the grammar table, and the demos (covariance, the grammar
  reader, and the moments).
- **A note for every choice.** Each limit says whether the format forces it or we chose it, and what
  would change with a different choice. That includes three new questions:
  - Could a toy have different parts?
  - Could the equation toy have different fields?
  - Why is each moment a part, and what else could work?
- **The budget evidence.** The manual shows lane Sharpness's measurement (docs/lab/SHARPNESS.md:
  140,000 against 200,000 splats on 14 toys) and what it didn't test. The Kit lab reruns it at a
  larger scale.
- **A smoothstep demo.** An interactive curve beside a linear ramp, and a small shape whose turn
  uses it.
- **What Splashery can do that other splat tools can't.** It goes in the manual now, and on the site
  once the manual text settles. "A whole scene in a link" gets more detail: links are compressed,
  and they carry settings, not files.
- **Open questions in plain view.** Every choice not yet tested is listed as an open question, with
  what an experiment would show and whether one is planned.
- **A lighter layout.** The text is kept, but definitions, derivations and notes fold closed,
  glossary terms pop up on hover or tap, and long tables fold away. The PDF prints everything open.
  The owner will review it again and may adjust it.
- **The Kit lab starts now**, smallest experiments first:
  1. a larger budget sweep;
  2. the Detail slider;
  3. view-dependent color;
  4. up to 15 moments. The 240-character fields are approved and go in the same lane. More parts, an
     opacity field, and formulas on the graphics chip stay open.
- **Links and short links.** A URL shortener needs a server and would store people's scenes off
  their devices, so it isn't planned. Any change to the "no server" rule is the owner's call.
  Shorter links without a server (a compression dictionary) and a "scene as a QR code" button are
  possible Kit lab items.

Lanes: Manual r3, part 2 (`claude/lane-manual-r3-2`, Sonnet 5.5), and Kit lab (`klab`, Opus 5.5).
Codex task 33's gallery (#478) is reviewed by the Manual lane, and task 32 (#479) by the Photo depth
lane.
