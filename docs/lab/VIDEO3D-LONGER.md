# Video to 3D: longer clips

Lane Studio media (prefix `smd`), Sonnet 5.5, October 5, 2026. This is a plan, not a build: nothing
here is trained. The two samples in the toy (`liberty`, `edinburgh`) are 14 and 10 seconds. The
owner wants to see what the tool can do on more of a video: a full orbit of a statue or a building,
or a long walk.

## What the two sources are

Read on Wikimedia Commons on October 5, 2026 (both CC BY 3.0):

| Source                                            | Author        | Length             | Size      | The sample             |
| ------------------------------------------------- | ------------- | ------------------ | --------- | ---------------------- |
| "Statue Of Liberty 4k Drone"                      | the Dronalist | 228 s (3 min 48 s) | 3840×2160 | 14 s from 3:24 (204 s) |
| "Walking in EDINBURGH - Scotland (UK) - 4K 60fps" | POPtravel     | 4,020 s (67 min)   | 1920×1080 | 10 s from 7:32 (452 s) |

**Does the drone fly all the way around the statue?** No. It flies several partial arcs, not one
circle. Judged from 30 frames, one every 7.6 seconds (so the times are rough, to the nearest few
seconds, and worth a closer look before anyone trains on them):

- 0:08 to 0:46: at the statue's height and some way out, the drone swings from the front of the
  statue round to its back (about a half orbit, in sunset light, with water behind).
- 0:53 to 1:46: it looks down on the crown and the torch arm from above and circles the head, the
  pedestal's star-shaped fort in view (the nearest to a full circle, about three quarters).
- 1:54 to 2:30: close passes by the face, the torch and the hand, with the city behind.
- 2:36 to 3:48: a pull back and a slow rise to a wide view of the statue and the island. The sample
  (3:24 to 3:38) is this part: the drone backing away from the face, so the camera moves along its
  line of sight more than around the statue. That suits Splat.js less than an orbit does, which is
  part of why the statue is soft behind the head.

**Which spans would make a fuller orbit?** 0:53 to 1:46 (53 seconds) for the most of a circle, and
0:08 to 0:46 (38 seconds) for the cleanest one at a steady distance. Either, trained as one stretch,
would give a statue you can walk around, not only a view that moves away.

**Which would make a longer walk?** The Edinburgh video is over an hour long, so any stretch will
do: pick one of 30 to 40 seconds with few people crossing the shot (people turn into ghosts, see
docs/lab/VIDEO3D.md) and a camera that keeps moving forward, for example along the Royal Mile's
quieter side streets. A walk is a harder scene than an orbit: the cameras move along a line, so each
part of the street is seen from a narrow range of angles, and the scene is only good near the path.

## Candidates

Every one is under a license the site allows (CLAUDE.md, "Ground rules"). Lengths and licenses are
from each file's Commons page on October 5, 2026. A BY-SA source gives a BY-SA scene, with its
notice beside it; the owner allowed CC BY-SA per asset on October 2, 2026.

| Candidate                                                              | Length       | License       | What it is                                                                                                                                | Why                                                                                                                     |
| ---------------------------------------------------------------------- | ------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| "Schloss Babelsberg Rundflug Full HD" (Superbass and Raimond Spekking) | 172 s        | CC BY-SA 4.0  | A drone flies once all the way round a castle in a park, with its towers and lawns in view (I looked at 28 frames across the whole file). | The best one found: a full orbit at steady distance and height, with a lot of texture. A real "walk around a building". |
| "Jagdschloss Grunewald Full HD" (same authors)                         | 205 s        | CC BY-SA 4.0  | The same kind of flight round a hunting lodge.                                                                                            | A second orbit, to compare. Not viewed yet.                                                                             |
| "Zipser Burg" (Hendric Stattmann)                                      | 101 s        | CC BY-SA 4.0  | A drone flight at a castle ruin, 4K.                                                                                                      | A ruin has plenty of texture. Not viewed yet.                                                                           |
| "Aerial Views of Goddard - Visitor Center" (NASA, SVS 14435)           | 393 s        | Public domain | Drone views of a building.                                                                                                                | Public domain, no notice. The exact title and the flight path were not checked.                                         |
| "Statue Of Liberty 4k Drone", 0:53 to 1:46 or 0:08 to 0:46             | 53 s or 38 s | CC BY 3.0     | See above.                                                                                                                                | Already credited and wanted by the owner.                                                                               |
| "Walking in EDINBURGH", a stretch with few people                      | 30 to 40 s   | CC BY 3.0     | See above.                                                                                                                                | Already credited. A longer walk.                                                                                        |

The two Blender open movies in the Moving photo toy (CC BY) are computer graphics, not captures, so
they aren't candidates here.

## What training them takes

The toy's tiers (`src/video3d/frames.js`) and the toy's own guess (`estimateMinutes` in
`src/video3d/run.js`, seconds a step on a graphics card):

| Setting        | Frames at most | Steps  | Splats at most | Guess on a graphics card |
| -------------- | -------------- | ------ | -------------- | ------------------------ |
| Standard (mid) | 32             | 3,000  | 120,000        | 3 to 10 minutes          |
| High           | 60             | 7,000  | 250,000        | 9 to 27 minutes          |
| Highest (max)  | 90             | 12,000 | 350,000        | 22 to 66 minutes         |

A full orbit of 172 seconds at 90 frames is one frame about every 1.9 seconds, plenty for a slow,
steady orbit. A 53-second stretch of the statue at 60 frames is one every 0.9 seconds.

**Not here.** The two samples took 431 and 517 minutes for 14 and 10 seconds at 3,000 steps in
headless Chromium on SwiftShader (WebGPU in software), about a hundred times slower than a graphics
card. A 172-second orbit at 12,000 steps would take days. Don't train a long clip in the sandbox.

**On a real GPU (an estimate, none of it measured).** The owner's M3 Pro in Chrome should land
between the "mid" and "high" rows: about 10 to 25 minutes for 60 frames at 7,000 steps, and 25 to 60
minutes at Highest. A desktop card is several times faster. The size of the result: the samples'
120,000 splats are 7.9 MB as a PLY; 350,000 would be about 23 MB. They load only when picked, so the
opening download doesn't grow, but 23 MB is a lot for a phone, so a longer scene should ship at
about 200,000 splats.

**Who should run it.** The owner's M3 Pro, running the toy itself in Chrome (the same code the page
runs, so the numbers carry over), is the better choice. A desktop GPU is faster but a person would
have to find one. The Operator should ask him for this, in steps:

1. Open Splashery on the Mac in Chrome (WebGPU on), plugged in, and turn on the labs switch.
2. Download "Schloss Babelsberg Rundflug Full HD" from its Commons page (the 480p transcode is
   enough for the toy; the full file works too).
3. In Video to 3D, open it, set Start 0, Length 40 seconds, Frames a second 2 and Setting High, and
   let it run. A 40-second stretch is a quarter of an orbit. Write down the minutes the card reports
   and whether the result looks good turned.
4. If that took under 25 minutes and looks good, run the whole flight at Highest (about 90 frames,
   at 1 frame a second), which needs a longer Length choice than the 40 seconds the list offers
   today (see below); or run it as four 40-second stretches (Start 0, 40, 80, 120) and save each.
5. Send the PLY files and the minutes. A worker then makes them samples (`tools/v3d-sample.mjs` on a
   real GPU is the same pipeline), ships the matching 480p stretch for Show the original
   (`tools/smd-source.mjs`), and credits them.

The Length list in the Toy tab stops at 40 seconds today; a full orbit in one run needs a 60 or a
180 second choice there (a small change in `src/packs/video3d.js`, not made here).
