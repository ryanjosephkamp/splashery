# How Video to 3D works

A plain write-up of the "Video to 3D" toy (Studio shelf, behind the labs switch), for the Tinkerer's
Manual and anyone documenting the site. Written by lane Video 3D (Opus 5.5) on October 2, 2026. The
measurements and the comparison with other tools are in [VIDEO3D.md](VIDEO3D.md).

## The idea in one paragraph

A video is a string of photos taken from a moving camera. If the scene stands still while the camera
moves, each frame shows it from a slightly different place, the way your two eyes see the world from
two places. Find the same small details in many frames, and you can work out both where the camera
was for each frame and where those details sit in 3D. From there, a cloud of soft, colored blobs (3D
Gaussian splats) is adjusted until, seen from each camera, it looks like the frame taken there. The
result is a little 3D world you can turn, zoom and fly through.

## The steps

1. **Pick the frames.** You choose a stretch of the video (its start, 5 to 40 seconds long) and how
   many frames a second to take (2 to 6). The stretch is cut into short windows, and in each window
   the sharpest of three frames is kept (sharpness is scored on a small gray copy: a blurred frame
   has weak edges). The video plays in a hidden `<video>` element from your device: nothing is
   uploaded.
2. **Work out the camera path (structure from motion).** This is Splat.js (MIT license, vendored in
   `vendor/splatjs/`, loaded only when you open a video in this toy). It:
   - finds a few thousand distinctive details in each frame (SIFT features: corners and specks that
     look the same from a slightly different angle);
   - matches them between pairs of frames, and keeps a pair only if its matches agree with one
     camera move (an "essential matrix");
   - starts from the best pair, places the cameras one by one, and builds the matched details into
     3D points;
   - refines every camera and point together so that each point lands where it was seen in each
     frame (bundle adjustment), and tries a few lens widths to find the one that fits.

   If no two frames match well enough, it tries once more with looser matching (more details, found
   at a finer scale and at lower contrast, and a lower bar for a pair to count). If that fails too,
   the card says why in plain words and what to film instead.

3. **Seed the splats.** Each 3D point becomes a splat to start from.
4. **Train the splats on your graphics card (WebGPU).** Each training step renders the splats from
   one of the cameras, compares the picture with the real frame, and nudges every splat's place,
   size, shape, color and opacity to make them match better. In runs past 1,500 steps it also, every
   so often, splits splats where the picture is still wrong and moves faded ones to where they are
   needed, so detail grows where the video looked closely. This is the slow part: thousands of
   steps.
5. **Show it.** The splats become the toy. Things far away (the sky, a skyline) are pulled in onto a
   shell around the scene so they still show. Faint haze and blobs floating right in front of the
   camera are trimmed. Replay flight flies the video's own camera path with the video's sound; drag
   or pinch while it flies to look around, and tap again to pause. Save as PLY keeps the splats in
   the standard file format other splat viewers read.

## The settings

"Automatic" picks phone-safe on a phone and the device's own tier elsewhere.

| Setting    | Frames (most) | Frame size | Training picture | Steps  | Splats (most) |
| ---------- | ------------- | ---------- | ---------------- | ------ | ------------- |
| Phone-safe | 16            | 480 px     | 320 px           | 1,200  | 30,000        |
| Light      | 20            | 480 px     | 360 px           | 1,500  | 60,000        |
| Standard   | 32            | 640 px     | 480 px           | 3,000  | 120,000       |
| High       | 60            | 960 px     | 720 px           | 7,000  | 250,000       |
| Highest    | 90            | 1280 px    | 960 px           | 12,000 | 350,000       |

On a phone, the toy shows the setting and a rough time first, and starts only when you tap Start.
Phone-safe trains in bursts (about 3 seconds on, 2 off) so the phone stays cool and responsive. It
pauses while the tab is hidden, and after 8 minutes it stops by itself and keeps what it has.
"Finish now" ends training early and keeps the splats trained so far. A heavier setting on a phone
can make it hot and slow.

The card's time is a rough guess before training starts. Once training runs, the card shows the time
left, measured from its own pace.

## What works and what fails

Works:

- walking slowly around an object, or through a place, so the camera moves sideways and sees the
  same things from new angles;
- 10 to 40 seconds, held steady, in good light;
- plenty of texture: stone, bark, brick, leaves, signs;
- no zoom, and few people or cars moving;
- a drone circling a building or a statue (ideal);
- a file under 40 MB (the Toy tab's limit): trim a long video first.

Fails:

- turning on the spot, or a panorama: the camera turns but does not move, so nothing has depth;
- a tripod time-lapse: the camera never moves;
- blank walls, sky or water: nothing to match;
- blur from fast moves or low light.

Things that move while the camera films (people, cars, waves) blur or vanish: the training sees them
in a different place in each frame.

## What it needs

A browser with WebGPU (current Chrome, Edge and Safari; Firefox on some systems). Without it, the
toy says so and shows its samples. Memory and time grow with the setting: a computer with a graphics
card should handle High in minutes (estimated, not yet measured on one); a phone should use
Phone-safe. The samples on the site were trained the same way in a container with no graphics card,
which took hours.
