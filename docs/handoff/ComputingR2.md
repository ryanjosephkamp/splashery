# Lane Computing r2: sorting you can hear and see, and an Enigma you can set (prefix `cmp2`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Computing r2 (id `ComputingR2`, prefix
`cmp2`). Branch: `claude/lane-computing-r2` (engine PR, if needed, on
`claude/lane-computing-r2-engine`). PR title: "Phase Computing r2: sorting you can hear and see, and
an Enigma you can set". Handoff file: docs/handoff/ComputingR2.md (create it; start it with this
brief, word for word, under "## Brief", then keep "## State

- Engine PR #289 ("Engine: a shown text option is a text box in the Toy tab"), draft, on
  `claude/lane-computing-r2-engine`: a kit toy's `type: "text"` option without `hidden: true` shows
  as a text box (for the Enigma's plugboard). Merged into the lane branch; it must merge first. Its
  test runs on the Bombe (whose options stay fixed).
- Lane PR #290, draft. Sorting machine and Enigma done; proof in `tests/cmp2-sort.spec.mjs` (6
  passed) and `tests/cmp2-enigma.spec.mjs` (8 passed); `tests/cmp2-shots.spec.mjs` (5 passed:
  screenshots and the Enigma's setting typed in the Toy tab).
- Run on October 5, 2026: ai, mca, unit and cmp2 specs, 102 passed (the one failure, the engine test
  on this branch, is fixed and passes). The full suite is for the Integrator.
- Clips: 13 posted on Effect review page 2 (lane record `ComputingR2`, cards `cmp2-*`), the eight
  algorithms' sounds in the bars view, the crates, ring and dots views, the Barbarossa decode and a
  setting of one's own. The owner marked 12 good (October 5, 2026); the Enigma setting clip came
  back "Cool. Please make wheels sharper": the rotors' rings, letters, thumb wheels and end wheels
  now carry more, finer splats, and the rotor plates (hidden under the lampboard, a bug of mine) now
  show; posted as `cmp2-enigma-own-r2`. Main merged in.
- After the Operator's note of 14:10 UTC: the Enigma also uses the sharp splat kernel
  (`kernel: "sharp"`), posted as `cmp2-enigma-own-r3` (it replaces the two earlier cards). The help
  texts were over the limits in tests/help.spec.mjs (the Enigma's how-to 141 characters, both About
  texts over 180 words); both are rewritten within them. Ran on the new head: cmp2-sort,
  cmp2-enigma, cmp2-engine, cmp2-shots, kit, taps, help, mca, unit (all pass; help after the
  rewrite).

- N6 (Integrator 1, October 5, 2026): five failures. On the heads of 22:00 UTC, four pass (the
  shipped-text-option list in cmp2-engine, help.spec's how-to and About limits, fx6-2's 95-character
  how-to). hl1's jellyfish rest-height (and waterfall floor) is a timing-sensitive check, not this
  lane's change: with #289 it failed 5 of 6 runs; main passed 4 of 4 and main with 14 comment lines
  3 of 3; but main with the same 14 lines of code under an option type nothing uses (so it never
  runs) failed 1 of 3 (waterfall floor). No toy in hl1's sample shows a text box with #289 (checked
  in the browser: none; canvas 390x645 for all). Codex's corrected facts (#278) are in the About
  texts: swaps "or moves for merge sort"; the Enigma's "occasional double step" (no odometer).

## Notes", "## Known issues" and "##

For the Operator" current). Model: Opus 5.5.

### Brief (written by the Operator on October 5, 2026, from the owner's push notes, docs/reviews/2026-10-04-push-alignment/notes.md)

The owner wants proof that the science and computing toys are right ("I need evidence ... I do not
want to hallucinate these things"), and more from two toys on the AI and computing shelf (public
toys: your changes merge after his "good" marks).

1. **Sorting machine** (`sorting-machine`, `src/packs/computing.js` near 1052-1150 and 3733; eight
   algorithms with steps computed from real code; one sound for all today, toy-sounds.js 2609-2614).
   - A different sound for each algorithm, so you can hear the difference: each comparison or swap
     plays a tone at the bar's value (as in "the sound of sorting"), with a voice of its own per
     algorithm from src/voices.js. Keep the default bars view as it is (he likes it: "basically
     perfect").
   - Two or three more ways to watch a sort, as a View option, each driven by the same steps: things
     of different sizes (balls or crates that weigh and swap), a 3D view (a grid or a ring of
     colored blocks sorted by hue), and the classic dots view. The pieces move as solid things
     (CLAUDE.md, "Effect quality rules").
   - Proof: tests that check every step of every algorithm against an independent reference
     implementation, for many random and edge-case inputs (sorted, reversed, equal values), and the
     counters shown.
2. **Enigma** (`src/packs/computing-history.js` 1124-1190; Enigma I with rotors I, II, III fixed,
   reflector B, plugboard fixed at AR GK OX, rings and start at AAA; tests in tests/mca.spec.mjs
   check AAAAA → BDZGO and the double step).
   - Let the person set it like a real Enigma I in the Toy tab: three of rotors I to V in any order,
     reflector B or C, ring settings, start positions and up to ten plugboard pairs. The machine
     shows the setting.
   - Proof: decode a published historical message with its published settings (for example the
     Operation Barbarossa message of 1941, as published with its key by a reputable source such as
     the Crypto Museum or Frode Weierud's pages; cite what you use) in a test, plus independent test
     vectors for each rotor and the double step.
3. Codex task 16 is writing the evidence files (docs/evidence/sorting-machine.json and the Enigma's)
   beside you: don't create those files; put your proof in tests and in your handoff ("For the
   Operator"), and the Operator merges the two.

Tests in `tests/cmp2*.spec.mjs`; clips at phone size of each sorting view and sound, and of setting
and decoding the Enigma, on Effect review page 2 (lane record `ComputingR2`). Update the toys'
how-to and About texts.

You own: the sorting machine's and the Enigma's code in `src/packs/computing.js` and
`src/packs/computing-history.js`, their lines in the shared lists, `tests/cmp2*.spec.mjs`,
`tools/cmp2-*.mjs`, and your handoff file. You may update the Enigma checks in tests/mca.spec.mjs if
the new settings change what they assume, and say so.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). These two toys are public, so they merge only after
the owner's "good" marks and a full test run. Finish every working turn with "READY:", "WORKING:" or
"BLOCKED:"; Splashery has no CI to wait for; for a long job, schedule a check-in with send_later
instead of going idle.

## State

- Engine PR #289 ("Engine: a shown text option is a text box in the Toy tab"), draft, on
  `claude/lane-computing-r2-engine`: a kit toy's `type: "text"` option without `hidden: true` shows
  as a text box (for the Enigma's plugboard). Merged into the lane branch; it must merge first.
- Sorting machine: done (steps engine with every comparison, per-algorithm voices, View option:
  bars, crates by size, ring of colors (3D), dots). Proof in `tests/cmp2-sort.spec.mjs`.
- Enigma: done (rotors I to V, reflector B or C, rings, start, up to ten plugboard pairs, the
  setting on the pad, rotor plates and cables; Barbarossa presets). Proof in
  `tests/cmp2-enigma.spec.mjs`.
- Clips: to post on Effect review page 2 (lane record `ComputingR2`).

## Notes

- `sortRun(algo, input)` (src/packs/computing.js) is the one place the algorithms live: it records
  every comparison, swap and move. The bars' step lists are byte-for-byte the same as before the
  change (checked by dumping both).
- The sound is played from the recipe as cues (`sortCues`), sent 0.35 s ahead about every 0.25 s,
  each note at its own time, so the tap's own sound is quiet (`action.quiet: ["go"]`). The
  `TOY_SOUNDS` entry stays for the Sound Board (bubble sort's swaps).
- Voices: bubble marimba, quicksort pluck (guitar), merge harp, insertion wood (woodblock),
  selection tine, cocktail bar (glockenspiel), Shell glass, heap synth. Insertion was vibes first;
  its long ring built up into a wash (three times the others' loudness), so it became wood.
- `tools/cmp2-clip.mjs`: effect-clip with several options (`--opt="algo=quick&view=ring"`).
  `tools/cmp2-sound.mjs`: renders each algorithm's sound to WAV, to mux into the clips.
- Old links: every new option defaults to the old behavior (bars; I II III, B, AAA, AR GK OX), and
  `tests/cmp2-enigma.spec.mjs` checks an old link still codes HELLO as ILBDT. tests/mca.spec.mjs is
  unchanged and still passes.

## Known issues

- The review page plays clips muted with no controls, so the sound in the sorting clips (MP4 with
  audio, rendered by `tools/cmp2-sound.mjs`) is not heard there. The owner hears it in the toy.
- The crates view reads small at phone size (its plinth is deep, to hold the lanes of the shuffle
  back).

- Reflector C has no published historical message in the tests; it is checked against the reference
  code (wiring from the Crypto Museum and Wikipedia tables) on random settings.

## For the Operator

Evidence for docs/evidence/ (Codex task 16), all in the tests named:

**Sorting machine** (`tests/cmp2-sort.spec.mjs`):

- Every algorithm (bubble, quick, merge, insertion, selection, cocktail shaker, Shell, heap) is run
  by the toy's code and by separate reference code in the test, on 1,300+ inputs: every arrangement
  of 2 to 6 values (872), sorted, reversed, all-equal and two-valued lists of 2 to 40, and 400
  seeded random lists of 0 to 40 values, half with many equal values. Checked for each: the same
  comparisons of the same values in the same order, the same arrangement after every swap or move,
  sorted output, and each recorded step consistent with the arrangement before it (over 500,000
  steps).
- Known counts: bubble, insertion and cocktail swaps equal the inversions; bubble and selection make
  n(n-1)/2 comparisons; selection at most n - 1 swaps; a sorted list needs no swaps.
- The toy's own bars (5 2 7 0 6 3 1 4), swaps (moves for merge) and comparisons: bubble 16 / 28,
  quick 10 / 13, merge 10 / 17, insertion 16 / 21, selection 6 / 28, cocktail 16 / 28, Shell 10 /
  23, heap 18 / 25.
- In every view and algorithm, after each step the counter shows the steps so far and every piece
  stands where that step's arrangement puts it; crates and pucks never pass through each other
  (checked at 120 frames a second); each comparison and swap sounds exactly once, in the algorithm's
  voice, at the right notes.

**Enigma** (`tests/cmp2-enigma.spec.mjs`):

- Operation Barbarossa, July 7, 1941 (German Army; rotors II IV V, reflector B, rings 02 21 12,
  plugs AV BS CG DL FU HZ IN KM OW RX): the indicator KCH at WXC gives the message key BLA; part 1
  (at BLA) decodes in full to AUFKL XABTE ILUNG XVONX KURTI NOWAX ... and part 2 (at LSD) to DREIG
  EHTLA NGSAM ABERS ... Source: Geoff Sullivan and Frode Weierud, "Breaking German Army Ciphers",
  Cryptologia 29(3), 2005 (https://cryptocellar.org/bgac/), as given on Franklin Heath's Enigma
  sample messages (http://wiki.franklinheath.co.uk/index.php/Enigma/Sample_Messages; the wiki was
  down on October 5, 2026, so its text was taken from its search listing; the decode itself
  reproducing the German plaintext letter for letter is the check).
- The Enigma instruction manual of 1930 (reflector A, rotors II I III, rings 24 13 22, plugs AM FI
  NV PS TU WZ, start ABL) decodes to FEIND LIQEI NFANT ERIEK OLONN E... (same page).
- BDZGO (rotors I II III, B, AAA), EWTYX (rings BBB), the double step ADU → ADV → AEW → BFX.
- 600 random settings (every rotor in every place, both reflectors, 0 to 10 plugs, 60 to 360
  letters) match separate reference code; no letter codes to itself; the same setting decodes.
- Each rotor's turnover (I Q, II E, III V, IV J, V Z) on the right and in the middle (the double
  step); the positions repeat after 16,900 letters (26 × 25 × 26).
