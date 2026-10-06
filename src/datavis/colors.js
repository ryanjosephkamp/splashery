// Lane Data and climate: color scales for charts. Sequential (a viridis-like
// ramp, dark blue to yellow, readable by color-blind people and in gray),
// diverging (blue, pale, red, for anomalies around zero) and categorical
// (eight distinct hues).

import { ramp, mix } from "../kit.js";

export const SEQUENTIAL = ["#3b1f6e", "#3a5a9b", "#21918c", "#5ec962", "#e7d93a"];
export const DIVERGING = ["#2a4f9e", "#6f9fd0", "#e9e4dc", "#e58a5f", "#b2222a"];
export const CATEGORICAL = ["#2f6db5", "#e07b27", "#3a9a4b", "#c9393d", "#8a5bbf", "#8c5a3c", "#d460a7", "#6f7782"]; // prettier-ignore

// t in 0..1.
export const sequential = (t) => ramp(SEQUENTIAL, Math.max(0, Math.min(1, t)));
// t in -1..1, 0 the middle.
export const diverging = (t) => ramp(DIVERGING, Math.max(0, Math.min(1, (t + 1) / 2)));
export const categorical = (i) => CATEGORICAL[((i % 8) + 8) % 8];

// Bakes a little light into a color (splats are unlit): f from about -0.3
// (shade) to 0.3 (lit).
export function light(c, f) {
  return f >= 0 ? mix(c, "#ffffff", f) : mix(c, "#000000", -f);
}
