# Photo to 3D round 3 review media

Made by Ryan with Codex (GPT-6). Original review assets are CC0; code is under Splashery's MIT
license. Source photos and their GIF derivatives retain the source licenses and credits in
[the source manifest](sources/manifest.json). AI-made Studio samples are labeled in each clip.

Before: `7c6073016e6c1c092091533302f903d80b4af44e`. Round 3 renderer:
`a5458f4d32d02ad075ed539fbc7775cf1c4c9ef9`. Main comparison:
`555e8f5c1dae8b9192d7678493b4a2a38eb1e6d5`. See [source hashes](builds.json).

GitHub rejected the original private-email push. Original local commits and raw measured identities
remain intact; newly packaged no-reply commits preserve the public PR ancestry. The public renderer
equivalent is `81b89e11dc86c7aa62a2efa8713e7bca9f0f86d9`. Its entire tracked tree matches the actual
measured local renderer tree, with the nine renderer hashes and separate UI hashes checked in
[publication-provenance.json](publication-provenance.json). Measurements ran on the original
checkout, not on the new publication commit. No existing remote history was rewritten.

Each completed MP4 has two 390×844 halves: the previous PR head on the left and round 3 on the
right. The actual phone profile is 390×844 at device scale factor 3, with the existing low-profile
drawing buffer of 585×1266. Review export reduces each half to phone size. Clips sweep yaw and pitch
through ±30° at depth 1. GIF inputs exercise the app's first-frame photo decode; these are not
moving-photo clips. Sharp sampling rates: 48 captured poses at 12 fps; 24 captured poses at 6 fps.
Each clip's counts and original capture-method hash are in clips.json and its linked capture
manifest. Playback rate is a review choice, not a physical-device frame-rate measurement. Every
yaw/pitch extreme reaches 30 degrees. The encoder receives lossless raw RGBA; the retained handoff
check matches the former PNG input pixel for pixel.

Required clips complete: 49/49 (sharp). Optional Fine Splats clips complete: 0/49. Missing clips:
forest/splats, street/splats, still-life/splats, spiral-stairs/splats, palace-stairs/splats,
wildflowers/splats, dot-train/splats, dot-oasis/splats, dot-castle/splats, dot-cove/splats,
dot-harbor/splats, dot-paper-valley/splats, dot-farm/splats, dot-treehouses/splats,
dot-library/splats, dot-workshop/splats, dot-cloister/splats, dot-greenhouse/splats,
dot-attic/splats, dot-bamboo/splats, dot-terraces/splats, dot-canyon/splats, dot-arch/splats,
dot-fallen-log/splats, dot-alpine-lake/splats, dot-ice-falls/splats, dot-floating-isles/splats,
dot-wave/splats, dot-explorer-desk/splats, dot-watchmaker/splats, dot-dragonfly/splats,
dot-mushrooms/splats, dot-market/splats, dot-gears/splats, dot-chess/splats, dot-book-city/splats,
lighthouse/splats, sailboat/splats, tulips/splats, daffodils/splats, red-barn/splats,
seashell/splats, islands/splats, tulip-field/splats, mushroom/splats, waterfall/splats,
seashell-gif/splats, mushroom-gif/splats, waterfall-gif/splats.

| Input              | Sharp (required)                                        | Fine Splats (hybrid, optional) | Phone worst halo, before / after                                                                                              | Desktop worst halo, before / after                                                                                |
| ------------------ | ------------------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| forest             | [clip](clips/forest-sharp-before-after.mp4)             | pending                        | [before](sweep-before/phone-forest-worst-halo.png) / [after](sweep-after/phone-forest-worst-halo.png)                         | [before](sweep-before/desktop-forest-worst-halo.png) / [after](sweep-after/desktop-forest-worst-halo.png)         |
| street             | [clip](clips/street-sharp-before-after.mp4)             | pending                        | [before](sweep-before/phone-street-worst-halo.png) / [after](sweep-after/phone-street-worst-halo.png)                         | [before](sweep-before/desktop-street-worst-halo.png) / [after](sweep-after/desktop-street-worst-halo.png)         |
| still-life         | [clip](clips/still-life-sharp-before-after.mp4)         | pending                        | [before](sweep-before/phone-still-life-worst-halo.png) / [after](sweep-after/phone-still-life-worst-halo.png)                 | [before](sweep-before/desktop-still-life-worst-halo.png) / [after](sweep-after/desktop-still-life-worst-halo.png) |
| spiral-stairs      | [clip](clips/spiral-stairs-sharp-before-after.mp4)      | pending                        | [before](sweep-before/phone-spiral-stairs-worst-halo.png) / [after](sweep-after/phone-spiral-stairs-worst-halo.png)           | pending / [after](sweep-after/desktop-spiral-stairs-worst-halo.png)                                               |
| palace-stairs      | [clip](clips/palace-stairs-sharp-before-after.mp4)      | pending                        | [before](sweep-before/phone-palace-stairs-worst-halo.png) / [after](sweep-after/phone-palace-stairs-worst-halo.png)           | pending / [after](sweep-after/desktop-palace-stairs-worst-halo.png)                                               |
| wildflowers        | [clip](clips/wildflowers-sharp-before-after.mp4)        | pending                        | [before](sweep-before/phone-wildflowers-worst-halo.png) / [after](sweep-after/phone-wildflowers-worst-halo.png)               | pending / [after](sweep-after/desktop-wildflowers-worst-halo.png)                                                 |
| dot-train          | [clip](clips/dot-train-sharp-before-after.mp4)          | pending                        | [before](sweep-before/phone-dot-train-worst-halo.png) / [after](sweep-after/phone-dot-train-worst-halo.png)                   | pending / [after](sweep-after/desktop-dot-train-worst-halo.png)                                                   |
| dot-oasis          | [clip](clips/dot-oasis-sharp-before-after.mp4)          | pending                        | [before](sweep-before/phone-dot-oasis-worst-halo.png) / [after](sweep-after/phone-dot-oasis-worst-halo.png)                   | pending / [after](sweep-after/desktop-dot-oasis-worst-halo.png)                                                   |
| dot-castle         | [clip](clips/dot-castle-sharp-before-after.mp4)         | pending                        | [before](sweep-before/phone-dot-castle-worst-halo.png) / [after](sweep-after/phone-dot-castle-worst-halo.png)                 | pending / [after](sweep-after/desktop-dot-castle-worst-halo.png)                                                  |
| dot-cove           | [clip](clips/dot-cove-sharp-before-after.mp4)           | pending                        | [before](sweep-before/phone-dot-cove-worst-halo.png) / [after](sweep-after/phone-dot-cove-worst-halo.png)                     | pending / [after](sweep-after/desktop-dot-cove-worst-halo.png)                                                    |
| dot-harbor         | [clip](clips/dot-harbor-sharp-before-after.mp4)         | pending                        | [before](sweep-before/phone-dot-harbor-worst-halo.png) / [after](sweep-after/phone-dot-harbor-worst-halo.png)                 | pending / [after](sweep-after/desktop-dot-harbor-worst-halo.png)                                                  |
| dot-paper-valley   | [clip](clips/dot-paper-valley-sharp-before-after.mp4)   | pending                        | [before](sweep-before/phone-dot-paper-valley-worst-halo.png) / [after](sweep-after/phone-dot-paper-valley-worst-halo.png)     | pending / [after](sweep-after/desktop-dot-paper-valley-worst-halo.png)                                            |
| dot-farm           | [clip](clips/dot-farm-sharp-before-after.mp4)           | pending                        | [before](sweep-before/phone-dot-farm-worst-halo.png) / [after](sweep-after/phone-dot-farm-worst-halo.png)                     | pending / [after](sweep-after/desktop-dot-farm-worst-halo.png)                                                    |
| dot-treehouses     | [clip](clips/dot-treehouses-sharp-before-after.mp4)     | pending                        | [before](sweep-before/phone-dot-treehouses-worst-halo.png) / [after](sweep-after/phone-dot-treehouses-worst-halo.png)         | pending / [after](sweep-after/desktop-dot-treehouses-worst-halo.png)                                              |
| dot-library        | [clip](clips/dot-library-sharp-before-after.mp4)        | pending                        | [before](sweep-before/phone-dot-library-worst-halo.png) / [after](sweep-after/phone-dot-library-worst-halo.png)               | pending / [after](sweep-after/desktop-dot-library-worst-halo.png)                                                 |
| dot-workshop       | [clip](clips/dot-workshop-sharp-before-after.mp4)       | pending                        | [before](sweep-before/phone-dot-workshop-worst-halo.png) / [after](sweep-after/phone-dot-workshop-worst-halo.png)             | pending / [after](sweep-after/desktop-dot-workshop-worst-halo.png)                                                |
| dot-cloister       | [clip](clips/dot-cloister-sharp-before-after.mp4)       | pending                        | [before](sweep-before/phone-dot-cloister-worst-halo.png) / [after](sweep-after/phone-dot-cloister-worst-halo.png)             | pending / [after](sweep-after/desktop-dot-cloister-worst-halo.png)                                                |
| dot-greenhouse     | [clip](clips/dot-greenhouse-sharp-before-after.mp4)     | pending                        | [before](sweep-before/phone-dot-greenhouse-worst-halo.png) / [after](sweep-after/phone-dot-greenhouse-worst-halo.png)         | pending / [after](sweep-after/desktop-dot-greenhouse-worst-halo.png)                                              |
| dot-attic          | [clip](clips/dot-attic-sharp-before-after.mp4)          | pending                        | [before](sweep-before/phone-dot-attic-worst-halo.png) / [after](sweep-after/phone-dot-attic-worst-halo.png)                   | pending / [after](sweep-after/desktop-dot-attic-worst-halo.png)                                                   |
| dot-bamboo         | [clip](clips/dot-bamboo-sharp-before-after.mp4)         | pending                        | [before](sweep-before/phone-dot-bamboo-worst-halo.png) / [after](sweep-after/phone-dot-bamboo-worst-halo.png)                 | pending / [after](sweep-after/desktop-dot-bamboo-worst-halo.png)                                                  |
| dot-terraces       | [clip](clips/dot-terraces-sharp-before-after.mp4)       | pending                        | [before](sweep-before/phone-dot-terraces-worst-halo.png) / [after](sweep-after/phone-dot-terraces-worst-halo.png)             | pending / [after](sweep-after/desktop-dot-terraces-worst-halo.png)                                                |
| dot-canyon         | [clip](clips/dot-canyon-sharp-before-after.mp4)         | pending                        | [before](sweep-before/phone-dot-canyon-worst-halo.png) / [after](sweep-after/phone-dot-canyon-worst-halo.png)                 | pending / [after](sweep-after/desktop-dot-canyon-worst-halo.png)                                                  |
| dot-arch           | [clip](clips/dot-arch-sharp-before-after.mp4)           | pending                        | [before](sweep-before/phone-dot-arch-worst-halo.png) / [after](sweep-after/phone-dot-arch-worst-halo.png)                     | pending / [after](sweep-after/desktop-dot-arch-worst-halo.png)                                                    |
| dot-fallen-log     | [clip](clips/dot-fallen-log-sharp-before-after.mp4)     | pending                        | [before](sweep-before/phone-dot-fallen-log-worst-halo.png) / [after](sweep-after/phone-dot-fallen-log-worst-halo.png)         | pending / [after](sweep-after/desktop-dot-fallen-log-worst-halo.png)                                              |
| dot-alpine-lake    | [clip](clips/dot-alpine-lake-sharp-before-after.mp4)    | pending                        | [before](sweep-before/phone-dot-alpine-lake-worst-halo.png) / [after](sweep-after/phone-dot-alpine-lake-worst-halo.png)       | pending / [after](sweep-after/desktop-dot-alpine-lake-worst-halo.png)                                             |
| dot-ice-falls      | [clip](clips/dot-ice-falls-sharp-before-after.mp4)      | pending                        | [before](sweep-before/phone-dot-ice-falls-worst-halo.png) / [after](sweep-after/phone-dot-ice-falls-worst-halo.png)           | pending / [after](sweep-after/desktop-dot-ice-falls-worst-halo.png)                                               |
| dot-floating-isles | [clip](clips/dot-floating-isles-sharp-before-after.mp4) | pending                        | [before](sweep-before/phone-dot-floating-isles-worst-halo.png) / [after](sweep-after/phone-dot-floating-isles-worst-halo.png) | pending / [after](sweep-after/desktop-dot-floating-isles-worst-halo.png)                                          |
| dot-wave           | [clip](clips/dot-wave-sharp-before-after.mp4)           | pending                        | [before](sweep-before/phone-dot-wave-worst-halo.png) / [after](sweep-after/phone-dot-wave-worst-halo.png)                     | pending / [after](sweep-after/desktop-dot-wave-worst-halo.png)                                                    |
| dot-explorer-desk  | [clip](clips/dot-explorer-desk-sharp-before-after.mp4)  | pending                        | [before](sweep-before/phone-dot-explorer-desk-worst-halo.png) / [after](sweep-after/phone-dot-explorer-desk-worst-halo.png)   | pending / [after](sweep-after/desktop-dot-explorer-desk-worst-halo.png)                                           |
| dot-watchmaker     | [clip](clips/dot-watchmaker-sharp-before-after.mp4)     | pending                        | [before](sweep-before/phone-dot-watchmaker-worst-halo.png) / [after](sweep-after/phone-dot-watchmaker-worst-halo.png)         | pending / [after](sweep-after/desktop-dot-watchmaker-worst-halo.png)                                              |
| dot-dragonfly      | [clip](clips/dot-dragonfly-sharp-before-after.mp4)      | pending                        | [before](sweep-before/phone-dot-dragonfly-worst-halo.png) / [after](sweep-after/phone-dot-dragonfly-worst-halo.png)           | pending / [after](sweep-after/desktop-dot-dragonfly-worst-halo.png)                                               |
| dot-mushrooms      | [clip](clips/dot-mushrooms-sharp-before-after.mp4)      | pending                        | [before](sweep-before/phone-dot-mushrooms-worst-halo.png) / [after](sweep-after/phone-dot-mushrooms-worst-halo.png)           | pending / [after](sweep-after/desktop-dot-mushrooms-worst-halo.png)                                               |
| dot-market         | [clip](clips/dot-market-sharp-before-after.mp4)         | pending                        | [before](sweep-before/phone-dot-market-worst-halo.png) / [after](sweep-after/phone-dot-market-worst-halo.png)                 | pending / [after](sweep-after/desktop-dot-market-worst-halo.png)                                                  |
| dot-gears          | [clip](clips/dot-gears-sharp-before-after.mp4)          | pending                        | [before](sweep-before/phone-dot-gears-worst-halo.png) / [after](sweep-after/phone-dot-gears-worst-halo.png)                   | pending / [after](sweep-after/desktop-dot-gears-worst-halo.png)                                                   |
| dot-chess          | [clip](clips/dot-chess-sharp-before-after.mp4)          | pending                        | [before](sweep-before/phone-dot-chess-worst-halo.png) / [after](sweep-after/phone-dot-chess-worst-halo.png)                   | pending / [after](sweep-after/desktop-dot-chess-worst-halo.png)                                                   |
| dot-book-city      | [clip](clips/dot-book-city-sharp-before-after.mp4)      | pending                        | [before](sweep-before/phone-dot-book-city-worst-halo.png) / [after](sweep-after/phone-dot-book-city-worst-halo.png)           | pending / [after](sweep-after/desktop-dot-book-city-worst-halo.png)                                               |
| lighthouse         | [clip](clips/lighthouse-sharp-before-after.mp4)         | pending                        | [before](sweep-before/phone-lighthouse-worst-halo.png) / [after](sweep-after/phone-lighthouse-worst-halo.png)                 | pending / [after](sweep-after/desktop-lighthouse-worst-halo.png)                                                  |
| sailboat           | [clip](clips/sailboat-sharp-before-after.mp4)           | pending                        | [before](sweep-before/phone-sailboat-worst-halo.png) / [after](sweep-after/phone-sailboat-worst-halo.png)                     | pending / [after](sweep-after/desktop-sailboat-worst-halo.png)                                                    |
| tulips             | [clip](clips/tulips-sharp-before-after.mp4)             | pending                        | [before](sweep-before/phone-tulips-worst-halo.png) / [after](sweep-after/phone-tulips-worst-halo.png)                         | pending / [after](sweep-after/desktop-tulips-worst-halo.png)                                                      |
| daffodils          | [clip](clips/daffodils-sharp-before-after.mp4)          | pending                        | [before](sweep-before/phone-daffodils-worst-halo.png) / [after](sweep-after/phone-daffodils-worst-halo.png)                   | pending / [after](sweep-after/desktop-daffodils-worst-halo.png)                                                   |
| red-barn           | [clip](clips/red-barn-sharp-before-after.mp4)           | pending                        | [before](sweep-before/phone-red-barn-worst-halo.png) / [after](sweep-after/phone-red-barn-worst-halo.png)                     | pending / [after](sweep-after/desktop-red-barn-worst-halo.png)                                                    |
| seashell           | [clip](clips/seashell-sharp-before-after.mp4)           | pending                        | [before](sweep-before/phone-seashell-worst-halo.png) / [after](sweep-after/phone-seashell-worst-halo.png)                     | pending / [after](sweep-after/desktop-seashell-worst-halo.png)                                                    |
| islands            | [clip](clips/islands-sharp-before-after.mp4)            | pending                        | [before](sweep-before/phone-islands-worst-halo.png) / [after](sweep-after/phone-islands-worst-halo.png)                       | pending / [after](sweep-after/desktop-islands-worst-halo.png)                                                     |
| tulip-field        | [clip](clips/tulip-field-sharp-before-after.mp4)        | pending                        | [before](sweep-before/phone-tulip-field-worst-halo.png) / [after](sweep-after/phone-tulip-field-worst-halo.png)               | pending / [after](sweep-after/desktop-tulip-field-worst-halo.png)                                                 |
| mushroom           | [clip](clips/mushroom-sharp-before-after.mp4)           | pending                        | [before](sweep-before/phone-mushroom-worst-halo.png) / [after](sweep-after/phone-mushroom-worst-halo.png)                     | pending / pending                                                                                                 |
| waterfall          | [clip](clips/waterfall-sharp-before-after.mp4)          | pending                        | [before](sweep-before/phone-waterfall-worst-halo.png) / [after](sweep-after/phone-waterfall-worst-halo.png)                   | pending / pending                                                                                                 |
| seashell-gif       | [clip](clips/seashell-gif-sharp-before-after.mp4)       | pending                        | [before](sweep-before/phone-seashell-gif-worst-halo.png) / [after](sweep-after/phone-seashell-gif-worst-halo.png)             | pending / pending                                                                                                 |
| mushroom-gif       | [clip](clips/mushroom-gif-sharp-before-after.mp4)       | pending                        | [before](sweep-before/phone-mushroom-gif-worst-halo.png) / [after](sweep-after/phone-mushroom-gif-worst-halo.png)             | pending / pending                                                                                                 |
| waterfall-gif      | [clip](clips/waterfall-gif-sharp-before-after.mp4)      | pending                        | [before](sweep-before/phone-waterfall-gif-worst-halo.png) / [after](sweep-after/phone-waterfall-gif-worst-halo.png)           | pending / pending                                                                                                 |

## Measurements and limits

[Retained pose and spec counts](summary.md) report each worst pose, including incomplete coverage.
The source-color transport diagnostic detects filtering errors around rendered depth cuts; it cannot
prove correct hidden content or the absence of every geometric outline. The separate source-anchored
audit uses stable color edges and an inferred depth-plane surrogate; its anchor coverage and missing
crossings must be read with its scores. No inferred depth map is geometric ground truth.

Sharp cadence measurements use WebGL2 completion fences, without screenshot readbacks in the timed
interval. They include software-GPU scheduling overhead. Fine Splats and actual physical-phone
smoothness have not been measured. Existing tests and thresholds are unchanged; initial failures and
isolated rechecks are reported separately.

## Reproduce

Use the task branch's tools/cdx-p3d2-r3-\*.mjs and the recorded immutable checkouts. Serve before on
4174, main on 4176, and the final renderer on 4177. Copy the public source files and depth fixtures
into .cache/cdx-p3d2/r3/sources and restore the manifest's file/depthFile paths to that cache
directory. Copy builds.json into the cache. Built-in sources remain the repository's unchanged
samples. The source manifest records each live source page, author, license, hash and modification.

For a public clone, check out renderer `81b89e11dc86c7aa62a2efa8713e7bca9f0f86d9` for port 4177
rather than the original local-only measured SHA. Before and main remain the public commits in
builds.json. Keep the raw build records unchanged; the equivalence proof supplies the public
checkout and verifies identical source bytes.

The run used /usr/bin/chromium 151.0.7922.173, temporary Debian Xvfb 2:21.1.16-1.3+deb13u4 displays,
and Mesa llvmpipe. The requested /opt/pw-browsers/chromium was absent. No Playwright browser
download was installed. Set SPLASHERY_CHROMIUM=/usr/bin/chromium and SPLASHERY_GL=llvmpipe. Cadence
jobs ran alone with LP_NUM_THREADS=2 and DISPLAY=:90. Target pose, anchored-edge and review-clip
captures used LP_NUM_THREADS=1 on displays :90–:93; baseline pose captures used LP_NUM_THREADS=2 on
:94. The first desktop target group used one thread; the resumed remaining desktop groups use two
threads on :90, preserving completed groups and persistent console history. The target phone phase
uses sweep-after; its original full-matrix worker is paused once all phone groups finish. The
separate sweep-after-desktop phase uses the same method, inputs, views and capture policy. Reproduce
both target profiles with the full-matrix command below, or capture desktop separately with the
second command; do not duplicate desktop poses across phases. These software-GPU worker limits do
not change image resolution or camera poses. Original clip-tool sources are retained under
capture-methods/; their combined SHA-256 must match the linked capture manifest. Restore each
cohort's two files into tools/ before reproducing its clip command.

```sh
node tools/cdx-p3d2-r3-measure.mjs --build=before --url=http://127.0.0.1:4174/ --depths=1 --views=sharp --diagonal=false --sharp-rest-frames=1 --resume=true --out=.cache/cdx-p3d2/r3/sweep-before
node tools/cdx-p3d2-r3-measure.mjs --build=after --url=http://127.0.0.1:4177/ --depths=1 --diagonal=false --sharp-rest-frames=1 --resume=true --out=.cache/cdx-p3d2/r3/sweep-after
# Alternative desktop phase while the original worker captures only phone groups:
node tools/cdx-p3d2-r3-measure.mjs --build=after --url=http://127.0.0.1:4177/ --screens=desktop --depths=1 --diagonal=false --sharp-rest-frames=1 --resume=true --out=.cache/cdx-p3d2/r3/sweep-after-desktop
node tools/cdx-p3d2-r3-anchor-sweep.mjs --before=http://127.0.0.1:4174/ --after=http://127.0.0.1:4177/ --depths=1 --out=.cache/cdx-p3d2/r3/anchored-sweep
node tools/cdx-p3d2-r3-frame.mjs --build=main --url=http://127.0.0.1:4176/ --samples=all --screens=phone --out=.cache/cdx-p3d2/r3/frame-main-all-phone.json
node tools/cdx-p3d2-r3-frame.mjs --build=after --url=http://127.0.0.1:4177/ --samples=all --screens=phone --out=.cache/cdx-p3d2/r3/frame-after-all-phone.json
# Restore the two archived files from capture-methods/clips/ into tools/ first.
node tools/cdx-p3d2-r3-clips.mjs --before=http://127.0.0.1:4174/ --after=http://127.0.0.1:4177/ --samples=forest --views=sharp --fps=12 --seconds=4 --out=.cache/cdx-p3d2/r3/clips
# Restore the two archived files from capture-methods/clips-six/ into tools/ first.
node tools/cdx-p3d2-r3-clips.mjs --before=http://127.0.0.1:4174/ --after=http://127.0.0.1:4177/ --samples=street,still-life,spiral-stairs,palace-stairs,wildflowers,dot-train,dot-oasis,dot-castle,dot-cove,dot-harbor,dot-paper-valley,dot-farm,dot-treehouses,dot-library,dot-workshop,dot-cloister,dot-greenhouse,dot-attic --views=sharp --fps=6 --seconds=4 --out=.cache/cdx-p3d2/r3/clips-six
# Restore the two archived files from capture-methods/clips-warmed/ into tools/ first.
node tools/cdx-p3d2-r3-clips.mjs --before=http://127.0.0.1:4174/ --after=http://127.0.0.1:4177/ --samples=dot-bamboo,dot-terraces,dot-canyon,dot-arch,dot-fallen-log,dot-alpine-lake,dot-ice-falls,dot-floating-isles,dot-wave,dot-explorer-desk,dot-watchmaker,dot-dragonfly,dot-mushrooms,dot-market,dot-gears,dot-chess,dot-book-city,lighthouse,sailboat,tulips,daffodils,red-barn,seashell,islands,tulip-field,mushroom,waterfall,seashell-gif,mushroom-gif,waterfall-gif --views=sharp --fps=6 --seconds=4 --sharp-rest-frames=1 --out=.cache/cdx-p3d2/r3/clips-warmed
```
