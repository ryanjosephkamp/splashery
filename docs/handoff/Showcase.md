# Lane Showcase: a reel of what splats and recipes can do (prefix `shw`)

## Brief

You are a Splashery worker session, started by the Operator (the coordinating session) for the
October push. Repo: ryanjosephkamp/splashery. Your lane: Showcase (id `Showcase`, prefix `shw`).
Branch: `claude/lane-showcase` (and `claude/lane-showcase-engine` for any change to the app outside
your own files, as an "Engine: …" PR merged first). PR title: "Phase Showcase: a reel of what splats
and recipes can do". Handoff file: docs/handoff/Showcase.md (create it; start it with this brief,
word for word, under "## Brief", then keep "## State", "## Notes", "## Known issues" and "## For the
Operator" current). Model: Opus 5.5, at the default effort.

### Brief (written by the Operator on October 6, 2026, from the owner's Push Plan notes)

The owner, in his push notes (docs/reviews/2026-10-04-push-alignment/notes.md, around line 240): he
wants "a video or a showcase that's real", which "plays through the animations or the special
effects of the toys", maybe per category, so it is "really clear why Splashery is special": what
Gaussian splats let people do and configure, what the recipe approach enables, and what this site
does that people wouldn't expect, so nobody mistakes it for "a lower-quality simulation".

1. **A live reel.** A labs page (for example `showcase.html` with `src/showcase/`) that plays real
   toys live, one after another, through the existing embed or player (no prerecorded video in the
   page): each scene loads a toy, runs its best effect (a tap, a hands-on toss, a tool doing its
   job), and shows a short caption saying what is happening and why it matters. Chapters per
   category (for example: things that come apart into real pieces; instruments that are played; real
   data and real captures; your own photo, video or PDF turned 3D on the device; science you can
   check; recipes: tiny, editable, any size). Pause, skip, a chapter list, and "Open this toy" on
   every scene. It works on a phone first and stays light (lazy-load each scene; keep the "embed
   transfer ≤ 30 MB" test green).
2. **Only the best.** Pick scenes only from toys whose current cards the owner marked good on the
   Effect review pages (ask the Operator for a list of good marks if you can't read them), and list
   your picks with their card ids in the handoff. A playlist file (`tools/showcase.json` or similar)
   holds the scenes and captions so the Operator can change them without code.
3. **True words.** Plain American English; every claim must be true of this site today (for example
   "nothing you open leaves your device", "this toy is about 40 KB of recipe"), with numbers you
   measured. No superlatives about other products, no brand names, and don't name any internal
   research project; call it "the recipe approach" or similar.
4. **A video for the owner.** A tool (`tools/shw-video.mjs`) that records the reel at 390×844 and
   1440×900 to a video file for him to share; the video itself stays out of the repo unless it is
   small.

The page is labs: it is not linked from the homepage (that is the owner's call); the labs switch may
show a link. Tests in `tests/shw*.spec.mjs` (the playlist loads, every scene's toy exists and opens,
captions fit at phone size). Post clips of the reel at phone size on Effect review page 2.

You own: `showcase.html` (or the page you choose), `src/showcase/`, `tools/shw-*.mjs`, the playlist
file, `tests/shw*.spec.mjs`, and your handoff file. Don't edit toys' packs; if a scene needs a hook
(for example a way to trigger an effect from the embed), make it a small additive "Engine: …" PR.

How this lane runs: exactly as docs/handoff/ScienceR3.md, "How this lane runs", says (read it;
replace the prefix and lane record with yours). Labs: the Operator merges after a full test run (the
Integrators run it); the owner decides when anything goes public. Finish every working turn with
"READY:", "WORKING:" or "BLOCKED:"; Splashery has no CI to wait for; for a long job, schedule a
check-in with send_later instead of going idle. Clips at phone size go on Effect review page 2
(https://claude.ai/artifact/BSayVkzQ2FKESesrkrSUMK) as docs/OPERATING.md, "Steps for a lane", says
(no republish). Before READY, re-read CLAUDE.md's "Effect quality rules" and check each clip against
them at phone size. The push ends Wednesday, October 7, 2026, 4 p.m. ET (20:00 UTC): aim for a first
READY within about six hours, then polish rounds on the owner's marks.

## State

WORKING (October 6, 2026): picks made from the owner's good marks; building the page.

## Notes

## Known issues

## For the Operator
