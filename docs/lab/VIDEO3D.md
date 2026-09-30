# Video to 3D: the spike's report

Lane Video 3D (prefix `v3d`), built by Opus 5.5, September 30, 2026. The brief is in
[docs/handoff/Video3D.md](../handoff/Video3D.md). This is a one-week spike: it ends in this report
and a decision, not a polished toy.

MEASUREMENTS

## The Mac route, for showcase scenes

For a scene worth showing off (a long drone flight, a big building), train on the owner's Apple
silicon Mac instead of in the browser: the camera path is more careful, the training runs for many
more steps on the Mac's GPU, and the result comes back to Splashery as a SOG file like any scan.
Each tool's license was checked on its live page on September 30, 2026:

| Step        | Tool                                                                         | License                 |
| ----------- | ---------------------------------------------------------------------------- | ----------------------- |
| Camera path | [COLMAP](https://github.com/colmap/colmap) 4.2.1                             | BSD ("new BSD license") |
| Training    | [msplat](https://github.com/rayanht/msplat) (Metal, Apple's GPU)             | Apache 2.0              |
| or training | [Brush](https://github.com/ArthurBrussee/brush)                              | Apache 2.0              |
| To our file | [SplatTransform](https://github.com/playcanvas/splat-transform) (PlayCanvas) | MIT                     |

Off limits under Splashery's rules (not used, not suggested): MASt3R and DUSt3R (CC BY-NC-SA), VGGT
(its own license), Depth Anything 3's splat head and most "instant" feed-forward splat models
(non-commercial weights), and OpenSplat as a shipped part (AGPL; a build-only tool only if the owner
agrees).

### Steps

You need macOS 14 or later on an Apple silicon Mac, [Homebrew](https://brew.sh) and Python 3.

1. **Install the tools** (once), in Terminal:

   ```sh
   brew install colmap ffmpeg node
   python3 -m pip install "msplat[cli]"
   npm install -g @playcanvas/splat-transform
   ```

2. **Pick the frames.** Put the video in a new folder, then take three frames a second from the
   stretch you want (here 40 seconds starting at 1:05):

   ```sh
   mkdir -p scene/images
   ffmpeg -ss 65 -t 40 -i flight.mp4 -vf "fps=3,scale=1600:-2" -q:v 2 scene/images/%04d.jpg
   ```

   Look through `scene/images` and delete blurry frames and any frame with a person close to the
   camera.

3. **Work out the camera path** with COLMAP (15 to 60 minutes for a few hundred frames):

   ```sh
   colmap automatic_reconstructor --workspace_path scene --image_path scene/images \
     --data_type video --quality high --single_camera 1 --dense 0
   ```

   It writes `scene/sparse/0/` (the cameras and a cloud of points). If it writes several numbered
   folders, the video broke into pieces that do not connect: use the biggest (most images) or pick a
   steadier stretch.

4. **Train the splats** with msplat on the Mac's GPU (a few minutes for 30,000 steps):

   ```sh
   msplat-train scene -n 30000
   ```

   It reads COLMAP's folder layout from step 3 and writes a PLY of the trained splats; its README
   documents the training flags but not where the CLI saves the PLY, so run `msplat-train --help`
   once to see the output option of the installed version. Brush does the same with a window to
   watch: build it once with `cargo run --release` in its repository (Rust 1.88 or later), open the
   `scene` folder in it, and export the PLY when the picture looks sharp.

5. **Convert it for Splashery**:

   ```sh
   splat-transform scene.ply scene.sog
   ```

   Open `scene.sog` on the site (drop it on the page) to check it, then send it to the Operator with
   the video's source and license, so a lane can add it as a scene.
