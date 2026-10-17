// MIT; made by Ryan with Codex (GPT-6). Experimental guard for narrow depth edges.
import { minimumField } from "../background.js";
import { patchMatchBackground } from "./patchmatch.js";

export function fillSurface(photo, classic) {
  const b = classic.background,
    background = patchMatchBackground(photo, classic),
    original = new Float32Array(b.w * b.h);
  for (let y = 0; y < b.h; y++)
    for (let x = 0; x < b.w; x++)
      original[y * b.w + x] =
        classic.depth[
          Math.min(classic.gy - 1, Math.floor(((y + 0.5) * classic.gy) / b.h)) * classic.gx +
            Math.min(classic.gx - 1, Math.floor(((x + 0.5) * classic.gx) / b.w))
        ];
  const low = minimumField(original, b.w, b.h, 4);
  let guarded = 0;
  for (let i = 0; i < original.length; i++)
    if (background.filled[i] && original[i] - low[i] > 0.08) {
      background.rgba.set(b.rgba.subarray(i * 4, i * 4 + 4), i * 4);
      background.donor[i] = b.donor[i];
      guarded++;
    }
  background.patchmatch.guarded = guarded;
  return { ...classic, background };
}
