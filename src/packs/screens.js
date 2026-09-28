// Screens (lane Screens): your GIF or video on a screen made of splats, in
// four styles (an old TV, a flat TV, a cinema and a hologram). The picture
// is a picture sheet (k.sheet, method "screen", src/pictures.js): its splats
// take their colors from the video's frames on the GPU, and the video's
// sound follows the site's speaker button.
//
// The tap switches the screen on (each style its own way), then plays and
// pauses. The switching on runs on the player's clock (info.time), so it
// also plays when the Toy tab's Play button starts the video.

import { mix, shade, smoothstep, clamp, quatAxisAngle } from "../kit.js";

const TAU = Math.PI * 2;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => mul(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
const keep = (c, size) => ({ c, keep: true, size });
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
const win = (x, a, b) => clamp((x - a) / (b - a), 0, 1);

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

// A flat rectangle in the XY plane, facing +Z (or -Z), with u, v across it.
function rect(w, h, nz = 1) {
  const n = [0, 0, nz];
  return {
    area: w * h,
    thick: 0.01,
    dims: 2,
    sample(rand) {
      const u = rand();
      const v = rand();
      return { p: [(u - 0.5) * w, (v - 0.5) * h, 0], n, u, v, face: nz > 0 ? 4 : 5 };
    },
  };
}

// A box with rounded edges (a superellipsoid would leave a stripe): the six
// faces, each inset by r, plus quarter-cylinder edges. Samples carry `face`
// (0..5 for +X, -X, +Y, -Y, +Z, -Z; -1 on the rounded edges).
function roundBox(sx, sy, sz, r) {
  const h = [sx / 2 - r, sy / 2 - r, sz / 2 - r];
  const L = [h[0] * 2, h[1] * 2, h[2] * 2];
  const parts = [];
  const faceN = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];
  faceN.forEach((n, f) => {
    const ax = f >> 1;
    parts.push({ area: L[(ax + 1) % 3] * L[(ax + 2) % 3], kind: 0, f, n, ax });
  });
  for (let ax = 0; ax < 3; ax++)
    for (const s1 of [-1, 1])
      for (const s2 of [-1, 1])
        parts.push({ area: (Math.PI / 2) * r * L[ax], kind: 1, ax, s1, s2 });
  let total = 0;
  for (const q of parts) q.cum = total += q.area;
  return {
    area: total,
    thick: Math.min(sx, sy, sz) / 2,
    sample(rand) {
      const x = rand() * total;
      let q = parts[parts.length - 1];
      for (const it of parts)
        if (x < it.cum) {
          q = it;
          break;
        }
      const p = [0, 0, 0];
      const a1 = (q.ax + 1) % 3;
      const a2 = (q.ax + 2) % 3;
      if (q.kind === 0) {
        const u = rand();
        const v = rand();
        p[q.ax] = q.n[q.ax] * (h[q.ax] + r);
        p[a1] = (u - 0.5) * L[a1];
        p[a2] = (v - 0.5) * L[a2];
        return { p, n: q.n, u, v, face: q.f };
      }
      const a = rand() * (Math.PI / 2);
      const n = [0, 0, 0];
      n[a1] = q.s1 * Math.cos(a);
      n[a2] = q.s2 * Math.sin(a);
      p[q.ax] = (rand() - 0.5) * L[q.ax];
      p[a1] = q.s1 * h[a1] + n[a1] * r;
      p[a2] = q.s2 * h[a2] + n[a2] * r;
      return { p, n, u: 0, v: 0, face: -1 };
    },
  };
}

// Inside a rounded rectangle of half sizes hw, hh and corner radius r.
function inRounded(x, y, hw, hh, r) {
  const dx = Math.max(0, Math.abs(x) - (hw - r));
  const dy = Math.max(0, Math.abs(y) - (hh - r));
  return dx * dx + dy * dy <= r * r;
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

// One toy is shown at a time: whether it is on, since when, and the tap
// count it has seen. build() starts it switched off.
const SCR = { style: "tv", on: false, onAt: 0, tapN: 0, fresh: true, wasPlaying: false, scrub: null, seekAt: -1 }; // prettier-ignore

// How long each style takes to switch on (s).
const ON_TIME = { tv: 1.5, flat: 1.4, cinema: 1.9, hologram: 1.5 };

// The sound each style makes as it switches on (played as cues, so each
// style has its own), and the click of play and pause.
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
const PLAY_SOUND = { voice: "click", f: 1900, decay: 0.8, vol: 0.7 };

// The old TV's picture: a 4:3 tube behind a curved glass face.
const TV = { cx: -0.32, cy: 0.12, hw: 0.68, hh: 0.51, r: 0.12, z: 0.27 };
// The flat TV's 16:9 panel.
const FLAT = { hw: 1.25, hh: 0.703, z: 0.04, cy: 0.3 };
// The cinema: a 16:9 screen, sixteen curtain pleats (tokens), seats.
const CINEMA = { hw: 1.1, hh: 0.62, cy: 0.62, z: -0.6, pleats: 8, pw: 0.2, gather: 0.07, x0: 1.78 };
// The hologram: the sheet floats above a round projector.
const HOLO = { hw: 1.0, hh: 0.5625, cy: 0.42, base: -0.72, rows: 26 };

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
    alive: true,
    // Its own splats are the set; the picture is the sheet's.
    density: 0.8,
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
    controls: [
      { key: "power", label: "Switch on, play or pause", type: "pulse", ease: 2 },
      // Moves through the video (with the pictures API's seek).
      { key: "scrub", label: "Scrub through the video", type: "slider", default: 0 },
    ],
    action: { key: "power", label: "Switch on, then play or pause", quiet: ["power"] },
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
      // A new build starts switched off: a video still playing stops.
      if (SCR.fresh && pics?.kind) {
        SCR.fresh = false;
        if (video && pics.playing) pics.togglePlay();
      }
      const n = info.tap?.n ?? 0;
      if (n < SCR.tapN) SCR.tapN = 0;
      if (n > SCR.tapN) {
        SCR.tapN = n;
        if (!SCR.on) {
          SCR.on = true;
          SCR.onAt = time;
          if (video && !pics.playing) pics.togglePlay();
          out.cues.push(ON_SOUND[style]);
        } else {
          if (video) pics.togglePlay();
          out.cues.push(PLAY_SOUND);
        }
      } else if (!SCR.on && video && pics.playing && !SCR.wasPlaying) {
        // Play in the Toy tab switches it on too.
        SCR.on = true;
        SCR.onAt = time;
        out.cues.push(ON_SOUND[style]);
      }
      SCR.wasPlaying = !!(video && pics.playing);
      // The scrub slider: a move of it jumps the video there (a few times a
      // second while it moves).
      const scrub = c.scrub ?? 0;
      if (SCR.scrub === null) SCR.scrub = scrub;
      if (video && pics.seek && Math.abs(scrub - SCR.scrub) > 0.002 && time - SCR.seekAt > 0.1) {
        SCR.scrub = scrub;
        SCR.seekAt = time;
        pics.seek(scrub * (pics.duration || 0));
      }
      // p: 0 off, 0..1 switching on, 1 on.
      const p = SCR.on ? clamp((time - SCR.onAt) / ON_TIME[style], 0, 1) : 0;
      out.sheets = { screen: { page: 0, visible: 1 } };
      out.morph = [0, 0, 0, 0];
      if (style === "tv") driveTV(p, out);
      else if (style === "flat") driveFlat(p, out);
      else if (style === "cinema") driveCinema(p, out);
      else driveHologram(p, t, out);
    },
    build(k, o) {
      const style = ON_TIME[o.style] ? o.style : "tv";
      SCR.style = style;
      SCR.on = false;
      SCR.tapN = 0;
      SCR.fresh = true;
      SCR.wasPlaying = false;
      SCR.scrub = null;
      if (style === "tv") buildTV(k);
      else if (style === "flat") buildFlat(k);
      else if (style === "cinema") buildCinema(k);
      else buildHologram(k);
    },
  },
};

// ---- Old TV --------------------------------------------------------------------------------

// The glass clears from the middle row outward (channel 0) behind a bright
// line that splits in two and runs to the top and the bottom (two parts
// fading on channel 1); the power knob turns.
function driveTV(p, out) {
  const open = ease(win(p, 0.22, 0.85));
  out.morph[0] = p > 0.12 ? 0.02 + 0.98 * open : 0;
  const line = p > 0.12 && p < 1 ? 1 : 0;
  out.morph[1] = win(p, 0.35, 0.9);
  const y = open * TV.hh * 0.96;
  out.parts.lineTop = { offset: [0, y, 0], visible: line };
  out.parts.lineBot = { offset: [0, -y, 0], visible: line };
  out.parts.power = { angle: -1.3 * ease(win(p, 0, 0.14)) };
  out.parts.volume = { angle: -0.5 * ease(win(p, 0.05, 0.25)) };
}

function buildTV(k) {
  const W = 2.3;
  const H = 1.62;
  const D = 1.25;
  const cz = TV.z - 0.05 - D / 2; // the cabinet's front at z = TV.z - 0.05
  const front = cz + D / 2;
  const walnut = "#6b3f22";
  const wood = (c) => {
    const g = c.fbm(c.p[0] * 1.2, c.p[1] * 18, c.p[2] * 18, 3);
    const grain = 0.9 + 0.1 * Math.sin(c.p[0] * 3 + g * 5) + 0.05 * g;
    return lit(shade(walnut, grain), c.n, { amb: 0.66, dif: 0.4, spec: 0.22, pow: 16 });
  };
  // The cabinet; its front has holes for the picture and the control panel.
  const panel = { x: 0.72, y: 0.02, hw: 0.28, hh: 0.62 };
  k.add(roundBox(W, H, D, 0.09), {
    pos: [0, 0.1, cz],
    even: true,
    flat: 0.15,
    size: 1.1,
    jitter: 0.008,
    opacity: 1,
    color: (c) => {
      if (c.s.face === 4) {
        const x = c.p[0];
        const y = c.p[1];
        if (inRounded(x - TV.cx, y - TV.cy, TV.hw + 0.1, TV.hh + 0.1, TV.r + 0.08)) return null;
        if (Math.abs(x - panel.x) < panel.hw && Math.abs(y - panel.y) < panel.hh) return null;
      }
      return wood(c);
    },
  });
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
  // The bezel: a dark rounded frame in front of the picture's edges.
  const bz = { hw: TV.hw + 0.1, hh: TV.hh + 0.1, r: TV.r + 0.08 };
  k.add(rect(bz.hw * 2, bz.hh * 2), {
    pos: [TV.cx, TV.cy, TV.z + 0.035],
    even: true,
    flat: 0.12,
    weight: 1.6,
    jitter: 0.006,
    opacity: 1,
    pattern: false,
    color: (c) => {
      const x = c.lp[0];
      const y = c.lp[1];
      if (!inRounded(x, y, bz.hw, bz.hh, bz.r)) return null;
      if (inRounded(x, y, TV.hw, TV.hh, TV.r)) return null;
      // A bevel: lighter towards the top-left inner edge.
      const e = clamp((Math.abs(y) - TV.hh + 0.1) / 0.1, 0, 1);
      return keep(lit(mix("#2a241e", "#171310", e), [0, 0, 1], { spec: 0.1 }));
    },
  });
  // The picture.
  // (A screen sheet's splats stand six of its pixels in front of its
  // center, so it sits back from the glass.)
  k.sheet({
    id: "screen",
    center: [TV.cx, TV.cy, TV.z - 0.045],
    width: TV.hw * 2,
    height: TV.hh * 2,
    method: "screen",
  });
  // The curved glass face, dark gray-green while off: it clears from the
  // middle row outward as channel 0 rises.
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
      jitter: 0,
      opacity: 0.99,
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
  // The control panel: a darker inset with two knobs and a speaker grille.
  k.add(rect(panel.hw * 2, panel.hh * 2), {
    pos: [panel.x, panel.y, front - 0.02],
    even: true,
    flat: 0.12,
    jitter: 0.006,
    opacity: 1,
    color: (c) => {
      const y = c.lp[1];
      // The grille: horizontal slots in the lower half.
      if (y < -0.08 && y > -0.56 && Math.abs(c.lp[0]) < 0.2) {
        const slot = ((y + 0.56) / 0.04) % 1;
        return keep(slot < 0.45 ? "#15100c" : lit("#8a6a48", [0, 0, 1], { amb: 0.7 }));
      }
      return lit("#4a3222", [0, 0, 1], { amb: 0.7 });
    },
  });
  const knob = (name, y, r) => {
    const at = [panel.x, y, front + 0.04];
    const part = k.part(name, { pivot: at, axis: [0, 0, 1] });
    k.add(k.cylinder(r, 0.08, { caps: true }), {
      pos: at,
      rot: [90, 0, 0],
      part,
      even: true,
      flat: 0.2,
      weight: 2.5,
      jitter: 0.01,
      opacity: 1,
      color: (c) => {
        // Ridges round the rim and a pointer line on the face.
        if (c.n[2] > 0.5) {
          const [x, yy] = [c.p[0] - at[0], c.p[1] - at[1]];
          if (Math.abs(x) < 0.012 && yy > 0.01) return keep("#e8dcc4");
          return lit("#2b2420", c.n, { spec: 0.35 });
        }
        const a = Math.atan2(c.p[1] - at[1], c.p[0] - at[0]);
        return lit(shade("#221c19", 0.85 + 0.2 * (Math.sin(a * 24) > 0)), c.n, { spec: 0.3 });
      },
    });
  };
  knob("power", 0.42, 0.11);
  knob("volume", 0.14, 0.085);
  // Legs: four tapered wooden legs, splayed a little.
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      k.add(k.cone(0.05, 0.035, 0.42, { caps: false }), {
        pos: [sx * (W / 2 - 0.22), 0.1 - H / 2 - 0.19, cz + sz * (D / 2 - 0.2)],
        rot: [-sz * 8, 0, sx * 8],
        even: true,
        flat: 0.25,
        weight: 2,
        opacity: 1,
        color: (c) => lit(shade(walnut, 0.8), c.n),
      });
    }
  // Rabbit-ear antennas on top.
  const top = [0.2, 0.1 + H / 2, cz - 0.05];
  k.add(k.sphere(0.1), {
    pos: add(top, [0, 0.05, 0]),
    even: true,
    weight: 2,
    flat: 0.3,
    opacity: 1,
    color: (c) => lit("#2a2a2c", c.n, { spec: 0.4 }),
  });
  for (const s of [-1, 1]) {
    const tip = add(top, [s * 0.55, 0.85, -0.1]);
    k.add(
      k.tube((u) => add(top, mul([s * 0.55, 0.85, -0.1], u)), 0.012, { caps: true }),
      {
        pos: [0, 0, 0],
        even: true,
        weight: 6,
        size: 0.8,
        stretch: 2,
        opacity: 1,
        color: (c) => lit("#c9ccd2", c.n, { spec: 0.6, pow: 10 }),
      },
    );
    k.add(k.sphere(0.022), { pos: tip, weight: 6, opacity: 1, color: "#d8dade" });
  }
}

// ---- Flat TV -------------------------------------------------------------------------------

// Fades up from black (channel 0) as the standby light goes out (channel 1).
function driveFlat(p, out) {
  out.morph[0] = p > 0 ? 0.02 + 0.98 * ease(win(p, 0.12, 1)) : 0;
  out.morph[1] = ease(win(p, 0, 0.3));
}

function buildFlat(k) {
  const bw = 0.06; // bezel
  const W = FLAT.hw * 2 + bw * 2;
  const H = FLAT.hh * 2 + bw * 2 + 0.04;
  const D = 0.13;
  const cy = FLAT.cy;
  const by = cy - 0.02; // the panel's middle (a slightly deeper bottom bezel)
  k.add(roundBox(W, H, D, 0.02), {
    pos: [0, by, FLAT.z - 0.005 - D / 2],
    even: true,
    flat: 0.12,
    size: 1.1,
    jitter: 0.004,
    opacity: 1,
    pattern: false,
    color: (c) => {
      if (c.s.face === 4 && Math.abs(c.p[0]) < FLAT.hw + 0.005 && Math.abs(c.p[1] - cy) < FLAT.hh + 0.005) return null; // prettier-ignore
      if (c.s.face === 5) return lit("#26282c", c.n, { spec: 0.1 });
      return lit("#15171b", c.n, { spec: 0.35, pow: 24 });
    },
  });
  // Black behind the picture (the bars of a picture of another shape). The
  // picture sits back from the panel's face: a screen sheet's splats stand
  // six of its pixels in front of its center.
  k.add(rect(FLAT.hw * 2 + 0.01, FLAT.hh * 2 + 0.01), {
    pos: [0, cy, FLAT.z - 0.095],
    even: true,
    flat: 0.1,
    jitter: 0,
    opacity: 1,
    pattern: false,
    color: "#050607",
  });
  k.sheet({
    id: "screen",
    center: [0, cy, FLAT.z - 0.08],
    width: FLAT.hw * 2,
    height: FLAT.hh * 2,
    method: "screen",
  });
  // The panel switched off: glossy black, fading out as channel 0 rises.
  k.add(rect(FLAT.hw * 2, FLAT.hh * 2), {
    pos: [0, cy, FLAT.z + 0.012],
    even: true,
    flat: 0.1,
    weight: 1.2,
    jitter: 0,
    opacity: 0.99,
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
  // The standby light, bottom middle: red, going out as it switches on.
  k.cloud({ count: 120, pattern: false }, (rand) => {
    const a = rand() * TAU;
    const r = 0.012 * Math.sqrt(rand());
    return {
      p: [r * Math.cos(a), by - H / 2 + 0.025 + r * Math.sin(a), FLAT.z + 0.004],
      n: [0, 0, 1],
      flat: 0.3,
      size: 0.5,
      color: "#ff2a18",
      opacity: 1,
      kind: "fade",
      channel: 1,
      params: [0, 0.9],
    };
  });
  // The stand: a neck and a base.
  k.add(roundBox(0.22, 0.34, 0.06, 0.02), {
    pos: [0, by - H / 2 - 0.15, FLAT.z - 0.08],
    even: true,
    flat: 0.15,
    opacity: 1,
    pattern: false,
    color: (c) => lit("#2a2c31", c.n, { spec: 0.45, pow: 16 }),
  });
  k.add(roundBox(1.0, 0.05, 0.42, 0.02), {
    pos: [0, by - H / 2 - 0.34, FLAT.z - 0.08],
    even: true,
    flat: 0.15,
    opacity: 1,
    pattern: false,
    color: (c) => lit("#2d3035", c.n, { spec: 0.5, pow: 16 }),
  });
}

// ---- Cinema -------------------------------------------------------------------------------

// The curtains part (the pleats are tokens, pushed along by the leading
// one, folding as they bunch up at the sides); the house lights dim a
// little (channel 0).
function driveCinema(p, out) {
  const s = ease(win(p, 0.05, 1));
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
  out.morph[0] = ease(win(p, 0.3, 1));
  out.glow = [-0.4, -0.4, -0.4, 1];
}

function buildCinema(k) {
  const { hw, hh, cy, z } = CINEMA;
  const floorY = -0.25; // the stage
  const top = cy + hh + 0.3;
  // The wall round the screen, dark maroon.
  k.add(rect(3.9, top + 0.4 - floorY), {
    pos: [0, (top + 0.4 + floorY) / 2, z - 0.05],
    even: true,
    flat: 0.1,
    jitter: 0.01,
    opacity: 1,
    color: (c) => {
      if (Math.abs(c.p[0]) < hw + 0.08 && Math.abs(c.p[1] - cy) < hh + 0.08) return null;
      return lit(shade("#3a1419", 0.85 + 0.15 * c.fbm(c.p[0] * 3, c.p[1] * 3, 0, 2)), [0, 0, 1], { amb: 0.6, dif: 0.3, spec: 0 }); // prettier-ignore
    },
  });
  // The screen's black masking and the white screen behind the picture.
  k.add(rect(hw * 2 + 0.16, hh * 2 + 0.16), {
    pos: [0, cy, z - 0.03],
    even: true,
    flat: 0.1,
    jitter: 0,
    opacity: 1,
    pattern: false,
    color: (c) => (Math.abs(c.lp[0]) < hw && Math.abs(c.lp[1]) < hh ? "#d8d6d0" : "#0b0b0c"),
  });
  k.sheet({ id: "screen", center: [0, cy, z], width: hw * 2, height: hh * 2, method: "screen" });
  // The stage: a wooden floor with a dark front.
  k.add(k.box(3.9, 0.3, 0.7), {
    pos: [0, floorY - 0.15, z + 0.3],
    even: true,
    flat: 0.15,
    jitter: 0.01,
    opacity: 1,
    color: (c) =>
      c.s.face === 2
        ? lit(shade("#6a4127", 0.92 + 0.08 * Math.sin(c.p[0] * 40)), c.n)
        : lit("#1d0e10", c.n, { amb: 0.7 }),
  });
  // The valance across the top: gathered red velvet with a gold fringe.
  k.add(
    k.param((u, v) => [(u - 0.5) * 3.9, top - 0.05 + v * 0.45, z + 0.32 + 0.03 * Math.sin(u * 3.9 * 22)]), // prettier-ignore
    {
      even: true,
      flat: 0.15,
      weight: 1.2,
      jitter: 0.01,
      opacity: 1,
      color: (c) => {
        if (c.v < 0.1) return keep(lit("#c79a3a", [0, 0, 1], { spec: 0.4 }));
        const fold = Math.cos(c.u * 3.9 * 22);
        return lit(shade("#8e1420", 0.7 + 0.3 * fold), [0, 0, 1], { amb: 0.7, dif: 0.3, spec: 0 }); // prettier-ignore
      },
    },
  );
  // The curtains: sixteen pleats, each a token that slides and turns. A
  // pleat is one wave of velvet, lit by its own folds.
  const ch = top - floorY; // curtain height
  for (let side = 0; side < 2; side++) {
    const sgn = side ? 1 : -1;
    for (let i = 0; i < CINEMA.pleats; i++) {
      const rest = CINEMA.pw / 2 + i * CINEMA.pw;
      const token = side * CINEMA.pleats + i;
      k.add(
        k.param((u, v) => {
          const x = (u - 0.5) * CINEMA.pw;
          return [x, (v - 0.5) * ch, 0.035 * Math.sin(u * TAU)];
        }),
        {
          pos: [sgn * rest, floorY + ch / 2, z + 0.2],
          even: true,
          flat: 0.15,
          weight: 1.1,
          jitter: 0.01,
          opacity: 1,
          kind: "token",
          params: [token, 0],
          color: (c) => {
            const shadeF = 0.62 + 0.38 * Math.cos(c.u * TAU - 0.6);
            const hem = c.v < 0.03 ? 0.7 : 1;
            return lit(shade("#a3172a", shadeF * hem), [0, 0, 1], { amb: 0.72, dif: 0.25, spec: 0.05 }); // prettier-ignore
          },
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
    // The step the row stands on.
    k.add(k.box(3.6, 0.06, 0.5), {
      pos: [0, row.y - 0.03, row.z],
      even: true,
      flat: 0.15,
      jitter: 0.01,
      opacity: 1,
      color: (c) => lit("#2b1d1e", c.n, { amb: 0.7 }),
    });
    for (let s = 0; s < row.n; s++) {
      const x = (s - (row.n - 1) / 2) * sw;
      const seat = (shape, pos, color) =>
        k.add(shape, {
          pos: add([x, row.y, row.z], pos),
          even: true,
          flat: 0.2,
          jitter: 0.01,
          opacity: 1,
          weight: 1.1,
          kind: "band",
          channel: 0,
          params: [1, 0.5],
          color: (c) => lit(color, c.n, { amb: 0.66, dif: 0.4, spec: 0.1 }),
        });
      seat(roundBox(0.34, 0.08, 0.3, 0.03), [0, 0.2, 0.02], "#9c1a26");
      seat(roundBox(0.34, 0.38, 0.08, 0.03), [0, 0.38, 0.17], "#8f1723");
      seat(roundBox(0.05, 0.2, 0.3, 0.02), [-sw / 2 + 0.02, 0.2, 0.05], "#231a1a");
    }
  }
}

// ---- Hologram ------------------------------------------------------------------------------

// The beam rises from the projector (channel 0), the picture flickers on
// (its part shown and hidden), then floats gently; the scanlines drift.
function driveHologram(p, t, out) {
  out.morph[0] = ease(win(p, 0, 0.5));
  // Flickers: on, off, on, off, then steady.
  const f = win(p, 0.4, 1);
  const on = p >= 1 || [0.02, 0.2, 0.38, 0.62].some((a, i) => f >= a && f < [0.12, 0.28, 0.52, 2][i]); // prettier-ignore
  const vis = p > 0 && on ? 1 : 0;
  const bob = 0.02 * Math.sin(t * 1.3);
  out.parts.holo = { visible: vis, offset: [0, bob, 0] };
  const gap = (2 * HOLO.hh) / HOLO.rows;
  out.parts.lines = { visible: vis, offset: [0, bob + ((t * 0.03) % gap) - gap / 2, 0] };
}

function buildHologram(k) {
  const { hw, hh, cy, base } = HOLO;
  const cyan = "#79ecff";
  // The projector: a round dark base with a glowing ring and a lens.
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
      { grid: 64 },
    ),
    {
      even: true,
      flat: 0.2,
      jitter: 0.008,
      opacity: 1,
      pattern: false,
      color: (c) => {
        const r = Math.hypot(c.p[0], c.p[2]);
        if (c.n[1] > 0.7) {
          if (r < 0.1) return keep(mix("#ffffff", cyan, r / 0.1));
          if (Math.abs(r - 0.36) < 0.025) return keep(cyan);
        }
        return lit("#23272e", c.n, { spec: 0.5, pow: 20 });
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
  // The picture floats above, see-through (it is light).
  const holo = k.part("holo", { pivot: [0, cy, 0] });
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
  const lines = k.part("lines", { pivot: [0, cy, 0] });
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
