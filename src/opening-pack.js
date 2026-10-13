// Keep the selected scan's helpers eager, after the engine mapping is installed
// and before GPU setup. The normal recipe still chooses and loads its data.
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

// Entry modules import this after the engine mapping is installed. Their
// remaining graph transfers in parallel; only GPU initialization awaits it.
export const openingReady = warmOpeningPack().catch(() => {});
