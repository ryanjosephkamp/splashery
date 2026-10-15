// Baked sample detail follows the device budget. A phone keeps the compact independently fitted
// tier; a desktop can use the sharper tier. The custom-video trainer retains its own settings.
export function sampleBudget(budget = 400000, { profile, phone = false } = {}) {
  const count = Number.isFinite(budget) && budget > 0 ? Math.floor(budget) : 400000;
  return phone || profile === "low" || profile === "weak" ? Math.min(count, 60000) : count;
}

export function phoneDevice() {
  if (globalThis.__v3dPhone != null) return !!globalThis.__v3dPhone;
  const n = globalThis.navigator;
  return !!(
    n?.userAgentData?.mobile ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(n?.userAgent || "") ||
    (/Macintosh/.test(n?.userAgent || "") && n.maxTouchPoints > 1)
  );
}

// An automatically detected High profile on a large tablet still uses the phone model.
// Only an explicit High/Max detail choice opts a phone into the desktop model.
export function phoneSample(profile, { forced = null, detail = null } = {}) {
  if (!phoneDevice()) return false;
  if (forced == null)
    forced = new URLSearchParams(globalThis.location?.search || "").get("profile");
  if (detail == null) {
    try {
      detail = globalThis.localStorage?.getItem("splashery.detail");
    } catch {
      detail = "auto";
    }
  }
  const explicit = ["high", "max", "strong"].includes(forced) || ["high", "max"].includes(detail);
  return !(explicit && ["high", "max", "strong"].includes(profile));
}
