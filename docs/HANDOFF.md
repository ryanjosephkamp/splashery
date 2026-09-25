# Handoff

The current state and the next phase. The session that finishes a phase updates this file. The
ground rules are in [CLAUDE.md](../CLAUDE.md).

## Current state (2026-09-25, after Phase E3; next: Phase E4)

- Phase A is done: splashery PR #13 and homepage PR #33 in
  `ryanjosephkamp/ryanjosephkamp.github.io`, both merged. Phases B (PR #17), C1 (PR #18), C2 (PR
  #19), D (PR #20), E1 (PR #21), E1b (PRs #22–#24), E1c (PRs #26–#28) and E2 (PRs #29–#31) are
  merged. The owner approved everything from E2 ("Everything from E2 is approved and looks good!").
- **Phase E3** is one PR from `claude/trusting-cerf-d1rtbs` (PR #32): new tap effects for all 26
  tiny, anatomy and maths toys (TOY-PLAN.md has each one's `improved` entry), sounds re-timed to
  them, and clips of all 26 on the Effect review page (the older, approved clips were removed from
  the page; the owner's marks on them stay in its database). Check it is merged, and read the
  owner's verdicts (`e3-<toy id>`), before starting E4. **Next: Phase E4** (below).
- **Channels (E3; docs/PACKS.md section 6).** `out.morph = [a, b, c, d]` drives four channels, with
  motion on or off, and three new kinds follow them:
  - `morph` (kind 17): `to: (c) => [x, y, z]` gives each splat its own target (recipe coordinates);
    it moves there in a straight line as its `channel` goes 0 → 1 (values past 1 or below 0
    extrapolate). The offset is packed into the splat's two behaviour values (12 bits per axis over
    ±`MORPH_RANGE` = 2 toy units, `Kit.encodeMorphs`), so no new stream was needed. Targets count in
    the fit unless the recipe sets `k.fitMorphs = false` (then keep the morphed shape within about
    1.2 toy radii, the edge of the view). A non-finite target throws at build.
  - `band` (18): glow (`out.glow`) where the channel passes `params[0]`, width `params[1]`: a light
    front that starts at the tap (the astrocyte's calcium wave, the mitochondrion's cristae).
  - `fade` (19): alpha fade as the channel passes `params[0]` (negative width fades in), so a layer
    clears without speckle (the virus's copies).
  - `skin` (20): `skin: (c) => [a, b, s]` follows tokens a and b's offsets blended by s (the
    hypercube's edges between its sixteen corner tokens).
  - `part` may be a function `(c) => index`, to split one shape between parts (the bacterium's
    halves, the diatom's girdle).
  - Tests: unit tests for the packing and for every E3 toy's tap; a smoke test that the red blood
    cell's morph changes the picture.
- **Morph lessons (E3).** Splats keep the orientation they were built with, so where a morph turns
  the surface a lot (a pinch closing into a new round end) use rounder splats (`flat` 0.3–0.45).
  Where a morph stretches a surface its splats spread apart and the far side shows through as
  speckle: use slightly larger splats on the morphing copy (`size` 1.25–1.3: the torus knot, the
  gyroid) or keep the stretch modest (the white cell's cup). A two-sided surface with a different
  colour per side (the gyroid) speckles wherever one face has gaps. A morph and another behaviour
  cannot share a splat: morphing toys lost their `breathe`; several drive a gentle idle morph or a
  body squash instead. A toy that turns its body (the virus, the pollen grain) and sends pieces off
  undoes the body's turn in the pieces' part so they leave in a fixed place on screen.
- **Effects (E3).** Tiny in `src/packs/tiny.js` (fission `BAC`, division `CELL`, phagocytosis `WBC`,
  `AMOEBA_DIR`, `PARAMECIUM`, `VIRUS`, `DIATOM_AXIS` and `snowflake()` at the end), anatomy in
  `src/packs/anatomy.js`, maths in `src/packs/maths.js`. Two E3 effects differ from the plan: the
  Menger sponge is carved level by level (a zoom into itself blurred), and the Mandelbulb is wrung
  (a twist, as the owner's note asked) instead of changing power. The paramecium swims its loop
  about the view direction (turning about the view keeps the draw order). The hypercube is a true
  rotation in the X–W plane with 4D perspective; a full turn brings it back exactly.
- **Sounds (E3).** 26 specs re-timed in `src/toy-sounds.js` (all pass `tools/sound-check.mjs`); the
  heart's lub-dubs follow its racing beat. The Splashery Sound Board page was rebuilt.
- 199 toys are keep, 2 more, 83 new.
- **E2 review (2026-09-25).** The owner's review is word for word in
  `docs/reviews/2026-09-25-e2/review.md` (and its marks are in the Effect review page's database).
  24 of 32 were "good"; the fixes are in this PR: the Moon's phases were replaced by a landing (a
  lunar module lands near the top of the Moon, an astronaut climbs down, plants a chosen flag,
  unrolls it and waves; a second tap packs up and lifts off; the flag is a `type: "flag"` toy option
  drawn from its SVG through the screen texture, at the flag's real shape, which
  `tools/flag-aspects.mjs` now writes into flags.json); the sapphire's star lies on the stone and
  ends at its edge; the quartz glints point different ways; the solar system's planets are spaced
  and sized so none touch, at rest or in the row. The atom, orbital, molecule and crystal lattice
  were "good, but more of them some day" (BACKLOG). The owner's other requests (a resizable, roomier
  settings panel with a main tab and a reset button, sharper laptop keys, chess playback and flag
  colours, molecules from formulas or files, a protein toy with PDB upload) are in the stacked PRs
  `claude/quirky-pasteur-modo55-2` and `-3` (merge them in that order, after this one).
- **Settings panel (after the E2 review, PR `-2`).** Tabs: **Toy** (the main tab: action, controls,
  options, Motion with the turntable ON/OFF switch, Quick settings with flag colours, Detail and
  **Reset everything**), **Tools** (the picked tool's settings, opened by picking a tool, and the
  effects), Look, Make, Share and About (an ⓘ icon). Reset everything (`app.resetAll`) makes a fresh
  scene for the same toy and sets Detail to Auto. On wide screens `.grip-panel` (the panel's left
  edge) and `.grip-shelf` (under the shelf) set `--panel-w` and `--shelf-h`, kept in localStorage;
  the shelf grid is `auto-fill` so it gains columns. Rows and groups are roomier.
- **Chess (PR `-2`).** A game bar under the board shows the title, details and move, with start,
  back, play/pause, on and end buttons (`game.step`, `game.jump`); pausing keeps the position; a tap
  on a finished game that is still playing starts it again (`action.at` fires a `restart` pulse).
  The game's details (PGN tags) can be edited in the panel. Flag colours lie over the board from
  above, gently (the new `top` projection; `patternProjection`, `patternAmount: 0.3` and
  `patternDetail: 1` in the recipe), so the light and dark squares stay clear; the pieces keep their
  own ivory and ebony (`pattern: false`), as the owner asked after seeing them in flag colours
  (review page, 2026-09-25).
- **Chemistry (PR `-3`).** `src/chem/` reads molecules and proteins with no libraries: `elements.js`
  (69 elements up to uranium, CPK colours, covalent radii, formulas), `smiles.js` (a SMILES parser
  with rings, branches, charges, isotopes and aromatic kekulisation; implicit hydrogens), `embed.js`
  (a seeded 3D layout: distance geometry then a small force field with bond lengths, angles, planar
  rings and repulsion), `molfile.js` (MOL/SDF V2000, XYZ and PDB small molecules; bonds guessed from
  distances when a file has none; a table of 66 named molecules), `condensed.js` (formulas written
  out, such as CH3COOH or (CH3)2CHOH, turned into SMILES) and `protein.js` (PDB and mmCIF chains,
  HELIX/SHEET records or a simple DSSP-style fallback, and a smooth backbone path). The molecule
  toy's **Your own** panel takes a name, a formula (written out, or one that fits a table molecule:
  C6H12O6 shows glucose and says that fructose fits too), a SMILES string or a file; the result is
  kept in the hidden `source` option (SMILES as typed, a file packed as `M1;name;atoms;bonds`, up to
  24,000 characters), so links keep it. The **protein** toy (Atoms) draws a cartoon (helix coils,
  strand arrows, loop tubes, ligands as ball and stick) of 1UBQ, 4INS, 1EMA or 4HHB
  (`assets/proteins/`, CC0) or an opened PDB/mmCIF file; a tap pulls its pieces apart and back
  (GFP's chromophore glows). An opened protein stays in the page (`fileName` option only); a link to
  it shows ubiquitin. New engine hooks: `recipe.prepare(options)` (async, before the build),
  `recipe.input` (the panel), `recipe.credits`, option types `text` and `flag`, and `hidden` options
  (docs/PACKS.md section 5). Tests: `tests/chem.spec.mjs`.
- **A rare engine warning (2026-09-25).** Once in seven full test runs, the stretchy-toy smoke test
  caught
  `GL_INVALID_OPERATION: glDrawElementsInstanced: Mismatch between texture format and sampler type`
  from ANGLE. Splashery's own shaders use no integer textures, so it comes from the engine's splat
  draw (likely a draw while one of its integer data textures is being swapped); the test passed in 4
  re-runs straight after. If it comes back, catch the trace (`test-results/`) before cleaning up,
  and look at when the engine swaps its order or work-buffer textures. In E3 the same test failed
  once in three full runs in another way: the drag on the gummy bear never became a grab (the GPU
  pick found nothing under the pointer for a minute), so the drag orbited. It passed alone three
  times and in the next full run; the trace was lost to a re-run, so keep `test-results/` if it
  comes back.
- **Tiny splats vanish on small screens.** The renderer drops splats that come out under about two
  pixels, so a detail built from very fine splats (high `weight` and small `size`) disappears on a
  phone or in a 360 px clip. Keep `size / sqrt(weight)` near 0.5 or more for anything that must show
  (the Moon's lander), and check a clip at 300–360 px.
- **Effects (E2).** Space in `src/packs/space.js`, atoms in `src/packs/atoms.js`, gems in
  `src/packs/gems.js`. Idle motion added where the owner asked: the Sun churns, Saturn's and
  Uranus's rings turn, the aurora's folds race round, the galaxy's arms turn.
- **Draw order lessons (E2; docs/PACKS.md 7b "Draw order").** Splats sort in their built pose. A
  solid body turned past a quarter turn looks hollow, so spinning bodies are built twice
  (`spinParts`, `TURNED`, `turnedColor` in space.js) and show the copy nearer its built pose; cloud
  layers over a turning body cannot be fixed that way, so Earth's clouds are painted on and Venus
  and Neptune turn in latitude bands; `interior` splats draw over a turned surface, so turning
  bodies are hollow with a separate `coreBall` that hides while they turn; forever-turning rings use
  marks that repeat every eighth of a turn (`ringAngle`). Pieces that must draw in front are built
  where they will be (the black hole's star, the orrery's Mercury). Bands that turn at different
  speeds (Jupiter, Venus, Neptune) set the new part `cull` flag while they turn, so one band's far
  side cannot show through the next as a flap. Earth and Mercury, whose night and heat layers stay
  put, have four copies a quarter turn apart (`spinQuarters`) and show one built on the far side of
  where it is shown, so the layer stays on top.
- **Hidden pieces count in the fit (E2).** Build effect pieces inside the toy's resting size and
  grow them by part `scale` (the Sun's flare, the star's red giant, the meteor's fireball).
- **Engine (E2).** `build(k)` can leave `k.data` for `drive`, which gets it as `info.data`
  (`src/motion.js`; the molecule and the crystal lattice use it). A driven part can set
  `cull: true`: the kit shader (GLSL and WGSL, `src/effects.js`) then hides its splats on the far
  side of the part's pivot from the camera (`packParts` sends it as a visibility of -1 - v). Tokens
  (`kind: "token"`, up to 48) now also break shapes into pieces: the asteroid (18 cells with fresh
  broken faces), the meteor's fragments, the molecule's atoms (the buckyball by pentagons). A new
  hidden `5g` orbital is the excited state for the 4f orbitals.
- **Sounds (E2).** 32 specs re-timed in `src/toy-sounds.js` (all pass `tools/sound-check.mjs`). The
  pulsar ticks on each flash and the star rings a bell as it is reborn through `out.cues` (beyond
  the sound check's five seconds). The Splashery Sound Board page was rebuilt.
- 172 toys are keep, 2 more, 109 new.
- **Phone panel (E1c).** Picking a toy folded the phone sheet only after the toy had loaded, so a
  panel opened meanwhile (a scan takes seconds on a phone) shut itself. `chooseToy` now folds it at
  the pick. From the shelf grid, More opens the settings in one tap (the handle, a swipe down, a
  pick or a tap on the toy closes the grid).
- **Chess from PGN (E1c).** `src/chess.js` holds the rules: legal moves (checked against published
  perft counts in a unit test), SAN, and `readPgn` (the first game of a file; comments, variations
  and NAGs skipped; FEN set-ups; messages that name the failing move). The chess set has 48 tokens
  now (`MAX_TOKENS` in `src/motion.js`, `uSpTokens[96]`): 16 hidden spares rise for promotions. A
  recipe can offer a game panel with `recipe.game` ({ title, isDefault, load(text), reset }), which
  `ui.js` draws (open a file, paste, back to the default). `tools/effect-clip.mjs` and
  `tools/effect-strip.mjs` take `--pgn=file`.
- **Kit parts for scans (E1c).** When a scan's part cannot move without tearing (the elephant's
  trunk is fused to its forehead), hide it (a rig part with `visible: 0`) and build a replacement in
  the rig's add-on, traced from the scan's splats and coloured from them: the elephant's trunk is
  five tube segments on ball joints, driven as a chain. To read a scan's colours, unzip its `.sog`
  and decode `sh0.webp` with `meta.json`'s codebook (pixel i is splat i). A cut can also follow a
  measured plane: the cat's head is everything above its neck's slanted plane (a huge sphere region)
  and its collar follows the neck's measured radius.
- **Sounds (E1c).** Cues play mid-effect sounds (Newton's cradle clacks on each strike). A sound
  spec's `pickAt` times a picked note (a xylophone bar sounds as the mallet lands, at 0.12 s).
- **Locked toys (owner approved, do not change their look or behaviour):** the laptop ("basically
  perfect … please lock that in"). Engine changes must keep it working exactly as now; the laptop
  smoke test guards it. The one change since, at the owner's request after E2: sharper key letters
  (every font pixel filled by a 3 x 3 grid of dots just above the cap) and digits on the top row.
- **Phase E1b** (the owner's review of E1, verbatim in `docs/reviews/2026-09-24-e1/review.md`) is in
  three stacked PRs, merged in order: `claude/phase-e1-45lgvf-1` (rules, clip tool, scan and shape
  fixes), `-2` (thrown balls, eight-ball, storybook) and `-3` (chess and laptop). Check that all
  three are merged before starting E2.
- **Effect quality rules (E1b).** CLAUDE.md now has "Effect quality rules" and docs/PACKS.md section
  7b the details: real motion of solid pieces (never bend a scan with soft regions), separate things
  move separately, real breaking, instruments visibly played, mouths move, real rules and real
  throws, real materials, the grape as the bar, and judging effects as clips at phone size.
- **Effect clips (E1b).** `tools/effect-clip.mjs` renders a tap effect as a looping GIF with the
  clock stepped by hand (about 90 s per toy under SwiftShader). The owner reviews clips of every
  changed effect on the private "Effect review" page
  (https://claude.ai/artifact/NCsg9V5SzFY3Mnwuwgq7pi) before merging. Its `verdicts` collection
  holds one doc per toy: `{ verdict: "good" | "fix" | "", note, at }`. Read it with ArtifactData,
  and republish the page (same URL) with new clips each phase.
- **Scan fixes (E1b).** Rig regions now default to hard edges (`soft: 0.03`), overlapping regions
  split by the nearest centre, `over: true` makes a region win (a jaw inside a head), and `notColor`
  keeps a colour out (the tomatoes' plate). New effect movers: `fall` (Voronoi pieces break off,
  fall to the floor and come back), `vibrate` (a string's standing wave) and `writhe` (a travelling
  wave that contorts a shape). The cat, horse, elephant, bust, fly, tomatoes, basket, ukulele,
  raspberry, blackberry, blueberry, donut and knot were redone (see TOY-PLAN.md).
  `tools/rig-map.mjs` has `--center`/`--half` zoom and left and bottom views. To place regions on a
  scan, read its splat centres in the page (`player.stage.toy.resource.centers`) and slice them
  numerically; that found the fly's legs, which the renders hid.
- **Chess (E1b).** The chess set is now a kit toy (`src/packs/games.js`, category Toys) with 32
  pieces as "token" splats (`uSpTokens`, 2 vec4 each). A tap plays Morphy's Opera Game (Paris,
  1858); a unit test checks the final position. Recipes can now ask for sounds mid-effect with
  `out.cues` (each move clacks as it lands). The old chess scan (CC0, Poly Haven) is off the shelf;
  its files are still in `assets/toys/chess-set/` and `tools/assets.json`.
- **Laptop (E1b).** Keycaps with letters (behaviour "key": the pressed key goes down), a live screen
  (behaviour "screen": splats read the `uSpScreen` texture, drawn by the recipe's `screen.draw` when
  `screen.version` changes), `typeKey` for a real keyboard (it gets first pick of the keys before
  the app's shortcuts), and `drag` for the trackpad (a drag that starts on the pad moves the
  pointer; elsewhere it orbits).
- **Thrown balls (E1b).** The American football spirals, the rugby ball tumbles end over end, the
  shuttlecock flips and floats down spinning, and the flying disc spins and loops. The eight-ball is
  opaque and glossy; the storybook's outside is crisp.
- 140 toys are keep, 2 more, 141 new.
- **New effects for the scans and shapes (E1).** All 33 E1 toys have their own tap effect (E1b redid
  13 of them after the owner's review).
- **Rigs grew (E1).** Everything is in `src/rigs.js` (reference at its top), `src/rig.js` (tagging
  pass), `src/rig-fx.js` (effects) and the rig variant of the modifier in `src/effects.js`:
  - Colour keys: a region can take only splats of one colour, and `keys` marks up to two sets of
    splats by colour (or long thin splats) in the `splatPart` stream's spare channels. Used for the
    strawberry's seeds, the cookie's jam, the millipede's legs, the basket's shells, the clock's red
    second hand, the ukulele's strings, the planet's clouds and the donut's sprinkles.
  - Part glow and scale: a driven part takes `tint`, `glow`, `bright` and `scale` (`uSpRigTint`, and
    the pivot's w in `uSpParts`, which kit toys now read too).
  - Whole-body effects (`fx`, up to four per rig, `uSpFx`): select, mask (half-space, strips,
    sphere, wedge), move (push, along, scatter, hop, shiver, turn, bands, bend, peel, split), colour
    (glow, recolour, brighten, sparkle, fade, darken) and pattern (front, band, stagger, ramp,
    swirl, wave).
  - Add-ons (option b): `addon.build(k)` builds a small kit toy in world coordinates as a second
    splat entity (`stage.setAddon`), sorted with the scan in the work buffer and driven through
    `out.addon`. Used for the cactus flowers, the flames of the lantern and the gnome's lamp, the
    camera flash, the bust's speech bubble ("SALVE, AMICE!", in the storybook font, now in
    `src/font.js`), the croissant's and pomegranate's insides, and the carrot cake's cut faces.
  - The four shelf shapes (blob, donut, knot, planet) are rigs too: a rigged procedural toy gets its
    own container format with the `splatPart` stream, and clay edits re-tag it.
  - `alive` may be a function of the controls (the lantern flickers only while lit). The alarm
    clock's second hand ticks all the time (`alive: true`).
  - The lantern's tap is now a toggle, with `{ on, off }` sounds.
- `tools/rig-map.mjs` renders a scan from four sides with an orthographic camera and a world grid;
  `--rig` tints parts and keys, `--at=0.9` shows the pose after a tap. Strips of every E1 effect are
  in `tests/screenshots/e1-*.png`.
- Sounds were re-timed to the new effects (23 specs changed; all pass `tools/sound-check.mjs`). The
  Splashery Sound Board page was rebuilt from the new specs.
- Fixed on the way: uniforms that a toy does not set keep the previous toy's values in the shared
  shader scope, so the rig effects' uniforms are now set for every rig (zeros when unused).
- **Sound engine (D).**
  - `src/voices.js` is a voice library of about 80 synthesised voices (plucked strings with
    Karplus-Strong, modal bells, bars, glass and wood, drums, buzz, quack, squawk, mew, hoot, ribbit
    and cheer formant voices, crunch, rattle, patter, crackle, splash, wind, roar, engines, horns,
    theremin, pads) and a note sequencer (`notes: "C5 E5+G5 -"`, `step`, `strum`). Its header
    documents the spec format. The old shared names ("chime", "pop" and so on) still play exactly as
    before, and the effect switches and tools still use them.
  - `src/toy-sounds.js` gives all 283 shelf toys their own spec, built from the Sound lines in
    TOY-PLAN.md, with `{ on, off }` halves for the 32 toggles. Recipes no longer carry `sound`
    (every recipe `sound:` field was removed). Hop-only toys play their own sound too.
  - Each voice has a measured `LEVEL` (`node tools/sound-check.mjs --voices`), and the output goes
    through a limiter, so toys are about equally loud and layers never clip.
  - `tools/sound-check.mjs` renders every sound offline in headless Chromium and checks level,
    clipping and length; `--sheet=` draws spectrogram pages (in `tests/screenshots/d-sounds*.png`),
    `--wav=` writes WAV files. `tools/sound-audit.mjs` lists toys without their own action or sound
    (none lack a sound; 179 still only hop) and voice usage.
  - No samples were used: the quack, the crowd cheer and the alarm bells are synthesised. Nothing
    was added to CREDITS.md.
  - The owner can audition every sound on a private page, the "Splashery Sound Board":
    https://claude.ai/artifact/VE9XCTxH3djST6dGb6ZAkj (built from the same voices.js and
    toy-sounds.js; rebuild and republish it if the sounds change).
- **Taps that know where they landed (D).** A tap on the toy passes the picked point, in the
  recipe's coordinates, to `action.at(point, c)`, which may fire another control and pick an item;
  drive() sees `info.tap = { point, key, pick, time, n }`. A sound spec's tune plays only note
  `pick` for such a tap. The xylophone uses it: tap a bar and the mallet strikes that bar and plays
  its note. Embeds pass the point too. `tools/effect-strip.mjs --at=x,y,z` taps a point.
- **Scan rigs (D).** `src/rigs.js` gives captured toys `parts` made of soft ellipsoid regions (world
  coordinates) plus `controls`, `action` and `drive()` like a recipe. At load a GSplatProcessor
  (`src/rig.js`) writes each splat's part and weight into a `splatPart` instance stream, and the
  modifier's rig variant (`MODIFIER_RIG` in `src/effects.js`) moves splats with their part, blended
  by the weight. `out.body` (squash, offset, rotation) works for scans too. `?rig=show` tints the
  parts, for placing regions. Two rigs: the cat statue (head turn, tail flick) and the real rubber
  duck (squeeze and spring back, body only). Option (b) from the old outline, a kit-built add-on
  drawn as a second splat entity (a lantern flame, a camera flash), was not built.
- **Drag-to-stretch (D).** A recipe (or rig) with `grab: { radius, max }` is stretchy: with the
  Orbit tool, a drag that starts on the toy pulls the grabbed part (a Gaussian falloff in the
  modifier, `uSpGrab`) and it springs back with a few wobbles when let go (EffectDriver `grabStart`,
  `grabTo`, `grabEnd`); a drag that starts beside the toy still orbits. Only the gummy bear has it.
  Letting go of a real stretch plays the toy's sound.
- Plan updates: the cat statue, the real rubber duck and the gummy bear are now `keep` with
  `improved` entries, and the xylophone has an `improved` entry. 101 toys are keep, 3 more, 179 new.
- **Clearer effects (C2).** All 33 toys are now `"v": "keep"` in `tools/toy-plan.json`, and each has
  an `improved` entry saying what changed (TOY-PLAN.md shows it as "Improved"). The only toys still
  marked "more" are the four touch and drag toys for Phase F.
  - Several taps changed type or key. DNA's `unzip`, the submarine's `dive` (was the `scope`
    toggle), the ice cream's `thaw`, the Lorenz attractor's `race`, the Klein bottle's `surge` and
    the cherry blossom's `shake` are pulses. The diya's tap is a new `ring` toggle (Blow is still a
    control).
  - Some defaults changed, so resting looks changed:
    - The pufferfish's Puff default is 0.1, so it rests slim.
    - The tree's Lights default is off.
    - The castle's drawbridge starts up.
  - Old scenes that saved other values still load with those values.
  - Per-tap variety uses a counter in the recipe's closure, hashed to pick a variant. Examples: the
    fireworks' tube and shell type, and the crystal ball's sign. The drum keeps its last tap times
    there too.
  - New visible pieces:
    - the bus's stop sign, doors and lights
    - Big Ben's open belfry and bell
    - the pagoda's wind chimes and stone lanterns
    - the diya's ring of eight small diyas
    - the eye's lids, which are hidden at rest
  - Thumbnails were re-rendered for the toys whose resting look changed: pufferfish, decorated tree,
    diya, bus, Big Ben, castle, pagoda, DNA, Lorenz and Klein bottle.
  - `tools/effect-strip.mjs` renders a tap effect as a filmstrip (a frame before the tap, then
    frames at set times after it). It steps the clock by hand, so frames are repeatable.
    `--taps=3 --gap=0.2` taps several times; `--opt=style=double` sets a toy option. Composites of
    every C2 toy are in `tests/screenshots/c2-*.png`.
- `HF_TOKEN` was checked on 2026-09-24 (whoami: account `ryanjosephkamp`, role `read`). It works.
- **Visual fixes (C1).** All 26 Fix lines are done; each toy's `fixed` entry in
  `tools/toy-plan.json` says what changed (TOY-PLAN.md shows them as "Fixed").
  - Grain had one main cause: random splat placement leaves about a quarter of a surface thinly
    covered, and the far side and the core show through as dark speckle.
    `k.add(shape, { even: true })` in `src/kit.js` places surface splats with a low-discrepancy
    sequence (warped by area for lathes and param surfaces; `sampleEven`, `evenRand`). It is opt-in,
    so other toys are unchanged. It is used on the balls, the storybook's pages and cover, the lava
    lamp, the diya, the tree's star and the tractor's glass. Making it the default would likely
    sharpen many toys, but every thumbnail would change; see BACKLOG.md.
  - The balls have baked soft light and gloss (`lit()`), embossed pebble bumps (`grip()`), low
    jitter, felt fuzz on the tennis ball, and a faint see-through shell (`rim()`) that shows as a
    rim of light at the silhouette of the squash ball, hockey puck and medicine ball on a dark page
    and barely shows on a light one.
  - `tools/mesh-to-splats.mjs` filters textures to each splat's footprint (a mip chain) and has
    per-model options in `tools/models.json`: `light` (baked studio light), `normalMap`, `armAO`,
    `exposure`, `gamma`, `darkGlass`, `paintOut`. The camera, boombox, elephant and horse were
    rebuilt with them; the other 11 converted models were not (rebuilding them would change their
    look). The camera's lens and the boombox's printed maker names are painted out (brand rule).
  - Storybook: a 5x7 bitmap font and a short original story in `src/packs/objects.js`. Because
    splats sort in the closed book's pose, leaves hide once the next leaf lands on them, the cover's
    inside is its own part, and a `pile` part stands in for the hidden leaves. It now uses 15 parts,
    the limit.
  - The star cookie is turned round in `tools/assets.json` (`rotate: [180, 180, 0]`).
- `tools/toy-shots.mjs` renders toys at their home view to PNG files (`--size`, `--bg`, `--theme`,
  `--set=open=0`) for before and after reviews. Before/after crops for C1 are in
  `tests/screenshots/c1-*.png`.
- **Phone shelf (B).**
  - The phone sheet has three states in `src/ui.js` ("Bottom sheet"): `row` (the dock only), `grid`
    (body class `shelf-grid`: the shelf fills the sheet as a grid of about 4 columns) and `panel`
    (body class `sheet-open`: the tabs). `setMode()` switches them.
  - Dragging the handle or the shelf row up opens the grid. Tapping a card folds it back at once and
    loads the toy. Swiping down (handle, or the top of the grid), Done, Escape or a tap on the toy
    goes back to the row. More still opens the panel.
  - `SHELF_GRID = false` in `src/ui.js` switches the grid off; the handle then opens the panel as
    before. The owner may want this if the grid feels less friendly than the row.
  - Phone card labels wrap onto two lines (10.5 px, clamped). All 283 names fit; only
    "Bacteriophage" and "Mitochondrion" hyphenate. No marquee.
  - The grid's first screen loads about 55 lazy thumbnails (about 58 KB).
- "Find your own splat" is a `<details id="byo-help">` in Make → Your own splat.
- The shelf still has **283 toys**. Scene schema is v3 (v2 still loads).
- **Sharpness (A1).**
  - Device tiers low / mid / high / max replace weak / strong (`TIERS`, `PIXEL_RATIO` and
    `detectProfile()` in `src/player.js`; splat counts in `PROFILES` in `src/generators.js`).
  - Phones are mid: 140k splats, pixel ratio 2, and full scan files. Desktops are high: 200k,
    ratio 2.
  - Detail: Auto / High / Max in the Look pane (`localStorage` key `splashery.detail`, never in
    links).
  - Adaptive resolution lives in `Stage.timeFrame()` / `setBusy()` in `src/stage.js`.
  - `?profile=low|mid|high|max` (weak and strong still work). `?adapt=off` is for tools and tests.
  - Kit splats: overlap factor 1.2 and default flatness 0.2 (`src/kit.js`).
- **Embeds (A1).**
  - Transparent embeds use `color-scheme: light` on both sides. `normal` is not enough on hosts that
    declare `light dark`.
  - The toy is framed at 80% of the shorter side. `?zoom=` or the `zoom` attribute scales it.
  - The plain wheel zooms after a click. There are + and − buttons (`?controls=0` or `controls="0"`
    hides them).
  - The snippet is responsive, with a size picker in Share.
- The honeybee is upright. Shelf thumbnails retry once, then show a plain tile.
- Tools:
  - `tools/check-packs.mjs`: builds and timing, at the high tier's count by default; `--count=`
    changes it.
  - `tools/contact-sheet.mjs`: review sheet.
  - `tools/make-thumbs.mjs`: thumbnails, by pack or id. Allow about 18 s per toy under SwiftShader.
    Run one process at a time: parallel runs are slower.
  - `tools/sharpness-crops.mjs` and `tools/sharpness-pairs.mjs`: before/after crops.
  - `tools/prepare-assets.mjs`: SOG packing.
  - `tools/mesh-to-splats.mjs`: glTF to PLY.
  - `tools/fetch-flags.mjs`: flags.
- All 49 Playwright tests pass, including the dark-mode transparent embed test and the new phone
  grid and help panel tests.
- If `HF_TOKEN` is ever missing or rejected, tell the owner exactly what to change: the cloud
  environment menu in the session's title bar, then Edit, then an environment variable named
  `HF_TOKEN`.
- This helper is not in the repo. Rewrite it if needed:
  - A pack screenshot script: a Playwright page opens the app, clicks `.chip[data-category=…]` then
    `.toy-card[data-toy=…]`, waits until `#toy-status` starts with the toy's label, and takes the
    screenshot.
- In the cloud sandbox, headless Chromium cannot reach github.io. To screenshot a host page that
  embeds the live site, route `https://ryanjosephkamp.github.io/splashery/**` to the local server
  (`context.route` plus `route.fetch`).

Known issues carried forward:

- Splats are depth-sorted in their built pose, so large moving parts can draw out of order.
- Only 3 music toys exist.
- New in A1:
  - The tier thresholds and the 24 ms and 40 ms adaptive limits are guesses, not tuned on real
    phones.
  - Phones now build 140k-splat toys and download full scans, so they load more slowly.
  - Old transparent snippets with `color-scheme:normal` still show a white box on hosts that support
    dark mode. Re-copying the snippet fixes it.
- New in B:
  - The phone grid is tried only in headless Chromium with emulated touch, not on a real phone.
  - Swiping the handle up now opens the grid, not the panel (the older phone test was updated to
    match).
  - The help panel's app list (Scaniverse, Polycam, Luma, KIRI Engine) was checked against the app
    stores on 2026-09-24. Luma's site now leads with other products; its capture app is still
    listed.
- New in C1:
  - While the storybook opens, the last leaf's upper face is left out (it would draw over its
    turned-up side), so for a moment mid-turn you see the next page's words through it, mirrored.
  - The elephant is still a low-poly model (2,752 triangles) with its carving in the normal map. It
    reads much better with baked light, but no better CC0 elephant was looked for.
  - The rim on dark balls is baked into the toy, so it also shows faintly on a light page and under
    effects such as Dissolve.
  - Several vehicles' windows used random colour per splat, like the tractor's did (static). Only
    the tractor's were fixed.
  - Flags on vehicles were checked (all 14 in the French flag): windows, lights, tyres and now wheel
    rims, hubs and spokes stay unpainted. Launch pads, helipads and the flying saucer's pad do take
    the flag.
- New in C2:
  - The eye's blink lids look a little rough and bulky mid-blink.
  - When the kite loops (about 1 s in), its tail sticks out of the top of the frame. A `k.reach`
    would fix that but would shrink the kite at rest.
  - The Klein bottle's water surge only just meets the rule of thumb, because the old glow that
    moves by itself competes with it. The Lorenz trace reads as a brightening of the path, not a
    crisp new line.
  - Big Ben's bell and the pagoda's chimes swing only a little at the default zoom; the dial glow
    and the lanterns carry those effects.
  - The bus's stop arm is on the door side (+Z) so the camera sees it; real buses have it on the
    driver's side.
  - The bicycle's wheel spin-up reads in motion but not in stills; the bell's ring lines carry it.
  - The pufferfish's belly patches show as small pale flaps when it is slim (a shape that already
    existed at low Puff).
  - Scenes saved with the submarine's old `scope=0` load with the periscope up.
  - The rubber duck and the guitar still need their own sounds (Phase D): a quack and real music.
    (Done in D.)
- New in E3:
  - The owner has not yet seen the E3 effects; the clips on the Effect review page are the check.
    They were checked as clips and larger stills in headless Chromium (SwiftShader), not on a phone.
  - The channel kinds are new shader code in GLSL and WGSL; only WebGL2 was run (no WebGPU adapter
    in the sandbox).
  - Morphing toys lost their `breathe` idle swell (a splat has one behaviour); several now idle with
    a gentle morph instead. The animal cell's daughters are drawn a little small (so they stay in
    view), and its cutaway wedge ends up stretched over the right-hand daughter.
  - Some effects that send pieces past the resting shape leave them out of the fit
    (`k.fitMorphs = false`): the white cell's cup, the pollen puff, the ATP sparks and the amoeba's
    pods reach towards the edge of the view.
  - The snowflake holds three flakes (one shown at a time), so each has a third of the splats; the
    glint behaviour on its arms was replaced by the growth front (the centre still glints).
  - The paramecium's loop is small, so it reads partly as a spin in place.
  - The gyroid and the stretched torus knot still show a few specks of the far side at the extremes
    of their morphs; the brain's sparks are thin at phone size; the kidney's ureter drops are mostly
    behind the kidney from the default view; the Möbius ant's copy (in front of or behind the band)
    is chosen for the default camera.
- New in E2:
  - The owner has not yet seen the E2 effects; the clips on the Effect review page are the check.
    They were checked by me as clips and strips in headless Chromium (SwiftShader), not on a phone.
  - Earth's clouds are painted on the globe now (a layer over a turning globe draws in the wrong
    order), so they turn with the ground instead of drifting over it.
  - Venus and Neptune turn in latitude bands: during the effect the cloud pattern shears where bands
    meet (a seam line), then locks together again.
  - The turning planets carry hidden, sparser copies (Venus, Jupiter and Neptune one for the half
    turn; Earth and Mercury three, a quarter turn apart), so their resting detail is a little lower
    (Earth's most), and Slice shows them hollow while they turn. Earth's globe looks a little softer
    than at rest for the first three quarters of its turn.
  - Running glows (emerald, diamond, opal, the aurora's folds) move at a fixed speed, so where the
    light starts depends on when you tap.
  - Solar system: the planets swell while lined up (not to scale), Mercury's transit is still a
    small dot, and Saturn keeps its fixed lighting. The tip changes the view only during the effect.
  - Effects that face the viewer (the pulsar's flashes, the Moon's phases, Earth's night, the Mars
    dust front, the sapphire's star) are set for the default camera; after orbiting the view they no
    longer line up.
  - Saturn's spokes and Uranus's arcs repeat every eighth of a turn, so they look regular.
  - The galaxy's arms now turn as one pattern; before, they slowly wound up over minutes.
  - The part `cull` flag is new shader code in both GLSL and WGSL. The WebGPU smoke test (a kit toy
    with parts) passes, so the WGSL compiles, but the cull itself was only watched on WebGL2. Worth
    a look at Jupiter's Winds on a WebGPU browser (Chrome on a laptop).
  - The cat statue's head-turn smoke test failed in two full runs (the head not quite back 3 s of
    wall time after the tap; alone it passed). Like the stretchy-toy test before it, it now waits on
    the toy's own clock (2.6 s of look, stepped a clamped amount per frame), and the full run
    passes.
- New in E1c:
  - The owner approved the E1c effects (2026-09-25).
  - The elephant's trunk is kit-built: a little smoother than the carving round it. A small kit
    patch covers the forehead where the scan's trunk tip rested; at very close zoom a few specks of
    the scan's torn edge show beside it.
  - The horse moves only as a whole (no leg motion): a scan's legs cannot move without tearing.
  - The cat's tail no longer swishes (it lies on unscanned ground), and its collar is a little loose
    at the sides, widened so it still hides the cut when the head turns.
  - A loaded chess game is not saved in share links or scene JSON (a link opens the Opera Game).
    Only the first game of a multi-game file plays; Chess960 is refused. Past five extra queens (or
    one extra rook, bishop or knight) per side a captured piece of that kind comes back from the
    tray, and with none there the pawn stays a pawn. Long games take a while (Move speed goes up to
    2.5×).
  - A second tap on Newton's cradle mid-swing starts again from the lift (the ball jumps back).
    Dragging a ball is still Phase F.
  - The 48-token WGSL path was written but not run (no WebGPU adapter in the sandbox).
- New in E1b:
  - The owner has not yet seen the E1b effects; the clips on the Effect review page are the check.
  - Hard cuts can leave a thin gap where a part turns away from the rest (the cat's neck is hidden
    by its collar; the bust's neck and the horse's knees are not).
  - The laptop's screen text uses the browser's sans-serif font, so it looks a little different on
    each device. Typing only works while the laptop is on screen and open.
  - Keys the laptop does not have (such as Tab) still reach the app's shortcuts.
  - The chess game always plays from the start; there is no pause or step. Tap-to-move is still
    Phase F work.
  - Part 3 holds both the chess set and the laptop (they share engine changes).
- New in E1:
  - No person has seen or heard the E1 effects yet; they were checked with filmstrips
    (`tools/effect-strip.mjs`) in headless Chromium, at 220 px.
  - Scans are surfaces, so cut and split toys show add-on faces over the hollow inside; from some
    angles the edge of a cut still shows the empty shell (croissant, pomegranate, cake).
  - The grape's peeled strips curl out as flat flaps; the star cookie's crumbs are soft blurs rather
    than crisp pieces (moving splats of a scan keep their size).
  - The fly's leg rub, the ukulele's string shimmer and the boombox's tape reels are small and read
    in motion more than in stills.
  - The carrot cake's slice always comes out on the side facing the home camera.
  - The lantern and alarm clock keep rendering while lit or ticking (like kit toys that move by
    themselves).
  - Add-ons were tested in WebGL2 only; the WGSL rig effects were written but not run (no WebGPU
    adapter in the sandbox).
- New in D:
  - No person has listened to the sounds yet. They were checked by level, length and spectrogram
    only; the owner's review on the sound board may change many of them.
  - Sounds for toys that only hop were designed for their planned effect (TOY-PLAN.md), so their
    timing will need matching when E1–E6 build those effects.
  - Rigs and grab were tested in WebGL2 only; the WGSL versions compile paths were not run (no
    WebGPU adapter in the sandbox).
  - On the gummy bear a one-finger drag on the bear stretches it instead of turning the view, and a
    double tap on the bear does not reset the camera (a double tap beside it does).
  - A rig part turns rigidly inside its region and bends at the soft edge, so a large turn smears
    the neck a little. The cat's regions were placed by eye with `?rig=show`.

## Phases

Each phase is one session and one PR, or a small stack of PRs. The owner reviewed every toy on
2026-09-23 (raw notes and screenshots in [reviews/2026-09-23/](reviews/2026-09-23/review.md)). The
per-toy plan that came out of it is [TOY-PLAN.md](TOY-PLAN.md), generated from `tools/toy-plan.json`
by `node tools/toy-plan.mjs`. Keep that JSON current: when a phase finishes a toy, update its entry
(for example `"v": "keep"`) and regenerate.

**On 2026-09-24 the owner approved every proposal in the plan as written**, including the
sports-ball texture fixes added that day, and all toys are marked approved on the page below. Build
them as proposed; use judgement on details.

The owner can still mark a proposal Approve, Change or Skip (with notes) on a private page:
https://claude.ai/artifact/PNGPx7REMdhxLMHDXARhw8 ("Splashery Toy Plan"). Before starting a phase,
check the marks for its toys for any later change: with the `ArtifactData` tool, `list` the
collection `marks` (one document per toy id: `{mark: "yes" | "change" | "skip" | "", note, at}`). If
that tool is not available, ask the owner to press "Copy my marks and notes" on the page and paste
the text. A "change" note overrides the proposal in `tools/toy-plan.json`; update the JSON to match.
If the plan JSON changes, the page can be republished from it (`node tools/toy-plan.mjs --json`).

| Phase  | What                                                                                                                                                        | Repo(s)   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| A      | Done: sharpness, Detail setting, embeds, honeybee, thumbnail retry, homepage embed.                                                                         | both      |
| B      | Done: mobile shelf grid (drag up into a full grid like desktop), thumbnail labels that don't cut off, and a "Find your own splat" help panel.               | splashery |
| C1     | Done: visual fixes from the review (26 toys: vintage camera, boombox, storybook, comet, Statue of Liberty crown, horse, cookie, sports-ball textures, …).   | splashery |
| C2     | Done: clearer or more dramatic effects for 33 toys the owner found subtle (bacteriophage, Big Ben, bus, octopus, fireworks, …).                             | splashery |
| D      | Done: a voice library and a sound per toy, scan rigs, taps that know where they landed, drag-to-stretch, sound check and audit tools.                       | splashery |
| E1     | Done: new tap effects for the scans and shapes (33 toys), with colour keys, whole-body effects and kit-built add-ons for rigs.                              | splashery |
| E1b    | Done: fixes from the owner's E1 review (19 toys, a chess game, a laptop you can type on), effect quality rules, effect clips.                               | splashery |
| E1c    | Done: fixes from the owner's E1b review (a phone panel bug, chess from PGN files, elephant, horse, cat, hockey puck, Newton's cradle, xylophone, tomatoes). | splashery |
| E2     | Done: new tap effects for space, atoms and gems (32 toys), idle motion for the Sun, rings, aurora and galaxy, the draw-order lessons.                       | splashery |
| E3     | Done: new tap effects for tiny things, anatomy and maths (26 toys), and channel kinds (morph, band, fade, skin) for soft shapes and light fronts.           | splashery |
| **E4** | New tap effects for nature and weather (28 toys); the fourth of six waves (see TOY-PLAN.md).                                                                | splashery |
| E5–E6  | New tap effects for food, then balls and the rest, each with its own sound (see TOY-PLAN.md).                                                               | splashery |
| F      | Touch and drag interaction: a solvable puzzle cube, a chess set that plays a real game, a stretchy gummy bear, a draggable Newton's cradle, bricks.         | splashery |
| G      | AI image-to-3D trial with `HF_TOKEN`.                                                                                                                       | splashery |
| H      | Later: the gallery, multi-toy scenes, a liquid pour, the draw-order fix, more scans, more instruments, and the final homepage embed(s).                     | both      |

What the owner asked for across the board (2026-09-23):

- **Every toy gets its own tap effect and its own sound.** Sounds can be similar within a category
  but should differ slightly. Toys with a twin (the two rubber ducks, the two croissants, the two
  alarm clocks, the cactus and the saguaro, the grape and the grapes) must act and sound different.
- Where the effect is already good, keep it (65 toys are marked keep in TOY-PLAN.md).
- Some effects should depend on where you touch or drag (puzzle cube, gummy bear, chess, Newton's
  cradle). Say so if something is not feasible; a good fallback is fine.
- Sharpness after A1 is "basically perfect"; the homepage embed works in light and dark mode.
- Later the homepage embed will change to a favourite maths toy (the Menger sponge or the hypercube;
  the voice transcript is ambiguous, ask) at the highest detail, maybe several embeds. That needs an
  owner-set embed option such as `?detail=high` (Detail is deliberately not in share links; an embed
  the site owner chooses is a different case). See BACKLOG.md.
- Stay respectful: nothing destructive or disrespectful on the White House or the Washington
  Monument, and no fighting or gore (the Colosseum gets a chariot race, not gladiators).

## Phase E4 in detail: nature and weather

Before starting, check that PR #32 (E3) is merged, check the owner's marks (see above) for any later
change, and read the owner's verdicts on the Effect review page (the `verdicts` collection, one doc
per clip: `e3-<toy id>`) for E3 fixes to do first. Follow the Effect quality rules in CLAUDE.md, the
draw-order lessons and the channel kinds in docs/PACKS.md (6 and 7b), and publish clips of every new
effect on the Effect review page.

1. **Toys (28).** Oak tree, pine tree, palm tree, maple tree, bonsai, weeping willow, sunflower,
   rose, tulips, daisies, lotus, toadstool, fern, saguaro cactus, coral reef, pinecone, acorns,
   succulent, bamboo, pebbles, kelp, lava lamp, ice swan, tornado, rainbow, iceberg, waterfall,
   ocean wave. Build each planned effect (TOY-PLAN.md, wave E4) as `controls`, `action` and
   `drive()` in its recipe. Plants that open, close, sway or droop are natural morphs; leaves,
   petals, acorns and pebbles that fall or scatter are tokens or parts (separate things move
   separately); light and water fronts are `band` and `fade`.
2. **Twins.** The saguaro must act and sound different from the cactus scan; the pine tree shakes
   off a dusting of snow (a settled decision).
3. **Sounds.** Re-time each toy's sound to its new effect with `tools/sound-check.mjs` (under five
   seconds; `out.cues` for later sounds), and rebuild the sound board page if any change.
4. Check each effect with `tools/effect-clip.mjs --strip=8`, look at a larger still of its fullest
   moment (`tools/effect-strip.mjs --size=400 --times=…`), re-render thumbnails only where the
   resting look changes, mark each finished toy `"v": "keep"` with an `improved` entry and
   regenerate TOY-PLAN.md.

**Done when:** every E4 toy has its own tap effect (or the PR lists which do not, and why), all
tests pass and prettier is clean.

## Phases C–H (outline)

- **C1, visual fixes.** Done (see Current state).
- **C2, clearer effects.** Done (see Current state). `tools/effect-strip.mjs` is the tool for
  checking any new tap effect by eye.
- **D, effects and sound engine.** Done (see Current state).
- **E1–E6, new effects.** E1, E2 and E3 are done. One wave per session (about 30–45 toys each),
  following TOY-PLAN.md. Run `check-packs`, a contact sheet and `make-thumbs` for touched packs as
  usual. Thumbnails take about 18 s per toy under SwiftShader; render only the toys you changed.
- **F, touch and drag interaction.** Puzzle cube: 26 cubies as parts (the part limit is 48), cube
  state in JavaScript, swipe on a face to turn a layer, plus scramble and a solved check. Chess set:
  it is a scan, so either region parts per square or a kit-built set; first a scripted famous
  public-domain game, then maybe tap-to-move. Gummy bear: drag to stretch. Newton's cradle: drag a
  ball back and let go. Bricks: build a random model each tap.
- **G, AI image-to-3D.**
  - Check `HF_TOKEN` (whoami, printing only name and role).
  - Try a public Space through its API from a tool script in `tools/`. TRELLIS outputs Gaussians
    directly; Hunyuan3D is an alternative.
  - Inputs are our own CC0 images, such as renders. Check the model and output licences.
  - Set a quality bar against the procedural toys, and only ship results that beat them.
  - The free GPU quota is limited. If anything would cost money, stop and ask the owner.
- **H, later.** The gallery (plan in ROADMAP), multi-toy scenes, a scripted liquid pour, the
  draw-order fix for moving parts, more scans, more instruments (piano, trumpet, violin, maracas,
  harp), and the final homepage embed(s) in ryanjosephkamp.github.io.

## Decisions

Settled on 2026-09-24, when the owner approved every recommendation:

- Sounds: synthesize by default; CC0 audio samples are fine for the few that synthesis does badly (a
  real quack, an alarm bell, a crowd). Record each sample in CREDITS.md.
- Pine tree: it shakes off a dusting of snow (the decorated tree keeps the lights).
- An owner-set `?detail=high` embed option for the homepage is approved for Phase H, capped by
  device tier.

Still open (ask when it comes up, in Phase H):

- The favourite maths toy for the homepage: Menger sponge or hypercube? One embed or several?
