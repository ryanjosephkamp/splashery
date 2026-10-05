# Lane Arcade

## Brief

### Brief (written by the Operator on October 5, 2026, from the owner's idea and his marks on the Push Plan)

The owner wants real games made as Splashery toys: simple and geometric first (brick breaker, snake,
falling blocks), then bigger, each playable in the page, full screen and in embeds, with parts that
only splats do well (a game that switches between 2D and 3D, things that shatter into real pieces,
real captured materials and places, levels made from the person's own photo or page). The topic of a
game is never "splats". He wants to see how far splat games can go in a browser with good
performance. A new labs shelf, "Arcade" (category id `arcade`).

#### The game kit (your engine PR, first; small, additive and tested; toys that don't use it behave exactly as before)

- K1 Play mode: a Play button makes the game the whole page (the Fullscreen API where the browser
  allows it, else filling the window; on an iPhone, Safari can't go truly full screen, so fill the
  viewport), no gallery or panels; Esc or back leaves; the game pauses when the tab is hidden.
- K2 Controls for every device: keys, mouse, touch (swipes and an on-screen pad; reuse the thumb
  stick in src/worlds/controls.js where it fits) and game controllers (the Gamepad API needs no
  permission). Each game declares and shows its controls.
- K3 The 2D/3D switch. The owner's direction: a button (a switch), not a slider the player scrubs:
  pressing it makes the game slide smoothly from 2D to 3D or back, with a continuous blend under the
  hood. A game may expose a slider only where the slider is part of play. The game keeps running
  with the same rules through the change. In the locked 2D view the camera is still, so splats
  barely need re-sorting; use that.
- K4 Game basics: a steady fixed-step game clock, pause, restart, a best score kept on the device,
  sounds from src/voices.js, and stats that differ per game (the owner: some games have levels, XP,
  HP, coins or points, others don't), so a game declares its own stats and HUD.
- K5 Embeds: a game embeds like any toy (the iframe and the splashery-toy element), with its
  settings (level, 2D or 3D) in the embed; keyboard play works in an embed once it's clicked.

#### The games, in this order (one PR, pushed after each game; clips of each on Effect review page 2)

1. G1 Brick breaker. Paddle, ball, bricks; every brick shatters into real pieces that fall and
   bounce (the effect quality rules). The owner's 3D vision: switching to 3D isn't just a deeper
   flat game; the paddle moves down to the bottom of an invisible sphere, the bricks spread out over
   a dome around and above it, and the ball bounces in three dimensions as the player plays. If your
   first version and his vision differ, he wants versions kept side by side (never scrap one unless
   he says so); build so a game can have more than one version (a Style option).
2. G2 Snake on a planet. A flat grid; switch to 3D and the grid wraps onto a cube or a planet you
   steer around. The owner: use planets from the Space shelf (larger), add tunnels from one side of
   the planet or cube to the other, and try other 3D shapes beyond cubes and spheres (a torus, say).
   Hopping between planets is an optional extra he isn't set on.
3. G6 Falling sand: every grain a splat; sand, water, fire, oil and seeds that pile, flow, burn and
   grow; flat, or tipped into 3D in a glass box.
4. G7 Break your page: brick breaker whose bricks are the words and pictures of the person's own PDF
   page or photo (import the picture engine's page and figure finders from src/pictures.js and
   src/media.js; don't edit them: lane Pages r6 owns them).
5. G3 Falling blocks, our way: a 3D well you look down into, our own piece shapes, full layers that
   crumble into sand or shatter. It must look and play differently from the famous falling-block
   game (its look is legally protected; see below).
6. G4 Paddle rally (a two-paddle warm-up; in 3D the table tilts toward you), G5 Rock blaster (blast
   drifting space rocks that split into smaller rocks and dust; real asteroid shapes from NASA's
   public-domain models; a sci-fi ship is fine), G11 Lander on real worlds (land on real terrain
   from public-domain elevation maps: the Moon first, then the owner's ask: Mars and other worlds
   with real data), G13 Pinball (real ball physics with the hands-on engine in src/physics/), then
   G8 Run across your photo, G9 Shadow puzzle, G10 Ride the song, as time allows. Mini golf waits. A
   block world (G14, G15) is a separate lane later: write down in your handoff what you learned
   about splat budgets that it would need.

#### Rules for every game

- Legal: game rules and ideas are free to use, but names, characters, art, music and a famous game's
  distinctive look are not. Every game gets its own name (never "Breakout", "Tetris", "Minecraft",
  "Pac-Man", "Snake" as a brand), its own art and sounds, no famous characters, and a look of its
  own. Note the name you pick and why in the handoff.
- Games follow real rules and things move like the real thing (CLAUDE.md, "Effect quality rules").
- Performance: aim for 60 frames a second on a computer and 30 or more on a phone at 390×844;
  measure each game in both views and report the numbers and the splat counts.
- Licenses: assets and data only under CLAUDE.md's allowed licenses, credited; a library under the
  owner's library rule (CLAUDE.md).

#### You own

`src/arcade/` (the kit), `src/packs/arcade.js` (the games), the app's play mode through your engine
PR only (`index.html`, `src/ui.js`, `src/app.js`, `styles.css`, small and additive),
`tests/arc*.spec.mjs`, `tools/arc-*.mjs`, the Arcade category line and your toys' lines in the
shared lists, and docs/handoff/Arcade.md. Import from src/worlds/, src/physics/, src/pictures.js,
src/media.js and the Space pack without editing them; if you need a change there, tell the Operator.

#### How this lane runs

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator. Don't ask him
  anything or wait for him. Put questions and blockers in your final message ("READY:", "WORKING:"
  or "BLOCKED:"); messages that arrive "From the Operator" come from the coordinator on the owner's
  behalf.
- Model: Opus 5.5 only, at the default effort; at most one helper at a time, same model.
- About twelve lanes build at once in the push: edit only your files, merge main into your branches
  whenever it moves (never rebase a pushed branch), regenerate docs/TOY-PLAN.md with
  `node tools/toy-plan.mjs` (never merge it by hand), never edit tests/taps.spec.mjs.
- Everything is behind the labs switch (`labs: true`). Old `#s=` links and saved scenes keep
  loading.
- Merging: the engine PR after a full test run; the games are labs, so the Operator merges them
  after the full run too, and the owner decides when they go public. Never merge anything yourself.
- Before each push: your own specs and the specs of files you touch (say which in the PR); the
  Integrators run the full suite. Prettier, `node tools/us-english.mjs --diff`,
  `node tools/check-packs.mjs arcade`, a contact sheet, thumbnails, screenshots
  `arc-<name>-390x844.png` and `…-1440x900.png`, then `node tools/upkeep.mjs --restore-shots`.
- Clips: post each game's play (both views and the switch) at phone size on Effect review page 2
  (https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
  (lane record `Arcade`). Then check the owner's marks about once an hour with send_later; stop once
  your PRs are merged or closed.
- Language: American English for all new text. Read first: CLAUDE.md, docs/OPERATING.md,
  docs/PACKS.md, docs/WORKSTREAMS.md, docs/handoff/Worlds.md and docs/handoff/Physics.md.
- Open your draft PRs early and push after each finished item. Splashery has no CI: don't wait for
  one. End a turn only with "READY:" or "BLOCKED:"; for a long job, schedule a check-in with
  send_later instead of going idle.

## State

(October 5, 2026; built by Opus 5.5.)

- The game kit: engine PR #283 (`claude/lane-arcade-engine`), `src/arcade/` and a four-line hook in
  `src/player.js`. Ready for its merge once the Integrator's full run passes.
- The games: PR #285 (`claude/lane-arcade`), all on the labs-only Arcade shelf:
  - G1 **Shardball**: Flat board and Dome styles. Clips are on Effect review page 2.
  - G2 **Longtail**: Cube, Planet (Mars, the Moon, Earth) and Ring worlds, with tunnels. Clips are
    on page 2.
  - G6 **Grain Garden**: falling sand in a glass box. Clip coming.
  - G7 **Page Breaker**: words and pictures from your own PDF or photo. Clip coming.
  - G3 **Strata**: falling stones in a deep well. Clip coming.
  - G4 **Volley Table**: a two-paddle rally. Clip coming.
  - G5 **Stone Belt**: real asteroid shapes from NASA. Clip coming.
  - G11 **Soft Landing**: real Moon and Mars ground from NASA. Clip coming.
- Not started: G13 Pinball, G8 Run across your photo, G9 Shadow puzzle, G10 Ride the song.

## Names

None of the names borrows a game's brand.

- **Shardball**: the ball turns bricks into shards. It isn't "Breakout", "Arkanoid" or
  "BrickBreaker", which are all product names.
- **Longtail**: a long tail of beads. It isn't "Snake", and isn't "Worms", which is a brand.
- **Grain Garden**: grains that pile and seeds that grow. It isn't "Powder Game".
- **Page Breaker**: says what it does.
- **Strata**: layers of stone. Its look is a stone well of 3D stone shapes, not the famous game's
  flat colored tetrominoes in a tall well.
- **Volley Table**: a rally on a felt table. It isn't "Pong".
- **Stone Belt**: an asteroid belt of stones. It isn't "Asteroids".
- **Soft Landing**: the goal. It isn't "Lunar Lander".

## Notes

### The game kit (src/arcade/)

- A game is a kit toy whose recipe has an `arcade` block. The player starts `src/arcade/runtime.js`
  when the toy is built (loaded only then; any other toy never loads it) and calls it every frame,
  next to the fluids. The hook in `src/player.js` is four additive lines: start, stop with the toy,
  the frame call, and the camera pose (the game says where to look).
- Splats: `layer.js` draws a game on one extra splat layer (`stage.addLayer`, the fluids' path),
  with a fixed number of slots per tier (60,000 high, 40,000 mid, 28,000 low). A game adds sprites:
  a model built once with the toy kit itself (`kitModel(k => …)`, the same shapes, colors and even
  placement as any kit toy) at a place, turn, size and fade. Each frame the CPU writes every live
  splat's center and its sprite's turn and fade (two float textures); the layer's small work-buffer
  program turns each splat by its sprite and fades it. The splats' own colors, sizes and turns are
  written once.
- Shatter: `sprites.shatter(sprite, n)` cuts a sprite's own splats into n solid cells (each splat
  goes to its nearest of n seed points inside the model), and each piece then moves and turns on its
  own; `stepPieces` gives them gravity, a floor or a sphere, side walls, a bounce, rest and a fade.
  No new splats: a brick breaks into its own splats.
- Sorting: every frame while the view moves or in 3D; every sixth frame in the still 2D view.
- The clock: fixed steps of 1/120 s, at most ten a frame (a slow frame slows the game rather than
  jumping it).
- Input (`input.js`): keys (arrows and WASD, Space or Enter, X or Shift, Q and E, P, V, R, Esc), the
  mouse and touch on the play area (a pointer the game can aim with, taps, swipes), the on-screen
  pad the game asks for (shown on touch screens), and game controllers (standard mapping). Keys go
  to the game only while it is active (tapped, or in play mode); a press anywhere else on the page
  hands them back to the app and pauses.
- The HUD (`hud.js`): the game's own stats as chips, the best score, the 2D/3D switch, pause,
  restart, the controls card, ⛶ Play (the whole page) and ✕ (leave). Its styles come with it (in the
  page's head, or in the `<splashery-toy>` element's shadow root).
- Play mode: the Fullscreen API on the page (or the element's host), else the canvas fills the
  window (iPhone Safari); everything else on the page is hidden; Esc, ✕ or the back button leaves (a
  history entry is pushed on the way in), and leaving pauses.
- The switch: V or the button. A blend from 0 to 1 over 1.1 s (smoothstep) that the game's render
  and camera read; the game's steps keep running through it. A game may also widen the camera's view
  (`fov`), put back when it leaves.
- Embeds: a game's settings are its options (`view`, `level`, `style`), so they ride in the scene
  like any toy's.

### The games' 2D/3D switches (the same rules through the change)

- **Shardball, Flat board**: one game on the board's plane. 3D tips the board back by 62° and
  deepens the bricks and rails, and the ball keeps flying throughout.
- **Shardball, Dome**: two simulations with the same rules (break the bricks, don't miss), one on
  the board and one inside a sphere. Pressing the switch hands the ball's place and heading over to
  the other one and holds the ball for the 1.1 s slide while everything else keeps moving. A
  continuous blend between a plane game and a sphere game isn't possible for the ball itself; the
  bricks, paddle and pieces do slide continuously.
- **Longtail**: one game on the world's own grid. Tiles move as solid pieces as the net folds into
  the cube (and rounds into the planet, or rolls into the ring), and the trail keeps crawling on the
  moving tiles. A screen direction picks the tile edge pointing most that way on screen, so controls
  feel the same in both views.
- **Grain Garden**: the box has depth in both views (4 to 8 grains), and 2D pours through all of it.
- **Strata**: the 3D well in both views; 2D is the side view.
- **Volley Table**: the table's plane, tilted.
- **Stone Belt**: the field's plane, with a chase camera in 3D.
- **Soft Landing**: the slice's plane, with the terrain around it in 3D.

### Splat budgets (for a block world)

- One layer of 60,000 slots (high tier) holds a whole game. The CPU writes 4 floats of center and 4
  of turn and fade per splat per frame, and uploads both textures every frame. For 40,000 splats
  that is about 1 to 3 ms of game code a frame on this machine (`stats.gameMs`), mostly the
  per-splat writes.
- Sorting 40,000 splats every frame is fine on WebGPU (the GPU sorts). On WebGL2 the CPU worker
  sorts, so sort only when the view moves; in a still view, every few frames is enough.
- A solid that reads as solid at phone size takes about 150 splats per block face area of 0.16 by
  0.16 units (Strata's stones). A block world 32 × 32 × 16 visible blocks would need its exposed
  faces only (about 2,000 to 6,000 faces), so 300,000 to 900,000 splats. That is over one layer's
  budget: it needs chunks as separate layers, faces merged into larger splats far away, and the
  GPU's own field programs (docs/lab/FIELDS.md) instead of per-splat CPU writes.
- Points (single splats placed one by one) cost the same per splat as sprites. Grain Garden holds
  22,000 grains on the high tier.

### Measurements

(To come: frame times and splat counts per game and view.)

## Known issues

- The app's status line under the brand counts the toy's own still picture (about 7k splats), not
  the game's layer.
- Effect review page 2 has no `lanes/Arcade` record yet, so the cards show under the lane's id
  "Arcade" with no title or note.
- `tools/make-thumbs.mjs` loads the app without labs, so it renders labs toys only when
  `SPLASHERY_URL` carries `?labs=1`. Its 2.5 s wait is too short for Page Breaker, whose page is
  read from a PDF, so that thumbnail was made with a longer wait.

## For the Operator

- Please make the `lanes/Arcade` record on Effect review page 2 (title "Arcade", built by Opus 5.5).
- For PACKS.md: a game recipe is a kit toy with an `arcade` block (`src/arcade/runtime.js`'s header
  lists its fields). Its own build is only a still picture for the shelf's tools.
- For the README: the Arcade shelf, and `tools/arc-clip.mjs`, `tools/arc-rocks.mjs` and
  `tools/arc-terrain.mjs`.
