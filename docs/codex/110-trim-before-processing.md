# Codex task 110: trim a video before the Studio processes it (up to 8 hours)

**Branch:** `codex/trim-before-processing`, cut from `main`. One draft PR against `main`. Read
`AGENTS.md`, `builders/RULES.md`, the Studio tools Moving photo to 3D (`src/packs/moving-photo.js`)
and Video to 3D (`src/packs/video3d.js`, `src/video3d/`), and the recorder's preview sheet (the
Share tab's take preview with Save and Discard, in `src/ui.js`).

## Why

When someone opens a long video in Moving photo to 3D or Video to 3D, the whole clip is processed,
even if they only want ten seconds of it. They have to trim it in another app first, or wait. The
owner wants a trim step **before** processing starts.

## The work

1. **A trim sheet.** It opens right after a video is picked, in the same style as the recorder's
   preview sheet:
   - the video, playing;
   - a timeline with start and end handles, with keyboard and touch steps;
   - the selected length;
   - an estimate of the processing time for the selection, from each tool's own estimate;
   - "Use this part", "Use the whole video", and "Cancel".
2. **Only the chosen part is processed.** Both tools seek to the start and stop at the end. Video to
   3D samples frames only inside the range. Moving photo builds its depth cache only for the range.
   Nothing outside the range is decoded more than seeking needs.
3. **Remembered for that file in this session,** so "Change the part" reopens the sheet without
   picking the file again.
4. **Phone first:** usable one-handed at 390×844, with large handles and no hidden gestures.
5. **The built-in samples** skip the sheet, or show it with the whole clip chosen. Old `#s=` links
   and saved scenes load as before.

## Gates

- A 3-minute test video trimmed to 10 seconds: processing time drops in proportion (within 20% of
  10/180 of the full time, plus fixed setup). Measured in CI for both tools.
- The processed result matches processing a pre-cut 10-second file of the same range (Video to 3D
  through its own quality checks; Moving photo with a frame-for-frame depth match).
- Nothing starts processing before the person confirms. Cancel leaves the toy as it was.
- Accessibility: the handles have labels and keyboard steps. The sheet traps focus and closes on
  Escape.
- Every existing spec passes. The Moving photo and Video to 3D specs are unchanged or extended,
  never loosened.

## Rules

The shared sheet may be a new module, `src/trim-sheet.js`. Hook it into the two tools with small
changes, and name every changed shared file in the PR. American English and the serial comma. Last,
merge `main` and run `node tools/preflight.mjs`. PR body: Summary, Verification, Deviations, Known
issues, and What was cut.
