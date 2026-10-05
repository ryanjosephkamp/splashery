# Lane Real elements: a periodic table of real samples (prefix `rel`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Real elements (id `Elements`, prefix
`rel`). Branch: `claude/lane-real-elements` (and `claude/lane-real-elements-engine` for any change
to the app outside your own files, as an "Engine: …" PR merged first). PR title: "Phase Real
elements: a periodic table of real samples". Handoff file: docs/handoff/Elements.md (create it;
start it with this brief, word for word, under "## Brief", then keep "## State", "## Notes", "##
Known issues" and "## For the Operator" current). Model: Opus 5.5.

### Brief (written by the Operator on October 5, 2026, from the owner's Push Plan picks)

The owner's new-ideas pick N2 (yes): every element as a real sample, in the spirit of the classic
photographic periodic tables, made from open photos turned 3D with our own depth model; a tap brings
a sample close with its facts.

1. **Sources first**: read the "Photos of real element samples" section of
   docs/audits/photoreal-media-sources-2026-10.md. For each element find a photo of a real sample
   under an allowed license (CLAUDE.md, "Ground rules": CC0, CC BY, CC BY-SA, CC BY-NC with
   `"nc": true`, CC BY-NC-SA or public domain; never ND), checked on its live page. Record each in
   `tools/assets.json`, CREDITS.md and the toy's in-app credit; BY-SA notices show beside their
   samples. Elements with no usable photo (the heaviest, the most radioactive) get an honest
   placeholder tile that says why.
2. **The table**: the 118 elements in the standard layout, each tile a small 3D sample (the photo
   turned 3D with `tools/p3d-depth.mjs`, the Photo to 3D tool's depth model, cut out cleanly from
   its background), colored by its block or category on demand. A tap lifts the sample out, turns
   it, and shows its facts: number, symbol, name, atomic mass, group and period, state at room
   temperature, density, melting and boiling points, discovery, and one or two real uses, from
   public-domain or openly licensed references (cite them).
3. **Weight**: lazy-load samples so the table opens fast on a phone and the "embed transfer ≤ 30 MB"
   test stays green; say the total size.
4. **Evidence**: docs/evidence/<toy id>.json with tests that check the facts table against the
   references you cite (a sample of values, all 118 symbols and numbers).

A new labs toy on the Atoms shelf. Don't edit the existing `periodic-table` toy (a kit toy in
`src/packs/chemistry.js`); import its layout if it helps. Tests in `tests/rel*.spec.mjs`; clips at
phone size on Effect review page 2 (lane record `Elements`); how-to and About texts.

You own: `src/packs/real-elements.js` (new), `src/elements-real/` (new helpers), `tools/rel-*.mjs`,
the new assets, `tests/rel*.spec.mjs`, your toy's evidence file, its lines in the shared lists, and
your handoff file.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Labs: the Operator merges after a full test run.
Finish every working turn with "READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for;
for a long job, schedule a check-in with send_later instead of going idle. Before READY, re-read
CLAUDE.md's "Effect quality rules" and check each clip against them at phone size.

## State

WORKING (October 5, 2026): sources chosen (see Notes); building the sample pipeline
(`tools/rel-samples.mjs`), the facts table (`tools/rel-facts.mjs`) and the toy.

## Notes

- Sources: Images of Elements (images-of-elements.com, Jumk.de Webprojects), CC BY 3.0 on each
  element's page ("The images are licensed under a Creative Commons Attribution 3.0 Unported
  License, unless otherwise noted. Attribution by linking … to the according element page."), for
  most elements up to 83. Its pages for 61, 84 to 87, 101 to 103 say "This is only an illustration";
  those and the others with no open photo of a real sample get placeholder tiles. The heavy
  elements' photos come from their Wikimedia Commons file pages (public domain U.S. DOE photos, CC
  BY or CC BY-SA), each checked through the Commons API's license fields.
- Facts: PubChem's periodic table (NCBI, public domain U.S. government data); uses from PubChem's
  element pages, which quote Jefferson Lab and Los Alamos National Laboratory (U.S. DOE).

## Known issues

- None yet.

## For the Operator

- Nothing yet.
