# Photo to 3D: twenty blind pairs for task 99b

Made by Ryan with Codex (GPT-6). This evidence branch is never merged. The implementation and report
are in draft PR #714: https://github.com/ryanjosephkamp/splashery/pull/714

Host `review/photo-3d-hard-edge/` as static files, then open its `index.html`. Compare A and B for
each pair and save all 20 choices. These are the same 20 inputs as the previous vote, with new
balanced identities: ten on each side. Each of the 40 clips has 72 actual frames at 12 fps and
390×844, without interpolation. Both sides have the same source image, depth, and camera path.
Source and license credits accompany every pair.

Keep `raw/operator-key.json.gz` closed until the owner's choices are complete. The public review
folder contains no identity key. The raw records name the methods for auditing and should remain out
of the blind review.

The real-browser smoke test passed at 390×844 and 1440×900: all 40 videos loaded and decoded, paired
playback worked, incomplete votes were blocked, and a complete synthetic selection downloaded
correctly. Synthetic choices are never owner votes. Owner votes are unmeasured.

The full 118-input quality and five-trial cost measurements are still running. This branch will
receive their compressed records when complete. Thin-part contrast regressions already prevent
enabling a Fill option. Classic remains frozen and the prototype is disconnected.

Code is MIT; photo derivatives retain their source licenses. Original procedural truth scenes are
CC0. Rule check: none.
