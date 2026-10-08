# Codex task 30: docs that match the code

**Branch:** `codex/docs-cleanup`, cut from `main`. **Output:**
`docs/audits/docs-cleanup-2026-10.md`, plus small fixes to `README.md`, `SPEC.md`, `docs/PACKS.md`,
`docs/SCENE-SCHEMA.md`, `docs/FLUIDS.md`, `docs/WORLDS.md` and `docs/ROADMAP.md` only. **Don't
edit** `docs/HANDOFF.md`, `docs/OPERATING.md`, `docs/OPERATOR.md`, `docs/WORKSTREAMS.md`,
`docs/handoff/`, `docs/reviews/`, `docs/TOY-PLAN.md` (it is generated), `CLAUDE.md`, `AGENTS.md` or
`docs/codex/`. For problems in those, write them in the report for the Operator.

The docs were written by many sessions over weeks, and the code moved on. A newcomer (or Codex)
reading `README.md` should get the right picture.

## Steps

1. **README.md.** Check the feature list and the "code layout" against the real tree
   (`ls src tools tests site manual worlds`): every directory and key file named exists; major ones
   that exist are named; counts ("about 76 spec files", toy counts, shelf counts) are right (compute
   them; the shelf list is `CATEGORIES` in `src/toys.js`). Fix what is wrong, in American English.
2. **Every path in the editable docs.** Extract each file path, function name, scene field and
   command in backticks. Report the ones that don't exist (use `git ls-files`, and `grep` for
   names). Fix in the editable docs when the right name is clear; list the rest.
3. **`docs/SCENE-SCHEMA.md`.** Compare it with `src/state.js` and the scene encoders: every field
   the code writes or reads is documented, with the right type and default, and every documented
   field exists. List differences; fix the doc (never the code). Schema v2 and v3 compatibility must
   stay described accurately.
4. **`docs/PACKS.md`.** Run the examples' shape against a real pack in `src/packs/` and against
   `node tools/check-packs.mjs` (read the script for the rules it enforces): is every rule it checks
   in the doc, and does the doc claim rules it doesn't? Fix.
5. **Commands.** Every command shown in the editable docs (`node tools/…`, `npx …`) is run with
   `--help` or read: does the file exist and take those options? List the stale ones.
6. **Duplicates and stale statements.** Find passages that appear in two docs (CLAUDE.md,
   OPERATING.md, README.md) and disagree, and statements that are dated ("next week", "not yet
   built") and were overtaken. List each with both locations; fix the editable ones.
7. **The report:** a summary of at most ten lines, every change you made (file, line, before,
   after), and a section "For the Operator" with the problems in the files you may not edit.

No web needed. Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff`.
Open a draft PR titled "Codex task 30: docs that match the code".
