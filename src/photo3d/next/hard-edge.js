// MIT; made by Ryan with Codex (GPT-6). A's backing fill, Classic's foreground colors.
import { patchMatchBackground } from "./patchmatch.js";

export function fillSurface(photo, classic) {
  const background = patchMatchBackground(photo, classic, {
    passes: 3,
    radius: 2,
    seed: 99,
    coherent: false,
  });
  // The foreground shader also samples this texture when no same-side photo
  // texel is available. Its fallback must stay Classic even when the backing changes.
  background.classicRgba = classic.background.rgba;
  return { ...classic, background };
}
