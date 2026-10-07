# Lane Toy pages r2: sound in the embed, Learn more links and the catalog PDF round 2 (prefix `tp2`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Toy pages r2 (id `ToyPagesR2`, prefix
`tp2`). Branch: `claude/lane-toy-pages-r2` (and `claude/lane-toy-pages-r2-engine` for any change to
the app outside your own files, as an "Engine: …" PR merged first). PR title: "Phase Toy pages r2:
sound in the embed, Learn more links and the catalog PDF round 2". Handoff file:
docs/handoff/ToyPagesR2.md (create it; start it with this brief, word for word, under "## Brief",
then keep "## State", "## Notes", "## Known issues" and "## For the Operator" current). Model:
Sonnet 5.5, at the default effort.

### Brief (written by the Operator on October 7, 2026, from the owner's walkthrough review)

Read the owner's own words first: docs/reviews/2026-10-06-walkthrough/notes.md (dictated on his
phone; he praised the site and asked for these refinements), then the Operator's triage in
docs/reviews/2026-10-06-walkthrough/triage.md, section "Toy pages r2". That section is your list.
Anything the owner didn't mention is approved: change nothing else, and keep the look and layout he
praised.

Read docs/handoff/ToyPages.md first.

Notes on the list:

- Sound (item 1): the toy page's embedded toy should play its tap sound when the visitor taps (a tap
  is the user gesture browsers need), with a visible way to mute it. If that needs a change in
  src/embed.js or the app, make it a small additive "Engine: …" PR on
  `claude/lane-toy-pages-r2-engine`, merged first; keep embeds on other sites as they are unless a
  parameter turns sound on.
- "Open in Splashery" (item 2): a new tab (target="\_blank" rel="noopener").
- Learn more (item 3): a new tools/toy-links.json, one entry per public toy where it helps: { "url",
  "label" } for an English Wikipedia article or another trusted reference (NASA, a museum, a
  standards body). Check every URL opens (curl it) and is about that exact thing. Skip toys whose
  page already cites its sources and toys where nothing fits. Shown on the toy page under About, in
  a new tab. Linking needs no license entry.
- The catalog (item 4): tools/tpg-catalog.mjs builds site/splashery-catalog.pdf. Round 2: the cover;
  a table of contents whose entries link to their pages; PDF bookmarks (an outline); every public
  toy on its own page with its picture, About text, how to play, its views and settings (from the
  toy's options and controls), its QR code and its Learn more link. Keep it public toys only, and
  keep the file a sensible size (say so if it passes 20 MB). Rebuild it from current main.

You own: tools/site-toy-pages.mjs, site/toys/ (regenerate with the site build), tools/tpg-\*.mjs,
site/splashery-catalog.pdf, tools/toy-links.json (new), src/embed.js only through your engine PR,
and tests/tp2\*.spec.mjs. Not yours: the other site tools (Site r2 owns tools/site-build.mjs,
site-pages.mjs, site-hubs.mjs, site-md.mjs). If you need a shared helper from Site r2, ask the
Operator; don't edit their files. Post before-and-after screenshots at 390×844 and the catalog's
first pages as cards on Effect review page 2 (ids tp2-…).

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Your changes touch toys and pages the public sees,
so the Operator merges them after a full test run (the Integrators run it) and the owner's "good"
marks on your cards. Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery
has no CI to wait for; for a long job, schedule a check-in with send_later instead of going idle.
Clips at phone size go on Effect review page 2 (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK)
as docs/OPERATING.md, "Steps for a lane", says (no republish). Before READY, re-read CLAUDE.md's
"Effect quality rules" and check each clip against them at phone size. The push ends Wednesday,
October 7, 2026, 4 p.m. ET (20:00 UTC): aim for a first READY within about four to six hours, then
polish rounds on the owner's marks.

## State

October 7, 2026. Model: Sonnet 5.5 (claude-sonnet-5-5), default effort.

- **Engine PR #365** (`claude/lane-toy-pages-r2-engine`, merge first): `?sound=on` on an embed
  (`embed/` and `site/play/`) loads the sound code only then, plays the toy's tap sound on a tap and
  adds a speaker button that mutes it. Other embeds stay silent and fetch nothing. Test
  `tests/tp2-engine.spec.mjs`.
- **Item 1, sound**: a toy page's player is `play/?toy=<id>&sound=on`.
- **Item 2, new tab**: the "Open in the gallery" button and the player's own "Open in Splashery"
  link (set from `site/assets/toy-page.js`, since the player is the same origin) open in a new tab.
- **Item 3, Learn more**: `tools/toy-links.json` has 302 English Wikipedia links, one per public toy
  where an article is about that exact thing; each is checked with
  `node tools/tpg-links.mjs --online` (it asks the Wikipedia API, so a missing page or a
  disambiguation page fails). Shown under About, in a new tab. A toy with an evidence file shows
  none (its page cites its sources).
- **Item 4, catalog**: `site/splashery-catalog.pdf` rebuilt (`node tools/tpg-catalog.mjs`): a cover,
  a three-page table of contents (every entry links to its page), PDF bookmarks (shelf, then toy),
  and every public toy on its own page: picture, how-to line, About text, how to play, views and
  settings, QR code, link, Learn more and credits. A page that runs over shrinks to fit.

## Notes

- Toys left without a link (nothing fits): the labs toys, invented worlds (Tiny planet, Aurora
  world), one-off scans (Heart cookie, Mandeltorus, Wooden elephant, Cat statue, Horse statue), the
  Jelly blob, Neon knot, Potion bottle, Dragon egg, Wizard's orb, Spring toy, Desk lamp, Surface
  plotter, Looped transformer and Twisting supertall.
- Brand names are kept out of the labels (the flying disc links to Wikipedia's "Frisbee" article but
  is labeled "Flying disc"; the puzzle cube links to "Combination puzzle").
- The settings in the catalog are read from each recipe's `options` and `controls`; a select lists
  its choices, a slider says "slider". "Views" are the select options named like a view, mode or
  layer. Labels come from the recipes, so a few older British spellings ("Colour set") show as the
  app shows them.
- The "Tap" and "Sound" lines are the plan's (`tools/toy-plan.json`), as on the toy pages.
- Tests: `tests/tp2.spec.mjs` (links, every page's Learn more and new-tab links, the catalog's
  structure, a browser check of sound, mute, new tabs and screenshots) and
  `tests/tp2-engine.spec.mjs`. `tests/tpg.spec.mjs`'s catalog test now allows the contents pages and
  20 MB.

## Known issues

- The catalog is about 10 MB (under the 20 MB line).
- The sound test needs a few seconds because a first tap's pick is slow without a GPU.

## For the Operator

- Merge #365 (engine) first, then the lane PR; rebuild `site/` after main moves
  (`node tools/site-build.mjs`, then `SPLASHERY_CHROMIUM=... node tools/tpg-catalog.mjs`).
- Files outside my own: `tests/tpg.spec.mjs` (the catalog's page count and size), `README.md` and
  `styles.css` (through the engine PR).
