# Codex task 09: Splashery and SuperSplat, compared

**Branch:** `codex/supersplat-compare`, cut from `main`. **Output, and nothing else:**
`docs/audits/supersplat-compare-2026-10.md` and its images and data in
`docs/audits/supersplat-compare-2026-10/`.

The owner asked how Splashery differs from SuperSplat (the PlayCanvas editor, viewer and gallery at
superspl.at) and where each is better, in a report he can audit. Every claim needs evidence: a link
you opened for SuperSplat and PlayCanvas, and a `file:line` in this repo for Splashery. Mark
anything you couldn't confirm as unconfirmed.

## Steps

1. **What each one does.** A table with a row per capability and columns for Splashery and
   SuperSplat, each cell with its evidence. Cover at least:
   - viewing on a phone and a desktop;
   - editing (select, delete, crop, color);
   - formats in and out;
   - animation (SuperSplat's timeline moves the camera; Splashery's taps move parts);
   - interactivity, sound, physics and live input (microphone, camera, screen);
   - documents (PDFs as books, photo albums, GIFs, video to 3D);
   - content made in the page (math, science data, chemistry);
   - embeds (how, and how big);
   - sharing (Splashery's `#s=` links hold the scene; SuperSplat hosts files);
   - where files go (Splashery keeps them on the device);
   - accounts, per-scene licenses, streaming of big scenes, XR, and working offline.
2. **Side by side.** Pick five SuperSplat objects of kinds we also have, such as a fruit, an insect,
   a vehicle, a statue and a toy. Choose only scenes licensed CC BY, CC BY-SA, CC BY-NC or CC
   BY-NC-SA, and credit each. Compare each with our nearest toy:
   - splat count and download size;
   - time to the first frame, and median and 95th-percentile frame time, in the Mac's Chrome on both
     sites;
   - a screenshot of each at 390×844 and 1440×900 with similar framing.

   Our side's numbers can come from `docs/audits/perf-2026-10.md`.

3. **Where each is better**, with the evidence, and where it's unclear.
4. **The owner's evidence.** If the owner gives you captures, recordings or notes, put them in
   `docs/audits/supersplat-compare-2026-10/owner/` and use them, saying which claims rest on them.
5. **Ideas.** What Splashery could take from SuperSplat (for example streamed levels of detail,
   spherical-harmonic shine, cleanup tools), and what Splashery does that SuperSplat doesn't.

Start the report with a summary of at most ten lines. Run
`npx prettier --check docs/audits/supersplat-compare-2026-10.md` and
`node tools/us-english.mjs --diff` before you push. Open one draft pull request, "Splashery and
SuperSplat, compared (Codex)", with the five sections AGENTS.md names.
