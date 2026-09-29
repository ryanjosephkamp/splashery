// Device tiers and splat budgets for worlds (docs/WORLDS.md, "Budgets").
// The tier rules match the toy player's (detectProfile in src/player.js):
// low for small, weak devices, mid for phones, high for the rest; ?profile=
// forces one. A world's budget is the most splats it draws at once (terrain,
// water, sky, props, signs and the character together); the level-of-detail
// planner (lod.js) keeps under it by coarsening the farthest chunks first.

export const WORLD_BUDGETS = {
  low: { splats: 220e3, density: 0.5, near: 14, mid: 34, props: 0.5, grass: 0 },
  mid: { splats: 380e3, density: 0.75, near: 18, mid: 44, props: 0.75, grass: 0.6 },
  high: { splats: 650e3, density: 1, near: 24, mid: 56, props: 1, grass: 1 },
  max: { splats: 1e6, density: 1.3, near: 30, mid: 70, props: 1.25, grass: 1.3 },
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
