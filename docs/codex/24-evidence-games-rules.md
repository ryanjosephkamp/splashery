# Codex task 24: are the rules right? Games and sports

**Branch:** `codex/evidence-games-rules`, cut from `main`. **Output, and nothing else:**
`docs/audits/games-rules-2026-10.md`, `tests/games-rules.spec.mjs` (one new test file), and one
`docs/evidence/<toy id>.json` for each game toy you check.

The effect rules (CLAUDE.md) say: "Games follow real rules. Balls and discs move like the real thing
when thrown or hit." The chess toy, the board and card games, the arcade and the sports balls state
rules in their How-to texts and enforce them in code. Nothing checks those rules against the real
ones. Read `docs/evidence/README.md` first: it defines the evidence file.

## Steps

1. **List the games.** Everything on the `arcade` shelf and every game in `src/packs/games.js`,
   `src/chess.js` and `src/arcade/` (give `file:line` for each). Say which have rules that can be
   right or wrong, and which are free play.
2. **Check each rule** against the official rules: for a board or card game, the federation's or
   publisher's rules page; for a sport, its governing body's rulebook. Open the page, quote the
   line. Cover at least:
   - Chess: every piece's move, castling, en passant, promotion, check, checkmate and stalemate, the
     draw rules the toy claims. Use known positions (perft counts for the start position at depths 1
     to 3: 20, 400, 8,902; Kiwipete at depth 1: 48) as the independent reference.
   - Scoring and turn order in each other game, and what ends it.
   - Balls: the real mass, diameter and bounce class the toy claims against the sport's standard,
     and whether a drop from a given height rebounds to a believable fraction (compare to the
     governing body's rebound test, where one exists).
3. **Tests.** `tests/games-rules.spec.mjs` drives the game's own logic (through `page.evaluate`, or
   by importing its module in the test) with the reference positions and sequences above and checks
   the results. It must pass on `main`. A failing rule is a finding, not something to fix: write the
   test to document it with `test.fail()` and say so in the report.
4. **Evidence files**, one per game with rules, exactly in the README's shape, in plain American
   English, naming no model, agent or tool.
5. **The report:** a summary of at most ten lines, then every rule that is `wrong` or `simplified`
   with its source and a proposed fix for the Arcade or Games lane, then the games skipped.

Needs the web. Don't edit `src/`. Before you push: the new test passes on `main`
(`SPLASHERY_CHROMIUM=<path to Chromium> npx playwright test tests/games-rules.spec.mjs`), and
`npx prettier --check .` and `node tools/us-english.mjs --diff` are clean. Open a draft PR titled
"Codex task 24: are the rules right? Games and sports".
