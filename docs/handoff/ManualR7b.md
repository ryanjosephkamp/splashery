# Lane Manual r7b (prefix `man7b`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session,
session_01Mo8sLhAitbYjZiPgD8Hc4t). Repo: ryanjosephkamp/splashery. Your lane: Manual r7b (id
`ManualR7b`, prefix `man7b`). Branch: `claude/lane-manual-r7b` from main. PR title: "Phase Manual
r7b: Chapters 6 to 10 and the back matter". Handoff file: docs/handoff/ManualR7b.md (create it;
start it with this brief, word for word, under "## Brief", then keep "## State", "## Notes", "##
Known issues" and "## For the Operator" current). Model: Sonnet 5.5, at high effort.

Read CLAUDE.md, docs/HANDOFF.md ("Now"), docs/OPERATING.md, docs/handoff/ScienceR3.md ("How this
lane runs"), then docs/handoff/ManualR6.md, ManualR5.md and ManualR4.md (how the manual, its chapter
pages, its demos and its PDF are built), and docs/reviews/2026-10-09-manual/plan.md (the manual
plan; Chapters 6 to 10 were placeholders). A second lane, Manual r7a (`man7a`), makes the demos
crisp and adds pictures to chapters 1 to 3 and the "more", "unique" and "built" pages at the same
time; the file split below keeps you apart.

### Brief (written by the Operator on October 11, 2026, from the owner's manual walkthrough that evening)

The owner wants the Tinkerer's Manual finished and current before the weekly reset, then audited by
Codex, then his single rewording pass. Change no existing wording except where a fix below needs it.
Your job:

1. **Write Chapters 6 to 10** (today one placeholder page, manual/coming.html, listed in
   manual/pages.mjs): 6 Moving things (hands-on play, grabbing, joints, rigid parts and
   MotionDriver, the physics bodies), 7 Real data as splats (molecules, earthquakes, the night sky,
   volumes and point clouds, weather and the other data toys, with their live-data rules), 8 Photos
   and video into 3D (Photo to 3D, Moving photo, Video to 3D, the Sharp view, the photoreal
   captures), 9 Codes and pages (QR codes and barcodes, pictures and pages, PDFs and GIFs, the
   Wikipedia book, share links), 10 Make your own (recipes and the kit, the Studio, opening your own
   files, sharing). Same voice and depth as Chapters 1 to 5: what it is, how Splashery does it (from
   the code in src/ and tools/, never from memory; every number from the code or a measurement),
   why, and where to try it (links that open the toy in the Splashery Playground in a new tab). Say
   clearly which parts are behind the labs switch. Use real figures (stills of the actual toys;
   manual/make-stills.mjs is r7a's file, so make your own stills with a small script of yours) and
   mark where a later demo would go, as the plan did for Chapters 1 to 5. Each chapter gets its own
   page file and its place in pages.mjs, the navigation, the combined page (all.html) and the PDF's
   page list; remove the placeholder (keep its old anchors working).
2. **Back matter:** expand the glossary (every term a newcomer meets in Chapters 1 to 10), Further
   reading (more papers and notable projects with Gaussian splats, including robotics and other
   applications; link only, with correct titles and authors checked on the live source, nothing
   copied), References (every source cited, numbered, one style) and the Quick reference
   (manual/card.html: the grammar, the controls and the key numbers on one page).
3. **"What comes later" (manual/later.html)** says "Level 2"; the manual's chapters are "Chapter"
   now. Make the naming consistent everywhere (titles, text, links, anchors; keep old anchors
   working).
4. **The footer:** in "Part of Splashery, a toy box of 3D Gaussian splats that runs in your
   browser", the word "Splashery" must open the Splashery site's home page (site/, the front door;
   check it stays right after the staged front-door swap in tools/site-front-door.mjs), in a new
   tab. "Back to the Splashery Playground" keeps opening the Playground in a new tab.

Rebuild the PDF (tools/manual-pdf.mjs, with the Chromium it pins) only when the Operator tells you
that main carries Manual r7a; until then leave the tracked PDF alone. American English, the serial
comma, and the manual's existing voice. Cards: a 390×844 screenshot of each new chapter's opening
and of each back-matter page.

You own: manual/pages.mjs, manual/build-pages.mjs, manual/nav.js, manual/redirect.js,
manual/coming.html and the new chapter pages, manual/glossary*.{html,js}, manual/reading.html,
manual/references.html, manual/card.html, manual/later.html, manual/experiments.html,
manual/all.html, manual/index.html, tools/manual-*.mjs, a clearly marked "r7b" block at the end of
manual/manual.css (add, don't rewrite), and site/ only if your page list feeds it (regenerate it
with `node tools/site-build.mjs`, `npx prettier --write site`, `node tools/site-build.mjs --check`),
plus tests/man7b*.spec.mjs and your screenshots. Manual r7a owns the demo scripts, manual/img/,
make-stills.mjs, splat.html, language.html, more.html, unique.html and built.html; all.html is
generated by manual/build-pages.mjs, so regenerate it rather than editing their parts by hand.
Nothing else: no toy code, no engine. Specs to run before READY: man*, site, spg, tpg, st\*, smoke.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (replace the
prefix and lane record with yours). Your changes are public, so the Operator merges after your tests
and the owner's "good" marks on your cards. Cards on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK), ids man7b-…, naming Sonnet 5.5, as
docs/OPERATING.md, "Steps for a lane", says (no republish). Text-only fixes need no card; list them
in the PR. Finish every working turn with "READY:", "WORKING:" or "BLOCKED:" (the Operator reads it;
never ask the owner). Splashery has no CI to wait for; for a long job, schedule a check-in with
send_later instead of going idle. Before READY, run CLAUDE.md's "Before every push" steps for your
files. When main moves, merge it into your branch (never rebase). Usage is tight until the weekly
reset (Wednesday, October 14, 2026, 4 p.m. ET): no helpers unless you must; this is the largest job
this week, so post a first READY with Chapters 6 and 7 within about five hours if the rest isn't
done, and keep going. The owner's own notes are private: never quote them in the repo, a PR or a
card; this brief is the Operator's summary.

## State

Model: Sonnet 5.5 (claude-sonnet-5-5), high effort. Started October 11, 2026. Branch
`claude/lane-manual-r7b`. No helpers used.

Done (October 11, 2026): Chapters 6 to 10 written (`manual/moving.html`, `data.html`,
`photo3d.html`, `codes.html`, `make.html`), in `manual/pages.mjs` after Chapter 5, in the
navigation, the cover's contents, `all.html`, and `redirect.js`. `coming.html` is now a small
redirect stub (`coming.html#moving` and the others land on their chapters; `manual/#moving` goes
through `redirect.js`). Glossary 25 → 58 entries; Further reading 5 → 27 sources (robotics, dynamic
scenes, tools, with a survey); References 10 → 22; Quick reference has a recipe, the controls and a
key-numbers table; "Level N" is "Chapter N" everywhere (the QR "level M" is a different word and
stays); the footer's "Splashery" opens the site's home page. Tests: `tests/man7b.spec.mjs`.

Not done: the PDF (waiting for the Operator's word that main carries Manual r7a), the full run of
the man\*, site, spg, tpg, st\* and smoke specs, the cards.

## Notes

- Toy links: write `<a href="toy:chest">` in a chapter; `node manual/build-pages.mjs` turns it into
  the Playground address of that toy (a v3 scene link with the toy's camera, as the site's "Open in
  Splashery" buttons make them) in a new tab, and stops on an id that is not a toy. A labs toy opens
  by its link with labs off (checked), so the link needs no `?labs=1`; the text says "(labs)".
- The Playground and the site's home page follow `FRONT_DOOR` (`manual/links.mjs`): today the
  footer's Splashery is `…/splashery/site/` (which the staged front door redirects to the home page:
  checked with `node tools/site-build.mjs --front-door --out <dir>`), and when `FRONT_DOOR` flips
  the same build writes `…/splashery/` and the back link `../playground/`.
- Stills: `tools/manual-stills.mjs` writes `manual/img/r7b-<toy>.jpg` (512 px, light page color, the
  toy at its home camera). Re-run it for a toy by id (`node tools/manual-stills.mjs strawberry`).
- Rebuild order: edit the chapter, `npx prettier --write manual`, `node manual/build-pages.mjs`.
- Numbers in the new chapters are read from the code by `tests/man7b.spec.mjs` (materials, soft
  toys, tiers, caps, star count, license counts of the Photoreal shelf).

## Known issues

- The Wikipedia book is not built (no fetch in `src/` or `tools/`; docs/WORKSTREAMS.md lists it as
  "later"). Chapter 9 says so. `manual/built.html` (Manual r7a's file) still says the Wikipedia book
  "does read from outside the site while you use it": that is stale.
- Further reading names a venue only where the arXiv page does; the others are called preprints
  (several were later published, such as GaussianAvatars).

## For the Operator

- `tests/man3.spec.mjs` and `tests/man4-pages.spec.mjs` asserted the placeholder page (`COMING`); I
  changed those lines (and "Level 2" in `tests/man3-2.spec.mjs`). Nothing else of other lanes'
  tests.
- `manual/links.mjs` is new (the Playground and home links, shared by the build and the test).

## Tests (October 12, 2026)

Run of man\*, site, spg, tpg, st2 to st4, stm, sts and smoke: 309 passed, 12 failed. Fixed:
`all.html` did not turn links to chapter files with a digit in the name (`photo3d.html`) into
anchors (a bug in my build, now fixed); the old counts in `man2`, `man3` (glossary 58, reading links
27, 14 "why" folds); `st2` now expects the footer link to the site's home page; `man.spec` takes
only the equation example links; the 320 px overflow of Further reading (`ul.reading li` wraps).
After the fixes the man\*, st2 and man7b specs pass (130), and the smoke "rigs pick splats" and spg
"embed guide" tests, which timed out under load, pass alone.

Still failing until the PDF is rebuilt: `man5` "the same input and the same Chromium print the same
bytes" (the tracked PDF is older than `all.html`). The PDF rebuild waits for the Operator's word
about Manual r7a.
