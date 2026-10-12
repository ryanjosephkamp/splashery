# Lane Privacy r1: the owner's words out of the docs (prefix `prv`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session,
session_01Mo8sLhAitbYjZiPgD8Hc4t). Repo: ryanjosephkamp/splashery. Your lane: Privacy r1 (id
`PrivacyR1`, prefix `prv`). Branch: `claude/lane-privacy-r1` from main. PR title: "Phase Privacy r1:
the owner's words out of the docs". Handoff file: docs/handoff/PrivacyR1.md (create it; start it
with this brief, word for word, under "## Brief", then keep "## State", "## Notes", "## Known
issues" and "## For the Operator" current). Model: Sonnet 5.5, at high effort.

Read CLAUDE.md (note the new ground rule "The owner's notes are private"), docs/HANDOFF.md ("Now"),
docs/OPERATING.md, docs/handoff/ScienceR3.md ("How this lane runs").

### Brief (written by the Operator on October 11, 2026)

The owner's rule of October 11, 2026: every note, review, answer, idea or file he gives a session is
private. Only the Operator's own summary, in its own words, is committed. The repo is public and
GitHub Pages serves every tracked file, and the site's lab notebook pages (site/learn/notebook/\*)
render the lane handoff files as they are. Ops #541 already removed his raw notes and screenshots
from docs/reviews/ and his words from tools/sound-review.json. Your job is the rest:

1. **Rewrite every substantial quote of the owner in the docs in the Operator's words** (a neutral,
   short paraphrase of what he asked or decided; keep the decision and its date, drop his wording,
   filler and anything personal such as usage chatter). Short decision records of a few words (his
   "good", "kit yes, notes private") may stay. An audit found these (file:lines on main at 7ae3841b;
   check each, the lines may have shifted):
   - Long (700+ characters): docs/handoff/Worlds.md (10, 143-155, 418-435, 621-624, 665-670, 694),
     UIr2.md (13-22), UIr3.md (10-22), ScreensR2.md (19-36), Fix6.md (26-30, 52-54, 65-70, 82-83),
     Lab.md (13-18, 81-82, 148-160, 220), Books.md (15-23, 116-120, 172, 196-240), Chemistry.md
     (15-22), Viewer.md (14, 35-44, 62-65), Help.md (12), HelpTextA.md (19), HelpTextB.md (23),
     Manual.md (91-98, 190-194), Screens.md (11-17, 108-112, 197).
   - Medium (250 to 700): UIr4.md (11-16), Video3D.md (12-17), Pictures.md (11-31), Anatomy.md
     (12-17), StudioModels.md (12-17), StudioMedia.md (13-16), Fix3.md (20-22), E4-finish.md
     (14-19), Character.md (10), Fluids.md (90), PhotorealR3.md (13), LiveR7.md (17, 124),
     PhotoFidelity.md (116), PhotoSharpView.md (15, 117), Learn.md (16), MachinesA.md (15, 111), and
     one idea quoted in FidelityA.md (15), FidelityB.md (15), Sharpness.md (11) and history.md (69).
   - Short (100 to 250): Fix4, Fix5, Science, RealObjects, Physics, AnyPose, QRLabR2, BooksR5,
     Powers, SoundA, SoundB, UIr5, Photo3D, Photoreal, and docs/PHOTO-VIEWS.md (17).
   - Outside docs/handoff: docs/evidence/README.md (3; shown at site/learn/evidence/),
     docs/codex/21-pdf-motion.md (8), docs/codex/14-fluid-phone.md (6), docs/codex/16 to 20 (the
     same quote at line 8 in each), docs/codex/22 (8).
   - Code comments quoting him (optional, one or two sentences): tests/sng.spec.mjs:30,
     src/packs/moving-photo.js:627, src/packs/chladni-sand.js:1, tests/psv3.spec.mjs:131,
     tools/lv7-sharp-compare.mjs:2. Paraphrase them only if it's a comment-only change.

   Also search for anything the audit missed ("word for word", "verbatim", "in his words", "the
   owner wrote", long blockquotes attributed to him) and treat it the same way.

2. **Fix the links to the removed files.** docs/reviews/ now holds only the Operator's triage and
   plan files (2026-09-28-help/review.md and 2026-10-02-mega-review/answers.md are redacted
   summaries). Links elsewhere to removed files (review.md, notes.md, follow-up.md, ideas-note.md,
   sounds-2026-10-02.md and the screenshots) must go: point them at the matching triage file if one
   exists, or keep the date as plain text. They are in about 44 handoff files and in
   docs/HANDOFF.md, docs/ROADMAP.md, docs/handoff/history.md, docs/PACKS.md, docs/FLUIDS.md and test
   comments. Briefs that told a lane to "read docs/reviews/…" get "(the owner's notes are private;
   the Operator's summary is in the brief)".

3. **Rebuild the site** (`node tools/site-build.mjs`, `npx prettier --write site`,
   `node tools/site-build.mjs --check`) so the notebook and evidence pages match, and check with a
   grep of site/ that no long quote is left.

You may edit, for these changes only: docs/handoff/\*.md (the old lanes' files, including
history.md; not the files of the running lanes SiteR5, ManualR7a, ManualR7b), docs/HANDOFF.md
(history sections only, never "Now"), docs/ROADMAP.md, docs/PACKS.md, docs/FLUIDS.md,
docs/PHOTO-VIEWS.md, docs/evidence/README.md, docs/codex/\*.md, comment lines in tests/\*.spec.mjs,
src/ and tools/ (comments only; no code changes), and site/ (regenerated only). Don't change
meaning, decisions or dates. Never copy any of his words into your PR, cards or handoff file; don't
quote what you removed.

How this lane runs: as docs/handoff/ScienceR3.md, "How this lane runs", says (replace the prefix and
lane record with yours). This is a docs-only Ops-tier change: no cards needed; the Operator merges
after your checks. Before READY, run `npx prettier --check .`, `node tools/us-english.mjs --diff`,
and the specs site, spg, tpg, st2, st3, help and unit. Finish every working turn with "READY:",
"WORKING:" or "BLOCKED:" (the Operator reads it; never ask the owner). When main moves, merge it
into your branch (never rebase). Usage is tight until the weekly reset (Wednesday, October 14, 2026,
4 p.m. ET): no helpers; aim for READY within about four hours.

## State

Model: Sonnet 5.5 (claude-sonnet-5-5), high effort. Branch `claude/lane-privacy-r1`. Docs-only: no
cards, no toys.

- October 11, 2026: items 1 and 2 done (see Notes); item 3 and the checks are listed under "For the
  Operator" once they have run.

## Notes

- Every audited quote was rewritten as a short paraphrase in the Operator's voice, with the decision
  and its date kept. Short fragments of a few words (for example "Hybrid yes", "good") stay.
- Quotes the audit missed were found with a sweep for long quoted spans, "word for word",
  "verbatim", "in his words" and "his words", and treated the same way: AI.md, E6a.md, Elements.md,
  Fix3.md, Fix7.md, Fluids.md, LiveInput.md, LiveR7.md, MachinesA.md, PagesR6.md, Pianos.md,
  QRLabR2.md, ScienceR3.md, SharpA.md, SharpB.md, Site.md, StudioSound.md, history.md and others.
  Labels that promised his raw text ("word for word", "his words") now say that his notes are
  private.
- Links to removed review files were replaced with a plain mention (the notes are private) or, where
  a triage exists, a link to it (docs/reviews/2026-10-06-walkthrough/triage.md,
  docs/reviews/2026-10-02-mega-review/answers.md, docs/reviews/2026-09-28-help/review.md).
- Left as they are on purpose: the Operator's own briefs "word for word" (they are the Operator's
  words), the toys' approved how-to and About texts, and the Pianos tap and sound lines (the plan's
  text).
- Code comments paraphrased: src/packs/moving-photo.js, src/packs/chladni-sand.js,
  tests/sng.spec.mjs, tests/psv3.spec.mjs, tools/lv7-sharp-compare.mjs. Dead review paths changed in
  comments: src/voices.js, tests/sndc.spec.mjs, tests/sndd.spec.mjs. No code changed.

## Known issues

- Some files outside this lane's list still link to removed files, or carry his words (see "For the
  Operator").

## For the Operator

Outside what this lane may edit (left alone):

- `docs/WORKSTREAMS.md` (rows for Sound C, QR r4, Manual r3, QR r5 and others), `docs/OPERATING.md`
  and `docs/audits/photoreal-media-sources-2026-10.md`, `docs/audits/photoreal-sounds-2026-10.md`
  still link to removed review files or carry short quotes of him.
- `tools/toy-plan.json` ("about" and several toys' notes), `tools/toy-plan.mjs` (line 99) and the
  generated `docs/TOY-PLAN.md` still carry a link to the removed 2026-09-23 review and some per-toy
  review notes in his wording.
- `tools/sound-review.json` still names the removed mega-review file in its "note" field.
- Short quotes of him remain in a few code comments (for example in `src/sharpness.js`,
  `src/packs/science.js`, `src/packs/arcade-*.js`, `src/packs/geo.js`); they are under 100
  characters and were not in the audit.
