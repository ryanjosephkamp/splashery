# Codex task 06: load and frame-time audit

**Branch:** `codex/perf-audit`, cut from `main`. **Output:** `docs/audits/perf-2026-10.md` and its
data in `docs/audits/perf-2026-10/` (CSV or JSON) only. Change nothing else.

Splashery loads each toy's splats on demand. On a phone, a heavy toy can take long to open, run hot,
or drop frames. One test keeps an embedded captured toy under 30 MB of transfer
(`tests/smoke.spec.mjs`, "an embedded captured toy stays under 30 MB of transfer"). The owner wants
to know which toys are heavy and what would make them lighter without looking worse.

Use a local server (`python3 -m http.server 4173 --bind 127.0.0.1`) on `main` and Playwright with
the Mac's Chrome.

1. **Measure every public toy**, and the labs toys in a second table. For each toy, at the phone
   setting (390×844, device scale 3, the weak profile the tests use for phones) and at 1440×900,
   record:
   - the bytes transferred to open it;
   - the time until its first frame;
   - its splat count;
   - its median and 95th-percentile frame time over 5 seconds idle and over 5 seconds after a tap;
   - its JS heap after opening.

   Read `tests/` and `src/app.js` to find how the tests wait for a toy to be ready and how they pick
   a profile. Save the raw numbers.

2. **The 25 heaviest toys** on each measure, with the cause where you can tell. For example:
   - a full capture where the lite file would do;
   - a mesh sampled into too many splats;
   - a big texture;
   - an effect that rebuilds every frame;
   - a sound that loads up front.
3. **What would help**, toy by toy: a lighter file, fewer splats, lazy loading, or caching. Estimate
   the saving. Say what would look worse if done.
4. **Site-wide:**
   - the gallery's own load (thumbnails, scripts);
   - anything loaded before the visitor picks a toy;
   - whether PDF.js, omggif, ONNX Runtime and the depth model stay unloaded until a toy needs them;
   - the cache headers GitHub Pages sends.
5. **Write the report.** Open with a summary of at most ten lines, then tables, worst first, with
   file:line for causes.

Run `npx prettier --check docs/audits/perf-2026-10.md` and `node tools/us-english.mjs --diff` before
you push.
