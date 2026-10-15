# Lane Share: the Share tab, the tab order, and a preview after Record

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session). Repo:
`ryanjosephkamp/splashery`. Your lane: **Share** (prefix `shr`), on Opus 5.5 at high effort. Branch:
`claude/lane-share-engine`. Everything here is in the app's shell (`index.html`, `styles.css`,
`src/ui.js`), so it's one "Engine: …" PR: "Engine: the Share tab first, cleaner on a phone, with a
preview after Record". Handoff file: this one. Keep its "State" section current.

### Brief (written by the Operator on October 15, 2026, from the owner's walkthrough of the Share tab that day)

The owner's notes are private; this is the Operator's summary. Read `docs/handoff/UIr2.md`,
`UIr3.md`, `UIr4.md`, and `UIr5.md` first (the last UI rounds), then
`docs/codex/89-export-quality.md`. Codex is improving the exporters at the same time (see "Who owns
what"). The owner wants the main things people come for to be the easiest to reach, without losing
any setting.

1. **The tab order:** Toy, Share, Tools, Look, Make, and then the (i) tab, on phones and computers.
   The arrow keys follow the new order. Nothing else in Tools, Look, or Make moves.
2. **Clap to tap** (the "Live" section, with labs on) leaves the Toy tab. Put it at the bottom of
   the Tools tab. It still shows only with labs on and still asks for the microphone only when
   switched on.
3. **The Share tab, laid out for a phone first.** Today it's three groups of wrapped rows: the Save
   GIF button sits awkwardly under the GIF settings, and Record comes last. The new order:
   - **Record** first, as the tab's main button, with one line on what it does (you play, it
     records, with sound). When task 89 lands, its quality choice sits beside it.
   - **Save a clip:** Video and GIF in one block, with a switch between them. Each one's settings go
     in one tidy row (Effect loop or Turntable, length or frames, size), with one clear Save button
     under them. Then **Picture** (PNG).
   - **Link and scene file:** Copy link, QR code (labs), Save scene, and Open a scene. Rename "Save
     JSON" and "Load JSON" in plain words, with one line that says what a scene file is. It keeps
     the toy, its settings, the look, any paint, and the camera, and opening one picks up where you
     left off. A photo or file you opened yourself isn't inside it, so check `importJSONFile` and
     `applyScene` in `src/app.js` and say exactly that.
   - **Save PDF** (labs) and **Put it on a web page**, as today.
   - The computer panel uses the same order. Keep these element ids, because Codex fills their
     choices: `gif-kind`, `gif-frames`, `gif-size`, `webm-seconds`, `record-start`, and
     `import-json`.
4. **Watch the recording before saving it:**
   - When a take stops, a sheet opens with the recording in a video player (play, pause, and scrub).
     Then Save video, Share (where the device can share files), Record again, and Discard (which
     asks first).
   - It works at 390×844 and 1440×900, by keyboard, and with a screen reader.
   - Closing or Discard frees the recording's memory.
5. **"Record again from a point":** look into it, report, and don't build it. The toy's state at an
   earlier moment isn't kept, so a new take can only start from the toy as it is now. Write a short
   proposal in this file with the effort of each option, for the owner to choose:
   - trim the start and end of a take;
   - keep a take up to a point, then add a new take joined into one file.
6. **Tests** in `tests/shr.spec.mjs`:
   - the tab order and the arrow keys;
   - Clap to tap gone from the Toy tab and on Tools with labs on;
   - the Share tab's sections in order, and no control cut off, overlapping, or scrolling sideways
     at 390×844 and 1440×900;
   - the preview sheet after Stop, with a playable video of about the right length;
   - Discard frees the recording, and Save still saves.

   Where an existing test asserts the old layout on purpose (for example the Live pill's place in
   `live3-engine`, or the Record flow in `ui5-engine`), update it to the new layout and say why in
   the PR. Never loosen what it checks, and never edit `tests/taps.spec.mjs`.

7. **Show the owner:** screenshots of the Share tab before and after at 390×844 and 1440×900
   (`tests/screenshots/shr-*`), and a phone-size clip of Record → preview → Save. Post them as cards
   on the Effect review page 2 (lane "Share"), as in OPERATING.md, "Steps for a lane". This changes
   what the public sees, so it merges only after his "good".

### Who owns what

- **This lane owns** the tab row, the Share tab's markup and styles, the Record pill and the new
  preview sheet, the Share wiring in `src/ui.js`, where Clap to tap is placed (`src/live/panel.js`),
  `tests/shr*.spec.mjs`, and this file.
- **Codex task 89 owns** the exporters (`src/exports.js`, `src/export/`, and the export functions in
  `src/app.js`) and the choices inside the export controls. Don't change export defaults or limits
  here.
- **Codex task 90** (batch export, later) adds one labs-only button to the Share tab. Leave room for
  it at the bottom.
- **Merges:** Codex task 52 (#594, phone and keyboard accessibility) is in the Operator's merge PR
  #651 now. When main moves, merge it into your branch; never rebase. Whichever of this lane and
  task 89 merges second settles the overlap in the Share tab.

### Before you push

As CLAUDE.md says: the full Playwright run (or the specs you touch plus `smoke`, `ui*`, `live3*`,
and `cdx-a11y*` when the full run is too slow; say which), `node tools/us-english.mjs --diff`, and
`npx prettier --check .`. Open one draft PR against `main` with the five sections. Your final
message starts with "READY:", "WORKING:", or "BLOCKED:".

## State

- Model: Opus 5.5 (claude-opus-5-5), high effort. Branch `claude/lane-share-engine`.
- October 15, 2026: items 1 to 4 and 6 built, item 5 reported below, item 7's screenshots taken and
  the cards posted.
  1. **Tab order:** Toy, Share, Tools, Look, Make, then (i), on phones and computers (`index.html`,
     the tab buttons only). The arrow keys, Home and End follow the DOM order, so they follow the
     new order with no code change.
  2. **Clap to tap** (labs) is the last section of the Tools tab (`src/live/panel.js`
     `renderClapSetting`). Same switch, same note, same "only on a tap" microphone rule.
  3. **The Share tab** (`index.html`, `styles.css` "Share lane"): Record (the tab's main button,
     with its line, and a marked spot beside it for task 89's quality choice); Save a clip (a Video
     / GIF switch, each block with its settings in one row and one Save button under them, then
     Picture); Link and scene file (Copy link, QR code (labs), Save scene, Open a scene, and a line
     on what a scene file holds); PDF (labs); Put it on a web page; and a marked spot at the bottom
     for task 90. Every id stays (`gif-kind`, `gif-frames`, `gif-size`, `webm-seconds`,
     `record-start`, `import-json`, and the rest).
  4. **The preview sheet** (`#rec-preview`, a modal `<dialog>`; `src/ui.js` "the preview sheet after
     Record"): opens when a take stops, with the take in a video player and Save video, Share (where
     the device can share files), Record again, and Discard. Discard, Close, Escape, and Record
     again ask first while the take is unsaved. Every way out revokes the blob URL, empties the
     player, and calls `app.closeRecord()` (which drops the Blob).
  5. **Tests:** `tests/shr.spec.mjs` (8 tests). `smoke` and `cdx-playground-links` now tap the GIF
     switch before using the GIF settings (see "Notes").
- Cards on Effect review page 2, lane "Share": shr-record-preview (the phone clip of Record, the
  preview, and Save), shr-share-before-390, shr-share-390, shr-share-gif-390, shr-share-before-1440,
  shr-share-1440, shr-preview-1440, shr-preview-discard-390, and shr-clap-1440.
- Specs run here (all green): `shr`, `smoke`, `ui2`, `ui3`, `ui4-engine`, `ui4`, `ui5-engine`,
  `ui5`, `live3-engine`, `live3`, `cdx-playground-links`, `pdf-engine`, `qr4-2-engine` (127 passed),
  and the three Clap tests in `live`. `cdx-a11y*` isn't on `main` yet (task 52, #594).
- October 15, 2026, morning: the owner marked all nine `shr-*` cards good. The Operator's review on
  #653 found five gaps in the preview sheet, all fixed, each with a `shr` test that fails on the old
  code:
  1. A canceled share sheet no longer counts as saved. `app.shareRecord()` now returns true only
     when the video was shared (or saved instead), so Discard and Close still ask after a cancel.
  2. Focus goes back to `#record-start` (when it shows) after Close, Escape, Discard, or Save then
     Close; not after Record again, which starts a take.
  3. A phone on its side (844×390): a `max-height: 500px` rule shrinks the player to 36vh, so Save
     video, Record again, and Discard fit.
  4. With no WebM recording, Save a clip opens on GIF and the Video side of the switch is disabled.
  5. The player's `loadedmetadata` listener is kept and taken off in `releasePreview`, so a sheet
     closed early leaves nothing behind for the next take.
- Specs run after the fixes: `shr` (12 tests), `ui5-engine`, and `live3-engine` (23 passed).
- The owner doesn't want the Pause button for now; "Record again from a point" stays a proposal.
- October 15, 2026, 08:15 UTC: merged `main` (d33f9421, the Operator's #651 with task 52's
  accessibility fixes). One conflict, in `setRecord` (`src/ui.js`): task 52's focus-keeping for the
  pill stays, and a finished take hands focus to the preview sheet. Two fixes after the merge:
  - Task 52's global Escape handler calls `preventDefault()`, which stopped the preview's own
    `cancel` event (Escape to ask first). It now leaves Escape to an open `<dialog>` (`src/app.js`
    `bindKeys`).
  - Task 52 draws every select at 16px on phones (so iOS doesn't zoom), so the GIF row's longest
    choice no longer fit a third of the row at 390×844. On phones the clip's box drops its border
    and side padding, and the three settings still fit in one row.
- Specs after the merge (2 workers): `cdx-a11y`, `cdx-a11y-layout`, `shr`, `smoke`,
  `cdx-playground-links`, `ui5-engine`, and `live3-engine`. All pass except `cdx-a11y-layout`
  "recording and the flag dialog preserve keyboard focus", which fails under load (two workers on
  this 4-core machine) on `main` too (2 of 3 runs there): the cactus records too few frames on the
  software renderer, so the take comes out empty. It passes run alone, here and on `main`.
  `cdx-a11y` "keyboard focus can keep help open during its dismissal fade" failed once under load
  and passed on the next run.
- Next: the Operator's merge; Codex task 89 (#654) then fills `.record-main` and the clip settings
  rows.

## Record again from a point (item 5: a proposal, not built)

The toy's state at an earlier moment isn't kept (a take is only pixels and sound), so any new take
starts from the toy as it is now. Three options, smallest first. Times are for one Opus lane.

1. **Pause and resume during a take** (about half a day). A Pause button on the Record pill:
   `MediaRecorder.pause()` and `resume()` keep one file, so a person can stop, set the toy up again,
   and carry on in the same take. No re-encoding, works on every browser that records today. It
   doesn't go back in time, but it covers "I want to redo the next bit" when caught in time.
2. **Trim the start and end of a take** (about one and a half to two days, after task 89 lands). Two
   handles under the preview's player; the player plays only the kept part; Save writes the trimmed
   file. A recording can't be cut cleanly between its keyframes, so the kept part is decoded and
   encoded again: with WebCodecs and task 89's MP4 muxer where the browser has them (faster than
   real time), else by playing it into a canvas and recording that in real time (as long as the kept
   part, and a second encode loses a little sharpness). Memory: one more copy of the kept part while
   it encodes.
3. **Keep a take up to a point, then add a new take joined into one file** (option 2 plus about one
   more day). The trim's end handle marks the point; Record again records a second take at the same
   size; Save decodes both and encodes them into one file. The join shows a jump, because the toy is
   where it is now, not where it was at the point; a short crossfade (a few frames) can soften it.
   Same codec and size checks as option 2, and the second take shares the 1-minute (or task 89's
   new) limit.

The Operator's suggestion: option 1 now (small, no new code paths in the exporters), and option 2
once task 89's muxer is on `main`. Option 3 only if the owner still wants it after trying 1 and 2.

## Notes

- The ids Codex task 89 fills are unchanged, and its option lists aren't touched. The settings row
  sizes its columns by their share of the width (`.clip-settings`), with the longest choices of
  today's lists tested to fit at 390×844 and 1440×900; task 89's longer lists (and its video
  settings, which join `#webm-row`) wrap to a second row if they can't fit.
- The video and GIF blocks show one at a time, so a test that uses the GIF settings taps
  `#clip-kind [data-clip=gif]` first. `smoke` ("PNG, GIF and WebM exports produce files") and
  `cdx-playground-links` (the landscape settings test) do now; what they check is unchanged.
- The preview reads the take from `app.recorded` (a `{ blob, name, seconds }` set by
  `app.startRecord` before `setRecord({ state: "ready" })`). If task 89 hands the take over another
  way, `openPreview` in `src/ui.js` is the one place to change.
- A MediaRecorder WebM has no length in its header (Chrome shows an endless one), so the preview
  seeks far past the end once on load to make the browser read the real length; the scrub bar then
  works. MP4 takes don't need it.
- `ui.isTyping()` now counts any control inside an open `<dialog>` as typing, so keys pressed in the
  preview (or the QR and PDF dialogs) don't poke the toy, reset the view, or open the gallery.
- "Close" asks first too while the take is unsaved (the brief asked it of Discard); after Save or
  Share it closes at once. Saying it here in case the owner wants Close to discard without asking.
- Scene file wording, from `importJSONFile` and `applyScene` in `src/app.js`: a scene keeps the toy,
  its options, the look, the effects, any paint and clay, and the camera. A splat file, a photo, a
  PDF, or any other file someone opened isn't inside; only its name is, and the app asks for that
  file again (a toast) while the sample shows.

## Known issues

- The Share button on the preview shows only where `navigator.canShare({ files })` says yes (phones,
  mostly); the headless test browser can't share files, so the test checks Save only.
- Other places still say "Save JSON" or "Load JSON": `src/exports.js` (two link notes; task 89's
  file), `src/qr/share.js` (the QR dialog, labs), `manual/`, `site/share/`, and
  `site/learn/scene-format/` (and `tools/site-hubs.mjs`, which builds `site/share/`). Not this
  lane's files; listed under "For the Operator". The one in `src/app.js` (Copy link's toast) now
  says "Save the scene as a file instead."

## For the Operator

- Please relay to the owners of those files (or sweep them in an Ops PR) the rename "Save JSON" to
  "Save scene" and "Load JSON" to "Open a scene".
- Task 89 overlap: its `tests/cdx-export.spec.mjs` must tap `#clip-kind [data-clip=gif]` (or
  `video`) before using a block's settings; its new video settings go inside `#webm-row`, and its
  Record quality choice inside `#record-row`, beside `#record-start`.
- Page 2 has no `lanes/Share` record yet, so the cards show under the bare id "Share". Please add
  the record (title, note, order).
- Task 90: its labs-only button goes at the bottom of `#pane-share` (the comment marks the spot).
