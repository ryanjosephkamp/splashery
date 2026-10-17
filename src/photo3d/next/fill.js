// MIT; made by Ryan with Codex (GPT-6). Fill-only research candidate.
// Keep Classic's foreground colors, geometry, depth cuts, and shader unchanged.
import { patchMatchBackground } from "./patchmatch.js";

export function fillSurface(photo, classic) {
  return {
    ...classic,
    background: patchMatchBackground(photo, classic, {
      passes: 3,
      radius: 2,
      seed: 99,
      coherent: false,
    }),
  };
}
