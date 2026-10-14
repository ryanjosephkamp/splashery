# Codex task 11: real physical properties for the hands-on toys

**Branch:** `codex/hands-on-materials`, cut from `main`. **Output, and nothing else:**
`tools/hands-on-materials.json` and `docs/audits/hands-on-materials-2026-10.md`.

The owner approved the whole Hands-on Plan (`docs/HANDS-ON-PLAN.md`): every toy can be picked up and
thrown, and many get their own material so a throw moves like the real thing. Lane Hands-on engine A
(a Claude lane) builds the materials engine. This task gives it real numbers, each with a source.

## Steps

1. **The list.** Every toy in `docs/HANDS-ON-PLAN.md` whose line mentions a throw, a bounce, a spin,
   floating, drifting or flying: all 25 balls, plus the paper plane, baseball cap, beach ball,
   shuttlecock, flying disc, hot-air balloon, water polo ball, lotus, iceberg, ocean liner,
   submarine, sailboat, rubber duck, dice, hockey puck, spinning top and yo-yo. Add any others the
   plan's lines need.
2. **The numbers**, per toy, for the real object (official sizes where a sport sets them):
   - mass (kg) and size (diameter or length, width and height, in m);
   - coefficient of restitution on a hard floor (and on grass or water where the plan's line uses
     it);
   - sliding and rolling friction;
   - drag coefficient, and lift for fliers (paper plane, disc, shuttlecock, beach ball);
   - typical spin when thrown or hit (rev/s), where it matters (baseball, golf ball, ping-pong,
     American football, flying disc);
   - average density against water (does it float, and how deep).
3. **Sources.** For every number, a link you opened (a rulebook, a standards body, a physics paper,
   a manufacturer's spec sheet) and the quoted line. If a number comes from a calculation (density
   from mass and size), show it. Mark anything you could not confirm as `"unconfirmed": true`, and
   give your best estimate with the reason.
4. **The JSON.** `tools/hands-on-materials.json`: one object per toy id (as in `src/toys.js`), with
   the fields above in SI units, a `sources` array, and `notes`. Keep it valid JSON, sorted by toy
   id.
5. **The report.** `docs/audits/hands-on-materials-2026-10.md`:
   - a summary of at most ten lines;
   - one table (toy, mass, size, restitution, drag, floats?);
   - the unconfirmed values and why;
   - anything in the plan that real physics contradicts (for example a toy the plan says floats that
     would sink).
6. **Before you push.** `npx prettier --check .` and `node tools/us-english.mjs --diff`. Open a
   draft PR against `main` titled "Codex task 11: real physical properties for the hands-on toys".

No code changes, no new dependencies. Web pages only for reading.
