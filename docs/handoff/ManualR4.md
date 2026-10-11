# Lane Manual r4 (prefix `man4`)

## Brief

Operator → Manual (Sonnet 5.5, high effort), October 10, 2026, 23:21 UTC. A new round: Manual r4
(prefix `man4`), from the owner's notes of October 10. Branch `claude/lane-manual-r4` from main
(5339c194 or newer), one PR "Phase Manual r4: the budget table, the 'What Splashery can do' page,
and the demos". Start a new handoff section "Round 4" in docs/handoff/ManualR3.md (or a new
docs/handoff/ManualR4.md that starts with this brief word for word).

1. **The splat-budget table on the site.** The owner loved the table comparing splat budgets (140k
   against 200k: speckle and shimmer up on most toys, edges barely sharper; data in
   docs/lab/SHARPNESS.md and docs/lab/BUDGETS.md). Put a clear, phone-friendly version (the table
   scrolls in its own box, no page scroll) in the manual where Level 2 or 3 talks about splat counts
   and detail, with a short plain explanation of what the columns mean and what it shows. Link it
   from the site's Learn hub (site/learn). Numbers come from those docs only; don't invent any.
2. **"What Splashery can do" as a site page.** The manual already has "What else Splashery does now"
   and "What Splashery can do that other splat tools can't". Make a site page from them (through the
   site's own build, tools/site-build.mjs and its sources), linked from the site menu or the Learn
   hub and from the manual. Keep the claims honest and current (labs toys say so).
3. **The demo placeholders**, as live demos like the four already built (covariance, reader,
   moments, smoothstep): `grammar-railroad` first, then `gaussian-3d`, `splat-numbers`,
   `bell-1d-to-3d`, `projection`, `sort-blend`, `windmill-parts`, `uv-torus` and `program-fields`.
   Check every number and formula they show (say how in the PR). If time runs short, finish fewer
   demos well rather than all of them roughly.
4. **Not in this round:** Levels 6 to 10 and any layout changes. The owner audits Levels 1 to 5 and
   the demos first; his audit decides those.

Ownership: `manual/`, `tools/manual-pdf.mjs` (small changes), `tests/man4*.spec.mjs`, and the one
new site page with its source and links (if a site file belongs to another running lane, ask me
first). Cards `man4-…` on Effect review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK,
no republish): a phone-size clip or screenshot of each demo, the table and the new page, each naming
Sonnet 5.5. American English and the serial comma. Before READY, run CLAUDE.md's "Before every push"
steps. The manual is public, so the Operator merges after the full suite and the owner's marks.
Finish every turn with READY:, WORKING: or BLOCKED:.

## State

Model: Sonnet 5.5 (claude-sonnet-5-5), high effort. Started October 10, 2026, 23:23 UTC, from main
`5339c194`. Branch `claude/lane-manual-r4`. Lane record `ManualR4` on Effect review page 2.

Done, by the brief's item:

1. **The budget table** (Level 2, "How many splats? What a bigger budget does", `#splat-count`). Two
   tables that scroll in their own boxes (the toy's name stays in view; a keyboard can scroll them):
   the same 24 views at 140,000 and 200,000 splats (edge, speckle, shimmer, and the area of thin
   parts at 60,000 and 140,000), and the five budgets against 140,000 across all the views. A plain
   explanation of the four columns and of what the table shows. `node manual/build-budget.mjs`
   writes both tables from `docs/lab/BUDGETS.md`, so no number is typed by hand; the counts in the
   text ("rose in 21 of the 24 views") are counted from the table by the same code, and a test
   checks the page against the document. The Learn hub links it ("How many splats? What a bigger
   budget does").
2. **"What Splashery can do"** as a site page at `learn/can-do/`, built by the site's own build
   (`tools/site-hubs.mjs`, an article page type; `tools/site-pages.mjs`, the page and the Learn
   hub's card). The toy counts, every toy link, and each "labs" badge come from the catalog when the
   site is built, so the page cannot go stale on those; a test checks them. It is linked from the
   Learn hub and from the manual (the two chapters it comes from). The prose is the manual's two
   chapters, re-read against the code.
3. **The nine demos**, all live (no placeholder is left), each with a print still and a link in the
   PDF. How each was checked:
   - **Grammar as tracks** (`#demo-railroad`): the diagram is drawn from the same data that writes
     the walks (`manual/railroad.js`). A test compares the data with the manual's grammar text rule
     by rule, and sends 6,000 walks (and a compact spelling of each, 12,000 reads) through the toy's
     own reader (`readStatements` and `compileProgram`): every one is accepted, apart from a few in
     ten whose numbers do not work (a log of 0, a flat range), which the page reports in the
     reader's own words. Doing this found four places where the manual's grammar said more than the
     reader accepts, now corrected in the text, the diagram, and the prose: a function with one
     input takes exactly one value (min and max take two or more); a bare input is numbers and names
     (the old rule also let a bracket in, but a bracket after a function is always a call); a `| |`
     pair cannot sit directly inside another; and a range end cannot hold `min` or `max` (their
     comma would split the range).
   - **A 3D Gaussian** (`#demo-gaussian`): the shells' weights are exp(−k²/2) (0.607, 0.135, 0.011);
     tests send points of each shell through the matrix formula, and check that the dots follow the
     Gaussian (their covariance is Σ).
   - **The numbers in one splat** (`#demo-numbers`): 14 numbers, the rotation as three turns made
     into the quaternion by the kit's own function (a test compares the two on 200 random turns, and
     the page's quaternion with the kit's); only the numbers you change are marked.
   - **The bell** (`#demo-bell`): 1D, 2D, and 3D; a test compares the value shown with the formula
     and with the matrix form, with hand values.
   - **From 3D to the screen** (`#demo-projection`): the solid line is the shell's real outline
     through the true perspective map; the dashed ellipse is Σ′ = J W Σ Wᵀ Jᵀ. Tests check J against
     finite differences, Σ′ against the covariance of 60,000 projected samples, the orthographic
     limit exactly, and that the gap grows steadily as the camera comes in.
   - **Sorting and blending** (`#demo-blend`): the table is the "over" formula; a test checks it
     against the closed form from the nearest (and a hand example), and that the transmittance does
     not depend on the order, only the color.
   - **The windmill** (`#demo-windmill`): the real recipe (`manual/example-recipe.js`) built by the
     real kit (12,000 splats); the lines are buttons, and the splat counts come from the kit's own
     item ranges (a test builds the same windmill and compares each count). The sails part turns
     about its real pivot.
   - **The grid and the torus** (`#demo-uvtorus`): positions come from the toy's own reader on the
     program in the manual (a test compares with the analytic torus).
   - **The fields** (`#demo-fields`): the splats come from the Splat equation toy's own recipe,
     built from the typed fields; the page compares the new splats with the last ones (count,
     places, colors, sizes), so each field's effect is measured, not described. A test checks that
     `hue` changes only colors, `size` only sizes, and that a bad field shows the toy's own message.
4. **Kept in step with the Kit lab** (not in the brief, but the manual had gone out of date on it):
   fields are 240 characters (the plotters keep 120), Moments of t can be 12 to 15 in labs, the
   Detail slider and the gloss comparison exist in labs. The affected text and the "Open questions"
   rows are corrected, and the budget claim "up to 200,000 splats" is now "60,000 to 400,000".

The PDF is reprinted: 74 pages, 6.9 MB (was 67 pages, 5.3 MB; the nine stills are the difference).

## Notes

- The new files: `manual/demo-math3.js` (the 3D demos' math, pure), `manual/demos2.js` (the pages'
  wiring; it imports the real kit, the toy's recipe and reader), `manual/railroad.js`,
  `manual/build-budget.mjs`, `manual/make-stills.mjs` (the print stills; needs the local server).
- The tests are `tests/man4.spec.mjs` (33). Changed: `tests/man3.spec.mjs` (no placeholders left;
  the updated date), `tests/man3-2.spec.mjs` (two sentences that now read differently),
  `tests/ln.spec.mjs` (the PDF may be up to 8 MB).
- To redo the stills after a change to a demo: serve the repo and run
  `SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node manual/make-stills.mjs`, then the PDF.

## Known issues

- Everything in "What Splashery can do" that came from the manual's two chapters was read again
  against the code on October 10, 2026, but a toy that changes later (for example, leaving labs)
  will show the right badge on its own link only; the sentences about it do not follow.
- The projection demo keeps the picture the same size at every distance (the zoom grows with the
  distance) on purpose; a real camera does not. The hint says so.
- The windmill's sails turn the same way as the kit's part turn only in size, not necessarily in
  direction (the slider is a picture of "one solid piece", not of the toy's wind).
- Not in this round, by the brief: Levels 6 to 10, layout changes.

## For the Operator

- Cards `man4-…` are on Effect review page 2 (phone-size screenshots of each demo, the table, and
  the new page).
- The site files are regenerated (`site/learn/can-do/`, the Learn hub, search, sitemap, the service
  worker). `site/new/` is left as it was (it follows main's history).
- `tests/ln.spec.mjs` now allows an 8 MB PDF. Say if you would rather keep 6 MB and I make the
  stills smaller.
