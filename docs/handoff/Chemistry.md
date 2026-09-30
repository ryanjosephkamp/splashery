# Lane Chemistry: the chemistry set

Prefix `chs`. Branch `claude/lane-chemistry` (the engine part on `claude/lane-chemistry-engine`). PR
title "Phase Chemistry: the chemistry set". How lanes work: [OPERATING.md](../OPERATING.md).

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Chemistry, "The chemistry set" (prefix `chs`). Branch:
claude/lane-chemistry. PR title: "Phase Chemistry: the chemistry set". Handoff file:
docs/handoff/Chemistry.md.

### Brief (written by the Operator on September 29, 2026, from the owner's review notes on the space, atoms and gems toys, and his go-ahead that morning)

The owner's notes, word for word:

- On the atom: "This looks fantastic. I don't think that I want to change this specific atom toy per
  se, but it would be nice if we could (at some point, not necessarily now) expand the chemistry
  "set" (so to speak) to include more atoms, and have the protons, neutrons, and electrons (with
  orbits, etc.) be realistic? It would be super cool if someone could pick an element from the
  periodic table here."
- On the molecule: "… expand the chemistry "set" (so to speak) to include more molecules?"
- On the crystal lattice: "… to include more lattices?"
- On the electron orbital: "… to include more atoms?"

Today the atom toy (`atom` in src/packs/atoms.js) offers 44 elements from a list, the molecule toy
already reads about sixty names, formulas, SMILES and files (src/chem/), the crystal lattice has
four crystals and the orbital toy a handful of orbitals. Build out the set:

1. **Periodic table** (`periodic-table`, a new toy on the Atoms shelf, public). A 3D periodic table:
   all 118 elements as tiles in the standard layout, colored by family, each with its symbol and
   number (sharp, readable at phone size). Tap a tile and its atom rises out of the table and builds
   itself, the way the owner asked: a nucleus with the right number of protons and neutrons (the
   most common isotope; each nucleon its own solid ball, packed like a real nucleus), and the
   electrons filling their shells in order. Tap the atom and one electron jumps to a higher shell
   and falls back, giving off a flash of light in that element's real emission color (hydrogen's red
   Balmer line, sodium's yellow, neon's orange-red, copper's green…, from published line data); tap
   elsewhere and the atom sinks back into its tile. A Toy tab choice picks the element too, saved in
   the link. Real facts only; cite the data source (for example NIST) in the About text and
   CREDITS.md if you use its numbers.
2. **The atom toy, more elements**: the same element picker (all 118, with the realistic nucleus) as
   a choice on the existing atom toy. Its default (carbon, Bohr style) and its tap stay exactly as
   they are; only new choices are added.
3. **More molecules**: the molecule toy's quick list gets a wider gallery (for example glucose,
   aspirin, caffeine is there, dopamine, serotonin, ATP, DNA base pairs, a short DNA strand,
   cholesterol, penicillin), each checked against a published structure (PubChem). Its default and
   tap stay as they are.
4. **More lattices**: add crystals to the crystal lattice toy (for example iron, body-centered
   cubic; copper, face-centered cubic; cesium chloride; fluorite; quartz; perovskite; graphene),
   each with its real geometry and colors, and the same wave tap.
5. **More orbitals**: the orbital toy gets the full set through n = 4 (all five 3d, the 4s, 4p and
   4d, and a few 4f), from the real hydrogen wave functions.

Every new toy or choice follows the effect quality rules in CLAUDE.md (real motion, separate things
move separately: each proton, neutron and electron is its own piece; materials look real) and
Fidelity A's method (even placement, full opacity, full density, clean colors). A sound for the
periodic table (a soft click of the tile, a rising shimmer as the shells fill, a bright ping for the
photon) in src/toy-sounds.js, its how-to line and About text in src/toy-help.js, a toy-plan entry, a
thumbnail. The changed toys keep their sounds.

Clips and cards (390×844), each labeled "built by Opus 5.5", in the lane record `Chemistry` on the
Effect review page (the Operator made it):

- `chs-table` (the table, three elements rising and building, one photon each), `chs-table-still` (a
  sharp still of the table);
- `chs-atom-elements` (the atom toy with three new elements), `chs-molecules` (six new molecules),
  `chs-lattices` (the new crystals), `chs-orbitals` (the new orbitals).

Tests in tests/chs.spec.mjs: all 118 elements build with the right proton, neutron and electron
counts; the table's tap on a tile builds that element; the old defaults of the atom, molecule,
lattice and orbital toys are unchanged (same splat counts at rest); screenshots at 390×844 and
1440×900.

These are public toys: the owner's "good" marks decide the merge.

### You own

- src/packs/atoms.js (unfrozen for this lane: additive choices and data only; keep every existing
  toy's default look, tap and sound), a new src/packs/chemistry.js for the periodic table, src/chem/
  (additive), `assets/toys/periodic-table/`, your toys' entries in the shared lists,
  tests/chs.spec.mjs, your `chs-*` screenshots and docs/handoff/Chemistry.md.

Lanes Worlds, Fidelity B, the toy piano (maker B), Anatomy, Pianos, Sharpness, Books, Real objects,
Photo to 3D and the Integrator run at the same time; leave their files alone. The laptop is locked.

### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews clips
  and marks them. Don't ask him anything or wait for him. Put questions and blockers in your final
  message, and the Operator answers or relays them. Messages that arrive in this session "From the
  Operator" come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort (the owner's assignment of September 29, 2026: Opus
  5.5 builds the engine, the toys, sounds and fidelity; Sonnet 5.5 builds the Worlds content, the
  Studio converters, the docs and the Integrator). Any helper you start uses the same model. Use at
  most one helper at a time.
- Merging (the owner's rules of September 29, 2026): the Operator merges Ops PRs, anything behind
  the labs switch, and additive engine PRs once the full test run passes. Changes to toys the public
  already sees wait for the owner's "good" marks. Never merge anything yourself.
- Language: every new public-facing text is in American English (color, center, gray, math, license,
  toward, -ize endings, dates like "September 29, 2026"). Leave code identifiers, file names and
  anything stored in links as they are.
- Read first: CLAUDE.md (the ground rules and "Effect quality rules" are binding),
  docs/OPERATING.md, docs/PACKS.md, docs/WORKSTREAMS.md and docs/handoff/history.md (lessons from
  earlier lanes).
- Your handoff file: create it. Start it with this brief, word for word, under "## Brief", then keep
  "## State

Model: Opus 5.5 (claude-opus-5-5), default effort.

- September 29, 2026: all five parts built. The periodic table (`periodic-table`,
  src/packs/chemistry.js), the atom toy's 118 elements and "Every nucleon" nucleus, 19 PubChem
  molecules plus two DNA base pairs and a four-pair double helix (PDB 1BNA), seven new crystals, and
  the orbitals through n = 4 (30 in all). One small engine addition in its own PR, #99, first (a tap
  can switch a kit toy's options; `turntable: false` keeps any kit toy still). Lane PR #100.
- Cards on the Effect review page (lane Chemistry): `chs-table`, `chs-table-still`,
  `chs-atom-elements`, `chs-molecules`, `chs-lattices`, `chs-orbitals`, waiting for the owner's
  marks.
- The owner marked the first six cards "fix" (too grainy). Everything this lane added is now built
  crisp (Fidelity A's method), the table denser, the rings thin, the lettering finer; the new clips
  are the `-r2` cards (the first ones are marked replaced).
- Second review: molecules and lattices "good"; the table, atom and orbitals still wanted more
  sharpness. The tiles now have a backing of their own color behind the face, the new atoms'
  electrons have no fuzzy halo, the new orbitals' haze holds still with bigger, fainter splats.
  Cards `chs-table-r3`, `chs-table-still-r3`, `chs-atom-elements-r3`, `chs-orbitals-r3`.
- September 30, 2026: the owner marked every current card "good" (`chs-table-r3`,
  `chs-table-still-r3`, `chs-atom-elements-r3`, `chs-orbitals-r3`, `chs-molecules-r2`,
  `chs-lattices-r2`). PR #100 is ready for the Operator to merge.
- Full suite on the final head (September 29, 2026): 440 passed, 0 failed. The engine PR #99 merged
  the same evening; main is merged into the lane branch. Next: the owner's marks on the `-r2` cards.

## Notes", "## Known issues" and "## For the Operator" current. Note your model at

the top of "## State" (the blog post compares the two models).

- Shared lists: edit only your own entries in src/toys.js, src/toy-sounds.js, src/toy-help.js (a
  how-to line and an About text per toy, following docs/handoff/Help.md), tools/toy-plan.json,
  CREDITS.md and tools/assets.json. Regenerate docs/TOY-PLAN.md with `node tools/toy-plan.mjs`;
  never merge it by hand.
- Never edit tests/taps.spec.mjs. Your own tests go in tests/<prefix>.spec.mjs. If a finished lane's
  test breaks because of a count or a list your work changes, don't edit it: say which test and why
  in your message, and the Operator fixes it.
- Assets: CC0, CC BY or public domain only, checked on the live source page and credited
  (CREDITS.md, tools/assets.json and the toy's in-app credit). Never BY-SA or NC. No logos, brand
  names or insignia.
- Review: post clips and cards to the Effect review page,
  https://claude.ai/artifact/NCsg9V5SzFY3Mnwuwgq7pi, as OPERATING.md's "Steps for a lane" says.
  Judge every effect as motion at phone size against the effect quality rules before you post it.
  The Operator has made your lane's record. Don't republish the page, and never write to "verdicts".
- Push your work in progress to your branch about every hour, so it isn't only in your container,
  and open your draft PR early. Many lanes run at once now, so main moves often: merge it into your
  branch before each push (never rebase a pushed branch) and keep both sides of any conflict.
- Before every push, follow "Before every push" in CLAUDE.md: the full Playwright suite
  (SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test), prettier,
  `node tools/us-english.mjs --diff`, `node tools/check-packs.mjs <pack>` for new or changed toys, a
  contact sheet and thumbnails, and your own screenshots at 390×844 and 1440×900. Then put back the
  standard screenshots (`node tools/upkeep.mjs --restore-shots`) and any other lane's screenshots
  your branch didn't change.
- PR: one draft PR against main with the five sections (Summary, Verification, Deviations, Known
  issues, What was cut), and the model that built it in the Summary. When main moves, merge it into
  your branch.
- After you post your cards, check the owner's marks (the "verdicts" collection, ids starting with
  your prefix) about once an hour with a scheduled check-in (send_later). Fix every "fix" in the
  same PR, post the new clip as a "-r2" card, and set replacedBy on the old one. Stop the check-ins
  once your PR is merged or closed.
- Finish every working turn with a short final message that starts with "READY:" (PR link, card ids,
  test results, anything for the Operator), "WORKING:" (what's left), or "BLOCKED:" (exactly what
  you need).

## State

Model: Opus 5.5 (claude-opus-5-5), default effort.

- September 29, 2026: all five parts built. The periodic table (`periodic-table`,
  src/packs/chemistry.js), the atom toy's 118 elements and "Every nucleon" nucleus, 19 PubChem
  molecules plus two DNA base pairs and a four-pair double helix (PDB 1BNA), seven new crystals, and
  the orbitals through n = 4 (30 in all). One small engine addition in its own PR first (a tap can
  switch a kit toy's options; `turntable: false` keeps any kit toy still).

## Notes

- Data: `node tools/chs-data.mjs` writes src/chem/periodic.js (NIST isotopes, ground levels and
  strong lines; PubChem families; IUPAC mass numbers from 109). `node tools/chs-molecules.mjs`
  writes src/chem/gallery.js (PubChem 3D conformers). Downloads are cached in `.cache/chs-data/`.
- The photon's color is each element's strongest visible line in the NIST Handbook's strong-line
  table (the neutral atom's, or the ion's when the atom has none between 380 and 750 nm), colored by
  wavelength. That makes neon 692.9 nm (deep red) rather than the orange-red of a neon sign, which
  is the blend of many lines. At, Fr and Fm to Og have no measured visible line: they flash white.
- The periodic table's tap: `action.at` returns `{ options: { element }, key: "up" }` for another
  tile; the player rebuilds the toy (about half a second at 200,000 splats) and raises the new atom.
  The table is built exactly the same for every element (the atom's splat counts always add up to
  25% of the budget, and the lettering is one shape), so only the atom changes.
- The atom is left out of the fit (`fit: false`) and stays within the table's own half-width, so the
  table is framed the same whichever atom it holds.
- `tools/chs-clip.mjs` records the lane's clips at phone size, through a script of taps, waiting out
  a rebuild without recording it.

## Known issues

- A tile tap rebuilds the whole toy (about half a second at 200,000 splats on a phone), so the new
  atom starts to rise a moment after the tap.
- The molecules' 3D shapes are PubChem's conformers; the DNA is the crystal structure with its
  hydrogens placed by rule (bond lengths and angles), not refined.
- Neon's photon is its strongest single line (692.9 nm, deep red), not a neon sign's orange blend.

## For the Operator

- The engine PR #99 has merged. The lane PR #100 has every card marked "good" and is up to date with
  main: ready to merge.
- The old default choices (caffeine, salt, carbon, 3d z²) keep their original build, as the brief
  asks; the same crisp method could be applied to them with their own cards if the owner wants.
