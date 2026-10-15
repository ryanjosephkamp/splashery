# Share PNG mask study

Codex (GPT-6), recorded October 15, 2026 at 12:10:11 PM EDT. Rule check: none.

The
[Operator requested independent location again](https://github.com/ryanjosephkamp/splashery/pull/664#issuecomment-6195994236).
The earlier geometry-assisted change checked less than the original assertion. It is now a separate
diagnostic only. Both smoke and route assertions use each reader's ordinary finder, with no geometry
hints.

## Found and decoded exactly

Each fraction is the number of 50 exported images that the named vendored reader independently found
and decoded to the exact scene URL. This is not a physical phone scan.

| Reader | 390 pixels before | 390 pixels after | 1130 pixels before | 1130 pixels after |
| ------ | ----------------- | ---------------- | ------------------ | ----------------- |
| jsQR   | 50/50             | 50/50            | 50/50              | 50/50             |
| ZXing  | 45/50             | 50/50            | 33/50              | 50/50             |

All 50 before/after pairs encode identical URLs. Their real app-export scene objects differ only in
createdAt; 50 creation timestamps are unique. Links are 753–757 characters, version 22, 105 modules,
correction M, with a four-module white quiet border. Untouched exports are 1130×1130. The unchanged
phonePNG helper scales their saved PNG bytes to exactly 390×390. Both phases use Chromium
151.0.7922.173, DPR 1, the local loopback origin, labs, profile mid, adapt off, and software WebGL2.
Another phone cannot reach this server through the loopback URL.

18/50 exports selected a different mask; at most 8 candidates were tried. The URL, version,
correction level, dimensions, colors, and quiet border are unchanged. Save PNG loads the
already-vendored readers, tries the penalty-selected mask and then remaining masks without
repetition, and downloads only a candidate both readers find at phone and native sizes (390 and 1130
pixels for these links). If no candidate passes, the dialog offers Save JSON. The reader-load
failure and retry path is tested. The displayed code before saving keeps the encoder's choice; this
change targets the export. No wait was increased.

## Provenance and evidence

- Original exporter: commit `c4ce886289be9d73a2e3c242967238e66d1a5b5e`. Its modules loaded before
  production edits and stayed cached in the same browser page throughout the baseline. The tool
  checkout was dirty with tests and the new measurement script; buildCommit identifies that
  checkout, not an automatically verified server build. Before export metadata has no selector, and
  validation reconstructs every native baseline raster from its original automatic mask. See
  [source provenance](source-provenance.json).
- Corrected exporter: committed source `f567e0be91dff6a11397cf62a9539a6f46858a99`; the after phase
  started with a clean tree and a fresh browser. The measurement freezes each previously recorded
  real app.exportScene result through an inherited app facade so both dialogs encode identical
  inputs. Rendering, QR encoding, Save PNG, browser downloads, resizing, and decoders remain real.
- [Inputs](inputs.json), [all 50 before results](before-records.json),
  [all 50 after results](after-records.json), and phase summaries ([before](before-summary.json),
  [after](after-summary.json)). Each result names its original PNGs and retains dimensions, SHA-256,
  exact decoded strings, selected mask, and attempted masks. All 200 PNGs are preserved here.
- [Independent validation](validation.json) re-reads every PNG with the unchanged vendored bundles
  in Node using ordinary finder APIs: 400 independent reads match the browser records. It checks
  hashes, dimensions, exact paired URLs, timestamp-only variation, and native raster pixels against
  the recorded masks. Matrix comparison is artifact validation, never the acceptance decoder.
  [Validation source](validate-source.mjs) retains the exact local script; its paths assume the
  repository workspace.
- [Measurement source](measurement-source.mjs), [before log](long-before.log),
  [after log](long-after.log), [counterexample failing before the fix](counterexample-red.log),
  [16 targeted passing tests](targeted.log), and [10 passing notice tests](notices.log). Geometry
  diagnostics and their rejection tests remain separate from the restored unassisted assertion.

## Dialog review

| State                                      | Phone                                     | Desktop                                     |
| ------------------------------------------ | ----------------------------------------- | ------------------------------------------- |
| Saved and independently readable           | [390×844](share-saved-390x844.png)        | [1440×900](share-saved-1440x900.png)        |
| Reader load failed; JSON and retry offered | [390×844](share-reader-error-390x844.png) | [1440×900](share-reader-error-1440x900.png) |

Matching JSON capture metadata and accessibility trees are beside each image. Reader-error captures
deliberately block only the local ZXing script request. The four missing-file screenshots in the
parent audit remain unchanged and await the owner's look.

## Run it again

Use two checkouts: serve the original exporter from c4ce8862, then the corrected exporter from
f567e0be, at the same origin. Run the current measurement tool from the corrected checkout in both
phases so the script exists there. With the original exporter served:

```sh
SPLASHERY_CHROMIUM=/path/to/chromium ADV_SHARE_PHASE=before ADV_SHARE_OUT=.cache/advisor-share-masks node tools/adv-share-masks.mjs
```

Then serve the corrected exporter and replay the retained inputs:

```sh
SPLASHERY_CHROMIUM=/path/to/chromium ADV_SHARE_PHASE=after ADV_SHARE_OUT=.cache/advisor-share-masks node tools/adv-share-masks.mjs
```

SPLASHERY_URL can select a different server port. The tool requires at least 50 cases and the same
inputs file, and never dispatches Actions. Keep the same origin in both phases to preserve exact
paired URLs.

## Limits

These 50 scenes sample timestamp changes for this one version 22 scene, not every link length or
device. The earlier saved counterexample additionally passes the real export path. Mask trials can
cost time on a slower device; hardware latency was not measured. On-screen QR detection before
saving, camera perspective, and physical second-phone scans are not established by the 50-case
study. Existing camera-view Share regressions passed separately. Full-suite Actions proof remains
pending the Operator's full-suite label. The clips branch is evidence only and must never be merged.
