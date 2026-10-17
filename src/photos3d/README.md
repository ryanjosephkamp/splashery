# Photos to 3D labs API

This experimental module is not a shelf entry. It imports the existing Splat.js SIFT, geometry,
bundle adjustment, and trainer, plus Video to 3D's budgets, refinement schedule, and surface seeder.
Those modules are unchanged. All photographs remain in the caller's browser tab.

```js
import { solvePhotos, seedPhotos } from "./run.js";
const solution = await solvePhotos(files, {
  profile: "phone", // 960-pixel features; desktop uses 1600, or explicitly 1280.
  assumeSingleLens: true, // Explicit assumption for one fixed camera/lens capture without EXIF.
  onProgress: console.log,
  signal: controller.signal,
});
// solution.graph reports all pairs, components, support, and registration reasons.
// solution.rejected reports decoder and lens-group rejections.
if (!solution.recon) throw new Error(solution.error);
const { session } = await seedPhotos(solution, { signal: controller.signal });
const camera = session.view.lookThrough(0);
canvas.width = camera.w;
canvas.height = camera.h;
session.view.attach(canvas);
session.start();
// Stop and keep the current result:
session.pause();
await session.finish();
const ply = await session.exportPlyBlob();
session.dispose();
```

The picker supplies 8–60 uniquely named files. Browser decoding applies EXIF orientation. EXIF 35
mm-equivalent focal lengths calibrate each accepted photo independently. The supported group
contains one camera and a focal range of at most 10%; every incompatible or missing focal receives a
rejection reason. `focal35` supplies a known manual calibration when EXIF is absent. A completely
uncalibrated set needs the explicit `assumeSingleLens: true` option; its shared focal is searched,
and distortion is not estimated. Physical EXIF focal lengths identify compatible lens groups even
when sensor dimensions are unknown. Manual calibration does not suppress contradictory physical lens
metadata. The assumptions and rejections are returned in the lens diagnostics.

Matching proposes every pair, up to 1,770, with identical geometric thresholds regardless of picker
order. Names are canonicalized before feature extraction and seeded numeric work. SIFT uses its
existing upsampled octave and an area-scaled feature budget. Each accepted pair needs at least 25
essential-matrix inliers and 40% consensus. Conflicted feature tracks are discarded. Incremental
registration, triangulation, and normalized fixed-intrinsics bundle adjustment use the unchanged
vendored math. Disconnected or unsupported photos receive no guessed camera.

For independent appearance evaluation, pass `heldOut: [name]` to `seedPhotos`. Geometry may use all
photos' grayscale, as the task's solved-camera protocol permits. Sparse colors are then rebuilt from
at least two training observations. Held-out RGB, masks, and cameras are absent from surface
seeding, hull filtering, GPU target upload, loss, and environment fitting. Every fold starts a new
trainer. The photo split disables the Session's additional automatic holdout and video-specific blur
exclusions; every remaining registered photo trains, and disabled blur exclusions are reported.
`signal` cancels seeding; after it returns, the caller owns cancellation through
`session.dispose()`. Dispose the session after exporting or evaluating it. Render free cameras
within the tier's training-side dimensions (320 on a phone and 720 on desktop), and match the canvas
dimensions to the camera. The seed allocates output buffers for that budget.

The module has no upload path, persistent storage, production UI, or acceptance claim. See the task
104 audit and its round-two evidence for measured limits.
