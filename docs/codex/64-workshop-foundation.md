# Codex task 64: the Workshop foundation

Do task **T11** in `builders/TASKS.md` exactly as written there (read `builders/WORKSHOP.md`, "The
Workshop foundation", first): the `workshop/` index page, the project template, the labs-gated link
(its own small "Engine: …" PR, merged first), the smoke test `tests/wks.spec.mjs`, and the compare
view with a budget slider and frame-rate and memory readouts.

Branches `codex/t11-workshop-engine` and `codex/t11-workshop`: two draft PRs against `main`. Don't
touch the files of the open PRs (#560, #562, #566, #581 and #582). Before you push:
`npx prettier --check .` and `node tools/us-english.mjs --diff` are clean.
