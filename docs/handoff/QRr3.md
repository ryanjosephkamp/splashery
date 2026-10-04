# Lane QR r3 (prefix `qr3`): cloud lane (moved from local, October 4, 2026)

## Brief

**Moved to the cloud (October 4, 2026, the owner's push).** This lane now runs in a cloud session
that the Operator starts, not on the owner's Mac. Everything below holds, except the local parts:
your checkout is the session's own clone on the branch named below (no worktree), use the default
port 4173 (no `SPLASHERY_PORT`), messages arrive in your session as "From the Operator" (not as PR
comments), you finish every working turn with a final message that starts "READY:", "WORKING:" or
"BLOCKED:" (and keep the same line at the top of "## State"), and clips go on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK), as docs/OPERATING.md, "Steps for a lane", says.
About ten lanes build at once during the push: edit only the files you own, merge main into your
branch whenever it moves, and run your own specs and those of the files you touch before each push;
the Integrators run the full suite before a merge (say in your PR which specs you ran).

Local lane. You are a Splashery worker session, started by the owner on his Mac from a brief the
Operator wrote. Repo: ryanjosephkamp/splashery. Your lane: QR r3 (id `QRr3`, prefix `qr3`). Your
folder is a git worktree on `claude/lane-qr-r3`. Your port: 4186. PR title: "Phase QR r3: sharper
codes, more motions, living colors and flag themes". Handoff file: docs/handoff/QRr3.md (this file;
your brief is already here). Model: Opus 5.5.

### Brief (written by the Operator on October 3, 2026, from the owner's review that evening)

The owner's review is in docs/reviews/2026-10-03-labs-review/review.md. On the QR code toy (labs;
lane QR built it, #216, and the scan lab measured it, #215) he wrote that the dots and squares look
a little blurry; he'd like more than the breaking-apart effect; he loves the live color and wants it
expanded (faster, slower, different ways); he wants country-flag color themes on the splats
themselves, not the background, with good judgment about white; and more color themes to choose
from. Every code must still scan.

#### What to build

1. **Sharper modules.** Crisp dots and squares at phone size: find what softens them (splat size and
   count per module, the kernel, the tier) and fix it, measured against the current toy at 390×844
   and 1440×900.
2. **More motions**, each ending (and, for the live ones, staying) scannable: for example a ripple
   wave across the modules, split-flap tiles that flip one by one, a fold like paper, modules that
   rain down and stack into place, and a hands-on one (knock modules loose and they snap back). Pick
   the five best and make them solid pieces that move like real things.
3. **Living colors, expanded.** More patterns (a sweep, a pulse, a gradient that flows, a rainbow
   cycle) and a speed control that clearly goes from slow to fast, with the code scanning on every
   frame (the Alive rule).
4. **Flag color themes.** A country's flag colors on the splats themselves. Contrast decides: dark
   modules must stay dark enough against the light ones to scan (the scan lab's limits), so a flag's
   white and pale colors go to the light modules or the quiet zone, and its darker colors to the
   dark modules; where a flag can't reach a scannable contrast, say so in the toy and fall back to
   its closest scannable version. Flags stay respectful: no distortion of a flag's symbols beyond
   using its colors. List every flag theme you add with its measured contrast and scan result.
5. **More color themes**: about ten palettes (sunset, ocean, forest, neon, pastel, monochrome and
   others), each measured.
6. **Proof.** Run tools/qr-scan-lab.mjs on every new motion and theme (both readers, the phone-like
   captures), and add tests/qr3.spec.mjs. Post a clip of each motion and a card with a still of each
   theme family.

#### Added October 4, 2026 (the owner's push notes)

The owner made the QR code "one of the things that we specialize in" and a major focus of the push
(docs/reviews/2026-10-04-push-alignment/notes.md). On this toy he asked for:

7. **More effects like the living color.** He likes "an electrical wave effect as the colors change"
   and wants more like it: for example a current that runs along the module paths, a charge that
   builds and discharges, a scan-line sweep. Every frame still scans.
8. **A point-cloud breakup.** As in the splat toys' effects: the code dissolves into a drifting
   cloud of points (splats shrinking to points and scattering) and gathers back into a code that
   scans.
9. More motions overall: count item 2's five plus these, and pick what reads best as motion at phone
   size. He asked "how much can we modify QR codes while keeping them working?": the answer for the
   motions is the scan lab's per-frame result, which goes in your PR.

Two other lanes work on QR codes beside you and don't touch `src/qr/`: lane QR lab r2 (prefix `qrs`,
the "How a QR code works" toy, the Damage lab and a study) and, later, lane QR craft (picture codes
and codes built from real things). If they need a hook in `src/qr/`, the Operator asks you.

#### You own

`src/qr/`, `src/packs/qr.js`, `assets/toys/qr-code/`, `tools/qr3-*.mjs`, `tests/qr3*.spec.mjs`, the
QR toy's entries in the shared lists, and this file. The scan lab's tool (`tools/qr-scan-lab.mjs`)
is yours to run, not to change; if it needs a change, say so in "State".

#### How this lane runs (local lane)

- You run in Claude Code on the owner's Mac, signed in to his second Claude account. Follow
  docs/OPERATING.md, "Local lanes", exactly: your own port (4186), the local test set, messages as
  comments on your PR that start "From the Operator", the "READY:", "WORKING:" or "BLOCKED:" line at
  the top of "## State", and clips on page 2 or on `claude/clips-QRr3`.
- The Operator (a cloud session) runs the lanes; the owner, Ryan, talks only to the Operator and is
  often away from the Mac. Never ask him anything in the terminal or wait for him: put questions in
  "State", move on to the next item, and keep going.
- Model: Opus 5.5 only, at the default effort. If `/model` shows another model, stop and say so in
  "State". At most one helper at a time, same model.
- Merging: the Operator merges. Never merge anything. An engine change is its own small, additive
  "Engine: …" PR on `claude/lane-qr-r3-engine`, merged first; toys not using it behave exactly as
  before.
- Every new toy is behind the labs switch (`labs: true`). Old `#s=` links and saved scenes keep
  loading.
- Every effect follows the effect quality rules in CLAUDE.md (real motion of solid pieces, separate
  things moving separately, break-apart into real pieces that come back), judged as phone-size
  clips, and works with the toy upright, on its side and upside down.
- Licenses, for every asset and dataset (CLAUDE.md, "Ground rules"): read the license on the live
  source page; record it in CREDITS.md, `tools/assets.json` (or `tools/models.json`) and the toy's
  in-app credit; `"nc": true` on NC assets; never ND, unlicensed, personal-use or paid. A license
  not on that list (ODbL, CERN-OHL, government terms, "free with attribution") is a question for the
  Operator in "State", not a file in the repo. Nothing human (people, faces, human anatomy or human
  scans) without the owner's yes. No logos or brand names.
- A static site: data becomes splats at build time (your `tools/qr3-*.mjs`; any new devDependency
  pinned and listed in LICENSES.md). The page never calls a data service or needs a key, and big
  files load only when the toy opens. Keep sizes inside the phone budgets.
- Work through the items in order. Open your draft PR early ("Phase QR r3: …", five sections from
  CLAUDE.md, naming Opus 5.5), push after each finished item with "State" updated, and run long jobs
  (clips, tests) in the background.
- Language: American English in every new text (color, center, gray, license, -ize endings, dates
  like "October 3, 2026").
- Read first: CLAUDE.md; docs/OPERATING.md ("Local lanes", "Steps for a lane", "A lane's end");
  docs/PACKS.md; docs/handoff/QR.md and docs/handoff/QRLab.md; docs/audits/qr-scan-lab-2026-10.md
  (the measured defaults: error correction M, contrast, module size, density).
- Before every push: CLAUDE.md, "Before every push", with the local test set. At the end: "A lane's
  end".

## State

WORKING: not started yet (October 3, 2026).
