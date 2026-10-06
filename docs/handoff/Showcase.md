# Lane Showcase: a reel of what splats and recipes can do (prefix `shw`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Showcase (id `Showcase`, prefix `shw`).
Branch: `claude/lane-showcase` (and `claude/lane-showcase-engine` for any change to the app outside
your own files, as an "Engine: …" PR merged first). PR title: "Phase Showcase: a reel of what splats
and recipes can do". Handoff file: docs/handoff/Showcase.md (create it; start it with this brief,
word for word, under "## Brief", then keep "## State

WORKING (October 6, 2026): the page, playlist, facts tool, stills tool, video tool and tests are
written; tuning scenes at phone size, then the full checks, the clips and the videos.

## The picks

Every scene comes from a card the owner marked "good" on Effect review page 1 or 2 that has not been
replaced by a newer card (checked against both pages' `verdicts` and `cards` on October 6, 2026).

| Chapter                                     | Scene            | Toy                  | Card                      |
| ------------------------------------------- | ---------------- | -------------------- | ------------------------- |
| 1. Things that come apart                   | `grapes`         | `grapes`             | `e5-grapes`               |
| 1. Things that come apart                   | `orange`         | `orange`             | `shb-orange-tap`          |
| 1. Things that come apart                   | `watermelon`     | `watermelon`         | `e5-watermelon`           |
| 1. Things that come apart                   | `pizza`          | `pizza`              | `shb-pizza-tap-r2`        |
| 2. Instruments that are played              | `grand-piano`    | `grand-piano`        | `pno-grand-song-r3`       |
| 2. Instruments that are played              | `guitar`         | `guitar`             | `fx6-guitar`              |
| 2. Instruments that are played              | `xylophone`      | `xylophone`          | `fb-xylophone`            |
| 2. Instruments that are played              | `music-box`      | `music-box`          | `sha-music-box-tap`       |
| 3. Real data and real captures              | `real-moon`      | `real-moon`          | `sp2-real-moon-r2`        |
| 3. Real data and real captures              | `galaxy-box`     | `galaxy-box`         | `sci-galaxy-r4`           |
| 3. Real data and real captures              | `microscope`     | `smlm-microscope`    | `sci-microscope-r3`       |
| 3. Real data and real captures              | `st-helens`      | `st-helens`          | `geo-st-helens-r4`        |
| 3. Real data and real captures              | `cryoem`         | `cryoem-map`         | `sci3-cryoem-capsid-r4`   |
| 4. Your own files, turned 3D on your device | `photo-3d`       | `photo-3d`           | `p3d-sample-r2`           |
| 4. Your own files, turned 3D on your device | `moving-photo`   | `moving-photo-3d`    | `smd-r2-moving-horse`     |
| 4. Your own files, turned 3D on your device | `your-book`      | `your-book`          | `bk-book-taps-r2`         |
| 4. Your own files, turned 3D on your device | `model-splats`   | `model-splats`       | `stm-sample`              |
| 5. Science you can check                    | `chladni`        | `chladni-plate`      | `sts-chladni-r2`          |
| 5. Science you can check                    | `prism`          | `light-lab`          | `sll-light-lab-prism-r3`  |
| 5. Science you can check                    | `ripple-tank`    | `ripple-tank`        | `opt-ripple-double-p1`    |
| 5. Science you can check                    | `fourier`        | `fourier-circles`    | `math-fourier-circles-r2` |
| 5. Science you can check                    | `newtons-cradle` | `newtons-cradle`     | `fa-newtons-cradle`       |
| 6. Recipes: tiny, editable, any size        | `training`       | `gaussian-splatting` | `scr-splat-training`      |
| 6. Recipes: tiny, editable, any size        | `equation`       | `splat-equation`     | `man-equation-play`       |
| 6. Recipes: tiny, editable, any size        | `neural-network` | `neural-network`     | `ai-neural-network-sizes` |
| 6. Recipes: tiny, editable, any size        | `qr-code`        | `qr-code`            | `qr-classic-burst`        |
| 6. Recipes: tiny, editable, any size        | `splat-field`    | `splat-field`        | `lab-field-galaxy`        |

## Notes

- The page is `showcase/index.html` (labs; not linked from the homepage). Its code and styles are in
  `src/showcase/` (`reel.js`, `showcase.css`), the scenes and their words in
  `src/showcase/playlist.json`, and the numbers the captions quote in `src/showcase/facts.json`.
- One player plays every scene (one WebGL context): each scene builds its toy on the device with
  `Player.loadToy`, as the embed does, so nothing is prerecorded. The next scene's recipe file is
  fetched while the current one plays.
- The numbers line under each caption is measured: splats built, the seconds it took and the bytes
  fetched for that scene are measured live on the viewer's device; the recipe file's compressed size
  and how many toys share it come from `node tools/shw-facts.mjs` (the test fails if facts.json is
  out of date).
- Playlist fields: `toy`, `card`, `what`, `why`, `secs`, and optionally `options` (the toy's
  options), `controls` (starting control values), `zoom` (a camera distance factor), `turntable`,
  and `steps`: `{ at, do: "tap" }`, `{ at, do: "fire", key }` (a named control),
  `{ at, do: "zoom", by, over }`, `{ at, do: "turn", by, over }` (radians) and
  `{ at, do: "slide", key, to, over }` (a slider control). With no `steps`, the scene taps once at
  0.6 s. `{depthModelMB}` and the other facts.json keys can be used in the words.
- The page adds `?labs=1` to its own address when it is missing, as the Worlds link does: the
  cryo-EM cut and the splat field's motion run only with the labs switch on.
- Tools: `tools/shw-shots.mjs` (stills of every scene, build times, whether each caption fits) and
  `tools/shw-video.mjs` (the reel as MP4 at 390×844 and 1440×900, the clock stepped by hand).

## Known issues

## For the Operator
