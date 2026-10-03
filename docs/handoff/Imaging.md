# Lane Imaging (prefix `img`): local lane

## Brief

Local lane. You are a Splashery worker session, started by the owner on his Mac from a brief the
Operator wrote. Repo: ryanjosephkamp/splashery. Your lane: Imaging (id `Imaging`, prefix `img`).
Your folder is a git worktree on `claude/lane-imaging`. Your port: 4183. PR title: "Phase Imaging:
see inside with X-ray, CT and microscope splats". Handoff file: docs/handoff/Imaging.md (this file;
your brief is already here). Model: Opus 5.5.

### Brief (written by the Operator on October 3, 2026, from the owner's notes that afternoon)

The owner, on October 3, 2026: "Can we open some lanes here for the imaging (X-ray, etc.) ideas". A
new labs shelf, "Imaging", of about eight toys that show how we see inside things.

#### What to build

1. **Airport X-ray scanner.** Kit-built bags and boxes ride a belt through a scanner and show in
   X-ray colors (organic orange, metal blue, dense black). Objects only. A tap sends the next bag.
2. **How CT works.** A kit-built scanner ring turns around a specimen and builds it up slice by
   slice; then drag a cutting plane through the result.
3. **A real CT or micro-CT scan** of a natural specimen (a shell, a fossil, a seed, an insect in
   amber, a fish skeleton) from an openly licensed dataset, as splats: slice it, switch between its
   dense parts and the whole, turn it.
4. **MRI of a fruit** (a kiwi or an orange): slices you scroll through, kit-built to look like real
   MRI slices, or real data if its license allows.
5. **Electron microscope.** Pollen grains, a diatom and a snowflake as a scanning electron
   microscope sees them (gray, deep shadows), with zoom steps.
6. **Thermal camera.** A cup of hot tea cooling and a hand warmer, in false color.
7. Up to two ideas of your own in the same spirit (sonar, a radio telescope image, ultrasound of an
   object).

A cutting plane (hide the splats on one side of a plane the person drags) and a density window (show
only a range of density) are likely engine pieces: one small "Engine: a cutting plane and a density
window" PR, merged first. If docs/audits/new-sources-2026-10.md (the owner's Dot is researching
sources) has landed on main, use it for item 3.

#### You own

`src/packs/imaging.js`, `src/imaging/` if needed, `tools/img-*.mjs`, `assets/toys/<your toys>/`,
`tests/img*.spec.mjs`, your toys' entries in the shared lists, your engine PR's module, and this
file.

#### How this lane runs (local lane)

- You run in Claude Code on the owner's Mac, signed in to his second Claude account. Follow
  docs/OPERATING.md, "Local lanes", exactly: your own port (4183), the local test set, messages as
  comments on your PR that start "From the Operator", the "READY:", "WORKING:" or "BLOCKED:" line at
  the top of "## State", and clips on page 2 or on `claude/clips-Imaging`.
- The Operator (a cloud session) runs the lanes; the owner, Ryan, talks only to the Operator and is
  often away from the Mac. Never ask him anything in the terminal or wait for him: put questions in
  "State", move on to the next item, and keep going.
- Model: Opus 5.5 only, at the default effort. If `/model` shows another model, stop and say so in
  "State". At most one helper at a time, same model.
- Merging: the Operator merges. Never merge anything. An engine change is its own small, additive
  "Engine: …" PR on `claude/lane-imaging-engine`, merged first; toys not using it behave exactly as
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
- A static site: data becomes splats at build time (your `tools/img-*.mjs`; any new devDependency
  pinned and listed in LICENSES.md). The page never calls a data service or needs a key, and big
  files load only when the toy opens. Keep sizes inside the phone budgets.
- Work through the items in order. Open your draft PR early ("Phase Imaging: …", five sections from
  CLAUDE.md, naming Opus 5.5), push after each finished item with "State" updated, and run long jobs
  (clips, tests) in the background.
- Language: American English in every new text (color, center, gray, license, -ize endings, dates
  like "October 3, 2026").
- Read first: CLAUDE.md; docs/OPERATING.md ("Local lanes", "Steps for a lane", "A lane's end");
  docs/PACKS.md; docs/handoff/Science.md and docs/handoff/Chemistry.md (kit-built science toys);
  docs/handoff/PhotorealR2.md (how real captures are sized).
- Before every push: CLAUDE.md, "Before every push", with the local test set. At the end: "A lane's
  end".

## State

WORKING: not started yet (October 3, 2026).
