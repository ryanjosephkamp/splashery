---
name: operator-handover
description:
  Hand the Splashery Operator role to a fresh session, or check whether it's time to. Use when the
  Operator's context passes about 400k tokens, when it is two days old, after a second compaction,
  when the owner says "hand over", or when the daily digest says the Operator should rotate. Covers
  the outgoing Operator's steps, the new Operator's first prompt and readback, moving the routines,
  and the private handover page.
---

# Operator handover

The Operator rereads its whole conversation on every step, so a long-lived Operator becomes the most
expensive session on the account. Most of its usage goes to re-reading its own context, not to new
work. A fresh Operator starts at roughly 60k to 100k tokens of context instead of several hundred
thousand, so each step costs a fraction as much. The owner's rule (October 7, 2026,
docs/OPERATOR.md, "Rotation"): hand over when the context passes about 400k tokens or every two
days, whichever comes first.

## When

Check with `get_session` (no `session_id`: this session):

- `external_metadata.context_usage.used_tokens` over about 400,000;
- `created_at` more than two days ago;
- `context_usage.after_boundary` present (the conversation was compacted). A second compaction means
  hand over now: each one loses detail;
- or the Operator has started forgetting decisions it made.

The daily digest (7:54 a.m. ET, a fresh Sonnet session) reports these numbers every morning. When
one is due, tell the owner in one line and do the handover at the next calm point: no batch merge
half done, no suite you'd have to hand over mid-run (or say exactly where it is).

## The private handover page

The page is the owner's private "Operator Handover" Artifact (its link is in the backup kit's
README-FIRST.md and in the last Operator's notes). It's a static page with supporting files; the
outgoing Operator republishes it with the same URL (`Artifact` publish with `url` after a `read`).
Its sections, in order:

1. **Start here:** the reading list for the new Operator, then the readback, then "wait for take
   over".
2. **Private pages:** each private Artifact (the review pages, the bake-off pages, the ideas and
   boards) with its link and use.
3. **Sessions:** every active lane (model, session id, branch, PR, where it stands, next step), and
   the lanes stood down.
4. **Routines:** name, trigger id, schedule, what it fires into, and what to do with it at handover.
5. **The owner's private calls and what waits on him:** preferences, open decisions, do-not-touch
   rules. Private: never copy them into the repo, a PR or a public doc.
6. **Readback questions:** 10 to 15 questions whose answers prove the new Operator read everything
   (what merges without the owner's marks, the merge steps, where marks live and where notes must
   never go, the first thing at each check-in, flakes versus real failures, the model split and what
   to do on a mismatch, which routines to move, what waits on the owner, when the next handover is
   due).
7. **Files:** `kit/` (README-FIRST.md, OPERATOR-STATE.md, build-kit.txt, `routines/*-prompt.txt`
   with each routine's full prompt), `log/sessions.txt` (the Operator's log), `briefs/*.md` (lane
   briefs and the common tail), and `sealed/` for anything the owner must not see yet.

`sealed/` holds what would break a blind review if the owner read it: a bake-off's key (code to
contestant), for example. The page labels the folder "Operator only: don't open while a blind review
is running." Never put sealed content in a message, a trigger prompt or a session's first prompt:
those show in transcripts the owner reads.

## The outgoing Operator

1. **Refresh the repo docs** in one Ops PR and merge it: HANDOFF.md "Now" (main, merged batches,
   lanes running, open with the owner, next for the Operator) and docs/OPERATOR.md (anything learned
   since the last handover).
2. **Refresh the private state** in the scratchpad: `kit-static/OPERATOR-STATE.md` (time, main,
   every lane, the queue, the owner's standing decisions) and the session log. Hand big reads (a
   transcript, a full export) to a Sonnet helper and keep only its summary.
3. **Republish the handover page** with the updated sections and files, including `sealed/` when a
   blind review is open. Read it back once to check the files are there.
4. **Start the new Operator** with `create_session`: model `claude-opus-5-5`, the Splashery repo as
   the source, title "Splashery Operator (Opus)", tags `["splashery-lane:Operator"]`, and the first
   prompt below. The owner sets its effort in the app (high, his call of October 8, 2026); say so in
   your message to him.
5. **Check the readback.** Correct anything wrong with a message to the new session
   (`create_trigger` with `persistent_session_id` and `run_once_at` two minutes out). When it's
   right, send "take over".
6. **Move the routines.** For each routine that fires into the Operator (the backup kit and the
   weekly toy ideas), create it again bound to the new session from its prompt in `kit/routines/`,
   then disable the old one (`update_trigger enabled=false`). The digest and the site patrol run in
   fresh sessions and stay as they are. Stop your own check-in chain (delete the pending
   `send_later`). Unsubscribe from any PR you were watching; the new Operator subscribes.
7. **Tell the owner,** in a short message: the new session's link, that he talks there from now on,
   the effort to set, and that you'll stand by for a day.
8. **Stand by** for a day without acting unless he or the new Operator asks. Then the owner archives
   the old session (archive only after he has acknowledged).

## The new Operator's first prompt

Fill in the placeholders. Keep it free of anything sealed.

```
You are the new Splashery Operator (Opus 5.5), taking over from session <OLD_SESSION> on
<DATE, TIME UTC>. The owner is Ryan (GitHub ryanjosephkamp); he works from his phone.

Read, in this order:
1. CLAUDE.md
2. docs/OPERATOR.md (the runbook) and .claude/skills/operator-handover/SKILL.md
3. docs/HANDOFF.md, "Now"
4. docs/OPERATING.md
5. docs/WORKSTREAMS.md
6. The latest review triage: <docs/reviews/…/triage.md>
7. The private Operator Handover page, <HANDOVER_URL>, with the Artifact tool (action "read"; its
   files with `path`). Don't open `sealed/` until you need it for the task it names.

Then copy the page's `kit/` files into your scratchpad as `kit-static/` (save build-kit.txt as
build-kit.sh and set its scratchpad path), and its `briefs/` and `log/sessions.txt` beside them.

Answer the page's readback questions in one message headed "READBACK:". Take no other action
(no merges, no messages to lanes, no new sessions, no routines) until the outgoing Operator or Ryan
says "take over". After "take over": re-arm your check-in first, check every lane's model, list the
open PRs, and carry on from HANDOFF.md "Next for the Operator".
```

## The new Operator after "take over"

- Re-arm the check-in chain (`send_later`, about 90 minutes out when only waiting, sooner when
  something is due). Its message lists every open item, so the next check-in can start cold.
- Check each running lane's model (`configured_model` against `last_served_model`).
- Subscribe to the PRs you will merge.
- Update HANDOFF.md's first line with your session id in your first Ops PR.
- Note the date: your own handover is due in two days, or sooner at 400k tokens.

## Keeping an Operator cheap between handovers

- Run the full suite in its own worktree (`/home/user/wt-suite`), never in the checkout the session
  starts in. The cloud stop hook checks that checkout on every turn end; screenshots rewritten there
  by a run cost a wasted turn each time.
- Hand big reads to a Sonnet helper and keep only its summary.
- Check-ins about every 90 minutes when only waiting; PR events and finished background runs wake
  the Operator on their own.
- Keep trigger prompts short: every create or update echoes the whole prompt back into the context.
- Prefer a fresh lane session for a new round of work; reuse a lane session only for a small
  follow-up while its context is still small.
