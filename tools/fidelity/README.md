# Fidelity tools: trained splats on our rigs

Lane Fidelity's build tools for the Splat Fidelity Plan (approved October 3, 2026). Stage 2 is a
brass orrery, built in Blender from scratch, rendered part by part, and trained part by part, so
every moving piece is its own splat file that turns as a solid part on the kit's rig
(`src/packs/fidelity.js`). Nothing here is shipped; the site only loads what `pack` writes into
`assets/toys/orrery/`.

| File              | What it does                                                                      |
| ----------------- | --------------------------------------------------------------------------------- |
| `orrery.py`       | Blender script: builds the orrery, renders every part and the whole (datasets)    |
| `run-orrery.sh`   | The runner: `render`, `train` (Brush), `pack` (splat-transform) and `measure`     |
| `measure.mjs`     | PSNR and SSIM of a splat file against the held-out renders, with side-by-sides    |
| `measure.html`    | The page `measure.mjs` renders in (the vendored PlayCanvas, no Splashery effects) |
| `summary.mjs`     | One Markdown table from a run: times, splats, megabytes, PSNR and SSIM            |
| `stand-in.mjs`    | Fake "trained" splats from a dataset's points, to test the pipeline (no trainer)  |
| `stage1/` (Codex) | Task 08's scripts for the boombox (on `codex/fidelity-stage1`)                    |

## The orrery

A turned wooden plinth with a brass band and four feet, a brass drum, a steel column and a glowing
sun on top. Six arms turn about the column at their own heights, each a brass sleeve, a bar out to
its orbit, a steel post and a planet: Mercury and Mars in stone, Venus, Earth, Jupiter and Saturn in
glossy enamel (Saturn with a brass ring), and a stone moon on its own small arm on Earth's post. Two
brass gears turn on the plinth. Eleven parts in all: `base`, `gear-a`, `gear-b`, `sun`, `mercury`,
`venus`, `earth`, `moon`, `mars`, `jupiter` and `saturn`.

The geometry and the brass, enamel and glow materials are procedural and ours (CC0). From Poly Haven
(all CC0, each license checked on its live page on October 3, 2026):

- HDRI "Studio Small 09" by Sergej Majboroda, https://polyhaven.com/a/studio_small_09
- Texture "Dark Wood" by Dario Barresi, Dimitrios Savva and Rico Cilliers (the plinth),
  https://polyhaven.com/a/dark_wood
- Texture "Rock Surface" by Amal Kumar (Mercury, Mars and the moon),
  https://polyhaven.com/a/rock_surface

`orrery.py` downloads them once (2K) into `~/splashery-fidelity/cache`.

**Light.** The HDRI at 0.9 and an 18 W point light inside the sun. Every part is rendered with the
other parts hidden, so no part carries another's shadow (it would be wrong once they turn). The
sun's light stays on for every part, so a planet's lit side faces the sun, and keeps facing it as
its arm turns around the sun. The view transform is "Standard" (display sRGB, as the trainer and the
browser expect), not AgX.

**Datasets.** For each part, and for the whole orrery (`whole`, to compare one-piece training with
part-by-part training), `orrery.py` writes NeRF-synthetic data:

- `train/r_NNN.png` (200 views) and `test/r_NNN.png` (25 held-out views): RGBA PNGs with a
  transparent background, from cameras on a Fibonacci sphere around the part (views from below too,
  since the toy turns), framed to the part's bounding sphere with a 40° field of view. The test
  views sit on a second spiral, between the training views.
- `transforms_train.json` and `transforms_test.json`: `camera_angle_x` and, per frame, `file_path`
  (no extension, as in the NeRF-synthetic sets) and `transform_matrix` (Blender's camera-to-world;
  the camera looks down its −z with y up).
- `points3d.ply`: 200,000 surface points with their material's color, for trainers that start from a
  cloud.

All parts share Blender's world frame (z up, meters), so the trained parts fit together with no
registration. `parts.json` (in the output folder) lists every part with its pivot and axis in our
coordinates (y up: Blender's `(x, y, z)` is our `(x, z, −y)`), each arm's seconds per turn, the
settings, the render times and each dataset's bounding sphere.

## On the Mac (Codex task 10)

About 25 GB of free disk. Keep the Mac awake while it runs (`caffeinate -dimsu` in a second
terminal).

1. **Blender 4.5 LTS** from https://www.blender.org/download/lts/ (GPL-3.0-or-later; the owner
   installs it, or `brew install --cask blender`). The runner expects
   `/Applications/Blender.app/Contents/MacOS/Blender`; set `BLENDER=...` otherwise. Cycles renders
   on the GPU through Metal.
2. **Brush** (Apache-2.0), https://github.com/ArthurBrussee/brush: a macOS release build, or built
   with `cargo build --release` as its README says. Put `brush` on the `PATH`, or set `BRUSH=...`.
   Check `brush --help`: the runner passes `--total-train-iters`, `--sh-degree`, `--max-splats`,
   `--export-every`, `--eval-every`, `--eval-save-to-disk`, `--export-path` and `--export-name` (the
   flags in Brush's source on October 3, 2026). If a flag has changed, fix it in `run-orrery.sh` and
   say so in the report. Brush reads the transparent PNGs' alpha and fits the splat's transparency
   to it.
3. In the repo: `npm ci`.
4. **A short test first** (a few minutes), to check the tools and the frame before the long run:

   ```sh
   RES=256 TRAIN=40 TEST=5 SAMPLES=32 STEPS=3000 tools/fidelity/run-orrery.sh render earth
   STEPS=3000 tools/fidelity/run-orrery.sh train earth
   tools/fidelity/run-orrery.sh pack earth
   tools/fidelity/run-orrery.sh measure earth
   ```

   `measure` prints PSNR per held-out view. Above about 25 dB means the trainer kept Blender's
   frame. If it is near 10 dB, open `~/splashery-fidelity/orrery/measure/earth/side-00.png` (render
   on the left, splat on the right): the splat is turned or mirrored, so the trainer changed the
   frame. Report what you see; the fix is the `-r 90,0,0` in `pack`.

5. **The full run** (render about 2 to 3 hours, training about 15 minutes a part):

   ```sh
   tools/fidelity/run-orrery.sh all
   ```

   Steps can be run one at a time (`render`, `train`, `pack`, `measure`) and for some parts only
   (`tools/fidelity/run-orrery.sh train earth moon`). Settings are environment variables listed at
   the top of `run-orrery.sh` (resolution, views, samples, steps, SH degree, splat budgets).

6. **What to push** (to the Codex branch, not the renders):
   - `assets/toys/orrery/`: `parts.json` and every part's `<part>.sog` and `<part>-lite.sog`
     (written by `pack`);
   - `~/splashery-fidelity/orrery/summary.md` (written by `measure`) and a few side-by-sides from
     `~/splashery-fidelity/orrery/measure/*/side-*.png`, in `docs/audits/fidelity-stage2/`;
   - the times, the machine and the tool versions, in `docs/audits/fidelity-stage2.md`.

   Keep the renders, the trained PLY files and `orrery.blend` on the Mac in
   `~/splashery-fidelity/orrery/`.

## What `pack` writes

For each part, the trained PLY is cleaned (splats outside the part's bounding sphere, enlarged by 12
%, are dropped; splat-transform's filters work in PlayCanvas's space, the file turned 180° about z,
so the runner flips the sphere's center), turned to our frame (`-r 90,0,0`: Blender's `(x, y, z)`
becomes `(x, z, −y)`), and saved twice for the toy without SH bands (the kit keeps only a splat's
base color): `<part>.sog` and `<part>-lite.sog`. The toy's whole budget (`FULL`, 400,000 splats;
`LITE`, 110,000) is shared among the parts by their trained counts. `<part>-sh.sog` (with SH, kept
in the work folder) measures what the bands add. The whole orrery is packed with and without SH
(`whole.sog`, `whole-nosh.sog`) for the comparison.

## Testing here, without a Mac

Blender runs on the CPU in the cloud sandbox (download the Linux build from
https://download.blender.org/release/Blender4.5/), and `stand-in.mjs` takes the trainer's place:

```sh
cat > /tmp/fake-brush <<'EOF'
#!/usr/bin/env bash
data="$1"; shift
while [ $# -gt 0 ]; do case "$1" in --export-path) p="$2"; shift;; --export-name) n="$2"; shift;; esac; shift; done
node tools/fidelity/stand-in.mjs "$data/points3d.ply" "$p/$n" --size=0.0015
EOF
chmod +x /tmp/fake-brush
export BLENDER=.../blender BRUSH=/tmp/fake-brush DEVICE=CPU ST_ARGS="-g cpu" WORK=/tmp/orrery
RES=128 TRAIN=2 TEST=3 SAMPLES=8 tools/fidelity/run-orrery.sh render
tools/fidelity/run-orrery.sh train && tools/fidelity/run-orrery.sh pack
```

`orrery.py --quick` is a 30-second check of the script alone (96 px, 8 + 2 views).
