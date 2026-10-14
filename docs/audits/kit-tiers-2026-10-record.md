# Record: T2, open-shelf kit tiers

## Identity and status

- Task: Codex 66 / T2, tiers for the Science, Space, and Math shelves.
- Project: 65 existing kit toys; seven task-44 worlds excluded.
- Branch: `codex/t2-open-shelves`;
  [draft PR 599](https://github.com/ryanjosephkamp/splashery/pull/599).
- Made by Ryan with Codex (GPT-6), October 14, 2026. Code is MIT.
- Status: implemented recipe repair; tier proposals await visual review.

## The recipe contract

- Hooks: existing `build`, `prepare`, `drive`, controls, and actions. Only the Math pack's
  text-cloud budget allocation changes.
- Units: existing recipe coordinates, +Y up, fitted by Kit to radius 0.95.
- Axes, pivots, and part ids: unchanged. The proof's triangle labels retain their token ids, and the
  equation copies retain their fade channels.
- Quaternion order: unchanged, x, y, z, w.
- Host APIs: existing `k.cloud` with an absolute share of the budget; existing `buildRecipe`,
  `resolveOptions`, and `Player.splatBudget` behavior.

## Generation

- Environment: the selected Linux cloud environment only; Debian 13, x86_64.
- Versions: Node 24.19.0, Python 3.12.14, Playwright 1.56.1, Chromium 151.0.7922.173. No new
  dependencies or build programs.
- Seeds: `recipe.seed` or `hash32(toy id)`, matching the player. The initial 66-check baseline used
  seed 1; the post-fix 70-check run uses player seeds.
- Options: recipe defaults, Detail at Auto, forced Low, Mid, High, or Max.
- Source checkpoint for final measurements: `130b9587a3e38fbd15f4981950784fae7676a786`.
- Exact capture, measurement, thumbnail, and test commands and final results are recorded in the
  [audit](kit-tiers-2026-10.md).

## Assets and licenses

No new source assets, external data, or libraries. Existing toy credits and licenses remain intact.
Procedural Math review renders are CC0, made by Ryan with Codex (GPT-6). Other captures retain the
underlying assets' and data's existing license terms and in-app credits; this audit does not
relicense them. Review renders remain on the separate evidence branch. The final evidence manifest
records each generated file's SHA-256 hash.

## Boundaries

- Reused: the existing catalog, recipes, Kit, player, renderer, and data.
- New: task-local measurement and safe browser tooling, regression checks, review renders, and the
  text budget repair.
- Engine changes: none. Per-toy tier recommendations are proposals only.
- Not simulated: no new simulation. Existing effects and data are retained; this task does not
  independently validate their physical models.

## Executed evidence

| Check                                            | Method                                     | Result                                              |
| ------------------------------------------------ | ------------------------------------------ | --------------------------------------------------- |
| Initial inventory and four-tier builds           | Real recipes in Node; no renderer          | 66 passed, 1.9 minutes                              |
| Glyph regression before repair                   | Real recipes in Node; no renderer          | 4 failed as expected; failure log preserved         |
| Post-fix inventory, glyphs, and four-tier builds | Real recipes in Node; no renderer          | 70 passed, 2.1 minutes                              |
| Safe browser launch                              | Sandboxed desktop Chromium, no added flags | WebGL2 available; a real Low-tier capture completed |

The shared kit, tap, and unit run passed 92 checks in 5.9 minutes. Further regression results and
final render evidence are being collected. No mock render, desktop viewport, or CPU build is claimed
as physical phone testing.

## Performance

- Requested and emitted counts per tier: recorded separately in the audit data. CPU attribute bytes
  are 72 per live kit splat, with allocated capacity recorded separately. This excludes GPU
  resources and other application memory.
- Powers of ten: base-kit counts exclude asynchronously loaded scene chunks; the browser capture
  metadata records visible chunk counts separately.
- Phone load time, phone memory, and phone frame rate: unmeasured.
- Browser load time, total browser memory, and frame rate: unmeasured.
- Node preparation and build times: diagnostic measurements only, not a device performance
  benchmark. No performance improvement is claimed.
- Baseline: main at `58f3d8ede13714bf4b3d1f99fbf3b29d7f60e492`.

Rule check: none.
