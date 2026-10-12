# Handoff: Builders r1 (the pack for outside builders)

Lane `BuildersR1`, prefix `bld`. Branch `claude/lane-builders-r1`. PR title "Phase Builders r1: the
pack for outside builders". Model: Sonnet 5.5 (`claude-sonnet-5-5`), high effort.

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session,
session_01Mo8sLhAitbYjZiPgD8Hc4t). Repo: ryanjosephkamp/splashery. Your lane: Builders r1 (id
`BuildersR1`, prefix `bld`). Branch: `claude/lane-builders-r1` from main. PR title: "Phase Builders
r1: the pack for outside builders". Handoff file: docs/handoff/BuildersR1.md (create it; start it
with this brief, word for word, under "## Brief", then keep "## State

Model: Sonnet 5.5 (`claude-sonnet-5-5`), high effort. October 12, 2026. All ten items are written
and checked. Merged main (#547) into the branch.

1. `builders/README.md`: done (what Splashery is, who it is for, reading order, the one-line prompt,
   the hand-back rule, where work goes, how to make the ZIP).
2. `builders/REPO-MAP.md`: done. The folder lists were generated from the tree on October 12, 2026
   (99 pack files, the `src/` folders, `tools/` and `tests/` counts). A test checks that every
   top-level folder is named.
3. `builders/SETUP.md`: done. Tested in this container: clone-free steps (`npm ci`, the server,
   `tools/check-packs.mjs`, `tools/effect-clip.mjs`, `npx playwright test tests/unit.spec.mjs`,
   `tools/suite.mjs --files=unit`, `builders/screenshot.mjs`, prettier, us-english). Not tested: a
   Mac, `npx playwright install chromium`, the full suite (about 4.5 hours),
   `tools/contact-sheet.mjs`, `tools/make-thumbs.mjs` and the ffmpeg step. The file says so.
4. `builders/KIT-GUIDE.md`: done. The real recipe is `diamond` from `src/packs/gems.js` (copied
   unchanged); the "gift box" starter was built and run in Node with `buildRecipe`. The asset-backed
   section follows Real Objects. The baked-splat path is marked "coming with the engine PR".
5. `builders/TOY-PACKAGE.md`: done. The format, `tools/port-convert.mjs` and `tools/port-check.mjs`
   are marked "coming with the Baked engine PR".
6. `builders/WORKSHOP.md`: done, with the "Workshop foundation" spec.
7. `builders/HANDBACK.md`: done, with the record template.
8. `builders/TASKS.md`: done (T1 to T12, each with a paste-ready prompt).
9. `builders/CREDITS-GUIDE.md`: done (real examples from the repo: the rubber duck, the dog plush).
10. `tools/builders-pack.mjs`: done. Builds `builders-pack-<date>.zip` with `zip`, refuses a token.

Tests: `tests/bld.spec.mjs` (7 tests, no browser): every relative link in `builders/` resolves, all
ten documents and T1 to T12 exist, REPO-MAP names every top-level folder, no private page link, the
pack tool builds from the real repo and from a small checkout, refuses a planted token (and says
where, without printing it), and says what is missing.

Checks run before READY: `npx prettier --check .`, `node tools/us-english.mjs --diff` (after
`git fetch origin main`), `npx playwright test tests/bld.spec.mjs`.

## Notes

- `builders/screenshot.mjs` is a small helper I added (a toy's two standard screenshots at 390×844
  and 1440×900). It lives in `builders/` so it travels in the ZIP, and `SETUP.md` documents it.
- `tools/us-english.mjs --diff` compares against `origin/main`. In a fresh container the local
  `origin/main` can be old, and the check then lists lines the branch didn't add. SETUP.md says to
  `git fetch origin main` first.
- The ZIP lays files out as in the repo, so the relative links between its documents work. Links to
  files that are not in the ZIP (the manual's chapters, other docs) point at the repo; PACK-INFO.txt
  says so.
- No private notes, private page links or private repos are in `builders/`. A test guards the links.

## Known issues

- `builders/REPO-MAP.md`'s file lists will drift as lanes add packs and tools. The test only guards
  the top-level folders. The Operator can regenerate the pack list (it is the file names in
  `src/packs/`) when it matters.
- The Workshop doesn't exist yet. The docs describe it and T11 builds it.
- The Baked engine's format and tools aren't in yet; three documents mark those parts "coming with
  the Baked engine PR".

## For the Operator

- READY once the PR is up. Merge after your checks; it is docs, one build tool and one spec.
- When the Baked engine PR lands, update `TOY-PACKAGE.md` ("assets/" section), `KIT-GUIDE.md`
  ("Baked splats: coming with the engine PR"), `HANDBACK.md` (the checker's output is proof 1) and
  the T3 prompt in `TASKS.md`.
- A suggestion for Rules v1 (not changed here): none.
- `docs/WORKSTREAMS.md` could get a row for this lane. README.md's layout could name `builders/`.
