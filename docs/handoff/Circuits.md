# Lane Circuits (prefix `hw`): local lane

## Brief

Local lane. You are a Splashery worker session, started by the owner on his Mac from a brief the
Operator wrote. Repo: ryanjosephkamp/splashery. Your lane: Circuits (id `Circuits`, prefix `hw`).
Your folder is a git worktree on `claude/lane-circuits`. Your port: 4185. PR title: "Phase Circuits:
circuit boards, logic and hardware you can open". Handoff file: docs/handoff/Circuits.md (this file;
your brief is already here). Model: Opus 5.5.

### Brief (written by the Operator on October 3, 2026, from the owner's notes that afternoon)

The owner, on October 3, 2026: "and other cool splats (circuit designs, hardware, etc.)". A new labs
shelf, "Circuits", of about eight kit-built toys (so no license questions), with no logos or brand
names.

#### What to build

1. **A circuit board.** Flip its switch and current pulses run along the copper traces, LEDs light,
   a buzzer beeps, and a capacitor charges and lets go.
2. **Logic gates** you toggle (AND, OR, NOT, XOR) with lit wires, then a half adder that adds two
   bits.
3. **A binary counter.** Four LEDs count up with each tap, and a seven-segment display shows the
   number.
4. **A breadboard** with a blinking LED circuit. Pull a wire out (hands-on) and it stops; put it
   back and it blinks.
5. **A chip, opened.** The package lifts off and the metal layers peel apart as real pieces, down to
   rows of transistors, then come back.
6. **A desktop computer, opened.** The side panel comes off, the fans spin, the memory sticks slide
   out and back.
7. **A motor and an electromagnet.** The rotor spins with the current; the magnet picks up paper
   clips and drops them.
8. One idea of your own.

Real numbers where they show (Ohm's law on the board, the counter in binary), and sounds made in
code (clicks, hums, beeps).

#### You own

`src/packs/circuits.js`, `tools/hw-*.mjs`, `assets/toys/<your toys>/`, `tests/hw*.spec.mjs`, your
toys' entries in the shared lists, your engine PR's module if you need one, and this file.

#### How this lane runs (local lane)

- You run in Claude Code on the owner's Mac, signed in to his second Claude account. Follow
  docs/OPERATING.md, "Local lanes", exactly: your own port (4185), the local test set, messages as
  comments on your PR that start "From the Operator", the "READY:", "WORKING:" or "BLOCKED:" line at
  the top of "## State", and clips on page 2 or on `claude/clips-Circuits`.
- The Operator (a cloud session) runs the lanes; the owner, Ryan, talks only to the Operator and is
  often away from the Mac. Never ask him anything in the terminal or wait for him: put questions in
  "State", move on to the next item, and keep going.
- Model: Opus 5.5 only, at the default effort. If `/model` shows another model, stop and say so in
  "State". At most one helper at a time, same model.
- Merging: the Operator merges. Never merge anything. An engine change is its own small, additive
  "Engine: …" PR on `claude/lane-circuits-engine`, merged first; toys not using it behave exactly as
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
- A static site: data becomes splats at build time (your `tools/hw-*.mjs`; any new devDependency
  pinned and listed in LICENSES.md). The page never calls a data service or needs a key, and big
  files load only when the toy opens. Keep sizes inside the phone budgets.
- Work through the items in order. Open your draft PR early ("Phase Circuits: …", five sections from
  CLAUDE.md, naming Opus 5.5), push after each finished item with "State" updated, and run long jobs
  (clips, tests) in the background.
- Language: American English in every new text (color, center, gray, license, -ize endings, dates
  like "October 3, 2026").
- Read first: CLAUDE.md; docs/OPERATING.md ("Local lanes", "Steps for a lane", "A lane's end");
  docs/PACKS.md; docs/handoff/MachinesA.md (kit-built machines), docs/handoff/AI.md (the computing
  shelf) and docs/handoff/Science.md.
- Before every push: CLAUDE.md, "Before every push", with the local test set. At the end: "A lane's
  end".

## State

WORKING: not started yet (October 3, 2026).
