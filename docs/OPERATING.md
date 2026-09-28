# Operating Splashery in parallel

How several Claude sessions build Splashery at once without getting in each other's way. The owner
accepted this setup on 2026-09-26 (the "Splashery Parallel Plan" page), and on September 27, 2026 he
handed the running of the lanes to the Operator (Part 1 of the "How Splashery Is Made" page). The
ground rules and the effect quality rules in [CLAUDE.md](../CLAUDE.md) apply to every session.

## Who does what

- **A lane** is one session with one job (a wave of toys, a set of fixes, a feature), one branch,
  one draft PR and a set of files it owns. The lanes, their files and their state are in
  [WORKSTREAMS.md](WORKSTREAMS.md). A lane builds; it does not change governance.
- **The Operator** is one long-lived session that coordinates and never builds toys. It keeps this
  file, WORKSTREAMS.md, [HANDOFF.md](HANDOFF.md) and CLAUDE.md; writes each lane's brief, starts its
  worker session and runs it (below); does the upkeep on main after each merge; sends the owner a
  daily digest; and runs the daily toy-ideas routine (both are routines that wake the Operator
  session each morning: the ideas at 7:43 and the digest at 7:54, Eastern time). Governance
  questions go to it. It also keeps the owner's pages (below) and the Sound Board.
- **The owner** (Ryan) talks only to the Operator, reviews clips on the Effect review page, sends
  notes (sound reviews as files) and merges PRs. Only the owner merges.

Every cloud session has its own container, clone and branch, so sessions never share a working tree.
Worktrees are only for helpers inside one session. What can still collide is the shared material
around the toys; the rules below keep it apart.

## Pages

| Page                      | Link                                              | Who changes it                                                               |
| ------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------- |
| Effect review             | https://claude.ai/artifact/NCsg9V5SzFY3Mnwuwgq7pi | Lanes add clips and cards (below); the owner marks; the Operator tidies      |
| Sound Board               | https://claude.ai/artifact/VE9XCTxH3djST6dGb6ZAkj | The Operator (after merges and each sound-review round); the owner may mark  |
| Help Board                | https://claude.ai/artifact/P1NCWsGRE3MFqYTWTnTuqN | The Operator (`node tools/help-board.mjs`, below); the owner marks           |
| Toy Plan (owner's marks)  | https://claude.ai/artifact/PNGPx7REMdhxLMHDXARhw8 | The owner marks; the Operator republishes (`node tools/toy-plan.mjs --json`) |
| Toy Ideas                 | https://claude.ai/artifact/5TukiuV3mCt3G3zk6Arx9S | The Operator adds three ideas each morning; the owner marks (below)          |
| Splashery Parallel Plan   | https://claude.ai/artifact/KjJrfKxi4phzJmbgSyRbr7 | The Operator (the lane prompts)                                              |
| Splashery Operator Manual | https://claude.ai/artifact/3WYMJxtZDR7m1ecTCN47ZB | The Operator (the owner's how-to)                                            |
| How Splashery Is Made     | https://claude.ai/artifact/HHj9PBXUQck3kAHrHhdkjA | The Operator (the plan in Part 1, the public write-up's basis in Part 2)     |

## Lanes and file ownership

Each lane owns the files in its row of WORKSTREAMS.md: usually its pack files (`src/packs/*.js`),
its handoff file (`docs/handoff/<lane>.md`), its own test file (`tests/<prefix>.spec.mjs`), its
screenshots (`tests/screenshots/<prefix>-*.png`) and its toys' folders (`assets/toys/<toy id>/`).
Only that lane edits them. Packs that no active lane owns (WORKSTREAMS.md, "Frozen packs") are
frozen: a change to them needs a lane that the Operator starts.

Each lane has a **prefix**, the lane id in lower case, used for card ids, screenshot names and its
test file: `e4f`, `e5`, `e6a`, `e6b`, `f`, `g`, `ai`, `math`, `help`, `hta`, `htb`.

### Shared files: edit only your own toys' lines

These files list every toy. A lane edits only its own toys' entries, in place: don't reorder, reflow
or reformat anyone else's lines, so git can merge the lanes line by line.

- `src/toy-sounds.js` (each toy's sound spec)
- `src/toy-help.js` (each toy's how-to line and About text, in its shelf's section)
- `tools/toy-plan.json` (each toy's plan entry: `"v": "keep"` and `improved` when finished)
- `src/toys.js` (the shelf catalogue: only new toys add rows)
- `src/rigs.js` (a scan's rig)
- `tools/assets.json`, `tools/models.json`, `CREDITS.md`, `LICENSES.md` (add your lines)

### Files only the Operator edits

`CLAUDE.md`, `docs/OPERATING.md`, `docs/WORKSTREAMS.md`, `docs/HANDOFF.md`,
`docs/handoff/history.md`, `README.md`, `docs/ROADMAP.md`, `docs/BACKLOG.md`, `docs/PACKS.md`,
`tests/taps.spec.mjs`, `tools/upkeep.mjs`, `tools/sound-board.mjs`, `tools/pages/`, `package.json`
and `package-lock.json`, the standard screenshots (below), and the sound review files (except a
sound lane's own toys in them, "The sound review"). A lane that has something for these files writes
it in its handoff file (under "For the Operator": a lesson for PACKS.md, a backlog item, a README
line) and the Operator moves it after the merge.

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

The input path lane F built (pointer handling in `src/player.js` and `src/stage.js`, and the grab
and tap code in `src/motion.js`) is engine code like the rest.

## How the Operator runs a lane

Since September 27, 2026 the owner talks only to the Operator; the Operator starts, steers and
reconciles the worker sessions and brings him finished work.

1. **Brief.** The Operator writes the lane's brief (its toys or job, its files, its branch and PR
   title, and the rules below) and adds the lane's row to WORKSTREAMS.md.
2. **Start.** The Operator starts the worker session with the brief as its first prompt, pinned to
   Opus 5.5, on the lane's branch. The worker copies the brief into `docs/handoff/<lane>.md` and
   opens its draft PR early.
3. **Model and effort.** Workers run Opus 5.5 only; any other model needs the owner's permission
   first. At every check-in the Operator reads the worker's session record, and if it has run on
   another model (a fallback), the Operator stops it and tells the owner. Effort is the default for
   now, a trial the owner chose. If either of them thinks it isn't enough, the owner adds
   `CLAUDE_CODE_EFFORT_LEVEL=xhigh` to the environment's variables, and every new session runs at
   Extra High. Helpers use the worker's own model.
4. **Messages.** A worker never asks the owner. It ends each working turn with a short final
   message: "READY:" (PR link, card ids, test results, anything for the Operator), "WORKING:" (what
   is left) or "BLOCKED:" (exactly what it needs). The Operator reads it from the session record,
   answers or relays, and sends a worker its messages as one-shot triggers into its session, headed
   "From the Operator".
5. **Checks.** The Operator subscribes to each lane's PR and checks in about hourly while lanes
   work. It tells lanes to merge main after each merge, answers their questions, and keeps
   `tests/taps.spec.mjs` exceptions.
6. **Present.** When a lane is ready, the Operator reviews its diff and tests and watches its clips,
   then sends the owner one short message: what it does, which cards to mark and where it goes in
   the merge order.
7. **Marks.** The owner marks clips on the Effect review page (or says so in chat, and the Operator
   passes it on). Lanes also read the marks on an hourly check-in of their own, fix every "fix" in
   the same PR, and post "-r2" cards.
8. **End.** After the merge the Operator does the upkeep, tells the worker to stand down, and stops
   its check-ins.

The owner can still open any worker to watch it. If he sends one an instruction, he tells the
Operator too, so they don't cross wires.

## Language

Every new public-facing text is in American English: the docs in the repository, the words on the
site (toy names, descriptions, buttons, credits, messages) and PR titles and bodies. So color,
center, gray, math, license, toward, catalog, -ize endings, dates like "September 27, 2026", and
commas and periods inside quotation marks. Internal notes and pages follow it too, to keep one
habit.

- Leave code identifiers, file names and anything stored in links or saved scenes as they are (the
  pack file `maths.js`, option keys, toy ids), so old links keep working.
- Don't rewrite older British text on the side. One sweep does that, as a single Ops PR at a quiet
  moment before the blog post.
- `node tools/us-english.mjs --diff` lists British spellings in the public text a branch adds
  (against `origin/main`); run it before you push. After the sweep, the Operator runs it on
  everything.

## The sound review

The owner reviews the sounds on the Sound Board and agrees on new ones there before they reach the
site.

1. **Notes.** The owner sends notes as a Markdown file (voice-typed is fine). He names only the toys
   he wants to comment on; any toy he doesn't mention stays as it is.
2. **Filed.** The Operator keeps the notes word for word in `docs/reviews/sounds-<date>.md` and
   writes a clean version per toy into `tools/sound-review.json`:
   `{ "round", "note", "toys": { "<toy id>": { "status", "said", "note", "plan", "candidates" } } }`.
   `status` is `keep`, `change`, `ready` (a new sound to hear), `approved` or `site` (in the site);
   `said` is his words, `note` the clean version, `plan` what the new sound will be. The Sound Board
   shows each toy's line, with filters (All, To change, Ready to hear, Approved), "Play through"
   (the filtered toys one after another, the name shown large) and optional marks.
3. **New sounds, on the board only.** Sound lanes add candidates to their toys' entries:
   `candidates: [{ "id": "a", "label": "New A", "sound": <spec> }]`, with the same specs as
   `src/toy-sounds.js`. New voices go in `tools/sound-voices-next.js` as `VOICES.name = { … };`
   lines (no imports or exports). The site doesn't change yet. The Operator rebuilds and republishes
   the board (`node tools/sound-board.mjs`) after each round.
4. **The owner listens** and answers in chat or another notes file. A new sound he doesn't mention
   counts as approved; the Operator lists every candidate so he always knows what he is approving.
   His optional marks on the board are in its `verdicts` collection:
   `{ verdict: "good" | "fix" | "", pick: "<candidate id>" | "", note, at }`.
5. **Into the site.** A sound lane moves approved sounds into `src/toy-sounds.js` (and new voices
   into `src/voices.js`, re-measuring levels with `node tools/sound-check.mjs --voices`), sets their
   status to `site`, and posts no clips unless an effect changed.
6. **Preferences.** From the owner's notes the Operator drafts a "Sound preferences" section for
   PACKS.md (general guidance, not strict rules). The owner OKs it, and every lane follows it.

## The help review

Every toy has a short "how to play" line and an About text in `src/toy-help.js` (the style guide is
in `docs/handoff/Help.md`). The owner reads them on the Help Board: each toy's thumbnail, its line
(or, under a "Built by the app" tag, the line the app builds from its recipe) and its About text.
The owner approved all 303 toys' texts on September 28, 2026; a new or changed toy's texts go on the
board with its lane's review.

- The Operator builds the board with `node tools/help-board.mjs` (it writes
  `.cache/pages/help-board.html`) and republishes it to its link, from main after a merge or from a
  checkout with the text lanes' branches merged in while they run.
- The owner's marks are in the board's `verdicts` collection, one document per toy id, with a mark
  for each part:
  `{ howTo: "good" | "fix" | "", howToText, about: "good" | "fix" | "", aboutText, note, at }`. A
  mark keeps the text it was given for, so a text changed since then shows as not marked again. A
  lane reads the marks (never writes them), fixes every "fix" on its toys and leaves approved texts
  as they are; the Operator republishes the board.
- From the text lanes on, every lane writes its own toys' entries as part of "done", and they go on
  the board with the lane's review.

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
  commit them: after a full run, `node tools/upkeep.mjs --restore-shots` puts them back. A full run
  also rewrites other lanes' screenshots (`e5-*`, `e6a-*` and so on): put back every screenshot your
  branch didn't change with `git checkout -- tests/screenshots/` (then re-add your own). The
  Operator refreshes the standard ones on main.

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
   writes a looping GIF. Watch it before posting. For a drag, use `node tools/drag-clip.mjs`
   instead.
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

## The Toy Ideas page

https://claude.ai/artifact/5TukiuV3mCt3G3zk6Arx9S (source: `tools/pages/toy-ideas.html`). Every
morning the Operator's routine adds three new toy ideas that fit the ground rules, each with a tap
effect and a sound. Its collections:

- `ideas/<idea id>`:
  `{ day, order, name, kind: "kit" | "scan", shelf, tap, sound, why, notes, source, lane, reply, revised, set, setNote, from }`.
  The id is a slug of the name. A scan idea's `source` is `{ title, url, licence, author }`, with
  the licence checked on the live source page (CC0 or CC BY only). `set` groups ideas under a
  heading within their day (`setNote` is its line), and `from: "owner"` tags the owner's own ideas.
  Only the Operator writes ideas.
- `marks/<idea id>`: the owner's marks, `{ mark: "approve" | "change" | "skip" | "", note, at }`.
  Only the owner writes these. "Change" keeps the idea with the owner's note, and the note wins: the
  next morning run rewrites the idea to match and sets `reply` and `revised`.

Approved and changed ideas wait on the page until the owner asks for a lane. The Operator then
writes the lane's brief from them (like any new lane) and sets each idea's `lane` to the lane id.

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

- Three lanes at once by default, four when one of them is small (a sound-only lane, say), plus the
  Operator. CLAUDE.md records that seven parallel builders once used a week's usage in one go.
- While lanes run in parallel, a lane uses at most one helper subagent at a time. The Operator uses
  none.
- The Operator starts the next lane when a slot is free, in the order in ROADMAP.md.

## Branches and PRs

- A lane works on the branch the Operator gives it and opens one draft PR against `main`, titled
  "Phase <lane>: …" (for example "Phase E5: new tap effects for the food toys"), with the five
  sections from CLAUDE.md. Stacked parts add `-<part>` to the branch.
- The Operator's branches are `claude/operator-<topic>` and its PRs "Ops: …".
- An engine change for a lane is "Engine: …" on the lane's branch name plus `-engine`.
- A lane's commits, PR and handoff name its lane.

## A lane's start

1. Your brief is your session's first prompt. Copy it into `docs/handoff/<lane>.md` under "Brief",
   then read CLAUDE.md, this file, WORKSTREAMS.md (your row), docs/PACKS.md and your toys in
   docs/TOY-PLAN.md (new toys aren't there yet).
2. For toys already on the shelf, check the owner's marks on the Toy Plan page: ArtifactData,
   `action: "list"`, `collection: "marks"` on https://claude.ai/artifact/PNGPx7REMdhxLMHDXARhw8 (one
   document per toy id: `{ mark: "yes" | "change" | "skip" | "", note, at }`). A "change" note
   overrides the proposal in `tools/toy-plan.json`; update your toys' entries to match. If the tool
   is not available, ask the owner to press "Copy my marks and notes" on the page and paste the
   text.
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
6. The PR is ready for the owner. Finish with "READY:" for the Operator. Keep the PR mergeable, and
   fix whatever the owner marks "Needs work" in the same PR.

## Upkeep after a merge (the Operator)

1. Update your copy of main.
2. `node tools/upkeep.mjs`: regenerates TOY-PLAN.md, rebuilds `.cache/pages/sound-board.html` and
   refreshes the standard screenshots (`--full` runs the whole suite instead; `--no-shots` skips
   them).
3. Republish the Sound Board: Artifact tool, `url` the Sound Board's link, `file_path`
   `.cache/pages/sound-board.html`. If toy help changed, rebuild and republish the Help Board too
   (`node tools/help-board.mjs`).
4. Update WORKSTREAMS.md and HANDOFF.md, add the lane's summary to `docs/handoff/history.md`, move
   its "For the Operator" items (PACKS.md lessons, backlog, README), and set its review lane
   `finished` once the owner has approved its clips.
5. Commit on `claude/operator-<topic>` as a small "Ops: …" PR, and tell open lanes to merge main.
6. Tell the merged lane's worker to stand down (a one-shot trigger), and stop its check-ins.
