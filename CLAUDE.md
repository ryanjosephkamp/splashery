# Splashery: notes for Claude sessions

Splashery is a pure-browser toy box of 3D Gaussian splats. The owner is Ryan (GitHub
`ryanjosephkamp`). The live site is https://ryanjosephkamp.github.io/splashery/ and GitHub Pages
serves it from `main`.

**Start here:** read [docs/HANDOFF.md](docs/HANDOFF.md). It holds the current state and the phase to
work on. Do one phase per session. At the end, update HANDOFF.md with the new state and the next
phase.

## Ground rules

- Static files and ES modules only. No bundler, CDN, server, or API keys in the page. PlayCanvas
  2.22.3 is vendored in `vendor/` and imported only through `src/pc.js`.
- Build tools in `tools/` may use pinned devDependencies. List each one in `LICENSES.md`.
- Assets must be CC0, CC BY or public domain. Never BY-SA or NC. Check the licence on the live
  source page. Record it in `CREDITS.md`, in `tools/assets.json` or `tools/models.json`, and in the
  toy's in-app credit.
- Old `#s=` links and saved scene JSON (schema v2 and v3) must keep loading.
- No firearms, no logos or brand names, no gore. Flags stay respectful.
- Secrets: `HF_TOKEN` (a Hugging Face read token) is for build-time tools only. Never print it,
  commit it, or put it in logs, PRs or files. To check it, test that it is set
  (`[ -n "$HF_TOKEN" ]`), or call the whoami API and print only the account name and token role.

## Before every push

- `SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test`. Never run
  `playwright install`. Keep the "embed transfer ≤ 30 MB" test green.
- `npx prettier --check .`. If `.claude/worktrees/` exists, also pass
  `--ignore-path .gitignore --ignore-path .prettierignore --ignore-path .git/info/exclude`.
- For new or changed toys:
  - Run `node tools/check-packs.mjs <pack>`.
  - Review a contact sheet made with `tools/contact-sheet.mjs`.
  - Re-render thumbnails with `tools/make-thumbs.mjs`.
  - The tools expect `python3 -m http.server 4173 --bind 127.0.0.1` to be running.
- Take screenshots at 390×844 and 1440×900 and save them in `tests/screenshots/`.

## Pull requests

- Open draft PRs against `main`. The body has five sections: Summary, Verification, Deviations,
  Known issues, What was cut.
- The owner merges, using "Create a merge commit". Never merge yourself.
- Use the branch the session assigns. For stacked PRs, add `-<part>` suffixes and merge them in
  order.
- Report honestly. Say what was verified and what was skipped.

## Working style

- Run at most 2 or 3 subagents at once. Seven parallel builders used up a week's usage in one go.
- The owner works from the phone app. Keep replies short and plain, and give step-by-step
  instructions whenever the owner has to do something.

## Where things are

- `README.md`: features and code layout.
- `docs/ROADMAP.md`: the plan.
- `docs/BACKLOG.md`: what is not being built now, and what would unblock it.
- `docs/PACKS.md`: how to write toy recipes.
- `docs/SCENE-SCHEMA.md`: the scene format.
- `CREDITS.md` and `LICENSES.md`: attributions and licences.
