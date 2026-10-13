// These scan helpers have no renderer imports. Warm only the selected scan's
// code while the engine transfers; the normal recipe still chooses and loads its data.
import { decodeSceneHash, parseHash } from "./codec.js";
import { findToy } from "./toys.js";

export async function warmOpeningPack() {
  const { s } = parseHash(location.hash);
  const toy = s
    ? (await decodeSceneHash(s)).toy
    : { kind: "builtin", id: new URLSearchParams(location.search).get("toy") };
  if (toy?.kind !== "builtin") return;
  const def = findToy(toy.id);
  if (def?.kind === "kit" && ["real-objects", "photoreal-r3"].includes(def.pack))
    await import("./packs/real-objects.js");
}
