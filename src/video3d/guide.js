// Video to 3D (lane Video 3D, r7): what makes a video work, in plain words. Shown in the Toy tab
// before a video is picked, and again on the progress card when a video fails.

export const WORKS = [
  "Walk slowly around an object, or through a place, so the camera moves sideways and sees the same things from new angles.",
  "10 to 40 seconds, held steady, in even light. A computer can try 60 to 90 seconds for a longer walk.",
  "Plenty of texture: stone, bark, brick, leaves, signs.",
  "No zoom, and few people or cars moving.",
  "A drone circling a building or a statue is ideal.",
  "A file under 40 MB (trim a long video first).",
];

export const FAILS = [
  "Turning on the spot, or a panorama: the camera has to move, not just turn.",
  "A tripod time-lapse: the camera never moves.",
  "Blank walls, sky or water: nothing to match.",
  "Blur from fast moves or low light.",
];

// One paragraph for the Toy tab's note (plain text).
export const GUIDE_NOTE = `Works: How to film for Video to 3D. ${WORKS.join(" ")} Fails: ${FAILS.join(" ")} Choose the stretch above first, then open the video: a few frames give a quick suitability estimate, then the camera path is worked out, and splats are trained on this device. Nothing is uploaded. Training takes minutes, longer on a phone. A phone uses up to 16 frames and stops training after eight minutes; a bigger world is best on a computer.`;
