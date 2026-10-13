# Codex task 58: Picture QR theme packs (after #582 merges)

**Branch:** `codex/qr-theme-packs`, cut from `main` **after PR #582 (task 54) has merged**. One
draft PR against `main`.

Read `AGENTS.md`, `builders/RULES.md` (A3 allows AI-made pictures as labeled Picture QR
backgrounds), `docs/audits/sample-pictures-2026-10.md` (what makes a background keep detail and
still scan), `src/qr-craft/picture.js`, `src/qr-craft/samples.js` and task 54's background list.

## Goal

1. **Six theme packs of 8 backgrounds each (48 kept, from at least 120 candidates):** Seasons,
   Ocean, Forest, Space-art (clearly art, never presented as a real sky or real data), Patterns
   (made by code), and Celebrations (no text, no logos, no flags of real countries). AI-made or made
   by code; label each as such beside it.
2. **Every background scans with any link:** test each with at least 10 different links (short and
   long, http and https, with query strings) at the toy's default error-correction level and at
   phone and print size; keep only those that scan in every trial. Record the scan rate and the
   detail score of each.
3. A theme picker in the Picture QR's sample list (a group per theme), each background loaded only
   when picked; records in `CREDITS.md` and `tools/assets.json` (AI-made ones with `ai: true` and
   the owner's AI-made wording; code-made ones CC0, "made by Ryan with Codex").

## Don't touch

The files of the open PRs (#560, #562, #566 and #581) and `manual/`.

## Report

`docs/audits/qr-theme-packs-2026-10.md` with a contact sheet per theme at phone size and the scan
table. Tests: `tests/cdx-qr-themes.spec.mjs` (every kept background scans with several links), plus
`qr*`, `smoke`, `help`, `unit` and `taps`. Before you push: `npx prettier --check .` and
`node tools/us-english.mjs --diff` are clean.
