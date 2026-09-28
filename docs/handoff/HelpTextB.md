# Lane HelpTextB: toy help text for the everyday, play and places shelves

Prefix `htb`. Owns its shelves' entries in `src/toy-help.js`, `tests/htb.spec.mjs` (if added), the
`htb-*` screenshots and this file. How lanes work: [OPERATING.md](../OPERATING.md).

## Brief

Written by the Operator on September 28, 2026, from the owner's request of September 27 and
ROADMAP.md, "Toy help", step 2 of the plan.

Your shelves (154 toys; 43 already have a how-to line and 6 an About text): Balls (25), Food (27),
Toys (16), Open me (11), Medieval (9), Animals (13), AI and computing (12), Holidays (8), Music (3),
Vehicles (14) and Landmarks (16). Lane HelpTextA writes the other shelves at the same time. The AI
and computing toys (merged September 28 in PR #52) have no entries yet: read docs/handoff/AI.md,
which describes every tap, view and option, and explain each idea (a perceptron, attention, a
diffusion model) plainly and correctly. For the classic transformer, the About text is also where
its key belongs (the symbols now in the Toy tab note: attention, masked attention, add and norm,
feed forward, embedding, positional encoding, linear, softmax, repeated N times). For the balls,
food, landmarks and animals taps, read the E-lane handoffs in docs/handoff/; for the chess set, the
puzzle cube, the bricks and Newton's cradle, docs/handoff/F.md. Landmarks: say where each is and
when it was built, plainly and respectfully.

The owner's words (docs/reviews/2026-09-27-ai-math/review.md): "When I open the site and go to a new
toy (or have refreshed the page, etc.), I'd like to briefly see information on the screen (not
overlapping the toy, if possible) that concisely tells the user how to play with the toy. For
example, if I open the puzzle cube, it would be nice to know that I can drag a row or column in a
direction to turn that; other examples: how to use the chess toy, how to play the xylophone, etc. We
will eventually have this brief type of instructions for every toy in the gallery. And within the
configuration panel, perhaps we can add a new tab or put the info in the main tab, etc., with a
proper description of what the toy shows or means, what you can do with it, etc. That way, if
someone sees something they don't recognize, they can learn a little bit about it without needing to
leave the site to search for it."

Lane Help (PR #57, merged September 28, 2026) built the line, the "?" button and the "About this
toy" section, and wrote the first entries in `src/toy-help.js`: 88 how-to lines and 13 About texts.
The owner approved them. Read docs/handoff/Help.md first, above all its "Style guide for the text
lanes": it is binding for this lane.

Your job: give every toy on your shelves both a how-to line (`howTo`) and an About text (`about`) in
`src/toy-help.js`.

1. Keep the approved entries. Change one only if it is wrong for what the toy does now (say which
   and why in the PR).
2. howTo: one or two short sentences, at most about 90 characters, starting with the action. For
   toys with only a tap, say what the tap does in a few words ("Tap it to peel back the skin.").
   Check the first tap of every toggle against the recipe's `default`.
3. about: 60 to 140 words in two short paragraphs. First what the thing is and what it shows or
   means; then what the toy does (its tap, drags, options, typing) and a fact or two. Plain words a
   curious ten-year-old could follow. No brand names, no jokes that date, no "we" or "you'll love".
4. Check every line against the toy itself: read its recipe (the comments above `action` describe
   the tap; `options` and `controls` are the Toy tab), its row in docs/TOY-PLAN.md ("Improved:" says
   what the tap really does now) and its lane's handoff notes; open a sample of toys in the app
   (python3 -m http.server 4173 --bind 127.0.0.1) and try them, and every toy whose recipe leaves
   you unsure. Never guess what a slider or option does.
5. Check every fact against a real source (an encyclopedia, a museum, a science agency, a
   university). Prefer round numbers with "about". Leave out a fact you can't confirm. For the
   photoreal scans, describe the real thing, not the scan's pedigree (the credits already name the
   source).
6. Nothing sensitive: toys stay friendly (anatomy stays friendly, medieval toys are about castles
   and craft, not fighting). Flags and places stay respectful.
7. American English (color, center, gray, meter, math, -ize). Run
   `node tools/us-english.mjs --diff`. Some Toy tab labels still use older British spelling: quote a
   label exactly only when you name that control ("Try the Colour slider…" is right if that is its
   label), otherwise write "color".
8. Work shelf by shelf and commit and push each shelf as you finish it, so the owner can start
   reading early.

REVIEW: THE HELP BOARD

The owner reads the texts on a new page the Operator publishes, the "Splashery Help Board": every
toy's thumbnail, its how-to line and its About text, with his marks. Its link comes to you in a
message from the Operator (from then on it is in docs/OPERATING.md, "Pages"). The Operator rebuilds
and republishes the board from your pushed branch at each check-in; you don't publish it, and you
don't post cards on the Effect review page (this lane changes no motion). His marks are in the
board's "verdicts" collection, one document per toy id: { verdict: "good" | "fix", note }. Read them
with the ArtifactData tool (action "list", collection "verdicts", url the board's link); never write
to "verdicts". After you have pushed your first shelf, check the marks about once an hour with a
scheduled check-in (send_later): fix every "fix" on your toys in the same PR, following his note,
and say what you changed in your handoff file. Stop the check-ins once your PR is merged or closed.

You own: your shelves' entries in src/toy-help.js (in each shelf's section; keep the sections in the
shelf order of CATEGORIES in src/toys.js, and add a section with the same comment style if your
shelf has none yet); tests/<prefix>.spec.mjs if you add a test; your `<prefix>-*` screenshots; and
your handoff file. Don't edit tests/help.spec.mjs, src/ui.js, styles.css, index.html, the recipes,
src/toys.js or the other shared lists. The other text lane writes the other shelves' entries in the
same file at the same time: when you merge main and src/toy-help.js conflicts, keep both sides (both
are additions), then run tests/help.spec.mjs.

HOW THIS LANE RUNS

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews and
  merges. Don't ask him anything or wait for him. Put questions and blockers in your final message,
  and the Operator answers or relays them. Messages that arrive in this session "From the Operator"
  come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort. Any helper you start uses the same model (don't pick
  another one). Use at most one helper at a time (a helper may draft a shelf; you check every line
  it writes).
- Language: every new public-facing text is in American English, including the handoff file, the PR
  title and body. Dates like "September 28, 2026". Leave code identifiers, file names and anything
  stored in links as they are, and don't rewrite older British text outside your entries; a single
  sweep does that later.
- Read first: CLAUDE.md (the ground rules), docs/OPERATING.md (file ownership, shared lists, tests,
  screenshots, merging), docs/handoff/Help.md (the style guide), docs/TOY-PLAN.md and
  docs/WORKSTREAMS.md.
- Your handoff file: create it. Start it with this brief, word for word, under "## Brief", then keep
  "## State" (which shelves are done), "## Notes", "## Known issues" and "## For the Operator"
  current, like the other lanes' files.
- Never edit tests/taps.spec.mjs.
- Engine changes: none. If the help UI needs a change, say so in your final message; don't make it.
- Sounds: this lane changes no toy's sound.
- Before every push:
  `SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test tests/help.spec.mjs` (it checks
  every entry's shape and lengths), `npx prettier --check .`, and
  `node tools/us-english.mjs --diff`. Before you say READY, and after merging main: the full suite
  (`SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test`), then put back the standard
  screenshots (`node tools/upkeep.mjs --restore-shots`) and any other lane's screenshots your branch
  didn't change (`git checkout -- tests/screenshots/`). Add two screenshots of the About tab for one
  of your toys with a long About text: `<prefix>-about-390x844.png` and
  `<prefix>-about-1440x900.png`.
- PR: one draft PR against main with the five sections (Summary, Verification, Deviations, Known
  issues, What was cut). In Summary, list your shelves with a count of how-to lines and About texts
  each. Never merge anything. When main moves, merge it into your branch (never rebase a pushed
  branch).
- Finish every working turn with a short final message that starts with "READY:" (PR link, counts,
  test results, anything for the Operator), "WORKING:" (what's left), or "BLOCKED:" (exactly what
  you need).

Start now: read the docs and the style guide, create your handoff file, open your draft PR early,
then write shelf by shelf, pushing each shelf. When every toy on your shelves has both texts and the
checks pass, finish with "READY:".

## State

September 28, 2026: started. Shelves done: none yet.

## Notes

## Known issues

## For the Operator
