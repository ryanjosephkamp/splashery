# Operating Splashery in parallel

How several Claude sessions build Splashery at once without getting in each other's way. The owner
accepted this setup on 2026-09-26 (the "Splashery Parallel Plan" page). The ground rules and the
effect quality rules in [CLAUDE.md](../CLAUDE.md) apply to every session.

## Who does what

- **A lane** is one session with one job (a wave of toys, a set of fixes, a feature), one branch,
  one draft PR and a set of files it owns. The lanes, their files and their state are in
  [WORKSTREAMS.md](WORKSTREAMS.md). A lane builds; it does not change governance.
- **The Operator** is one long-lived session that coordinates and never builds toys. It keeps this
  file, WORKSTREAMS.md, [HANDOFF.md](HANDOFF.md) and CLAUDE.md, writes the prompts and handoffs for
  new lanes (and opens those sessions when the owner asks), does the upkeep on main after each
  merge, sends the owner a daily digest and runs the daily toy-ideas routine. Governance questions
  go to it.
- **The owner** (Ryan) opens sessions, reviews clips on the Effect review page and merges PRs. Only
  the owner merges.

Every cloud session has its own container, clone and branch, so sessions never share a working tree.
Worktrees are only for helpers inside one session. What can still collide is the shared material
around the toys; the rules below keep it apart.

## Pages

| Page                      | Link                                              | Who changes it                                                               |
| ------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| Effect review             | https://claude.ai/artifact/NCsg9V5SzFY3Mnwuwgq7pi | Lanes add clips and cards (below); the owner marks; the Operator tidies      |
| Sound Board               | https://claude.ai/artifact/VE9XCTxH3djST6dGb6ZAkj | The Operator, after merges (`node tools/upkeep.mjs`)                         |
| Toy Plan (owner's marks)  | https://claude.ai/artifact/PNGPx7REMdhxLMHDXARhw8 | The owner marks; the Operator republishes (`node tools/toy-plan.mjs --json`) |
| Splashery Parallel Plan   | https://claude.ai/artifact/KjJrfKxi4phzJmbgSyRbr7 | The Operator (the lane prompts)                                              |
| Splashery Operator Manual | https://claude.ai/artifact/3WYMJxtZDR7m1ecTCN47ZB | The Operator (the owner's how-to)                                            |

## Lanes and file ownership

Each lane owns the files in its row of WORKSTREAMS.md: usually its pack files (`src/packs/*.js`),
its handoff file (`docs/handoff/<lane>.md`), its own test file (`tests/<prefix>.spec.mjs`), its
screenshots (`tests/screenshots/<prefix>-*.png`) and its toys' folders (`assets/toys/<toy id>/`).
Only that lane edits them. Packs that no active lane owns (space, atoms, gems, tiny, anatomy, maths,
objects, vehicles, music) are frozen: a change to them needs a lane that the Operator starts.

Each lane has a **prefix**, the lane id in lower case, used for card ids, screenshot names and its
test file: `e4f`, `e5`, `e6a`, `e6b`, `f`, `g`.

### Shared files: edit only your own toys' lines

These files list every toy. A lane edits only its own toys' entries, in place: don't reorder, reflow
or reformat anyone else's lines, so git can merge the lanes line by line.

- `src/toy-sounds.js` (each toy's sound spec)
- `tools/toy-plan.json` (each toy's plan entry: `"v": "keep"` and `improved` when finished)
- `src/toys.js` (the shelf catalogue: only new toys add rows)
- `src/rigs.js` (a scan's rig)
- `tools/assets.json`, `tools/models.json`, `CREDITS.md`, `LICENSES.md` (add your lines)

### Files only the Operator edits

`CLAUDE.md`, `docs/OPERATING.md`, `docs/WORKSTREAMS.md`, `docs/HANDOFF.md`,
`docs/handoff/history.md`, `README.md`, `docs/ROADMAP.md`, `docs/BACKLOG.md`, `docs/PACKS.md`,
`tests/taps.spec.mjs`, `tools/upkeep.mjs`, `tools/sound-board.mjs`, `tools/pages/`, `package.json`
and `package-lock.json`, and the standard screenshots (below). A lane that has something for these
files writes it in its handoff file (under "For the Operator": a lesson for PACKS.md, a backlog
item, a README line) and the Operator moves it after the merge.

### Generated files

- `docs/TOY-PLAN.md` comes from `tools/toy-plan.json`. Never merge it by hand: on a conflict take
  main's copy, then run `node tools/toy-plan.mjs && npx prettier --write docs/TOY-PLAN.md`.
- The Sound Board page is built by `node tools/sound-board.mjs` from main. Only the Operator
  republishes it. If the owner wants to hear a lane's sounds before its merge, the lane builds its
  own copy (`node tools/sound-board.mjs --label=E5 --out=.cache/pages/sound-board-e5.html`) and
  publishes it as a separate new page, linked from its PR.
- Thumbnails (`assets/toys/<id>/thumb.webp`) belong to the toy's lane: re-render only your toys.

### Engine changes

Everything in `src/` outside `src/packs/` (and the shared lists above), `vendor/`, `index.html`,
`styles.css` and `embed/` is the engine. Lanes stay out of it. If a lane truly needs an engine
change:

1. Keep it small, additive and backwards compatible (every other toy behaves exactly as before; the
   laptop is locked), with a test.
2. Put it in its own small draft PR titled "Engine: …" from a branch named after the lane's branch
   with `-engine` added, and say in both PRs that the lane's PR needs it.
3. Tell the owner it should be merged first, then merge main into the lane's branch.

Lane F owns the input path (pointer handling in `src/player.js` and `src/stage.js`, and the grab and
tap code in `src/motion.js`); no other lane edits those parts.

## Handoffs

- `docs/HANDOFF.md` is a short index kept by the Operator: the state of main, the active lanes,
  where the lessons live, open decisions.
- `docs/handoff/<lane>.md` is each lane's own file: its brief (written by the Operator), then its
  state, notes, known issues and "For the Operator", kept by the lane as it works. It replaces the
  old habit of updating HANDOFF.md at the end of a phase.
- `docs/handoff/history.md` holds the phase notes from A to E4. After a lane merges, the Operator
  adds a summary of it there and moves its lessons into PACKS.md.

## Tests

- Run the full suite before every push (CLAUDE.md). Keep "embed transfer ≤ 30 MB" green.
- `tests/taps.spec.mjs` checks every kit toy's tap from data: when a lane marks a toy `"v": "keep"`
  in the plan, the test requires a pulse or toggle tap, plays it frame by frame (twice for a pulse;
  on and off for a toggle), and checks that every number is finite, that the effect's last moment
  matches the rest pose, and that morph channels are back near 0 at rest. Lanes never edit this
  file. If a toy of yours fails it, fix the toy. If the failure is right for a reason (a piece that
  has faded out on a channel before its part is hidden), ask the Operator to add it to `EXCEPT` with
  the reason, and say so in your PR.
- A lane's own extra tests go in `tests/<prefix>.spec.mjs` (for example `tests/e5.spec.mjs`). Don't
  edit the other spec files; a change to one is a shared change for the Operator.

## Screenshots

- CLAUDE.md asks for screenshots at 390×844 and 1440×900. A lane saves its own as
  `tests/screenshots/<prefix>-<name>-390x844.png` and `…-1440x900.png` (for example
  `e5-watermelon-390x844.png`).
- Every full test run rewrites twelve standard screenshots (`app-*`, `balls-*`, `embed-400x300`,
  `make-help-*`, `shelf-*`, `v3-*`; the list is `STANDARD_SHOTS` in `tools/upkeep.mjs`). Lanes never
  commit them: after a full run, `node tools/upkeep.mjs --restore-shots` puts them back. The
  Operator refreshes them on main.

## The Effect review page

The owner reviews every new or changed effect as a clip on one page:
https://claude.ai/artifact/NCsg9V5SzFY3Mnwuwgq7pi. The page reads everything from its own database,
so lanes add clips and cards at the same time without republishing it. Its collections:

- `lanes/<lane id>`: `{ title, note, order, finished, groups: [{ id, title, note }] }`. The Operator
  makes each lane's record. A lane may set its own record's `groups` (sections within the lane).
- `cards/<card id>`: one clip. `{ lane, group, order, name, said, now, asset, at }`, and
  `replacedBy` once a newer clip of the same effect is posted. `lane` is the lane id (as in
  `lanes/`), `group` one of the lane's group ids (optional), `order` a number (cards sort by it),
  `name` the toy's shelf name (add ": the second tap" or ": Cairn style" for a variant), `said` what
  the owner said about it (their review note or their mark's note, quoted; else "(No note; plan: …)"
  with the plan's effect), `now` what the tap does now in plain words with its length, `asset` the
  uploaded clip's id, `at` the date (YYYY-MM-DD). Older cards use `clip` (a file published with the
  page, such as `e4/oak.gif`) instead of `asset`.
- `verdicts/<card id>`: the owner's marks, `{ verdict: "good" | "fix" | "", note, at }`. Only the
  owner writes these.

Card ids are `<prefix>-<toy id>`, with a variant after it (`e5-cherries-pair`). A clip redone after
the owner's note gets the old card's id plus `-r2` (then `-r3`), in the old card's lane.

### Steps for a lane

1. Render each clip: `node tools/effect-clip.mjs --strip=8 --size=320 <toy id>:<seconds>` (the
   server must be running; `--taps`, `--opt=key=value` and `--pgn=` are in the tool's header). It
   writes a looping GIF. Watch it before posting.
2. Read the page once in the session (a session must read an artifact before it can add to it):
   Artifact tool, `action: "read"`, `url` the page's link.
3. Upload the clips: Artifact tool, `action: "publish"`, `url` the page's link, `asset: true`,
   `file_paths` the GIFs (up to 25 per call). Never publish to the page without `asset: true`: that
   would replace the page. Each result line gives a clip's id (32 hex characters).
4. Add the cards: ArtifactData tool, `action: "batch"`, `url` the page's link, `writes` one entry
   per clip (up to 50 per batch), for example
   `{ "op": "set", "collection": "cards", "doc_id": "e5-watermelon", "data": { "lane": "E5", "group": "fruit", "order": 10, "name": "Watermelon", "said": "…", "now": "…", "asset": "<id>", "at": "2026-09-27" } }`.
   To give your lane sections, add
   `{ "op": "update", "collection": "lanes", "doc_id": "E5", "data": { "groups": [{ "id": "fruit", "title": "Fruit", "note": "…" }] } }`.
5. Read the owner's marks: ArtifactData, `action: "list"`, `collection: "verdicts"`,
   `query: { "limit": 1000 }`, and keep the ids that start with your prefix. Treat notes as the
   owner's review, and fix every "fix" in the same PR.
6. After a fix, post the new clip as a new card (`<old id>-r2`, the owner's note quoted in `said`)
   and mark the old one replaced in the same batch:
   `{ "op": "update", "collection": "cards", "doc_id": "<old id>", "data": { "replacedBy": "<old id>-r2" } }`.
   The page then shows only the new clip.

Never republish the page, write to `verdicts`, change another lane's cards or record, or delete
clips. When the owner has approved all of a lane's clips and its PR has merged, the Operator sets
the lane's `finished: true`, which folds it away on the page.

## Merging and conflicts

- The owner merges lane PRs in any order with "Create a merge commit". Never merge yourself.
- When main moves, every open lane merges it into its branch: `git fetch origin main` then
  `git merge origin/main`, resolves any conflict, runs the tests and pushes. Never rebase, amend or
  force-push a branch that has been pushed. The session's PR watcher does this when a merge-conflict
  notice arrives, and at each check-in.
- Resolving:
  - Shared lists (`src/toy-sounds.js`, `tools/toy-plan.json`, `src/toys.js`, credits, licences,
    asset lists): keep both sides' lines.
  - `docs/TOY-PLAN.md`: take main's copy (`git checkout origin/main -- docs/TOY-PLAN.md`), then
    regenerate it as above.
  - Standard screenshots and anything else only the Operator edits: take main's copy.
  - A conflict in a file you own means someone else edited it: keep your version and tell the
    Operator.
- An engine PR a lane needs is merged before the lane's PR.

## Concurrency and usage

- At most three lanes at once, plus the Operator (and a short fixes lane such as E4 finish).
  CLAUDE.md records that seven parallel builders once used a week's usage in one go.
- While lanes run in parallel, a lane uses at most one helper subagent at a time. The Operator uses
  none.
- The Operator starts the next lane when one finishes (the owner can also start it).

## Branches and PRs

- A lane works on the branch its session assigns and opens one draft PR against `main`, titled
  "Phase <lane>: …" (for example "Phase E5: new tap effects for the food toys"), with the five
  sections from CLAUDE.md. Stacked parts add `-<part>` to the branch.
- The Operator's branches are `claude/operator-<topic>` and its PRs "Ops: …".
- An engine change for a lane is "Engine: …" on the lane's branch name plus `-engine`.
- A lane's commits, PR and handoff name its lane.

## A lane's start

1. Read CLAUDE.md, this file, WORKSTREAMS.md (your row), your `docs/handoff/<lane>.md`,
   docs/PACKS.md and your toys in docs/TOY-PLAN.md.
2. Check the owner's marks on the Toy Plan page for your toys: ArtifactData, `action: "list"`,
   `collection: "marks"` on https://claude.ai/artifact/PNGPx7REMdhxLMHDXARhw8 (one document per toy
   id: `{ mark: "yes" | "change" | "skip" | "", note, at }`). A "change" note overrides the proposal
   in `tools/toy-plan.json`; update your toys' entries to match. If the tool is not available, ask
   the owner to press "Copy my marks and notes" on the page and paste the text.
3. Merge the latest main into your branch.
4. Fill in "State" in your handoff file and open your draft PR early, so the owner and the Operator
   can see the lane.

## A lane's end

1. Every toy in the brief has its effect and sound (or the PR says which do not, and why). Each
   finished toy is `"v": "keep"` with an `improved` entry, and TOY-PLAN.md is regenerated.
2. `node tools/check-packs.mjs <pack>`, a contact sheet, thumbnails for your toys, your screenshots,
   `node tools/sound-check.mjs` on your toys.
3. Clips of every new or changed effect are on the Effect review page.
4. The full test suite passes, `node tools/upkeep.mjs --restore-shots` has put the standard
   screenshots back, and `npx prettier --check .` is clean.
5. Your handoff file says what was done, the known issues, and anything for the Operator.
6. The PR is ready for the owner. Keep it mergeable, and fix whatever the owner marks "Needs work"
   in the same PR.

## Upkeep after a merge (the Operator)

1. Update your copy of main.
2. `node tools/upkeep.mjs`: regenerates TOY-PLAN.md, rebuilds `.cache/pages/sound-board.html` and
   refreshes the standard screenshots (`--full` runs the whole suite instead; `--no-shots` skips
   them).
3. Republish the Sound Board: Artifact tool, `url` the Sound Board's link, `file_path`
   `.cache/pages/sound-board.html`.
4. Update WORKSTREAMS.md and HANDOFF.md, add the lane's summary to `docs/handoff/history.md`, move
   its "For the Operator" items (PACKS.md lessons, backlog, README), and set its review lane
   `finished` once the owner has approved its clips.
5. Commit on `claude/operator-<topic>` as a small "Ops: …" PR, and tell open lanes to merge main.
