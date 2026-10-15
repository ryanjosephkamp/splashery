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

Not started.
