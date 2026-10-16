# Codex task 97: One toy for the 4D shapes, one for the strange attractors (old links keep working)

**Branch:** `codex/math-pickers`, cut from `main` **after PR #197 (task 65, the old-links corpus)
has merged**; its compatibility tests must be on `main` first. One draft PR against `main`. Read
`AGENTS.md`, `builders/RULES.md`, CLAUDE.md (old `#s=` links and saved scenes must keep loading),
and `docs/SCENE-SCHEMA.md`.

## Why

The Math shelf has the 4D shapes and the strange attractors as separate toys, while the knot toy
offers its variants in one picker. The owner wants the same here: one "4D shapes" toy and one
"Strange attractors" toy, each with a picker, without losing any feature or any old link.

## What to build

1. **4D shapes:** `hypercube` (its own recipe, `src/packs/maths.js` around 1995, with "Turn inside
   out") and `five-cell`, `sixteen-cell`, `twenty-four-cell`, and `duoprism` (the `fourDRecipe`
   factory, around 5809, with "Roll through 4D", the Colors select, and the duoprism's p and q). One
   toy, hypercube first, with a Shape picker; each shape keeps its own drive, colors, and options.
2. **Strange attractors:** `lorenz` (its own recipe, around 1494, with Race and the hands-on follow)
   and `rossler-attractor`, `thomas-attractor`, and `aizawa-attractor` (the `ATTRACTORS` table,
   around 5453). One toy, Lorenz first, with an Attractor picker; each keeps its own actions.
3. **Old ids keep working.** Add a small alias map (for example `TOY_ALIASES` in `src/toys.js`:
   `"five-cell" → { id: "four-d-shapes", options: { shape: "five-cell" } }`) and apply it where a
   toy id comes in: `normalizeToy` in `src/state.js` (links and saved JSON), `chooseToy` in
   `src/app.js`, and `src/viewer.js` (embeds and `<splashery-toy>`). Decide whether the new toy
   keeps the old public id (`hypercube`, `lorenz`) to avoid an alias, and say why. Add compatibility
   cases for every old id to the task 65 test file's corpus (links, saved scenes v2 and v3, and
   embeds).
4. **The shared lists:** move each old toy's entries in `src/toy-help.js`, `src/toy-sounds.js`,
   `tools/toy-plan.json`, `tools/sound-review.json`, `tools/toy-dates.json`, and the site toy pages
   (`SITE_TOY_IDS`) so nothing is lost: an old toy's page redirects to the new one with its option.
   Update the specs that build each old id (`tests/mt2.spec.mjs`, `tests/st3.spec.mjs`) so they
   check the same things through the picker. Never edit `tests/taps.spec.mjs`.
5. **Labs:** the four labs-only shapes and three labs-only attractors stay labs-only as picker
   choices until the owner says otherwise.

## Evidence

Phone-size clips of each picker choice next to the old toy on `main` (they must look and move the
same). A table of every old id with its link, saved-scene, and embed result.

## Rules

Only the Math pack, the shared lists for these toys, the alias map and its three call sites, and the
tests named above. American English and the serial comma. Before you push: `npx prettier --check .`
and `node tools/us-english.mjs --diff` are clean. The full suite runs on the Operator's merge PR. PR
body with Summary, Verification, Deviations, Known issues, and What was cut.
