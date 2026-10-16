# Codex task 90: Batch export (many inputs, many toys, one click)

**Start after task 89 has merged.** This task uses its stepped video encoder and its table of
choices (`src/export/presets.js`).

**Branch:** `codex/batch-export`, cut from `main`. One draft PR against `main`. Sample outputs and
clips over 1 MB go on `codex/batch-export-clips`, never merged. Read `AGENTS.md`,
`builders/RULES.md`, CLAUDE.md, `docs/codex/89-export-quality.md`, and the Photo to 3D checkpoint
(`docs/studio/photo-3d-checkpoint.md`) first.

## Why

The owner wants to judge the 2D-to-3D toys by their output, not one by one. Today, checking 50
photos in Photo to 3D means 50 rounds of opening a file, setting the same options, and saving a
clip. The batch export does it in one click. The same tool serves the studies in tasks 87 and 88,
and checks across toys (one effect loop per toy). The owner's notes are private; this is the
Operator's summary.

**It runs in the person's own browser, one item at a time.** GitHub Pages only serves the static
files, which the browser caches after the first item. The photos never leave the device, and a batch
can't slow the site for anyone else. Running items in parallel would compete for the one graphics
chip and run out of memory, so it never does.

## The work

1. **Where it lives:** a Batch export panel that shows only with the labs switch (`?labs=1`), not
   linked from the public site. Put it where a person can find it with labs on (for example a "Batch
   export" button at the bottom of the Share tab that opens its own sheet). It must not move or
   restyle the Share tab's other controls, because the Claude lane "Share" owns that layout.
2. **Choose the inputs:**
   - **Many inputs, one toy:** pick Photo to 3D, Moving photo to 3D, or Video to 3D, then add many
     files at once (a multi-file picker and drag and drop). The list shows each file's name and
     size, and items can be removed. The toy's shipped samples can be added with one tap.
   - **Many toys:** pick toys from a searchable list, or a whole shelf at once. Each one exports its
     own effect loop.
3. **Choose the presets:**
   - Every toy starts from its defaults. The owner's default for the 2D-to-3D toys is full depth.
   - Each toy's option choices (for example Photo to 3D's view and depth) can be set once for the
     whole batch, or changed per toy.
   - **All presets:** one switch expands an input into every preset choice the toy offers people.
     Before starting, show the item count and an estimated total time.
   - Output: Video (MP4 where the browser can, else WebM; the default), GIF, or PNG. Size defaults
     to 1080 px with Match the picture on, length to 8 seconds, at 30 fps, as an Effect loop. Sound
     is off by default, with a choice to keep the toy's sound.
   - The last settings are remembered on the device in `localStorage`, with a Reset to defaults.
4. **One button runs it all:**
   - Items run one after another in this tab. Each loads its toy fresh, waits until it's really
     ready (depth computed, first frame drawn), renders the effect loop on the stepped clock, and
     saves its own file.
   - Never join clips together.
   - Name each file `<toy>-<input>-<preset>-<size>.<ext>`, with the input's own name (made safe for
     a file name).
   - **Saving:** in browsers with the File System Access API (Chrome and Edge on a computer), ask
     for a folder once and write every file there. Elsewhere, download each file in turn, and tell
     the person beforehand that the browser may ask once to allow several downloads.
   - Pause, Resume, and Cancel. A failed item is skipped with its reason, and the rest go on.
   - Release each item's memory before the next one starts (toy disposed, object URLs revoked, depth
     buffers freed). Show in a test that 10 items in a row don't grow memory beyond one item's peak,
     plus a small margin you measure and state.
5. **A record of the run:** save a `batch-<date>-<time>.json` (or `.csv`) beside the files. It lists
   each item's toy, input name and size, preset, output settings, file name and size, how long the
   depth, render, and encode took, the outcome, the build commit, the browser, and the graphics
   backend. Tasks 87 and 88 can then compare runs.
6. **Nothing on top of the toy:** the files contain only the 3D view. No depth slider, no on-page
   controls, no progress text. Reuse task 89's test approach to check this for a batch of three
   photos.
7. **The same runner from the command line:** `tools/batch-export.mjs` (Playwright, on demand) reads
   a job file and drives the same in-page runner. The job file lists the toy, the input files, the
   presets, and the output settings. It writes the files and the record to a folder.
   `BATCH_REAL_GPU=1` skips the software-renderer settings, so the owner's Mac can run it with a
   real graphics chip. Document it in `docs/studio/batch-export.md` with two worked examples:
   - 50 photos in Photo to 3D at full depth, 8-second 1080p clips, no sound;
   - one effect loop each for ten toys from different shelves.
8. **Tests:** a new `tests/cdx-batch.spec.mjs` runs a batch of three shipped sample photos and one
   of two toys. It checks the file count, names, types, lengths, sizes, that no frame shows an
   overlay, the record's fields, Cancel partway, a failed item that is skipped, and the memory check
   in item 4. Keep it under 3 minutes on the software renderer. Use the shipped samples only; never
   commit the owner's own photos.

## Rules

Behind the labs switch, so the Operator merges it after its tests pass and the owner has tried it.
No server, no network calls beyond the site's own static files, nothing uploaded or stored except
the remembered settings. Files are saved only where the person chooses. Images in the repository at
most 1 MB each. American English and the serial comma. Before you push, `npx prettier --check .`,
`node tools/us-english.mjs --diff`, and your new spec are clean. The test suite on GitHub Actions
runs the quick checks on your PR. The full suite runs on the Operator's merge PR (or on yours when
the Operator adds the `full-suite` label), and any failure not marked "(known on main)" is yours to
fix. PR body with Summary, Verification, Deviations, Known issues, and What was cut.
