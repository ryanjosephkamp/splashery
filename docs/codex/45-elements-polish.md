# Codex task 45: the periodic table and the real elements, polished

**Branch:** `codex/elements-polish`, cut from `main`.

**You may change:** `src/packs/chemistry.js`, `src/chem/`, `src/packs/real-elements.js`,
`src/elements-real/`, files under `assets/toys/real-elements/`, their entries in `tools/assets.json`
and `CREDITS.md`, `tools/rel-*.mjs` and new `tools/cdx-el-*.mjs`, new `tests/cdx-el*.spec.mjs`, and
a report at `docs/audits/elements-polish-2026-10.md`.

## Where it stands

- **Periodic table** (`periodic-table`, public, the Atoms shelf): 118 tiles; a tap builds the atom
  and an electron jumps; data from NIST (`tools/chs-data.mjs`). Known issue (docs/handoff/
  Chemistry.md): a tile tap rebuilds the whole toy, about half a second on a phone. The public sees
  this toy, so its look and behavior stay as the owner marked them; only speed and crispness change.
- **Real elements** (`real-elements`, labs): a photo of each element turned into a 3D sample with
  the Photo to 3D depth model, lifted out of the table. Photos mostly from "Images of Elements" (CC
  BY 3.0), some CC BY-SA, CC BY 4.0 and public domain; elements 84 to 118 are mostly labeled
  stand-ins. Known issues (docs/handoff/Elements.md): a few photos can't be cut cleanly (fluorine,
  sodium, uranium, neptunium); the tiles are tiny on a phone; thorium, actinium and curium have no
  open-license photo.

## Steps

1. **Measure first.** Tap time on the periodic table at the phone tier (4x throttle), and a contact
   sheet of every real element's lifted sample from the front and both sides.
2. **Periodic table: instant taps.** Build the atom for a tile without rebuilding the table (under
   50 ms at the phone tier), with no change to what it shows.
3. **Real elements: better samples.** Clean cut-outs for the hard ones; samples that hold up when
   turned (no hollow sides, no torn edges; the Photo to 3D work in task 39 may help); larger,
   readable tiles on a phone (a zoomed group view or a list).
4. **Better photos.** Look again for open-license photos of every element now shown as a stand-in or
   with a weak photo (Wikimedia Commons and similar), license checked on the live source page and
   recorded (B1, B2). A real photo replaces a stand-in only when it shows the element itself.
5. **Tests.** `tests/cdx-el*.spec.mjs`: the tap-time budget, every element's sample loads, and the
   stand-in labels stay right. Keep green: `rel`, `rel-engine`, the chemistry tests, `help`, `hta`
   and `taps` with `-g atoms`.
6. **Evidence.** The report with before-and-after contact sheets, and clips at 390x844
   (`tools/effect-clip.mjs`) of the periodic table's tap and five real elements in the PR. The
   periodic table merges only after the owner marks its clips good.

Before you push, run `npx prettier --check .`, `node tools/us-english.mjs --diff` and
`node tools/check-packs.mjs atoms`. Open a draft PR titled "Codex task 45: the periodic table and
the real elements, polished" with the five sections from CLAUDE.md and a "Rule check" line
(`builders/RULES.md`).
