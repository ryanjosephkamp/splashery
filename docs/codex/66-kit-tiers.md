# Codex task 66: splat tiers for the open shelves' kit toys

Do task **T2** in `builders/TASKS.md` exactly as written there, for the kit toys on three shelves:
**Science, Space and Math**. Find for each toy the lowest count at which it still reads clearly and
keeps its effect, and the count above which more splats add nothing; fix recipes that fall apart at
the low tier (in `src/packs/` only); propose engine tier changes in the PR without making them.

Branch `codex/t2-open-shelves`: one draft PR against `main` with the table, screenshots at 390×844
per tier, a clip of each changed effect at the low tier (on `codex/t2-open-shelves-clips`, never
merged), and the record. Don't touch the files of the open PRs (#560, #562, #566, #581 and #582) or
the toys that tasks 44, 45, 49, 61, 62 and 63 change. Before you push: `npx prettier --check .` and
`node tools/us-english.mjs --diff` are clean.
