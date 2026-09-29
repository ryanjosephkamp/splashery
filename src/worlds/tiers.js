// Device tiers and splat budgets for worlds (docs/WORLDS.md, "Budgets").
// The tier rules match the toy player's (detectProfile in src/player.js):
// low for small, weak devices, mid for phones, high for the rest; ?profile=
// forces one. A world's budget is the most splats it draws at once (terrain,
// water, sky, props, signs and the character together); the level-of-detail
// planner (lod.js) keeps under it by coarsening the farthest chunks first.
// `shadows` is the sun's shadow map size (0 turns shadows off) and
// `shadowDistance` how far from the camera shadows reach, in meters.

export const WORLD_BUDGETS = {
  low: {
    shadows: 1024,
    shadowDistance: 16,
    splats: 300e3,
    density: 0.5,
    near: 7,
    mid: 30,
    props: 0.6,
    grass: 0.4,
    ratio: 1.5,
    kernel: "sharp",
  },
  mid: {
    shadows: 1024,
    shadowDistance: 26,
    splats: 550e3,
    density: 0.75,
    near: 9,
    mid: 38,
    props: 0.9,
    grass: 0.7,
    ratio: 2,
    kernel: "sharp",
  },
  high: {
    shadows: 2048,
    shadowDistance: 36,
    splats: 900e3,
    density: 1,
    near: 12,
    mid: 50,
    props: 1.2,
    grass: 1,
    ratio: 3,
    kernel: "sharp",
  },
  max: {
    shadows: 2048,
    shadowDistance: 48,
    splats: 1.4e6,
    density: 1.3,
    near: 15,
    mid: 64,
    props: 1.5,
    grass: 1.3,
    ratio: 3,
    kernel: "sharp",
  },
};

export const TIERS = Object.keys(WORLD_BUDGETS);

export function detectTier() {
  const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : null;
  const forced = params?.get("profile");
  if (forced === "weak") return "low";
  if (forced === "strong") return "high";
  if (forced && WORLD_BUDGETS[forced]) return forced;
  if (typeof navigator === "undefined") return "high";
  const mem = typeof navigator.deviceMemory === "number" ? navigator.deviceMemory : 8;
  const cores = typeof navigator.hardwareConcurrency === "number" ? navigator.hardwareConcurrency : 8; // prettier-ignore
  if (mem <= 2 || cores <= 2) return "low";
  const coarse = matchMedia("(pointer: coarse)").matches;
  const small = Math.min(screen.width, screen.height) < 820;
  if ((coarse && small) || mem <= 4 || cores <= 4) return "mid";
  return "high";
}
