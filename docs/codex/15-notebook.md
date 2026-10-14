# Codex task 15: the lab notebook, brought up to date

**Branch:** `codex/notebook`, cut from `main`. **Output, and nothing else:** `docs/NOTEBOOK.md`.

`docs/NOTEBOOK.md` is the running record of how Splashery is built: one entry per lane when it
merges (date, lane, model, what it built, how long it ran, the numbers that matter, what we
learned). Its last entries are from September 29, 2026; many lanes have merged since. The owner will
show it, with the site, to people who want to know how it was made.

## Steps

1. **Read** `docs/NOTEBOOK.md` (its format and tone), `docs/WORKSTREAMS.md`, `docs/HANDOFF.md`, and
   the handoff files in `docs/handoff/`.
2. **List every lane PR merged since September 29, 2026** (the GitHub API or `git log --merges` on
   `main`), grouped by lane and round. Leave out Ops PRs and Codex PRs, except one entry that sums
   up the Codex audits.
3. **One entry per lane round**, in the existing table and date order: the merge date (from the
   merge commit), the lane, the model (from its PR body or handoff file; write "not recorded" if it
   isn't), what it built in one or two plain sentences with its PR numbers, and notes: the numbers
   that matter (tests, sizes, counts, timings) and anything learned, taken only from the PR bodies
   and handoff files. Invent nothing; mark anything uncertain.
4. **Keep the existing entries as they are.** American English for new text, plain words, short
   sentences.
5. **Before you push:** `npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.
   Open a draft PR against `main` titled "Codex task 15: the lab notebook, brought up to date".
