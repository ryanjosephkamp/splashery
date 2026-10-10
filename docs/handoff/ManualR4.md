# Lane Manual r4 (prefix `man4`)

## Brief

Operator → Manual (Sonnet 5.5, high effort), October 10, 2026, 23:21 UTC. A new round: Manual r4
(prefix `man4`), from the owner's notes of October 10. Branch `claude/lane-manual-r4` from main
(5339c194 or newer), one PR "Phase Manual r4: the budget table, the 'What Splashery can do' page,
and the demos". Start a new handoff section "Round 4" in docs/handoff/ManualR3.md (or a new
docs/handoff/ManualR4.md that starts with this brief word for word).

1. **The splat-budget table on the site.** The owner loved the table comparing splat budgets (140k
   against 200k: speckle and shimmer up on most toys, edges barely sharper; data in
   docs/lab/SHARPNESS.md and docs/lab/BUDGETS.md). Put a clear, phone-friendly version (the table
   scrolls in its own box, no page scroll) in the manual where Level 2 or 3 talks about splat counts
   and detail, with a short plain explanation of what the columns mean and what it shows. Link it
   from the site's Learn hub (site/learn). Numbers come from those docs only; don't invent any.
2. **"What Splashery can do" as a site page.** The manual already has "What else Splashery does now"
   and "What Splashery can do that other splat tools can't". Make a site page from them (through the
   site's own build, tools/site-build.mjs and its sources), linked from the site menu or the Learn
   hub and from the manual. Keep the claims honest and current (labs toys say so).
3. **The demo placeholders**, as live demos like the four already built (covariance, reader,
   moments, smoothstep): `grammar-railroad` first, then `gaussian-3d`, `splat-numbers`,
   `bell-1d-to-3d`, `projection`, `sort-blend`, `windmill-parts`, `uv-torus` and `program-fields`.
   Check every number and formula they show (say how in the PR). If time runs short, finish fewer
   demos well rather than all of them roughly.
4. **Not in this round:** Levels 6 to 10 and any layout changes. The owner audits Levels 1 to 5 and
   the demos first; his audit decides those.

Ownership: `manual/`, `tools/manual-pdf.mjs` (small changes), `tests/man4*.spec.mjs`, and the one
new site page with its source and links (if a site file belongs to another running lane, ask me
first). Cards `man4-…` on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK, no republish): a phone-size clip or screenshot
of each demo, the table and the new page, each naming Sonnet 5.5. American English and the serial
comma. Before READY, run CLAUDE.md's "Before every push" steps. The manual is public, so the
Operator merges after the full suite and the owner's marks. Finish every turn with READY:, WORKING:
or BLOCKED:.

## State

Model: Sonnet 5.5 (claude-sonnet-5-5), high effort. Started October 10, 2026, 23:23 UTC, from main
`5339c194`. Nothing built yet.

## Notes

## Known issues

## For the Operator
