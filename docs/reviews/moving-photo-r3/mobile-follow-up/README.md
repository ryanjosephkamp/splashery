# Android sample-switch follow-up

Made by Ryan with Codex (GPT-6), October 14, 2026. This is evidence on the unmerged
`codex/moving-photo-r3-clips` review branch.

The
[Operator's report](https://github.com/ryanjosephkamp/splashery/pull/560#issuecomment-6157456045)
was reproduced at 390×844, device scale factor 3, with an Android Chrome user agent and page CPU
slowdown 4. On current main, choosing Machine after Bunny retains the bunny picture. On the PR
branch, Machine shows its own picture.

- [Main: Machine selected, Bunny still pictured](main-machine-shows-bunny.png)
- [PR branch: Machine selected and pictured](branch-machine.png)

The branch image is captured after the delayed Sintel sheet completes, with Machine selected.
[Mobile regression records](mobile-regression.json) retain all nine samples, four repeated changes,
and the delayed-load result in each emulated browser mode. Each selected sample must show its own
pixels in the actual bound color texture. These are desktop Chromium emulations; page CPU slowdown
does not throttle the worker, and the low-tier canvas stays capped at DPR1.5.

The images include the existing app UI and public sample footage. The Bunny image retains Blender
Foundation / www.bigbuckbunny.org's [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/), with
its [source and copyright notice](https://peach.blender.org/about/). The Machine image retains
Blender Foundation / Netherlands Media Art Institute / www.elephantsdream.org's
[CC BY 2.5](https://creativecommons.org/licenses/by/2.5/), with its
[source and copyright notice](https://orange.blender.org/blog/creative-commons-license-2/).
Modifications: existing source footage rendered as a 3D relief and captured with the app controls
visible. These sources and credits remain those already recorded for the samples.

[Original spec hashes](source-and-original-specs.json) verify all 167 original cases in 16 files
remain byte-identical to the prior PR head.

[Manifest](manifest.json) records code versions, profile, image sizes, and checksums. The
`main-switch.json` and `branch-switch.json` records describe the actual texture sources. Playback
records check frame/depth correspondence during two 12-second clips. Those probes used contended
software rendering and do not certify physical Android or Brave smoothness. Headless SwiftShader
captured the main image; ANGLE/Mesa llvmpipe captured the branch image.

[Task-suite ledger](task-suite.json): all 199 cases pass in one serial run (47.30 minutes), with
zero failures, skips, or configured retries. A repository-wide invocation was interrupted by a
workspace restart at case 112/2,256 and is not certified complete.

Rule check: existing public sample footage and app UI only. This media branch remains unmerged.
