# Splashery roadmap

## Now: the October push (accepted October 4, 2026)

The owner's push alignment notes of October 4, 2026
([notes](reviews/2026-10-04-push-alignment/notes.md)) turn Splashery from a toy box into a site of
tools, science and studio work built on splats:

1. **Close the toy shelves.** Finish the hands-on work on the closed shelves (CLAUDE.md, "Working
   style", "Shelves"); new toys there only when the owner asks, or as photoreal captures at the
   newest bar.
2. **Pictures and Pages** is the difference: figures that rise off any page, chosen by a tap or a
   drawn box, at the depth an author sets, in books, albums, the Picture lab and embeds.
3. **The Studio**: more to try in every converter, the original beside the 3D, a clean splat mirror,
   a landscape that grows with the song, and longer video-to-3D scenes.
4. **Science and the labs**: data that already are Gaussians (crystals, microscopy, cryo-EM,
   galaxies), imaging (X-ray, CT, MRI), the Earth with live earthquakes, viewers for people's own
   point clouds, splats and volumes, labs for sound and light, and evidence that every science, math
   and engineering toy is right (docs/evidence/).
5. **QR codes** as a specialty: how they work, what survives damage (with a study), codes built from
   real things, and other barcodes.
6. **A real site**: a home page, one menu, search, a page for every toy with its evidence, hubs,
   What's new, offline install, and a PDF catalog of the collection; the front door is the owner's
   call. Later, maybe native apps.
7. **Showing why it's special**: a showcase reel, and an honest answer to "can a toy move inside a
   PDF?" (Codex task 21).

Lanes and order: WORKSTREAMS.md, "Next", "The push".

## Before the push: the plan from September 27, 2026

The owner approved this plan on September 27, 2026 (Part 1 of the How Splashery Is Made page), and
added step 3 on September 28, 2026 (the Pages into Splats report,
[review](reviews/2026-09-28-pictures/review.md)). The Operator runs the lanes
([OPERATING.md](OPERATING.md), [WORKSTREAMS.md](WORKSTREAMS.md)); the current state is in
[HANDOFF.md](HANDOFF.md).

| Step | What                                                                                                                                                                                                                                                                                       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Done on September 28, 2026: lane Math (#50), lane Fix3 (#54) and lane AI (#52, with its engine PR #56): twelve AI and computing toys.                                                                                                                                                      |
| 2    | Done on September 28, 2026: toy help (below). Lane Help (#57) built the line, the "?" button and the About section; the text lanes HelpTextA (#60) and HelpTextB (#59) wrote a how-to line and an About text for every toy, and the owner approved them all on the Help Board.             |
| 3    | Pictures and pages (below), added on September 28, 2026: the engine lane Pictures turns PDF pages, photos, GIFs and videos into splats; then the toy lanes (Your book, Photo album, Picture frame, Screen), the Gaussian splat toy, and the splat equation toy with the Tinkerer's Manual. |
| 4    | The sound overhaul, alongside step 3 from the day the owner's notes arrive: the notes go on the Sound Board, sound lanes build new sounds there, he approves them, and they go into the site. A "Sound preferences" section follows from his notes.                                        |
| 5    | Pianos and songs: the five approved pianos, a song bar based on the chess bar, and MIDI files.                                                                                                                                                                                             |
| 6    | A sound round for the new toys: AI and computing, Math, and the picture toys.                                                                                                                                                                                                              |
| 7    | Physics and hands-on play (below): the engine and four showcase toys, then a hands-on plan for every toy, then category lanes.                                                                                                                                                             |
| 8    | The Toy Workshop, the "Take it to your AI" package, submissions and the gallery; the flag toy (it needs the cloth). Code a toy builds on the Tinkerer's Manual.                                                                                                                            |
| 9    | Last: the American English sweep, `docs/HOW-IT-WORKS.md`, the blog post, a "How it's made" page and the homepage embeds.                                                                                                                                                                   |

Whenever a slot is free: a Real objects lane for the approved scans (historical figures, real
vehicles, and the everyday objects as real captures), as brand-free sources turn up.

### The Splashery Universe (accepted September 29, 2026)

The owner's note of big ideas and his answers on the planning page "The Splashery Universe" are in
[reviews/2026-09-29-universe/review.md](reviews/2026-09-29-universe/review.md). Splashery grows into
five parts. New parts open behind the labs switch, and the owner decides when each goes public. The
steps above continue alongside them. Until the weekly reset (September 30, 2026, 4 p.m. ET), up to
12 workers run at once (the owner raised it from 8 on the morning of September 29). Each lane names
its model (the owner's split in CLAUDE.md).

- **Toys** (Opus 5.5): the sound overhaul (step 4, two lanes from the owner's notes); two fidelity
  lanes (Fidelity A audits every toy at phone size and fixes the worst, starting with the desk lamp,
  the American football and the hockey puck; Fidelity B fixes the rest of its list); pianos and
  songs (step 5); the new toys' sound round (step 6); the Viewer fixes (whole PDF figures, pinch, a
  tilt lock, top-bar settings, flags per toy, terms of use).
- **Studio**, splats from anything (Sonnet 5.5 for the converters, Opus 5.5 for any engine part):
  sound first (a song as a landscape you fly over, and a Chladni plate), then 3D model files to
  splats (glTF, OBJ, STL, plus a build tool for CC0 models), then photo to 3D (an on-device depth
  model). Later: typed words, spreadsheet charts, real terrain and a camera mirror.
- **Worlds** (Opus 5.5 for the engine, Sonnet 5.5 for games and templates): the world engine as a
  sandbox first; then the pilot game, Toy Hunt Island; then the first portfolio template, Forest
  trail, with a World maker page; then more templates, two at a time. Templates are free forever
  under MIT, with a small "World template by Ryan Kamp · Splashery" credit people may keep or move.
  Since the owner's "Hybrid yes" (September 29, 2026), worlds are a hybrid: ordinary lit models for
  the ground, water, sky, collision and signs, and splats for the props, scans, effects, anything
  that breaks or morphs, and the character. The splat-only look stays behind a `render` switch, and
  the toy shelf stays pure splats. Menus and text are page text. A second Operator takes Worlds once
  it has three or more lanes.
- **Lab** (Opus 5.5): a short literature check, then sharper splat kernels on pages and grainy toys,
  then splat fields on the GPU. Keep only what beats today's clips. Later, an open format for splat
  objects with moving parts.
- **Learn** (Sonnet 5.5): an audit of the Tinkerer's Manual, and a running lab notebook
  ([NOTEBOOK.md](NOTEBOOK.md): what each model built, numbers, lessons) that becomes the blog post
  at step 9.
- **Also**: one blind A/B toy, the same small toy built by each model, for the blog; the human
  anatomy atlas once the 3D model converter works (built from CC0, CC BY or public-domain models,
  with our own organ toys as the fallback; the owner decides on any CC BY-SA source); the owner's
  own phone scans as they arrive; and a grooph graph of the Operator's loop for the owner's phone.

### Pictures and pages

The owner asked for this on September 28, 2026 ([his notes](reviews/2026-09-28-pictures/review.md))
and accepted the plan in the Pages into Splats report the same day:

- **Why it works.** The Operator's test turned an article page into 172k splats ("paper plus ink":
  the paper is one sheet, and only inked pixels get splats). At phone size the title and headings
  read on the whole page, and the body text reads zoomed in. A 640 × 400 photo became 256k splats
  and looked like the photo. Video uses the laptop's live-screen method: a fixed sheet of splats
  whose colors come from the current frame on the GPU, with the video's own sound. PlayCanvas skips
  splats under about 2 screen pixels (`minPixelSize`), so far pages need coarser splats.
- **Engine first** (lane Pictures, "Engine: …"): PDF pages (PDF.js, vendored, Apache 2.0), photos,
  GIF frames (omggif, MIT, where the browser can't decode them) and video frames into splats; pages
  that stream through a few sheets, so a book of any length costs the same; near and far detail;
  **Open a file** in the Toy tab; a web address in scenes for links and embeds; a hidden labs switch
  (`?labs=1`) until the owner has tried the toys on his phone; and one plain test toy, the Picture
  lab. Files stay on the visitor's device; nothing is uploaded.
- **Then the toys**, on a new shelf, "Pictures and pages": Your book (any PDF; hardcover, paperback,
  magazine, stapled paper, spiral notebook; pages curl like paper), Photo album, Picture frame (and
  a digital frame) and Screen (old TV, flat TV, cinema, hologram, with sound). Also the Gaussian
  splat toy on the AI and computing shelf (one splat and its sliders, a toy shown as its splats, a
  cloud of splats trained into a picture, the back-to-front sort), and the splat equation toy (type
  where splats go and their colors, with u, v and t, read by lane Math's safe equation reader) with
  a public Tinkerer's Manual that is also the book's default PDF.
- **Rules.** Samples only under CC0, CC BY or public domain, with credits (our own manual, a CC BY
  paper, a public-domain book, CC0 photos, a CC BY or public-domain film); no logos or insignia. The
  laptop stays as it is. The fitted method (fewer, sharper splats fitted to a picture) is a later
  upgrade (BACKLOG.md).

### Toy help

Done on September 28, 2026 (#57, #60 and #59). The owner asked for this on September 27, 2026
([review](reviews/2026-09-27-ai-math/review.md)):

- **How to play**: when a toy opens (from the shelf, a link or a refresh), one short line says how
  to play with it, for example "Drag a row or column to turn it" on the puzzle cube, or "Tap a bar
  to play it" on the xylophone. It sits beside the toy, not over it (under the toy's name on a
  phone, beside the stage on a wide screen), fades after a few seconds, and a "?" button shows it
  again. Toys with only a tap say so in a few words.
- **About**: a new tab in the settings panel with a proper description: what the toy is and what it
  shows or means, what you can do with it (its tap, drags, options and typing), and a fact or two,
  so a visitor can learn about something they don't recognize without leaving the site.
- **How it's built**: an "Engine: …" PR adds the line, the button and the tab, reading the text from
  a new shared list, `src/toy-help.js` (like `src/toy-sounds.js`: each lane edits only its own toys'
  entries), loaded when needed so the page stays light. A test checks that every toy has a line.
  Then two lanes, split by shelf, write the how-to lines and About texts for all toys in American
  English, checked against what each toy really does; the owner reads them on a review page. From
  then on, every lane writes its own toys' help as part of "done".

### Hands-on play

- Three controls on the stage: **▶ Play** runs the toy's animation (today's tap); **✋ Hands-on** is
  a switch (off: everything works as today; on: a drag on the toy grabs what's under the finger, a
  drag beside it or with two fingers turns the view, and a tap on a piece does that piece's action);
  **↺ Reset** sends every piece home.
- Toys that are hands-on already (the laptop, xylophone, chess, puzzle cube, Newton's cradle, gummy
  bear, bricks, and the pianos when they come) start with the switch on and keep their controls.
- Two levels: every toy can be picked up and tossed (it lands, bounces and settles; soft ones
  squish), scans included; rich toys come apart into pieces (blocks to build with, sushi and
  chopsticks, jelly to stretch, a cupcake's icing, a cake's candles, pizza slices with cheese
  strings, a DNA strand to rip, a tree's leaves).
- A link still opens the toy as built; saving what you made may come later as an added field, and
  old links keep loading. Whether Hands-on is on by default is decided after the showcase.

### Physics

One small engine of our own, based on position-based dynamics (XPBD), with no library: pieces are
points held together by rules, stiff for solid pieces, loose for soft things (jelly, cheese, icing),
a grid for cloth (the flag) and a chain for strands (DNA). Pieces collide with simple shapes and the
floor, on the CPU for a few dozen pieces and a few hundred points; the GPU still moves every splat.
It lands as an "Engine: …" PR before the showcase toys. The engine lane checks how far the 48-token
limit can go on phones.

### Toy Workshop, AI package and submissions

- **Workshop** layers: Remix (exists), Build from parts (kit shapes with handles, hinges, tap-effect
  templates and a sound, saved as plain data, never code), Code a toy (a recipe editor), From a
  photo (lane G's method and your own splat files). It reuses the hands-on grab and adds physics
  templates.
- **"Take it to your AI"**: a zip made in the browser with `PROMPT.md` (the description and the
  task, ready to paste), `CLAUDE.md` and `AGENTS.md` pointing to it, the toy as Workshop data, a kit
  guide generated from the code, two or three example recipes, the rules and a small test page. "Try
  a recipe file" runs the result on your own device only, never in links or embeds.
- **Submissions**: one form, three ways (an idea, a toy you made as a link or Workshop data, and
  files, which are optional: a recipe, your own splat capture, photos). A Submit button opens a
  pre-filled GitHub issue form; people who code can open a PR. Each submission confirms it's the
  person's own work (or CC0 or CC BY with the source) and follows the content rules. The Operator
  puts each on the Toy Ideas page, the owner approves, a lane builds it, and it joins a "Community"
  shelf with the maker's credit. No email route at launch.
- The code is MIT licensed (decided September 27, 2026); assets keep their own licenses and credits.

### The public write-up

Part 2 of the How Splashery Is Made page is the approved basis. At step 9 it is rewritten for
readers in American English, checked against the code, and becomes `docs/HOW-IT-WORKS.md` and a
draft post in the blog repository, framed as an experiment in building with Claude Opus 5.5.

## Earlier phases (v4)

| Phase  | What                                                                                                                                                           |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A      | Done (PR #13 and the homepage PR): sharpness, Detail setting, embeds, homepage embed.                                                                          |
| B      | Done: mobile shelf grid, two-line thumbnail labels, "Find your own splat" help panel.                                                                          |
| C1, C2 | Done: visual fixes, and clearer or more dramatic effects, from the owner's 2026-09-23 review.                                                                  |
| D      | Done: effects and sound engine: a unique sound per toy, scan rigs, position-aware taps, drag-to-stretch.                                                       |
| E1–E6  | Done: a new tap effect and sound for every toy that only hopped, in six waves ([TOY-PLAN.md](TOY-PLAN.md)); the last ones ran as parallel lanes on 2026-09-26. |
| F      | Done (#45, #42): touch and drag play for the puzzle cube, chess, Newton's cradle and the bricks.                                                               |
| G      | Done (#43, #47, #48): the AI image-to-3D trial (the real pencil and tin can) and their looks.                                                                  |

## v3: the big toy box (done)

Agreed with the owner on 2026-09-22. Splashery v2 (8 toys, 8 effects, share links, embeds) stays
exactly as it is; v3 grows it into a toy box of 100+ toys in many categories, with toys that move on
their own, open and close, and can wear patterns and flags.

## Decisions

| Question                   | Decision                                                                                                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How many toys, which first | As many as possible, mostly generated in code. Sports balls and flags first, then the other packs in the order below.                                                                                                            |
| PR slicing                 | Stacked draft PRs, one branch each (`claude/splashery-expansion-alignment-q9os3b` and `…-q9os3b-<part>`), all targeting `main`. Merge them in order; each shrinks to its own diff once the one before it is merged.              |
| Flags                      | Every national flag, from Wikimedia Commons, public domain only (each file's licence checked), usable on any toy.                                                                                                                |
| Outside models             | Allowed: CC0 or CC BY models and scans (Poly Haven, NASA, SuperSplat and similar), turned into splats at build time and credited. AI image-to-3D at build time is allowed with a Hugging Face token (added 2026-09-23; Phase G). |
| Anatomy                    | Stylised and friendly, never gory.                                                                                                                                                                                               |
| Sound                      | Optional soft sounds (WebAudio, no files), off until the speaker button is pressed, never on in embeds by default.                                                                                                               |
| Weapons                    | Medieval and fantasy only (sword, shield, bow, crossbow, catapult, trebuchet, a historical cannon firing paint). No firearms.                                                                                                    |
| Brands                     | Generic designs only: no logos, league marks or named products ("building bricks", "puzzle cube", "ocean liner", "supertall").                                                                                                   |

## How toys are made

1. **Generated in code** (the main route): seeded recipes built in the browser from a small toy kit
   of surface and volume primitives. No licence risk, almost no download, recolourable, and a toy
   fits in a share link.
2. **Captured splats**: CC0 or CC BY scans converted with `tools/prepare-assets.mjs`. Photoreal but
   about 5 MB each (plus a 1.5 MB lite copy), so the shelf keeps at most about 30.
3. **Models turned into splats**: a new build-time tool samples a CC0 or CC BY glTF model's surface
   and writes SOG.
4. **AI image-to-3D at build time**: only with the owner's Hugging Face token set as a cloud
   environment variable. The token never reaches the site, a commit, a log or a PR.
5. **The owner's own captures** (Scaniverse, Polycam, Luma): PLY or SPZ files, any time.

## How toys move

- **Behaviours**: built-in motion driven by the clock and per-splat data (beat, breathe, spin, orbit
  with differential rotation, flicker, bloom and grow, melt, rain and lightning, pulse along a path,
  twinkle, sway, flap, inflate, pop).
- **Parts**: splats grouped into rigid parts with hinges or spins (book covers, laptop lids, chest
  lids, rotors, wheels, petals), opened and closed by tapping or with a slider.
- **Patterns**: a pattern layer wraps a design around any toy (stripes, dots, checks, stars,
  gradients and every national flag), under the toy's own seams and details.
- 4D Gaussian splat captures are not used: there is no standard format for them in PlayCanvas, the
  files are huge, and behaviours give the same "alive" feel for free.

## The PRs

| #   | Branch suffix | What                                                                                                                                                                                      |
| --- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | (none)        | Phone sheet (tap outside or swipe down to close, grab handle, tabs, roomier rows), shelf that scales (categories, search, Surprise me, lazy thumbnails), canvas resize fix, this roadmap. |
| 2   | `-engine`     | Toy kit and per-pack loading, behaviours, parts, pattern layer and flags, scene schema v3 with a v2 migration, optional sound.                                                            |
| 3   | `-balls`      | Sports balls.                                                                                                                                                                             |
| 4   | `-space`      | Space.                                                                                                                                                                                    |
| 5   | `-tiny`       | Tiny world (microbiology), atoms and chemistry, gems and minerals, anatomy.                                                                                                               |
| 6   | `-nature`     | Plants and trees, weather and elements, food.                                                                                                                                             |
| 7   | `-play`       | Toys and playthings, maths and art, things that open, medieval and fantasy, animals, holidays, music.                                                                                     |
| 8   | `-world`      | Vehicles, landmarks, ships; the model-to-splat tool with CC0/CC BY models; more photoreal scans; AI image-to-3D if the token is set.                                                      |

## The toy list

★ marks the first picks in each pack. Anything that turns out not to be feasible moves to
[BACKLOG.md](BACKLOG.md) with the reason and what would unblock it.

1. **Sports balls**: ★basketball, ★soccer ball, ★American football, ★tennis ball, ★baseball, ★beach
   ball, ★golf ball, rugby ball, volleyball, softball, ping-pong ball, cricket ball, bowling ball,
   pool balls, pickleball, dodgeball, medicine ball, marble, bouncy ball, hockey puck, shuttlecock,
   flying disc. Motion: bounce with squash and stretch, spin.
2. **Space**: ★the Sun, ★spiral galaxy (Milky Way-like and Andromeda-like), ★nebula, ★solar system,
   ★comet, planets, the Moon, ringed planet, asteroid, star types, pulsar, black hole with an
   accretion disk, planetary nebula, supernova, star cluster.
3. **Tiny world**: ★virus, ★bacteriophage, ★rod bacterium, ★neuron (a pulse runs down the axon),
   ★astrocyte, ★red blood cell, ★animal cell, ★DNA helix, microglia, diatom, tardigrade, pollen,
   snowflake, chromosome, mitochondrion.
4. **Atoms and chemistry**: ★orbital clouds (hydrogen-like 1s to 4f, sampled from |ψ|²), ★elements 1
   to 118 as Bohr-shell toys, molecules (water, CO₂, methane, benzene, caffeine, buckyball), crystal
   lattices (salt, diamond, graphite, ice).
5. **Gems and minerals**: ★diamond, ★ruby, ★emerald, ★amethyst geode, sapphire, quartz cluster,
   opal, pearl, crystal ball. Sparkle is faked with glints; splats cannot refract.
6. **Anatomy (stylised)**: ★beating heart, ★brain, ★eye, lungs that breathe, tooth.
7. **Plants and nature**: ★trees (oak, pine, palm, cherry blossom, autumn maple, bonsai),
   ★sunflower, ★rose, ★dandelion clock, tulip, daisy, lotus, mushroom, fern, cactus, coral,
   pinecone, rocks.
8. **Weather and elements**: ★storm cloud (rain and lightning), ★campfire, ★lava lamp, ★snow globe,
   ★volcano, ★ice statue that melts, candle, tornado, rainbow, iceberg.
9. **Food**: ★ice cream cone that melts, ★watermelon, ★birthday cake, ★popcorn, ★jelly, ★pancake
   stack, cupcake, pizza, burger, sushi, lollipop, macarons, fruit (apple, banana, orange, cherries,
   grapes, avocado), egg, coffee cup.
10. **Toys and playthings**: ★building bricks, ★rubber duck, ★spinning top, ★dice, ★Newton's cradle,
    teddy bear, yo-yo, puzzle cube, spring toy, kite, paper plane, origami crane, balloon animal,
    soap bubbles, robot.
11. **Things that open**: ★book, ★laptop, ★treasure chest, music box, clock showing the real time,
    gift box, umbrella, desk fan, lamp, potion bottle.
12. **Medieval and fantasy**: ★sword in the stone, ★shield with heraldry, ★bow and target, ★catapult
    or trebuchet that throws paint, crossbow, knight's helmet, crown, dragon egg, wizard's orb.
13. **Animals**: ★jellyfish, ★fish school, ★butterfly, ★pufferfish, ★nautilus shell, ladybug, snail,
    octopus, starfish, frog, penguin.
14. **Maths and art**: ★Lorenz attractor, ★Möbius strip, ★Klein bottle, ★Menger sponge, ★4D
    hypercube, torus knots, gyroid, Mandelbulb, Sierpinski tetrahedron, Platonic solids.
15. **Holidays**: jack-o'-lantern, snowman that melts, fireworks, decorated tree, patterned egg,
    paper lantern, diya lamp.
16. **Music**: guitar with plucked strings, drum, xylophone.
17. **Vehicles**: ★rocket, ★helicopter, ★hot-air balloon, ★steam train, car, bus, propeller plane,
    jet, sailboat, ★ocean liner, submarine, bicycle, UFO.
18. **Landmarks**: ★Eiffel Tower, ★Washington Monument, ★pyramids, ★a twisting supertall,
    ★lighthouse, Statue of Liberty (only from a free model), White House, Leaning Tower of Pisa,
    Colosseum, Parthenon, Stonehenge, Big Ben, Taj Mahal, castle, pagoda, windmill.

## Deferred

- **Gallery** (plan below): Phase H.
- **Homepage embed** on ryanjosephkamp.github.io: scheduled for Phase A (after the embed fixes).
- **True fluid simulation** (particle water on WebGPU compute): scripted pouring comes first.
- **Multi-toy scenes** (several toys in one scene): needs a bigger schema change. Physics within one
  toy is now planned (above, "Physics").
- **4D Gaussian splat captures**: see "How toys move".

See [BACKLOG.md](BACKLOG.md) for the reasons and what would unblock each one.

## Gallery plan (deferred, plan only)

- **No backend to start with.** `gallery/index.html` reads `gallery/entries.json` from the repo. An
  entry is mostly a scene link (or scene JSON) plus a thumbnail and a credit line, because a
  generated or shelf toy is fully described by its scene.
- **Submissions**: now part of the plan above ("Toy Workshop, AI package and submissions"): a
  pre-filled GitHub issue form, files optional, and no email route at launch.
- **Approval from a phone**: say "add issue #N to the gallery" in a session, or let a GitHub Action
  (built-in `GITHUB_TOKEN`, no secrets) turn a labelled issue into a PR the owner merges.
- **Grid performance**: browsers allow about 16 WebGL contexts, so the grid shows still or animated
  thumbnails and opens one live player when a card is tapped.
- **Later, only if it takes off**: a hosted backend for one-click submissions and likes (Cloudflare
  Workers with R2, or Supabase). It needs moderation, and its secrets live in the provider's
  dashboard and GitHub Actions secrets, never in the page.

## Ground rules (unchanged)

Static files and ES modules only; no bundler, CDN, server or API keys at runtime. PlayCanvas 2.22.3
is vendored. Every asset is CC0, CC BY or public domain, checked on its live source page and
recorded in `CREDITS.md`, `tools/assets.json` and the in-app credits. Old `#s=` links and saved
scene files keep loading. Tests run with
`SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test`, and `npx prettier --check .`
stays clean.
