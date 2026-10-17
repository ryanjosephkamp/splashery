# Triage of the October 17 walkthrough

The owner walked through the Playground on October 17, 2026 (mostly on his phone, some on desktop,
main `937792f9`). His notes stay private. This is the Operator's summary, in its own words, with
each item checked against `main` and the open PRs where it could be, and where it goes. His verdict:
the release isn't close yet; task 98 stays held until these land.

## Broken now

| Item                                                                                                                | Cause (checked)                                                                                                                                                                                                                                                     | Where it goes               |
| ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Recordings save as a black video on desktop and on the phone; the sound and the length are right                    | Since #707 the recorder copies the stage's canvas on PlayCanvas `postrender`, before the frame is submitted; real browsers pick WebGPU, where that is too early. The specs forced WebGL on SwiftShader. The stage's own capture copies at `frameend`, after a draw. | Lane REC1 r2, a hotfix, now |
| Embeds: the `<splashery-toy>` element shows nothing; in both embeds a tap shows no effect and there is no sound     | not yet traced                                                                                                                                                                                                                                                      | Lane EXP1                   |
| The Splats slider at 400k leaves most toys far below it (Sound in a box shows 31k)                                  | `splatBudget()` in `src/player.js` multiplies the slider by each recipe's `density`, and a captured toy can't go past its file                                                                                                                                      | Lane SPL1 (Engine)          |
| The Volume viewer is slow, and a tap or drag on the walnut often does nothing but the sound                         | not yet traced                                                                                                                                                                                                                                                      | Lane TF1                    |
| The Photo album plays its page-turn sound when a tap with Pop out on raises a picture                               | not yet traced                                                                                                                                                                                                                                                      | Lane PIC2                   |
| The periodic table's info box is missing in full screen                                                             | not yet traced                                                                                                                                                                                                                                                      | Lane TF1                    |
| Moving photo to 3D: the Start slider seems to do nothing; the short Big Buck Bunny clip lags in the Sharp view only | not yet traced                                                                                                                                                                                                                                                      | Lane MP1                    |
| One splat, many splats: at the highest level a tap makes no sound he can hear                                       | the pitch rises with the level past hearing range                                                                                                                                                                                                                   | Lane TF1                    |

## Stage controls and phone layout

- A Record button on the stage, beside Play, with a plain record icon, so a take doesn't need the
  Share tab.
- On a phone, Play, the hand, and Reset stack in a column; put the stage's buttons in one row, with
  Record at the far right next to Play.
- Play should switch to Pause while an effect or a song plays.
- The media panel (the keyboard's song player) needs a close button, like the depth and level
  sliders have.
- Then an audit of the whole Playground on phones for clearer ways to do the same things, removing
  no feature; the desktop layout is close to right.

These go to lane REC1 (the controls, after its hotfix) and lane UX1 (the audit, report only).

## Export and share

- GIF: Motion defaults to the effect loop, not the turntable; more than 72 frames; sizes above 512
  pixels.
- Save a clip: the effect loop by default.
- Save a picture: the best resolution by default, with a choice.
- Embeds: the element must load; a tap shows the effect; sound as an option.
- Open a scene doesn't belong under one toy, since a scene can switch to another toy; it moves to a
  place of its own (a Studio entry or the Make tab). Save scene stays.
- A link, QR code, or scene keeps the sample image the person picked. A file the person opened
  (their own photo or song) can't fit in a link or QR code and there is no server; a saved scene
  file can carry it inside, so a scene opens with their media.

These go to lane EXP1, which takes over Codex #654 (task 89's full-quality exporters, untouched
since October 15 and written against the old recorder) and keeps what holds up in it.

## Toys and sounds

- **Shape morph is not accepted.** The tap's robotic sound is out (and the same voice is banned for
  new toys), the QR form is plain black and white, the morph is grainy, and emoji forms should keep
  the toy's own colors. Rebuild it to the bar.
- **Your name in splats** should feel and sound like the Toy Box page in the owner's portfolio: its
  sounds, no clicks while orbiting, its look, sharper, and the Splats slider's count honored. The
  Detail option may fold into Splats. Emoji colors are fine here.
- These two go to lane PT3.
- **One splat, many splats:** show clearly which splat a tap picked (a ring or halo, the rest
  dimmed), and keep the top level's tap audible. Lane TF1.
- **Photo album, Your book, Storybook:** a softer page-turn sound. **Picture lab:** no page-turn
  sound, and pages change in place again, with no turning animation. **Picture QR:** defaults of
  lowest contrast and the largest code size, and a new sound. Lane PIC2, which takes over Codex #656
  (Picture QR's Most detail, untouched since October 16).
- **Your own sound for any toy:** a person can open a sound file and use it as a toy's tap sound,
  kept on the device and saved inside scene files, with a few built-in alternatives to pick from.
  Lane SND2 (after PT3 and PIC2 settle their sounds).
- **Moving photo to 3D:** Sintel (the longer clip) as the default instead of Big Buck Bunny; sharper
  at 400k; more and longer clips; depth that holds steady from frame to frame without going flat
  (the riding-horse GIF is the control). Lane MP1 fixes and measures here first; the depth model's
  frame-to-frame stability then becomes a Codex task. "Forest path, walked" is weak.
- **Liked as they are:** the Neuron specimen, Your book (fast and right), Save as PDF, the scene's
  QR code shown as splats, and the recorder's countdown.

## Questions answered

- **Pop out and Pop-up layers:** Pop out (top bar) raises a picture off the page when tapped. Pop-up
  layers changes how it rises: as separate cutout cards at different depths, like a pop-up book,
  instead of one relief. It does nothing while Pop out is off.

## The Shop

The Shop should work with Model to splats, Splat field, Splat toolkit, Splat equation, One splat,
many splats (its splat picking and inspection must be a Shop strength), and Shape morph, besides the
bench already proposed. That goes into the owner's OK message for the Shop's builder.

## Codex

- New: task 112, a real-browser playtest of the whole Playground with computer use, report only
  (after the recorder hotfix is live), and task 99b, Photo to 3D's next round (Layered A's fill with
  Classic's hard edges), for the owner's review first.
- Held: 102 (crisper splats) until lane SPL1's engine change lands; 110 (trim before processing)
  until lane MP1 lands. 109 and 111 can run, after the open fix rounds.
- Open fix rounds waiting on a paste: 100, 101, 103, 104 (round 2), 105, 106, 107, and 108.
