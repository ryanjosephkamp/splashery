# Operator review verification

This folder records the response to the Operator's
[October 17 review](https://github.com/ryanjosephkamp/splashery/pull/702#issuecomment-6232466385).
Implementation: `e442b74e035395e30c0d7e2bd1737521b46d06fa`, after merging main at
`c36c4dcd91f505ccb94cb5abe0d16cc2c626c395`. This evidence branch must never be merged.

The shipped Manual PDF, edition selector, index, and edition links match main. The new Manual
paragraphs remain. `man5:201` may report a stale PDF until the Operator prints an edition at merge
time, as explicitly accepted in the review.

All 24 focused exporter tests and every preflight check passed, including 272 preflight tests.
Regression assertions first failed for the former desktop defaults and missing standard copyright,
then passed after the fixes. The complete desktop and phone presets are asserted.

The first-use browser probe changes no export controls before converting the default torus and
saving its GLB. It reads the actual downloaded files, not just the form. Both files retain source
attribution in `asset.copyright` and `asset.extras`. Both pass Khronos glTF Validator 2.0.0-dev.3.10
(Apache-2.0) with zero errors and zero warnings. Full validator reports are beside the GLBs;
[results.json](results.json) records the controls, downloaded mesh reports, and geometry hashes.

| Browser viewport    | Initial quality | Grid | Level | Triangle budget | Ready to print |
| ------------------- | --------------- | ---: | ----: | --------------: | -------------- |
| Desktop, 1440 × 900 | Fine            |  160 |     1 |         100,000 | On, 100 mm     |
| Touch, 390 × 844    | Balanced        |   72 |   0.5 |          40,000 | Off            |

The desktop file's geometry BIN payload is byte-identical to the previously scored torus export:
SHA-256 `a90fb72b60eb0a9efc268a81ef9227716e1e1827212b0caeef4d9da24ce40821`. The fixed benchmark
recipe and its geometry have not changed. This closes the gap between the scored preset and the
first-use desktop UI. Balanced is not claimed to meet the measured quality gate.

Both PNGs were inspected. They show the actual triangle previews and download controls in the
desktop sidebar and phone sheet. They were captured with Chromium 141, Xvfb, and llvmpipe on the
desktop host. The touch viewport is not evidence of physical-phone performance or memory.

To reproduce [browser-probe.mjs](browser-probe.mjs), copy it to
`.cache/mesh-export/operator-defaults.mjs` in the implementation checkout. Install the optional
validator into `.cache/mesh-export/review-validator` with the command below, then start the
repository's range-capable server with `node tools/cdx-mp2-server.mjs 4173`. Run the probe with the
same Chromium, display, font, and Mesa environment used for preflight. It writes its outputs to
`.cache/mesh-export/operator-defaults/`.

```sh
npm install --prefix .cache/mesh-export/review-validator --ignore-scripts --no-audit --no-fund gltf-validator@2.0.0-dev.3.10
SPLASHERY_CHROMIUM=/path/to/chromium141 SPLASHERY_GL=llvmpipe DISPLAY=:98 LP_NUM_THREADS=2 node .cache/mesh-export/operator-defaults.mjs
```

Fresh full CI:
[run 39058206798](https://github.com/ryanjosephkamp/splashery/actions/runs/39058206798). Its
complete result and every failure's isolated outcome will be recorded after all sixteen shards and
the summary finish.

Original torus geometry is CC0. The tool and this probe were made by Ryan with Codex (GPT-6), under
MIT. Rule check: none.
