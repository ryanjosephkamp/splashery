# Lane Real elements: a periodic table of real samples (prefix `rel`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Real elements (id `Elements`, prefix
`rel`). Branch: `claude/lane-real-elements` (and `claude/lane-real-elements-engine` for any change
to the app outside your own files, as an "Engine: …" PR merged first). PR title: "Phase Real
elements: a periodic table of real samples". Handoff file: docs/handoff/Elements.md (create it;
start it with this brief, word for word, under "## Brief", then keep "## State

#298 merged (October 5, 2026). WORKING: the polish round (the owner on Effect review page 2: "the
toys could still be sharper"), on `claude/lane-real-elements-polish`, PR "Phase Real elements
polish: sharper samples and a smoother lift":

- The Lab lane's sharp kernel (`kernel: "sharp"`) and the low cull (`render: { cull: "low" }`), both
  labs only, and `closeUp` so a pinch comes close to one tile.
- Cut-outs one pixel inside their rim and three fifths coverage per cell: no background fringe.
- Lifted samples at 384 x 384 (up from 256), so a desktop's lift uses up to about 160,000 splats.
- A clean board edge (a close row of small splats instead of a row of dots).
- A smoother lift: a quintic ease, straight out of its tile first, then a glide; the swing and the
  turn ease in and out.
- Kept: tiles at every third atlas pixel and one splat per font pixel (finer splats vanish in the
  256 px shelf picture, which draws without the labs' low cull).
- The owner's marks (October 5, 2026), in the same PR:
  - "Hollow ... a hole in it when it's turned to the side", then (October 6) "still appears hollow
    from the sides": the lifted sample is now built like a pebble. Front and back both swell from
    the outline inward (by the distance to the outline), the front also carries the photo's relief,
    and they meet at the rim, so the photo's texture rolls over the edge. Light is baked on the
    body's own shape where the photo has none (the rolled rim; the back with its own mirrored light,
    so it reads as a dome). Fillers close steep steps, and the splats are nearly round. The earlier
    wall round the outline read as stripes from the side and is gone. A tap's turn now shows the
    sides: a quarter turn, a pause, on to the other side, a pause, and home (6 s).
  - October 6, "still hollow from the sides ... a thin vertical strip": the side-on frames showed a
    closed body (a projection of the splats and renders of each half confirmed it) that read as a
    bowl. Fixed: the photo depth's ground slope (a best-fit plane) is taken off and the body is a
    rounded dome over the outline; the rim, side wall and back take the sample's colors from further
    in (the outline pixels are dark); the baked light comes from above, so it stays above at every
    turn. `tools/rel-side.mjs` writes side-on stills (80 to 100 and 260 to 280 degrees, phone and
    desktop), and a test in `tests/rel.spec.mjs` fails when background shows through the filled
    silhouette (`src/elements-real/see-through.js`; it flags an open half shell at 25 to 32 percent,
    the real body at 0.5 percent or less). Clips: rel-copper-polish-r4, rel-radon-r3, and side-on
    stills rel-copper-side-r4 and rel-radon-side-r3.
  - October 6, the owner's up-close screenshots ("the outer shell isn't solid", all elements): the
    side wall was a band of filler columns between grid rows, and up close they showed as streaks
    with gaps onto the inside. Rebuilt: front and back are one closed mesh over the grid that meets
    at the outline, and the splats are spread evenly over its real area (the steep side as much as
    the face), each a disc lying in the surface, colored from the photo's own pixels.
    `src/elements-real/watertight.js` draws a lifted sample's splats from 120 directions in a small
    software splatter and counts pixels where the nearest splat faces away (the inside showing). A
    test runs it on all 118: the filler build fails on every one (1 to 10 percent), the new one
    passes on every one (under 1 percent, at the outline). Clips rel-copper-polish-r5, rel-radon-r4;
    up-close stills rel-copper-close-r5, rel-radon-close-r4.
  - October 6, "still not closed from some angles": an engine bug. Player.resortPose sorted a turned
    part's splats as if it had turned the other way (right only at 0 and 180 degrees), so while the
    sample turned its far side drew over its near side. Shown on a test ellipsoid on the lift part
    (45 degrees about x, about y, 90 about a slanted axis); the inverse matches a depth-correct
    software render. Fix: Engine PR #361 (`claude/lane-real-elements-engine`, one line in
    `src/pose.js` and `tests/rel-engine.spec.mjs`), to merge before #318. In the lane: the thickness
    is one dome over the outline (an ellipsoid fitted to it, so lobed samples are not waisted) with
    a rounded edge and walls joining front and back along the outline; one-cell spikes pruned; the
    photo's bumps smoothed. `tools/rel-sweep.mjs` checks a whole turn in 5-degree steps at three
    heights, close and far; `tools/rel-settle.mjs` draws a few frames after each change (the splats
    sort where the previous frame's pose put them, so a single frame after a snap is sorted in the
    old pose). Still open: at the exact side-on holds (90 and 270 degrees) copper can still read as
    a shallow dish in color.
  - October 6, "a little bit sharper overall": `render.dpr: "native"` (labs; the phone tier drew at
    1.5 device pixels per point), density 2, the lifted sample takes what the table leaves (up to 42
    percent), finer splats along each tile sample's outline. `tools/rel-sharp.mjs` measures it: at
    390 x 844 at 3x the table 15,083 to 24,170 and the lifted copper 12,812 to 20,513 (+60 percent);
    desktop +2 percent. `tools/rel-table-clip.mjs` records the phone-size table clip. Cards:
    rel-copper-polish-r6, rel-radon-r5, rel-table-r2, rel-sharp-r1.
  - Stand-in pictures for the 26 elements with no sample photo (his list), all from Wikimedia
    Commons with their licenses checked: 13 portraits (flat, black and white), 5 flags (waving), 3
    coats of arms (cut out), 5 minerals and places. Their tiles stay hatched, and the facts list
    says "Shown instead: …" with the credit.
  - Deviations from his list: dubnium shows Dubna's coat of arms (dubnium is named for Dubna,
    Russia, not Dublin); polonium shows Poland's flag (every polonium brush photo found shows a
    brand); livermorium shows downtown Livermore (no logo); promethium's tile is a real sample now
    (a public-domain photo of the first promethium-147 metal buttons).
- Weight: the atlas is 640 x 768 now (0.3 MB); a lifted sample's pair is about 55 KB; the folder is
  6.6 MB in the repo.

## Notes", "##

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

- Depth is the model's estimate from one photo, and a lifted sample's back is made up from its own
  colors (said in the About text and the evidence file).
- A few photos can't be cut cleanly and show as cropped cards (fluorine, sodium, uranium) or an oval
  (neptunium); samples in glass tubes keep the whole tube.
- The tiles are small on a phone (the whole 18-column table fits the width); a tap needs aim.
- `node tools/us-english.mjs --diff` flags "aluminium" in CREDITS.md: it is the Images of Elements
  page's address, which can't change.

## For the Operator

- Ready for the full test run and a labs merge. I ran `tests/rel.spec.mjs` (28 pass, with the
  side-view and solid-surface tests), `tests/help.spec.mjs`, `tests/kit.spec.mjs` and the toy's row
  of `tests/taps.spec.mjs`; not the full suite (the "embed transfer" test measures a captured toy's
  embed, which this lazy pack doesn't touch).
- Thorium, actinium and curium have no tile photo: the only photos found are FAL-only (thorium,
  Alchemist-hp), all rights reserved (actinium, Los Alamos) or EU copyright not confirmed open
  (curium, JRC). If the owner wants them, a CC BY or CC0 photo is the unblocker.
