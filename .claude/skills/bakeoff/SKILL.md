---
name: bakeoff
description:
  Run a blind bake-off that compares AI coding models on the same tasks. Use when the owner asks to
  compare models, run a bake-off, add contestants for a round 2 (re-blind every entry under new
  codes), post the blind review page, check how the marking is going, or do the reveal. Covers the
  tasks, the private sandbox repo, the contestants (cloud sessions and Codex), the judges, the blind
  codes, the review page, the reveal, later rounds, and a models-by-effort grid.
---

# Bake-off: a blind comparison of AI coding models

Several "contestants" (Claude models run as cloud sessions, other models run by the owner in Codex)
each do the same tasks alone in a private sandbox copy of Splashery, each on its own branch
`bake/<letter>-t<N>` with one draft PR. Neutral "judge" sessions run the same checks on every entry
and write neutral cards, with a clip where there is something to see. The owner marks each card on a
private review page (an Artifact with a database) without knowing who made what: a verdict, tags,
and a note. The reveal comes only after every card is marked.

The kit: this file, `review-page.html` (the page), `judge-brief.md` (the judge's prompt),
`prompts.md` (every other prompt, the Codex setup, and the sandbox's rules text), and
`tools/bakeoff.mjs` (`codes`, `cards`, `reveal`; `--help` shows its usage).

## The blind rules (the Operator keeps them too)

- The key (code to branch) and the who file (branch letter to contestant) live only in a private
  folder outside every git checkout, in the Operator's scratchpad, named for the round
  (`bakeoff-<round>/`: `entries.txt`, `key.tsv`, `who.tsv`, `usage.tsv`, `deny.txt`). Keep a copy in
  the handover page's `sealed/` folder (the operator-handover skill).
- Never print, `cat`, or paste those files, and never write a model next to a letter or a code in
  chat, a prompt, a session title, a tag, a trigger, a PR, a commit, or any repo file. The owner
  reads transcripts. `bakeoff.mjs` refuses to put a key or a reveal inside a repo, and it prints
  only counts until the reveal.
- Contestants and judges never see the key. Judges see only `<branch> <code>` lines for their tasks.
- The reveal waits until every card is marked. If the owner asks "who is R7?" early, say it comes
  after the last card.

## 1. Pick the tasks

Pick 3 to 8 tasks, and mix them: a new toy (kit-built, behind the labs switch), a fix (an existing
toy or a review note), a feature (the Studio or the site), and a reliability task (a test that fails
at random, or a corpus of old links). Each task gets:

- a stated proof a judge can run (a test file name, and numbers: "passes 8 times in a row with
  `--repeat-each=8 --workers=1`");
- a 3-hour time box;
- what the owner will see (a clip at phone size) or "nothing to see", so you can write its guide.

Write them as `## Task <N>: <title>` sections of the sandbox's `BAKEOFF.md`. Say in it how the
scores weigh: the owner's marks about half, the judges' checks about a third, time and usage the
rest, decided before any entry is judged. Freeze the task text: a later round runs the same tasks.

## 2. The sandbox repo

- A private copy of `main` at a pinned SHA, in its own private repo (`SANDBOX_REPO`, never pushed to
  the real one). Say the SHA and date in `BAKEOFF.md`. Never move `main` afterward: every entry, in
  every round, starts from it.
- `BAKEOFF.md`: the rules block and the tasks (`prompts.md` section 6 has the rules: own branch
  only, never read another `bake/` branch or PR, stay anonymous in code and commits with no
  co-author or generated-with line, commit as you go, 3 hours, the five PR sections, no secrets).
  `AGENTS.md` gets the override header from the same section. Keep `tools/codex-setup.sh` and
  `docs/codex/SETUP.md` from the repo.
- Internet on for every contestant, no secrets anywhere (no `HF_TOKEN`, no keys). Before the first
  entry, look for `.env` files and tokens in the copy, and delete `test-results/`.

## 3. The contestants

- **Letters.** One lowercase letter per contestant (a model at one effort level), drawn at random,
  never in alphabetical order of the models. Write `<letter><TAB><contestant>` lines in `who.tsv`. A
  new contestant in a later round gets a new letter.
- **Claude models.** One `create_session` per entry and task, with the prompt in `prompts.md`
  section 1: the same prompt text for everyone, a neutral title, no secrets in its environment (not
  the Operator's own), and `outcome_branch` `bake/<letter>-t<N>`. The model goes only in the session
  setting. Start them in waves that respect the pace rule (docs/OPERATING.md).
- **Codex models.** The owner runs them. Set up the environment once (`prompts.md` section 3), then
  give him one prompt block per task (section 2) with the letters filled in. Plain steps, since he
  works from the phone: open Codex, new task, paste, wait, tap Create PR.
- **One pilot task first.** Run only task 1 for one contestant of each tool, and read its log after
  10 to 15 minutes: tests really running, no "command not found" or browser launch errors. Only then
  start the rest. (The first Codex run in October 2026 left no PR because agent internet was off.)
- Use the same effort level for every contestant, unless the grid is about effort (step 12).
- A tool may name its own branch: put the real branch in `entries.txt` with its task as a second
  column, and the whole branch in `who.tsv`.

## 4. Usage and time

For each entry, write a row in the private `usage.tsv`: branch, model, effort, start, end, wall
minutes, usage, PR link. For a Claude session, read the times and usage from `get_session` (its
output names the model, so read it in a helper or after the reveal). For Codex, ask the owner to
read each task's elapsed time and usage from Codex and send them. Write "not available" when it is.

## 5. Blind codes

When every entry is in (or time is up), list every branch in `entries.txt`, one per line, then:

`node tools/bakeoff.mjs codes --entries <private>/entries.txt --out <private>/key.tsv`

It draws unique two-character codes (a letter except I and O, then a digit 2 to 9) and prints only
the count. Cut each judge's lines from the key into its brief:
`awk -F'\t' 'NR>1 && ($1=="t1"||$1=="t2") {print $2, $3}' <private>/key.tsv`.

## 6. The review page

Publish before the judges start, because they upload clips to it.

1. Copy `review-page.html` into the scratchpad, load the `artifact-capabilities` skill, and publish
   the copy as a NEW Artifact (Artifact tool, `capabilities: {"db": {}, "assets": {}}`, title
   "Splashery Bake-off Review"). A new round always gets a new page.
2. Write one `lanes` doc per task with ArtifactData `batch`, for example
   `{ "op": "set", "collection": "lanes", "doc_id": "t1", "data": { "title": "Task 1: ...", "order": 1, "note": "...", "guide": "<b>What to look for: the motion.</b> ...", "tags": ["Motion looks right", "Physics looks off"] } }`.
   `guide` is a string of simple markup (`b`, `i`, `em`, `strong`, `br`, `code`, `p`, `ul`, `ol`,
   `li`; the page drops everything else). `tags` is an array of strings. The page adds "Best in this
   task" and "Can't judge from this" to every task, and shows a generic guide and tag set when a
   task has none. Write a real guide for every task.
3. Read each collection back once (`list`) to confirm the page is live. The Operator never writes to
   the `verdicts` collection: only the owner does.

## 7. The judges

Start Sonnet judges with `prompts.md` section 4 and `judge-brief.md`, one judge per group of tasks,
the same judge for every entry of a task. They run the same commands on every entry, after a
baseline run on sandbox `main`; they check house rules and the PR's claims; they render clips with
the same setup for every entry (390x844, scale 2) and upload them to the page; and they end with one
table and one JSON card per entry. The default `CHECK_COMMANDS`:

```
SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test tests/smoke.spec.mjs tests/taps.spec.mjs tests/unit.spec.mjs --workers=1
npx prettier --check .
node tools/us-english.mjs --diff
```

Heavy suites run for hours: schedule your own check-ins. Judges never write to the page's database.

## 8. The cards

1. Save each judge JSON from its final message in `<private>/judge/<code>.json`.
2. Put the contestants' model names, tools, and companies in `<private>/deny.txt`, one per line.
3. `node tools/bakeoff.mjs cards --judge <private>/judge --key <private>/key.tsv --deny-file <private>/deny.txt --out <private>/cards.json`.
   It stops on a branch name, a PR number, a footer, a tool or company name, or a deny-file word in
   a card (it names the code, never the text), and it warns when the task text or the card lengths
   differ inside a task. Fix the judge's JSON and run it again. `order` is shuffled per task.
4. Send the file's `writes` to ArtifactData `batch` (50 per call; the tool splits bigger files).
   Count the cards on the page: one per entry.

## 9. The owner marks

Tell him in plain steps: open the link, tap the tags that fit (they save at once), add a note if he
likes, and watch the counter ("N of M marked"). Check progress by counting the `verdicts` docs that
have a verdict, a tag, or a note (ArtifactData `list`, limit 1000, ids only). Don't read his notes
next to the key, and don't discuss any entry's maker.

## 10. The reveal

Only when the count equals the number of cards. Export the `verdicts` docs as JSON files into
`<private>/verdicts/`, then:

`node tools/bakeoff.mjs reveal --key <private>/key.tsv --verdicts <private>/verdicts --who <private>/who.tsv --out <private>/reveal.md`

It refuses unless every card is marked, prints a table per task (contestant, code, verdict, tags),
the notes, and the "Best in this task" counts. Add the judges' checks and the usage, and give the
owner the result privately (chat, or a private Artifact). Never put it in the repo or a PR.

## 11. A later round (new contestants, re-blind)

1. New contestants run the same tasks from the same sandbox `main`, with new letters (added to
   `who.tsv`) and the same prompt text and effort rule. Judges check them exactly as before (the
   same baseline, commands, and clip setup).
2. Then ALL entries, old and new, get NEW codes: a new `entries.txt` with every branch, and
   `node tools/bakeoff.mjs codes ... --avoid <old key> --out <private>/key-r2.tsv`.
3. Publish a NEW page (step 6). Move the old entries' clips with the Artifact tool's copy
   (`asset: true`, `from_url` the old page, `asset_ids` up to ten per call, from a `scope: "assets"`
   listing), write the old-id to new-id pairs into a JSON file, and run `cards` with
   `--recode-from <old key> --key <new key> --asset-map <map.json>`. That gives the old cards their
   new codes. The new entries' cards already carry new codes.
4. The old page and its marks stay as they are, as a consistency check: after the second reveal,
   compare how the owner marked the same entry on both pages. Repeat nothing from the first reveal
   on the new page (no names, no notes, no hint which entries came back).

## 12. A future grid (more models and effort levels)

A contestant is a model at one effort level, with its own letter. Use fewer tasks (3 or 4), since
the number of runs is models times levels times tasks. Record usage and minutes for every entry
(step 4), and compare quality against cost: a table per contestant of good marks, "Best in this
task" counts, checks passed, minutes, and usage. Decide the scoring before the reveal. Keep the
prompt text the same at every level; only the setting changes.

## 13. Pitfalls learned (October 7 to 10, 2026)

- Code-only tasks (a reliability fix, a corpus) have no clip. Give them a clear "what to look for"
  guide and tags like "Trust the tests" and "Clear explanation", and tell the owner a card has
  nothing to watch (the page says so under a card with no clip).
- Keep check prompts, notifications, session titles, tags, and PR comments free of any model name. A
  judge must never copy PR text onto a card: it can carry a tool's footer.
- Don't start contestants in the Operator's environment: it holds secrets. Don't leave a judge
  without the Artifact tool or the sandbox repo.
- Flaky tests: the baseline tells the judge which failures were already on `main`, and a failing
  file is rerun once alone before it counts.
- A tool's footer or trailer may appear despite the rules. The judge notes it neutrally on the card
  ("the entry names its tool in its commits"), without naming the tool.
- "Needs work" on the page asks for a short note, and tags alone are enough for a mark.
- Each page holds 1 GB of clips: use MP4 (`"video": true`). Clips render softer than a real screen,
  equally for every entry.
