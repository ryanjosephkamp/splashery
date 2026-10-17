import { TILES, perspective, alignTiles, fuseDepth, tileReliability } from "./core.js";

// Injection keeps the reconstruction independent of ONNX and browser lifecycle.
export async function reconstruct(
  photo,
  estimate,
  { side = 294, onStatus = () => {}, canceled = () => false } = {},
) {
  const tiles = [];
  for (let i = 0; i < TILES.length; i++) {
    if (canceled()) throw new Error("Panorama canceled.");
    onStatus(
      `Depth ${i + 1} of 6: looking ${["forward", "right", "back", "left", "up", "down"][i]}…`,
    );
    const pixels = perspective(photo, TILES[i], side);
    const reliability = tileReliability(pixels);
    const depth = await estimate(pixels, { side });
    if (canceled()) throw new Error("Panorama canceled.");
    tiles.push({ ...TILES[i], ...depth, reliability });
  }
  onStatus("Aligning the depth all around…");
  const alignment = alignTiles(tiles);
  const depth = fuseDepth(tiles, alignment);
  return { depth, alignment };
}
