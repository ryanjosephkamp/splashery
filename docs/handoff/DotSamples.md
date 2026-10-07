# Lane Dot samples: AI-made Studio samples from the owner's pictures (prefix `dsm`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Dot samples (id `DotSamples`, prefix
`dsm`). Branch: `claude/lane-dot-samples` (and `claude/lane-dot-samples-engine` for any change to
the app outside your own files, as an "Engine: …" PR merged first). PR title: "Phase Dot samples:
AI-made Studio samples from the owner's pictures". Handoff file: docs/handoff/DotSamples.md (create
it; start it with this brief, word for word, under "## Brief", then keep "## State", "## Notes", "##
Known issues" and "## For the Operator" current). Model: Sonnet 5.5, at the default effort.

### Brief (written by the Operator on October 7, 2026)

Ryan made 40 pictures with his own AI image plan, from the "Dot" prompt pack (prompts D01 to D40).
They are uploaded to the asset store of the private Sample Drop page:
https://claude.ai/artifact/HciHVeJBj99dkznDYnaJvE. List them with the Artifact tool
(`action: "list"`, `scope: "assets"`, that url), and download each with `action: "read"`, the url
and `path` = the asset id. Read docs/handoff/StudioMedia.md first: it shows how Studio samples
(Photo to 3D, Moving photo to 3D) are stored and shown.

The rules (CLAUDE.md, "AI-made samples", the owner's calls of October 5, 2026):

- These pictures may ship only as Studio samples, labeled as AI-made beside them, and never
  presented as real captures or real places.
- No people, no logos or brand names, and no text in the picture.
- Never use them for science, math or engineering toys, the photoreal shelves, or landmarks shown as
  real.
- Record each one in CREDITS.md and tools/assets.json as made by the owner with an AI image tool.

Do this:

1. Screen all 40 against those rules, and note each one you reject and why: a face, readable text, a
   logo, a real landmark.
2. Pick the ones that make strong Photo to 3D samples: a clear subject, good depth, a clean
   background. Compress them sensibly (WebP, a size like the current samples).
3. Add them to the Studio samples with the "AI-made by the owner" label, in the sample picker,
   grouped sensibly.
4. Post a card per sample on Effect review page 2, showing the picture and its 3D result at phone
   size (ids dsm-<prompt id>).

Never commit a rejected picture. Don't change how Photo to 3D works. You own: the Studio sample list
and its data (as StudioMedia.md describes), the new sample files, their CREDITS.md and
tools/assets.json entries, tests/dsm\*.spec.mjs, and your handoff file.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Labs: the Operator merges after a full test run (the
Integrators run it); the owner decides when anything goes public. Finish every working turn with
"READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for; for a long job, schedule a
check-in with send_later instead of going idle. Clips at phone size go on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
(no republish). Before READY, re-read CLAUDE.md's "Effect quality rules" and check each clip against
them at phone size. The push ends Wednesday, October 7, 2026, 4 p.m. ET (20:00 UTC): aim for a first
READY within about four to six hours, then polish rounds on the owner's marks. A fresh Operator
session takes over from the current one on October 7; keep reporting the same way (READY, WORKING or
BLOCKED in your final message).

## State

READY (October 7, 2026). Model: Sonnet 5.5. PR #378.

- Screened all 40: none breaks a rule (see Notes). 30 picked and shipped as Photo to 3D samples; 10
  left out for weak depth (not for the rules) and never committed.
- Files: `assets/toys/photo-3d/ai/<id>.webp` (1,280 px wide, WebP q80, about 200 KB) and
  `<id>.depth` (made by `tools/dsm-depth.mjs`, 354 KB each).
- Code: `src/packs/dot-samples.js` (the list, in my own file) joined to Photo to 3D as
  `ALL_SAMPLES`; `SAMPLES` (the CC0 six) is untouched, so no other test changes. The picker groups
  them under "AI-made by the owner: …" (four groups) and each label ends "(AI-made)"; the in-app
  credit says "AI-made by the owner". `loadSample()` reads `dir`/`file`/`ext` for them; Photo to 3D
  works as before.
- Records: CREDITS.md section "AI-made Studio samples", `tools/assets.json` `photoSamples`
  (`"ai": true`, `"prompt"`).
- Tests: `tests/dsm-samples.spec.mjs` (5 pass).
- Clips: 30 phone-size clips (320 px, MP4) are on Effect review page 2 as `dsm-D01` … `dsm-D40`
  (lane `DotSamples`, four groups). Each starts on the flat picture; the tap raises the depth and
  the view sways. I watched all 30 as 8-frame strips: near parts move over far ones as solid layers,
  no tearing or speckle.
- Screenshots: `tests/screenshots/dsm-ai-samples-390x844.png` and `…-1440x900.png` (no standard
  screenshot changed, so nothing to restore).
- Ran: `dsm-samples` (5), `smd-photo` (4), `help` (all) pass; `node tools/check-packs.mjs photo-3d`
  ok. The full suite is the Integrators'.

## Notes

- Screening (40 pictures, at full size for the ones with possible text): no faces or people, no
  readable text (the library's book spines are blank, the clocks have no numerals, the map and globe
  show only coastlines), no logos or brand names (the harbor's boats and the bakery's cloth have
  none). D13 (a canyon at sunset), D17 (a sandstone arch) and D04 (a castle) resemble real kinds of
  places, but none is a real landmark; they are labeled AI-made and named generically ("Canyon at
  sunset", "Stone arch"). Rejected: none.
- The assets carry no prompt names, only upload order. The 41 uploads held one duplicate (the sixth
  picture twice), so I took the 40 unique ones in upload order as D01 to D40. If the owner's
  numbering differs, the `prompt` field in `src/packs/dot-samples.js` (and the CREDITS.md and
  assets.json lines) are the only places to fix.
- Left out (weak for Photo to 3D: flat, top-down or too close to a sample already there): D09, D12,
  D15 (a spiral staircase, like the CC0 one), D18, D23, D24, D25, D33, D35, D39.
- WebP, not JPEG: the browser decodes it; Node (the tools and old tests) can't, so the AI samples
  are in `ALL_SAMPLES` and the old `SAMPLES` stays JPEG-only.
- Samples load only when picked; nothing joins the opening download.
- Never used for science, math or engineering toys, the photoreal shelves or real landmarks.

## Known issues

- The container restarted twice while the clips rendered (background jobs die with it), so a render
  can need a re-run in the foreground (`tools/effect-clip.mjs`, `--opt=source=dot-<id>`).

- Depth is from Depth Anything V2 Small, so thin things (the dragonfly's wings, chair rungs) can
  show a soft edge when turned.

## For the Operator

- Please confirm D01 to D40 numbering (see Notes) if the owner wants the ids to match his prompt
  pack exactly.
