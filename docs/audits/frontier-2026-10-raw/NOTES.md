# Task 108 raw evidence — never merge this branch

Codex (GPT-6), October 17, 2026. Report/prototype branch: `codex/frontier-research`.

- `source-checks.json`: 110 opened report URLs, response status, fetch method, byte count, final
  URL, and body SHA-256. Checkpoint requests were HEAD only: no weights were downloaded.
- `license-checks.json`: root license text provenance and GitHub classification; the report also
  checks component and checkpoint licenses. Root classification is not complete-pipeline clearance.
- `browser-results.json`: actual desktop CPU results at desktop and phone-width layouts; these are
  not phone hardware results or neural inference timings.
- `verify.mjs`: original Playwright harness; requires this session's node_modules and Chromium
  paths, plus a static server on port 4173. It is original MIT code. It exercises the pages from the
  report branch, not this clips branch.
- Screenshots: original prototype output, opened for visual inspection. The inline procedural
  samples are CC0. Made by Ryan with Codex (GPT-6).

Research decisions: prefer small model-free browser stages over unported desktop networks; keep
inference, rendering, asset rights, and code rights separate. The depth-light probe uses analytic
geometry/albedo. The LOD probe uses a local worker packet stream, not HTTP. Real phones, real-asset
SOG decoding, learned models, peak process memory, and WebGPU remain unmeasured.

Source bodies were temporary research input. This branch preserves their hashes and facts, not
unlicensed implementation files, author demo scenes, or weights. The manifest snapshots are
sufficient to identify what was checked but do not guarantee future URL content. Model revisions are
recorded separately below.

Final repository preflight: all 270 tests and every other step passed after merging current main.
See `preflight.log` and `verification.json`. Generated repository screenshots were restored; none
are in the deliverable branch. The full suite beyond preflight was not run.
