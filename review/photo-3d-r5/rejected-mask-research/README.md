# Rejected foreground-mask research

These three phone-size clips show the **rejected two-pixel mask prototype** beside the protected
checkpoint. The retained round 5 runtime does not include this prototype. This folder is separate
from the 54 retained-runtime review videos and their zero-difference result. The experimental mask
was implemented only for the captured WebGL path.

Each video has 72 actual native frame pairs at 12 fps, with four camera arcs through 30 degrees,
Sharp enabled, Depth 0.5, and a 585 × 1266 native buffer per side. The encoded pair is 780 × 844.
The video overlay labels the prototype as rejected. Source images keep their original labels and
credits in [the main credit record](../CREDITS.md).

| Input           | Clip                                        | Why it is here                                                                                         |
| --------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Forest          | [Watch](forest-sharp-before-after.mp4)      | Its atlas phone ribbon score fell by 7.26%, without another measured quality regression on this input. |
| Street          | [Watch](street-sharp-before-after.mp4)      | Its atlas phone ribbon score fell by 43.73%, and texture loss also improved.                           |
| AI-made library | [Watch](dot-library-sharp-before-after.mp4) | Boundary color error increased from 0.18480 to 0.18741. This counterexample cut the prototype.         |

These are bounded quality observations at the atlas's nine poses, not full-corpus or phone-cost
acceptance. The videos add intermediate poses for review. They do not authorize a per-input model
switch or relax any original threshold.

[Independent verification](integrity.json) checks every encoded file hash, dimensions, duration,
frame rate, frame count, and both source-build hashes. [Recording metadata](recording.json) records
all native frame-pair comparisons. The gzip copy preserves the exact original recording JSON bytes;
its uncompressed SHA-256 is recorded in the integrity proof. Method and prototype sources use `.txt`
archive extensions to preserve the captured bytes during formatting.

Made by Ryan with Codex (GPT-6). Original recording work is CC0 1.0, subject to each source image's
license. No model weights, new photo, or accepted runtime change is included.
