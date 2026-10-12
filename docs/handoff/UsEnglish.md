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
today (colour, maths, synthesised, recolour, haemoglobin and the rest).

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

- October 12, 2026: sweep done in the working tree: strings, docs, tools/toy-plan.json (so
  TOY-PLAN.md regenerates clean), code comments (scan by script, backticked identifiers left alone),
  and the status line test in tests/smoke.spec.mjs ("in the colors of"). Prettier clean.
- Full suite: see "For the Operator".

## Notes

- Fixed by kind (strings and docs, from the checker): colour/colours/coloured/colourful/Colour
  (about 210), maths/Maths in prose and the shelf label (about 25; the shelf label is now "Math",
  its id stays `maths`), licence(s) (about 14), centre(s)/centred, towards, behaviour(s), favourite,
  aluminium (displayed text), labelled, synthesised, travelling, neighbours, grey, catalogue,
  aeroplane, haemoglobin, armour, tyre, flavour, vapour, moulded, modelled, lustre, judgement,
  jewellery, harbour, fibres, energise, and three "D Month YYYY" dates. Plus about 590 words in code
  comments.
- Toy search tags (`tags:` in src/toys.js) are now American too, so searching "colour" or "grey" no
  longer matches those toys. A search alias list would fix that (an engine change); the owner can
  decide.
- Tests: only tests/smoke.spec.mjs asserted a changed string. tests/bkd-format.spec.mjs and
  tests/man3.spec.mjs mention "colour" on purpose (a checker's test and the Manual's search word);
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
- src/sound-credits.js:570 ("Aeroplane Passing Close.wav", the author's title),
  src/packs/space-r2.js:981 (the Gaia paper title), src/space/worlds.js:265 (Tyre, a real place
  name).
- docs/audits: URLs and file names (`maths.js`, aluminium and licences in links).
- src/packs/space.js:505 and tools/g-looks.mjs:111: `colour(` as a function name in a comment.

## Part 2 (skipped because another branch changes the file)

Follow-up once #558, #559, #560, #562, #566 and the Manual r8 lane merge. The checker lists these
hits:

- CREDITS.md: 23 hits (changed by #558).
- LICENSES.md: 3 hits (changed by #558).
- docs/SCENE-SCHEMA.md: 11 hits (Manual r8 lane).
- manual/, site/, tools/site-hubs.mjs, docs/FLUIDS.md: not scanned or changed; run the checker and
  the comment scan on them after r8 merges. Also the comments in files those PRs change.

## For the Operator
