# Photo to 3D: a ranked failure atlas

Codex (GPT-6) built a local failure finder for [task 87](../codex/87-photo-3d-failure-gallery.md).
The toy is unchanged: no edits under `src/`, `assets/`, or `vendor/`. The
[gallery and compressed records](https://github.com/ryanjosephkamp/splashery/tree/codex/photo-3d-failures-clips/review/photo-3d-failures)
are on the separate clips branch, never merged.

**Complete: 118 inputs, 236 input/profile builds, and 2,124 color views**, plus independent mask and
UV passes. The final run has 0 failed capture attempts, zero unresolved capture errors, and no
browser errors or external resource requests. All 10,620 saved native-artifact hashes and 118
source-photo hashes were checked. This is a baseline atlas, not a reconstruction improvement or a
checkpoint speedup claim.

All supported revealed-area hole scores are **zero**; this does not prove coverage outside the
sampled, inset candidate regions. Visible pale bands can be covered fill colors. Held-out
source-model AbsRel spans **1.92–13.18%** on the 12 reference scenes, identically at both profiles.
Half exceed a stricter exploratory 5% level; none reaches the gallery’s 20% flag. Image-cue warnings
on the other 106 inputs are not ground truth.

The phone cost summary below has one fresh-browser observation per input. Medians describe different
inputs, not repeated latency trials. Full phone and desktop rows remain in the gallery and raw
records.

| Phone input path                 | First 3D: median (range), s | Process PSS: median / maximum, MiB |
| -------------------------------- | --------------------------: | ---------------------------------: |
| 76 built-in/hard-case selections |            1.81 (1.46–4.33) |                          817 / 863 |
| 12 reference files               |            4.31 (3.98–5.06) |                        1116 / 1174 |
| 30 added photo files             |            4.99 (3.93–6.98) |                        1206 / 1316 |

Numerical capture: `216c34dd05ed0482ec43a896590d94d22233e68a`, main `ea35f3de` after round 4 merged.
[Coverage and integrity proof](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/verification/validation.json),
[machine-readable baseline](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/verification/baseline-summary.json),
and
[catalog corrections](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/verification/catalog-corrections.json)
accompany the frames. Descriptive catalog corrections leave every captured numerical profile
unchanged.

## Ten failure patterns to target

The ten-pattern order reflects my judgment about repair priority. Frequencies count unique eligible
inputs per profile, using each input's worst supported pose. They are review-flag frequencies, not
failure rates. Several appearance filters flag 92–100% of eligible inputs, including 114/114 phone
edge cases. Depth-cue counts are warnings, and cost cutoffs are review aids. These levels have not
been calibrated against annotated real-photo negatives.

1. **Repeated ribbons behind foreground objects — fill.** At the 15.0 pp review level: **106/115**
   eligible phone inputs and **105/108** desktop inputs (3 and 10 unsupported, respectively). Excess
   directionality in revealed fill over nearby visible background. Stretched edge-colored strips
   replace hidden texture.

   Examples:
   [Forest path](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/forest-phone--30-0.webp)
   (phone, 57.4 pp);
   [Still life (painting)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/still-life-desktop--20-0.webp)
   (desktop, 61.9 pp);
   [Sleeping tabby cat](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/new-00-147167228-desktop--20-0.webp)
   (desktop, 53.2 pp).

   Round 5 measure: Reduce worst-pose coherence excess while preserving texture energy and
   believable content in native-frame review.

2. **Thick or frayed thin boundaries — edge handling and inferred depth, not uniquely isolated.** At
   the 0.75 CSS px review level: **37/69** eligible phone inputs and **69/69** desktop inputs (49
   and 49 unsupported, respectively). Thin source-supported profiles acquire extra transition width.
   Sparse probes require visual review.

   Examples:
   [Plant studio (AI-made)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/dot-cdx-plant-studio-desktop-0--20.webp)
   (desktop, 2.24 CSS px, 69 probes, 22 backgrounds uncertain);
   [Desert oasis (AI-made)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/dot-oasis-desktop-0--30.webp)
   (desktop, 2.20 CSS px, 35 probes, 11 backgrounds uncertain);
   [Empty classroom](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/new-19-159668739-desktop-30-0.webp)
   (desktop, 2.37 CSS px, 41 probes, 22 backgrounds uncertain).

   Round 5 measure: Reduce per-input fringe p95 and maximum without erasing thin structures.

3. **Thin source lines lose contrast — edge handling or novel-view visibility; cause not isolated.**
   At the 20.0% review level: **33/69** eligible phone inputs and **23/69** desktop inputs (49 and
   49 unsupported, respectively). Projected source-line probes fall below the contrast threshold.
   Individual losses can also be legitimate occlusions, so this is not an object count.

   Examples:
   [Empty classroom](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/new-19-159668739-desktop--30-0.webp)
   (desktop, 48.8%, 41 probes, 16 backgrounds uncertain);
   [Treehouse village (AI-made)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/dot-treehouses-desktop-30-0.webp)
   (desktop, 46.7%, 15 probes, 3 backgrounds uncertain);
   [Plant studio (AI-made)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/dot-cdx-plant-studio-phone--30-0.webp)
   (phone, 29.2%, 72 probes, 34 backgrounds uncertain).

   Round 5 measure: Reduce lost-probe fraction and verify native leaf, stem, and rail continuity.

4. **Flat bands replace textured background — fill.** At the 50.0% review level: **75/115** eligible
   phone inputs and **67/108** desktop inputs (3 and 10 unsupported, respectively). Revealed/control
   gradient energy falls. Broad light or dark bands have coverage but lack the source background's
   fine structure. Naturally smooth hidden regions remain a confound.

   Examples:
   [Palace staircase](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/palace-stairs-phone-0--20.webp)
   (phone, 100.0%);
   [Spiral staircase](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/spiral-stairs-phone-0--30.webp)
   (phone, 83.2%);
   [Still life (painting)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/still-life-phone-0--20.webp)
   (phone, 98.7%).

   Round 5 measure: Reduce energy loss alongside streak excess; blank fill must not earn a clean
   score.

5. **Color spreads or shifts across depth cuts — edge handling and fill; not a sorting diagnosis.**
   At the 4.0% review level: **114/114** eligible phone inputs and **113/113** desktop inputs (4 and
   5 unsupported, respectively). Source-anchored RGB profile error combines bleeding, edge
   displacement, and misregistration. The dog shows a broad banded extension against the room and
   pale outlines at its muzzle and ears.

   Examples:
   [Long library (AI-made)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/dot-library-phone-0--30.webp)
   (phone, 18.5%, 144 profiles);
   [Dragonfly (AI-made)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/dot-dragonfly-phone--30-0.webp)
   (phone, 23.8%, 23 profiles);
   [Dog on a living-room floor](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/new-01-131641833-phone-30-0.webp)
   (phone, 35.4%, 7 profiles).

   Round 5 measure: Reduce anchored RGB error, out-of-palette excess, displacement, and transition
   width together.

6. **Fine structure becomes one shallow depth patch — depth or its postprocessing; warning only.**
   At the 20.0% review level: **104/106** eligible phone inputs and **105/106** desktop inputs (0
   and 0 unsupported, respectively). T-junction hypotheses have weak depth separation. The three
   maps merge visible rock, ice, or distant building detail into broad smooth regions. Water,
   reflections, and texture can invalidate the cues; this broad filter is not a verified failure
   rate.

   Examples:
   [Stones under water (AI-made)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/cdx-hard-submerged-stones-phone-depth.webp)
   (phone, 80.3%);
   [Frozen waterfall (AI-made)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/dot-ice-falls-phone-depth.webp)
   (phone, 79.4%);
   [Fishing cove (AI-made)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/dot-cove-phone-depth.webp)
   (phone, 74.6%).

   Round 5 measure: Use manually confirmed regions or reference errors; do not turn every texture
   junction into a depth discontinuity.

7. **Some image-cue order conflicts with relief depth — depth or its postprocessing; warning only.**
   At the 20.0% review level: **48/106** eligible phone inputs and **40/106** desktop inputs (0 and
   0 unsupported, respectively). T-junction hypotheses reverse relative order. Twigs, wing
   texture/transparency, and interior texture junctions can defeat the assumption, so these
   percentages are hypotheses rather than physical wrong-depth rates.

   Examples:
   [Stoneware (AI-made)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/dot-cdx-stoneware-phone-depth.webp)
   (phone, 41.6%);
   [Dragonfly (AI-made)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/dot-dragonfly-phone-depth.webp)
   (phone, 47.5%);
   [Mushroom house (AI-made)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/dot-cdx-mushroom-house-phone-depth.webp)
   (phone, 35.0%).

   Round 5 measure: Reduce confirmed order conflicts while guarding reference-scene pair reversals.

8. **Reference-depth range and order errors — raw model depth, measured before relief
   postprocessing.** At the 5.0% review level: **6/12** eligible phone inputs and **6/12** desktop
   inputs (0 and 0 unsupported, respectively). No reference scene exceeds the gallery's default 20%
   AbsRel review flag. A stricter exploratory 5% level describes the remaining range error; it is
   not an existing test threshold. The lattice has 11.3% reversed separated depth pairs. Rendered
   turn artifacts also depend on fill and edges.

   Examples:
   [Lattice and colored blocks (reference)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/truth-lattice-phone-depth.webp)
   (phone, 13.2%, RMSE 1.47 m);
   [Arch corridor (reference)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/truth-arches-phone-depth.webp)
   (phone, 11.8%, RMSE 1.35 m);
   [Night street and lamps (reference)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/truth-night-phone-depth.webp)
   (phone, 7.0%, RMSE 1.37 m).

   Round 5 measure: Reduce held-out AbsRel, meter errors, and pair reversals without losing
   valid-pixel support.

9. **Cold file-to-relief latency — decode, inference, and construction combined; not isolated.** At
   the 5.00 s review level: **16/118** eligible phone inputs and **29/118** desktop inputs (0 and 0
   unsupported, respectively). One fresh-browser timing per input. Model sessions are cold, but the
   Photo panel is already open for file cases, and the OS file cache is not flushed. A single
   observation is not a latency guarantee.

   Examples:
   [Carbonated water in a blue glass](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/new-13-61309178-phone-0-0.webp)
   (phone, 6.98 s);
   [Cactus flower and spines](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/new-08-151156803-phone-0-0.webp)
   (phone, 6.78 s);
   [Dew on a spiderweb](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/new-11-159259312-phone-0-0.webp)
   (phone, 6.56 s).

   Round 5 measure: Reduce repeated per-input phone cold latency with the same first-GPU-frame and
   cover-removal definition.

10. **High cold-path process memory — inference plus browser and render resources; not isolated.**
    At the 1024 MiB review level: **42/118** eligible phone inputs and **74/118** desktop inputs (0
    and 0 unsupported, respectively). Chromium-tree PSS during selection/input through first 3D and
    five more frames. This is not dedicated GPU memory; 200 ms sampling can miss short peaks.

    Examples:
    [Carbonated water in a blue glass](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/new-13-61309178-phone-0-0.webp)
    (phone, 1316 MiB);
    [Strawberry close-up](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/new-03-35525184-phone-0-0.webp)
    (phone, 1285 MiB);
    [Tomatoes in a metal bowl](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/new-17-27586242-phone-0-0.webp)
    (phone, 1275 MiB).

    Round 5 measure: Reduce phone peak process memory alongside latency, with neither increasing.

These groups can overlap. Their frequencies describe this benchmark, not a population estimate of
people's photographs. The examples were checked against their source, depth, and saved render. A
T-junction is an occlusion hypothesis; a warning is not proof that a real scene's depth is wrong.
Reference-depth errors and image-cue warnings are reported separately.

## What the scores mean

The corpus contains 70 labeled AI-made samples, six non-AI pictures (including one painting), 12
procedural reference scenes, and 30 additional CC0 photographs. Added photos cover pets, food,
plants, rooms, a road, tabletop objects, close-ups, night shots, and thin structures. Every added
file was reviewed at full resolution for people, visible logos, and watermarks.

The real pack uses **Sharp picture, Fine/photo detail, and depth 0.5**. Built-ins use their baked
depth; reference and added files use the real file-input path and original on-device model. Poses
are front, yaw ±20°/±30°, and pitch ±20°/±30°. Phone is CSS 390×844/DPR 3, low profile, with main's
**585×1266** native buffer at capture main; desktop is 1440×900/DPR 1, mid profile. Auto adaptation
is disabled. A white background, no ground, and a still pose isolate the photo. Color, mask, and UV
passes each use two completed GPU frames. Gallery crops include colored spill. Public review images
are WebP at most 390×844, including all 2,124 color views; they are resized after scoring. Original
photos and gzip-compressed numerical records remain public. Full-resolution color/mask/UV/reveal
PNGs and projected-boundary debug files stay local and can be reproduced at the capture pin. Lossy
reviews can hide fine fringes; private runs retain their native PNGs.

- **Fill:** local directional coherence excess against nearby visible background, plus gradient
  energy loss. Neither proves believable hidden content. Blank fill cannot win by removing
  gradients.
- **Holes:** uncovered candidate reveal pixels inside the actual photo footprint, inset by one
  native pixel. Covered foreground and the source's outer 4% are excluded.
- **Edges:** source-anchored RGB error combines bleeding and misregistration. Thin profiles measure
  extra transition width and lost contrast; legitimate occlusion and uncertain backgrounds can
  confound them. Broad-edge/reveal searches exclude the outer 4%; thin search uses a 16-source-pixel
  margin. Caps are 200 broad-edge and 240 thin anchors; absent support is unknown, not clean.
- **Depth:** reference scores use raw model output, positive affine inverse-depth fitting on one
  eighth of valid pixels, and held-out error on the remainder. Ambiguous appearance masks are
  excluded. Pair-order checks do not depend on the fit. Other inputs use T-junction hypotheses
  against the relief texture, including its resampling and edge handling; texture and transparency
  can invalidate the cues.
- **Cost:** fresh-browser selection/input to the completed new Sharp GPU frame, with geometry ready,
  the cover absent, and relief nonzero. App boot and the picker are outside the timer; file cases
  open the Photo panel first but keep inference cold. The OS cache is not flushed. Chromium-tree
  PSS/RSS is sampled every 200 ms through that frame and five more; Node is excluded. Mac RSS counts
  shared pages repeatedly. Short peaks can be missed; this is neither GPU memory nor physical-phone
  performance.

The default gallery priority is the largest value-to-review-level ratio across unlike quality
metrics, without perceptual calibration between them. The combined RGB edge/halo metric drives
**64/118 phone rows** (62/118 desktop rows); this is a priority heuristic rather than an independent
ordering of visible damage. Selecting a failure sorts that metric. Flat-depth, speed, and memory
have separate filters. A badge's worst pose can differ from the preview's worst turn.

Separating bleed from misregistration was considered. Details now expose existing out-of-palette
excess, edge-displacement p95, and transition-width excess per pose, alongside the combined RGB
score. Out-of-palette excess is not a validated pure-bleed score: blending can stay within the
source palette, and geometric displacement can also change color. Registration-aware validation
against annotated edges is still needed. Existing score values and thresholds are unchanged.
[Full method, environment, and evidence layout](https://github.com/ryanjosephkamp/splashery/tree/codex/photo-3d-failures-clips/review/photo-3d-failures).

## Not validated

Metric calibration uses synthetic fixtures only. The original 41 visual notes cover flagged
examples; they do not establish false-positive rates or an annotated clean-photo control set. The
following three lowest-priority phone inputs were subsequently reviewed visually against their
source, front, worst turn, and depth at both profiles. None is certified clean across both profiles.

| Control                                                                                                                                                                                | Phone / desktop priority rank | Visual observation                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Mushroom cap among needles](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/new-12-201342968-desktop-worst-crop.webp) | 118 / 110 of 118              | The turned cap has a dark, striped extension, especially at desktop yaw +30°. Phone fill and halo are unsupported, which lowers priority without demonstrating clean fill. |
| [Alpine lake (AI-made)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/dot-alpine-lake-desktop-worst-crop.webp)       | 117 / 91 of 118               | Phone yaw −20° remains coherent at review size; desktop pitch +30° exposes foreground color ribbons. Thin probes are unsupported.                                          |
| [Stone arch (AI-made)](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/renders/dot-arch-phone-worst-crop.webp)                 | 116 / 114 of 118              | The opening remains recognizable, with stepped arch/rock boundaries and stretched foreground details. Its depth has no physical reference.                                 |

One fresh repeat of these three inputs at both profiles and all nine poses used the exact original
source fingerprint: **54/54 decoded color frames and complete per-pose quality-score records matched
exactly**. This is limited same-renderer repeatability evidence. The other 115 inputs, latency
distributions, process-memory repeatability, other renderers, and threshold specificity remain
unvalidated. Actual macOS, physical-phone performance, and frame rate are untested.
[Control notes and support](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/verification/review-low-controls.json);
[repeat proof](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/verification/review-repeat-proof.json).

## Run your own photos privately on a Mac

Use a new checkout with Node.js 22 or later. Install the browser before disconnecting from the
Internet. The audit itself uses only loopback HTTP, vendored inference, and local files. Clone the
PR branch below, or use `main` after this PR merges.

```sh
git clone --branch codex/photo-3d-failures --single-branch \
  https://github.com/ryanjosephkamp/splashery.git photo-3d-audit
cd photo-3d-audit
npm ci
npx playwright install chromium
node tools/p3d-failures.mjs \
  --in "$HOME/Pictures/Photo audit" \
  --out "$HOME/Desktop/photo-3d-private"
open "$HOME/Desktop/photo-3d-private/index.html"
```

This Mac command uses the repository's software-GL flags (SwiftShader by default), not native GPU
timings. Its process-tree memory badge is RSS, which counts shared pages repeatedly. The Linux atlas
uses Mesa llvmpipe and PSS. Mac speed and memory badges will not match the Linux atlas and should
not be compared as performance changes.

The input folder can contain JPEG, PNG, WebP, and browser-decodable HEIC/HEIF files. Convert an
unsupported HEIC to a JPEG copy with Preview's File → Export, and put only the supported copy in the
audit input folder. Keep the original elsewhere. The tool does not modify originals, recurse into
unrelated folders, upload anything, or write Git commits. Output must be outside the checkout or
under its `.cache/`, including after resolving symlinks; tracked folders such as `docs/` are refused
before reading private inputs. Its output folder must be empty, or an identical run resumed with:

```sh
node tools/p3d-failures.mjs \
  --in "$HOME/Pictures/Photo audit" \
  --out "$HOME/Desktop/photo-3d-private" --resume
```

Keep that private output outside the repository; it contains your photos and their derived frames. A
resume rejects changed source, inputs, settings, or missing/changed completed render evidence. For a
smoke run, use `--limit 2 --profiles phone` with a separate empty output folder; it is explicitly
marked partial. Start the full run in another empty folder. Resume on the same machine with the same
browser settings. macOS execution has not been tested here. The Linux browser's administrator policy
blocked `file://`, so rendered QA used the exact generated files over loopback HTTP. On a browser
with that restriction, run
`python3 -m http.server 4187 --bind 127.0.0.1 --directory "$HOME/Desktop/photo-3d-private"` and open
`http://127.0.0.1:4187/` locally instead.

## Source and license records for the 30 additional photographs

All 30 source pages were opened live and declared CC0 1.0. Downloaded bytes are unchanged; the toy
applies its normal decoding and size limit. Complete source-page hashes, download URLs, authors,
dates checked, and image hashes are in the clips branch's source records. Rejected candidates,
including visible branding and a watermark, are not part of the corpus.

| Photo                              | Author                                                    | Source and license                                                                                                                                                                            |
| ---------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sleeping tabby cat                 | TheOmniCommie                                             | [Source](https://commons.wikimedia.org/wiki/File:Orange_tabby_persian_cat_sleeping_on_a_couch.png); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                             |
| Dog on a living-room floor         | Picography                                                | [Source](https://commons.wikimedia.org/wiki/File:Picography-curious-dog-animal-pet-house-home-sm-1.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                        |
| Chocolate cake on a plate          | Daria Yakovleva; minor edits by Subsidiary account        | [Source](https://commons.wikimedia.org/wiki/File:Piece_of_chocolate_cake_on_a_white_plate_decorated_with_chocolate_sauce.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)  |
| Apple pie and ice cream            | W.carter                                                  | [Source](https://commons.wikimedia.org/wiki/File:Apple_cake_with_vanilla_ice_cream_2.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                      |
| Fruit platter                      | Tomwsulcer                                                | [Source](https://commons.wikimedia.org/wiki/File:Fruit_platter_at_a_party_with_kiwi_melons_strawberries_etc.JPG); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)               |
| Strawberry close-up                | MartinThoma                                               | [Source](https://commons.wikimedia.org/wiki/File:Strawberries-3.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                                           |
| Empty classroom                    | Saral Shots                                               | [Source](https://commons.wikimedia.org/wiki/File:Empty_class_room.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                                         |
| Ornate apartment ceiling           | Andrey Kurochkin                                          | [Source](https://commons.wikimedia.org/wiki/File:Apartment,_interior_detail._Architect_Andrey_Kurochkin._Saint_Petersburg.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) |
| Dried wildflower                   | Olya Prutskova                                            | [Source](https://commons.wikimedia.org/wiki/File:Macro_shot_of_a_dried_wild_flower_buds.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                   |
| Daisy close-up                     | Free Nature Stock                                         | [Source](https://commons.wikimedia.org/wiki/File:Macro_flower_wallpaper.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                                   |
| Red flower                         | Fancibaer                                                 | [Source](https://commons.wikimedia.org/wiki/File:Macro_Flower_Shot.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                                        |
| Cactus flower and spines           | RndmCrs                                                   | [Source](https://commons.wikimedia.org/wiki/File:Cactus_Plant_in_Gujarat,_India.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                           |
| Prickly pear cactus                | Seimawu Sugri Seidu                                       | [Source](https://commons.wikimedia.org/wiki/File:Cactus_Plant_February.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                                    |
| Dim room behind glass doors        | Stephen Caserta caserta                                   | [Source](<https://commons.wikimedia.org/wiki/File:Empty_Room_(Unsplash).jpg>); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                                  |
| Refinery at night                  | W.carter                                                  | [Source](https://commons.wikimedia.org/wiki/File:Snowfall_at_night_over_Brofjorden_and_Preemraff_oil_refinery.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)             |
| Dew on a spiderweb                 | Sabalo22                                                  | [Source](https://commons.wikimedia.org/wiki/File:Water_droplets_on_spider_web_Feb_06_2025.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                 |
| Spiderweb across a dark background | Uwe Jelting                                               | [Source](<https://commons.wikimedia.org/wiki/File:Spider_Web_(184191363).jpeg>); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                                |
| Spiderweb on a red balcony         | W.carter                                                  | [Source](https://commons.wikimedia.org/wiki/File:Spider_web_on_red_balcony.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                                |
| Small mushroom on soil             | Anush Mkrtchyan                                           | [Source](https://commons.wikimedia.org/wiki/File:Mushroom_-.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                                               |
| Mushroom cap among needles         | Anush Mkrtchyan                                           | [Source](https://commons.wikimedia.org/wiki/File:Paxillus_involutus_mushroom_1.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                            |
| Mushroom on autumn leaves          | Mar Mkrtchyan                                             | [Source](https://commons.wikimedia.org/wiki/File:Brown_mushroom_on_forest_floor.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                           |
| Carbonated water in a blue glass   | W.carter                                                  | [Source](https://commons.wikimedia.org/wiki/File:Blue_glass_with_carbonated_water.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                         |
| Clear drinking glass               | Photographer not identified on source page; museum source | [Source](https://commons.wikimedia.org/wiki/File:Water_glass_MET_ES704.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                                    |
| Water glass on a cafe table        | Kurt Kaiser                                               | [Source](https://commons.wikimedia.org/wiki/File:Glass_of_water_ouside_2.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                                  |
| Large metal gears                  | W.carter                                                  | [Source](https://commons.wikimedia.org/wiki/File:Cog_wheel_on_a_huge_crane_claw_-_1.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                       |
| Rusted anvil outdoors              | Jebulon                                                   | [Source](https://commons.wikimedia.org/wiki/File:Enclume_rouill%C3%A9e.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                                    |
| Empty road through wooded hills    | Rathfelder                                                | [Source](https://commons.wikimedia.org/wiki/File:Empty_street_stall.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                                       |
| Rice bowl on a table               | TechnoKittyCat                                            | [Source](https://commons.wikimedia.org/wiki/File:Donburi_Rice_bowl_of_Chicken_Teriyaki_with_Tomato.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                        |
| Tomatoes in a metal bowl           | Hahifuheho                                                | [Source](https://commons.wikimedia.org/wiki/File:Tomatoes_in_a_punching_metal_bowl.jpg); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                        |
| Fields beneath a pale sky          | www.Pixel.la Free Stock Photos                            | [Source](<https://commons.wikimedia.org/wiki/File:Landscape-sky-sunny-night_(24299136886).jpg>); [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/)                                |

## Verification and limits

- Revised own spec: **10 passed (58.9 s)**, covering synthetic metric calibration, blank-fill
  avoidance, genuine holes, thin-part loss, checkout/symlink privacy rejection, resized-review
  links, real inference, four native phone views, offline gallery interactions, and resume
  rejection. The new privacy and review-link tests both failed before their respective fixes.
- Original matrix proof: **118 original source/depth/reference inputs**, **118 copied photos**,
  **10,620 native artifact hashes**, **8,496 native PNG dimensions**, and **5,185 valid Linux PSS
  samples** checked; zero failed capture attempts, unresolved profiles, or browser errors.
- Exact published-folder gallery QA: **52 filter/profile/viewport combinations** passed, including
  counts, ordering, profile switching, search, reset, empty states, deep links, edge diagnostics,
  and WebP/gzip links. Both viewports have no horizontal overflow or console/page errors.
- Compact package: **2,950 decoded WebP images**, **615 exact gzip-decompressed capture files**, and
  **118 original photo hashes** checked. All numeric profiles remain unchanged. The package is under
  170 MB, replacing the old 2.1 GB media payload; native PNGs remain local.
- A real private-input browser smoke used a public fixture in a temporary folder, wrote outside the
  checkout, made no outside-origin requests, and left Git status unchanged. The public-manifest
  helper reproduces all 118 input hashes. Earlier supplied-depth and mocked-Mac-RSS bookkeeping
  smokes remain separate from the matrix.
- Full Prettier and American English checks gate every push. The production diff under `src/`,
  `assets/`, and `vendor/` is empty against main.

The revised branch merges main `cb8a83157`, including the loading-cover/status follow-up and camera
optimizations. The atlas and its limited repeat remain pinned to capture commit `216c34dd` on main
`ea35f3de`; they are not a fresh numerical baseline of later main. Post-capture tool changes cover
privacy, presentation, supplied-depth timing, and unavailable Mac RSS.
[Release provenance](https://github.com/ryanjosephkamp/splashery/blob/codex/photo-3d-failures-clips/review/photo-3d-failures/verification/release-provenance.json)
records the separate source fingerprints. Actual macOS, physical-phone performance, and frame rate
are untested. There are 49 inputs without supported thin probes at each profile; these are not
clean-edge passes.

Two interrupted pilots are excluded. The first exposed an outside-photo hole ROI, corrected with
tests for both genuine interior holes and false boundary holes (the natural case now scores 0/45).
The second stopped for source screening and the round 4 merge. Their logs remain separate.

Default Sharp rendering uses a textured relief mesh. These observations do not demonstrate a
Gaussian-splat sorting regression. Stage attribution distinguishes measured depth/fill/edge behavior
from hypotheses; an unisolated cause is not labeled proven. This atlas changes no reconstruction,
model, shader, sample, or test threshold. The full existing suite is left to the Operator's merge
PR, as task 87 requests.

Rule check: E1 is touched only by replacing the never-merged media branch, explicitly requested in
the
[Operator's review](https://github.com/ryanjosephkamp/splashery/pull/658#issuecomment-6188850181).
The code branch keeps its history, and neither PR nor main is merged by this task.

## Draft round 5 Goal

Use the same 118 source hashes, nine poses, settings, and source probes; preserve baseline probe
coverage when depth changes; lost measurement support is not a pass. Repeat cost measurements rather
than treating this atlas's single samples as a speed guarantee. These are proposed acceptance
criteria, not results of this task.

1. On every baseline-flagged input, reduce worst-pose streak excess by at least 30% and revealed
   texture-energy loss by at least 25%, with no per-input increase in either and no newly smeared or
   blank fill in native-frame review.
2. On every baseline-flagged edge input, reduce worst-pose anchored mean RGB error by at least 25%,
   without increasing edge displacement or transition-width p95. On supported thin parts, reduce
   fringe p95 by at least 30% and keep lost probes at or below 10% without increasing them; review
   unsupported hair, leaf, wire, and web cases visually.
3. First re-baseline frozen round 4 and the candidate with five fresh-browser runs per input on the
   same phone-profile hardware, browser, and settings. Reduce every input's median first-3D time by
   at least 25%, with its maximum process PSS over those five runs no higher. This atlas's single
   timing per input is not that acceptance baseline.
4. Allow no per-input regression in holes, anchored edge errors, held-out reference-depth error, the
   text test (`phf-engine:200`), frame rate, or any existing spec; confirm the result on a physical
   phone before claiming physical-phone performance.
