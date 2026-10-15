# Completed-model constant environment fit

This is an opt-in three-parameter least-squares fit from the completed model’s raw RGBA
and actual packed, undistorted training targets. Every eligible valid training pixel participates.
Internal holdout, evaluation, blur-excluded, and non-loss cameras never enter the fit. Targets
remain available through an opt-in GPU copy flag after low-memory CPU RGB release.

The product accepts at least a 1% pooled training MSE reduction and no MSE increase on any
existing internal validation camera. Rejection retains black. Accepted display color uses
`renderBackground`; training stays black, and its recorded PSNR remains separate.
No external corpus-held-out picture enters fitting. This adds no geometry or detailed imagery.

Thirty-five combined engine/resource checks passed, including a real-WebGPU accepted and rejected
validation case. Four later CPU checks cover direct preview ownership and cancellation cleanup.
Eighteen product background/progress/deadline/training-hold checks passed. The exact frozen R10
source also passed the real-WebGPU fixture again. This verifies packed targets after CPU RGB
cleanup, excluded cameras, invalid pixels, and unchanged model parameter bytes. Synthetic fixtures
are original CC0; authored code is MIT. Existing library notices remain authoritative.

These checks do not establish corpus SSIM, native bake timing, phone performance, or the task goal.
The separate cached-input experiment retains its failed validation gate; it is not a replacement
for a native corpus result. See receipt.json for exact source and test chronology.
