# Lane US English: the American spelling sweep (prefix `use`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session,
session_011WeiHJ3ygHhoTrrJiThHzX). Repo: ryanjosephkamp/splashery. Your lane: US English (id
`UsEnglish`, prefix `use`). Branch: `claude/lane-us-english` from main. PR title: "Phase US English:
the American spelling sweep". Handoff file: docs/handoff/UsEnglish.md (create it; start it with this
brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "##
For the Operator" current). Model: Sonnet 5.5, at high effort.

### Brief (written by the Operator on October 12, 2026)

The owner asked today for Splashery to switch to American spelling everywhere a person can read it,
the app and its documentation together (the README quotes strings the app shows, so both change in
one PR). `node tools/us-english.mjs` (no arguments: every line) lists 479 British spellings on main
today (color, math, synthesized, recolour, hemoglobin and the rest).

Scope, in this order: (1) every string a person reads, including code comments; (2) tests that
assert one of those strings. Leave alone: vendor/ and third-party names; identifiers and stored
keys; docs/reviews/; files another branch is changing now (`manual/`, `tools/site-hubs.mjs`,
`docs/SCENE-SCHEMA.md`, `docs/FLUIDS.md`, `site/`, and every file changed by the open Codex PRs
#558, #559, #560, #562 and #566), recorded under "Part 2". The serial comma is not in this lane.
Done when the checker lists nothing outside the kept and skipped items, prettier is clean, an old
`#s=` link still opens, and the full suite passes. (The Operator's full brief text is in the session
prompt; this is its summary.)

## State

Model: Sonnet 5.5 (claude-sonnet-5-5), high effort. Branch `claude/lane-us-english`.

- October 12, 2026: the first full run found one slip of mine: the sweep had renamed the saved
  option keys `flavour` and `flavours` in src/packs/food.js (macaron toy failures in kit, e5 and
  taps). Restored; they are in the kept list.
- October 12, 2026: sweep done in the working tree: strings, docs, tools/toy-plan.json (so
  TOY-PLAN.md regenerates clean), code comments (scan by script, backticked identifiers left alone),
  and the status line test in tests/smoke.spec.mjs ("in the colors of"). Prettier clean.
- Full suite: see "For the Operator".

## Notes

- Fixed by kind (strings and docs, from the checker): colour/colours/coloured/colourful/Colour
  (about 210), maths/Maths in prose and the shelf label (about 25; the shelf label is now "Math",
  its id stays `maths`), license(s) (about 14), center(s)/centred, toward, behavior(s), favorite,
  aluminum (displayed text), labeled, synthesized, traveling, neighbors, gray, catalog, airplane,
  hemoglobin, armor, tire, flavor, vapor, molded, modeled, luster, judgment, jewelry, harbor,
  fibers, energize, and three "D Month YYYY" dates. Plus about 590 words in code comments.
- Toy search tags (`tags:` in src/toys.js) are now American too, so searching "color" or "gray" no
  longer matches those toys. A search alias list would fix that (an engine change); the owner can
  decide.
- Tests: only tests/smoke.spec.mjs asserted a changed string. tests/bkd-format.spec.mjs and
  tests/man3.spec.mjs mention "color" on purpose (a checker's test and the Manual's search word);
  left as they are.
- The checker only reads string literals in code; the comment pass used its word rules over `//` and
  `/* */` text.

## Known issues

Kept on purpose (British identifier or key, third-party name):

- src/toys.js: `id: "maths"`, `category: "maths"`, `pack: "maths"` (48 lines): shelf and pack ids,
  saved in links.
- src/effects-pose.js:55: pack id `"maths"`; src/packs/maths.js and `maths.js` links in docs: file
  name.
- src/packs/atoms.js:2242 `key: "colour"`; src/packs/food.js:1729 `key: "flavour"` and :2808
  `key: "flavours"`: option keys saved in links (their labels now say Color and Flavor).
- src/chem/elements.js:25 `"aluminium"`: element name used by lookups (tools/chs-data.mjs,
  rel-sources.mjs). src/elements-real/samples.js:54: the images-of-elements.com URL and file.
- src/packs/vehicles.js:434 part name `"vapour"`; src/packs/vehicles.js, src/chem/protein.js,
  src/packs/elements.js: `centre` as a variable or property.
- index.html:788 and :795, src/live/panel.js:352: CSS class `labelled`.
- src/sound-credits.js:570 ("Airplane Passing Close.wav", the author's title),
  src/packs/space-r2.js:981 (the Gaia paper title), src/space/worlds.js:265 (Tire, a real place
  name).
- docs/audits: URLs and file names (`maths.js`, aluminum and licenses in links).
- src/packs/space.js:505 and tools/g-looks.mjs:111: `colour(` as a function name in a comment.

## Part 2

Done after the Operator freed the files (October 12, 2026, main d5039103 merged in): CREDITS.md,
LICENSES.md, docs/SCENE-SCHEMA.md, the rest of the #558 files, and the generated `site/` (rebuilt
with `node tools/site-build.mjs`; its remaining hits are `maths` in ids, paths and file names, and
the kept third-party titles). `manual/`, `tools/site-hubs.mjs` and `docs/FLUIDS.md` had no British
spellings. Also kept in CREDITS.md: the sound title "Aeroplane Passing Close.wav", the Gaia paper
title, "Open Government Licence" (a license's name), and the aluminium.php URL. `docs/TOY-PLAN.md`
still shows "## Maths" because the generator prints the category id.

## For the Operator
