# Triage of the October 9 walkthrough review

The owner walked through the site and the toys again on October 9, 2026, on desktop and on his
phone. His notes stay private at his request. This file is the Operator's summary of them, in the
Operator's words, with what the code shows for each item and the lane that owns it. The causes below
come from a read-only research pass on main at `7f435756`; each lane confirms them before fixing.

Lanes started on October 9, 2026:

- **QR r4** (`qr4`, Opus)
- **Photo depth** (`pdp`, Opus)
- **Fix10** (`fx10`, Opus)
- **Arcade r3** (`arc3`, Opus)

Moving photo to 3D's stability goes to Codex (docs/codex/32-moving-photo-stability.md), as the owner
suggested.

## QR r4 (`qr4`, Opus)

1. **The QR family "flashes big" for about a second whenever you open one of these toys or change
   any of its settings.** It affects QR code, Picture QR, QR from real things, and Other barcodes,
   and also the QR damage lab. It happens on desktop and phone, with or without labs.
   - **Cause:** after every build, each toy's automatic scan check renders the code on the visible
     stage canvas. It sets a fixed square drawing size (720, 900, or 1,024 pixels) and snaps the
     camera to a flat, tight front view (`app.js` `withCapture`, `stage.setFixedSize`,
     `player.renderAt`). The browser stretches that square buffer to the stage's shape for a few
     frames, then the size and camera are restored.
   - **Fix:** make `withCapture` never show on screen. Put a still frame over the stage while it
     captures, or render to an offscreen target. This is a small "Engine:" PR, merged first. It also
     fixes the user-started exports (GIF, WebM, and PDF).
   - **Test:** none covers this today, because every QR test turns `autoCheck` off. Add a test with
     `autoCheck` on.
2. **Picture QR: the picture isn't recognizable**, and in the black-and-white style the white
   background's corners show flashing dots.
   - **Cause:** every module is pushed toward its own color, so the random module pattern outweighs
     the photo. The black-and-white dither ignores the cells the code forces. And the splat patches
     leave a seam (a missing row of splats) at every module and cell edge, where the white sheet
     behind shows through.
   - **Fix (seams):** one seamless grid, as `src/qr/build.js` already does for the QR code toy, with
     a light underlay and a tiny depth lead for dark splats so overlaps never tie. Redraw only while
     the toy turns.
   - **Fix (the picture):** rebuild the weave as a proper halftone QR code. Three-by-three cells per
     module, with the middle one carrying the bit. Error diffusion over the whole grid, with the
     forced cells passing their error on. A reliability push only where a module would misread. The
     mask chosen to fit the picture. An optional larger version for more detail. A color halftone
     for the color style. It must still scan; the existing scan check proves it.
3. **Other barcodes:**
   - **Code 128's text is cut off at the bottom.** The label's paper has no room for text on Code
     128, so most of the text hangs off the label. It shows on the dark theme and hides on the light
     one (`qr-craft.js` `barcodeSplats`, `textH`).
   - **Data Matrix and Aztec look grainy.** Each dark module is a separate patch, with seams between
     them. Reuse the QR code toy's crisp builder: merged regions, edge strips, and an underlay.

## Photo depth (`pdp`, Opus)

1. **Photo to 3D, Sharp picture view: parts of the picture pop out during the depth animation** (not
   at its start or end), mostly on the owner's own photos, even at low depth. The Splats view
   doesn't do it.
   - **Cause:** the backing sheet behind the relief rises with the farthest depth layer. Halfway
     through the change it is higher than a near face that hasn't risen yet, so it draws in front:
     stepped slabs, with texture smeared along edges such as a nose, glasses, or a collar. A second
     cause is that blending four layer values per vertex lets a near feature sink behind a farther
     one mid-change (`src/live/relief-mesh.js`, both shader copies; `src/packs/photo-sharp.js`).
   - **Fix:** base the backing on the surface's current height. Optionally, move each connected
     piece as one solid layer, as the splats do (the effect quality rule "parts move as solid
     pieces"). Add tests that check the middle of the transition, not only its ends.
   - **Why mostly his photos:** portraits fill the affected areas with faces. The bundled samples
     put them on roads, tables, and glass, where a shifted copy looks plausible.
2. **The depth slider:**
   - Drag the slider panel anywhere, and remember where it was on this device.
   - In full screen on desktop it should move with the layout. Today it keeps its old offset because
     focus mode hides the side panel but leaves its width in the layout (`--panel-w`).
   - The small "Depth" button left after closing the slider should be movable too.
   - This is shared UI (Photo to 3D, Moving photo to 3D, and the splat mirror), so it is a small
     "Engine:" PR.
3. **Choose the depth sound on Photo to 3D.**
   - A few built-in choices with no wind or whoosh, plus "use my own sound".
   - Your own sound stays on the device: it is never uploaded or saved in a link.
   - The built-in choices go on the Sound Board first.

## Codex: Moving photo to 3D stability

**Moving photo to 3D should feel steadier**, without a lower frame rate or resolution. The causes
the research found:

- Each depth frame is stretched to its own range, so the scene "breathes".
- Depth is blended linearly between worked-out frames, which makes it judder.
- Edges are snapped near or far frame by frame, so they flicker.
- Color and depth drift apart by up to a quarter second.

The fixes:

- Align each frame's scale and shift, then normalize once.
- Filter over time, guided by the picture.
- Interpolate depth with the picture between worked-out frames.
- Hold edges steady, with hysteresis.
- Take the depth for the exact video frame shown.

The camera toy (`src/live/relief.js`) already does most of these. This goes to Codex as task 32,
with the measurements to beat. A Claude lane reviews and merges the result.

## Fix10 (`fx10`, Opus)

1. **Volume viewer: the sound is wrong.** The owner wants no click and no rising "vroom". Today it
   plays both. The plan:
   - A tap sounds like a film slid onto a lightbox.
   - Play gets its own soft rush, timed to the cut's two passes.
   - The drag stays silent.
2. **Electron microscope: zoom on any object.** Pollen and Diatoms zoom in three steps on one fixed
   object per image, though each image has several. A tap on any other object should start its own
   three-step zoom.
   - Fix: give each image a list of targets, pick the nearest one to the tap, and keep the current
     target's step in the toy's state.
3. **MRI of a fruit: moving through the slices is confusing**, the drag "locks up", and the outline
   is faint on the dark background.
   - **Causes:**
     - The help says to scroll, but the wheel zooms.
     - A tap starts a slice sweep. A second tap pauses it, and while it is paused the sweep holds
       the slice, so every drag after it is ignored.
     - The toy also turns, so the slice is seen from an angle.
   - **Fixes:**
     - A drag always beats the sweep.
     - The toy stops turning on its own.
     - The drag gain fits the fruit.
     - Add a Slice slider.
     - Brighter outlines, plus a thin contour ring on each slice.
     - New help text that doesn't say "scroll".
4. **Ripple tank: the pebble is hard to see.** It is about a centimeter across in a 36 cm tank, gray
   on teal, and visible for a third of a second.
   - Make it about 2.4 cm, pale stone, falling from higher.
   - Give it a shadow, have it sink briefly after landing, and make a dent to match.
5. **Night sky:**
   - **Too blurry in the daytime view** (the night view is excellent). Daytime ground splats are
     about twice as large as at night, and their soft edges smear the skyline. Give the day the
     night's density, and cap the splat size near the horizon.
   - **Dragging to look around is too fast.** The inside view uses the orbit camera's sensitivity: a
     full-height drag turns 504 degrees across a 72-degree view. Scale the drag to the field of view
     so the star under your finger stays under it. This is a small "Engine:" PR in `camera.js` that
     only the night sky uses.
6. **The 5-cell's thumbnail is much smaller than the other 4D shapes'.**
   - **Causes:**
     - At 256 pixels most of its thin splats fall under the renderer's 2-pixel cull.
     - Its resting pose also projects to about half the others' size.
   - **Fixes:**
     - Render thumbnails at four times the size and scale them down (or turn picture culling on
       while shooting), with labs on.
     - Bring the 5-cell's camera closer.
     - Re-render the 4D thumbnails.

## Arcade r3 (`arc3`, Opus)

The games, game by game. Anything not listed is fine as it is, including Volley Table and Page
Breaker.

- **Photo Dash:**
  - The background is too blurry, and it flickers instead of staying still.
  - Use a different default photo. Unless the player has opened their own photo, change to a new
    background at random after each level.
  - Let the player choose a different ball.
  - The platform is hard to see and blurry.
  - Give the coin a better sound.
- **Cast a Shadow:** in 3D, let the player turn and zoom a little to see the object and its shadow
  from other angles.
- **Soft Landing:** sharper.
- **Stone Belt** (the owner's favorite): much sharper.
- **Strata:**
  - Start in 2D, like the classic falling-blocks game.
  - Make it much sharper and maybe taller.
  - Show clearly how to rotate a piece; the owner couldn't find it.
- **Grain Garden:** turn around it a little in 3D, and sharper.
- **Longtail:** sharper, especially in 2D.
- **Shardball:**
  - The dome is the default.
  - Sharper overall.
  - In the dome, the ball touching the ground ends the game, as in 2D.
  - Turn a little in 3D.
  - The platform should catch and hold the ball, not only bounce it (today it holds only at the
    start).
- **Note Rider:** notes ring on too long, like a held sustain pedal. Add guitar and other
  instruments, the way rhythm games do.

The Arcade lane's sharpness work follows the effect quality rules. Each game gets a clip at phone
size.

## The Tinkerer's Manual

The owner reviewed the manual the same day. That review's plan is in
[../2026-10-09-manual/plan.md](../2026-10-09-manual/plan.md) (lane Manual r3).
