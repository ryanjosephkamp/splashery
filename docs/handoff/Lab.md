# Lane Lab: sharper kernels and splat fields

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Lab, "Sharper kernels and splat fields" (prefix `lab`). Branch:
claude/lane-lab (and claude/lane-lab-engine for its engine PR). PR titles: "Engine: Lab, sharper
splat kernels (off by default)" and, if you get to it, "Phase Lab: splat fields on the GPU". Handoff
file: docs/handoff/Lab.md.

## Brief (written by the Operator on September 29, 2026, from the owner's note "big new Splashery ideas" and his answers on the Splashery Universe page the same night)

The owner's words: "What if we found something that's, like, totally unique that nobody's ever done
that's actually valuable … Could we use a different kernel for some parts of this? Could we use
splats that are not Gaussian? … could we use 4D Gaussians?" And: "I almost want to make things so
incredible with this that people won't even realize that they're looking at Gaussian splats." His
answer: "The Lab? One Opus lane: a short literature check, then the sharper-kernel test on pages and
grainy toys, then splat fields on the GPU. Keep only what beats today's clips."

Work in this order, and stop a step early rather than ship something that doesn't clearly win.

1. **A short literature check** (about an hour): kernels other than the Gaussian for splatting (for
   example compact or higher-order kernels, "sharper" falloffs, generalized exponential or Student-t
   splats, beta kernels, 2D surfels), anti-aliasing for splats (Mip-Splatting and similar), and 4D
   or time-varying Gaussians. For each: what it changes in the renderer, what it costs, and whether
   it fits our engine (PlayCanvas 2.22.3's unified gsplat renderer, vendored, with our work-buffer
   modifiers in src/stage.js) and our kit-built toys (splats we place ourselves, not trained). Write
   it as docs/lab/LITERATURE.md with links to the papers (read their abstracts on arXiv or the
   project pages; cite, don't copy).
2. **Sharper kernels, measured.** Build the best one or two candidates as an option that is off by
   default: a per-recipe flag (for example `kernel: "sharp"`) and a URL switch for testing (for
   example `?kernel=sharp`), both behind the labs switch. Don't change how any toy looks by default.
   - Test on what the owner called grainy or blurry: PDF pages in the Picture lab (text and figures
     at phone size) and the grainy toys on lane Fidelity A's audit list (docs/handoff/FidelityA.md,
     "## Audit"; the desk lamp, the American football and the hockey puck first). Fidelity A may
     also list kernel requests under "For the Operator".
   - For each, make a before-and-after pair at 390×844 (stills, and a clip where motion matters) and
     measure: sharpness (edge width in pixels on a text line or a seam), speckle, frame time (as
     relative numbers in our software renderer; say plainly that the owner's phone is the real
     test), and splat counts.
   - Keep only what clearly beats today's clips. Put the kernel in a small, additive engine PR
     ("Engine: Lab, sharper splat kernels (off by default)", with tests in
     tests/lab-engine.spec.mjs) that merges first. Turning it on for a public toy is a later step
     for the owner to approve from your cards.
3. **Splat fields on the GPU**, if time allows: splats whose positions and colors come from a field
   computed on the GPU every frame (for example the splat equation toy's u, v, t programs, or a flow
   field), so a toy can move hundreds of thousands of splats smoothly. Prototype it behind labs as
   one test toy on a new "Lab" shelf (category id `lab`, label "Lab", after "Studio"), measure it,
   and write up what it would take to use it in Worlds and the Studio.

Engine files are shared: lane Worlds may make small additive changes in src/kit.js, src/stage.js and
src/pc.js at the same time, and lane Studio Sound's engine PR #81 touches src/motion.js and
src/ui.js. Keep your changes small, additive and off by default, and merge main into your branches
often.

Clips and cards (390×844), ids `lab-<topic>` (for example `lab-kernel-pdf`, `lab-kernel-lamp`,
`lab-field`): each a before-and-after pair with the numbers in the card's note. Everything stays
behind labs, so the Operator merges once the full suite passes; the owner decides from the cards
whether any kernel goes onto public toys.

## You own

- docs/lab/ (new), the kernel code in the engine PR (the gsplat shader hooks in src/stage.js or a
  new src/kernels.js, with the flag read in src/player.js or src/kit.js), src/packs/lab.js (new) and
  its toys' entries in the shared lists, the Lab category in src/toys.js, tests/lab.spec.mjs and
  tests/lab-engine.spec.mjs, your `lab-*` screenshots and docs/handoff/Lab.md.

Lanes Books, Worlds, Fidelity A, Studio Sound, Learn and the Integrator run at the same time; leave
their files alone. The laptop is locked.

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

- September 29, 2026: lane started. Draft PR #83 (this lane) and the engine PR #85 (branch
  `claude/lane-lab-engine`, "Engine: Lab, sharper splat kernels (off by default)") opened.
- Step 1 done: [docs/lab/LITERATURE.md](../lab/LITERATURE.md), the literature check (other kernels,
  anti-aliasing, 4D splats; what each changes in our engine and whether it fits).
- Step 2 done: [docs/lab/KERNELS.md](../lab/KERNELS.md). Three sharper kernels built in the engine's
  fragment hook and measured on the PDF page, the desk lamp, the American football, the hockey puck
  and the splat equation toy. Only `sharp` (a generalized exponential, exp(−14.7·A²)) is kept, as a
  labs option (`?kernel=sharp` or a recipe's `kernel: "sharp"`), off by default. It gives no clear
  win on pages and grainy toys (their splats are a pixel or two on screen; their grain is in the
  colors) and a real one on big, smooth splats (the splat equation torus: edges 3.70 → 2.70 px). The
  disc and the steeper A³ kernel were dropped (they show each splat as a coin or a scale).
- Step 3 done: [docs/lab/FIELDS.md](../lab/FIELDS.md). The "Splat field" test toy on a new labs-only
  Lab shelf: about 297,000 splats placed and colored by a GPU program every frame (a galaxy, an
  ocean, a knot), through a small engine hook (`gpuField`, labs only), measured.
- Cards: `lab-kernel-equation`, `lab-kernel-pdf`, `lab-kernel-puck`, `lab-field-galaxy`,
  `lab-field-ocean`, `lab-field-knot`.

## Notes

- The kernel lives in PlayCanvas's `gsplatModifyPS` chunk (`modifySplatColor(uv, color)`, called
  after the Gaussian falloff), set on `scene.gsplat.material`; the engine copies it into its unified
  material. No vendored code changes. It applies to the whole scene, so the player sets it per toy,
  and never touches the chunk while every toy is Gaussian.
- A sharper kernel blends back to the Gaussian below about 3 pixels of half-width (`fwidth`), or it
  aliases. That is also why it can't sharpen what is already a pixel wide: PDF text at phone size.
- The field hook replaces a kit toy's work-buffer program; that pass already runs for every splat
  every frame, so a field costs no extra pass. On WebGL2 the CPU sort uses the stored t = 0 places
  (see FIELDS.md, "Sorting").
- Measuring tools: `tools/lab-kernels.mjs` (edge width, speckle, shimmer, frame time per kernel),
  `tools/lab-fields.mjs` (field frame time against the frozen toy and the CPU cost) and
  `tools/lab-clip.mjs` (before-and-after clips at 390×844, clock stepped by hand).

## Known issues

- Frame times come from Chromium's software renderer and are relative only; the owner's phone is the
  real test.
- Changing the Field option rebuilds the toy and resets the view to the app's default distance, not
  the toy's own (true of every toy with options).
- On WebGL2 a field's splats are sorted from their t = 0 places; fine for these three fields at
  phone size, not for a field whose splats cross in depth.

## For the Operator

- Merge order: the engine PR first (the kernel and the `gpuField` hook), then this lane's PR.
- `src/toys.js`: the Lab category sits right after "pictures"; lane Studio Sound adds "studio" at
  the same place, so a merge of both keeps both lines (Studio first, then Lab, as the brief says).
- For PACKS.md: a recipe can bring its own GPU program with `gpuField(options, fit)` (labs only),
  returning `{ glsl, wgsl }` work-buffer hooks; `src/packs/lab.js` is the example.
- For the backlog: the splat equation toy's typed programs could compile to a GPU field (FIELDS.md,
  "Typed programs"), which needs `src/equation.js` to hand back its parse tree.
