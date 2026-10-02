# Codex task 05: old links and saved scenes keep loading

**Branch:** `codex/compat-tests`, cut from `main`. **Output:** a new test file
`tests/cdx-compat.spec.mjs`, its fixtures in `tests/fixtures/cdx-compat/` and a short report
`docs/audits/compat-2026-10.md`. Don't edit any other file. If something old no longer loads, report
it; don't fix `src/`.

A rule of the project: old `#s=` links and saved scene files (schema versions 2 and 3, see
`docs/SCENE-SCHEMA.md`) must keep loading. Today only a few tests check it. Build a corpus from the
project's own history and lock it in.

1. **Collect real old scenes from git history** (`git log -p`, all branches merged into `main`).
   Look in:
   - the tests, docs and fixtures;
   - the scene encoder and decoder in `src/` at each schema change;
   - the toy ids and options as they were at each date.

   Gather 40 to 80 cases:
   - every schema version that loads (2 and 3);
   - toys that were renamed or moved shelves;
   - options and patterns and motions of each kind;
   - links made before and after each change to the hash format.

   A version-1 file must be refused with its message, so include one. Write each case as a JSON or
   link fixture, with a comment giving the commit it came from.

2. **Write `tests/cdx-compat.spec.mjs`.** For each case, load it the way a visitor would: the `#s=`
   link at `/` and at `/embed/`, and the file through the open-scene path the tests already use.
   Check that:
   - the right toy loads;
   - its options, pattern and motion come back;
   - there are no page errors.

   Reuse the helpers in `tests/` (look at how `tests/help.spec.mjs` and `tests/g.spec.mjs` load
   hashes). Keep the whole file under 2 minutes on a laptop.

3. **Run it:** `SPLASHERY_CHROMIUM=<path> npx playwright test tests/cdx-compat.spec.mjs` with the
   static server on port 4173. Also run `tests/smoke.spec.mjs` and `tests/help.spec.mjs` to show
   nothing else changed.
4. **Report** in `docs/audits/compat-2026-10.md`: open with a summary of at most ten lines, then
   list the cases. For any that don't load, give the commit that broke them, the error, and a
   suggested fix.

Run `npx prettier --check` on your files and `node tools/us-english.mjs --diff` before you push.
