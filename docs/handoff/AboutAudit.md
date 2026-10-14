# Lane About audit (prefix `aba2`): Codex's About audit, reworked

## Brief

Written by the Operator on October 4, 2026. Model: Sonnet 5.5 (docs). Branch:
`claude/lane-about-audit`. PR title: "Phase About audit: Codex's help-text corrections, reviewed".
Handoff file: this one.

Codex's PR #193 (`origin/codex/about-audit`, head ced8ff21, written October 2 from an older main)
corrects the how-to lines and About texts of 108 toys in `src/toy-help.js` and adds
`docs/audits/about-audit-2026-10.md` and `docs/audits/element-facts.md`. The owner marked it ready.
The Operator's review (below) found that 47 entries are good as written, 26 need fixes, 17 should
keep the old text, and 18 conflict with newer text on main, where main wins.

### What to do

1. Merge `origin/codex/about-audit` into this branch (a merge commit, so #193 shows as merged when
   this lands). Resolve the 18 conflicts in `src/toy-help.js` by keeping main's entry, then carry in
   the corrections listed under "Conflicts" below. Keep the new `qr-code` and `moving-photo-3d`
   entries that sit inside the `chladni-plate` and `splat-mirror` hunks.
2. For the 17 entries under "Reject", restore main's text exactly.
3. Apply the 26 fixes. For the 11 marked with a star, use the replacement text in "Replacement
   texts" exactly (word counts checked); for the rest, make the change described.
4. Change every curly apostrophe (’) the PR added to a straight one (').
5. Leave the `fluid-lab` entry as main has it (lane Fluids r7 changes it in its own PR).
6. `docs/audits/element-facts.md`: protactinium was discovered by Lise Meitner and Otto Hahn (not
   Meitner alone); arsenic repeats gallium's gallium-arsenide fact, so give it a different, sourced
   fact.
7. `docs/audits/about-audit-2026-10.md`: add a short note at the top: "Reviewed by the Operator on
   October 4, 2026: of 108 entries, 47 merged as written, 26 merged with fixes, 17 kept their
   earlier text and 18 kept main's newer text; see this PR. Main had 373 toys by then." Leave the
   rest as Codex's record.
8. Run `npx playwright test tests/help.spec.mjs tests/hta.spec.mjs tests/unit.spec.mjs`,
   `npx prettier --check .` and `node tools/us-english.mjs --diff`. Every About stays two paragraphs
   and 40 to 180 words, and every how-to at most 110 characters.
9. Open a draft PR with the five sections (Summary, Verification, Deviations, Known issues, What was
   cut), crediting Codex's #193 as the source. Then reply READY with the head SHA. No clips.

You own `src/toy-help.js` (only these entries), the two audit files and this handoff file. Don't
touch other files. Never edit tests/taps.spec.mjs. American English. Workers never merge.

### The review: fixes (26)

- `sun`\*: keep the old how-to ("set off a solar flare"); use the replacement About.
- `star`_, `orbital`_, `atom`_, `opal`_, `diatom`_, `candle`_, `neptune`_, `starfish`_,
  `transformer`_, `pearl`_: use the replacement texts.
- `pretzel`: broken grammar ("After the tap, and it springs"); use "Then it springs…".
- `heart`: the anatomy model has no cutaway in the code. Use "Style switches between an anatomical
  heart and a love heart; Color changes its tint."
- `uranus`: "…on its side, its axis tilted about 98 degrees, so it rolls around the Sun like a
  ball." Drop "orbit's normal".
- `bacteriophage`: paragraph 1 says "fibers" but paragraph 2 says "legs". Use "thin tail fibers,
  like legs", and end with "Phages are thought to be the most numerous biological things on Earth,
  and doctors are studying them as a way to treat infections."
- `maple`: "…stops making it, so yellow and orange pigments show through, and many maples also make
  new red ones."
- `animal-cell`: replace "ATP" with "turn food into energy the cell can use". Drop the merge/reset
  sentence that repeats "flows the two back into one".
- `vintage-camera`: drop "This does not identify the scanned camera…"; keep "the whoomph of the
  flash".
- `solar-system`: "This is a model, not to scale: sizes and distances are squeezed so no two planets
  touch." Drop the appended sentence.
- `water-bottle`: "so turning it pulls it down tight…". Drop the meta sentence.
- `carrot-cake`: "bake into the crumb" (not "soften… soft") and "…because they are among the sweeter
  vegetables."
- `tardigrade`: "Tap it and it wiggles its body and legs."
- `tornado`: "The Power slider in the Toy tab sets how hard it swirls."
- `mobius`: keep the old paragraph 1 and add "Pick its colors and glow in the Toy tab too."
- `fourier-circles`: keep the old text, but say "can draw almost any closed shape, given enough of
  them."
- `diffusion-model`: keep the old text, but drop the "suits Splashery well" analogy.

### The review: reject, keep main's text (17)

`bumblebee` (the source is the brown-banded carder bumblebee, Bombus humilis), `mandeltorus`
(CREDITS.md: a rendered fractal, not a scan), `brain`, `klein-bottle`, `lorenz`, `gyroid`,
`graph-plotter`, `surface-plotter`, `unit-circle`, `splat-equation`, `sorting-machine`, `cnn`,
`looped-transformer`, `turing-machine`, `model-splats`, `bombe` (keep Bletchley Park, the Wrens and
the roughly 200 machines), and `fluid-lab`.

### Conflicts with main (18): main wins

`molecule`, `protein`, `periodic-table`, `crystal-lattice`, `rocks`, `storm-cloud`, `bricks`,
`puzzle-cube`, `hoodie`, `sunglasses`, `shield`, `gaussian-splatting`, `enigma-machine`,
`chladni-plate`, `splat-mirror`, `song-landscape`, `video-3d`, `splat-field`. Then carry these
corrections onto main's text (within the limits):

- `puzzle-cube`: "…in 20 moves or fewer when a half-turn counts as one move".
- `hoodie`: "Its soft fleece is usually knitted cotton or a cotton blend, brushed on the inside."
- `gaussian-splatting`: "start from a rough cloud of points (worked out from the photos, or
  random)".
- `periodic-table`: "of a typical isotope". `splat-field`: the splat count depends on the device and
  the Detail setting. `splat-mirror`: "Tap to flatten it or raise it again."

### Replacement texts (About, exact)

```js
export const P = {
  transformer:
    "A transformer is a neural network first described in 2017, for translating text. It splits text into tokens, and in each layer every token uses attention: it looks at all the others and weighs how much each one matters to it. Language models built this way predict the next token.\n\nTap it: arcs jump between THE CAT SAT ON, thicker where attention is stronger, one color for each of two heads; the tiles rise through the layers, and MAT drops in. The Encoder–decoder diagram in the Toy tab is the classic design. Its key: an eye is attention; a lidded eye, masked attention (it only looks back); +, add and norm; », feed forward; a vector, embedding; a wave, positional encoding; a slash, linear; bars, softmax; N×, repeated N times. HELLO WORLD goes in, and given START HOLA, it predicts MUNDO.",
  orbital:
    "An electron does not circle the center of an atom like a planet. It spreads out as a cloud, called an orbital, that shows where it is most likely to be found. Orbitals come in set shapes: a ball, a dumbbell, a dumbbell with a ring, and more. The two colors show where the electron's wave is plus and where it is minus, not electric charge.\n\nPick an orbital from 1s to 4f, as a cloud or as lobes, in the Toy tab. Tap it and a tiny packet of light, a photon, comes in. The electron takes it in, jumps up to a bigger orbital and glows, then drops back with a flash and gives the light out again. This is how glowing gases give off light of their own colors.",
  atom: "Everything around you is made of atoms. Each one has a tiny heavy center, the nucleus, made of protons and (in almost every atom) neutrons, with electrons around it. The number of protons decides which element it is: carbon has 6, oxygen 8 and gold 79. Pick any of the 118 elements in the Toy tab.\n\nThis model draws the electrons in rings called shells, an idea of Niels Bohr's from 1913; pick the Cloud style for a truer picture, or Every nucleon to see all its protons and neutrons. Tap it and the electrons whirl faster until each shell blurs into a glowing ring, then slow down. The nucleus is tens of thousands of times smaller than the whole atom, which is mostly empty space.",
  opal: "Opal is made of tiny balls of silica, the stuff of quartz and sand, with a little water between them. In precious opal the balls are packed in neat rows, and light passing through them splits into flashes of color that change as the stone moves. This is called play of color. Fire opal is named for its orange body. Opal is cut into a smooth dome called a cabochon, not into facets.\n\nTap it and it rocks in the light while patches of color roll across it, changing as they go. In the Toy tab, pick a white, black or fire opal. Most of the world's opal comes from Australia.",
  starfish:
    "A starfish, or sea star, is not a fish at all but a relative of the sea urchin. It has no brain. Seawater pumped through canals in its body works the hundreds of tiny tube feet under each arm, which let it creep along and grip rocks, and at the tip of each arm is a simple eye. Many kinds can regrow a lost arm.\n\nTap it and its five arms lift and curl in turn, like a slow wave, then settle back. Pick an orange, red, purple or blue starfish in the Toy tab.",
  diatom:
    "A diatom is a single-celled alga with a shell made of silica, the material in glass. Its patterned shell, called a frustule, has two overlapping halves, rather like a box and its lid. Diatoms live in fresh and salt water and use sunlight to make food, releasing oxygen.\n\nTap it and a glint of light runs across the glass, then the two halves lift apart to show the golden cell inside and close again; real diatoms don't open like this. Diatoms make about a fifth of the oxygen on Earth.",
  candle:
    "A candle is a stick of wax with a string, the wick, down the middle. The flame's heat melts the wax, the melted wax soaks up the wick, and near the flame it turns into a gas, which is what really burns. The blue part at the bottom burns with plenty of air; the yellow above is tiny bits of soot glowing hot.\n\nThis candle starts lit. Tap it to blow it out, and a thin trail of smoke rises from the wick; tap again to light it. A flame is shaped like a teardrop because its hot gases rise; in space, where nothing rises, a candle flame is a round, blue ball. You can pick the wax color in the Toy tab.",
  sun: "The Sun is the star at the center of our solar system, a huge ball of hot, glowing gas. About 1.3 million Earths could fit inside it, and its light takes about 8 minutes to reach us.\n\nThis Sun churns by itself: bright cells of hot gas swell and fade, and loops of glowing gas called prominences rise and sink at its edge. Tap it to set off a solar flare: its feet flash white, a loop of hot gas climbs off the top edge, swells, and its top breaks away into space. Real flares are sudden bursts of energy that can disturb radio signals on Earth, and the gas thrown off with them can light up auroras.",
  neptune:
    "Neptune is the eighth and farthest planet from the Sun, an ice giant of pale greenish blue, a little bluer than Uranus; the deep blue of older spacecraft pictures came from processing. It has the strongest winds in the solar system, faster than 2,000 kilometers an hour. It was the first planet found by math: astronomers worked out where it must be before they saw it in 1846.\n\nTap it and belts of white cloud race around it twice while a band with a dark storm drifts the other way. The spacecraft Voyager 2 saw a great dark storm like this when it flew past in 1989. Neptune takes about 165 years to go around the Sun once.",
  star: "A star is a huge ball of hot gas that shines because, deep in its core, it squeezes hydrogen into helium and gives off energy. Its color shows how hot it is: red stars are the coolest and blue stars the hottest. The Sun is a yellow star, about halfway through its life.\n\nTap it to run the life of a star like the Sun, sped up. It swells into a red giant, puffs off its outer layers as a glowing shell and shrinks to a tiny white dwarf; then a new star lights up. A real star like the Sun takes about 10 billion years to do this. Pick the kind of star in the Toy tab; a tap always plays the Sun's story.",
  pearl:
    "A pearl is a gem made by a living animal. When an irritant, usually a scrap of the animal's own tissue or a bead put in by a pearl farmer, ends up inside an oyster or mussel, the animal coats it with layer after layer of nacre, or mother-of-pearl, the same shiny stuff that lines its shell. The thin layers give a pearl its soft glow, called luster.\n\nThis oyster starts open, with its pearl inside. Tap it to close the shell; tap again to open it. A pearl can take years to grow, and most pearls sold today are grown on pearl farms.",
};
```

## State

READY: October 4, 2026. Codex's origin/codex/about-audit merged (merge commit); the 18 conflicts
took main's entry (six got their listed corrections), the 17 rejects are main's text exactly, the 26
fixes are applied (11 with the replacement texts), `fluid-lab` is main's, curly apostrophes the PR
added are straight, the two audit files are fixed and noted. 79 entries differ from main.

Checks: `tests/help.spec.mjs`, `tests/hta.spec.mjs`, `tests/unit.spec.mjs` pass;
`npx prettier --check .` clean; `us-english.mjs --diff` lists only Codex's audit records (22 British
spellings in `docs/audits/`, left as the record).

Notes: `torus-knot` (a good-as-written entry) was 143 words and failed the hta test's 140 limit; I
cut "The first is a trefoil and the second a cinquefoil." `splat-field` has no Detail option of its
own in its recipe, so it says "the Detail setting" as the brief asked (the app's Detail setting).
The new arsenic fact (sublimes at about 615 °C) cites the RSC arsenic page; not re-verified live.
