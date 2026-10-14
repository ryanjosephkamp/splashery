// Lane Fluids r7: the Fluid lab's phone envelope (docs/FLUIDS.md, "r7"). Sized
// from the Fluid Lab phone audit (docs/audits/fluid-phone-2026-10.md): a phone
// gets the lab's own smaller allocations, whatever tier it detected, and a
// deliberate High or Max Detail choice (or ?profile=high|max) still gets the
// full lab. Nothing here touches the person's saved Detail choice. Safe to
// import in the worker: it reads the page only inside its functions.

// What the envelope sets, in one place (the audit's "Proposed phone envelope").
export const PHONE_ENV = {
  dpr: 1.5, // the lab's own canvas cap (the recipe's `render.dpr`)
  density: 0.25, // props: about 35,000 splats of the 105,000 (recipe density 0.75)
  gpu: { cell: 0.05, cap: 6000 }, // WebGPU liquid (substeps stay the tier's)
  gasN: 20, // gas grids: cells along the widest side (flame 20x58x20 ...)
  cpuScale: 0.5, // CPU: the share of a spec's budget that `phone: { scale }` asks for
};

export const HINT = "This lab runs best on a computer. On a phone, choose Auto detail.";

const DETAIL_KEY = "splashery.detail"; // the same key as readDetail() in player.js

function param(name) {
  try {
    return new URLSearchParams(location.search).get(name);
  } catch {
    return null;
  }
}

// A touch device with a small screen (the same test the player's tier uses),
// not the tier itself. ?phone=1 and ?phone=0 force it (tools and tests).
export function isPhone() {
  const q = param("phone");
  if (q === "1") return true;
  if (q === "0") return false;
  try {
    const coarse = matchMedia("(pointer: coarse)").matches;
    return coarse && Math.min(screen.width, screen.height) < 820;
  } catch {
    return false;
  }
}

// Whether the smaller envelope applies: a phone whose person has not chosen
// High or Max (in Detail, or with ?profile=).
export function envelopeOn() {
  if (!isPhone()) return false;
  const forced = param("profile");
  if (forced === "high" || forced === "max" || forced === "strong") return false;
  try {
    const d = localStorage.getItem(DETAIL_KEY);
    return d !== "high" && d !== "max";
  } catch {
    return true;
  }
}
