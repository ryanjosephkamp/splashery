# GPU novel-view measurement review

October 17, 2026. Read-only production review; all diagnostic output stays in this directory.

The first captured frame applies the settled shell offset correctly. The poor first-view truth
control was caused by an unsettled camera field of view, rather than a stale part transform.

The measurement tool calls `chooseToy`, which sets the new camera with `snap:false`. It then sets
current/target yaw and pitch and advances the recipe's movement smoothing 160 times. Those calls do
not advance the orbit camera's distance smoothing. The inside camera computes its field of view as
`72 * cur.distance / home.distance`, so the previous toy's distance can change the captured field of
view.

The actual WebGL2 diagnostic used the arches panorama and exact radial truth through the same sample
response routes and 16-bit depth cache as the GPU evaluator. The buffer was fixed at 256×256, with
device scale factor1. Before its first capture, camera distance was4.4030 and home distance3.4,
corresponding to93.2405° before the next normal camera update.

| Capture                                              | Rendered field of view | Masked SSIM against the0.3m Blender view |
| ---------------------------------------------------- | ---------------------: | ---------------------------------------: |
| First, measurement tool's original camera handling   |               77.5989° |                                  0.16466 |
| Second, unchanged camera targets                     |               73.4759° |                                  0.34566 |
| First after snapping current/target distance to home |                    72° |                                  0.44102 |
| Second at the same snapped pose                      |                    72° |                                  0.44102 |

The0.44102 result is close to the software truth-projection control of approximately0.458. Source
image noise, sampling, and Gaussian rendering can account for the remaining difference; this
diagnostic does not isolate each contribution.

The part's packed and uploaded uniform offset changed from0 to0.3000000119 on the first captured
frame. At fixed72° FOV, consecutive first/second captures were byte-identical for the 0.3m offset,
center reset, and0.8m offset. The center reset's first frame had packed offset0; the0.8m move's
first frame had packed offset0.8000000119. There is no observed one-frame part staleness in these
cases.

Camera position was[0,0,0], yaw/pitch/roll were zero, target and offset were zero, and the frame
radius was1. Camera right is-X; a positive shell X translation therefore correctly represents the
requested positive Blender-local-right camera displacement. The fixed square buffer makes the
stage's72° narrower-side field of view agree with the Blender reference's72° field of view. No
additional offset, unit, or orientation mismatch was found.

Before rerunning GPU scores, snap the complete comparison camera pose, including current and target
distance/roll, or wait for all camera state to settle. Check both `camera.pose().fov` and the stage
camera field of view at capture. Recording only the requested shell offset does not prove the camera
matches the held-out reference.

`gpu-frame-review.mjs` preserves the reproduction. Its JSON records snapshots before and after each
capture, packed part data, uploaded uniform values, update/postrender traces, and image differences.
The eight `gpu-frame-*.jpg` files preserve the images. No inference or production renderer code was
mocked.
