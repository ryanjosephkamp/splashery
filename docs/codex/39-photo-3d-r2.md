# Codex task 39: Photo to 3D with no gaps

**Branch:** `codex/photo-3d-r2`, cut from `main`. One of five Studio tasks (37 to 41) running at the
same time.

**You may change:** `src/packs/photo-3d.js`, `src/packs/photo-3d-core.js`, `src/photo-splats.js`,
`src/live/relief-mesh.js`, `src/live/relief-height.js`, and `src/packs/photo-sharp.js` **except**
its clip path (`sharpClip`, `fillClip` and helpers only they use, which belong to task 38); new
`src/photo3d/` modules, new `tools/cdx-p3d2-*.mjs`, new `tests/cdx-p3d2*.spec.mjs`, and a report at
`docs/audits/photo-3d-r2-2026-10.md`. Task 37 owns the depth model (`src/packs/photo-3d-depth.js`,
`src/live/depth-worker.js`): call it, don't change it. Changes to `relief-mesh.js` also reach Moving
photo's Sharp view; keep its tests green.

## What the owner sees (his walkthrough of October 11, 2026, in the Operator's words)

Photo to 3D has visible gaps in both views, the Sharp view (a textured relief) and the Splats view,
at every depth setting he tried, on the samples and on his own photos. He finds the Splats view
often looks better than the Sharp one. He wants it seamless: turn the photo and it holds together
like a real 3D scene, with nothing torn or missing, and as fast as it can be.

Known issues from earlier lanes (docs/handoff/Photo3D.md, PhotoSharpView.md, PhotoDepth.md): gaps
behind near objects (nothing is known about what's hidden there), no anti-aliasing on relief edges,
a thin background ribbon along edges, text bending a little.

## Steps

1. **Measure first.** `tools/cdx-p3d2-measure.mjs`: for each of the 36 samples (6 photos and 30 AI
   samples), in both views at three depth settings, render the toy turned left, right, up and down
   (for example 10, 20 and 30 degrees) at 390x844 and count:
   - **holes:** pixels showing the clear color or the backing where the photo should be;
   - **tears:** long stretched triangles or splats along depth edges;
   - **sharpness:** keep `tools/phf-measure.mjs`'s numbers (SSIM, text stroke gaps) from getting
     worse. Save the "before" table and a contact sheet of the worst views.
2. **Fill what's hidden.** At each depth edge, the far side needs real content behind the near
   object. Build a back layer (a layered depth image): extend the background's depth under the near
   object and fill its color from the nearby background (a depth-aware fill, guided by edges, with
   no blur where it shows). Use it in both views: the Sharp view cuts the mesh at depth edges and
   shows the back layer through the cut; the Splats view adds back-layer splats behind the cut.
3. **Clean edges.** Anti-alias relief edges, remove the background ribbon, keep text flat (planar
   regions stay planar), and size splats along the depth slope so splats don't leave gaps when
   turned.
4. **Fast.** The first view appears quickly and refines; no step blocks the page for more than 200
   ms (task 37 moves the model itself off the main thread).
5. **Measure again.** The goal: holes and tears at least 80% fewer at 20 degrees on every sample,
   with no loss of sharpness.
6. **Tests.** `tests/cdx-p3d2*.spec.mjs` with the hole and tear thresholds from step 5 on three
   samples, in both views. Keep green: `p3d`, `psv`, `psv2`, `psv3`, `phf`, `phf2`, `phf-engine`,
   `pdp`, `pdp-engine`, `smd-photo`, `smd-compare`, `dsm-samples`, `lv8-dial`, and Moving photo's
   `smd-moving` and `live3`.
7. **Report.** `docs/audits/photo-3d-r2-2026-10.md`: before-and-after tables, contact sheets, what
   changed and why, what didn't help, and clips of three samples turning in each view at 390x844
   (`tools/p3d-clip.mjs` or `tools/psv-clip.mjs`) in the PR.

Before you push, run `npx prettier --check .` and `node tools/us-english.mjs --diff`. Open a draft
PR titled "Codex task 39: Photo to 3D with no gaps" with the five sections from CLAUDE.md and a
"Rule check" line (`builders/RULES.md`).
