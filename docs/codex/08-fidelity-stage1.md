# Codex task 08: the boombox, trained (Splat Fidelity Plan, Stage 1)

**Branch:** `codex/fidelity-stage1`, cut from `main`. **Runs on:** the owner's Mac (Apple Silicon:
the M5 Pro with 64 GB if it's set up, else the M3 Pro). **Output, and nothing else:**

- `tools/fidelity/stage1/` — your scripts (a Blender Python render script, a runner shell script, a
  README with the exact commands);
- `assets/toys/boombox-trained/boombox-trained.sog` (at most 15 MB) and `boombox-trained-lite.sog`
  (at most 5 MB);
- `docs/audits/fidelity-stage1.md` and its images and data in `docs/audits/fidelity-stage1/`.

Don't commit the renders or the uncompressed PLY files (too big). Keep them on the Mac in
`~/splashery-fidelity/stage1/` and say in the report where they are.

## Why

Our boombox toy comes from the CC0 Poly Haven model `boombox` (`tools/models.json`, entry
`boombox`). We turned it into splats by sampling its surface and painting light on by rule
(`tools/model-to-splats.mjs`), so it looks flat next to the scenes on superspl.at, which are
_trained_: an optimizer fits splats to hundreds of path-traced views. This task makes the same model
the trained way, so the only difference is the method. Read `docs/handoff/Fidelity.md` (the brief of
the Claude lane that builds the Splashery side) for the whole plan.

## Steps

1. **The machine.** Record macOS version, chip, memory and free disk (you need about 20 GB). Keep
   the Mac awake while you work (`caffeinate -dimsu` in a second terminal).
2. **The tools.** Record each tool's version, license and where it came from, for the report and for
   `LICENSES.md` (the Claude lane adds them there).
   - **Blender**: use `/Applications/Blender.app/Contents/MacOS/Blender` if it's there (the owner
     installs it from blender.org); otherwise install it with Homebrew
     (`brew install --cask blender`). Render with Cycles on the GPU (Metal).
   - **A trainer**, in this order of preference:
     1. Brush (https://github.com/ArthurBrussee/brush, Apache-2.0): a macOS release build if one
        exists, else build it as its README says.
     2. msplat (https://github.com/rayanht/msplat, Apache-2.0, Apple Silicon).
     3. OpenSplat (AGPL, Metal), which needs a starting point cloud.

     Say which one you used and why.

   - **splat-transform**: the repo's pinned devDependency (`npm ci`, then
     `npx splat-transform --help`). Actions go after the input file (see the notes in
     `docs/handoff/Photoreal.md`).

3. **The model.** Download the Poly Haven `boombox` at the highest resolution offered
   (https://polyhaven.com/a/boombox; the API is `https://api.polyhaven.com/files/boombox`). Check
   that the page still says CC0.
4. **Render.** In Blender, from a script:
   - center the model and scale it to fit a unit sphere;
   - light it with one soft studio HDRI from Poly Haven (CC0; name it in the report) and nothing
     else;
   - use a transparent background (RGBA PNG);
   - render 200 training views at 1024×1024 on a sphere around it (a Fibonacci spiral, including
     views from below, because the toy turns), plus 25 held-out test views at other positions;
   - use 256 samples with denoising, or fewer if the time per view is long (say what you used);
   - write `transforms_train.json` and `transforms_test.json` in the NeRF-synthetic format
     (`camera_angle_x`, `frames[].file_path`, `frames[].transform_matrix`, Blender's camera-to-world
     convention);
   - also write `points3d.ply`, a few hundred thousand points sampled from the mesh surface with
     their texture colors, for trainers that want a starting cloud.
5. **Train** about 30,000 steps with spherical harmonics up to degree 3. Aim for 0.5 to 1 million
   splats. If the trainer can use the alpha channel, use it; if not, composite on one solid color
   and remove the background splats afterwards. Record the training time.
6. **Measure** on the 25 held-out views: PSNR and SSIM (say how you computed them: the trainer's own
   evaluation, or your own render of the trained splat at those cameras).
7. **Compress** with splat-transform:
   - a full SOG with the SH bands (at most 15 MB);
   - a lite SOG with fewer splats and fewer or no SH bands (at most 5 MB).

   Remove stray splats (floaters) first. Center and orient it like the current toy
   (`assets/toys/boombox/boombox.sog`).

8. **Compare.** Render the current `boombox.sog` and the new full and lite files from the same six
   angles at 1024×1024 with the same framing. Use `tools/splat-views.mjs` if it takes any SOG (read
   it first), or a scratch page with the vendored PlayCanvas. Save them as side-by-side PNGs. Add
   one held-out Blender render beside its trained counterpart.
9. **Report** in `docs/audits/fidelity-stage1.md`. Start with a summary of at most ten lines, then:
   - the machine and tool versions;
   - every setting;
   - the times (render, train, compress);
   - splats and megabytes for each file;
   - PSNR and SSIM;
   - the side-by-side images;
   - what went wrong and how you fixed it;
   - a section "What from the Splashery repo helped", listing what you used and whether it saved
     time or improved the result (for example the models.json entry, the existing mesh tools,
     splat-transform, `splat-views.mjs`, the phone budgets in `src/generators.js`). Say so plainly
     if nothing helped;
   - recommendations for Stage 2 (the brass orrery, trained part by part): resolution, view count,
     steps, splat budget per part, and how long a part takes.

Run `npx prettier --check docs/audits/fidelity-stage1.md tools/fidelity` and
`node tools/us-english.mjs --diff` before you push. Open one draft pull request, "Fidelity Stage 1:
the boombox, trained (Codex)", with the five sections AGENTS.md names.
