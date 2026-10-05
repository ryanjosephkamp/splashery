// Pack: imaging (lane Imaging, October 5, 2026). How we see inside things,
// behind the labs switch:
//
//   airport-xray     bags ride a belt through a scanner; its screen builds
//                    each bag's X-ray picture in the scanner's colors
//   how-ct           a CT ring sweeps along a nautilus shell and builds its
//                    volume slice by slice; then a drag cuts into it
//   walnut-ct        a real CT scan of a walnut (CWI, CC BY 4.0) as volume
//                    splats: cut it, or show only its dense shell
//
// The volume toys use the engine's volume kind (src/effects.js, KINDS.volume)
// and out.volume: a cutting plane and a density window.

import { mix, shade, smoothstep, clamp, vec } from "../kit.js";
import { evenBox, evenCylinder, evenRoundBox } from "./even.js";

// ---- Shared ------------------------------------------------------------------------------

// Soft studio light baked into the colors (splats are unlit), as the other
// kit toys do: a key light from the upper left and a little gloss.
const LIGHT = vec.unit([-0.35, 0.8, 0.5]);
const VIEW = vec.unit([0.5, 0.28, 0.82]);
const HALF = vec.unit(vec.add(LIGHT, VIEW));
function lit(col, n, gloss = 0.2) {
  const d = vec.dot(n, LIGHT);
  const out = shade(col, 0.66 + 0.38 * Math.max(0, d) + 0.06 * d);
  return gloss ? mix(out, "#ffffff", gloss * Math.max(0, vec.dot(n, HALF)) ** 24) : out;
}

const ease = (x) => smoothstep(0, 1, clamp(x, 0, 1));
const span = (x, a, b) => clamp((x - a) / (b - a), 0, 1);

// A flat picture of W x H pixels, drawn as one flat splat per pixel on a
// screen: its center, its right and up directions (unit) and its width.
// pixel(i, j) gives [r, g, b] (0..1) or null; extra fields go on each splat
// (part, kind, params, channel).
function screenSplats(k, { W, H, center, right, up, width, share, pixel, extra }) {
  const pitch = width / W;
  const n = vec.unit(vec.cross(right, up));
  const q = basisQuat(right, up, n);
  const s = pitch * 0.62;
  k.cloud({ share, jitter: 0 }, (rand, idx) => {
    const i = idx % W;
    const j = Math.floor(idx / W);
    if (j >= H) return null;
    const col = pixel(i, j);
    if (!col) return null;
    const x = (i + 0.5 - W / 2) * pitch;
    const y = (j + 0.5 - H / 2) * pitch;
    const p = vec.add(center, vec.add(vec.mul(right, x), vec.mul(up, y)));
    return { p, color: col, scales: [s, s, s * 0.08], quat: q, opacity: 1, pattern: false, ...(extra ? extra(i, j, p) : {}) }; // prettier-ignore
  });
  return W * H;
}

// The rotation that takes x, y and z to the given unit axes.
function basisQuat(x, y, z) {
  const [m00, m10, m20] = x;
  const [m01, m11, m21] = y;
  const [m02, m12, m22] = z;
  const tr = m00 + m11 + m22;
  let qx, qy, qz, qw;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    qw = 0.25 * s;
    qx = (m21 - m12) / s;
    qy = (m02 - m20) / s;
    qz = (m10 - m01) / s;
  } else if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    qw = (m21 - m12) / s;
    qx = 0.25 * s;
    qy = (m01 + m10) / s;
    qz = (m02 + m20) / s;
  } else if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    qw = (m02 - m20) / s;
    qx = (m01 + m10) / s;
    qy = 0.25 * s;
    qz = (m12 + m21) / s;
  } else {
    const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
    qw = (m10 - m01) / s;
    qx = (m02 + m20) / s;
    qy = (m12 + m21) / s;
    qz = 0.25 * s;
  }
  return [qx, qy, qz, qw];
}

// ---- Airport X-ray scanner ---------------------------------------------------------------

// The scanner's colors (dual-energy X-ray): organic matter orange, mixed and
// light inorganic matter green, metal blue, and anything too dense to see
// through black, on a pale background.
const XR_BG = [0.93, 0.95, 0.97];
const XR_ORG = [0.93, 0.55, 0.16];
const XR_INO = [0.24, 0.66, 0.3];
const XR_MET = [0.16, 0.36, 0.86];

// Each bag's contents, seen from above, in bag coordinates (x along the belt,
// z across it, the bag about 0.9 by 0.6). A shape: { s: "rect" | "ell" |
// "ring" | "line", m: 0 organic | 1 inorganic | 2 metal, t: thickness (how
// much it stops), ... }. rect and ell: c [x, z], w, h, a (angle, radians),
// r (corner radius); ring: c, w, h, b (band width); line: pts, b (width).
// fold: a fabric's folds (organic thickness that varies).
const BAGS = [
  {
    name: "Suitcase",
    items: [
      { s: "rect", m: 0, t: 0.25, c: [0, 0], w: 0.84, h: 0.56, r: 0.06 }, // the shell
      { s: "ring", m: 2, t: 0.9, c: [0, 0], w: 0.8, h: 0.52, b: 0.012, r: 0.05 }, // its zip
      {
        s: "line",
        m: 2,
        t: 1.4,
        pts: [
          [-0.4, -0.2],
          [0.33, -0.2],
        ],
        b: 0.022,
      }, // the handle's tubes
      {
        s: "line",
        m: 2,
        t: 1.4,
        pts: [
          [-0.4, 0.2],
          [0.33, 0.2],
        ],
        b: 0.022,
      },
      { s: "rect", m: 2, t: 1.2, c: [-0.39, 0], w: 0.04, h: 0.44, r: 0.01 },
      { s: "ell", m: 1, t: 1.6, c: [0.36, -0.22], w: 0.08, h: 0.08 }, // wheels
      { s: "ell", m: 1, t: 1.6, c: [0.36, 0.22], w: 0.08, h: 0.08 },
      { s: "rect", m: 0, t: 0.9, c: [-0.12, 0.05], w: 0.5, h: 0.38, r: 0.05, fold: 1 }, // folded clothes
      { s: "rect", m: 0, t: 0.8, c: [0.2, -0.12], w: 0.26, h: 0.12, r: 0.05, a: 0.2 }, // shoes
      { s: "rect", m: 0, t: 0.8, c: [0.22, 0.04], w: 0.26, h: 0.12, r: 0.05, a: -0.1 },
      { s: "rect", m: 0, t: 1.1, c: [0.24, 0.18], w: 0.12, h: 0.05, r: 0.02 }, // a bottle of shampoo
      { s: "ell", m: 1, t: 0.6, c: [0.34, 0.17], w: 0.03, h: 0.04 }, // its cap
      { s: "rect", m: 1, t: 0.9, c: [-0.3, -0.16], w: 0.16, h: 0.07, r: 0.03, a: 0.5 }, // a hair dryer
      { s: "ell", m: 1, t: 1.0, c: [-0.22, -0.2], w: 0.1, h: 0.1 },
      { s: "ell", m: 2, t: 1.4, c: [-0.22, -0.2], w: 0.05, h: 0.05 }, // its motor
      {
        s: "line",
        m: 2,
        t: 0.7,
        pts: [
          [-0.36, -0.12],
          [-0.3, -0.04],
          [-0.36, 0.04],
          [-0.3, 0.12],
        ],
        b: 0.008,
      }, // its cord
    ],
  },
  {
    name: "Backpack",
    items: [
      { s: "rect", m: 0, t: 0.07, c: [0, 0], w: 0.9, h: 0.62, r: 0.03 }, // the plastic tray
      { s: "rect", m: 0, t: 0.3, c: [0, 0], w: 0.7, h: 0.46, r: 0.12 }, // the pack
      {
        s: "line",
        m: 2,
        t: 0.8,
        pts: [
          [-0.3, -0.2],
          [0.3, -0.2],
        ],
        b: 0.01,
      }, // zips
      {
        s: "line",
        m: 2,
        t: 0.8,
        pts: [
          [-0.3, 0.12],
          [0.3, 0.12],
        ],
        b: 0.01,
      },
      { s: "rect", m: 1, t: 0.7, c: [-0.06, -0.02], w: 0.5, h: 0.34, r: 0.02 }, // a laptop
      { s: "rect", m: 2, t: 0.6, c: [-0.06, -0.02], w: 0.42, h: 0.26, r: 0.01 }, // its board
      { s: "rect", m: 2, t: 2.6, c: [-0.06, 0.1], w: 0.36, h: 0.07, r: 0.01 }, // its battery
      { s: "rect", m: 1, t: 1.3, c: [0.26, 0.12], w: 0.1, h: 0.08, r: 0.015 }, // a charger
      {
        s: "line",
        m: 2,
        t: 0.8,
        pts: [
          [0.21, 0.12],
          [0.16, 0.18],
          [0.24, 0.2],
          [0.3, 0.16],
        ],
        b: 0.008,
      },
      { s: "rect", m: 0, t: 0.9, c: [0.2, -0.1], w: 0.16, h: 0.22, r: 0.01 }, // a book
      { s: "ell", m: 0, t: 1.4, c: [0.28, 0.0], w: 0.11, h: 0.11 }, // an apple
      { s: "ring", m: 2, t: 1.0, c: [-0.24, 0.17], w: 0.16, h: 0.14, b: 0.012 }, // headphones
      { s: "ell", m: 1, t: 1.4, c: [-0.31, 0.17], w: 0.05, h: 0.06 },
      { s: "ell", m: 1, t: 1.4, c: [-0.17, 0.17], w: 0.05, h: 0.06 },
      { s: "ring", m: 2, t: 2.0, c: [0.3, -0.2], w: 0.05, h: 0.05, b: 0.008 }, // keys
      {
        s: "line",
        m: 2,
        t: 2.2,
        pts: [
          [0.32, -0.19],
          [0.37, -0.16],
        ],
        b: 0.012,
      },
      {
        s: "line",
        m: 2,
        t: 2.2,
        pts: [
          [0.31, -0.18],
          [0.33, -0.12],
        ],
        b: 0.012,
      },
    ],
  },
  {
    name: "Box",
    items: [
      { s: "rect", m: 0, t: 0.25, c: [0, 0], w: 0.8, h: 0.55, r: 0.0 }, // cardboard
      {
        s: "line",
        m: 0,
        t: 0.15,
        pts: [
          [-0.4, 0],
          [0.4, 0],
        ],
        b: 0.06,
      }, // its tape
      { s: "ell", m: 1, t: 1.1, c: [-0.12, 0.02], w: 0.32, h: 0.3 }, // a teapot
      { s: "ell", m: 1, t: 0.6, c: [-0.12, 0.02], w: 0.24, h: 0.22 },
      { s: "rect", m: 1, t: 1.0, c: [0.07, 0.04], w: 0.12, h: 0.035, r: 0.015, a: -0.3 }, // its spout
      { s: "ring", m: 1, t: 1.0, c: [-0.31, 0.02], w: 0.1, h: 0.12, b: 0.025 }, // its handle
      { s: "ring", m: 1, t: 1.3, c: [0.25, -0.14], w: 0.14, h: 0.14, b: 0.025 }, // cups
      { s: "ring", m: 1, t: 1.3, c: [0.25, 0.12], w: 0.14, h: 0.14, b: 0.025 },
      { s: "rect", m: 0, t: 0.35, c: [0.1, -0.02], w: 0.6, h: 0.48, r: 0.04, fold: 1 }, // paper packing
      { s: "rect", m: 1, t: 0.9, c: [-0.16, -0.2], w: 0.12, h: 0.08, r: 0.01 }, // a wind-up robot
      { s: "ell", m: 2, t: 1.6, c: [-0.19, -0.2], w: 0.04, h: 0.04 }, // its gears
      { s: "ell", m: 2, t: 1.6, c: [-0.13, -0.2], w: 0.035, h: 0.035 },
      {
        s: "line",
        m: 2,
        t: 1.6,
        pts: [
          [-0.08, -0.2],
          [-0.03, -0.2],
        ],
        b: 0.01,
      }, // its key
    ],
  },
  {
    name: "Toolbox",
    items: [
      { s: "rect", m: 1, t: 0.35, c: [0, 0], w: 0.84, h: 0.4, r: 0.02 }, // the box
      {
        s: "line",
        m: 2,
        t: 1.5,
        pts: [
          [-0.28, 0],
          [0.28, 0],
        ],
        b: 0.025,
      }, // its handle
      { s: "rect", m: 2, t: 1.6, c: [-0.36, 0], w: 0.03, h: 0.08 }, // its latches
      { s: "rect", m: 2, t: 1.6, c: [0.36, 0], w: 0.03, h: 0.08 },
      {
        s: "line",
        m: 2,
        t: 3.2,
        pts: [
          [-0.3, -0.12],
          [0.12, -0.12],
        ],
        b: 0.03,
      }, // a wrench
      { s: "ring", m: 2, t: 3.2, c: [-0.32, -0.12], w: 0.07, h: 0.07, b: 0.02 },
      { s: "rect", m: 2, t: 3.4, c: [0.15, -0.12], w: 0.06, h: 0.06, r: 0.01 },
      {
        s: "line",
        m: 0,
        t: 1.3,
        pts: [
          [-0.3, 0.1],
          [0.06, 0.1],
        ],
        b: 0.035,
      }, // a hammer's handle
      { s: "rect", m: 2, t: 4.0, c: [0.1, 0.1], w: 0.05, h: 0.16, r: 0.01 }, // its head
      {
        s: "line",
        m: 0,
        t: 1.2,
        pts: [
          [0.18, 0.12],
          [0.26, 0.12],
        ],
        b: 0.035,
      }, // a screwdriver
      {
        s: "line",
        m: 2,
        t: 2.4,
        pts: [
          [0.26, 0.12],
          [0.38, 0.12],
        ],
        b: 0.01,
      },
      { s: "ell", m: 2, t: 1.6, c: [0.26, -0.03], w: 0.09, h: 0.09 }, // a tape measure
      { s: "ell", m: 1, t: 0.8, c: [0.26, -0.03], w: 0.06, h: 0.06 },
      { s: "ell", m: 2, t: 2.5, c: [-0.08, 0.02], w: 0.02, h: 0.02 }, // screws
      { s: "ell", m: 2, t: 2.5, c: [-0.04, -0.03], w: 0.02, h: 0.02 },
      { s: "ell", m: 2, t: 2.5, c: [0.0, 0.03], w: 0.02, h: 0.02 },
      { s: "ell", m: 2, t: 2.5, c: [0.03, -0.01], w: 0.02, h: 0.02 },
    ],
  },
];

// How much of one shape lies over the point [x, z] (0..1, soft at the edge).
function cover(sh, x, z, e) {
  if (sh.s === "line") {
    let d = Infinity;
    for (let i = 0; i + 1 < sh.pts.length; i++) {
      const [ax, az] = sh.pts[i];
      const [bx, bz] = sh.pts[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      d = Math.min(d, Math.hypot(x - ax - t * dx, z - az - t * dz));
    }
    return 1 - smoothstep(sh.b / 2 - e, sh.b / 2 + e, d);
  }
  const a = sh.a || 0;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const lx = (x - sh.c[0]) * ca + (z - sh.c[1]) * sa;
  const lz = -(x - sh.c[0]) * sa + (z - sh.c[1]) * ca;
  const hw = sh.w / 2;
  const hh = sh.h / 2;
  if (sh.s === "ell" || (sh.s === "ring" && !sh.r)) {
    // Distance to the ellipse, roughly (in units of its size).
    const r = Math.hypot(lx / hw, lz / hh);
    const d = (r - 1) * Math.min(hw, hh);
    if (sh.s === "ell") return 1 - smoothstep(-e, e, d);
    return 1 - smoothstep(sh.b / 2 - e, sh.b / 2 + e, Math.abs(d + sh.b / 2));
  }
  // A rounded rectangle's signed distance.
  const r = Math.min(sh.r || 0, hw, hh);
  const qx = Math.abs(lx) - hw + r;
  const qz = Math.abs(lz) - hh + r;
  const d = Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - r;
  if (sh.s === "rect") return 1 - smoothstep(-e, e, d);
  return 1 - smoothstep(sh.b / 2 - e, sh.b / 2 + e, Math.abs(d + sh.b / 2));
}

// One bag's X-ray picture: W x H colors over the bag's footprint (a window
// `win` wide, centered), built from how much organic, inorganic and metal
// matter each ray crosses.
export function xrayPicture(bag, W, H, win, noise) {
  const out = [];
  const pitch = win / W;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = (i + 0.5 - W / 2) * pitch;
      const z = -(j + 0.5 - H / 2) * pitch; // the far side at the top
      const m = [0, 0, 0];
      for (const sh of bag.items) {
        const c = cover(sh, x, z, pitch * 0.6);
        if (c <= 0) continue;
        let t = sh.t;
        if (sh.fold) t *= 0.55 + 0.9 * Math.abs(noise(x * 9, z * 9, 3.1));
        m[sh.m] += c * t;
      }
      out.push(xrayColor(m));
    }
  }
  return out;
}

// The scanner's color for the matter one ray crosses: the hue from the mix
// (its effective atomic number), darker the more it stops, black when it
// stops nearly everything.
export function xrayColor([o, n, mt]) {
  const T = o + n + mt;
  if (T < 0.02) return XR_BG.slice();
  const z = (n + 2 * mt) / T; // 0 organic .. 2 metal
  const wo = Math.max(0, 1 - Math.abs(z) * 1.6);
  const wn = Math.max(0, 1 - Math.abs(z - 1) * 1.6);
  const wm = Math.max(0, 1 - Math.abs(z - 2) * 1.6);
  const ws = wo + wn + wm || 1;
  const hue = [0, 1, 2].map((k) => (XR_ORG[k] * wo + XR_INO[k] * wn + XR_MET[k] * wm) / ws);
  const a = 1 - Math.exp(-T * 2.2);
  const dark = Math.exp(-Math.max(0, T - 1.3) * 0.75);
  return [0, 1, 2].map((k) => (XR_BG[k] * (1 - a) + hue[k] * a) * (0.35 + 0.65 * dark));
}

const XR = {
  belt: 0.5, // the belt's top
  wait: -1.45, // where a bag waits (its center)
  out: 1.45, // where it stops on the far side
  tunnel: 0.75, // the tunnel's half length
  stripe: 0.116, // the belt's ribs (2.9 / 25, so a ride ends where it began)
  screen: { center: [0, 2.32, 0.18], w: 1.72, h: 1.08, tilt: 12 },
  W: 120,
  H: 80,
  win: 1.0, // the picture's window across the bag, in bag units
};

// Where things are at a moment of the ride (p 0..1) of the bag sent by tap n.
// The bag sent before it waits on the far side; the bag after it is set
// down at the start.
function xrRide(p) {
  const ride = ease(span(p, 0.12, 0.78));
  const x = XR.wait + (XR.out - XR.wait) * ride;
  const scan = span(x, -0.45, 0.45); // the bag's length crossing the beam at x = 0
  return {
    x,
    scan,
    lift: ease(span(p, 0, 0.16)), // the last bag lifted away
    drop: span(p, 0.8, 1), // the next bag set down
    moved: ride * (XR.out - XR.wait),
  };
}

function buildXray(k) {
  const { belt, tunnel } = XR;
  const steel = "#9aa1a8";
  const body = "#d7dade";
  const trim = "#5b6b7c";
  // The belt and its frame.
  k.add(evenBox(4.0, 0.1, 0.92), {
    pos: [0, belt - 0.05, 0],
    color: (c) => lit("#25272b", c.n, 0.1),
    even: true,
    flat: 0.2,
    jitter: 0.01,
  });
  k.add(evenBox(4.1, 0.16, 1.02), {
    pos: [0, belt - 0.18, 0],
    color: (c) => lit(steel, c.n, 0.4),
    even: true,
    flat: 0.2,
    jitter: 0.01,
  });
  for (const x of [-1.85, 1.85])
    for (const z of [-0.42, 0.42])
      k.add(evenCylinder(0.04, 0.04, 0.42, false), {
        pos: [x, 0.05, z],
        color: (c) => lit(steel, c.n, 0.4),
        even: true,
        weight: 1.4,
      });
  // The belt's ribs, moving with it (a part).
  const ribs = k.part("ribs");
  k.cloud({ share: 0.025, jitter: 0 }, (rand, i, n) => {
    const row = Math.floor(rand() * 33);
    const x = -1.95 + row * XR.stripe;
    if (x > 1.95 - XR.stripe) return null;
    const z = (rand() - 0.5) * 0.86;
    return { p: [x, belt + 0.003, z], color: "#3a3d42", n: [0, 1, 0], size: 0.6, part: ribs };
  });
  // The scanner's housing: a tunnel with walls in front and behind.
  const H0 = 0.28;
  const top = 1.62;
  const open = 1.18; // the tunnel's top
  const wall = (pos, size, col = body) =>
    k.add(evenBox(...size), {
      pos,
      color: (c) => {
        const base = c.n[1] > 0.5 ? shade(col, 1.04) : col;
        // A dark band along the front.
        const band = c.n[2] > 0.5 && c.p[1] > 0.95 && c.p[1] < 1.02;
        return lit(band ? trim : base, c.n, 0.25);
      },
      even: true,
      flat: 0.2,
      jitter: 0.008,
    });
  wall([0, (open + top) / 2, 0], [2 * tunnel, top - open, 1.36]);
  wall([0, (H0 + top) / 2, 0.6], [2 * tunnel, top - H0, 0.16]);
  wall([0, (H0 + top) / 2, -0.6], [2 * tunnel, top - H0, 0.16]);
  wall([0, (H0 + belt - 0.12) / 2, 0], [2 * tunnel, belt - 0.12 - H0, 1.2]);
  // Its frame around the openings.
  for (const sx of [-1, 1]) {
    k.add(evenBox(0.05, 0.06, 1.0), {
      pos: [sx * (tunnel + 0.01), open + 0.03, 0],
      color: (c) => lit(trim, c.n, 0.3),
      even: true,
    });
  }
  // The lead curtains at each opening, which swing as a bag pushes through.
  for (const [name, sx] of [
    ["curtainIn", -1],
    ["curtainOut", 1],
  ]) {
    const part = k.part(name, { pivot: [sx * (tunnel + 0.02), open, 0], axis: [0, 0, 1] });
    for (let s = 0; s < 7; s++) {
      const z = -0.45 + (s + 0.5) * (0.9 / 7);
      k.add(evenBox(0.012, open - belt - 0.04, 0.12), {
        pos: [sx * (tunnel + 0.02), (open + belt + 0.04) / 2, z],
        color: (c) => lit(s % 2 ? "#3d4148" : "#464b53", c.n, 0.15),
        even: true,
        flat: 0.15,
        weight: 1.2,
        part,
      });
    }
  }
  // The lamp that lights while the scanner sees.
  k.add(evenCylinder(0.07, 0.07, 0.05), {
    pos: [0.55, top + 0.025, 0.45],
    color: (c) => lit("#6b4b1e", c.n, 0.3),
    even: true,
    weight: 2,
  });
  const lamp = k.part("lamp");
  k.add(k.sphere(0.075), {
    pos: [0.55, top + 0.06, 0.45],
    scale: [1, 0.6, 1],
    color: (c) => mix("#ffd27a", "#ff8a1c", c.v),
    part: lamp,
    weight: 3,
    flat: 0.6,
  });
  // The operator's screen on top, tilted toward the viewer.
  const S = XR.screen;
  const tilt = (S.tilt * Math.PI) / 180;
  const up = [0, Math.cos(tilt), -Math.sin(tilt)];
  const right = [1, 0, 0];
  const normal = vec.cross(right, up);
  k.add(evenBox(S.w + 0.12, S.h + 0.12, 0.08), {
    pos: vec.add(S.center, vec.mul(normal, -0.045)),
    rot: [-S.tilt, 0, 0],
    color: (c) => lit("#202326", c.n, 0.35),
    even: true,
    flat: 0.2,
  });
  k.add(evenCylinder(0.05, 0.05, 0.2), {
    pos: [0, top + 0.1, 0.05],
    color: (c) => lit(steel, c.n, 0.4),
    even: true,
    weight: 1.5,
  });
  k.add(evenBox(0.42, 0.04, 0.3), {
    pos: [0, top + 0.02, 0.05],
    color: (c) => lit("#2a2d31", c.n, 0.3),
    even: true,
  });
  // The screen's pale background, under the pictures.
  k.add(evenBox(S.w, S.h, 0.004), {
    pos: vec.add(S.center, vec.mul(normal, -0.004)),
    rot: [-S.tilt, 0, 0],
    color: XR_BG.map((v) => v * 0.97),
    even: true,
    flat: 0.1,
    jitter: 0,
    pattern: false,
  });
  // The pictures, one part each; each builds in as its bag crosses the beam
  // (a fade on channel i % 2, so one picture can show while the next builds).
  const face = vec.add(S.center, vec.mul(normal, 0.004));
  const shareEach = 0.075;
  BAGS.forEach((bag, b) => {
    const pic = xrayPicture(bag, XR.W, XR.H, XR.win, (x, y, z) => k.noise.fbm(x, y, z + b * 7, 3));
    const part = k.part(`pic${b}`);
    screenSplats(k, {
      W: XR.W,
      H: XR.H,
      center: face,
      right,
      up,
      width: S.w,
      share: shareEach,
      pixel: (i, j) => pic[j * XR.W + i],
      // The bag's leading (right) edge crosses the beam first.
      extra: (i) => ({ part, kind: "fade", params: [1 - (i + 0.5) / XR.W, -0.04], channel: b % 2 }),
    });
  });
  // The bags themselves, built at the start of the belt (parts move them).
  BAGS.forEach((bag, b) => buildBag(k, b, k.part(`bag${b}`, { pivot: [XR.wait, belt, 0] })));
  k.reach([-2.1, 0, 0]);
  k.reach([2.1, 0, 0]);
  k.reach([XR.wait, belt + 1.2, 0]);
}

// The bags as they look from outside.
function buildBag(k, b, part) {
  const x0 = XR.wait;
  const y0 = XR.belt;
  const opt = { even: true, flat: 0.2, jitter: 0.01, part };
  if (b === 0) {
    // A hard suitcase lying flat, its handle at the back end.
    k.add(evenRoundBox(0.84, 0.3, 0.56, 0.06), {
      ...opt,
      pos: [x0, y0 + 0.17, 0],
      color: (c) => {
        const rib = Math.abs((((c.p[2] + 0.28) * 9) % 1) - 0.5) < 0.05 && c.n[1] > 0.6;
        const zip = Math.abs(c.p[1] - (y0 + 0.17)) < 0.012 && Math.abs(c.n[1]) < 0.5;
        return lit(zip ? "#1b2233" : rib ? "#24365a" : "#2d4573", c.n, 0.35);
      },
    });
    for (const z of [-0.2, 0.2])
      k.add(evenCylinder(0.035, 0.035, 0.03), {
        ...opt,
        pos: [x0 + 0.36, y0 + 0.02, z],
        rot: [90, 0, 0],
        color: (c) => lit("#151515", c.n, 0.2),
        weight: 3,
      });
    k.add(evenBox(0.05, 0.05, 0.36), {
      ...opt,
      pos: [x0 - 0.44, y0 + 0.2, 0],
      color: (c) => lit("#3c3f44", c.n, 0.4),
      weight: 2,
    });
  } else if (b === 1) {
    // A backpack in a gray tray.
    k.add(evenBox(0.9, 0.012, 0.62), {
      ...opt,
      pos: [x0, y0 + 0.008, 0],
      color: (c) => lit("#8d939b", c.n, 0.3),
    });
    for (const [px, pz, sx, sz] of [
      [0, 0.305, 0.9, 0.012],
      [0, -0.305, 0.9, 0.012],
      [0.445, 0, 0.012, 0.62],
      [-0.445, 0, 0.012, 0.62],
    ])
      k.add(evenBox(sx, 0.1, sz), {
        ...opt,
        pos: [x0 + px, y0 + 0.05, pz],
        color: (c) => lit("#7f868e", c.n, 0.3),
        weight: 1.5,
      });
    k.add(k.ellipsoid(0.36, 0.13, 0.24), {
      ...opt,
      pos: [x0, y0 + 0.13, 0],
      color: (c) => lit(c.p[1] > y0 + 0.2 ? "#4f7340" : "#466737", c.n, 0.15),
      jitter: 0.015,
    });
    k.add(k.ellipsoid(0.18, 0.06, 0.12), {
      ...opt,
      pos: [x0 + 0.08, y0 + 0.22, 0.05],
      color: (c) => lit("#3d5a30", c.n, 0.15),
      weight: 1.3,
    });
  } else if (b === 2) {
    // A cardboard box with tape along its top.
    k.add(evenBox(0.8, 0.36, 0.55), {
      ...opt,
      pos: [x0, y0 + 0.18, 0],
      color: (c) => {
        const tape = c.n[1] > 0.5 && Math.abs(c.p[2]) < 0.03;
        const seam = c.n[1] > 0.5 && Math.abs(c.p[2]) < 0.004;
        return lit(seam ? "#7a5530" : tape ? "#d9c79a" : "#b98a55", c.n, tape ? 0.3 : 0.05);
      },
    });
  } else {
    // A red toolbox with a steel handle.
    k.add(evenBox(0.84, 0.3, 0.4), {
      ...opt,
      pos: [x0, y0 + 0.15, 0],
      color: (c) => {
        const lid = Math.abs(c.p[1] - (y0 + 0.24)) < 0.008 && Math.abs(c.n[1]) < 0.5;
        return lit(lid ? "#6e1b16" : "#b8352c", c.n, 0.35);
      },
    });
    k.add(evenCylinder(0.018, 0.018, 0.56), {
      ...opt,
      pos: [x0, y0 + 0.36, 0],
      rot: [0, 0, 90],
      color: (c) => lit("#b5bcc4", c.n, 0.5),
      weight: 3,
    });
    for (const sx of [-0.28, 0.28])
      k.add(evenBox(0.02, 0.07, 0.02), {
        ...opt,
        pos: [x0 + sx, y0 + 0.32, 0],
        color: (c) => lit("#9aa1a8", c.n, 0.5),
        weight: 3,
      });
    for (const sx of [-0.36, 0.36])
      k.add(evenBox(0.04, 0.06, 0.01), {
        ...opt,
        pos: [x0 + sx, y0 + 0.24, 0.2],
        color: (c) => lit("#c4c9cf", c.n, 0.5),
        weight: 3,
      });
  }
}

function driveXray(t, c, out, info) {
  const n = info.tap?.n ?? 0;
  const B = BAGS.length;
  const cur = n % B; // the bag this tap sends
  const prev = (n + B - 1) % B; // the one already through
  const next = (n + 1) % B; // the one set down next
  const p = 1 - c.send;
  const r = xrRide(p);
  for (let b = 0; b < B; b++) {
    let pd = { visible: 0, offset: [0, 0, 0] };
    if (b === cur) pd = { visible: 1, offset: [r.x - XR.wait, 0, 0] };
    else if (b === prev && r.lift < 1)
      pd = { visible: 1, offset: [XR.out - XR.wait + 0.1 * r.lift, 1.4 * r.lift * r.lift, -0.8 * r.lift] }; // prettier-ignore
    else if (b === next && r.drop > 0) {
      const d = ease(r.drop);
      pd = { visible: 1, offset: [0, 0.7 * (1 - d) ** 2, 0] };
    }
    if (pd.visible && (pd.offset[1] > 1.2 || (b === next && r.drop < 0.08))) pd.visible = 0;
    out.parts[`bag${b}`] = pd;
  }
  // The belt's ribs follow the ride.
  out.parts.ribs = { offset: [r.moved % XR.stripe, 0, 0] };
  // The curtains lift onto the bag as it passes under them, then swing back.
  const curtain = (sx) => {
    const edge = sx * XR.tunnel;
    const under = span(r.x + 0.45 - edge, -0.02, 0.1) * span(edge - (r.x - 0.45), -0.02, 0.1);
    const after = r.x - 0.45 - edge;
    const swing = after > 0 ? 0.25 * Math.exp(-after * 6) * Math.sin(after * 30) : 0;
    return { angle: (1.05 * ease(under) + swing) * (r.x > -1.4 ? 1 : 0) };
  };
  out.parts.curtainIn = curtain(-1);
  out.parts.curtainOut = curtain(1);
  // The pictures: the last bag's until this one reaches the beam, then this
  // one builds in column by column.
  const showing = r.scan > 0 ? cur : prev;
  for (let b = 0; b < B; b++) out.parts[`pic${b}`] = { visible: b === showing ? 1 : 0 };
  const m = [0, 0, 0, 0];
  m[showing % 2] = showing === cur ? r.scan : 1;
  out.morph = m;
  out.parts.lamp = { visible: r.scan > 0 && r.scan < 1 ? 1 : 0 };
  // Sort again where the bags stand, a few times per ride.
  const step = Math.floor(p * 10);
  if (step !== info.data?.xrStep) {
    if (info.data) info.data.xrStep = step;
    out.resortPose = true;
  }
}

// ---- How CT works ------------------------------------------------------------------------

// A chambered nautilus shell, built as a volume (its walls and the septa
// between its chambers) and as its outside (cream with brown flames). The
// shell coils in the x-y plane: a logarithmic spiral r = R0 e^(b (th - th1))
// that grows threefold each turn, its whorl an ellipse (rho across, 1.25 rho
// deep) that wraps the turn before it.
const NAUT = { R0: 0.6, b: Math.log(3) / (2 * Math.PI), th1: 2.35 + 4 * Math.PI, turns: 2.6, rho: 0.56 }; // prettier-ignore
const CT = { x0: -1.35, x1: 1.35, ring: 1.22 };

function nautR(th) {
  return NAUT.R0 * Math.exp(NAUT.b * (th - NAUT.th1));
}
// A point on the whorl at angle th, around its cross-section at angle phi
// (0 outward), at f of the way from its center to its outside (1).
function nautPoint(th, phi, f) {
  const r = nautR(th);
  const rho = NAUT.rho * r;
  const rad = r + Math.cos(phi) * rho * f;
  return [rad * Math.cos(th), rad * Math.sin(th), Math.sin(phi) * rho * 1.25 * f];
}
// Is a point inside the whorl one turn in (so the outer whorl's wall there is
// hidden, wrapped around it)?
function insidePrevWhorl(p, th) {
  const thp = th - 2 * Math.PI;
  if (thp < NAUT.th1 - NAUT.turns * 2 * Math.PI) return false;
  const r = nautR(thp);
  const rho = NAUT.rho * r;
  const rad = Math.hypot(p[0], p[1]);
  return ((rad - r) / rho) ** 2 + (p[2] / (1.25 * rho)) ** 2 < 1;
}

// Septa: one every 1/14 turn, except in the last third of a turn (the body
// chamber), each a wall across the whorl curving toward the aperture.
function nautSepta() {
  const out = [];
  const th0 = NAUT.th1 - NAUT.turns * 2 * Math.PI;
  for (let th = NAUT.th1 - 0.36 * 2 * Math.PI; th > th0 + 0.4; th -= (2 * Math.PI) / 14)
    out.push(th);
  return out;
}

function buildNautilusVolume(k, share, extra = () => ({})) {
  const th0 = NAUT.th1 - NAUT.turns * 2 * Math.PI;
  const septa = nautSepta();
  const wallW = 0.07; // wall thickness, of the whorl's radius
  // Wall area grows with r^2, so th is drawn to match.
  const g = 2 * NAUT.b;
  const drawTh = (u) => Math.log(Math.exp(g * th0) + u * (Math.exp(g * NAUT.th1) - Math.exp(g * th0))) / g; // prettier-ignore
  k.cloud({ share: share * 0.78, jitter: 0.2, size: 0.85 }, (rand) => {
    const th = drawTh(rand());
    const phi = rand() * 2 * Math.PI;
    const f = 1 - wallW * rand();
    const p = nautPoint(th, phi, f);
    if (insidePrevWhorl(p, th)) return null;
    // Nacre inside, a denser porcelain layer outside.
    const d = 0.78 + 0.18 * (1 - (1 - f) / wallW) + 0.04 * rand();
    return { p, color: ctGray(d), kind: "volume", params: [d, 0], ...extra(p, d) };
  });
  // The septa and the siphuncle threading them.
  k.cloud({ share: share * 0.22, jitter: 0.2, size: 0.85 }, (rand) => {
    const th0s = septa[Math.floor(rand() * septa.length)];
    // A disc across the whorl, bowed forward at its middle.
    const a = rand() * 2 * Math.PI;
    const q = Math.sqrt(rand()) * 0.97;
    const bow = 0.22 * (1 - q * q);
    const th = th0s + bow;
    const p = nautPoint(th, a, q);
    if (insidePrevWhorl(p, th)) return null;
    const sip = Math.abs(q) < 0.12;
    const d = sip ? 0.62 : 0.74 + 0.08 * rand();
    return { p, color: ctGray(d), kind: "volume", params: [d, 0], ...extra(p, d) };
  });
}

// A CT's gray scale (bright is dense).
function ctGray(d) {
  const v = clamp(0.08 + 0.95 * d * d, 0, 1);
  return [v, v * 0.99, v * 0.97];
}

// The shell's outside: cream, brown flames across the older whorls, a pearly
// lip at the aperture.
function buildNautilusShell(k, share, opts = {}) {
  const th0 = NAUT.th1 - NAUT.turns * 2 * Math.PI;
  const g = 2 * NAUT.b;
  const drawTh = (u) => Math.log(Math.exp(g * th0) + u * (Math.exp(g * NAUT.th1) - Math.exp(g * th0))) / g; // prettier-ignore
  k.cloud({ share, jitter: 0.25, flat: 0.25 }, (rand) => {
    const th = drawTh(rand());
    const phi = rand() * 2 * Math.PI;
    const p = nautPoint(th, phi, 1);
    if (insidePrevWhorl(p, th)) return null;
    const n = vec.unit(vec.sub(p, nautPoint(th, phi, 0)));
    const age = (NAUT.th1 - th) / (2 * Math.PI); // turns back from the aperture
    const flame = Math.sin(th * 7 + Math.sin(phi * 1.5) * 1.2 + k.noise(p[0] * 4, p[1] * 4, p[2] * 4) * 1.4); // prettier-ignore
    const brown = age > 0.28 && flame > 0.25 && Math.cos(phi) > -0.2 ? smoothstep(0.25, 0.6, flame) * smoothstep(0.28, 0.6, age) : 0; // prettier-ignore
    let col = mix("#efe5cf", "#8a4a24", brown * 0.9);
    if (age < 0.03) col = mix(col, "#d8d0c8", 0.6);
    return { p, n, color: lit(col, n, 0.3), ...(opts.extra ? opts.extra(p) : {}) };
  });
  // The aperture's opening (dark inside the body chamber).
  k.cloud({ share: share * 0.06, jitter: 0.2, flat: 0.2 }, (rand) => {
    const a = rand() * 2 * Math.PI;
    const q = Math.sqrt(rand()) * 0.93;
    const p = nautPoint(NAUT.th1, a, q);
    if (insidePrevWhorl(p, NAUT.th1)) return null;
    const n = [-Math.sin(NAUT.th1), Math.cos(NAUT.th1), 0];
    return {
      p,
      n,
      color: mix("#3a2a20", "#a89f98", q * q * 0.6),
      ...(opts.extra ? opts.extra(p) : {}),
    };
  });
}

// The CT scanner: a gantry ring around the x axis that travels along the
// shell; inside it the X-ray tube and the detector arc turn together, with
// the fan of the beam between them.
function buildCT(k) {
  const R = CT.ring;
  const gantry = k.part("gantry", { pivot: [CT.x0, 0, 0], axis: [1, 0, 0] });
  const spin = k.part("spin", { pivot: [CT.x0, 0, 0], axis: [1, 0, 0] });
  // The gantry: a wide ring, white outside, gray inside.
  k.add(
    k.param(
      (u, v) => {
        const a = u * 2 * Math.PI;
        // Around the ring's cross-section, a rounded rectangle 0.34 wide, 0.2 deep.
        const t = v * 2 * Math.PI;
        const cx = 0.17 * Math.sign(Math.cos(t)) * Math.abs(Math.cos(t)) ** 0.35;
        const cr = 0.11 * Math.sign(Math.sin(t)) * Math.abs(Math.sin(t)) ** 0.35;
        const rr = R + 0.12 + cr;
        return [CT.x0 + cx, rr * Math.cos(a), rr * Math.sin(a)];
      },
      { grid: 160 },
    ),
    {
      color: (c) => {
        const out = Math.hypot(c.p[1], c.p[2]) > R + 0.2;
        const n = vec.unit([0.4 * Math.sign(c.p[0] - CT.x0), c.p[1], c.p[2]]);
        return lit(out ? "#e9ecef" : "#b9c0c8", out ? n : vec.mul(n, -1), 0.35);
      },
      part: gantry,
      even: true,
      flat: 0.25,
      jitter: 0.01,
    },
  );
  // The tube (top) and the detector arc (bottom), on the turning frame.
  k.add(evenBox(0.2, 0.16, 0.26), {
    pos: [CT.x0, R - 0.06, 0],
    color: (c) => lit("#54606c", c.n, 0.3),
    even: true,
    weight: 2,
    part: spin,
  });
  k.add(
    k.param(
      (u, v) => {
        const a = -Math.PI / 2 + (u - 0.5) * 1.3;
        return [CT.x0 + (v - 0.5) * 0.16, (R - 0.04) * Math.sin(a), (R - 0.04) * Math.cos(a)];
      },
      { grid: 64 },
    ),
    {
      color: (c) => {
        const cell = Math.floor(((Math.atan2(c.p[2], -c.p[1]) + 1) * 40) % 2);
        return cell ? "#2c3440" : "#3c4756";
      },
      part: spin,
      weight: 2,
      flat: 0.2,
    },
  );
  // The fan beam: faint orange from the tube's focus to the arc.
  k.cloud({ share: 0.008, jitter: 0.3, size: 0.5 }, (rand) => {
    const a = -Math.PI / 2 + (rand() - 0.5) * 1.3;
    const t = rand();
    const top = [0, R - 0.14, 0];
    const bot = [0, (R - 0.06) * Math.sin(a), (R - 0.06) * Math.cos(a)];
    const p = vec.add(
      [CT.x0 + (rand() - 0.5) * 0.02, 0, 0],
      vec.add(vec.mul(top, 1 - t), vec.mul(bot, t)),
    );
    return { p, color: "#ffb24a", opacity: 0.1 + 0.12 * rand(), part: spin, kind: "fade", params: [0.5, -0.2], channel: 1, pattern: false }; // prettier-ignore
  });
  // The table the shell lies on, which the ring passes over, on a column
  // past the ring's travel.
  k.add(evenBox(3.5, 0.05, 0.5), {
    pos: [0.15, -0.51, 0],
    color: (c) => lit(c.n[1] > 0.5 ? "#c9ced4" : "#8e959d", c.n, 0.35),
    even: true,
    flat: 0.2,
  });
  k.add(evenBox(0.3, 0.9, 0.36), {
    pos: [1.75, -0.98, 0],
    color: (c) => lit("#aeb4bb", c.n, 0.3),
    even: true,
  });
  k.add(evenBox(0.7, 0.06, 0.6), {
    pos: [1.75, -1.45, 0],
    color: (c) => lit("#5a5f66", c.n, 0.3),
    even: true,
  });
}

// Where the ring is (0 before the shell, 1 past it) as the scan runs.
const ctX = (v) => CT.x0 + (CT.x1 - CT.x0) * v;

// The cut a drag moves through the scanned shell: from in front of it (1)
// to behind it (0), along z.
export const ctCut = { at: 1, grab: null, data: null };

function ctPointer(p) {
  return p[1];
}

function buildHowCT(k) {
  // The shell's outside, fading as the ring passes (fade on channel 0).
  buildNautilusShell(k, 0.32, {
    extra: (p) => ({ kind: "fade", params: [clamp((p[0] - CT.x0) / (CT.x1 - CT.x0), 0, 1), 0.03], channel: 0 }), // prettier-ignore
  });
  // The volume that the scan builds behind the ring.
  buildNautilusVolume(k, 0.44);
  buildCT(k);
  for (const x of [CT.x0 - 0.2, CT.x1 + 0.2])
    for (const [y, z] of [
      [1.46, 0],
      [-1.46, 0],
      [0, 1.46],
      [0, -1.46],
    ])
      k.reach([x, y, z]);
}

function driveHowCT(t, c, out, info) {
  const v = ease(c.scan);
  const x = ctX(v);
  out.parts.gantry = { offset: [x - CT.x0, 0, 0] };
  // The tube and detector turn about two turns a second while the ring
  // moves (a real one turns two to four times a second).
  const moving = c.scan > 0.001 && c.scan < 0.999;
  const turn = t * 2 * Math.PI * 1.2;
  out.parts.spin = { offset: [x - CT.x0, 0, 0], angle: moving ? turn : 0 };
  out.morph = [clamp((x - CT.x0) / (CT.x1 - CT.x0), 0, 1), moving ? 1 : 0, 0, 0];
  if (info.data && ctCut.data !== info.data) {
    ctCut.data = info.data;
    ctCut.at = 1;
  }
  // The volume shows behind the ring; once scanned, a drag cuts into it.
  const depth = 1.25 * NAUT.rho * NAUT.R0; // the shell's half depth
  if (v < 0.999) out.volume = { normal: [1, 0, 0], at: x, glow: [0.25, 0.12, 0], glowWidth: 0.05 };
  else if (ctCut.at < 0.999)
    out.volume = { normal: [0, 0, 1], at: -depth + 2 * depth * ctCut.at, glow: [0.14, 0.07, 0], glowWidth: 0.03 }; // prettier-ignore
}

// ---- A real CT scan: a walnut ------------------------------------------------------------

// A walnut scanned with cone-beam X-ray CT at CWI in Amsterdam (Der Sarkissian
// et al. 2019, Zenodo 2686726, CC BY 4.0): its high-quality reconstruction
// (100 µm voxels), averaged to 0.3 mm by tools/img-walnut.mjs.
export const WALNUT = {
  file: "../../assets/toys/walnut-ct/walnut.vol.gz",
  title: "Cone-Beam X-Ray CT Data Collection Designed for Machine Learning: Samples 1-8 (Walnut 1)",
  source: "https://doi.org/10.5281/zenodo.2686726",
  author: "Henri Der Sarkissian, Felix Lucka, Maureen van Eijnatten, Giulia Colacicco, Sophia Bethany Coban, K. Joost Batenburg (CWI)", // prettier-ignore
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  air: 55, // densities at or below this (of 255) are air
  shell: 0.62, // the shell's densities start about here (0..1)
};
let walnutVol = null;
let walnutLoading = null;

// A file of this pack's assets as bytes (fetched in a browser, read from disk
// in Node for the build tools and tests), gunzipped.
async function readGz(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    const zlib = await import("node:zlib");
    const b = zlib.gunzipSync(await fs.readFile(url));
    return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${rel.split("/").pop()}.`);
  const ds = r.body.pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(ds).arrayBuffer());
}

async function loadWalnut() {
  if (walnutVol) return walnutVol;
  walnutLoading ||= readGz(WALNUT.file).then((b) => {
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const tag = String.fromCharCode(b[0], b[1], b[2], b[3]);
    if (tag !== "WCT1") throw new Error("The walnut's volume file is not readable.");
    const [nx, ny, nz] = [dv.getUint16(4, true), dv.getUint16(6, true), dv.getUint16(8, true)];
    walnutVol = { nx, ny, nz, mm: dv.getFloat32(10, true), d: b.subarray(14, 14 + nx * ny * nz) };
    return walnutVol;
  });
  return walnutLoading;
}

// The volume's density at a point in voxel units (trilinear).
function volAt(V, x, y, z) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  if (x0 < 0 || y0 < 0 || z0 < 0 || x0 >= V.nx - 1 || y0 >= V.ny - 1 || z0 >= V.nz - 1) return 0;
  const fx = x - x0;
  const fy = y - y0;
  const fz = z - z0;
  const at = (i, j, k) => V.d[((z0 + k) * V.ny + y0 + j) * V.nx + x0 + i];
  const lx = (j, k) => at(0, j, k) * (1 - fx) + at(1, j, k) * fx;
  const ly = (k) => lx(0, k) * (1 - fy) + lx(1, k) * fy;
  return ly(0) * (1 - fz) + ly(1) * fz;
}

const NEAR = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]; // prettier-ignore

// A volume as volume splats: sampled on a lattice whose pitch (in voxels)
// fits the budget, one round splat per sample that is not air. The scan's
// slices run down the walnut, so voxel z is down (recipe -y).
function buildVolume(k, V, { budget, air, color, rand = Math.random }) {
  let solid = 0;
  for (let i = 0; i < V.d.length; i++) if (V.d[i] > air) solid++;
  const pitch = Math.max(1, Math.cbrt(solid / Math.max(1000, budget * 0.92)));
  const cx = (V.nx - 1) / 2;
  const cy = (V.ny - 1) / 2;
  const cz = (V.nz - 1) / 2;
  const s = pitch * 0.78;
  const pts = [];
  for (let z = 0; z < V.nz - 1; z += pitch)
    for (let y = 0; y < V.ny - 1; y += pitch)
      for (let x = 0; x < V.nx - 1; x += pitch) {
        // A little jitter breaks up the lattice's lines on a cut face.
        const j = pitch * 0.18;
        const px = x + (rand() - 0.5) * j;
        const py = y + (rand() - 0.5) * j;
        const pz = z + (rand() - 0.5) * j;
        const v = volAt(V, px, py, pz);
        if (v <= air) continue;
        // Colored as the densest matter within a voxel, so a surface's
        // partly filled voxels take the color of what they belong to.
        let m = v;
        for (const [dx, dy, dz] of NEAR) m = Math.max(m, volAt(V, px + dx, py + dy, pz + dz));
        pts.push(px - cx, cz - pz, py - cy, v / 255, m / 255);
      }
  const n = pts.length / 5;
  k.cloud({ count: n * (160000 / k.count), jitter: 0 }, (r, i) => {
    if (i >= n) return null;
    const d = pts[i * 5 + 3];
    // Voxels only partly filled (at the surface) are only partly opaque, as
    // a volume renderer draws them, so the outside reads as the shell.
    const a = smoothstep(air / 255, air / 255 + 0.22, d);
    return {
      p: [pts[i * 5], pts[i * 5 + 1], pts[i * 5 + 2]],
      color: color(pts[i * 5 + 4]),
      scales: [s, s, s],
      opacity: 0.15 + 0.85 * a,
      kind: "volume",
      params: [d, 0],
      pattern: false,
    };
  });
  return { n, pitch, half: [cx, cz, cy] };
}

// The CT's gray, or a warm color scale (kernel cream, shell brown).
function walnutColor(style) {
  if (style === "warm")
    return (d) => {
      const t = clamp((d - 0.2) / 0.75, 0, 1);
      return mix(mix("#5a3a22", "#e9d3a6", smoothstep(0.05, 0.35, t)), "#8b5a2b", smoothstep(0.45, 0.75, t)); // prettier-ignore
    };
  return (d) => {
    const v = clamp((d - 0.2) / 0.8, 0, 1);
    const g = 0.18 + 0.82 * v ** 0.9;
    return [g, g, g * 0.98];
  };
}

// A cut a drag moves through a volume (one per toy): at 1 nothing is cut, at
// 0 everything is.
function cutState() {
  return { at: 1, grab: null, data: null };
}
const walnutCut = cutState();
// The cuts by toy (the tests and the clip tools set them).
export const CUTS = { "how-ct": ctCut, "walnut-ct": walnutCut };

const CUT_DIRS = {
  front: { normal: [0, 0, 1], label: "Front to back" },
  top: { normal: [0, 1, 0], label: "Top down" },
  side: { normal: [1, 0, 0], label: "Side to side" },
};

function cutDrag(cut, pointer) {
  return {
    at: () => true,
    plane: "view",
    start(p) {
      cut.grab = { y: pointer(p), at: cut.at };
    },
    move(p) {
      if (!cut.grab) return;
      cut.at = clamp(cut.grab.at + (pointer(p) - cut.grab.y) * 0.6, 0, 1);
    },
    end() {
      cut.grab = null;
    },
  };
}

function driveWalnut(t, c, out, info) {
  const data = info.data;
  if (!data) return;
  if (walnutCut.data !== data) {
    walnutCut.data = data;
    walnutCut.at = 1;
  }
  // The window rises from the air to the shell's densities as Shell only
  // comes on, so the kernel melts away from its thinnest parts first.
  const lo = (WALNUT.air + 1) / 255 + (WALNUT.shell - (WALNUT.air + 1) / 255) * ease(c.dense);
  const dir = CUT_DIRS[data.cut] || CUT_DIRS.front;
  const ext = vec.dot(dir.normal, data.half) * data.mm + 0.02;
  const vol = { window: [lo, 1] };
  if (walnutCut.at < 0.999) {
    vol.normal = dir.normal;
    vol.at = -ext + 2 * ext * walnutCut.at;
    vol.glow = [0.1, 0.07, 0.02];
    vol.glowWidth = 0.6 * data.mm * data.pitch;
  }
  out.volume = vol;
}

// ---- Recipes ------------------------------------------------------------------------------

export const RECIPES = {
  "airport-xray": {
    turntable: false,
    controls: [{ key: "send", label: "Send a bag", type: "pulse", ease: 7 }],
    action: { key: "send", label: "Send the next bag" },
    drive: driveXray,
    build(k) {
      k.data = { xrStep: -1 };
      buildXray(k);
    },
  },
  "how-ct": {
    turntable: false,
    alive: (c) => c.scan > 0.001 && c.scan < 0.999,
    controls: [{ key: "scan", label: "Scan", type: "toggle", ease: 6 }],
    action: { key: "scan", label: "Scan or undo the scan" },
    note: "When it is scanned, drag up or down on the shell to cut into it.",
    drag: {
      at: () => true,
      plane: [0, 0, 1],
      start(p) {
        ctCut.grab = { y: ctPointer(p), at: ctCut.at };
      },
      move(p) {
        if (!ctCut.grab) return;
        ctCut.at = clamp(ctCut.grab.at + (ctPointer(p) - ctCut.grab.y) * 0.6, 0, 1);
      },
      end() {
        ctCut.grab = null;
      },
    },
    drive: driveHowCT,
    build(k) {
      k.data = {};
      buildHowCT(k);
    },
  },
  "walnut-ct": {
    options: [
      {
        key: "cut",
        label: "Cut",
        type: "select",
        default: "front",
        choices: Object.entries(CUT_DIRS).map(([id, d]) => ({ id, label: d.label })),
      },
      {
        key: "colors",
        label: "Colors",
        type: "select",
        default: "gray",
        choices: [
          { id: "gray", label: "CT gray" },
          { id: "warm", label: "Warm" },
        ],
      },
    ],
    controls: [{ key: "dense", label: "Shell only", type: "toggle", ease: 1.6 }],
    action: { key: "dense", label: "Shell only, or the whole walnut" },
    note: "Drag up or down on the walnut to cut into it.",
    drag: cutDrag(walnutCut, (p) => p[1]),
    credits: [
      {
        label: "Walnut",
        title: WALNUT.title,
        source: WALNUT.source,
        author: WALNUT.author,
        license: WALNUT.license,
        licenseUrl: WALNUT.licenseUrl,
      },
    ],
    async prepare() {
      await loadWalnut();
    },
    drive: driveWalnut,
    build(k, o) {
      const V = walnutVol;
      if (!V) throw new Error("The walnut's volume has not loaded.");
      const r = buildVolume(k, V, { budget: k.count, air: WALNUT.air, color: walnutColor(o.colors), rand: k.rand }); // prettier-ignore
      // Recipe units are voxels; the drive works in them too (mm: one voxel).
      k.data = { cut: o.cut, half: r.half, pitch: r.pitch, mm: 1 };
    },
  },
};
