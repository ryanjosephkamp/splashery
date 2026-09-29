# Handoff

Where Splashery stands, in short. The Operator session keeps this file; each lane keeps its own file
in [handoff/](handoff/). The ground rules are in [CLAUDE.md](../CLAUDE.md); how the parallel lanes
work is in [OPERATING.md](OPERATING.md).

## State of main (2026-09-29)

- Phases A to E4 are merged: A (splashery PR #13, homepage PR #33 in
  `ryanjosephkamp/ryanjosephkamp.github.io`), B (#17), C1 (#18), C2 (#19), D (#20), E1 (#21), E1b
  (#22–#24), E1c (#26–#28), E2 (#29–#31), E3 (#32) and E4 (#33, merged 2026-09-26). The owner
  approved everything from E3.
- The first parallel lanes all merged on 2026-09-26: E4-finish (#37), E6b (#36), E5 (#35) and E6a
  (#38). The owner approved every clip on the Effect review page, including the redone ones (the
  bananas, croissant and pretzel; the basketball's robot hand and the bowling ball). Summaries and
  known issues: [handoff/history.md](handoff/history.md), "Lanes".
- Lane F merged on 2026-09-27 (#45, then #42): the puzzle cube turns under your finger, the bricks
  build models, chess takes your moves while paused, and Newton's cradle balls can be dragged. The
  owner approved all four clips.
- Lane G merged on 2026-09-27 (#43): the real pencil and the real tin can, made from photos with a
  free image-to-3D model (TRELLIS on Hugging Face). They default to a yellow pencil and a "Peaches"
  label, and the owner approved both. Their Look choice followed (#47, an engine PR for looks on
  captured toys, then #48): seven pencil looks and four can looks, the bare scan included.
- Lane Math merged on 2026-09-28 (#50): a safe equation reader, the graph and surface plotters you
  can type into, circle and waves, Fourier circles (with words and a 3D view), the Pythagoras proof,
  and the snail and American football fixes. Lane Fix3 merged the same night (#54): the bananas
  without the loose crown and the ocean wave's smooth collapse. The owner approved every clip of
  both. Lane AI's drawing pad for a toy's input panel is merged too (#56, an engine PR).
- Lane AI merged on 2026-09-28 (#52): a new "AI and computing" shelf of twelve toys (perceptron,
  multilayer perceptron, neural network, CNN, RNN, transformer, looped transformer, diffusion model,
  gradient descent, word vectors, sorting machine, half adder), with 3D models, a network you size
  yourself, the classic encoder-decoder transformer, a CNN you draw on, real word vectors and eight
  sorting algorithms. The owner approved every clip after four rounds.
- Lane Help merged the same night (#57): when a toy opens, a short "how to play" line shows beside
  it and fades; a "?" button shows it again; "About this toy" heads the About tab. The texts live in
  `src/toy-help.js`; a toy without its own line would get one built from its recipe.
- The two help text lanes merged the same day (HelpTextA #60, HelpTextB #59): every one of the 303
  toys has its own how-to line and About text, and the owner approved them all on the Help Board.
  From now on every lane writes its own toys' help as part of "done".
- On September 28, 2026 the owner accepted a new step 3, **Pictures and pages** (ROADMAP.md): open a
  PDF, photos, a GIF or a video and see it made of splats, as a book, an album, a frame or a screen.
  The Operator's test on the real engine turned an article page into 172k splats that read at phone
  size when zoomed. The engine lane, Pictures, merged the same evening (#64): PDF pages, photos, GIF
  and video frames become splats (PDF.js and omggif vendored), pages stream through a few sheets
  with near and far detail, the Toy tab can open a file or a web address, and the Picture lab test
  toy sits behind the labs switch (`?labs=1`). The owner marked all eight clips good. Lane Manual
  merged next (#65): the splat equation toy (type where splats go, in u, v and t; labs only) and the
  public Tinkerer's Manual at `manual/`, with a 25-page PDF, linked from the About tab. Lane Screens
  merged on September 29 (#72, with engine PR #71): the Screen in four styles and the Gaussian
  splatting toy. Lane Viewer merged the same night (#75): whole PDF figures (the black boxes were a
  rounding bug, not censorship), pinch that only zooms, a tilt lock for flat toys, Reset view, Tilt
  lock and Turntable in the top bar, flag colors per toy, and the terms of use. The owner marked all
  five clips good. Later that morning three Universe lanes merged: Studio Sound (#80, with the
  Operator's engine PR #81), a new Studio shelf with the song landscape and the Chladni plate, built
  by Sonnet 5.5; Lab (#83, with engine PR #85), a sharper splat kernel as a labs option and splat
  fields on the GPU, built by Opus 5.5; and Learn (#84), the Tinkerer's Manual audited and brought
  up to date (34 pages now) and the lab notebook backfilled, built by Sonnet 5.5. The Operator's
  engine PR #87 lets a recipe take several files at once, for lane Studio Models. Lane Books is
  finishing (#73, with engine PR #74).
- The shelf has 303 toys (32 scans, 4 shapes and 267 kit toys), plus seven labs toys hidden unless
  `?labs=1` (the Picture lab, the splat equation, the Screen, Gaussian splatting, the song
  landscape, the Chladni plate and the splat field). The plan (`tools/toy-plan.json`,
  [TOY-PLAN.md](TOY-PLAN.md)): all 310 keep. Every planned new tap effect is built. Scene schema v3;
  v2 still loads.
- Every kit toy's tap is checked by `tests/taps.spec.mjs`; its known exceptions (with reasons) are
  listed at its top. The full suite has 356 tests.
- The governance from September 27 is merged (#53): the Operator runs the lanes, workers are Opus
  5.5 only, new public text is in American English (`tools/us-english.mjs`), and the sound review
  runs on the Sound Board. Splashery's own code is MIT licensed (#51, `LICENSE`); assets keep their
  own licenses and credits.
- On September 29, 2026 the owner accepted the Splashery Universe plan
  ([review](reviews/2026-09-29-universe/review.md), ROADMAP.md): five parts (Toys, Studio, Worlds,
  Lab, Learn), new parts behind the labs switch, up to 8 workers at once until the weekly reset
  (September 30, 4 p.m. ET), Opus 5.5 for the engine and toys and Sonnet 5.5 for Worlds content,
  Studio converters, docs and the Integrator, and the Operator merging by tiers (CLAUDE.md, "Pull
  requests"). Weapons: historical, fantasy and sci-fi only, never aimed at people or animals.
  Splashery doesn't police what people open; the terms of use say they're responsible.
- Locked (owner approved, do not change its look or behaviour): the laptop. Its smoke test guards
  it.

## Active lanes

The full table, with owned files, sessions, branches and PRs, is [WORKSTREAMS.md](WORKSTREAMS.md).

| Lane                                                    | Status                                                                                    | Handoff                                                                |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Operator                                                | Running; runs the lanes                                                                   | —                                                                      |
| Books: your book, the photo album and the picture frame | Running (started September 28, 2026)                                                      | [handoff/Books.md](handoff/Books.md)                                   |
| Worlds: the world engine and a sandbox island           | Running, Opus 5.5 (September 29, 2026)                                                    | [handoff/Worlds.md](handoff/Worlds.md)                                 |
| Fidelity A: the grainy-toy audit                        | Running, Opus 5.5 (September 29, 2026)                                                    | [handoff/FidelityA.md](handoff/FidelityA.md)                           |
| Studio Models: 3D model files to splats                 | Running, Sonnet 5.5 (September 29, 2026)                                                  | [handoff/StudioModels.md](handoff/StudioModels.md)                     |
| Fidelity B: the rest of the grainy toys                 | Running, Opus 5.5 (September 29, 2026)                                                    | [handoff/FidelityB.md](handoff/FidelityB.md)                           |
| A/B: the toy piano, makers A and B                      | Running, one on each model, hidden until the owner marks them (September 29, 2026)        | [handoff/AB-A.md](handoff/AB-A.md), [handoff/AB-B.md](handoff/AB-B.md) |
| Integrator: combined test runs                          | Running, Sonnet 5.5 (September 29, 2026)                                                  | —                                                                      |
| Next (WORKSTREAMS.md, Next)                             | Sound A and B (when the owner's notes arrive), the pilot game, the Forest trail template… | —                                                                      |

E4-finish, E5, E6a, E6b, F, G, Math, Fix3, AI, Help, HelpTextA, HelpTextB, Pictures, Manual and
Screens are done, and so are Viewer, Studio Sound, Learn and Lab (WORKSTREAMS.md, "Done"). On
September 27, 2026 the owner approved the plan in Part 1 of the How Splashery Is Made page: the
Operator runs the lanes, workers are Opus 5.5 only (at the default effort, a trial), new public text
is in American English, and the work goes in the order in ROADMAP.md, "Now". Lanes AI and Math
started that day, and the Sound Board has its review features, ready for the owner's sound notes.

The owner reviewed the AI and Math clips the same day
([reviews/2026-09-27-ai-math](reviews/2026-09-27-ai-math/review.md)): seven good, and extras for the
rest (3D versions beside the 2D "poster" ones, a second transformer diagram, MLPs, a CNN you draw
on, word vectors for any words, more sorting algorithms, your own settings and Fourier text). His
notes on the bananas' stem and the ocean wave's collapse went to lane Fix3. He also asked for toy
help (a how-to line when a toy opens and an About tab), step 2 of the plan. Math and Fix3 merged
after his later rounds; AI after its fourth, when its labels became readable and sharper and the
classic transformer's key moved off the toy into the Toy tab. The two help text lanes then wrote a
how-to line and an About text for every toy; the owner read them on the Help Board (a new page,
OPERATING.md, "Pages") and approved every one on September 28, 2026.

## Where things are

- [handoff/history.md](handoff/history.md): the phase notes from A to E4 and a summary of each
  finished lane, with every lesson, the known issues by phase, the phases table, the owner's asks
  and the settled decisions.
- [handoff/](handoff/)`<lane>.md`: each lane's brief, state, notes and known issues.
- [PACKS.md](PACKS.md): how to write a recipe; channels (section 6); draw order and effect quality
  (7b).
- [TOY-PLAN.md](TOY-PLAN.md): every toy's planned tap effect and sound, generated from
  `tools/toy-plan.json` by `node tools/toy-plan.mjs`.
- [reviews/](reviews/): the owner's reviews, word for word, with screenshots.
- [BACKLOG.md](BACKLOG.md), [ROADMAP.md](ROADMAP.md), [SCENE-SCHEMA.md](SCENE-SCHEMA.md),
  `CREDITS.md`, `LICENSES.md`, `README.md` (features and code layout).
- The private pages (Effect review, Sound Board, Help Board, Toy Plan, Toy Ideas, Parallel Plan,
  Operator Manual, How Splashery Is Made): links in OPERATING.md, "Pages".
- The Operator's daily routines (from 2026-09-27, Eastern time): three toy ideas on the Toy Ideas
  page at 7:43, then the owner's digest at 7:54.

## Lessons at a glance

Each has its full notes in handoff/history.md (the phase is in brackets) and, for most, in PACKS.md.

- Effect quality rules (E1b): CLAUDE.md and PACKS.md 7b. Judge effects as clips at phone size.
- Draw order (E2): splats sort in their built pose; build pieces where they are seen at their
  fullest; turning about the view keeps the order; spinning bodies are built twice.
- Hidden pieces count in the fit (E2); `fit: false` (E3 review) leaves a shape out of the fit.
- Channels and morphs (E3): one behaviour per splat; rounder or larger splats where a morph turns or
  stretches a surface.
- Loose pieces as tokens, and pieces built where they end (E4).
- Skinned sheets, twists of space, negative glow, spinning gloss, `cull` for one spinning body, and
  hidden pieces counting in the framing (the E lanes, 2026-09-26): PACKS.md 3, 6 and 7b.
- Tiny splats vanish on small screens: keep `size / sqrt(weight)` near 0.5 or more (E2).
- Scan rigs, kit parts for scans and add-ons (D, E1, E1b, E1c).
- A rare engine warning (2026-09-25; back once on 2026-09-26 in a phone test, just after a scan
  loaded, and once in a lane's full run as a SwiftShader warning in the cat statue smoke test), a
  flaky drag in the stretchy-toy smoke test, and the strawberry smoke test (once not settled 3 s
  after its tap, in two lanes' runs): keep `test-results/` if any comes back.

## Standing facts

- `HF_TOKEN` was checked on 2026-09-24 (whoami: account `ryanjosephkamp`, role `read`). If it is
  ever missing or rejected, tell the owner exactly what to change: the cloud environment menu in the
  session's title bar, then Edit, then an environment variable named `HF_TOKEN`.
- In the cloud sandbox, headless Chromium cannot reach github.io. To screenshot a host page that
  embeds the live site, route `https://ryanjosephkamp.github.io/splashery/**` to the local server
  (`context.route` plus `route.fetch`).

## What the owner asked for across the board (2026-09-23)

- Every toy gets its own tap effect and its own sound. Toys with a twin (the two rubber ducks, the
  two croissants, the two alarm clocks, the cactus and the saguaro, the grape and the grapes) must
  act and sound different.
- Some effects depend on where you touch or drag (lane F). Say so if something is not feasible; a
  good fallback is fine.
- Stay respectful: nothing destructive or disrespectful on the White House or the Washington
  Monument, and no fighting or gore (the Colosseum gets a chariot race, not gladiators).
- The full text is in handoff/history.md.

## Decisions

Settled on 2026-09-24, when the owner approved every recommendation:

- Sounds: synthesize by default; CC0 audio samples are fine for the few that synthesis does badly (a
  real quack, an alarm bell, a crowd). Record each sample in CREDITS.md.
- Pine tree: it shakes off a dusting of snow (the decorated tree keeps the lights).
- An owner-set `?detail=high` embed option for the homepage is approved for Phase H, capped by
  device tier.

Settled on 2026-09-26: the remaining work runs as parallel lanes with an Operator session
(OPERATING.md).

Settled on September 27, 2026 (the How Splashery Is Made page, Part 1):

- The Operator runs the lanes; the owner talks only to the Operator, reviews clips and merges.
- Workers are Opus 5.5 only, at the default effort as a trial; Extra High is one environment
  variable away (OPERATING.md).
- Three lanes at once by default, four when one is small.
- American English for new public-facing text, with one sweep before the blog post.
- Sounds are agreed on the Sound Board before they reach the site (OPERATING.md, "The sound
  review"); a toy the owner doesn't mention keeps its sound.
- Hands-on play for every toy: a Play button, a Hands-on switch and Reset, on a physics engine of
  our own (position-based dynamics), showcased first on four toys.
- The Toy Workshop (Remix, Build from parts, Code a toy, From a photo), a "Take it to your AI"
  package, and submissions through a GitHub issue form, with files optional.
- The code gets the MIT license; assets keep their own licenses and credits.
- The blog post comes last, after the Workshop, physics, hands-on play and submissions.
- The pencil defaults to yellow, the tin can to an original "Peaches" label, and both have a Look
  choice.

Settled on September 28, 2026 (the Pages into Splats report,
[review](reviews/2026-09-28-pictures/review.md)):

- Pictures and pages is step 3, before pianos and the physics work. The sound lanes start whenever
  the owner sends his sound notes, in parallel; the new toys' sounds join the later new-toys round.
- The engine lane comes first. The new toys stay behind a hidden switch (`?labs=1`) until the owner
  has tried them on his phone.
- PDF.js (Apache 2.0) and omggif (MIT) may be vendored, loaded only when someone opens a PDF or a
  GIF.
- The new shelf is "Pictures and pages": Your book, Photo album, Picture frame and Screen (old TV,
  flat TV, cinema, hologram, with sound). Also the Gaussian splat toy (AI and computing), and the
  splat equation toy with a public Tinkerer's Manual that is also the book's default PDF.
- Samples only under CC0, CC BY or public domain, with credits; no logos or insignia. The laptop
  stays as it is. The fitted method comes later, as an upgrade.

Still open (ask when it comes up, in Phase H):

- The favourite maths toy for the homepage: Menger sponge or hypercube? One embed or several?
