// Lane QR: the QR code itself. Project Nayuki's QR Code generator library
// (vendor/qrcodegen/, MIT) does the encoding; this file asks it for a code and
// marks which modules belong to the finder patterns (the three big "eyes"),
// the alignment patterns and the rest, so the toy can build and move each as
// its own piece. Loaded only when the QR code toy opens.

import qrcodegen from "../../vendor/qrcodegen/qrcodegen.js";

const { QrCode, QrSegment } = qrcodegen;

export const ECC = {
  L: QrCode.Ecc.LOW,
  M: QrCode.Ecc.MEDIUM,
  Q: QrCode.Ecc.QUARTILE,
  H: QrCode.Ecc.HIGH,
};

// What each error correction level can lose and still scan (the standard's
// figures).
export const ECC_RECOVERY = { L: "7%", M: "15%", Q: "25%", H: "30%" };

export const QUIET = 4; // the quiet zone, in modules (the standard asks for 4)

// The most a code can hold in bytes at each level (version 40), for a clear
// message instead of the library's.
const MAX_BYTES = { L: 2953, M: 2331, Q: 1663, H: 1273 };

// Module roles.
export const ROLE = { data: 0, finder: 1, alignment: 2, timing: 3, format: 4 };

// Encodes `text` at error correction `ecc` ("L", "M", "Q" or "H"). The version
// is the smallest that fits. `boost: true` (the default) lets the library
// raise the error correction for free when the text fits the same version
// anyway, as most generators do; the code then says which level it got.
// Returns { text, size, version, ecc, mask, dark, role, piece, pieces }:
//   dark   Uint8Array(size * size), 1 for a dark module (row by row, top first)
//   role   Uint8Array, ROLE of each module
//   piece  Int16Array, -1 for a module on its own, else the index in `pieces`
//          of the finder or alignment pattern it belongs to
//   pieces [{ kind: "finder" | "alignment", row, col, n }]: each pattern's
//          top-left module and its width in modules (7 or 5); a finder's
//          piece covers its 7 x 7 modules (the light separator around it
//          stays with the background)
export function encodeQR(text, ecc = "M", { boost = true, mask = -1 } = {}) {
  const level = ECC[ecc] ? ecc : "M";
  const str = String(text ?? "");
  const bytes = new TextEncoder().encode(str).length;
  if (bytes > MAX_BYTES[level])
    throw new Error(
      `That is too long for a QR code at level ${level} (${bytes} bytes; at most ${MAX_BYTES[level]}).`,
    );
  const segs = QrSegment.makeSegments(str);
  const qr = QrCode.encodeSegments(segs, ECC[level], 1, 40, mask, boost);
  const size = qr.size;
  const dark = new Uint8Array(size * size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) dark[y * size + x] = qr.getModule(x, y) ? 1 : 0;
  const got = Object.keys(ECC).find((k) => ECC[k] === qr.errorCorrectionLevel) || level;
  const { role, piece, pieces } = rolesOf(size, qr.version);
  return { text: str, size, version: qr.version, ecc: got, asked: level, mask: qr.mask, dark, role, piece, pieces }; // prettier-ignore
}

// The alignment patterns' centers on each axis for a version (the standard's
// table, as the library computes it).
export function alignmentPositions(version) {
  if (version === 1) return [];
  const n = Math.floor(version / 7) + 2;
  const step = Math.floor((version * 8 + n * 3 + 5) / (n * 4 - 4)) * 2;
  const out = [6];
  for (let pos = version * 4 + 10; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

function rolesOf(size, version) {
  const role = new Uint8Array(size * size);
  const piece = new Int16Array(size * size).fill(-1);
  const pieces = [];
  const set = (x, y, r) => {
    if (x >= 0 && y >= 0 && x < size && y < size) role[y * size + x] = r;
  };
  // Timing patterns (row 6 and column 6).
  for (let i = 0; i < size; i++) {
    set(6, i, ROLE.timing);
    set(i, 6, ROLE.timing);
  }
  // Format information around the finders (and version information from 7).
  for (let i = 0; i < 9; i++) {
    set(8, i, ROLE.format);
    set(i, 8, ROLE.format);
  }
  for (let i = 0; i < 8; i++) {
    set(size - 1 - i, 8, ROLE.format);
    set(8, size - 1 - i, ROLE.format);
  }
  if (version >= 7)
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 3; j++) {
        set(size - 11 + j, i, ROLE.format);
        set(i, size - 11 + j, ROLE.format);
      }
  // Finder patterns with their separators; the 7 x 7 pattern is the piece.
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ]) {
    // prettier-ignore
    const id = pieces.length;
    pieces.push({ kind: "finder", row: cy - 3, col: cx - 3, n: 7 });
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        role[y * size + x] = ROLE.finder;
        if (Math.abs(dx) <= 3 && Math.abs(dy) <= 3) piece[y * size + x] = id;
      }
  }
  // Alignment patterns (5 x 5), skipping the three that would sit on a finder.
  const pos = alignmentPositions(version);
  const last = pos.length - 1;
  for (let i = 0; i < pos.length; i++)
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      const id = pieces.length;
      pieces.push({ kind: "alignment", row: pos[j] - 2, col: pos[i] - 2, n: 5 });
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const k = (pos[j] + dy) * size + pos[i] + dx;
          role[k] = ROLE.alignment;
          piece[k] = id;
        }
    }
  return { role, piece, pieces };
}

// The code as text, one row per line ("#" dark, "." light): for tests and
// for comparing with other encoders.
export function asText(code) {
  const rows = [];
  for (let y = 0; y < code.size; y++) {
    let s = "";
    for (let x = 0; x < code.size; x++) s += code.dark[y * code.size + x] ? "#" : ".";
    rows.push(s);
  }
  return rows.join("\n");
}
