// Lane QR lab r2: damage for a code made of splats (src/qr-lab/splats.js).
// The Damage lab (src/packs/qr-lab.js) and the study (tools/qrs-*.mjs) apply
// the same damage, so the lab's meter and the study's numbers describe the
// same codes.
//
// A damage is { kind, amount (0..1), region, seed }. Kinds:
//   Things that happen to a printed code too:
//     scratch   lines scraped through the ink (the paper shows)
//     sticker   a pale label stuck over part of it
//     tear      a corner torn off (what's behind shows)
//     burn      a corner burned away, its edge charred dark
//     smudge    a smear of gray ink
//   Things only a code of splats can have:
//     blur      the splats spread wider (softer), each over its neighbors
//     shrink    the splats get smaller, so the ground shows between them
//     grow      the splats get bigger, so dark spreads into light
//     jitter    each splat moves a little, at random
//     fade      the splats turn see-through
//     color     the code's color drifts toward a pale orange
//     curve     the plate bends, like a label on a bottle
//     tilt      the plate turns away from the viewer
//     time      the modules move: one moment of a wave rolling through them
// Regions: "all", "corner" (the lower right, away from the finders),
// "center", "finder" (the upper left finder) and "edge" (a band along the
// bottom).

import { hexRGB } from "./splats.js";

export const KINDS = [
  { id: "scratch", label: "Scratch", printed: true },
  { id: "sticker", label: "Sticker", printed: true },
  { id: "tear", label: "Tear", printed: true },
  { id: "burn", label: "Burn", printed: true },
  { id: "smudge", label: "Smudge", printed: true },
  { id: "blur", label: "Blur" },
  { id: "shrink", label: "Shrink" },
  { id: "grow", label: "Grow" },
  { id: "jitter", label: "Jitter" },
  { id: "fade", label: "Fade" },
  { id: "color", label: "Color drift" },
  { id: "curve", label: "Curve" },
  { id: "tilt", label: "Tilt" },
  { id: "time", label: "Move in time" },
];
export const REGIONS = [
  { id: "all", label: "Everywhere" },
  { id: "corner", label: "A corner" },
  { id: "center", label: "The middle" },
  { id: "finder", label: "A finder" },
  { id: "edge", label: "The bottom edge" },
];
export const STICKER = hexRGB("#f2d064");
export const CHAR = [0.13, 0.08, 0.05];
export const SMUDGE = [0.32, 0.32, 0.34];
export const DRIFT = [0.98, 0.64, 0.46];

export function rng(seed) {
  let s = (seed >>> 0) * 2654435761 + 12345 || 1;
  s >>>= 0;
  return () => {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; // prettier-ignore
const clamp01 = (x) => Math.min(1, Math.max(0, x));

// A region's box in code units ([x0, y0, x1, y1]; y up), for a code of
// `size` modules.
export function regionBox(region, size) {
  const e = size / 2;
  switch (region) {
    case "corner":
      return [e - size * 0.42, -e, e, -e + size * 0.42];
    case "center":
      return [-size * 0.22, -size * 0.22, size * 0.22, size * 0.22];
    case "finder":
      return [-e, e - 8, -e + 8, e];
    case "edge":
      return [-e, -e, e, -e + size * 0.2];
    default:
      return [-e, -e, e, e];
  }
}
const inBox = (b, x, y) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];

// The corner a tear or a burn starts from: the finder's (upper left) when
// the region is "finder", else the lower right.
const cornerOf = (region, size) => (region === "finder" ? [-size / 2, size / 2] : [size / 2, -size / 2]); // prettier-ignore

// Geometry: where a point of the flat code goes under the damages that move
// the plate (curve, tilt) and the modules (time). p in code units.
export function warpPoint(p, damages, size, mod = -1, width = size + 8) {
  let [x, y, z] = p;
  for (const d of damages) {
    const a = clamp01(d.amount);
    if (!a) continue;
    if (d.kind === "time" && mod >= 0) {
      const [dx, dy, dz] = timeOffset(mod, size, a, d.t ?? 0.3);
      x += dx;
      y += dy;
      z += dz;
    }
  }
  for (const d of damages) {
    const a = clamp01(d.amount);
    if (!a) continue;
    if (d.kind === "curve") {
      // Around a vertical cylinder behind the code: the whole width spans
      // up to 200 degrees.
      const R = width / (a * (200 / 180) * Math.PI);
      const th = x / R;
      [x, z] = [(R + z) * Math.sin(th), (R + z) * Math.cos(th) - R];
    } else if (d.kind === "tilt") {
      const th = (a * 80 * Math.PI) / 180;
      [x, z] = [x * Math.cos(th) + z * Math.sin(th), -x * Math.sin(th) + z * Math.cos(th)];
    }
  }
  return [x, y, z];
}

// The turn (about y) the plate has at a point, for the splats' own rotation.
function warpTurn(x, damages, width) {
  let th = 0;
  for (const d of damages) {
    const a = clamp01(d.amount);
    if (!a) continue;
    if (d.kind === "curve") th += x / (width / (a * (200 / 180) * Math.PI));
    else if (d.kind === "tilt") th += (a * 80 * Math.PI) / 180;
  }
  return th;
}

// One moment of the wave that moves the modules ("time"): each module moves
// as a solid piece, sideways and toward the viewer (never back into the
// sheet behind it, which would hide it: the study's finding of October 5).
export function timeOffset(mod, size, amount, t) {
  const r = Math.floor(mod / size);
  const c = mod % size;
  const ph = 2 * Math.PI * (t - ((r + c) / (2 * size)) * 2);
  const A = amount * 0.6;
  return [
    A * 0.6 * Math.sin(ph),
    A * 0.6 * Math.cos(ph * 0.7 + 1),
    A * 0.5 * (1 + Math.sin(ph + 0.8)),
  ];
}

const quatY = (th) => [0, Math.sin(th / 2), 0, Math.cos(th / 2)];
const qmul = (a, b) => [
  a[3] * b[0] + b[3] * a[0] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] + b[3] * a[1] + a[2] * b[0] - a[0] * b[2],
  a[3] * b[2] + b[3] * a[2] + a[0] * b[1] - a[1] * b[0],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
];

// Applies the damages to the splats (a new list; the input is untouched).
// Returns { splats, pieces }: pieces holds what came off (the torn corner,
// the burned part), each { kind, splats }, for the toy to drop away.
// ctx: { size, fg, bg } (the code's colors, for the color drift).
export function applyDamage(splats, damages, { size, width = size + 8 }) {
  let list = splats.map((s) => ({ ...s, p: s.p.slice(), scales: s.scales.slice(), color: s.color.slice() })); // prettier-ignore
  const pieces = [];
  const extra = [];
  for (const d of damages) {
    const a = clamp01(d.amount);
    if (!a) continue;
    const r = rng((d.seed ?? 1) * 7919 + d.kind.length * 31);
    const box = regionBox(d.region || "all", size);
    const inR = (s) => inBox(box, s.p[0], s.p[1]);
    switch (d.kind) {
      case "scratch": {
        // Straight scrapes across the region, each about 0.35 modules wide.
        const n = Math.max(1, Math.round(a * 12));
        const lines = [];
        for (let i = 0; i < n; i++) {
          const x0 = box[0] + r() * (box[2] - box[0]);
          const y0 = box[1] + r() * (box[3] - box[1]);
          const ang = r() * Math.PI;
          lines.push([
            x0,
            y0,
            Math.cos(ang),
            Math.sin(ang),
            (box[2] - box[0]) * (0.25 + 0.4 * r()),
          ]);
        }
        for (const s of list) {
          if (!s.dark || !inR(s)) continue;
          for (const [x0, y0, ux, uy, half] of lines) {
            const dx = s.p[0] - x0;
            const dy = s.p[1] - y0;
            const along = dx * ux + dy * uy;
            const across = Math.abs(-dx * uy + dy * ux);
            if (Math.abs(along) < half && across < 0.18) {
              s.color = mixc(s.color, [0.93, 0.92, 0.9], 0.9);
              s.scratched = true;
              break;
            }
          }
        }
        break;
      }
      case "sticker": {
        // A square label, its side up to 60% of the code, over the region.
        const side = a * 0.6 * size;
        const cx = (box[0] + box[2]) / 2 + (r() - 0.5) * 0.2 * (box[2] - box[0]);
        const cy = (box[1] + box[3]) / 2 + (r() - 0.5) * 0.2 * (box[3] - box[1]);
        const per = 2;
        const nx = Math.max(1, Math.round(side * per));
        const sp = side / nx;
        const tilt = (r() - 0.5) * 0.3;
        const [c, s_] = [Math.cos(tilt), Math.sin(tilt)];
        for (let layer = 0; layer < 2; layer++)
          for (let j = 0; j < nx - layer; j++)
            for (let i = 0; i < nx - layer; i++) {
              const u = (i + 0.5 + layer * 0.5) * sp - side / 2;
              const v = (j + 0.5 + layer * 0.5) * sp - side / 2;
              extra.push({ p: [cx + u * c - v * s_, cy + u * s_ + v * c, 0.06], scales: [0.55 * sp, 0.55 * sp, 0.01], quat: [0, 0, Math.sin(tilt / 2), Math.cos(tilt / 2)], color: STICKER.slice(), opacity: 1, mod: -2, dark: 0, piece: "sticker" }); // prettier-ignore
            }
        break;
      }
      case "tear":
      case "burn": {
        const [kx, ky] = cornerOf(d.region, size);
        // The quiet zone's corner goes with it.
        const qx = kx + Math.sign(kx) * 4;
        const qy = ky + Math.sign(ky) * 4;
        const R = a * 0.75 * size;
        const keep = [];
        const off = [];
        for (const s of list) {
          const dx = Math.abs(s.p[0] - qx);
          const dy = Math.abs(s.p[1] - qy);
          if (d.kind === "tear") {
            // A ragged diagonal edge.
            const edge =
              R + 4 + 0.9 * Math.sin((dx - dy) * 1.7 + d.seed) + 0.5 * Math.sin((dx - dy) * 4.3);
            (dx + dy < edge ? off : keep).push(s);
          } else {
            const dist = Math.hypot(dx, dy) - 4;
            const ragged = R * (1 + 0.08 * Math.sin(Math.atan2(dy, dx) * 9 + d.seed));
            if (dist < ragged * 0.72) off.push(s);
            else {
              if (dist < ragged) {
                const k = (ragged - dist) / (ragged * 0.28);
                s.color = mixc(s.color, CHAR, clamp01(k * 1.1));
                s.charred = true;
              }
              keep.push(s);
            }
          }
        }
        list = keep;
        pieces.push({ kind: d.kind, splats: off });
        break;
      }
      case "smudge": {
        const cx = (box[0] + box[2]) / 2 + (r() - 0.5) * 0.3 * (box[2] - box[0]);
        const cy = (box[1] + box[3]) / 2 + (r() - 0.5) * 0.3 * (box[3] - box[1]);
        const rx = a * 0.42 * size;
        const ry = a * 0.24 * size;
        const ang = r() * Math.PI;
        const [c, s_] = [Math.cos(ang), Math.sin(ang)];
        for (const s of list) {
          const dx = s.p[0] - cx;
          const dy = s.p[1] - cy;
          const u = (dx * c + dy * s_) / rx;
          const v = (-dx * s_ + dy * c) / ry;
          const q = u * u + v * v;
          if (q < 1) s.color = mixc(s.color, SMUDGE, 0.8 * (1 - q * q));
        }
        break;
      }
      case "blur":
        for (const s of list) if (s.mod >= 0 && inR(s)) (s.scales[0] *= 1 + 3 * a), (s.scales[1] *= 1 + 3 * a); // prettier-ignore
        break;
      case "shrink":
        for (const s of list) if (s.mod >= 0 && inR(s)) (s.scales[0] *= 1 - 0.85 * a), (s.scales[1] *= 1 - 0.85 * a); // prettier-ignore
        break;
      case "grow":
        for (const s of list) if (s.mod >= 0 && s.dark && inR(s)) (s.scales[0] *= 1 + 2.5 * a), (s.scales[1] *= 1 + 2.5 * a); // prettier-ignore
        break;
      case "jitter":
        for (const s of list)
          if (s.mod >= 0 && inR(s)) {
            s.p[0] += gauss(r) * a * 0.6;
            s.p[1] += gauss(r) * a * 0.6;
          }
        break;
      case "fade":
        for (const s of list) if (s.mod >= 0 && inR(s)) s.opacity *= 1 - a;
        break;
      case "color":
        for (const s of list) if (s.dark && inR(s)) s.color = mixc(s.color, DRIFT, a);
        break;
      default:
        break; // curve, tilt and time: geometry, below
    }
  }
  list = list.concat(extra);
  // Geometry last: the modules' motion, then the plate's bend and turn.
  const geo = damages.filter((d) => ["curve", "tilt", "time"].includes(d.kind) && clamp01(d.amount) > 0); // prettier-ignore
  if (geo.length) {
    const move = (s) => {
      const x0 = s.p[0];
      s.p = warpPoint(s.p, geo, size, s.mod, width);
      const th = warpTurn(x0, geo, width);
      if (th) s.quat = qmul(quatY(th), s.quat);
    };
    list.forEach(move);
    for (const pc of pieces) pc.splats.forEach(move);
  }
  return { splats: list, pieces };
}

// A short line saying what a damage does at its amount, from the numbers
// the code above uses.
export function describeDamage(d, size) {
  const a = clamp01(d.amount);
  const pct = (x) => `${Math.round(x * 100)}%`;
  switch (d.kind) {
    case "scratch":
      return `${Math.max(1, Math.round(a * 12))} scratches`;
    case "sticker":
      return `a sticker ${(a * 0.6 * size).toFixed(1)} modules wide`;
    case "tear":
      return `a corner torn off, ${(a * 0.75 * size).toFixed(1)} modules in`;
    case "burn":
      return `a burn ${(a * 0.75 * size).toFixed(1)} modules across`;
    case "smudge":
      return `a smudge ${(a * 0.84 * size).toFixed(1)} modules long`;
    case "blur":
      return `splats ${(1 + 3 * a).toFixed(2)} times as wide`;
    case "shrink":
      return `splats ${pct(1 - 0.85 * a)} of their size`;
    case "grow":
      return `dark splats ${(1 + 2.5 * a).toFixed(2)} times their size`;
    case "jitter":
      return `splats moved ${(a * 0.6).toFixed(2)} modules (typical)`;
    case "fade":
      return `splats ${pct(1 - a)} opaque`;
    case "color":
      return `the code's color ${pct(a)} of the way to pale orange`;
    case "curve":
      return `bent through ${Math.round(a * 200)}°`;
    case "tilt":
      return `turned ${Math.round(a * 80)}° away`;
    case "time":
      return `modules moving up to ${(a * 0.6).toFixed(2)} modules`;
    default:
      return "";
  }
}
