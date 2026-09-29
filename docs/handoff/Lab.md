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

## r2

### Brief (the Operator's message of September 29, 2026, word for word)

From the Operator: a follow-up for this lane from the owner's review of September 29, 2026
(docs/reviews/2026-09-29-new-toys/review.md; Ops PR coming). Two small fixes, labs only, as "Lab
r2". Your model stays Opus 5.5.

His notes, word for word:

"For the Lab category: The galaxy toy doesn't seem to show it's effect when I click on it... The
"Send a pulse" button works, but clicking on the toy doesn't."

"For the "Splat equation"... These splats seem really, really grainy. Is that on purpose? If not, or
if it makes sense to also improve the sharpness, let's please improve the sharpness."

1. The Splat field (`splat-field`, src/packs/lab.js): a tap on the toy must send the same pulse as
   the Toy tab's "Send a pulse" button, for every field (galaxy, ocean, knot), at phone size and on
   the desktop. Find why the tap misses (my guess: the tap's hit test looks for the toy's splats
   where the CPU copy has them, not where the GPU program draws them, or a GPU field toy never
   registers as hit). Fix it in your pack if you can. If the fix belongs in the player's tap code,
   make it a small additive "Engine: …" PR on claude/lane-lab-r2-engine, merged first; the input
   path in src/player.js is engine code (WORKSTREAMS.md, "Frozen packs").
2. The Splat equation (`splat-equation`, src/packs/splat-equation.js; lane Manual built it, and it's
   yours for this fix). Answer his question in your handoff and in the card note: how much of the
   grain is on purpose (each dot is one splat you program, up to 10,000) and how much isn't. Then
   make it sharp by default. Every built-in program should read as a clean, solid surface at phone
   size: full opacity, splat sizes that overlap at the program's count, flat splats that lie along
   the surface where the equation gives a surface, and clean colors (Fidelity A's method, PACKS.md
   "Effect quality"). If seeing separate splats is worth keeping for learning, keep it as a "Dots"
   look beside a new default "Solid" look. Old links and typed programs must keep working, and a
   program that sets size = … keeps its size. Update the Manual's words only if they now say
   something untrue; the Tinkerer's Manual PDF stays as it is, and if it's out of date, say so for
   the Operator.

Restart your branch from main (git fetch origin main && git checkout -B claude/lane-lab-r2
origin/main), one draft PR "Phase Lab r2: the galaxy tap and a sharp Splat equation" with the five
sections, and add an "r2" part to docs/handoff/Lab.md with these notes word for word. Tests in
tests/lab.spec.mjs (your file; add to it): a canvas tap on the Splat field fires its pulse for each
field, and each Splat equation program builds with every splat at full opacity. Cards (390×844,
"built by Opus 5.5", lane record LabR2 on the Effect review page): lab-field-tap (a tap on each
field) and lab-equation-sharp (each program before and after, turning slowly). Full suite, prettier
and us-english before you push. Push about hourly and keep a check-in scheduled while long runs go.
End with READY:, WORKING: or BLOCKED:. When it's merged, stand down.

### State

Model: Opus 5.5 (claude-opus-5-5), default effort.

- **The galaxy tap: fixed.** A tap on the toy finds it with the engine's GPU picking, whose pick
  pass drops any splat fragment under 0.3 opacity. The galaxy draws its stars faint on purpose (0.3
  × an arm factor of 0.25 to 1), so no star was ever hit: 0 of 25 taps around the middle, at 390×844
  and 1440×900; the ocean got 25 of 25. The work buffer is shared by the pick and draw passes, so
  the pack can't make stars pickable without drawing them opaque (which turns the galaxy back into a
  solid disc). The engine PR adds `pickAlpha`: a recipe may lower `scene.gsplat.alphaClip` (used
  only by the pick, shadow and depth passes) while it shows; the next toy puts back 0.3. The splat
  field sets 0.04. Now 25 of 25 on the galaxy at both sizes. (The knot's misses are the empty space
  between its tubes, as for any toy.)
- **The Splat equation's grain: his question answered.** Only a little of it was on purpose. Each
  splat is one (u, v) you program (up to 10,000), and the spiral galaxy program scatters tiny splats
  at random on purpose, so it is a field of stars, not a surface. The rest was not: every splat was
  95% opaque, round-ish (flat 0.45) and 25% bigger or smaller at random (the kit's size jitter),
  drawn with the soft Gaussian. Big half-clear blobs of uneven size overlap into a soft, blotchy
  haze with ridges, which reads as grain at phone size.
- **Sharp by default.** A new "Splats" choice: **Solid** (default) and **Dots**.
  - Solid: every splat at full opacity and its exact size (a new `jitter: 0` for kit clouds, in the
    engine PR); a surface's splats lie flat along it (flat 0.12); a curve's are drawn out along it
    (the trefoil); the sharp kernel (`kernel: "sharp"`, which the owner marked good on this toy in
    round 1).
  - Dots: each programmed splat shows as its own round dot (a grid program's at 45% of its size),
    for seeing what a splat is.
  - Every program keeps its own count and size, so old links, typed programs and the Manual's
    gallery build the same program; a program that sets size = … keeps it.

- **The owner's marks (September 29, 2026), on both r2 cards, word for word:** "Looks basically
  perfect right now. If we can safely increase sharpness even further, then I'd like to see what
  that looks like. But if not, then the resolution seems fine as-is. For the ocean, I wonder if we
  can make this interactive (perhaps in the upcoming interactivity work that we already have
  planned, or now; I'm comfortable either way) such that clicking/tapping different parts of the
  liquid surface sends the ripples from those locations?"
  - **The ocean:** a tap now drops the stone where it lands (the tap's point, in field units, rides
    on the pulse's channels 1 and 2; all 0 again at rest); the button still drops it in the middle.
    Card `lab-field-tap-r2`.
  - **Sharper still:** a third Splats choice, **Fine**: the same shape from up to four times the
    splats (as far as the device's budget allows), each smaller in step. Smoother surfaces, the
    torus's and the seashell's faint ridges gone; the trefoil and the spiral galaxy stay as they
    are. Solid stays the default until he says otherwise. Card `lab-equation-sharp-r2` (Solid and
    Fine side by side).

### Notes

- Tests added: `tests/lab.spec.mjs` (a real canvas tap fires the pulse on every field at both sizes;
  every program at full opacity in both looks) and `tests/lab-engine.spec.mjs` (pickAlpha lowers and
  restores the clip; jitter 0 gives exact sizes and the default is unchanged).

### Known issues

- The trefoil (a curve, one splat per step along it) is much smoother but its tube still has a
  slightly soft edge: its thickness is the splat itself.
- The spiral galaxy program stays a field of dots in Solid too (it is scattered at random on
  purpose).

### For the Operator

- Merge the r2 engine PR first (pickAlpha and the cloud's jitter option; both change nothing for
  other toys).
- Lane Manual's screenshots `man-splat-equation-390x844.png` and `-1440x900.png` now show the old
  look (I left them as they are, per the rules); refresh them on main.
- The Tinkerer's Manual: its words are still true (size and count keep their meaning), but its
  pictures of the toy (the gallery and "the same sphere with more and more splats") show the old,
  softer look. The PDF is left as it is.
