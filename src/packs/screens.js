// Screens (lane Screens): your GIF or video on a screen made of splats, in
// four styles (an old TV, a flat TV, a cinema and a hologram). The picture
// is a picture sheet (k.sheet, method "screen", src/pictures.js): its splats
// take their colors from the video's frames on the GPU, and the video's
// sound follows the site's speaker button.
//
// The set switches on and off (lane Screens r2): a tap anywhere switches it
// on (each style its own way); then a tap on its switch (the old TV's power
// knob, the flat TV's button, the cinema's curtains, the hologram's base)
// switches it off, and a tap anywhere else plays and pauses. The Toy tab's
// button switches it on and off. While it is off, the picture's sheet is
// hidden (nothing of it can show through the dark glass or the curtains),
// a video pauses where it was and a GIF holds its frame. The switching runs
// on the player's clock (info.time), so it also plays when the Toy tab's
// Play button starts the video.

import { mix, shade, clamp, quatAxisAngle } from "../kit.js";
import { evenCylinder, evenTube } from "./even.js";

const TAU = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const keep = (c, size) => ({ c, keep: true, size });
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const win = (x, a, b) => clamp((x - a) / (b - a), 0, 1);
const hash = (i) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Baked light from above, front and right, with a sheen towards the viewer.
const LIGHT = unit([0.4, 0.85, 0.55]);
const VIEW = unit([0.3, 0.3, 0.9]);
const HALF = unit(add(LIGHT, VIEW));
function lit(col, n, { amb = 0.62, dif = 0.45, spec = 0.2, pow = 28 } = {}) {
  const d = Math.max(0, dot(n, LIGHT));
  let c = shade(col, amb + dif * d);
  if (spec > 0) c = mix(c, [1, 1, 1], spec * Math.pow(Math.max(0, dot(n, HALF)), pow));
  return c;
}

// Velvet: deep and soft where it faces you, a pale sheen where the pile
// turns away (the edges of each fold), no gloss.
function velvet(col, n) {
  const d = Math.max(0, dot(n, LIGHT));
  const facing = Math.max(0, dot(n, VIEW));
  const c = shade(col, 0.42 + 0.5 * d);
  return mix(c, shade(col, 1.8), 0.6 * Math.pow(1 - facing, 2));
}

// Polished walnut: a figure of long soft stripes along the board (grain
// runs along x on the front, top and bottom, along z on the sides), a
// little lacquer sheen, no speckle.
function walnut(c, base = "#6c3f22") {
  const [x, y, z] = c.p;
  // Along the grain, and a smooth measure across it that runs on round the
  // cabinet's rounded edges.
  const along = Math.abs(c.n[0]) > 0.7 ? z : x;
  const across = y + z;
  const warp = c.noise(along * 0.8, across * 2, 0.5);
  const b = Math.sin((across + 0.1 * Math.sin(along * 2.1)) * 30 + warp * 2.5);
  const fine = Math.sin((across + 0.02 * warp) * 190);
  const fig = 0.9 + 0.08 * b + 0.03 * fine + 0.04 * c.noise(along * 0.35, across * 4, 2);
  return lit(shade(base, fig), c.n, { amb: 0.64, dif: 0.42, spec: 0.26, pow: 18 });
}

// A surface fn(u, v) -> [x, y, z] whose u side is about `along` long and
// v side `across`, spread evenly for even: true. The kit spreads its even
// points over the unit square, so a long thin surface gets them far apart
// one way and crowded the other (diagonal hatching on a curtain's pleat or
// a thin rim). This cuts the long side into near-square tiles and gives
// each tile its own square of the even points.
function strip(fn, { along, across, normal = null, thick = 0.01, area: known = 0 }) {
  const long = along >= across;
  const g = Math.max(1, Math.round(Math.sqrt(long ? along / across : across / along)));
  const T = g * g;
  // The area, from a grid finer along the long side.
  const [gu, gv] = long ? [16 * g * g, 8] : [8, 16 * g * g];
  let area = known;
  if (!known)
    for (let j = 0; j < gv; j++)
      for (let i = 0; i < gu; i++) {
        const a = fn(i / gu, j / gv);
        const b = fn((i + 1) / gu, j / gv);
        const d = fn(i / gu, (j + 1) / gv);
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
        const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]; // prettier-ignore
        area += Math.hypot(cr[0], cr[1], cr[2]);
      }
  const eps = 1e-4;
  const at = (u, v) => {
    const p = fn(u, v);
    let n;
    if (normal) n = unit(normal(u, v, p));
    else {
      const du = u + eps <= 1 ? fn(u + eps, v) : p;
      const du0 = u + eps <= 1 ? p : fn(u - eps, v);
      const dv = v + eps <= 1 ? fn(u, v + eps) : p;
      const dv0 = v + eps <= 1 ? p : fn(u, v - eps);
      const e1 = [du[0] - du0[0], du[1] - du0[1], du[2] - du0[2]];
      const e2 = [dv[0] - dv0[0], dv[1] - dv0[1], dv[2] - dv0[2]];
      n = unit([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]); // prettier-ignore
    }
    // How far the point is from the surface's border (for thin splats
    // there, so a border doesn't turn fuzzy).
    const edge = Math.min(u * along, (1 - u) * along, v * across, (1 - v) * across);
    return { p, n, u, v, edge };
  };
  return {
    area,
    thick,
    dims: 2,
    sample(rand) {
      return at(rand(), rand());
    },
    sampleEven(a, b) {
      const ci = Math.min(g - 1, Math.floor(a * g));
      const cj = Math.min(g - 1, Math.floor(b * g));
      const t = (cj * g + ci + (a * g - ci)) / T; // along the long side
      const w = b * g - cj; // across it
      return long ? at(t, w) : at(w, t);
    },
  };
}

// A color function whose splats get smaller within `d` of their surface's
// border (down to `min` of their size at it): a crisp edge, not a fuzzy
// one. For shapes made with strip().
function thinEdges(color, d = 0.03, min = 0.55) {
  return (c, ...rest) => {
    const col = typeof color === "function" ? color(c, ...rest) : color;
    const e = c.s?.edge;
    if (col == null || e === undefined || e >= d) return col;
    const f = min + (1 - min) * (e / d);
    if (col && !Array.isArray(col) && typeof col === "object") return { ...col, size: (col.size ?? 1) * f }; // prettier-ignore
    return { c: col, size: f };
  };
}

// A flat rectangle in the XY plane, facing +Z (or -Z), with u, v across it.
function rect(w, h, nz = 1) {
  const n = [0, 0, nz];
  return strip((u, v) => [(u - 0.5) * w, (v - 0.5) * h, 0], { along: w, across: h, normal: () => n, area: w * h }); // prettier-ignore
}

// Inside a rounded rectangle of half sizes hw, hh and corner radius r.
function inRounded(x, y, hw, hh, r) {
  const dx = Math.max(0, Math.abs(x) - (hw - r));
  const dy = Math.max(0, Math.abs(y) - (hh - r));
  return dx * dx + dy * dy <= r * r;
}

// A box with rounded edges, built as its 6 faces, 12 edges and 8 corners,
// each an even surface of its own (one shape for all of them lays its even
// points out in diagonal hatching along the edges). Adds them with `opts`;
// a color function gets the face (0..5 for +X, -X, +Y, -Y, +Z, -Z; -1 on
// the rounded edges and corners) as its second argument.
function softBox(k, sx, sy, sz, r, opts) {
  const h = [sx / 2 - r, sy / 2 - r, sz / 2 - r];
  const color = opts.color;
  const thick = Math.min(sx, sy, sz) / 2;
  const piece = (fn, normal, face, along, across) =>
    k.add(
      along
        ? strip(fn, { along, across, normal, thick })
        : k.param(fn, { grid: 12, normal, thick }),
      {
        ...opts,
        color: typeof color === "function" ? (c) => color(c, face) : color,
      },
    );
  const at = (n, base) => [0, 1, 2].map((i) => base[i] + n[i] * r);
  for (let i = 0; i < 3; i++)
    for (const sg of [1, -1]) {
      const j = (i + 1) % 3;
      const l = (i + 2) % 3;
      const n = [0, 0, 0];
      n[i] = sg;
      piece(
        (u, v) => {
          const p = [0, 0, 0];
          p[i] = sg * (h[i] + r);
          p[j] = (2 * u - 1) * h[j];
          p[l] = (2 * v - 1) * h[l];
          return p;
        },
        () => n,
        i * 2 + (sg > 0 ? 0 : 1),
        Math.max(2 * h[j], 1e-4),
        Math.max(2 * h[l], 1e-4),
      );
    }
  for (let ax = 0; ax < 3; ax++)
    for (const sj of [1, -1])
      for (const sl of [1, -1]) {
        const j = (ax + 1) % 3;
        const l = (ax + 2) % 3;
        const nrm = (u, v) => {
          const n = [0, 0, 0];
          n[j] = sj * Math.cos((v * Math.PI) / 2);
          n[l] = sl * Math.sin((v * Math.PI) / 2);
          return n;
        };
        piece(
          (u, v) => {
            const b = [0, 0, 0];
            b[ax] = (2 * u - 1) * h[ax];
            b[j] = sj * h[j];
            b[l] = sl * h[l];
            return at(nrm(u, v), b);
          },
          nrm,
          -1,
          Math.max(2 * h[ax], 1e-4),
          (Math.PI / 2) * r,
        );
      }
  for (const a of [1, -1])
    for (const b of [1, -1])
      for (const c of [1, -1]) {
        const nrm = (u, v) => {
          const th = (u * Math.PI) / 2;
          const ph = (v * Math.PI) / 2;
          return [
            a * Math.sin(th) * Math.cos(ph),
            b * Math.cos(th),
            c * Math.sin(th) * Math.sin(ph),
          ];
        };
        piece((u, v) => at(nrm(u, v), [a * h[0], b * h[1], c * h[2]]), nrm, -1);
      }
}

// A band round a rounded rectangle (half sizes hw, hh, corner radius r),
// from its edge outward by `width`, facing +Z: an even surface of its own
// (a rect with the middle cut away would leave most of its splats unused).
// It slopes from z0 at the inner edge to z1 at the outer one; u runs round
// it, v across it (0 inside).
function band(k, hw, hh, r, width, z0 = 0, z1 = 0) {
  const sx = hw - r;
  const sy = hh - r;
  const segs = [
    { len: 2 * sy, line: [hw, -sy, 0, 1] }, // right side, going up
    { len: (Math.PI / 2) * r, arc: [sx, sy, 0] },
    { len: 2 * sx, line: [sx, hh, -1, 0] }, // top, going left
    { len: (Math.PI / 2) * r, arc: [-sx, sy, Math.PI / 2] },
    { len: 2 * sy, line: [-hw, sy, 0, -1] },
    { len: (Math.PI / 2) * r, arc: [-sx, -sy, Math.PI] },
    { len: 2 * sx, line: [-sx, -hh, 1, 0] },
    { len: (Math.PI / 2) * r, arc: [sx, -sy, 1.5 * Math.PI] },
  ];
  const L = segs.reduce((a, g) => a + g.len, 0);
  const edge = (u) => {
    let d = u * L;
    for (const g of segs) {
      if (d <= g.len || g === segs[segs.length - 1]) {
        if (g.line) {
          const [x, y, dx, dy] = g.line;
          return { p: [x + dx * d, y + dy * d], n: [dy, -dx] };
        }
        const [cx, cy, a0] = g.arc;
        const a = a0 + (r > 0 ? d / r : 0);
        return { p: [cx + r * Math.cos(a), cy + r * Math.sin(a)], n: [Math.cos(a), Math.sin(a)] };
      }
      d -= g.len;
    }
    return { p: [hw, 0], n: [1, 0] };
  };
  return strip(
    (u, v) => {
      const e = edge(u);
      return [e.p[0] + e.n[0] * v * width, e.p[1] + e.n[1] * v * width, z0 + (z1 - z0) * v];
    },
    { along: L, across: Math.hypot(width, z1 - z0), normal: () => [0, 0, 1] },
  );
}

// ---- Media -----------------------------------------------------------------------------

// The sample: an MP4 where the browser plays H.264, else the WebM copy (the
// test browser, some desktop browsers).
function videoSample() {
  try {
    const v = typeof document !== "undefined" ? document.createElement("video") : null;
    if (v?.canPlayType?.('video/mp4; codecs="avc1.4D401E, mp4a.40.2"')) return "assets/toys/screen/bunny.mp4"; // prettier-ignore
  } catch {
    // (no document in the Node tools)
  }
  return "assets/toys/screen/bunny.webm";
}

// ---- The screen's state ------------------------------------------------------------------

// One toy is shown at a time: whether it is on, since when (on or off),
// the tap count it has seen, and what to play when it comes back on.
// build() starts it switched off (long since, so fully dark).
const SCR = {
  style: "tv",
  on: false,
  at: -1e9,
  tapN: 0,
  fresh: true,
  wasPlaying: false,
  resume: true, // a video plays again when switched back on
  gifPaused: false, // a GIF paused by a tap on the picture
};

// How long each style takes to switch on, and off (s).
const ON_TIME = { tv: 1.5, flat: 1.4, cinema: 1.9, hologram: 1.5 };
const OFF_TIME = { tv: 1.6, flat: 1.0, cinema: 1.9, hologram: 1.0 };

// What a tap picked (info.tap.pick): the set's switch, or anything else.
const PICK_SWITCH = 1;
const PICK_OTHER = 2;

// The Toy tab's button, per style.
const ACTION_LABEL = {
  tv: "Switch on or off",
  flat: "Switch on or off",
  cinema: "Open or close the curtains",
  hologram: "Switch on or off",
};

// The sound each style makes as it switches on and off (played as cues, so
// each style has its own), and the click of play and pause.
const ON_SOUND = {
  tv: [
    { voice: "switch", f: 1800, vol: 0.9 },
    { voice: "zap", at: 0.1, f: 5200, to: 0.9, decay: 0.5, vol: 0.18 },
    { voice: "hum", at: 0.12, f: 60, to: 1.02, decay: 1.6, bright: 0.15, vol: 0.5 },
  ],
  flat: [
    { voice: "click", f: 2400, vol: 0.8 },
    { voice: "tone", at: 0.2, f: "E5", to: 1.5, decay: 1.6, vol: 0.12 },
  ],
  cinema: [
    { voice: "whoosh", f: 260, to: 3, decay: 2.6, vol: 0.7 },
    { voice: "rumble", at: 0.1, f: 70, decay: 1.2, vol: 0.25 },
  ],
  hologram: [
    { voice: "shimmer", f: 880, to: 1.5, decay: 1.2, vol: 0.5 },
    { voice: "hum", at: 0.1, f: 90, to: 1.6, decay: 1.2, bright: 0.5, vol: 0.3 },
  ],
};
// Switching off: the old TV's knob clicks and its whine falls away; the
// flat TV's soft falling tone; the curtains swish closed; the hologram's
// hum drops.
const OFF_SOUND = {
  tv: [
    { voice: "switch", f: 1500, vol: 0.9 },
    { voice: "zap", at: 0.05, f: 7800, to: 0.35, decay: 1.4, vol: 0.12 },
    { voice: "hum", at: 0.02, f: 62, to: 0.6, decay: 0.7, bright: 0.12, vol: 0.35 },
  ],
  flat: [
    { voice: "click", f: 2100, vol: 0.7 },
    { voice: "tone", at: 0.08, f: "B4", to: 0.67, decay: 1.1, vol: 0.11 },
  ],
  cinema: [
    { voice: "whoosh", f: 300, to: 0.4, decay: 2.4, vol: 0.7 },
    { voice: "rumble", at: 1.6, f: 60, decay: 0.6, vol: 0.18 },
  ],
  hologram: [
    { voice: "shimmer", f: 1320, to: 0.5, decay: 0.8, vol: 0.4 },
    { voice: "hum", f: 90, to: 0.5, decay: 0.8, bright: 0.5, vol: 0.25 },
  ],
};
const PLAY_SOUND = { voice: "click", f: 1900, decay: 0.8, vol: 0.7 };

// The old TV's picture: a 4:3 tube behind a curved glass face.
const TV = { cx: -0.32, cy: 0.12, hw: 0.68, hh: 0.51, r: 0.12, z: 0.27 };
// Its control panel (two knobs and the speaker grille), right of the glass.
const PANEL = { x: 0.72, y: 0.02, hw: 0.28, hh: 0.62 };
const KNOB = { power: [PANEL.x, 0.42, 0.11], volume: [PANEL.x, 0.14, 0.085] };
// The flat TV's 16:9 panel, and its power button beside the standby light.
const FLAT = { hw: 1.25, hh: 0.703, z: 0.04, cy: 0.3, bw: 0.06, chin: 0.1 };
// The cinema: a 16:9 screen, sixteen curtain pleats (tokens), seats.
const CINEMA = { hw: 1.1, hh: 0.62, cy: 0.62, z: -0.6, pleats: 8, pw: 0.2, gather: 0.07, x0: 1.78, floor: -0.25 }; // prettier-ignore
// The hologram: the sheet floats above a round projector.
const HOLO = { hw: 1.0, hh: 0.5625, cy: 0.42, base: -0.72, rows: 26 };

// Whether a tap at p (recipe coordinates) landed on the style's switch.
function onSwitch(style, p) {
  const [x, y, z] = p;
  if (style === "tv") {
    const [kx, ky] = KNOB.power;
    return Math.hypot(x - kx, y - ky) < 0.18 && z > TV.z - 0.12;
  }
  if (style === "flat") {
    const bottom = FLAT.cy - FLAT.hh;
    return Math.abs(x) < 0.34 && y < bottom + 0.005 && y > bottom - FLAT.chin - 0.08 && z > FLAT.z - 0.2; // prettier-ignore
  }
  if (style === "cinema") {
    const top = CINEMA.cy + CINEMA.hh + 0.3;
    // The curtains (wherever they are) and the valance over them.
    if (y < CINEMA.floor + 0.01) return false;
    if (y > top - 0.08 && z > CINEMA.z + 0.1) return true;
    return Math.abs(z - (CINEMA.z + 0.2)) < 0.17;
  }
  return y < HOLO.base + 0.06; // the projector's base
}

// Where pleat i of a curtain (0 at the middle) is, for how far the curtain
// has opened (0..1): the leading pleat is pulled to the side and pushes the
// others along, so they bunch up and turn into folds. Returns [x, turn].
function pleat(i, s) {
  const { pleats, pw, gather, x0 } = CINEMA;
  const rest = pw / 2 + i * pw;
  const g0 = x0 - pw / 2 - (pleats - 1) * gather; // the leading pleat, gathered
  const lead = pw / 2 + (g0 - pw / 2) * s;
  const x = Math.max(rest, lead + i * gather);
  // How much it is squeezed against the one outside it: its fold.
  const squeeze = clamp((x - rest) / Math.max(1e-3, g0 + i * gather - rest), 0, 1);
  return [x, squeeze * (i % 2 ? -1 : 1) * 1.05];
}

export const RECIPES = {
  screen: {
    // A screen keeps still and faces you (walk the view round it by hand).
    turntable: false,
    tiltLock: true, // a drag only spins it left and right (lane Viewer)
    alive: true,
    // Its own splats are the set (sharp at every tier: lane Screens r2);
    // the picture is the sheet's, with its own budget.
    density: 2,
    options: [
      {
        key: "style",
        label: "Style",
        type: "select",
        default: "tv",
        choices: [
          { id: "tv", label: "Old TV" },
          { id: "flat", label: "Flat TV" },
          { id: "cinema", label: "Cinema" },
          { id: "hologram", label: "Hologram" },
        ],
      },
      {
        key: "sample",
        label: "Sample",
        type: "select",
        default: "video",
        choices: [
          { id: "video", label: "A video (Big Buck Bunny)" },
          { id: "gif", label: "A GIF (a galloping horse)" },
        ],
      },
    ],
    controls: [{ key: "power", label: "Switch on or off", type: "pulse", ease: 2 }],
    action: {
      key: "power",
      // The Toy tab's button: on and off (the cinema's curtains).
      get label() {
        return ACTION_LABEL[SCR.style] || ACTION_LABEL.tv;
      },
      quiet: ["power"],
      // A tap on the switch switches on or off; anywhere else, it plays
      // and pauses (or switches on, while off).
      at: (point) => ({ key: "power", pick: onSwitch(SCR.style, point) ? PICK_SWITCH : PICK_OTHER }), // prettier-ignore
    },
    pictures: {
      sample: (o) => (o.sample === "gif" ? "assets/toys/screen/horse.gif" : videoSample()),
      accept: ["video", "gif", "image"],
    },
    credits: [
      {
        label: "Screen",
        title: "Big Buck Bunny (a six-second scene: the video sample)",
        source: "https://peach.blender.org/",
        author: "Blender Foundation",
        license: "CC BY 3.0",
        licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
      },
      {
        label: "Screen",
        title: "A race horse galloping (the GIF sample, from the 1887 photographs)",
        source: "https://commons.wikimedia.org/wiki/File:Muybridge_race_horse_animated.gif",
        author: "Eadweard Muybridge",
        license: "Public domain",
        licenseUrl: "https://commons.wikimedia.org/wiki/File:Muybridge_race_horse_animated.gif",
      },
    ],
    input: {
      title: "Your own video",
      media: { accept: ["video", "gif", "image"] },
      note: "Open a video or a GIF, or paste a web address, and watch it on the screen. Turn the sound on with the speaker button. Files stay on this device; nothing is uploaded.",
    },
    drive(t, c, out, info) {
      const pics = info.data?.pictures;
      const style = SCR.style;
      const time = info.time ?? t;
      const video = pics?.kind === "video";
      const gif = pics?.kind === "gif";
      // A new build starts switched off: a video still playing stops.
      if (SCR.fresh && pics?.kind) {
        SCR.fresh = false;
        if (video && pics.playing) pics.togglePlay();
      }
      const switchOn = () => {
        SCR.on = true;
        SCR.at = time;
        if (video && SCR.resume && !pics.playing) pics.togglePlay();
        out.cues.push(ON_SOUND[style]);
      };
      const n = info.tap?.n ?? 0;
      if (n < SCR.tapN) SCR.tapN = 0;
      if (n > SCR.tapN) {
        SCR.tapN = n;
        if (!SCR.on) switchOn();
        else if (info.tap.pick === PICK_OTHER) {
          // A tap on the picture (or the set round it): play or pause.
          if (video) pics.togglePlay();
          else if (gif) SCR.gifPaused = !SCR.gifPaused;
          out.cues.push(PLAY_SOUND);
        } else {
          // The switch (or the Toy tab's button): off, the video paused
          // where it was, to play on when it comes back on.
          SCR.on = false;
          SCR.at = time;
          SCR.resume = video ? pics.playing : true;
          if (video && pics.playing) pics.togglePlay();
          out.cues.push(OFF_SOUND[style]);
        }
      } else if (!SCR.on && video && pics.playing && !SCR.wasPlaying) {
        // Play in the Toy tab switches it on too.
        SCR.resume = true;
        switchOn();
      }
      SCR.wasPlaying = !!(video && pics.playing);
      // A GIF holds its frame while the set is off (or paused).
      if (gif) pics.hold?.(!SCR.on || SCR.gifPaused);
      // p: 0..1 switching on (1 on); q: 0..1 switching off (1 off).
      const p = SCR.on ? clamp((time - SCR.at) / ON_TIME[style], 0, 1) : 0;
      const q = SCR.on ? 0 : clamp((time - SCR.at) / OFF_TIME[style], 0, 1);
      out.morph = [0, 0, 0, 0];
      let shown;
      const on = SCR.on;
      if (style === "tv") shown = driveTV(on, p, q, out);
      else if (style === "flat") shown = driveFlat(on, p, q, out);
      else if (style === "cinema") shown = driveCinema(on, p, q, out);
      else shown = driveHologram(on, p, q, t, out);
      // The picture shows only while the set is (partly) on: hidden, it is
      // still built ("ahead"), so it is there the moment it switches on.
      out.sheets = { screen: { page: 0, visible: shown ? 1 : 0, ahead: 1 } };
    },
    build(k, o) {
      const style = ON_TIME[o.style] ? o.style : "tv";
      SCR.style = style;
      SCR.on = false;
      SCR.at = -1e9;
      SCR.tapN = 0;
      SCR.fresh = true;
      SCR.wasPlaying = false;
      SCR.resume = true;
      SCR.gifPaused = false;
      if (style === "tv") buildTV(k);
      else if (style === "flat") buildFlat(k);
      else if (style === "cinema") buildCinema(k);
      else buildHologram(k);
    },
  },
};

// ---- Old TV --------------------------------------------------------------------------------

// On: the glass clears from the middle row outward (channel 0) behind a
// bright line that splits in two and runs to the top and the bottom (two
// parts fading on channel 1); the power knob turns. Off: the knob turns
// back, the picture shrinks to its middle as it whitens (channel 2) into a
// bright dot that fades, and the dark glass closes back over from the top
// and the bottom. Returns whether the picture shows.
function driveTV(on, p, q, out) {
  if (on) {
    const open = ease(win(p, 0.22, 0.85));
    out.morph[0] = p > 0.12 ? 0.02 + 0.98 * open : 0;
    const line = p > 0.12 && p < 1 ? 1 : 0;
    out.morph[1] = win(p, 0.35, 0.9);
    const y = open * TV.hh * 0.96;
    out.parts.lineTop = { offset: [0, y, 0], visible: line };
    out.parts.lineBot = { offset: [0, -y, 0], visible: line };
    out.parts.power = { angle: -1.3 * ease(win(p, 0, 0.14)) };
    out.parts.volume = { angle: -0.5 * ease(win(p, 0.05, 0.25)) };
    out.parts.pic = { scale: 1, visible: 1 };
    out.parts.dot = { visible: 0 };
    return p > 0.12;
  }
  out.parts.power = { angle: -1.3 * (1 - ease(win(q, 0, 0.12))) };
  out.parts.volume = { angle: -0.5 * (1 - ease(win(q, 0.02, 0.2))) };
  out.parts.lineTop = { visible: 0 };
  out.parts.lineBot = { visible: 0 };
  // The picture shrinks to a point (0.08..0.42 of the way) and whitens.
  const s = ease(win(q, 0.08, 0.42));
  const pic = q < 0.42;
  // (Full size again once hidden: a picture sheet on a part is sorted in
  // the part's pose when it is rebuilt, so it must not be rebuilt shrunk.)
  out.parts.pic = { scale: pic ? Math.max(0.02, 1 - s) : 1, visible: pic ? 1 : 0 };
  out.morph[2] = win(q, 0.1, 0.38);
  // The dot: bright as the picture reaches it, then fading to nothing.
  const d = q < 0.3 ? 0 : q < 0.42 ? win(q, 0.3, 0.42) : 1 - win(q, 0.42, 0.9);
  out.parts.dot = { visible: d };
  // The glass stays clear until the dot has faded, then closes over.
  out.morph[0] = q < 0.55 ? 1 : 1 - ease(win(q, 0.55, 0.98));
  return pic;
}

function buildTV(k) {
  const W = 2.3;
  const H = 1.62;
  const D = 1.25;
  const cz = TV.z - 0.05 - D / 2; // the cabinet's front at z = TV.z - 0.05
  const front = cz + D / 2;
  // The cabinet: polished walnut. Its front has holes for the picture and
  // the control panel.
  softBox(k, W, H, D, 0.09, {
    pos: [0, 0.1, cz],
    even: true,
    flat: 0.1,
    jitter: 0,
    opacity: 1,
    color: (c, face) => {
      if (face === 4) {
        const x = c.p[0];
        const y = c.p[1];
        if (inRounded(x - TV.cx, y - TV.cy, TV.hw + 0.1, TV.hh + 0.1, TV.r + 0.08)) return null;
        if (Math.abs(x - PANEL.x) < PANEL.hw && Math.abs(y - PANEL.y) < PANEL.hh) return null;
      }
      return walnut(c);
    },
  });
  // A brass rim round the picture's opening and the panel's, flush with
  // the wood.
  const brass = (c) => {
    const g = 0.5 + 0.5 * Math.sin(Math.atan2(c.lp[1], c.lp[0]) * 2 + 0.6);
    return keep(mix("#8a6a34", "#dcbc74", 0.3 + 0.5 * g));
  };
  const rimOpts = { even: true, flat: 0.08, weight: 3, size: 0.8, jitter: 0, opacity: 1, pattern: false, color: brass }; // prettier-ignore
  k.add(band(k, TV.hw + 0.1, TV.hh + 0.1, TV.r + 0.08, 0.02), { ...rimOpts, pos: [TV.cx, TV.cy, front + 0.012] }); // prettier-ignore
  k.add(band(k, PANEL.hw, PANEL.hh, 0.03, 0.016), { ...rimOpts, pos: [PANEL.x, PANEL.y, front + 0.012] }); // prettier-ignore
  // The dark tube behind the picture (the letterbox bars of a wide video).
  k.add(rect(TV.hw * 2 + 0.2, TV.hh * 2 + 0.2), {
    pos: [TV.cx, TV.cy, front - 0.06],
    even: true,
    flat: 0.1,
    jitter: 0,
    opacity: 1,
    pattern: false,
    color: "#0c0e0d",
  });
  // The bezel: a dark molded frame that slopes from the wood up to the
  // glass's edge (so no gap shows round it from the side).
  k.add(band(k, TV.hw, TV.hh, TV.r, 0.1, 0.072, 0.002), {
    pos: [TV.cx, TV.cy, front],
    even: true,
    flat: 0.08,
    weight: 2,
    jitter: 0,
    opacity: 1,
    pattern: false,
    color: (c) => {
      // Light from the top on the upper slope, shade on the lower.
      const up = c.lp[1] / (TV.hh + 0.1);
      const f = 1 + 0.16 * up * (1 - c.v) + 0.08 * (1 - c.v);
      return keep(shade(mix("#2c251f", "#15110e", c.v), f));
    },
  });
  // The picture rides a part, so it can shrink to a dot as the set goes
  // off. (A screen sheet's splats stand six of its pixels in front of its
  // center, so it sits back from the glass.)
  const center = [TV.cx, TV.cy, TV.z - 0.09];
  const pic = k.part("pic", { pivot: center });
  k.sheet({ id: "screen", center, width: TV.hw * 2, height: TV.hh * 2, method: "screen", part: pic }); // prettier-ignore
  // Over it, on the same part, a white glow that rises as it shrinks.
  k.add(rect(TV.hw * 2, TV.hh * 2), {
    pos: [TV.cx, TV.cy, TV.z - 0.012],
    part: pic,
    even: true,
    flat: 0.1,
    weight: 0.6,
    size: 1.3,
    jitter: 0,
    opacity: 1,
    pattern: false,
    kind: "fade",
    channel: 2,
    params: [0, -0.95],
    color: (c) => (inRounded(c.lp[0], c.lp[1], TV.hw, TV.hh, TV.r) ? keep("#f4faff") : null),
  });
  // The dot the picture shrinks to: a small bright spot with a soft halo.
  const dot = k.part("dot", { pivot: [TV.cx, TV.cy, TV.z - 0.01] });
  k.cloud({ count: 260, pattern: false, part: dot }, (rand, i, n) => {
    const r = i < n * 0.6 ? 0.018 * Math.sqrt(rand()) : 0.02 + 0.05 * rand();
    const a = rand() * TAU;
    const halo = i >= n * 0.6;
    return {
      p: [TV.cx + r * Math.cos(a), TV.cy + r * Math.sin(a), TV.z - 0.01],
      n: [0, 0, 1],
      flat: 0.2,
      size: halo ? 2.2 : 0.9,
      color: halo ? "#cfe8ff" : "#ffffff",
      opacity: halo ? 0.12 : 1,
    };
  });
  // The curved glass face, dark gray-green while off: it clears from the
  // middle row outward as channel 0 rises. Solid (nothing shows through).
  const bulge = (x, y) => 0.05 * (1 - (x / TV.hw) ** 2) * (1 - (y / TV.hh) ** 2);
  k.add(
    k.param((u, v) => {
      const x = (u - 0.5) * 2 * TV.hw;
      const y = (v - 0.5) * 2 * TV.hh;
      return [x, y, bulge(x, y)];
    }),
    {
      pos: [TV.cx, TV.cy, TV.z + 0.012],
      even: true,
      flat: 0.1,
      weight: 1.4,
      size: 1.2,
      jitter: 0,
      opacity: 1,
      pattern: false,
      kind: "fade",
      channel: 0,
      params: (c) => [0.03 + 0.95 * (Math.abs(c.lp[1]) / TV.hh), 0.03],
      color: (c) => {
        const x = c.lp[0];
        const y = c.lp[1];
        if (!inRounded(x, y, TV.hw, TV.hh, TV.r)) return null;
        // The glass's own sheen, brightest up and to the left.
        const g = Math.exp(-(((x + 0.3) / 0.35) ** 2) - ((y - 0.28) / 0.22) ** 2);
        return keep(mix("#27302c", "#5d6a64", 0.6 * g + 0.15 * (1 - Math.hypot(x / TV.hw, y / TV.hh)))); // prettier-ignore
      },
    },
  );
  // A faint reflection that stays when the set is on: the glass is curved.
  k.cloud({ count: 260, pattern: false }, (rand, i) => {
    const a = 2.35 - 0.9 * (i / 260);
    const r = 0.95 + 0.04 * rand();
    const x = 0.55 * TV.hw * Math.cos(a) * r + 0.05;
    const y = 0.6 * TV.hh * Math.sin(a) * r - 0.02;
    return {
      p: [TV.cx + x, TV.cy + y, TV.z + 0.02 + bulge(x, y)],
      n: [0, 0, 1],
      flat: 0.1,
      size: 1.4,
      color: "#eef4f2",
      opacity: 0.06,
    };
  });
  // The bright line: two thin bars that start together in the middle.
  for (const name of ["lineTop", "lineBot"]) {
    const part = k.part(name, { pivot: [TV.cx, TV.cy, TV.z] });
    k.cloud({ count: 900, pattern: false, part }, (rand, i, n) => {
      const x = ((i + rand()) / n - 0.5) * 2 * (TV.hw - 0.04);
      const y = (rand() - 0.5) * 0.018;
      return {
        p: [TV.cx + x, TV.cy + y, TV.z + 0.075],
        n: [0, 0, 1],
        flat: 0.2,
        size: 0.9,
        color: mix("#ffffff", "#cfe6ff", Math.abs(x) / TV.hw),
        opacity: 0.95,
        kind: "fade",
        channel: 1,
        params: [0, 0.9],
      };
    });
  }
  // The control panel: a darker walnut inset with the speaker grille (a
  // woven cloth behind thin wooden slats) under the knobs.
  const grille = { y0: -0.56, y1: -0.06, hw: 0.21 };
  k.add(rect(PANEL.hw * 2, PANEL.hh * 2), {
    pos: [PANEL.x, PANEL.y, front - 0.02],
    even: true,
    flat: 0.08,
    weight: 2.2,
    jitter: 0,
    opacity: 1,
    color: (c) => {
      const x = c.lp[0];
      const y = c.lp[1];
      if (y > grille.y0 && y < grille.y1 && Math.abs(x) < grille.hw) {
        // Slats every 0.05, cloth between them.
        const f = ((((y - grille.y0) / 0.05) % 1) + 1) % 1;
        if (f < 0.34) return keep(lit(shade("#5a351d", 0.95 + 0.1 * f), [0, 0.6, 0.8], { amb: 0.7, spec: 0.2 })); // prettier-ignore
        const weave = 0.93 + 0.07 * Math.sin(x * 260) * Math.sin(y * 260);
        return keep(shade(mix("#2a1d12", "#9c8058", 0.55), weave * (0.8 + 0.2 * (f - 0.34) / 0.66))); // prettier-ignore
      }
      return walnut({ ...c, n: [0, 0, 1] }, "#4f2e19");
    },
  });
  // The knobs: dark bakelite with a knurled rim, a cream pointer and a
  // brass collar.
  const knob = (name) => {
    const [kx, ky, r] = KNOB[name];
    const at = [kx, ky, front + 0.04];
    const part = k.part(name, { pivot: at, axis: [0, 0, 1] });
    k.add(evenCylinder(r, r * 0.92, 0.08, "top"), {
      pos: at,
      rot: [90, 0, 0],
      part,
      even: true,
      flat: 0.12,
      weight: 3,
      jitter: 0,
      opacity: 1,
      pattern: false,
      color: (c) => {
        // The face: a pointer line, a soft dome of light.
        if (c.s.cap) {
          const x = c.p[0] - at[0];
          const yy = c.p[1] - at[1];
          if (Math.abs(x) < 0.013 && yy > 0.015) return keep("#efe4cc");
          const g = Math.exp(-(((x + 0.03) ** 2 + (yy - 0.03) ** 2) / (r * r * 0.35)));
          return mix("#241e1b", "#6a605a", 0.45 * g);
        }
        const a = Math.atan2(c.p[1] - at[1], c.p[0] - at[0]);
        const ridge = 0.5 + 0.5 * Math.cos(a * 18);
        return lit(shade("#221c19", 0.8 + 0.35 * ridge), c.n, { spec: 0.25, pow: 14 });
      },
    });
    k.add(evenCylinder(r * 1.22, r * 1.22, 0.014, "top"), {
      pos: [kx, ky, front + 0.002],
      rot: [90, 0, 0],
      even: true,
      flat: 0.1,
      weight: 3,
      jitter: 0,
      opacity: 1,
      pattern: false,
      color: (c) => lit("#b08d4a", c.s.cap ? [0, 0, 1] : c.n, { amb: 0.7, spec: 0.35, pow: 12 }),
    });
  };
  knob("power");
  knob("volume");
  // Legs: four tapered walnut legs, splayed a little, with brass feet.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      k.add(evenCylinder(0.033, 0.05, 0.42, false), {
        pos: [sx * (W / 2 - 0.22), 0.1 - H / 2 - 0.19, cz + sz * (D / 2 - 0.2)],
        rot: [-sz * 8, 0, sx * 8],
        even: true,
        flat: 0.2,
        weight: 2,
        jitter: 0,
        opacity: 1,
        color: (c) => {
          if (c.v > 0.86) return lit("#c4a262", c.n, { spec: 0.4, pow: 12 });
          const g = 0.94 + 0.06 * Math.sin(c.u * TAU * 3 + c.v * 2);
          return lit(shade("#5a331b", g), c.n, { amb: 0.62, spec: 0.25, pow: 16 });
        },
      });
    }
  // Rabbit-ear antennas on top.
  const top = [0.2, 0.1 + H / 2, cz - 0.05];
  k.add(k.sphere(0.1), {
    pos: add(top, [0, 0.05, 0]),
    even: true,
    weight: 2,
    flat: 0.25,
    jitter: 0,
    opacity: 1,
    color: (c) => lit("#2a2a2c", c.n, { spec: 0.4 }),
  });
  for (const s of [-1, 1]) {
    const tip = add(top, [s * 0.55, 0.85, -0.1]);
    k.add(
      evenTube(k, (u) => add(top, mul([s * 0.55, 0.85, -0.1], u)), 0.012, { caps: true }),
      {
        pos: [0, 0, 0],
        even: true,
        weight: 6,
        size: 0.8,
        stretch: 2,
        jitter: 0,
        opacity: 1,
        color: (c) => lit("#c9ccd2", c.n, { spec: 0.5, pow: 10 }),
      },
    );
    k.add(k.sphere(0.022), { pos: tip, even: true, weight: 6, opacity: 1, color: "#d8dade" });
  }
}

// ---- Flat TV -------------------------------------------------------------------------------

// On: fades up from black (channel 0) as the standby light goes out
// (channel 1). Off: the panel fades back to glossy black and the light
// comes back red. Returns whether the picture shows.
function driveFlat(on, p, q, out) {
  if (on) {
    out.morph[0] = p > 0 ? 0.02 + 0.98 * ease(win(p, 0.12, 1)) : 0;
    out.morph[1] = ease(win(p, 0, 0.3));
    out.parts.button = { offset: [0, 0, p < 0.1 ? -0.006 : 0] };
    return p > 0;
  }
  out.morph[0] = 1 - ease(win(q, 0, 0.8));
  out.morph[1] = 1 - ease(win(q, 0.55, 0.9));
  out.parts.button = { offset: [0, 0, q < 0.1 ? -0.006 : 0] };
  return q < 0.8;
}

function buildFlat(k) {
  const { bw, chin } = FLAT;
  const W = FLAT.hw * 2 + bw * 2;
  const H = FLAT.hh * 2 + bw + chin;
  const D = 0.15;
  const cy = FLAT.cy;
  const by = cy + (bw - chin) / 2; // the panel's middle (a deeper bottom bezel)
  const bottom = by - H / 2;
  // The bezel and back: satin black, a soft light down the top edge.
  softBox(k, W, H, D, 0.022, {
    pos: [0, by, FLAT.z - 0.005 - D / 2],
    even: true,
    flat: 0.1,
    weight: 1.2,
    jitter: 0,
    opacity: 1,
    pattern: false,
    color: (c, face) => {
      if (face === 4 && Math.abs(c.p[0]) < FLAT.hw + 0.005 && Math.abs(c.p[1] - cy) < FLAT.hh + 0.005) return null; // prettier-ignore
      if (face === 5) return lit("#24262b", c.n, { spec: 0.08 });
      const g = 0.92 + 0.12 * clamp((c.p[1] - by) / (H / 2), -1, 1);
      return lit(shade("#15171b", g), c.n, { amb: 0.7, spec: 0.3, pow: 22 });
    },
  });
  // Black behind the picture (the bars of a picture of another shape). The
  // picture sits back from the panel's face: a screen sheet's splats stand
  // six of its pixels in front of its center.
  k.add(rect(FLAT.hw * 2 + 0.01, FLAT.hh * 2 + 0.01), {
    pos: [0, cy, FLAT.z - 0.128],
    even: true,
    flat: 0.1,
    jitter: 0,
    opacity: 1,
    pattern: false,
    color: "#050607",
  });
  k.sheet({
    id: "screen",
    center: [0, cy, FLAT.z - 0.115],
    width: FLAT.hw * 2,
    height: FLAT.hh * 2,
    method: "screen",
  });
  // The panel switched off: glossy black, fading out as channel 0 rises.
  // Solid: nothing shows through it.
  k.add(rect(FLAT.hw * 2, FLAT.hh * 2), {
    pos: [0, cy, FLAT.z + 0.012],
    even: true,
    flat: 0.1,
    weight: 1.2,
    size: 1.2,
    jitter: 0,
    opacity: 1,
    pattern: false,
    kind: "fade",
    channel: 0,
    params: [0, 0.98],
    color: (c) => {
      // A soft diagonal reflection across the glossy panel.
      const d = (c.lp[0] + c.lp[1] * 1.6) / FLAT.hw;
      const g = Math.exp(-(((d + 0.25) / 0.35) ** 2));
      return keep(mix("#0b0c0f", "#2a2e36", 0.55 * g));
    },
  });
  // The standby light, in the chin: red while off, going out as it
  // switches on.
  const ly = bottom + chin / 2;
  k.cloud({ count: 160, pattern: false }, (rand, i, n) => {
    const halo = i >= n * 0.75;
    const a = rand() * TAU;
    const r = halo ? 0.009 + 0.007 * rand() : 0.008 * Math.sqrt(rand());
    return {
      p: [-0.07 + r * Math.cos(a), ly + r * Math.sin(a), FLAT.z + 0.004],
      n: [0, 0, 1],
      flat: 0.3,
      size: halo ? 0.8 : 0.4,
      color: halo ? "#ff5a40" : "#ff2a18",
      opacity: halo ? 0.25 : 1,
      kind: "fade",
      channel: 1,
      params: [0, 0.9],
    };
  });
  // The power button beside it: a small round button with the power mark,
  // pressed in (a part) when tapped.
  const btn = [0.07, ly, FLAT.z + 0.002];
  const button = k.part("button", { pivot: btn });
  k.add(evenCylinder(0.026, 0.024, 0.012, "top"), {
    pos: btn,
    rot: [90, 0, 0],
    part: button,
    even: true,
    flat: 0.1,
    weight: 6,
    jitter: 0,
    opacity: 1,
    pattern: false,
    color: (c) => {
      if (c.s.cap) {
        const x = c.p[0] - btn[0];
        const y = c.p[1] - btn[1];
        const r = Math.hypot(x, y);
        // The power mark: a broken ring and a bar.
        const ring = Math.abs(r - 0.012) < 0.0028 && !(y > 0 && Math.abs(x) < 0.006);
        const bar = Math.abs(x) < 0.0026 && y > -0.001 && y < 0.016;
        if (ring || bar) return keep("#b9bec8");
        return keep(mix("#1d2025", "#353941", clamp(0.5 - y / 0.05, 0, 1)));
      }
      return lit("#2c2f35", c.n, { spec: 0.3 });
    },
  });
  // The stand: a neck and a base, dark brushed metal.
  const metal = (c, col) => lit(col, c.n, { amb: 0.62, spec: 0.35, pow: 14 });
  softBox(k, 0.22, 0.34, 0.06, 0.02, {
    pos: [0, bottom - 0.15, FLAT.z - 0.08],
    even: true,
    flat: 0.1,
    weight: 1.6,
    jitter: 0,
    opacity: 1,
    pattern: false,
    color: (c) => metal(c, "#34373d"),
  });
  softBox(k, 1.0, 0.05, 0.42, 0.02, {
    pos: [0, bottom - 0.34, FLAT.z - 0.08],
    even: true,
    flat: 0.1,
    weight: 1.6,
    jitter: 0,
    opacity: 1,
    pattern: false,
    color: (c) => metal(c, "#383b42"),
  });
}

// ---- Cinema -------------------------------------------------------------------------------

// On: the curtains part (the pleats are tokens, pushed along by the
// leading one, folding as they bunch up at the sides); the house lights dim
// a little (channel 0). Off: they close again and the lights come up.
// Returns whether the picture shows (not once the curtains are closed).
function driveCinema(on, p, q, out) {
  const s = on ? ease(win(p, 0.05, 1)) : 1 - ease(win(q, 0, 0.95));
  const tokens = [];
  for (let side = 0; side < 2; side++) {
    const sgn = side ? 1 : -1;
    for (let i = 0; i < CINEMA.pleats; i++) {
      const rest = CINEMA.pw / 2 + i * CINEMA.pw;
      const [x, turn] = pleat(i, s);
      const base = [sgn * rest, CINEMA.cy, CINEMA.z + 0.2];
      tokens[side * CINEMA.pleats + i] = {
        base,
        offset: [sgn * (x - rest), 0, 0],
        quat: quatAxisAngle([0, 1, 0], sgn * turn),
      };
    }
  }
  out.tokens = tokens;
  out.morph[0] = on ? ease(win(p, 0.3, 1)) : 1 - ease(win(q, 0, 0.7));
  out.glow = [-0.16, -0.16, -0.16, 1];
  return s > 0.002;
}

function buildCinema(k) {
  const { hw, hh, cy, z, floor } = CINEMA;
  const top = cy + hh + 0.3;
  // The wall round the screen: dark maroon fabric panels.
  k.add(rect(3.9, top + 0.4 - floor), {
    pos: [0, (top + 0.4 + floor) / 2, z - 0.05],
    even: true,
    flat: 0.08,
    size: 1.15,
    jitter: 0,
    opacity: 1,
    color: thinEdges((c) => {
      if (Math.abs(c.p[0]) < hw + 0.08 && Math.abs(c.p[1] - cy) < hh + 0.08) return null;
      const panel = Math.abs(((((c.p[0] / 0.65) % 1) + 1) % 1) - 0.5) > 0.485 ? 0.8 : 1;
      const g = 0.85 + 0.12 * clamp((c.p[1] - floor) / (top - floor), 0, 1);
      return lit(shade("#3a1419", g * panel), [0, 0, 1], { amb: 0.6, dif: 0.3, spec: 0 });
    }),
  });
  // The screen's black masking, a thin gold frame, and the white screen
  // behind the picture.
  k.add(rect(hw * 2 + 0.16, hh * 2 + 0.16), {
    pos: [0, cy, z - 0.03],
    even: true,
    flat: 0.08,
    jitter: 0,
    opacity: 1,
    pattern: false,
    color: thinEdges((c) => {
      const ax = Math.abs(c.lp[0]);
      const ay = Math.abs(c.lp[1]);
      if (ax < hw && ay < hh) return "#d8d6d0";
      if (ax > hw + 0.06 || ay > hh + 0.06) return keep(mix("#9a7430", "#e2c275", 0.5 + 0.4 * Math.sin((c.lp[0] + c.lp[1]) * 6))); // prettier-ignore
      return "#0b0b0c";
    }, 0.02),
  });
  k.sheet({ id: "screen", center: [0, cy, z], width: hw * 2, height: hh * 2, method: "screen" });
  // The stage: polished boards, a dark front with a gold edge.
  softBox(k, 3.9, 0.3, 0.7, 0.012, {
    pos: [0, floor - 0.15, z + 0.3],
    even: true,
    flat: 0.1,
    jitter: 0,
    opacity: 1,
    color: (c, face) => {
      if (face === 2) {
        // Boards 0.14 wide running across, each its own tone.
        const b = Math.floor((c.p[2] - z) / 0.14 + 10);
        const f = ((((c.p[2] - z) / 0.14) % 1) + 1) % 1;
        if (f < 0.05) return keep(shade("#3a2012", 0.9));
        const tone = 0.88 + 0.14 * hash(b) + 0.04 * Math.sin(c.p[0] * 5 + b * 2);
        return lit(shade("#7a4b2a", tone), c.n, { amb: 0.66, spec: 0.3, pow: 18 });
      }
      if (face === 4 && c.p[1] > floor - 0.035) return keep(lit("#c9a24c", [0, 0.5, 0.86], { spec: 0.4, pow: 10 })); // prettier-ignore
      return lit("#1d0e10", c.n, { amb: 0.7 });
    },
  });
  // The valance across the top: gathered red velvet with a gold fringe of
  // short tassels.
  const folds = 22;
  k.add(
    strip((u, v) => [(u - 0.5) * 3.9, top - 0.02 + v * 0.42, z + 0.42 + 0.035 * Math.sin(u * 3.9 * folds)], { along: 4.6, across: 0.42 }), // prettier-ignore
    {
      even: true,
      flat: 0.1,
      weight: 1.4,
      jitter: 0,
      opacity: 1,
      color: thinEdges((c) => {
        if (c.v < 0.07) return keep(lit("#d2a847", [0, 0, 1], { spec: 0.45, pow: 10 }));
        return velvet("#a3172a", c.n);
      }),
    },
  );
  k.cloud({ count: 2600, pattern: false }, (rand, i, n) => {
    const x = ((i + 0.5) / n - 0.5) * 3.86;
    const len = 0.055 + (0.01 * ((i * 7) % 3)) / 2;
    return {
      p: [x, top - 0.02 - len / 2, z + 0.43 + 0.035 * Math.sin((x / 3.9 + 0.5) * 3.9 * folds)],
      dir: [0, 1, 0],
      stretch: 4,
      size: 0.45,
      color: mix("#a07a34", "#e8c870", 0.5 + 0.5 * Math.sin(i * 2.1)),
      opacity: 1,
    };
  });
  // The curtains: sixteen pleats, each a token that slides and turns. A
  // pleat is one deep fold of velvet (a little wider than its place, so
  // closed pleats overlap), shaded by its own folds.
  const ch = top - floor; // curtain height
  for (let side = 0; side < 2; side++) {
    const sgn = side ? 1 : -1;
    for (let i = 0; i < CINEMA.pleats; i++) {
      const rest = CINEMA.pw / 2 + i * CINEMA.pw;
      const token = side * CINEMA.pleats + i;
      k.add(
        strip(
          (u, v) => {
            const x = (u - 0.5) * CINEMA.pw * 1.08;
            return [x, (v - 0.5) * ch, 0.07 * Math.sin(u * TAU)];
          },
          { along: CINEMA.pw * 1.5, across: ch },
        ),
        {
          pos: [sgn * rest, floor + ch / 2, z + 0.2],
          even: true,
          flat: 0.1,
          weight: 1.3,
          jitter: 0,
          opacity: 1,
          kind: "token",
          params: [token, 0],
          color: thinEdges((c) => {
            // A gold band just above the hem.
            if (c.v > 0.018 && c.v < 0.034) return keep(lit("#c9a24c", c.n, { spec: 0.35, pow: 10 })); // prettier-ignore
            const hem = c.v < 0.018 ? 0.75 : 1;
            return velvet(shade("#a3172a", hem), c.n);
          }, 0.025),
        },
      );
    }
  }
  // Rows of seats in front, stepping up towards the back (house lights dim
  // on channel 0 as the film starts: a dark band over the seat backs).
  const rows = [
    { z: 0.45, y: -0.72, n: 7 },
    { z: 0.95, y: -0.56, n: 8 },
    { z: 1.45, y: -0.4, n: 8 },
  ];
  const sw = 0.4;
  for (const row of rows) {
    // The step the row stands on: dark carpet.
    softBox(k, 3.6, 0.06, 0.5, 0.01, {
      pos: [0, row.y - 0.03, row.z],
      even: true,
      flat: 0.1,
      jitter: 0,
      opacity: 1,
      color: (c) => lit("#2b1d1e", c.n, { amb: 0.7, spec: 0 }),
    });
    for (let s = 0; s < row.n; s++) {
      const x = (s - (row.n - 1) / 2) * sw;
      const seat = ([sx, sy, sz, r], pos, color) =>
        softBox(k, sx, sy, sz, r, {
          pos: add([x, row.y, row.z], pos),
          even: true,
          flat: 0.12,
          jitter: 0,
          opacity: 1,
          weight: 1.2,
          kind: "band",
          channel: 0,
          params: [1, 0.5],
          color,
        });
      seat([0.34, 0.08, 0.3, 0.03], [0, 0.2, 0.02], (c) => velvet("#9c1a26", c.n));
      seat([0.34, 0.38, 0.08, 0.03], [0, 0.38, 0.17], (c) => velvet("#8f1723", c.n));
      seat([0.05, 0.2, 0.3, 0.02], [-sw / 2 + 0.02, 0.2, 0.05], (c) => lit("#3a2418", c.n, { spec: 0.3, pow: 16 })); // prettier-ignore
    }
  }
}

// ---- Hologram ------------------------------------------------------------------------------

// On: the beam rises from the projector (channel 0), the picture flickers
// on (its part shown and hidden), then floats gently; the scanlines drift;
// the button's light turns cyan (channel 1). Off: the picture sinks into
// the beam, which falls back into the lens. Returns whether it shows.
function driveHologram(on, p, q, t, out) {
  const bob = 0.02 * Math.sin(t * 1.3);
  const gap = (2 * HOLO.hh) / HOLO.rows;
  const drift = ((t * 0.03) % gap) - gap / 2;
  if (on) {
    out.morph[0] = ease(win(p, 0, 0.5));
    out.morph[1] = ease(win(p, 0, 0.2));
    // Flickers: on, off, on, off, then steady.
    const f = win(p, 0.4, 1);
    const flick = p >= 1 || [0.02, 0.2, 0.38, 0.62].some((a, i) => f >= a && f < [0.12, 0.28, 0.52, 2][i]); // prettier-ignore
    const vis = p > 0 && flick ? 1 : 0;
    out.parts.holo = { visible: vis, offset: [0, bob, 0] };
    out.parts.lines = { visible: vis, offset: [0, bob + drift, 0] };
    return vis > 0;
  }
  const s = ease(win(q, 0, 0.45));
  const vis = q < 0.45 ? 1 : 0;
  // (Full size again once hidden: see driveTV.)
  const scale = vis ? Math.max(0.02, 1 - s) : 1;
  out.parts.holo = { visible: vis, scale, offset: [0, bob, 0] };
  out.parts.lines = { visible: vis, scale, offset: [0, bob + drift, 0] };
  out.morph[0] = 1 - ease(win(q, 0.2, 0.95));
  out.morph[1] = 1 - ease(win(q, 0, 0.2));
  return vis > 0;
}

function buildHologram(k) {
  const { hw, hh, cy, base } = HOLO;
  const cyan = "#79ecff";
  // The projector: a round base of dark satin metal with a glowing ring
  // and a lens.
  k.add(
    k.lathe(
      [
        [0.0, base - 0.2],
        [0.58, base - 0.2],
        [0.62, base - 0.14],
        [0.6, base - 0.02],
        [0.5, base + 0.02],
        [0.0, base + 0.02],
      ],
      { grid: 96 },
    ),
    {
      even: true,
      flat: 0.12,
      weight: 1.3,
      jitter: 0,
      opacity: 1,
      pattern: false,
      color: (c) => {
        const r = Math.hypot(c.p[0], c.p[2]);
        if (c.n[1] > 0.7) {
          if (r < 0.1) return keep(mix("#ffffff", cyan, r / 0.1));
          if (Math.abs(r - 0.36) < 0.025) return keep(cyan);
          // Fine rings turned into the top.
          const g = 0.96 + 0.04 * Math.sin(r * 160);
          return lit(shade("#2a2f37", g), c.n, { amb: 0.66, spec: 0.35, pow: 18 });
        }
        return lit("#23272e", c.n, { amb: 0.64, spec: 0.4, pow: 16 });
      },
    },
  );
  // Little lights round the rim that twinkle.
  k.cloud({ count: 60, pattern: false }, (rand, i, n) => {
    const a = (i / n) * TAU;
    return {
      p: [0.615 * Math.cos(a), base - 0.09, 0.615 * Math.sin(a)],
      n: [Math.cos(a), 0, Math.sin(a)],
      flat: 0.3,
      size: 0.6,
      color: cyan,
      opacity: 1,
      kind: "twinkle",
      params: [0.6, rand() * TAU],
    };
  });
  // The power button on the front of the rim: a small pad whose light is
  // dim red while off and cyan while on (channel 1).
  const bp = [0, base - 0.075, 0.612];
  k.add(evenCylinder(0.045, 0.045, 0.02, "top"), {
    pos: bp,
    rot: [90, 0, 0],
    even: true,
    flat: 0.1,
    weight: 5,
    jitter: 0,
    opacity: 1,
    pattern: false,
    color: (c) => (c.s.cap ? keep("#1a1d22") : lit("#30353d", c.n, { spec: 0.3 })),
  });
  for (const [col, params] of [
    ["#ff3a2a", [0, 0.9]],
    [cyan, [0, -0.9]],
  ])
    k.cloud({ count: 90, pattern: false }, (rand) => {
      const a = rand() * TAU;
      const r = 0.026 * Math.sqrt(rand());
      return {
        p: [bp[0] + r * Math.cos(a), bp[1] + r * Math.sin(a), bp[2] + 0.024],
        n: [0, 0, 1],
        flat: 0.3,
        size: 0.6,
        color: col,
        opacity: 1,
        kind: "fade",
        channel: 1,
        params,
      };
    });
  // The beam: a faint fan of light from the lens up to the picture's lower
  // edge, rising as channel 0 does.
  const lens = [0, base + 0.03, 0];
  const bottom = cy - hh;
  k.cloud({ count: 2200, pattern: false }, (rand) => {
    const s = Math.pow(rand(), 0.8);
    const tx = (rand() - 0.5) * 2 * hw;
    const tz = (rand() - 0.5) * 0.12;
    const p = [lens[0] + tx * s, lens[1] + (bottom - lens[1]) * s, lens[2] + tz * s];
    return {
      p,
      size: 2.2 + 2 * s,
      color: mix("#dffbff", cyan, s),
      opacity: 0.05 + 0.05 * (1 - s),
      kind: "fade",
      channel: 0,
      params: [0.9 * s, -0.12],
    };
  });
  // The picture floats above, see-through (it is light). Its pivot is its
  // lower edge, so it sinks into the beam as it switches off.
  const holo = k.part("holo", { pivot: [0, bottom, 0] });
  k.sheet({
    id: "screen",
    center: [0, cy, 0],
    width: hw * 2,
    height: hh * 2,
    method: "screen",
    part: holo,
    opacity: 0.62,
  });
  // A soft glow round its edge, on both sides.
  k.cloud({ count: 1400, pattern: false, part: holo }, (rand) => {
    const e = rand() * 4 * (hw + hh);
    let x;
    let y;
    if (e < 2 * hw) [x, y] = [e - hw, hh];
    else if (e < 4 * hw) [x, y] = [e - 3 * hw, -hh];
    else if (e < 4 * hw + 2 * hh) [x, y] = [-hw, e - 4 * hw - hh];
    else [x, y] = [hw, e - 4 * hw - 3 * hh];
    const out = 0.02 + 0.07 * rand();
    x += Math.sign(x) * (Math.abs(x) >= hw ? out : 0);
    y += Math.sign(y) * (Math.abs(y) >= hh ? out : 0);
    return {
      p: [x, cy + y, (rand() - 0.5) * 0.04],
      size: 2.4,
      color: cyan,
      opacity: 0.09,
    };
  });
  // Faint scanlines just in front of and behind the picture.
  const lines = k.part("lines", { pivot: [0, bottom, 0] });
  const rows = HOLO.rows;
  k.cloud({ count: rows * 2 * 60, pattern: false, part: lines }, (rand, i) => {
    const row = Math.floor(i / 120) % rows;
    const side = (i / 60) % 2 < 1 ? 1 : -1;
    const x = ((i % 60) + 0.5) / 60;
    return {
      p: [(x - 0.5) * 2 * hw, cy - hh + ((row + 0.5) / rows) * 2 * hh, side * 0.012],
      dir: [1, 0, 0],
      stretch: 4,
      size: 0.8,
      color: cyan,
      opacity: 0.16,
    };
  });
}
