// Lane Sharpness: render levers against grain. Two are on for everyone since
// September 29, 2026 (the owner: "sharp yes – looks noticeably better"): the
// pixel-ratio cap of 3 on the mid and high tiers (PIXEL_RATIO in player.js)
// and adapt "drag". The rest are labs switches, off by default.
//
// Four settings every toy shares decide how much detail reaches the screen:
//
//   cull   the engine skips splats under about 2 screen pixels
//          (scene.gsplat.minPixelSize 2) and, on WebGPU, splats whose opacity
//          times area is under 3 pixels (minContribution 3). Faint or small
//          splats of a dense kit toy vanish, and the gaps show as speckle.
//          "low" lowers both to 1, "off" to 0; a number sets minPixelSize and
//          minContribution 1.5 times it.
//   dpr    the canvas pixel-ratio cap (PIXEL_RATIO in player.js caps phones
//          at 2; many phones are 3). A number from 1 to 3, or "native" (the
//          device's own ratio, up to 3).
//   adapt  the adaptive drop in resolution. By default the ratio drops by a
//          third while frames are slow and anything moves (a drag, the idle
//          sway, an effect). "drag" drops it only during a drag or a paint
//          stroke, so a toy playing on its own keeps full resolution.
//   aa     the engine's anti-aliased splats (scene.gsplat.antiAlias, the
//          Mip-Splatting opacity compensation for the 0.3 px² blur every
//          splat gets): "1" turns it on.
//
// ?sharp=1 turns on the first three together (cull low, dpr native, adapt
// drag); single switches then override it. A recipe's `render` field
// ({ cull, dpr, adapt, aa }) sets them for one toy; the URL wins. All of it
// only while labs is on, except the default: adapt "drag" for every toy, which
// ?adapt=off turns off in labs. ?sharp=0 puts the renderer back exactly as it
// was before the default, for anyone (the old caps too). docs/lab/SHARPNESS.md
// has the measurements.

const CULL = { low: 1, off: 0 };

function cullValue(v) {
  if (v == null || v === "") return null;
  const px = v in CULL ? CULL[v] : Number(v);
  if (!Number.isFinite(px) || px < 0 || px > 4) return null;
  return { minPixelSize: px, minContribution: px * 1.5 };
}

function dprValue(v, native = 1) {
  if (v == null || v === "") return null;
  const n = v === "native" ? native : Number(v);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(3, n);
}

// The public default: the adaptive drop only during a drag.
export const SHARP_DEFAULT = Object.freeze({ cull: null, dpr: null, adapt: "drag", aa: false });

// ?sharp=0: the renderer as it was before the default (for anyone).
export function sharpOff(params) {
  return params?.get?.("sharp") === "0";
}

// The levers a toy gets, or null when every one is off (the renderer is then
// exactly as it was before this lane). `params` is a URLSearchParams (or
// anything with get()), `recipe` the toy recipe's `render` object.
export function pickSharpness({ labs, params, recipe = null, native = 1 }) {
  if (sharpOff(params)) return null;
  if (!labs) return { ...SHARP_DEFAULT };
  const get = (k) => params?.get?.(k) ?? null;
  const preset = get("sharp") === "1";
  const pick = (k, def) => get(k) ?? recipe?.[k] ?? (preset ? def : null);
  const cull = cullValue(pick("cull", "low"));
  const dpr = dprValue(pick("dpr", "native"), native);
  const adapt = (get("adapt") ?? recipe?.adapt ?? "drag") === "drag" ? "drag" : null;
  const aaV = pick("aa", null);
  const aa = aaV === "1" || aaV === 1 || aaV === true;
  if (!cull && !dpr && !adapt && !aa) return null;
  return { cull, dpr, adapt, aa };
}
