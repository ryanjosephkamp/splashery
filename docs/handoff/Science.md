# Lane Science: real science data as splats (prefix `sci`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Science, "Real science data as splats" (prefix `sci`). Branch:
claude/lane-science. PR title: "Phase Science: real science data as splats". Handoff file:
docs/handoff/Science.md.

## Brief (written by the Operator on September 29, 2026, from the owner's question and answer that day)

The owner asked, word for word: "can we actually enable realistic scientific simulations using
splats, potentially offering scientists a useful tool that does something valuable that's hard to
achieve without splats?" The Operator's research page
(https://claude.ai/artifact/V3rJhrgPuntHLPTUR16tev, section 3) answered honestly: splats won't
replace validated simulators, and the Gaussian research that compresses big simulations (Volume
Encoding Gaussians, ParticleGS) needs GPU training. But some science data already are Gaussians, so
they become splats exactly, with no training and no GPU: each splat is the published measurement,
and its shape shows the measurement's uncertainty. Existing desktop tools (ORTEP and Mercury for
ellipsoids, ThunderSTORM and napari for microscopy, SPLASH and yt for SPH) already draw these; what
Splashery adds is access (any phone, no install, a shared link, millions of points) and uncertainty
drawn as a soft shape. The owner's answer: "Science yes."

Build three labs toys on a new "Science" shelf behind the labs switch, in this order, posting each
toy's cards as soon as it is done:

1. **Thermal ellipsoids.** Open a small-molecule CIF (`_cell_*`, `_atom_site_*`,
   `_atom_site_aniso_U_11` … `_U_23`, and `_atom_site_U_iso_or_equiv` for isotropic atoms) or an
   mmCIF/PDB file with anisotropic records (`_atom_site_anisotrop` or `ANISOU`). Each atom becomes
   one Gaussian whose covariance is its displacement tensor U in Cartesian axes. A CIF's U is given
   against the reciprocal cell, so convert it: U_cart = A·N·U·Nᵀ·Aᵀ, with A the orthogonalization
   matrix and N = diag(a*, b*, c\*); an mmCIF/PDB U is already Cartesian (ANISOU is in units of 10⁻⁴
   Å²). Color by element. Options: the probability level (50% is the crystallographers' default:
   scale by 1.5382σ; also 30% and 90%), bonds on or off, and a "Jiggle" tap that samples each atom's
   displacement from its own Gaussian every frame, so you see how atoms actually vibrate. Samples:
   one small-molecule structure from the Crystallography Open Database (CC0) and one small,
   high-resolution protein entry with ANISOU from the PDB (CC0). Check each license on the live page
   and credit the depositors. Reuse the parsing in `src/chem/` by importing it; put the new code in
   your own files (`src/science/`). If `src/chem/` itself needs a change, keep it small and
   additive, mark it, and tell me (lane Chemistry has finished, so `src/chem/` is frozen: only
   small, marked, additive changes).
2. **Super-resolution microscope.** Open a ThunderSTORM CSV (x, y and optionally z in nm, the
   localization uncertainty, intensity, frame) or a `.smlm` file (a zip with a JSON manifest and a
   binary table; `DecompressionStream("deflate-raw")` can inflate its entries). Each localization
   becomes a Gaussian whose width is its localization precision (wider in z for 3D data), colored by
   depth, or by frame as a choice. Zoom from the whole cell down to single molecules; budgets by
   tier. Sample: a subset (a few MB at most) of a ShareLoc.XYZ record on Zenodo that is CC BY 4.0 on
   its live record page (for example 10.5281/zenodo.5507427, microtubules and clathrin), credited to
   its authors. A subset of CC BY data is allowed; say in the credit that it is a subset.
3. **Galaxy in a box.** A build tool (`tools/sci-galaxy.mjs`, pinned devDependencies listed in
   LICENSES.md) cuts a gas subset from a FIRE-2 snapshot (CC BY 4.0 on FlatHUB, with the citation it
   asks for) into a small splat file: each particle a Gaussian of about half its smoothing length,
   colored by temperature. Its About text says it is approximate (the simulation's kernel isn't a
   Gaussian, and blending isn't a column-density integral). If the data are too big for the
   container's disk or too slow to fetch, cut this toy and say so in "What was cut"; don't
   substitute data under another license without asking me.

Every toy:

- Opens your own file from the Toy tab (the input panel; files stay on the device), shows its sample
  by default, and says plainly when a file has no data it can use (a CIF without anisotropic U:
  isotropic spheres, with a note).
- About text: what each splat means, where the sample comes from (with credit), the standard tools
  scientists use for this, and the limits (for looking and sharing, not for measurement).
- A sound, a how-to line, an entry in tools/toy-plan.json, a thumbnail, and credits.
- Effect quality rules apply: sharp at phone size, no speckle, solid-looking atoms when the
  probability level is high.

Performance: phones first. Measure how many splats each toy draws at 30 fps or better on the mid
tier and set budgets by tier. Nothing loads until a Science toy opens. Keep the "embed transfer ≤ 30
MB" test green; keep samples small.

No engine changes are expected. If you need one, put it in a small, additive "Engine: …" PR first
and tell me.

Cards (390×844, each labeled "built by Opus 5.5", in the lane record `Science` on the Effect review
page, which the Operator made):

- `sci-ellipsoids`: the small molecule at 50%, turning slowly.
- `sci-jiggle`: the Jiggle tap on the same molecule.
- `sci-protein`: the protein's ellipsoids, zooming in to a few residues.
- `sci-microscope`: the whole cell, then zooming to single molecules.
- `sci-galaxy`: the galaxy turning (if not cut).
- `sci-open`: opening a file of your own (a second CIF, say).

Tests in tests/sci.spec.mjs: the CIF reader and the U conversion (check one atom's Cartesian U
against a hand-worked value), ellipsoid axes equal the square roots of U's eigenvalues times the
probability scale, the CSV and .smlm readers, budgets per tier, nothing loads before a Science toy
opens, and screenshots at 390×844 and 1440×900.

## You own

`src/science/` (new), `src/packs/science.js` (new), `assets/toys/<your toys>/`, `tools/sci-*.mjs`,
`tests/sci.spec.mjs`, your `sci-*` screenshots, docs/handoff/Science.md, the "Science" shelf entry
in src/toys.js, your toys' entries in the shared lists, and small, marked, additive changes in
`src/chem/` if truly needed.

Lanes Worlds (hybrid), Fluids, Books r4, UI r2, Video 3D, Fix4 and the Integrators run at the same
time; leave their files alone. The laptop is locked.

HOW THIS LANE RUNS

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

- September 30, 2026: all three toys built on the new Science shelf (labs only), with their samples,
  sounds, how-to and About texts, plan entries, credits, thumbnails and tests. Cards
  `sci-ellipsoids`, `sci-jiggle`, `sci-protein`, `sci-open`, `sci-microscope` and `sci-galaxy` are
  on the Effect review page (lane record `Science`, three groups). Draft PR #132.

- September 30, 2026 (evening): the owner marked `sci-ellipsoids`, `sci-jiggle`, `sci-open` and
  `sci-protein` good, and asked for more sharpness on the microscope and the galaxy, whether there
  are more microscope images, the file format, and to see the inputs. Done: `sci-microscope-r2`,
  `sci-galaxy-r2`, a second microscope sample (a whole nucleus in 3D), a precision filter, and
  source cards (`sci-source-microscope`, `sci-source-nucleus`, `sci-source-galaxy`). Sounds redone
  to PACKS.md 7e (quiet, no clicks, whooshes, pads or notes). Main merged twice (Fluids, the sound
  review).

## Notes

- **Files.** `src/science/crystal.js` (CIF, mmCIF and PDB readers; the cell, U_cart = A·N·U·Nᵀ·Aᵀ,
  eigenvalues, the probability scale), `src/science/smlm.js` (zip entries inflated with
  `DecompressionStream("deflate-raw")`, .smlm tables, ThunderSTORM CSV), `src/science/field.js` (the
  toys' GPU program), `src/packs/science.js` (the three recipes), `tools/sci-clip.mjs` (the cards,
  labs on), `tools/sci-samples.mjs` (the microscope's sample), `tools/sci-galaxy.mjs` (the galaxy's
  sample), `tests/sci.spec.mjs`.
- **No engine change.** The toys use the labs GPU-field hook (`gpuField`, lane Lab). Their program
  replaces the kit's for these toys, so each splat's four splatAnim values are its own: an atom's
  principal frame (a quaternion in bytes), its three σ and a seed, so every splat of an atom jiggles
  by the same `R·diag(σ)·z(t)` (z: three cosines per axis, unit variance); a localization's true
  size; a gas particle's temperature. Uniforms come through `out.morph` (jiggle, magnification, a
  size floor, a near clip), `out.glow` (the magnifier's focus) and `out.grow` (the hot-gas peel).
  Without labs the toys still draw (the kit ignores the unknown kinds), only without the jiggle, the
  zoom and the true localization sizes; the thumbnails are drawn that way.
- **One marked change in `src/chem/`**: `eachCifToken` in `src/chem/protein.js` is now exported (one
  word and a comment). `readCif` there groups tags by the dotted mmCIF style only, so small-molecule
  CIF tags (`_cell_length_a`) need a reader by full tag names (`readCifBlocks`).
- **Zoom.** The camera can't come nearer than 1.25 toy radii and can't pan, so the zoom is a
  magnifier inside the toy (everything scales about a focus point, which moves to the middle); a
  scaling keeps the depth order, so the CPU sort stays right. Zoomed in, a clipping slab fades
  whatever is in front of the focus.
- **Choices.** Hydrogens that ride on their atoms are drawn as small spheres by default (as ORTEP
  plots do; "As refined" shows their refined Uiso). Each structure is turned to face the camera (its
  flattest direction toward you). The aspirin sample is form II (the CIF's block is
  "aspirin-form2"). Crambin's PDB file has 6 atoms whose U is not positive definite (real, in the
  deposit); the toy says so.
- **Galaxy.** m11i (a dwarf, 0.9 GB) read as an irregular blob, so the sample is m12i (Milky
  Way–mass, four files, 7.2 GB, read one at a time): 300,000 of the 2.37 million gas particles in a
  40 × 12 × 40 kpc box, each drawn wider by the cube root of the thinning; the gas is cut round
  inside the box. Temperatures use a hydrogen fraction of 0.76 (jsfive can't hold the 11-column
  metallicity array of a 14-million-particle file).
- **Budgets and speed.** Microscope density 1.4 (84k, 196k, 280k, 392k localizations by tier; the
  sample's 170,401 all show from mid up), galaxy density 1 (60k to 280k; its big see-through splats
  overlap), ellipsoids the kit's count (atoms are few). Frame times in the container's SwiftShader
  at 390×844, device pixel ratio 2, mid tier (a CPU renderer, so only the ratios mean anything):
  ellipsoids 219 ms, microscope 528 ms, galaxy 807 ms, Lab's splat field 341 ms for comparison.
  Real-phone frame rates are not measured.

- **Sharper microscope (r2).** Measured at 390×844 CSS, device pixel ratio 2, with a Tenengrad score
  (mean squared gradient; `.cache/sci/sharp.mjs`, not committed): overview 2797 → 2965, zoomed on
  the clathrin pit 10.0 → 22.8. What did it: each localization carries the same total light
  (ThunderSTORM's normalized Gaussians: opacity ∝ (median σ / σ)²), a slice about the tapped depth
  when zoomed (the clip value's sign asks for both sides), the most crowded depth near the tap, a
  Precision filter (better than 5 or 3 nm), and clips rendered at 2× (the old 390-pixel GIFs were
  enlarged on the phone). A smaller minimum splat size changed nothing measurable.
- **Sharper galaxy (r2).** Overview 100 → 226. The file now keeps all of the dense gas (the 195,000
  smallest smoothing lengths in the box, drawn at their own size) and a random 4.8% of the diffuse
  gas (drawn 2.75 times wider); before, every particle was thinned 1 in 8 and drawn 2 times wider.
  Keeping the thinned gas's column (opacity × widening) brought back a haze over the disk, so it
  stays faint. Lower tiers keep 65% dense and 35% diffuse and thin each evenly.
- **Microscope samples and formats.** Two samples (microtubules and clathrin; a whole nucleus in
  3D), both CC BY 4.0 from ShareLoc.XYZ, cut by `tools/sci-samples.mjs`; people can open their own
  .smlm (ShareLoc's zip of a JSON manifest and binary tables) or a ThunderSTORM CSV, read on the
  device. The reader also takes Cramér–Rao bounds (crlbX, crlbY, crlbZ) as the precision. A
  nuclear-pore record (gp210) was tried and dropped: it has no precision column, and the 20 nm
  default width smears each pore's ring.

## Known issues

- Frame rates on a real phone are unmeasured (no GPU here); the galaxy is the heaviest (overdraw).
- On WebGL2 the sort is the CPU's from the built places; the jiggle moves atoms by fractions of an
  ångström, so it doesn't show.
- The jiggle moves each atom independently (the data are per-atom Gaussians), so a hydrogen can move
  against its carbon.
- A tap that re-aims the zoomed-in ellipsoids goes through the pick pass; it lands where the
  magnified splats are drawn, and the recipe maps it back.

- The Effect review page's asset storage is full (1 GB). The galaxy r2 clip at 2× (14.7 MB) and the
  nucleus clip didn't fit, so they were posted at 1.5×.

## For the Operator

- **package.json**: `jsfive` 0.4.2 (public domain, based on BSD-3 pyfive; depends on `pako` 2.2.0,
  MIT AND Zlib) added as a pinned devDependency for `tools/sci-galaxy.mjs`, as the brief asked;
  listed in LICENSES.md. package.json and package-lock.json are yours to accept.
- **`src/chem/protein.js`**: one additive, marked change (`export` on `eachCifToken`).
- **A new category** `science` ("Science") in `CATEGORIES` in `src/toys.js`, after Lab.
- For PACKS.md: a lesson: `gpuField` can carry per-splat data for any purpose in the four splatAnim
  floats (kind numbers of 1000 and up are safe in the kit's program), and uniforms can ride on
  `out.morph`, `out.glow` and `out.grow` (`src/science/field.js` is an example).
- For PACKS.md: rebuilding a toy with new options resets the camera's home to the app's default
  distance, not the toy's own `camera.distance` (a clip tool that snaps to home sees it jump).
