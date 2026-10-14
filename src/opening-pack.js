// Keep the selected scan's helpers eager before GPU setup.
// The normal recipe still chooses and loads its data.
import { decodeSceneHash, parseHash } from "./codec.js";

const SCAN_IDS = new Set([
  "water-bottle",
  "sunglasses",
  "baseball-cap",
  "fountain-pen",
  "soda-can",
  "running-shoe",
  "hoodie",
  "celestial-globe",
  "armillary-sphere",
  "stannern-meteorites",
  "fluorite-crystal",
  "ammonite-agate",
  "morasko-meteorite",
  "pyrite-cubes",
  "megalodon-tooth",
]);

export async function warmOpeningPack() {
  const { s } = parseHash(location.hash);
  const toy = s
    ? (await decodeSceneHash(s)).toy
    : { kind: "builtin", id: new URLSearchParams(location.search).get("toy") };
  if (toy?.kind !== "builtin") return;
  if (SCAN_IDS.has(toy.id)) await import("./packs/real-objects.js");
}

// HTML starts this module independently of the app graph. Entry modules
// await its shared promise before GPU initialization.
export const openingReady = warmOpeningPack().catch(() => {});
