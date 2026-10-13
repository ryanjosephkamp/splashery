# Moving photo: Round 3 phone review

Made by Ryan with Codex (GPT-6). This branch, `codex/moving-photo-r3-clips`, is review media only
and must never be merged. The implementation stays on PR #560's `codex/moving-photo-r2-public`
branch.

Each film compares the actual Sharp picture before (#560's immutable head) and after Round 3, side
by side. Every measured playback frame is retained at the app source's playback rate: 24 fps for
video, 10 fps for the horse GIF, and 16 fps for the prepared Sintel, Bridge, and Machine sample
frames. Those prepared samples do not contain all 24 fps of their original videos; their upload
comparisons use the original videos at 24 fps. The phone browser is 390 × 844 with device scale
factor 3; the app's low-profile stage uses its own 1.5 canvas ratio. The camera uses yaw 0.18 and
pitch 0.08. Transparent gaps are composited over white before encoding so that the background
remains visible.

The [manifest](manifest.json) records the before commit, after code hash, source hashes, exact frame
counts, frame rates, stage dimensions, movie sizes, and movie SHA-256 hashes. The films contain no
audio. They are derived 3D views of the existing source films, with comparison labels and a white
background. The source downloads remain outside Git.

| Sample or upload                    | Review film                                  |
| ----------------------------------- | -------------------------------------------- |
| Big Buck Bunny                      | [Before and after](sample-sample.webm)       |
| Race horse                          | [Before and after](horse-sample.webm)        |
| Sintel                              | [Before and after](dragon-sample.webm)       |
| Tears of Steel                      | [Before and after](bridge-sample.webm)       |
| Inside the machine                  | [Before and after](machine-sample.webm)      |
| Big Buck Bunny, long                | [Before and after](sample-long-sample.webm)  |
| Sintel, long                        | [Before and after](dragon-long-sample.webm)  |
| Inside the machine, long            | [Before and after](machine-long-sample.webm) |
| Tears of Steel, long                | [Before and after](bridge-long-sample.webm)  |
| Tears of Steel, original upload     | [Before and after](bridge-upload.webm)       |
| Inside the machine, original upload | [Before and after](machine-upload.webm)      |

These derived films retain their source licenses and credits:

- **Big Buck Bunny:** © 2008 Blender Foundation / www.bigbuckbunny.org,
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/). The long cut retains
  [CC BY 3.0 US](https://creativecommons.org/licenses/by/3.0/us/), as recorded with its existing
  source. [Source and copyright notice](https://peach.blender.org/about/).
- **Race horse:** Eadweard Muybridge, 1887, public domain.
  [Source and rights record](https://commons.wikimedia.org/wiki/File:Muybridge_race_horse_animated.gif).
- **Sintel:** © Blender Foundation, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
  [Source and copyright notice](https://durian.blender.org/about/).
- **Tears of Steel:** © Blender Foundation,
  [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
  [Source and copyright notice](https://mango.blender.org/about/).
- **Elephants Dream:** © 2006 Blender Foundation / Netherlands Media Art Institute /
  www.elephantsdream.org, [CC BY 2.5](https://creativecommons.org/licenses/by/2.5/).
  [Source and copyright notice](https://orange.blender.org/blog/creative-commons-license-2/).

All five live source pages were opened and checked again on October 13, 2026. Individual movie
records name the corresponding original file and source hash. Existing sample cuts and their
original attributions are documented in [CREDITS.md](../../../CREDITS.md).

Rule check: the existing short Tears of Steel footage includes identifiable people. Its retention
and the existing longer films follow the
[Operator's explicit confirmation on #560](https://github.com/ryanjosephkamp/splashery/pull/560#issuecomment-6130226869).
No new live-action footage is introduced, and this branch is never merged.
