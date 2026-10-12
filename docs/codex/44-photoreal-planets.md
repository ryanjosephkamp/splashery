# Codex task 44: the photoreal planets, polished

**Branch:** `codex/photoreal-planets`, cut from `main`.

**You may change:** `src/packs/space-r2.js`, `src/space/` (except `kepler.js`, `orbit-field.js` and
`galaxies.js`), new or changed files under `assets/toys/real-worlds/` and `assets/toys/real-earth/`,
their entries in `tools/assets.json` and `CREDITS.md`, new `tools/cdx-sp5-*.mjs`, new
`tests/cdx-sp5*.spec.mjs`, and a report at `docs/audits/photoreal-planets-2026-10.md`. The public
Space shelf (`src/packs/space.js`) stays as it is.

## Where it stands

The photoreal worlds (labs, pack `space-r2`: Real Moon, Real Mars, Real Earth, Real Mercury, Real
Venus, the moons and the small worlds) put real maps (NASA, NOAA and mission mosaics; sources in
`tools/assets.json`, `spaceSamples`) on a splat globe, with a tap that zooms into real tiles. Known
issues (docs/handoff/SpaceR2.md, SpaceR3.md): no shadows in the lighting; the splat sort is
imperfect on a turned ball; the moons have no elevation maps and their map seams show; feature names
are treated as circles; Io, Titan and the other moons zoom only a little; the zoom tiles add about
75 MB to the repo; on a phone, zoom starts after a rebuild of one to three seconds.

## Steps

1. **Measure first.** For each world at 390x844 and 1440x900: load size, time to first picture,
   frame time, the zoom delay on a phone profile (4x CPU throttle), and a contact sheet of each
   globe turned to four angles (to show seams and sort errors).
2. **Look real.** A lit terminator with soft shadows from relief, no visible seams, elevation for
   every moon that has a public-domain or open DEM (record each), and a correct sort when the globe
   turns.
3. **Zoom.** Deeper zoom where the data allows it; no rebuild pause on a phone (prepare the next
   level ahead, or reuse the globe's splats).
4. **Lighter.** Re-encode the zoom tiles so the repo's share drops by at least half with no visible
   loss at phone size; keep each world's default load within D4 in `builders/RULES.md`.
5. **Assets.** Public domain, CC0, CC BY or CC BY-SA only, each checked on its live source page and
   recorded (B1, B2). NASA images stay credited to their mission and source page.
6. **Tests.** `tests/cdx-sp5*.spec.mjs`: each world loads, the seam metric and the zoom delay stay
   under the thresholds from your measurements, and the "embed transfer ≤ 30 MB" test in `smoke`
   stays green. Keep green: `sp2`, `sp3` and `sp4`.
7. **Report.** `docs/audits/photoreal-planets-2026-10.md`: before-and-after tables and contact
   sheets, and clips of each world turning and zooming at 390x844 (`tools/effect-clip.mjs`) in the
   PR.

Before you push, run `npx prettier --check .` and `node tools/us-english.mjs --diff`. Open a draft
PR titled "Codex task 44: the photoreal planets, polished" with the five sections from CLAUDE.md and
a "Rule check" line (`builders/RULES.md`).
