// Lane QR r4 part 2: which QR code a scene's link becomes (src/qr/share.js
// draws it). Plain JavaScript, so the tests use it in Node too.

import { encodeQR } from "./encode.js";

// The most a code can hold in bytes at level L (version 40).
export const MAX_BYTES = 2953;
// Error correction: M (15% can be lost) while the code stays at version 30 or
// smaller; past that L, for the smallest code a phone can still resolve.
const PREFER = "M";
const PREFER_UP_TO = 30;

// The code for a link: { ok, code, level, bytes } or { ok: false, bytes }.
export function shareCode(url) {
  const bytes = new TextEncoder().encode(url).length;
  if (bytes > MAX_BYTES) return { ok: false, bytes };
  try {
    const m = encodeQR(url, PREFER, { boost: false });
    if (m.version <= PREFER_UP_TO) return { ok: true, code: m, level: PREFER, bytes };
  } catch {
    // Too long at M: try L.
  }
  try {
    const l = encodeQR(url, "L", { boost: false });
    return { ok: true, code: l, level: "L", bytes };
  } catch {
    return { ok: false, bytes };
  }
}
