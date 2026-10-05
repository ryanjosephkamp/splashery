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

READY: every item of the brief is built, measured and on Effect review page 2 (16 cards under "QR
r3"), October 5, 2026, Opus 5.5. Waiting for the owner's marks. Specs run: `tests/qr3.spec.mjs`,
`tests/qr.spec.mjs`, `tests/help.spec.mjs`; the Integrator runs the full suite.

Tools (all `tools/qr3-*.mjs`): `qr3-sharp.mjs` (edge width), `qr3-scan.mjs` (motions, Alive and
themes through the scan lab's readers and captures), `qr3-clip.mjs` (the review clips),
`qr3-render.mjs` (one scan render). The test hook gains
`qr.frame({ motion, q, alive, phase, yaw, pitch, knock, settle })`, `qr.theme(id)`, `qr.themes()`,
`qr.motions()`, `qr.patterns()`, and `info().contrast`. The scan lab's own tool was run as is (no
change needed).

For the other QR lanes: nothing changed in `src/qr/encode.js`, `content.js` or `scan.js`; the splat
params' second value now also carries a module's path distance (× 100), and the sheet's splats
carry 20.

### Item 1: sharper modules (measured)

What softened them: every module was a lattice of round splats (3 to 5 per module edge), and a
lattice can only end in a soft edge about as wide as one of its splats (a fifth of a module). The
sharp kernel (labs, `kernel: "sharp"`) and the tier mattered much less (below).

The fix (`src/qr/build.js`, `crisp()`): each shape's edges are drawn by three rings of thin splats
laid along the edge (0.03, 0.06 and 0.11 of a module across, three times as long along it, finer at
square corners), and only the middle is the lattice. Sides that run into a dark neighbor get no
ring; inside corners keep clear; the light sheet is coarser and leaves out what the dark modules
cover. Bubbles' rims and the 3D side walls no longer reach past a module's edge (the small spikes at
the finder corners are gone), and Neon's tubes are crisp pieces too. Codes that would not fit the
tier's splat budget get coarser rings (one retry at the predicted scale), or the old lattice if that
is smaller. Before: up to 165,000 splats (Bricks); now 70,000 to 133,000 at the mid tier.

`node tools/qr3-sharp.mjs` (the toy in Scan view, default link): the median 10–90% rise across every
dark-light module boundary, in CSS pixels (lower is crisper):

| Style     | Phone 390×844 @2x, before → after | Desktop 1440×900, before → after |
| --------- | --------------------------------- | -------------------------------- |
| Classic   | 1.43 → 0.68                       | 3.21 → 1.43                      |
| Dots      | 1.28 → 0.74                       | 2.91 → 1.53                      |
| Rounded   | 1.43 → 0.71                       | 3.21 → 1.45                      |
| Bricks    | 1.11 → 0.60                       | 2.46 → 1.38                      |
| Gems      | 1.15 → 0.81                       | 2.55 → 1.74                      |
| Bubbles   | 1.07 → 0.66                       | 2.35 → 1.41                      |
| Pale Neon | 1.22 → 0.69                       | 2.77 → 1.41                      |

A module is 8.3 CSS px on the phone and 19 px on the desktop. Noise inside modules fell too (Classic
3.3 → 0.6 gray levels on the phone). The sharp kernel on top of this changed the edge by 0.01 to
0.07 px, so the toy keeps the Gaussian. The first scan render right after a build is now preceded by
a warm-up frame: with finer edges, a frame drawn before the splat sort had finished came out gray
and hatched (it failed the Full screen test once).

`tests/qr.spec.mjs` passes (12 of 12) with the change.

### Items 2, 7 and 8: motions (built)

`src/qr/field.js` now runs one motion at a time: `uSpMorph.x` says which (`MOTION_IDS`), `.y` how
far (0..1), `.zw` the tap point. Six new ones, each moving solid pieces and exactly at rest at 0 and
1:

- **Ripple** (3.8 s): a ring wave runs out from the middle; each tile rises, falls and tilts with
  the slope under it.
- **Split-flap** (4.2 s): row by row, like a departure board, each tile turns once on its own axle,
  shows its back color, and comes round to the front.
- **Fold** (5.0 s): the code folds like paper (right half over the left, then the top down), then
  unfolds; the light sheet folds too, splat by splat, and the paper's back is plain.
- **Rain** (4.4 s): the pieces lift off the top, then rain back, bottom row first, land with a small
  bounce and stack into place.
- **Knock loose** (2.8 s), the tap: the pieces around the tap fly out toward you, tumble and snap
  back on a spring. A second tap knocks again where it lands. (Burst and return is a Toy-tab button
  now.)
- **Point cloud** (5.2 s, item 8): every splat shrinks to a point; the code dissolves from the left
  into a drifting, swirling cloud and gathers back.

An underlay in the light color now sits behind the sheet, so a piece that moves away shows paper,
not a hole; the sheet sits 0.26 of a module behind the modules so at an angle none of it sorts in
front of them (it turned the code gray and hatched at 25°).

### Items 3 and 7: Alive (built)

Eight patterns (`PATTERNS`, picked in the panel; the option `alivePattern`): Wave, Sweep, Pulse,
Flowing gradient, Rainbow, and the electric ones, Current (pulses run along the dark paths: each
module knows its distance along its path, `pathDistances()`), Charge (fills in from the edges, then
discharges in a flash from the middle) and Scan line. A speed slider (`speed`, 0 to 1) runs them
from a quarter as fast to four times as fast; the phase is integrated, so a change of speed never
jumps the colors. Each pattern moves a module's hue and may lift a dark module's gray, never by more
than 35% of the way to the light modules (the color patterns use at most 60% of that).

### Items 4 and 5: themes (built)

`src/qr/themes.js`: twelve palettes and 24 flags, each at least 4.5 : 1 (test-checked). Flags: the
palest color is the light modules (white light modules if none is pale), the darker colors are the
code (a gradient between the first two) and the eyes; a color under 4.5 : 1 is darkened just enough,
keeping its hue; a color under 2.5 : 1 (a yellow on white) would turn brown, so it colors Alive and
the back of the tiles instead. The panel shows the measured contrast and these notes.

### Item 6: every theme measured

`node tools/qr3-scan.mjs themes --styles=classic,bricks` (October 5, 2026): each theme in Classic
and Bricks, the toy's own check, the scan lab's 9 phone-like captures read by jsQR and zxing (both
must read the exact text), and the toy's camera turned 10° and 20° (shrunk to 8 px per module).
Every theme passed everything: check ✓, 9/9, 10° ✓, 20° ✓ in both styles.

| Theme                 | Contrast  | Code / light       | Notes                                                                                                                                                                                                           |
| --------------------- | --------- | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sunset                | 5.97 : 1  | #4a1d5e on #fff3e0 |                                                                                                                                                                                                                 |
| Ocean                 | 5.81 : 1  | #0b3d5c on #eef9fb |                                                                                                                                                                                                                 |
| Forest                | 6.95 : 1  | #1f3d2b on #f4f1e6 |                                                                                                                                                                                                                 |
| Neon                  | 6.26 : 1  | #1c0045 on #f6f0ff |                                                                                                                                                                                                                 |
| Pastel                | 6.48 : 1  | #4a3f6b on #fdeef3 |                                                                                                                                                                                                                 |
| Monochrome            | 11.37 : 1 | #111111 on #ffffff |                                                                                                                                                                                                                 |
| Ink and paper         | 8.60 : 1  | #1b2a49 on #f3ead8 |                                                                                                                                                                                                                 |
| Candy                 | 6.89 : 1  | #a3134f on #fff0f6 |                                                                                                                                                                                                                 |
| Autumn                | 8.19 : 1  | #5a260c on #fbf3e4 |                                                                                                                                                                                                                 |
| Mint                  | 6.99 : 1  | #0f4c3a on #effaf5 |                                                                                                                                                                                                                 |
| Royal                 | 7.21 : 1  | #2b1055 on #fbf8ef |                                                                                                                                                                                                                 |
| Lava                  | 8.62 : 1  | #3a0a0a on #fff4ec |                                                                                                                                                                                                                 |
| United States (flag)  | 6.62 : 1  | #3c3b6e on #ffffff |                                                                                                                                                                                                                 |
| United Kingdom (flag) | 5.88 : 1  | #012169 on #ffffff |                                                                                                                                                                                                                 |
| Canada (flag)         | 5.01 : 1  | #d52b1e on #ffffff |                                                                                                                                                                                                                 |
| Mexico (flag)         | 5.63 : 1  | #006847 on #ffffff |                                                                                                                                                                                                                 |
| Brazil (flag)         | 4.54 : 1  | #008934 on #ffffff | Its yellow is too pale to read against the white, so it colors Alive and the back of the tiles instead of the modules. Its green is darkened a little (3.83 : 1 → 4.5 : 1 against the white) so the code scans. |
| Argentina (flag)      | 4.53 : 1  | #527a9e on #ffffff | Its sun yellow is too pale to read against the white, so it colors Alive and the back of the tiles instead of the modules. Its light blue is darkened (2.41 : 1 → 4.5 : 1 against the white) so the code scans. |
| France (flag)         | 5.63 : 1  | #002654 on #ffffff |                                                                                                                                                                                                                 |
| Germany (flag)        | 4.53 : 1  | #000000 on #ffcc00 | Its red is darkened (3.41 : 1 → 4.5 : 1 against the gold) so the code scans.                                                                                                                                    |
| Italy (flag)          | 4.57 : 1  | #008841 on #ffffff | Its green is darkened a little (4.04 : 1 → 4.5 : 1 against the white) so the code scans.                                                                                                                        |
| Spain (flag)          | 4.56 : 1  | #a3141a on #f1bf00 | Its red is darkened a little (4.30 : 1 → 4.5 : 1 against the yellow) so the code scans.                                                                                                                         |
| Ireland (flag)        | 4.54 : 1  | #138755 on #ffffff | Its orange is too pale to read against the white, so it colors Alive and the back of the tiles instead of the modules. Its green is darkened a little (3.56 : 1 → 4.5 : 1 against the white) so the code scans. |
| Netherlands (flag)    | 7.01 : 1  | #21468b on #ffffff |                                                                                                                                                                                                                 |
| Sweden (flag)         | 4.56 : 1  | #005e95 on #fecc00 | Its blue is darkened a little (3.83 : 1 → 4.5 : 1 against the yellow) so the code scans.                                                                                                                        |
| Ukraine (flag)        | 4.91 : 1  | #0057b7 on #ffd700 |                                                                                                                                                                                                                 |
| Greece (flag)         | 6.49 : 1  | #0d5eaf on #ffffff |                                                                                                                                                                                                                 |
| India (flag)          | 4.61 : 1  | #000080 on #ffffff | Its saffron is too pale to read against the white, so it colors Alive and the back of the tiles instead of the modules.                                                                                         |
| Japan (flag)          | 6.61 : 1  | #bc002d on #ffffff |                                                                                                                                                                                                                 |
| South Korea (flag)    | 5.19 : 1  | #0047a0 on #ffffff |                                                                                                                                                                                                                 |
| China (flag)          | 4.54 : 1  | #df1a23 on #ffff00 | Its red is darkened a little (4.05 : 1 → 4.5 : 1 against the yellow) so the code scans.                                                                                                                         |
| Australia (flag)      | 4.85 : 1  | #012169 on #ffffff |                                                                                                                                                                                                                 |
| South Africa (flag)   | 4.56 : 1  | #007a4d on #ffffff | Its gold is too pale to read against the white, so it colors Alive and the back of the tiles instead of the modules. Its red is darkened a little (4.45 : 1 → 4.5 : 1 against the white) so the code scans.     |
| Nigeria (flag)        | 4.58 : 1  | #008751 on #ffffff |                                                                                                                                                                                                                 |
| Kenya (flag)          | 6.75 : 1  | #000000 on #ffffff |                                                                                                                                                                                                                 |
| Jamaica (flag)        | 14.33 : 1 | #000000 on #fed100 | Its green is too pale to read against the gold, so it colors Alive and the back of the tiles instead of the modules.                                                                                            |

### Item 6 (and 9): how much can a code move and still scan?

`node tools/qr3-scan.mjs motions --steps=10` (October 5, 2026): each motion's frames at progress 0,
0.1, …, 1, front on, shrunk to 8 px per module (phone size) and read by jsQR and zxing (both must
return the exact text); the last frame also through the scan lab's 9 phone-like captures. Each cell:
frames that read out of 11. **Every motion in every style ends on a code that reads in 9 of 9
phone-like captures.**

| Style      | assemble | flip  | burst | ripple | flap  | fold | rain | knock | cloud |
| ---------- | -------- | ----- | ----- | ------ | ----- | ---- | ---- | ----- | ----- |
| classic    | 4/11     | 11/11 | 2/11  | 10/11  | 10/11 | 3/11 | 4/11 | 7/11  | 2/11  |
| dots       | 3/11     | 11/11 | 2/11  | 9/11   | 10/11 | 3/11 | 4/11 | 7/11  | 2/11  |
| rounded    | 4/11     | 11/11 | 2/11  | 10/11  | 10/11 | 3/11 | 4/11 | 7/11  | 2/11  |
| bricks     | 4/11     | 6/11  | 2/11  | 9/11   | 9/11  | 3/11 | 4/11 | 7/11  | 2/11  |
| gems       | 4/11     | 9/11  | 2/11  | 10/11  | 9/11  | 3/11 | 4/11 | 7/11  | 2/11  |
| bubbles    | 4/11     | 10/11 | 2/11  | 10/11  | 9/11  | 3/11 | 4/11 | 7/11  | 2/11  |
| neon       | 3/11     | 10/11 | 2/11  | 9/11   | 9/11  | 2/11 | 4/11 | 7/11  | 2/11  |
| neon-light | 3/11     | 9/11  | 2/11  | 9/11   | 10/11 | 2/11 | 4/11 | 7/11  | 2/11  |

What it says: a code survives motions that keep each module in its own place in the picture: a
ripple's tilt and rise (9 or 10 of 11), the split-flap's row of turning tiles (9 or 10), Flip (9 to
11; Bricks 6, its tall blocks hide neighbors while they turn), and Knock loose once the pieces are
near home (7). Motions that take modules out of their places (Burst, Rain, Fold, Point cloud, the
middle of Assemble) read only at rest, which is what makes them read as breaking apart: error
correction M covers about 15% of the code, and those motions move far more.

### Item 6: every Alive pattern, every style

`node tools/qr3-scan.mjs alive --frames=8` (October 5, 2026): 8 phases of one loop of each pattern,
front on and turned 10° and 20° in yaw, shrunk to 8 px per module, read by jsQR and zxing (both must
read the exact text; glowing Neon by their inverted passes). Each cell: front / 10° / 20°, out of 8.
Pale-wall Neon's Charge and Current first read 7 and 6 of 8 front on; the lift now never brings a
dark module within 0.55 gray of the light ones, and they read 8 of 8 (the cells below are after the
fix; Charge, Current and Rainbow were also rerun for Classic and Bricks). The full 1,024 px renders
miss a few frames (Bricks at 10°: 0 of 8), the readers' own limit with 15 px modules that the scan
lab's audit describes; at phone size every frame reads.

| Style      | wave  | sweep | pulse | flow  | rainbow | current | charge | scan  |
| ---------- | ----- | ----- | ----- | ----- | ------- | ------- | ------ | ----- |
| classic    | 8/8/8 | 8/8/8 | 8/8/8 | 8/8/8 | 8/8/8   | 8/8/8   | 8/8/8  | 8/8/8 |
| dots       | 8/8/8 | 8/8/8 | 8/8/8 | 8/8/8 | 8/8/8   | 8/8/8   | 8/8/8  | 8/8/8 |
| rounded    | 8/8/8 | 8/8/8 | 8/8/8 | 8/8/8 | 8/8/8   | 8/8/8   | 8/8/8  | 8/8/8 |
| bricks     | 8/8/8 | 8/8/8 | 8/8/8 | 8/8/8 | 8/8/8   | 8/8/8   | 8/8/8  | 8/8/8 |
| gems       | 8/8/8 | 8/8/8 | 8/8/8 | 8/8/8 | 8/8/8   | 8/8/8   | 8/8/8  | 8/8/8 |
| bubbles    | 8/8/8 | 8/8/8 | 8/8/8 | 8/8/8 | 8/8/8   | 8/8/8   | 8/8/8  | 8/8/8 |
| neon       | 8/8/8 | 8/8/8 | 8/8/8 | 8/8/8 | 8/8/8   | 8/8/8   | 8/8/8  | 8/8/8 |
| neon-light | 8/8/8 | 8/8/8 | 8/8/8 | 8/8/8 | 8/8/8   | 8/8/8   | 8/8/8  | 8/8/8 |

### Polish round (October 5, 2026, from the owner's "the toys could still be sharper")

The owner marked all 16 cards good. On `claude/lane-qr-r3-polish` (from `14f28439`):

- **Twice the splat budget** (`density: 2`: 240,000 at the mid tier, the tier's own ceiling), spent
  on finer edge rings: the build tries scale 0.6 first (`TUNE.finest`; the outermost ring 0.018 of a
  module across) and coarsens only when a big code would not fit.
- **Gems' facets** no longer reach past the module's edge at the girdle (the last style whose
  outline was soft).
- `node tools/qr3-sharp.mjs`, edge in CSS px (round 3 → polish): phone 390×844: Classic 0.68 → 0.56,
  Dots 0.74 → 0.56, Rounded 0.71 → 0.54, Bricks 0.60 → 0.54, Gems 0.81 → 0.57, Bubbles 0.66 → 0.57,
  pale Neon 0.69 → 0.46; desktop 1440×900: Classic 1.43 → 1.09, Dots 1.53 → 1.13, Rounded 1.45 →
  1.08, Bricks 1.38 → 1.24, Gems 1.74 → 1.33, Bubbles 1.41 → 1.13, pale Neon 1.41 → 0.90. On a phone
  that is about one device pixel, close to what the screen can show. The labs sharp kernel still
  adds almost nothing (0.01 to 0.07 px), so it stays off.
- **Knock loose** reads at phone size: the pieces fly further and spin less, so they stay face-on as
  dark tiles.
- Clips are filmed from a little below now: seen from above, pieces flying toward the camera drew
  lighter (the splat sort runs a frame behind them).
- Checks: every motion's last frame in all 8 styles reads in 9 of 9 phone-like captures (jsQR and
  zxing); `tests/qr3.spec.mjs` and `tests/qr.spec.mjs` pass (20 tests).
