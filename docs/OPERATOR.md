# The Operator's runbook

How the Operator session does its job, step by step: the commands, the checks and the habits that
grew during the October push. [OPERATING.md](OPERATING.md) has the rules every session follows ("How
the Operator runs a lane", "Merging and conflicts", "Upkeep after a merge");
[HANDOFF.md](HANDOFF.md), "Now", has the current state; [WORKSTREAMS.md](WORKSTREAMS.md) has the
lanes. Private things (page links, the owner's marks and notes, routines' full prompts) are on the
Operator's private handover page, never in the repo.

## Rotation

The Operator rereads its whole conversation on every turn, so a long-lived Operator becomes the most
expensive session on the account. By the end of the October push one Operator had cost about as much
as all of its 25 lanes together. The owner's call of October 7, 2026: hand over to a fresh Operator
when the context passes about 400k tokens, or every two days, whichever comes first. The outgoing
Operator does the handover:

- refreshes HANDOFF.md, "Now", and this file;
- updates the private handover page;
- starts the new Operator (Opus 5.5);
- checks its readback;
- moves the routines;
- stands by for a day without acting unless asked.

The steps, the new Operator's first prompt and the readback are in
`.claude/skills/operator-handover/SKILL.md`. The daily digest reports the Operator's age, context
size and compactions every morning (the owner's request of October 10, 2026), so a handover that's
due shows there.

Keep context small in the meantime. Hand big reads (a transcript, a full export, a long run log) to
a helper agent on Sonnet and keep only its summary.

## Each check-in (about every 90 minutes)

1. **Re-arm first.** `send_later` about 90 minutes out when only waiting, sooner when something is
   due (PR events and finished background runs wake the Operator on their own). Its message lists
   every open item, so the next check-in can start cold.
2. **Integrator results.** Fetch them:
   `git fetch origin +refs/heads/claude/integrator-results:refs/remotes/origin/claude/integrator-results`.
   Then read the newest `runs/*.md`. The first line starts "READY: RESULT".
3. **Open PRs.** List them:
   `gh api "repos/ryanjosephkamp/splashery/pulls?state=open&per_page=40" --jq '.[] | "\(.number) \(.head.sha[0:8]) \(.updated_at[11:16]) \(.title)"'`.
4. **Lanes.** Call `get_session` on each running lane:
   - `status_bucket` and `post_turn_summary` hold its READY, WORKING or BLOCKED;
   - compare `configured_model` with `external_metadata.last_served_model`, and stop a lane that ran
     on another model.
5. **Marks.** Export Effect review page 2's `verdicts` with ArtifactData:
   - `list` with limit 1000 and `out_dir` into the scratchpad;
   - diff the export against the last one;
   - pass new "fix" notes to their lanes.

   Never write to `verdicts` or `marks`. The owner's notes go to lanes and to his backup kit, never
   into the repo or a PR.

6. **Act.** Answer lanes, merge what is ready, and start lanes when slots free.
7. **Log.** One line per check-in in the Operator's session log, then a short reply to the owner.

## Talking to lanes

Send a one-shot trigger with `create_trigger`:

- `persistent_session_id` set to the lane;
- `run_once_at` a few minutes out;
- a prompt that starts "From the Operator:" and says exactly what to do and how to report.

A routine's prompt can't be edited from another session: to fix one, delete it and create it again.
Lanes never message the Operator; they end each turn with READY, WORKING or BLOCKED, and the
Operator reads it.

## Merging (an Ops PR per merge)

Who may merge what (CLAUDE.md, "Pull requests"):

- **Labs, additive engine and Ops PRs:** once a full test run passes.
- **Changes to toys the public sees:** a full test run and the owner's "good" marks.
- Workers never merge.

The steps, in a scratch worktree:

1. `git checkout -B claude/operator-merge-<topic> origin/main`, then
   `git merge --no-ff -m "Merge #N (…)" <full head SHA>` for each PR in order.
2. Check the shared lists:
   - `node --check` on src/toys.js, src/toy-help.js and src/toy-sounds.js;
   - JSON.parse on tools/toy-plan.json, tools/assets.json and tools/models.json.
3. Regenerate:
   - `node tools/toy-plan.mjs`, then `npx prettier --write docs/TOY-PLAN.md tools/assets.json`;
   - `node tools/site-build.mjs`, `npx prettier --write site`, then
     `node tools/site-build.mjs --check`.

   Commit the rebuild as its own "Ops: rebuild site/ …" commit.

4. Run the PR's own specs plus the shared ones it could touch (help, hta, unit, kit, smoke, taps
   with `-g <pack>`, site, tpg, spg) on this exact tree. The Integrator's full run covers the rest.
   When a lane's head moved after the Integrator run, rerun only what changed.
5. Push the branch and open the PR as a draft:
   `gh api repos/ryanjosephkamp/splashery/pulls -X POST -f title=… -f head=… -f base=main -F draft=true -F body=@file`.
   The body has the five sections: Summary, Verification, Deviations, Known issues, What was cut.
6. Mark it ready: `gh api -X POST repos/ryanjosephkamp/splashery/pulls/N/ccr/ready_for_review`.
7. Merge with a merge commit, pinned to the head:
   `gh api -X PUT repos/ryanjosephkamp/splashery/pulls/N/merge -f merge_method=merge -f sha=<full head>`.
8. Tell the lane: merged, stand down (or merge main and go on).

## Local test runs

- Use `SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test <files> --reporter=line`.
  Never run `playwright install`.
- One test server runs on port 4173. Kill a stale one with `pkill -f "[h]ttp.server 4173"`.
- Run the full suite in its own worktree, `/home/user/wt-suite` (`git worktree add`, with
  `node_modules` linked from the main checkout), never in the checkout the session starts in. The
  cloud stop hook checks that checkout at every turn's end, and the screenshots a run rewrites there
  cost a wasted turn each time (October 10, 2026).
- Runs longer than a few minutes go in the background with a long timeout (up to two hours). The
  default background limit is 30 minutes.
- Afterward, put the screenshots back with `git checkout -- tests/screenshots/`.
- A line filter must use the test's declared line (where `test(` starts), not the line of the
  failure.
- For an intermittent failure, use `--repeat-each 4` or more on the PR and on plain main. The
  Operator's container (4 CPUs) catches timing bugs that faster lane containers miss.
- To fetch a PR head, use `git fetch origin "+refs/pull/N/head:refs/remotes/prN"`. A plain
  `git fetch origin <branch>` doesn't create the remote-tracking ref.

### Known flaky tests (they also fail on plain main)

smoke:734, tpg:204, hl1:75, stm:366, fl7:49 and :95, qrs-toys:132, live4:149, phy:64, ui4:42, wd:187
and :210, wdr3:133, smd-moving:101. One failure that passes when rerun alone is a flake; two
failures in a row are real.

## Integrators

Integrators are Sonnet 5.5 at high effort (the owner's call of October 8, 2026), and their session
IDs are in WORKSTREAMS.md. A job names:

- the tree: main at a SHA, plus each PR at its full head SHA, merged `--no-ff` locally and never
  pushed;
- the spec files (a full suite or a targeted list), run one file at a time;
- the known flakes.

They rerun each failure alone, on the tree and on plain main, and write
`runs/<date>-<job>-int<N>.md` on `claude/integrator-results`. A targeted run (the specs of the packs
a change touches, plus smoke, kit, taps, help, hta and unit) is enough for a small engine fix. A
full suite takes about 4.5 hours on one worker.

## Starting a lane

Write the brief from the template the October lanes used:

- the head: lane, id, prefix, branch, PR title, handoff file, model;
- the brief itself: what the owner asked, in his words where possible; the order to build in; the
  files the lane owns;
- the common tail: how the lane runs, labs or public merge gate, the Effect review page,
  READY/WORKING/BLOCKED.

Then call `create_session` with:

- `model`: Opus 5.5 or Sonnet 5.5, per CLAUDE.md;
- `source_url`: the repo;
- `outcome_branch`: the lane branch;
- `tags`: `push-2026-10` and `splashery-lane:<Id>`;
- `title`: "Splashery lane <Name> (<Model>)".

Add the lane's row to WORKSTREAMS.md in the next Ops PR. Keep the number of busy workers inside the
owner's current limit (CLAUDE.md, "Working style").

## Sounds

The owner can't play sound on the Effect review page. A lane that changes sounds puts each one in
`tools/sound-review.json` ("new sound to hear") and posts no sound-only cards. At READY, the
Operator builds a Sound Board preview from the lane's branch (`node tools/sound-board.mjs`),
publishes it for him, and he marks the sounds there.

## Upkeep after merges

- `node tools/upkeep.mjs` (TOY-PLAN.md, the Sound Board page file, the standard screenshots).
- `node tools/help-board.mjs`.
- Republish the Sound Board and the Help Board pages; their links are on the private page.
- An Ops PR for WORKSTREAMS.md and HANDOFF.md.
- Fold the lanes' small handoff-only PRs into it.

## Routines

All are on the owner's account:

- **Daily digest:** 7:54 a.m. ET, fresh Sonnet session, read only. Since October 10, 2026 it also
  reports the Operator's health (age, context, compactions) and says when a handover is due.
- **Site patrol:** 7:21 a.m. ET, fresh Sonnet session, read only.
- **Backup kit:** 8:07 a.m. and 8:07 p.m. ET, fires into the Operator session. It exports the review
  pages and zips the private state for the owner.
- **Weekly toy ideas:** Mondays, 7:43 a.m. ET, fires into the Operator session.

At a handover the two that fire into the Operator move to the new session. Their full prompts are on
the private page.

## Habits worth keeping

- Re-arm the check-in before anything else, every time.
- Say what was verified and what was skipped; never call a flake without a rerun.
- Check that a fix doesn't change something the owner already marked good; if it would, ask first
  (for example, lightening the splat mirror's frames to pass a test).
- A test that only fails under load is still a bug. Reproduce it with `--repeat-each` or a CPU
  throttle (`Emulation.setCPUThrottlingRate` through CDP), then fix the cause, not the limit.
- Keep the owner's messages short: what changed, what he needs to do, step by step.
- Keep trigger prompts short: every create or update echoes the whole prompt back into the
  Operator's context.
- Keep blind reviews blind everywhere the owner can read: messages, check-in prompts (they show in
  the transcript when they fire) and first prompts. A key goes only in the handover page's `sealed/`
  folder and the Operator's scratchpad.
