# Triage of the October 15 walkthrough and playtest round 2

The owner walked through the live site on his phone on October 15, 2026 (about 6:45 p.m. ET, main
`d4df5998`), and two outside playtest bots tested it the same afternoon. His notes stay private.
This is the Operator's summary, in its own words, with each item checked against `main` and the open
PRs, and where it goes.

## Fix before the release

| Item                                                                                                                                                                                         | Cause                                                                                           | Where it goes                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| The toy shelf's grid collapses (phone grid and the desktop gallery): thumbnails overlap, names hidden                                                                                        | `body.app button { min-height: 44px }` from Codex task 52 (#651) holds every grid row at 44 px  | Codex 91                                                       |
| ▶ Play overlaps the zoom "−" button; small-screen layouts overlap at 320×568, 844×390, and 390×844 expanded                                                                                  | the same change, and fixed offsets                                                              | Codex 91                                                       |
| Searching for a labs-only toy in normal mode shows an empty shelf with no message                                                                                                            | hidden labs cards count as results                                                              | Codex 91                                                       |
| Moving photo to 3D, Sharp view: switching to a sample whose sound is an MP3 keeps the previous clip's picture                                                                                | `fillClip` in `src/packs/photo-sharp.js` treats an audio-only element as a video; long-standing | Codex 92 (the fix is already in #560, which is held for speed) |
| The manual PDF's contents: page numbers not on one right edge                                                                                                                                | the print CSS in `tools/manual-pdf.mjs` (task 73)                                               | Codex 96, then a new edition                                   |
| Small rough edges: a broken file's raw error, a stale status message, the Seed field, Save PDF feedback, the QR "Show as splats" message, Auto detail on very slow renderers, keyboard order | each checked in code                                                                            | Codex 96                                                       |

The manual PDF's internal links are present and correct (108 contents links, bookmarks, and named
destinations); they work in some phone viewers and not in Chrome's or Drive's, so that is the
viewer's.

## The owner's new asks

- **The shelf order and a Featured shelf:** search, Surprise me, All, Featured (his curated list),
  then the strongest shelves (Studio, Pictures and pages, AI and computing, Science, Space, Math,
  and so on) and the rest toward the end; no shelf removed. A fresh visit opens a random Featured
  toy instead of the cactus; links, saved scenes, and embeds are unchanged (Codex 91).
- **One toy for the 4D shapes and one for the strange attractors,** each with a picker like the knot
  toy, with an alias map so every old link and saved scene still opens (Codex 97, after #197).
- **Long Goal runs** for Photo to 3D (from task 87's failure atlas, measured against the
  checkpoint), Moving photo to 3D (land round 3 at full phone speed), Video to 3D (task 88's open
  gates), and Your book and the Picture lab (then the Photo album) (Codex 92 to 95).
- **The QR damage lab a little sharper,** and the chess set later, in the Shop.
- **The Studio's how-it's-made notes** (the toy checkpoint docs in `docs/studio/`) folded into the
  manual as a companion part; after the release unless there is time.

## Checked and not bugs (or not ours)

The sticky labs switch is by design (`?labs=0` turns it off); "Clap to tap" shows only with labs on;
the splat count shown is the file's own; "No available adapters" is Chrome's WebGPU probe; slow
frames, heap growth, and drags that orbit instead of painting were software rendering in the bots'
browsers. Unbounded paint and clay history is real in code but small in practice, and task 85 (#667)
measures it. Spontaneous reloads in labs mode could not be reproduced; the next playtest round on a
real graphics card should log crashes.

## For the owner

- Which labs toys go public at the release: the Featured list has 62 toys, 23 of them public today.
- Whether a shared link may load a picture from a web address without asking the person opening it
  (the scene format allows it today): folded into a later task on shared links, as he asked.
