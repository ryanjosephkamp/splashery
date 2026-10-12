# Lane Site r5: What's new cards open their toy, and a mirror report (prefix `st5`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session,
session_01Mo8sLhAitbYjZiPgD8Hc4t). Repo: ryanjosephkamp/splashery. Your lane: Site r5 (id `SiteR5`,
prefix `st5`). Branch: `claude/lane-site-r5` from main. PR title: "Phase Site r5: What's new cards
open their toy". Handoff file: docs/handoff/SiteR5.md (create it; start it with this brief, word for
word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "## For the
Operator" current). Model: Sonnet 5.5, at high effort.

Read CLAUDE.md, docs/HANDOFF.md ("Now"), docs/OPERATING.md, docs/handoff/ScienceR3.md ("How this
lane runs"), then docs/handoff/SiteR3.md and docs/handoff/SiteR4.md (how site/ is built, the What's
new gallery, the staged front door).

### Brief (written by the Operator on October 11, 2026, from the owner's walkthrough of /site/ that evening)

The owner walked through every /site/ page and approved them as they are (search, credits, contact,
privacy, terms, about, Learn, Studio, Science, Tools, Toys, Home). Wording waits for one rewording
pass after the manual is final: change no wording now. Two jobs:

1. **What's new: every feature card and every before-and-after card opens its toy.** Today the
   new-toy gallery's tiles open the toy's /site/ page (keep that exactly). The feature cards and the
   before-and-after cards do nothing when tapped. Make each whole card a link that opens the most
   relevant toy in the Splashery Playground (the app at the site's root, on that toy, the same link
   the toy pages' "Open in the Playground" button uses) in a new tab. tools/site-news.json already
   names a `toy` for each entry: check each one is the best choice (for a before-and-after, the toy
   in its pictures; for a feature, the toy on its card or the clearest example of the feature), fix
   any that aren't, and make the build fail if an entry names a toy that doesn't exist. Keep it
   accessible (one link per card, a clear accessible name, a visible focus ring, no nested links)
   and keep the layout exactly as marked good. Check that the links keep working with the staged
   front door (`tools/site-front-door.mjs`, Site r4): the Playground moves to playground/ at the
   swap. Add tests in tests/st5.spec.mjs (every card is a link, opens a new tab, names an existing
   toy, works in the staged front-door build).
2. **A mirror report, no edits.** Several Learn pages restate parts of the Tinkerer's Manual (How 3D
   Gaussian splats work, What Splashery can do, How Splashery is made, Embed and share, and others).
   List in your handoff file, under "For the Operator", each Learn page, the manual section it
   mirrors (manual/\*.html), and where they differ in substance today (facts, numbers, claims; not
   wording). After the manual's final audit, a later round brings them in line.

You own: tools/site-_.mjs and tools/site-news.json (not the can-do page's entry in
tools/site-pages.mjs), site/ (regenerate with `node tools/site-build.mjs`,
`npx prettier --write site`, then `node tools/site-build.mjs --check`), tests/st5_.spec.mjs and your
screenshots. Nothing else: no manual/, no toy code, no engine. Specs to run before READY: st\*,
site, spg, tpg, smoke.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (replace the
prefix and lane record with yours). Your changes are public, so the Operator merges after your tests
and the owner's "good" marks on your cards. Cards: before-and-after screenshots at 390×844 (and
1440×900 where layout matters) on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK), ids st5-…, naming Sonnet 5.5, as
docs/OPERATING.md, "Steps for a lane", says (no republish). Text-only fixes need no card; list them
in the PR. Finish every working turn with "READY:", "WORKING:" or "BLOCKED:" (the Operator reads it;
never ask the owner). Splashery has no CI to wait for; for a long job, schedule a check-in with
send_later instead of going idle. Before READY, run CLAUDE.md's "Before every push" steps for your
files. When main moves, merge it into your branch (never rebase). Usage is tight until the weekly
reset (Wednesday, October 14, 2026, 4 p.m. ET): no helpers unless you must; aim for a first READY
within about four hours. The owner's own notes are private: never quote them in the repo, a PR or a
card; this brief is the Operator's summary.

## State

Model: Sonnet 5.5 (claude-sonnet-5-5), high effort. October 11, 2026. Branch `claude/lane-site-r5`.

1. **Cards are links.** In `site/new/`, every feature card and every before-and-after card has one
   link: its heading's `<a class="news-link">`, stretched over the whole card with a `::after`
   overlay (`site/assets/hubs.css`), so the layout is byte-for-byte what was marked good. It is the
   same `#s=` link as the toy page's "Open in the Playground" button (`galleryHref`), with
   `target="_blank" rel="noopener"`. The accessible name is the card's title plus a visually hidden
   ": opens the <toy> in the Playground, in a new tab". The focus ring is the site's accent outline,
   drawn around the whole card. The new-toy tiles are untouched (they open the toy's /site/ page).
2. **The toys named in `tools/site-news.json` are checked** (see Notes). The build now fails with
   `What's new: the feature "…" names the toy "…", which doesn't exist.` for a missing toy, and for
   one with no thumbnail. A feature must now name a toy.
3. **Front door.** The links are `../../#s=…` in the live layout. `lift()` in
   `tools/site-front-door.mjs` already turns that into `../playground/#s=…` in the staged build, so
   no front-door change was needed. `tests/st5.spec.mjs` builds the staged layout and clicks a card.
4. **Mirror report**: below, under "For the Operator".
5. **Tests** (October 12, 2026): `tests/st5.spec.mjs` 5 of 5. With st\*, site, spg, tpg and smoke
   (179 tests, two workers on llvmpipe): 175 passed, 4 failed under load (smoke 156 and 734, spg
   138, st4 511); all 4 passed when rerun alone. Prettier and `site-build --check` clean; main
   merged in.
6. **Cards**: `st5-features-390x844`, `st5-fixes-390x844`, `st5-fixes-1440x900` on Effect review
   page 2, lane `SiteR5`, Sonnet 5.5 (before and after side by side; no republish). Screenshots
   `tests/screenshots/st5-whats-new-{features,fixes}-{390x844,1440x900}.png`. Owner's marks (read
   October 12, 2026, 01:14 UTC): all three `good`.

## Notes

- Toy choices checked (all kept): the Gallery-to-Playground card shows the rubber duck (a friendly
  stand-in; there is no toy for the button itself); Real rocks, fossils and the night sky:
  Triceratops skull; Hands-on toys: Enigma machine (the card's picture; the basketball is on the
  October 4 card); Real data: Real Earth; A new site and a QR lab: Airport X-ray (the card's
  picture); the older cards' toys are the clearest example on each card. The five before-and-after
  cards already name the toy in their pictures.
- No wording changed anywhere.
- `site/sw.js` changes with the page (the offline cache's version).

## Known issues

- The card's text can't be selected with the mouse, because the link covers it (the usual price of a
  whole-card link). Keyboard and screen-reader users get one link per card.
- Cards for labs toys (the Triceratops skull, Real Earth, the Real Venus, the 5-cell) open the toy
  in the Playground, which shows it only with the labs switch on, exactly as the toy pages' buttons
  do.

## For the Operator

### Mirror report: Learn pages against the Tinkerer's Manual (no edits made)

The Learn pages are written by hand in `tools/site-hubs.mjs` (`ARTICLES`) and `tools/site-pages.mjs`
or built from docs/_.md; the manual is in `manual/_.html`. "Differ" below means facts, numbers or
claims, not wording.

**1. How 3D Gaussian splats work** (`learn/splats/`) mirrors manual/splat.html (Chapter 1: What a
splat is), plus manual/built.html and manual/toy.html for the recipe paragraph.

- Sorting: Learn says splats are sorted "by distance from you, farthest first"; the manual says they
  are sorted by the depth of their centers along the camera's view, with one depth per splat (a
  stated approximation), and that sorting happens on a worker a few frames after anything moves.
- "Do that sixty times a second": the manual gives no frame rate (it depends on the device).
- "Two kinds of toys" (captured and recipe): the manual lists three ways splats come to exist,
  adding the one-photo teaching fit (the Gaussian splatting toy fits flat, 2D Gaussians to a
  picture).
- "No hard polygons, no textures, just blended color": the manual (built.html, "What PlayCanvas
  does") says Splashery is "primarily splat based, not only": the photo toys' Sharp view is a
  textured mesh, fluids use a surface pass and a gas grid, and hybrid Worlds use lit models. The
  can-do page says so; this page doesn't.
- "A scan of a strawberry is about 450,000 splats": true (tools/assets.json), but the manual never
  states it. "A toy costs a few thousand characters" against the manual's "a few kilobytes".
- The manual says the Gaussian's weight peaks at 1 and is not a probability density, and lists the
  14 numbers per splat (center 3, sizes 3, rotation 4, color 3, opacity 1). Learn names the parts
  but not the counts, and says "mathematicians call that fade a Gaussian" (no claim to compare).

**2. What Splashery can do** (`learn/can-do/`) mirrors manual/more.html (What else Splashery does
now) and manual/unique.html (What Splashery can do that other splat tools can't).

- Names: the manual still says "the gallery" and "G opens the gallery" (more.html, "The viewer's
  controls") and "add ?labs=1 to the site's address"; Learn says the Playground and "the address of
  the Playground".
- Labs claims: the manual states in prose which toys are labs (the Studio toys, the book, album and
  frame, the Fluid lab, bottle toys and anatomy atlas, Worlds). Learn takes its badges from
  `src/toys.js`, so they follow the data. Checked today: they agree (all those toys are labs). If
  one goes public, the manual's sentence goes stale and Learn's doesn't.
- Left out of Learn: more.html's captures paragraph (newer captures ship a full and a lite file,
  some with spherical harmonics; many are labs), the input panel (typed text, drawing, file, binary
  file, several files), the fluid details (`k.fluid`; "where the grid is off, their particles are
  splats"), smooth bodies and one recipe inside another, the Fine look's "up to four times as many
  smaller splats", and the canvas resolution that drops while dragging on slow frames. unique.html
  lists "per-splat effects" with the moving parts and says a link starts `d.` (compressed) or `j.`
  (plain base64url); Learn doesn't.
- Added in Learn: the "Camera, microphone, and screen" and Worlds paragraphs match more.html; the
  "Turn your own things into splats" list adds Songs and QR codes, which more.html covers only for
  the Studio and QR sections.
- Numbers that agree: 60,000 to 400,000 splats, the Detail setting, the 27 MB depth model, .ply .sog
  .splat .spz. The toy counts ("N toys on the public shelves") are computed at build time; the
  manual gives none.

**3. How Splashery is made** (`learn/made/`) has no manual section that mirrors it (no lanes,
Operator or reviews in the manual). Three claims overlap manual/built.html (Plain files, and nothing
else; Every library that ships; How a toy gets on the shelf):

- "A test checks that an embed stays under 30 MB": agrees with built.html.
- "Every picture, scan and sound is public domain or under a Creative Commons license that allows it
  here": built.html points to CREDITS.md and LICENSES.md but doesn't state the rule; CLAUDE.md lists
  more (CC BY-NC, NASA, AI-made samples) than the page's phrase suggests.
- "Nothing you open is uploaded", "files and links from older versions keep working": agree with
  built.html and share.html.

**4. Embed and share** (`share/`, the card in Learn) mirrors manual/share.html (Share links and QR
codes) and, for the embed player, a paragraph in manual/built.html.

- The manual covers only the `#s=` link, the QR code and the old-link rules; the iframe, the
  `<splashery-toy>` element and the embed options appear only on the Learn page (and the manual's
  demo page). The manual doesn't mention the "even the heaviest scan is about 8 MB" claim
  (built.html says only the 30 MB test).
- Link length: Learn says "about 12 KB"; the manual says 12,288 characters of scene (`LINK_LIMIT`),
  a count of characters, not kilobytes.
- Learn doesn't mention the QR code of a scene (version and level rules, the 690 to 715 character
  figure, "Save JSON" fallback) or that the link is "not a hash and not a lookup".
- Old links: both say versions 2 and 3 load; the manual adds that version 1 and newer-than-running
  scenes are refused with a message.

**5. Writing toy recipes** (`learn/recipes/`, built from docs/PACKS.md) mirrors manual/toy.html
(Chapter 2) and manual/language.html (Chapter 3). Not compared line by line: PACKS.md is the
reference; the manual teaches. Worth checking at the final audit: the kit's function names and the
splat budget (manual/toy.html: 60,000 to 400,000, the Kit lab's 140,000 against 200,000 table that
Learn links to).

**6. The scene format** (`learn/scene-format/`, from docs/SCENE-SCHEMA.md) mirrors
manual/share.html's "What is in a link" and "Old links keep loading". The manual says version 3 is
current and a version 2 link is a version 3 scene without the pattern, the motion and shelf-toy
options; confirm against SCENE-SCHEMA.md at the audit.

**7. Is it right? The evidence files** (`learn/evidence/`, from docs/evidence/README.md), **Fluids
in toys** (`learn/fluids/`, from docs/FLUIDS.md), **How the parallel sessions work**
(`learn/operating/`, from docs/OPERATING.md), **The lab notebook** (`learn/notebook/`, from
docs/NOTEBOOK.md and the handoffs) and the draft **The loop a lane follows** (`learn/made/loop/`):
no manual section mirrors them, except that the fluids page overlaps manual/more.html's "Fluids,
songs, and smooth bodies" (four small splats per liquid particle on the page's own path; a smooth
surface on WebGPU; smoke and flames on a grid). Those agree today.

**8. The Learn hub's "How many splats?" link** goes to manual/toy.html#splat-count; its text
("140,000 against 200,000 splats on 24 views") matches the manual's table (24 views of 22 toys).
