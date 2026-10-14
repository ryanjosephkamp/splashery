# Codex task 51: faster first load, same look

**Branch:** `codex/load-time`, cut from `main`. One draft PR against `main`.

Task 06's audit (`docs/audits/perf-2026-10.md` and its data) measured every toy's opening payload
and first frame on October 2, 2026, and found easy wins (for example, unused PLY columns: 1.33 MiB
less with the same decoded scene). Most visitors are on phones (Rules v1, D4).

## Goal

1. Re-measure on today's `main` with the same method (phone and desktop settings).
2. Ship the changes that keep every toy **pixel-identical or visually identical** while loading less
   or starting sooner: drop unused data columns; lazy-load code and assets a toy doesn't need until
   used; better compression for assets that stay lossless; cache headers can't be set (GitHub
   Pages), so prefer fewer, smaller requests; preload what the first frame needs.
3. For any change that is not pixel-identical (a smaller texture, fewer splats on the phone tier),
   don't ship it: list it with before and after stills for the owner to decide.
4. Targets: the 20 heaviest toys' opening payload down at least 25% on the phone setting, and no
   toy's first frame slower. The "embed transfer ≤ 30 MB" test stays green.

## Rules

Static files only, no bundler or CDN (D1); PlayCanvas stays 2.22.3 through `src/pc.js` (D2); old
`#s=` links and saved scenes keep loading (D3). Engine changes go in their own small additive
"Engine: …" commits with a test. Don't touch the files of the open PRs (#560, #562, #566, #581 and
#582).

## Report

`docs/audits/load-time-2026-10.md`: per toy before and after (bytes, requests, first frame), the
proof each shipped change is visually identical (an image diff), and the list of lossy options for
the owner. Run `smoke`, `taps`, `kit`, `unit` and the specs of every pack you touch. Before you
push: `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.
