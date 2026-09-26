# Splashery: notes for Claude sessions

Splashery is a pure-browser toy box of 3D Gaussian splats. The owner is Ryan (GitHub
`ryanjosephkamp`). The live site is https://ryanjosephkamp.github.io/splashery/ and GitHub Pages
serves it from `main`.

**Start here:** read [docs/HANDOFF.md](docs/HANDOFF.md) (the state of main and the active lanes) and
[docs/OPERATING.md](docs/OPERATING.md) (how parallel sessions work). A lane session then reads its
row in [docs/WORKSTREAMS.md](docs/WORKSTREAMS.md) and its own `docs/handoff/<lane>.md`, does that
lane's work, and keeps its handoff file current. Only the Operator session edits HANDOFF.md.

## Parallel sessions

Several sessions build at once: one per lane, plus the long-lived Operator session that plans and
coordinates. [docs/OPERATING.md](docs/OPERATING.md) has the rules. In short:

- A lane edits only the files it owns (its row in WORKSTREAMS.md) and its own toys' entries in the
  shared lists (`src/toy-sounds.js`, `tools/toy-plan.json`, `src/toys.js`, credits).
- Regenerate TOY-PLAN.md; never merge it by hand.
- No engine changes in a lane PR: a small, additive "Engine: …" PR, merged first.
- Never edit `tests/taps.spec.mjs` (it finds every kit toy's tap by itself); a lane's extra tests go
  in `tests/<prefix>.spec.mjs`.
- Lanes post clips and cards to the Effect review page without republishing it (OPERATING.md, "Steps
  for a lane").
- When main moves, merge it into your branch; never rebase a pushed branch.

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

## Effect quality rules

The owner's reviews set these (details and examples in docs/PACKS.md, "Effect quality"). Check every
new or changed effect against them before calling it done.

- Real motion, not a warped picture. Parts move as solid pieces. Never bend a scan with soft regions
  for a visible effect. If a scan cannot move a part cleanly, cut the part out with hard edges, swap
  in a kit-built part, rebuild the toy as a kit toy, or choose a different effect.
- Separate things move separately (each tomato, each drupelet, each chess piece).
- Break-apart effects break into real pieces that fall off and come back.
- Instruments are played: the strings, keys or skins visibly move with each note.
- Things that talk move their mouths. Animals and statues move like the real thing.
- Games follow real rules. Balls and discs move like the real thing when thrown or hit.
- Materials look like the real material: no see-through solids, no blur, no speckle.
- The grape (a peel that shows the pale flesh) is the bar: a clear, physical effect you read at a
  glance.
- Judge effects as motion at phone size, not only as small stills: render a clip of each changed
  effect (`tools/effect-clip.mjs`) and publish them on the private "Effect review" page for the
  owner before asking for a merge.

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
- Take screenshots at 390×844 and 1440×900 and save them in `tests/screenshots/`. A lane names its
  own `<prefix>-<name>-390x844.png` and `…-1440x900.png`, and after the full test run puts the
  standard screenshots back with `node tools/upkeep.mjs --restore-shots` (the Operator refreshes
  them on main).

## Pull requests

- Open draft PRs against `main`. The body has five sections: Summary, Verification, Deviations,
  Known issues, What was cut.
- The owner merges, using "Create a merge commit", in any order. Never merge yourself.
- Use the branch the session assigns. For stacked PRs, add `-<part>` suffixes and merge them in
  order.
- A lane opens one PR titled "Phase <lane>: …". The Operator's PRs are "Ops: …" on
  `claude/operator-<topic>`. Keep your PR mergeable: when main moves, merge it into your branch.
- Report honestly. Say what was verified and what was skipped.

## Working style

- Run at most 2 or 3 subagents at once. Seven parallel builders used up a week's usage in one go.
  While lanes run in parallel (at most three at once, plus the Operator), a lane uses at most one
  helper at a time.
- The owner works from the phone app. Keep replies short and plain, and give step-by-step
  instructions whenever the owner has to do something.

## Where things are

- `README.md`: features and code layout.
- `docs/OPERATING.md`: how parallel sessions work. `docs/WORKSTREAMS.md`: the lanes and who owns
  what. `docs/handoff/`: each lane's file and `history.md` (the phase notes from A to E4).
- `docs/ROADMAP.md`: the plan.
- `docs/BACKLOG.md`: what is not being built now, and what would unblock it.
- `docs/TOY-PLAN.md`: every toy's planned tap effect, sound and fixes, generated from
  `tools/toy-plan.json` by `node tools/toy-plan.mjs` (run it after adding or finishing a toy).
- `tools/upkeep.mjs`: the Operator's upkeep after a merge (TOY-PLAN.md, the Sound Board page file,
  the standard screenshots). `tools/sound-board.mjs` builds the Sound Board page.
- `docs/reviews/`: the owner's reviews, verbatim, with screenshots.
- `docs/PACKS.md`: how to write toy recipes.
- `docs/SCENE-SCHEMA.md`: the scene format.
- `CREDITS.md` and `LICENSES.md`: attributions and licences.
