# Codex task 65: old links and saved scenes, locked in by tests (task 05, finished)

**Branch:** take over `codex/compat-tests` and its PR #197 (task 05): merge the latest `main` into
it (never rebase or force-push) and finish it. Read `docs/codex/05-compat-tests.md`, the comments on
#197, `docs/SCENE-SCHEMA.md` and Rules v1 D3 ("Old share links (`#s=`) and saved scenes (schema v2
and v3) keep loading").

## Goal

1. Bring the corpus up to date: at least 60 historical `#s=` links and saved scene files (schema v2
   and v3), drawn from the repo's history (tests, docs, fixtures, and the toys that existed at each
   schema version), covering every toy shelf, Worlds scenes, the Studio's saved outputs, and the
   oddities (empty scenes, unknown toy ids, extra fields).
2. One test file that loads every one in a real browser and checks that it opens without an error,
   shows the right toys in the right places, and saves back to the current schema without losing
   anything. Where an old link no longer loads, find the commit that broke it and report it; fix it
   only if the fix is small and outside the engine, otherwise propose an "Engine: …" fix.
3. A short guide in `docs/SCENE-SCHEMA.md` on adding a case to the corpus whenever the schema
   changes.

Don't touch the files of the open PRs (#560, #562, #566, #581 and #582). Before you push:
`npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.
