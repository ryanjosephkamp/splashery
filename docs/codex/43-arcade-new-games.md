# Codex task 43: three new arcade games, played by real rules

**Branch:** `codex/arcade-new-games`, cut from `main`.

**You may change:** new game modules `src/packs/arcade-<game>.js`, the arcade's recipe list
(`src/packs/arcade.js`, only to add your games), your games' own lines in the shared lists
(`src/toys.js`, `src/toy-help.js`, `src/toy-sounds.js`, `tools/toy-plan.json`, `tools/assets.json`,
`CREDITS.md`), new `tools/cdx-arc4-*.mjs`, new `tests/cdx-arc4*.spec.mjs`, and new thumbnails. You
may add to the shared arcade helpers (`src/arcade/`, `src/packs/arcade-crisp.js`) only in ways that
leave the twelve current games exactly as they are. Never edit `tests/taps.spec.mjs`; it finds every
toy's tap on its own.

## Why

The Arcade has twelve games, all behind the labs switch, every one marked good by the owner
(docs/handoff/Arcade.md, ArcadeR2.md, ArcadeR3.md: Shardball, Longtail, Grain Garden, Page Breaker,
Strata, Volley Table, Stone Belt, Soft Landing, Night Owl Pinball, Cast a Shadow, Photo Dash and
Note Rider). The owner wants more, of the same high quality.

## Steps

1. **Pick three.** Read the three Arcade handoffs and play the current games. Propose five games
   that are new to the arcade and that splats suit, with real rules and real physics: for example
   mini golf, bowling with real scoring, pool (eight-ball rules), air hockey, or curling. Write one
   paragraph each in the report, then build the best three. A game "follows real rules" (CLAUDE.md,
   "Effect quality rules"): balls and pucks move like the real thing when hit, scoring is the real
   scoring.
2. **Build each one** like the current games: `ArcadeRuntime` with its fixed step, the shared input
   and HUD, crisp text and lines (`arcade-crisp.js`), play and pause near the thumbs on a phone,
   touch and keyboard both, a sound for every hit (each one listed in `tools/sound-review.json` as
   "new sound to hear"), and `labs: true`.
3. **Phone first.** Every game is playable at 390x844 with one or two thumbs, holds 60 frames a
   second at the phone tier, and loads within the size guidance (D4 in `builders/RULES.md`).
4. **Content rules.** Targets are objects, never people or animals; no logos or brand names (A1).
   Any asset is CC0, CC BY or CC BY-SA, checked on its live source page and recorded (B1, B2);
   procedural assets you make are CC0 (B4).
5. **Tests.** `tests/cdx-arc4*.spec.mjs` for each game: it loads, a scripted shot or move scores by
   the rules, pause holds the state, and Reset restores it. Keep green: `arc`, `arc-engine`, `arc2`,
   `arc2-engine`, `arc3`, `help`, `hta`, `unit`, `kit`, and `taps` with `-g arcade`.
6. **Evidence.** A clip of each game being played at 390x844 with sound (`tools/arc-clip.mjs`) in
   the PR, and the five proposals in `docs/audits/arcade-new-games-2026-10.md`.

Before you push, run `npx prettier --check .`, `node tools/us-english.mjs --diff` and
`node tools/check-packs.mjs arcade`. Open a draft PR titled "Codex task 43: three new arcade games,
played by real rules" with the five sections from CLAUDE.md and a "Rule check" line
(`builders/RULES.md`).
