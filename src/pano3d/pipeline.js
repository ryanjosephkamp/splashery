import {
  TILES,
  perspective,
  alignTiles,
  fuseDepth,
  tileReliability,
  tileConfidence,
} from "./core.js";
import { rotatePhoto, panoramaPrior } from "./prior.js";

// Injection keeps the reconstruction independent of ONNX and browser lifecycle.
export async function reconstruct(
  photo,
  estimate,
  { side = 294, priorSide = 294, onStatus = () => {}, canceled = () => false } = {},
) {
  const tiles = [];
  for (let i = 0; i < TILES.length; i++) {
    if (canceled()) throw new Error("Panorama canceled.");
    onStatus(
      `Depth ${i + 1} of 10: looking ${["forward", "left", "back", "right", "up", "down"][i]}…`,
    );
    const pixels = perspective(photo, TILES[i], side);
    const reliability = tileReliability(pixels);
    const confidence = tileConfidence(pixels);
    const depth = await estimate(pixels, { side });
    if (canceled()) throw new Error("Panorama canceled.");
    tiles.push({ ...TILES[i], ...depth, reliability, confidence });
  }
  onStatus("Aligning the depth all around…");
  const alignment = alignTiles(tiles);
  const cube = fuseDepth(tiles, alignment);
  const observations = [];
  let scratch;
  for (let i = 0; i < 4; i++) {
    if (canceled()) throw new Error("Panorama canceled.");
    onStatus(`Depth ${i + 7} of 10: checking the whole panorama…`);
    const rotated = rotatePhoto(photo, i / 4, scratch);
    if (rotated.offset) scratch = rotated.photo.data;
    const prediction = await estimate(rotated.photo, { side: priorSide });
    if (canceled()) throw new Error("Panorama canceled.");
    observations.push({ ...prediction, offset: rotated.offset });
  }
  onStatus("Reconciling global and local depth…");
  const result = panoramaPrior(photo, observations, cube);
  return { depth: result.depth, alignment: { ...alignment, prior: result.calibration } };
}
