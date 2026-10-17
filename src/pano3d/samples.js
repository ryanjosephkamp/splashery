import { decodePhoto, packDepth, unpackDepth } from "../packs/photo-3d.js";
export { packDepth };
export const SAMPLES = [
  { id: "room", label: "Sunlit room", title: "Small Empty Room 1", asset: "small_empty_room_1" },
  { id: "room2", label: "Lamplit room", title: "Small Empty Room 2", asset: "small_empty_room_2" },
].map((s) => ({
  ...s,
  author: "Sergej Majboroda",
  source: `https://polyhaven.com/a/${s.asset}`,
  license: "CC0 1.0",
  licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
}));

export async function loadSample(id) {
  const s = SAMPLES.find((v) => v.id === id) || SAMPLES[0];
  const path = `assets/toys/step-inside-360/${s.id}`;
  let photo, depth;
  if (typeof window === "undefined") {
    const fs = await import("node:fs/promises");
    photo = await decodePhoto(await fs.readFile(path + ".jpg"));
    try {
      depth = unpackDepth(await fs.readFile(path + ".depth"));
    } catch {
      /* The preparation tool can build an uncached sample. */
    }
  } else {
    const response = await fetch(new URL(`../../${path}.jpg`, import.meta.url));
    if (!response.ok) throw new Error("The sample panorama couldn't load.");
    photo = await decodePhoto(await response.blob());
    const cache = await fetch(new URL(`../../${path}.depth`, import.meta.url));
    if (cache.ok) depth = unpackDepth(new Uint8Array(await cache.arrayBuffer()));
  }
  return { photo, depth, name: s.label, heading: 0, sample: s };
}
