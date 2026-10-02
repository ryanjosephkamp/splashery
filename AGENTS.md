# Splashery: notes for Codex

Splashery is a pure-browser toy box of 3D Gaussian splats, built mostly by Claude sessions that a
coordinating "Operator" session runs (see `CLAUDE.md` and `docs/OPERATING.md`). The owner, Ryan
(GitHub `ryanjosephkamp`), starts Codex tasks himself with one line each, for example: "Read
docs/codex/01-about-audit.md in this repository and do it."

## Rules for Codex tasks

- Work on the branch the task names (`codex/<name>`), cut from `main`, and open one draft pull
  request against `main`. Leave it a draft (don't mark it ready for review). Never merge, and never
  push to anyone else's branch.
- Follow the ground rules in `CLAUDE.md`: American English for new text (color, center, gray,
  license, -ize endings, dates like "October 2, 2026"); assets only under the licenses it allows; no
  logos, brand names or insignia.
- Change only what the task says you may change. Reports go in `docs/audits/`.
- Cite every outside fact with a link you actually opened. If you can't confirm something, say so.
- Before you push: `npx prettier --check .` and `node tools/us-english.mjs --diff`. If you change
  anything under `src/`, also run the Playwright tests the task names
  (`SPLASHERY_CHROMIUM=<path to Chromium> npx playwright test <files>`), and say in the PR which
  ones you ran and which you couldn't.
- The pull request has five sections: Summary, Verification, Deviations, Known issues, What was cut.
  Say in the Summary that Codex built it.
