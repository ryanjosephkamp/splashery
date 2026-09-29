# Lane Fidelity A: toys people won't recognize as splats

Prefix `fa`. Branch `claude/lane-fidelity-a`. PR title "Phase Fidelity A: the grainy-toy audit and
the worst toys made sharp". How lanes work: [OPERATING.md](../OPERATING.md).

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
ryanjosephkamp/splashery. Your lane: Fidelity A, "Toys people won't recognize as splats" (prefix
`fa`). Branch: claude/lane-fidelity-a. PR title: "Phase Fidelity A: the grainy-toy audit and the
worst toys made sharp". Handoff file: docs/handoff/FidelityA.md.

### Brief (written by the Operator on September 29, 2026, from the owner's note "big new Splashery ideas" and his answers on the Splashery Universe page the same night)

The owner's words: "I almost want to make things so incredible with this that people won't even
realize that they're looking at Gaussian splats … There are some where we could improve the fidelity
or the quality, like they could at least seem to be rendered at higher resolution. You know, for
example, like the desk lamp, or maybe like the football, or the hockey puck … Those are examples …
some of the stuff, just, like, the resolution isn't great. It just looks grainy."

Do two things:

1. **Audit every toy at phone size.** Render each toy's rest view and its tap at 390×844 (the
   contact sheet and effect clip tools), and rank every kit toy and scan by how grainy, speckled,
   soft or see-through it looks at a glance. Use the effect quality rule "Materials look like the
   real material: no see-through solids, no blur, no speckle". Write the ranked list, with one line
   per toy saying what's wrong, into your handoff file under "## Audit". A later lane, Fidelity B,
   fixes the rest from your list.
2. **Fix the worst, starting with the three the owner named**: the desk lamp (`lamp`), the American
   football (`american-football`) and the hockey puck (`hockey-puck`). Then work down your list for
   as long as each fix is clearly better: aim for about 25 toys.
   - Use the recipe's own tools: splat density and count within the tier budgets, splat sizes and
     orientation (flat splats on flat surfaces, thin ones along edges), opacity (solid things fully
     solid), cleaner colors from functions instead of noise, and sharper seams and edges.
   - A fix must not change what the toy is or how its tap moves. The owner approved those effects.
   - Keep each toy within its tier's splat budget and its load time.
   - Scans can only be improved within their recipe and our engine. Note in the audit any scan that
     needs a better capture.
   - If a fix truly needs an engine change (for example anti-aliasing, or a sharper splat kernel),
     don't make it. Describe it to the Operator in your message; a Lab lane is testing sharper
     kernels.

Clips and cards: one before-and-after card per changed toy, at 390×844 (a still pair of the rest
view, plus the tap clip when the tap changed), in groups by shelf, ids `fa-<toy-id>`. These toys are
public, so the owner's "good" marks decide each merge. Don't mix unrelated changes into the same
toy's card.

### You own

- the toy packs of the toys you change (src/packs/\*.js, except the packs of the picture, screen,
  splatting and splat-equation toys, which other lanes own), their assets/toys/<id>/ thumbnails, and
  their entries in the shared lists if any change;
- tests/fa.spec.mjs, your `fa-*` screenshots and docs/handoff/FidelityA.md.

Keep sounds as they are: two sound lanes will edit src/toy-sounds.js at the same time. Lanes Books,
Screens, Viewer and Worlds run at the same time; leave their files alone. The laptop is locked.

HOW THIS LANE RUNS

- The Operator session runs the lanes. The owner, Ryan, talks only to the Operator; he reviews clips
  and marks them. Don't ask him anything or wait for him. Put questions and blockers in your final
  message, and the Operator answers or relays them. Messages that arrive in this session "From the
  Operator" come from the coordinator on the owner's behalf.
- Model: Opus 5.5 only, at the default effort (the owner's assignment of September 29, 2026: Opus
  5.5 builds the engine, the toys, sounds and fidelity; Sonnet 5.5 builds the Worlds content, the
  Studio converters, the docs and the Integrator). Any helper you start uses the same model. Use at
  most one helper at a time. CLAUDE.md still says "Opus 5.5 only" until the Operator's rules PR
  merges; this brief is the owner's newer word.
- Merging (the owner's rules of September 29, 2026): the Operator merges Ops PRs, anything behind
  the labs switch, and additive engine PRs once the full test run passes. Changes to toys the public
  already sees wait for the owner's "good" marks. Never merge anything yourself.
- Language: every new public-facing text is in American English (color, center, gray, math, license,
  toward, -ize endings, dates like "September 29, 2026"). Leave code identifiers, file names and
  anything stored in links as they are.
- Read first: CLAUDE.md (the ground rules and "Effect quality rules" are binding),
  docs/OPERATING.md, docs/PACKS.md, docs/WORKSTREAMS.md and docs/handoff/history.md (lessons from
  earlier lanes).
- Your handoff file: create it. Start it with this brief, word for word, under "## Brief", then keep
  "## State", "## Notes", "## Known issues" and "## For the Operator" current. Note your model at
  the top of "## State" (the blog post compares the two models).
- Shared lists: edit only your own entries in src/toys.js, src/toy-sounds.js, src/toy-help.js (a
  how-to line and an About text per toy, following docs/handoff/Help.md), tools/toy-plan.json,
  CREDITS.md and tools/assets.json. Regenerate docs/TOY-PLAN.md with `node tools/toy-plan.mjs`;
  never merge it by hand.
- Never edit tests/taps.spec.mjs. Your own tests go in tests/<prefix>.spec.mjs. If a finished lane's
  test breaks because of a count or a list your work changes, don't edit it: say which test and why
  in your message, and the Operator fixes it.
- Assets: CC0, CC BY or public domain only, checked on the live source page and credited
  (CREDITS.md, tools/assets.json and the toy's in-app credit). Never BY-SA or NC. No logos, brand
  names or insignia.
- Review: post clips and cards to the Effect review page,
  https://claude.ai/artifact/NCsg9V5SzFY3Mnwuwgq7pi, as OPERATING.md's "Steps for a lane" says.
  Judge every effect as motion at phone size against the effect quality rules before you post it.
  The Operator has made your lane's record. Don't republish the page, and never write to "verdicts".
- Push your work in progress to your branch about every hour, so it isn't only in your container,
  and open your draft PR early. Many lanes run at once now, so main moves often: merge it into your
  branch before each push (never rebase a pushed branch) and keep both sides of any conflict.
- Before every push, follow "Before every push" in CLAUDE.md: the full Playwright suite
  (SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium npx playwright test), prettier,
  `node tools/us-english.mjs --diff`, `node tools/check-packs.mjs <pack>` for new or changed toys, a
  contact sheet and thumbnails, and your own screenshots at 390×844 and 1440×900. Then put back the
  standard screenshots (`node tools/upkeep.mjs --restore-shots`) and any other lane's screenshots
  your branch didn't change.
- PR: one draft PR against main with the five sections (Summary, Verification, Deviations, Known
  issues, What was cut), and the model that built it in the Summary. When main moves, merge it into
  your branch.
- After you post your cards, check the owner's marks (the "verdicts" collection, ids starting with
  your prefix) about once an hour with a scheduled check-in (send_later). Fix every "fix" in the
  same PR, post the new clip as a "-r2" card, and set replacedBy on the old one. Stop the check-ins
  once your PR is merged or closed.
- Finish every working turn with a short final message that starts with "READY:" (PR link, card ids,
  test results, anything for the Operator), "WORKING:" (what's left), or "BLOCKED:" (exactly what
  you need).

## State

Model: Opus 5.5 (claude-opus-5-5), default effort.

- September 29, 2026: lane started. Handoff file and draft PR opened; the audit is running.

## Audit

To come.

## Notes

## Known issues

## For the Operator
