# Handoff

Where Splashery stands, in short. The Operator session keeps this file; each lane keeps its own file
in [handoff/](handoff/). The ground rules are in [CLAUDE.md](../CLAUDE.md); how the parallel lanes
work is in [OPERATING.md](OPERATING.md).

## State of main (2026-10-02)

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
  engine PR #87 lets a recipe take several files at once, for lane Studio Models, which merged next
  (#86), built by Sonnet 5.5: open a glTF, OBJ or STL model and see it rebuilt as splats, and
  `tools/model-to-splats.mjs` for making toys from CC0 models. Lane Books merged at midday (#73,
  with engine PR #74), built by Opus 5.5: your book (any PDF, five styles, pages that turn and curl
  like paper), the photo album and the picture frame. That afternoon Fidelity A (#77, the grainy-toy
  audit and 24 toys made sharp) and Fidelity B (#90, the other 73 toys on its list) merged, built by
  Opus 5.5, after the owner marked every before-and-after card good. In the evening the world engine
  merged (#78, built by Opus 5.5): Splashery Worlds at `worlds/?labs=1`, a small world made of
  splats that you walk around as a character, with the Test island as its sandbox (docs/WORLDS.md).
  Then the anatomy atlas (#92, with engine PR #93 for a labels list beside the stage), built by Opus
  5.5: a clinical figure you peel layer by layer, kit-built because no layered CC0 or CC BY body
  model exists. The owner marked its three cards good. Then the toy piano (#91), the winner of the
  owner's blind A/B: the same brief built by Sonnet 5.5 and by Opus 5.5, marked without knowing
  which was which; he marked Opus 5.5's three cards good and Sonnet 5.5's "too grainy". It is the
  first new public toy since the Fidelity lanes. The Operator's engine PR #106 made the web-address
  box name only what each picture toy opens (from the owner's review of the new toys).
- Later that evening: the engine PRs #99 (a tap can switch a kit toy's options, for lane Chemistry)
  and #109 (a GIF held on its frame, for lane Screens r2) merged, then Books r2 (#112: the book's
  and album's covers, spines and edges made sharp; every card good) and Character (#110: a
  kit-built, detailed person for Worlds). The owner stopped the Character lane there: "Better, but
  still looks too low-poly. We can stop trying to perfect this for now. The hybrid simulation will
  hopefully enable better characters." He answered the Operator's two research pages ("Splats,
  Worlds and Pages" and "Real Places and Real Science") the same night: "sharp yes" (the Operator's
  #118 makes the sharper rendering the default), "Hybrid yes" (Worlds gets ordinary lit models for
  the ground, water and sky, with splats for the props, effects and the character, behind a switch),
  "Science yes", "real island yes" and "diorama yes" (that is the Photo to 3D toy, #98). AI-made
  worlds wait until he has more information. He also asked to see the text layer the first page
  suggested: the Operator's #120 puts a PDF page's real words in the Toy tab, to read, copy and
  find.
- The shelf has 318 public toys (September 30, 2026), plus sixteen labs toys hidden unless `?labs=1`
  (the Picture lab, the splat equation, the Screen, Gaussian splatting, the song landscape, the
  Chladni plate, the splat field, Model to splats, your book, the photo album, the picture frame,
  the anatomy atlas, Photo to 3D, the Fluid lab, and the soda can and water bottle waiting for the
  Fluids engine). The plan (`tools/toy-plan.json`, [TOY-PLAN.md](TOY-PLAN.md)) has all 334. Scene
  schema v3; v2 still loads.
- Every kit toy's tap is checked by `tests/taps.spec.mjs`; its known exceptions (with reasons) are
  listed at its top. The full suite has 659 tests (the evening of October 1, 2026).
- The governance from September 27 is merged (#53): the Operator runs the lanes, workers are Opus
  5.5 only, new public text is in American English (`tools/us-english.mjs`), and the sound review
  runs on the Sound Board. Splashery's own code is MIT licensed (#51, `LICENSE`); assets keep their
  own licenses and credits.
- On September 29, 2026 the owner accepted the Splashery Universe plan
  ([review](reviews/2026-09-29-universe/review.md), ROADMAP.md): five parts (Toys, Studio, Worlds,
  Lab, Learn), new parts behind the labs switch, up to 12 workers at once until the weekly reset (8
  until the owner raised it that morning) (September 30, 4 p.m. ET), Opus 5.5 for the engine and
  toys and Sonnet 5.5 for Worlds content, Studio converters, docs and the Integrator, and the
  Operator merging by tiers (CLAUDE.md, "Pull requests"). Weapons: historical, fantasy and sci-fi
  only, never aimed at people or animals. Splashery doesn't police what people open; the terms of
  use say they're responsible.
- Early on September 30, 2026 (UTC) six PRs merged after two combined runs: the sharper rendering
  default (#107 and the Operator's #118, from the owner's "sharp yes"; `?sharp=0` for the old look),
  the text layer for PDF toys (#120), Chemistry (#100), Machines A (#102) and Song live (#119). The
  Sound Board and Help Board were rebuilt for the owner's sound review. The Effect review page now
  keeps each clip's own shape (live; its source change is the Operator's #124).
- Later on the morning of September 30, 2026 (UTC) nine more PRs merged after four combined runs,
  each failure checked against main (a Character test's time, fixed in #129, and flaky frame waits):
  Books r3 (#117, #123), Photo to 3D (#98), Lab r2 (#115, #116), Real objects (#97), Screens r2
  (#111) and Pianos (#103, #104). The pianos are public; the rest are behind the labs switch. The
  soda can and the water bottle stay in labs until the Fluids engine can pour them.
- On the morning of September 30, 2026 the owner answered the Operator's plan for after the weekly
  reset (WORKSTREAMS.md, "Next"): about six workers at once plus an Integrator; the running rounds
  finish first; Sound A and B, Science, Fix4 and the real island stay queued; new lanes for UI r2
  (focus mode, sheet and panel sizes, the gallery as a page, a better drawing pad, pan with two
  fingers or Shift-drag, the Home Screen app), a one-week video-to-3D spike (Splat.js, MIT, behind
  labs), Live input (microphone, then camera, then screen capture), later a web screen and a
  Wikipedia book; Books r4 adds page focus. Machines B, the pilot game, the Forest template and new
  novelty toys are parked (BACKLOG.md). The toy ideas became weekly, and the digest and a new site
  patrol run as fresh Sonnet sessions.
- The afternoon and evening of September 30, 2026: Fluids v1 merged (#121, the Fluid lab, labs),
  then Worlds r2 (#108, a sharper island) and the hybrid round (#127: a lit ground model, water that
  knows its depth, a photo sky, one sun with soft shadows, a mesh character to compare), both labs.
  The owner's sound review (his notes of September 28) is filed (#139, #143):
  `tools/sound-review.json` per toy, the rules in PACKS.md 7e, and since his call of September 30
  new sounds go live before he hears them, with a Sonnet sound patrol. A helper's CC0 sound catalog
  (#140) and a quality sweep of the 318 public toys (#149, `docs/audits/`) merged too. His other
  calls that day: "shelves yes" (the crystal ball to Medieval, the donut to Food, a Torus in Shapes,
  the tiny planet to Space; a Knots shelf later), "live input go", tap to pause long effects, and
  the turntable off with the tilt lock on by default for the plotters, proofs, AI and computing,
  Music, Open me, the chess set and the puzzle cube (lane UI r3). The Effect review page filled its
  1 GB that evening, so new clips go on page 2 (OPERATING.md, "The Effect review page").
  docs/WORLDS.md now words the hybrid mode's rule.
- Early on October 1, 2026 (UTC): Books r4 (#126, page focus and a Reading choice), Fix4 (#134, with
  engine PR #136 for the view-dependent `rim` opacity) and Fix5 (#145) merged, then three engine PRs
  after a 591-test run: shelf looks and tiny-planet palettes (#147), a `sample` voice for recorded
  sounds and the sound lint (#141), and video-to-3D support (#137, labs). The owner's review of
  October 1 ([review](reviews/2026-10-01-review/review.md)) went to Fix6 (Photo to 3D opens your own
  photos: the depth model's download had sized its buffer from a gzip `content-length`; typing on
  the Enigma's keys; the periodic table without its loading flash and with a tour of the elements; a
  smoother guitar), UI r4 (a glissando on every keyboard) and Live input r2 (the Song landscape
  starts at once and gets new looks drawn from measured features, synced to the audio clock).
- Later on October 1, 2026 (UTC): UI r2 merged (#131) and is on for everyone (#160: focus mode, the
  sheet's stops, the desktop panel's fold and gallery page, the finer drawing pad and pan; all eight
  cards good); Photo to 3D opens your own photos again (#154); the video-to-3D spike merged (#133,
  labs); Sound A's and Sound B's recordings went live (#142, #138: 85 CC0 samples in all); the live
  input engine merged (#144: the microphone, camera and screen, asked for only on a tap); and a
  glissando plays on every keyboard (#156, #157: all six cards good). The first Effect review page
  is out of room for clips, so every lane posts to page 2.
- October 2, 2026: the owner went through every toy on the preview build (the mega review,
  [reviews/2026-10-02-mega-review](reviews/2026-10-02-mega-review/review.md), with his plan answers
  in answers.md there) and accepted every recommendation: up to ten workers until about October 5,
  CC BY-SA assets per asset (#173), and every toy interactive with hands-on play and a little
  physics before the team turns to other work. Merged that day: the review and its sound round
  (#170), Shelves (#148), Science (#132) and Science r2 (#182, #181: pinch-and-scroll zoom and
  thermal ellipsoids on phones), Live input r2 (#162, #163: the Song landscape plays at once, with
  four measured looks), Fluids r4 and r5 (#152, #180: a GPU solver and a liquid surface, a tappable
  faucet, real lava and a smooth phone tier), the Photoreal research (#175, with a private
  comparison page), four handoff updates, Sound C (#183, #192: new sounds for the 44 toys he named,
  sounds that pause with their effects and a first tap on time), the physics engine (#176), UI r5's
  engine (#177: the gallery button and rotation defaults), Video 3D part 2 and r7 (#169, #186:
  sharper streets, what to film, phone-safe training and steering the flight; labs), and Live input
  r3 (#187, #191: the Song landscape opens in its Live view, tilts, replays and scrubs; Moving photo
  to 3D; labs). Codex tasks 02 to 06 (docs/codex/) audit credits, test health, phone and
  accessibility, old links and load times; the owner starts them. Lane Physics drafted the hands-on
  plan for every toy (docs/HANDS-ON-PLAN.md on its branch); the owner marks it on the Hands-on Plan
  page (OPERATING.md, "Pages"), and category lanes build what he approves.
- Locked (owner approved, do not change its look or behaviour): the laptop. Its smoke test guards
  it.

## Active lanes

The full table, with owned files, sessions, branches and PRs, is [WORKSTREAMS.md](WORKSTREAMS.md).

| Lane                                                                        | Status                                                                                       | Handoff                                  |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Operator                                                                    | Running; runs the lanes                                                                      | —                                        |
| Sound C: the sound notes of October 2                                       | Merged (engine #183, toys #192); its sounds are live                                         | `handoff/SoundC.md` (on its branch)      |
| Fix7: taps where you tap, and the bugs from October 2                       | Running, Opus 5.5 (#174 and #179 wait for marks)                                             | `handoff/Fix7.md` (on its branch)        |
| Physics: hands-on play and a physics engine                                 | Running, Opus 5.5 (engine #176 merged; showcase toys #184 wait for marks; the hands-on plan) | `handoff/Physics.md` (on its branch)     |
| Sharpness A: landmarks, vehicles, Medieval, Open me, gems, space, weather   | Running, Opus 5.5 (#172 waits for marks)                                                     | `handoff/SharpA.md` (on its branch)      |
| Sharpness B: food, toys, math, AI, the album covers, closed bases           | Running, Opus 5.5 (#185 waits for marks)                                                     | `handoff/SharpB.md` (on its branch)      |
| UI r5: gallery button, rotation defaults, the piano bar, big models, Record | Running, Opus 5.5 (engine #177 merged; #178 waits for marks)                                 | `handoff/UIr5.md` (on its branch)        |
| Live input r3: the October 2 notes and Moving photo to 3D                   | Merged (#187, #191; labs)                                                                    | `handoff/LiveInput.md`                   |
| Video 3D: a one-week spike                                                  | Merged r7 (#169, #186; labs)                                                                 | [handoff/Video3D.md](handoff/Video3D.md) |
| Fluids r4 and r5                                                            | Merged; waits for the owner's phone test before the next round                               | [handoff/Fluids.md](handoff/Fluids.md)   |
| Science                                                                     | Idle after r2 (merged)                                                                       | [handoff/Science.md](handoff/Science.md) |
| Worlds r4: the character lab                                                | Paused at the owner's request (October 2, 2026; #168 draft)                                  | [handoff/Worlds.md](handoff/Worlds.md)   |
| Integrator and Integrator 2                                                 | Running, Sonnet 5.5; they can split one run's spec files in half                             | —                                        |
| Next (WORKSTREAMS.md, Next)                                                 | Category hands-on lanes once the owner approves the hands-on plan; Quality, Knots, Food r2   | —                                        |

E4-finish, E5, E6a, E6b, F, G, Math, Fix3, AI, Help, HelpTextA, HelpTextB, Pictures, Manual and
Screens are done, and so are Viewer, Studio Sound, Learn, Lab, Studio Models, Books, Fidelity A,
Fidelity B, Worlds (the engine), Anatomy, the A/B toy piano and Character, and on September 30 the
sharper default (Sharpness), the text layer, Chemistry, Machines A, Song live, Books r3, Photo to
3D, Lab r2, Real objects, Screens r2, Pianos, Fluids v1, Worlds r2 and the hybrid round, and on
October 1 Books r4, Fix4, Fix5, Sound A and Sound B, and on October 2 Fix6, UI r2 to r4, Shelves and
Photoreal (WORKSTREAMS.md, "Done"). On September 27, 2026 the owner approved the plan in Part 1 of
the How Splashery Is Made page: the Operator runs the lanes, workers are Opus 5.5 only (at the
default effort, a trial), new public text is in American English, and the work goes in the order in
ROADMAP.md, "Now". Lanes AI and Math started that day, and the Sound Board has its review features,
ready for the owner's sound notes.

On September 29, 2026 the owner reviewed the new labs toys
([reviews/2026-09-29-new-toys](reviews/2026-09-29-new-toys/review.md)): "very impressed", the
picture frame "nearly perfect" and the Screen "very close to perfect". Books takes his notes on the
Picture lab, Your book, the photo album and the frame (taps that go back or forward by where they
land, pages you pull with real physics, sharper covers and a gilded frame, GIFs and videos in
frames, the slideshow's order); Screens r2 takes the Screen (nothing of the picture shows while it's
off, a real off switch, sharper sets); Lab r2 takes the galaxy tap and the Splat equation's grain;
the Song landscape gets a Live view that moves with the music (the Photo to 3D session, after its
own toy); and an Operator engine PR makes the web-address box name only what each toy opens.

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

Settled on 2026-10-04, late evening (the owner's push alignment notes,
[reviews/2026-10-04-push-alignment](reviews/2026-10-04-push-alignment/notes.md), and his picks on
the Push Plan page):

- **The push.** About ten to twelve busy workers on this account until the weekly reset of
  Wednesday, October 7, 2026, 4 p.m. ET, on his banked reset. Its main areas: Pictures and Pages
  (Splashery's difference), the Studio, Science and the labs, QR codes, and a real site. Wave 1
  (WORKSTREAMS.md, "Next") starts on his go; the four local lanes Imaging, Earth and maps, Any pose
  and QR r3 move to the cloud.
- **The shelves are closing** (CLAUDE.md, "Working style"): balls, food, nature, gems, medieval,
  holidays, music, Open me, animals and the cartoon vehicles get only their hands-on finishing;
  landmarks, the body, weather and fire grow only with photoreal or high-fidelity work; Space, Tiny
  world, Atoms, Math, and AI and computing stay open; Shapes only as a shape lab that teaches
  something; clothing later as "canvas" items people print their own pictures on. Photoreal: fix the
  sounds and bases (Photoreal r3), then add only at the newest bar. The Fluid lab continues only as
  other work needs it (hard to run on his devices); the Splat field may continue.
- **Rules he set** (CLAUDE.md, "Ground rules"): the Operator may approve open-source libraries (in
  LICENSES.md; anything serious goes to him), and he approved a LAZ reader and a DICOM reader; a
  recorder may save what the person records to a file they choose; the earthquakes toy may read the
  USGS feed live, and other open geographic feeds on the same terms; the Night sky may ask for a
  location on tap.
- **Evidence for every science, math and engineering toy**: sources, tests, and plain words about
  what is simplified; shown on each toy's page later, never inside the toy, and never naming the
  tool that checked it (docs/evidence/README.md). Codex tasks 16 to 20 write the first files; Codex
  task 21 finds out how a toy can move inside a PDF.
- **His picks**: QR Q5, Q6, Q7, Q12 and Q13 yes (Q1 to Q4, Q9 and Q10 later or after more detail; Q8
  waits; Q11 deferred); the site W1 to W8 and W10 to W12 yes (W9, for teachers, after the
  correctness audit); science S2 to S7, S9, S12 to S17 yes (S1 after his word on fetching by code;
  S8, S10 and S11 not now); tools only T5 and T6 as options; lanes Imaging, Earth and maps, Any pose
  and a third Integrator yes, Circuits not yet, the English sweep and the write-up near the end.
- **Fixes he asked for**: the photoreal alarm clock shows the real time (Fix8); the pages' sound on
  drag turns and the pop-up switch (Pages r6); the Splat mirror's grain and the live Song landscape
  (Live r7). The Chladni bow fix is already on main (Live input r4).

Settled on 2026-10-04, evening:

- Merged: Manual r2 (#253; "credit no": no credit line until the owner words one), Fluids r7 (#252)
  and the live3 still-mirror test fix (#259), each after a full test run.
- Codex's About audit (#193) is reworked in #260 (47 kept, 26 fixed, 17 kept as before, 18 kept
  main's newer text). It changes public toys' help text, so it waits for the owner's OK.
- The owner agreed to a push on this account through the scheduled reset of Wednesday, October 7, 4
  p.m. ET, using his banked reset; the plan's ideas wait for his picks.

Settled on 2026-10-04, afternoon:

- The hands-on demo toys are merged: Engine #255 (a ball twisting on the spot stops) and #232, then
  #229 and #230 through Ops combo #256. The owner marked every changed effect good. Combo L found
  three Level 1 gaps (tests/hl1.spec.mjs) and a rig over 12 regions, fixed in the lanes before the
  merge: the chest's lid and the jelly blob's stretch now take a press, so hl1 samples the soda can
  and the toadstool instead.
- tests/live3.spec.mjs:372 (the still splat mirror) fails on main since Live input r6 (#250); the
  Live input lane fixes it on `claude/lane-live-input-r6-fix`.
- Fluids r7 (#252, Sonnet 5.5) passed the Operator's technical review; it merges after a full test
  run (labs). Manual r2 (#253, Sonnet 5.5) waits on the owner's answer on its credit line.

Settled on 2026-10-04 (the owner's answers of 03:30 UTC):

- "Manual r2 go": lane Manual r2 (Sonnet 5.5, docs) builds Codex 13's newcomer proposals and a fresh
  PDF (docs/handoff/Manual.md, "r2").
- "Fluids Sonnet": lane Fluids r7 runs on Sonnet 5.5, with the owner's permission, as a test of
  Sonnet on engine work; the Operator reviews the code and the numbers (docs/handoff/Fluids.md,
  "r7").
- The Dot's photoreal sound sources report is merged (#248). Live input r6 (#250) is in combo K.

Settled on 2026-10-04, early (the owner's messages of October 3, evening):

- Codex tasks 13 (#244, the Tinkerer's Manual audited for a newcomer), 14 (#247, the Fluid Lab on a
  phone) and 15 (#245, the lab notebook) are merged. The manual's PDF still has the September 29
  text; a lane regenerates it. #247's proposals (smaller phone allocations, a step-down that
  rebuilds the fluids, the WebGPU buffers kept per scene change) wait for a Fluids round.
- The hands-on engines are merged together as #246 (combo J); the five hands-on category lanes (H1
  to H5) may start, locally on the second account.
- The save point: OPERATING.md, "Concurrency and usage".

Settled on 2026-10-03, evening (the owner's review, docs/reviews/2026-10-03-labs-review/):

- The QR code toy: sharper modules, more motions, living colors expanded, country-flag colors on the
  splats, more palettes: lane QR r3, local.
- The photoreal toys' sounds and bases, toy by toy, the dog plush's gaps and the real alarm clock's
  time: added to Photoreal r3's brief (local).
- The Splat mirror (blobs over the camera view when zoomed out; too flashy and grainy) joins Live
  input r6, after Moving photo to 3D, which isn't on the labs site until r6 merges.
- The Fluid Lab on a phone: Codex task 14 measures it first; lane Fluids builds the fix.
- Codex task 13 audits the Tinkerer's Manual for a newcomer to Gaussian splats; task 15 brings the
  lab notebook up to date.
- grooph 0.2.5's hooks are on main (#241).
- This account's weekly usage resets Wednesday, October 7, 2026, 4 p.m. ET. Until then it carries
  the Operator, the Integrators and the cloud lanes already open; new building runs on the second
  account.

Settled on 2026-10-03, afternoon (the owner's notes at 16:25 UTC):

- New work runs as local lanes in Claude Code on the owner's Mac, signed in to his second Claude
  account, so it uses that account's weekly usage rather than this account's or cloud credits
  (OPERATING.md, "Local lanes"; `SPLASHERY_PORT` gives each one its own test server). The first
  five: Photoreal r3, Any pose, Imaging, Earth and maps, Circuits (WORKSTREAMS.md).
- Moving photo to 3D keeps its sound on pause and resume, and plays at its source's speed and
  sharpness: Live input r6, in the cloud.
- The Dot jobs report merged (#231). The owner's Dot researches sources for the new shelves
  (`docs/audits/new-sources-2026-10.md` when it lands).

Settled on 2026-10-03, the owner's answers of that morning:

- The QR code toy keeps its two vendored libraries: Project Nayuki's QR Code generator (MIT) and
  jsQR (Apache-2.0), loaded only when the toy opens (CLAUDE.md).
- #184 (the Physics showcase toys, the spring toy included) merges as it is after a full test run;
  #178 (UI r5) merges once the lane's answer on model sizes is in.
- His October 2 review file says "[the other project]" in place of its code name.
- The lanes' grooph events go on this public repository (#227: grooph 0.2.4 hooks).
- PDF.js's four Liberation Sans fonts: he asked for a comparison with the OFL builds first, and for
  one page listing every license decision, to review if the site is ever commercialized.

Settled on 2026-10-03, morning: the owner accepts every line of docs/HANDS-ON-PLAN.md (336 toys:
Level 1 for all, and 183 toys with more). Three engine lanes build the plan's engine pieces at once
(Hands-on engine A: bodies and fields; B: joints; C: soft parts), each with a few demo toys; five
category lanes build the other toys as each engine PR merges. Codex adds the real physical
properties (task 11) and a Level 1 sweep of every toy (task 12).

Settled on 2026-10-03, the owner's "go" on the Splat Fidelity Plan (the Operator's private page of
that night: why our placed splats look like cartoons beside SuperSplat's trained ones, and how to
train our own):

- Stage 1: the boombox trained from Blender renders on the owner's Mac (Codex task 08); Stage 2: a
  brass orrery trained part by part on a kit rig (the Fidelity lane, then Codex task 10).
- Photoreal round 2 (the Photoreal r2 lane), PDF links and pop-out figures in the books (Books r5,
  labs first), and a Codex comparison with SuperSplat (task 09).
- CC BY-NC and CC BY-NC-SA assets are allowed per asset on four conditions (CLAUDE.md). Adding them
  never forces any other toy off the site: licenses apply per asset.
- No new Sharpness rounds until Stage 1 reports.

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

Settled on September 30, 2026 (the owner's answers to the Operator's plan after the reset):

- About six workers at once after the weekly reset (seven at most), plus an Integrator.
- New lanes: UI r2, the video-to-3D spike, Live input, then a web screen and the Wikipedia book
  (WORKSTREAMS.md, "Next"). Splat.js (MIT) may be vendored for the spike, behind labs.
- Live input asks for the microphone, camera or screen only on a tap and records nothing.
- The Wikipedia book is the one CC BY-SA exception: fetched live, never stored, credited.
- True 4D from video comes later (it needs a rented GPU). A MIDI keyboard goes to the pianos' next
  round; tilt to steer, a live earthquake globe and hand tracking wait in BACKLOG.md.
- Parked: Machines B, the pilot game, the Forest template and new novelty toys.

Still open (ask when it comes up, in Phase H):

- The favourite maths toy for the homepage: Menger sponge or hypercube? One embed or several?
