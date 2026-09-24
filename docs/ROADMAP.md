# Splashery roadmap

## Now: polish phases (v4)

v3 shipped on 2026-09-23 (PRs #4–#11, 283 toys). The next work runs in phases, one session each. The
current state and the full plan for the next phase are in [HANDOFF.md](HANDOFF.md).

| Phase | What                                                                                                                                                                                  |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | Done (PR #13 and the homepage PR): sharpness (pixel density, splat counts, kit splat size, a Detail setting) and embeds (transparency, framing, size, zoom); then the homepage embed. |
| B     | Mobile shelf grid and a "Find your own splat" help panel.                                                                                                                             |
| C     | More music toys and polish.                                                                                                                                                           |
| D     | AI image-to-3D trial (the owner added `HF_TOKEN` on 2026-09-23).                                                                                                                      |
| E     | Later: gallery, multi-toy scenes, liquid pour, draw-order fix, more scans.                                                                                                            |

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
| Outside models             | Allowed: CC0 or CC BY models and scans (Poly Haven, NASA, SuperSplat and similar), turned into splats at build time and credited. AI image-to-3D at build time is allowed with a Hugging Face token (added 2026-09-23; Phase D). |
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

- **Gallery** (plan below): Phase E.
- **Homepage embed** on ryanjosephkamp.github.io: scheduled for Phase A (after the embed fixes).
- **True fluid simulation** (particle water on WebGPU compute): scripted pouring comes first.
- **Multi-toy scenes and physics** (throwing a toy at another, Newton's cradle with real
  collisions): needs a bigger schema change; single-toy behaviours come first.
- **4D Gaussian splat captures**: see "How toys move".

See [BACKLOG.md](BACKLOG.md) for the reasons and what would unblock each one.

## Gallery plan (deferred, plan only)

- **No backend to start with.** `gallery/index.html` reads `gallery/entries.json` from the repo. An
  entry is mostly a scene link (or scene JSON) plus a thumbnail and a credit line, because a
  generated or shelf toy is fully described by its scene.
- **Submissions**: an in-app "Submit to gallery" button opens a prefilled GitHub issue form (scene
  link, name, credit, licence checkbox). An email address is the fallback for people without GitHub.
  Custom scans attach a zip or link to the file, with its licence.
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
