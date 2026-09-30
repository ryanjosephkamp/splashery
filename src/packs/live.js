// Live input (lane Live input, prefix live): toys fed by the microphone and
// the camera, turned on only when someone taps a button for them
// (src/live/). Two new toys on the Studio shelf (labs):
//
// - Room echo meter: clap once and the page measures how long the room
//   rings (its reverberation time, RT60, from the decay of the clap's
//   energy), drawn as rings of sound spreading through a splat room, each
//   as bright as the clap was loud at that moment, and the number on the
//   back wall. A tap claps in a sample room.
// - Splat mirror: your live camera as a picture of splats, and with depth
//   from the Depth Anything V2 Small model (in a worker, loaded only after
//   the camera tap) a relief you can turn. Before the camera is on it shows
//   a still life with its depth map. A tap flattens and raises the depth.
//
// Photo to 3D's live view shares the mirror's picture (src/live/relief.js),
// so both look and behave the same.

import { mix, shade, clamp, smoothstep, quatAxisAngle } from "../kit.js";
import { live } from "../live/live.js";
import { MIRROR, buildMirror, mirrorScreen, mirrorStatus } from "../live/relief.js";
import { decodePhoto, unpackDepth } from "./photo-3d.js";

const TAU = Math.PI * 2;

// A flat, smooth sheet of splats in a plane: two staggered lattices of flat
// discs that overlap, so it reads as one surface. at(a, b) gives the place
// of (a, b) in 0..1; n its normal.
function sheet(k, { cols, rows, at, n, color, part = 0, extra = null, size }) {
  const list = [];
  for (let layer = 0; layer < 2; layer++)
    for (let i = 0; i < cols - layer; i++)
      for (let j = 0; j < rows - layer; j++) {
        const a = (i + 0.5 + layer * 0.5) / cols;
        const b = (j + 0.5 + layer * 0.5) / rows;
        list.push({ p: at(a, b), n, flat: 0.03, size: size / 0.01, opacity: 1, color: color(a, b), part, pattern: false, ...(extra ? extra(a, b) : null) }); // prettier-ignore
      }
  k.cloud({ share: list.length / k.count, pattern: false }, (rand, i) => list[i] || null);
}

// ---- The room echo meter ---------------------------------------------------------------
// A room of splats seen from the front and above: a wooden floor, three
// walls and a panel on the back wall that shows the reading. The clap is at
// the middle of the floor. Its sound spreads as rings on the floor; a new
// ring leaves every RING_GAP seconds for as long as the room still rings,
// each as bright as the sound was at that moment (on a dB scale: full at
// the clap's peak, dark 60 dB below it). A wall glows as rings reach it.
// The rings run at half speed so each one can be followed.

const ROOM = 1.5; // half the floor's side
const WALL_H = 1.0;
const RINGS = 10;
const RING_GAP = 0.07; // seconds (of the sound) between rings
const RING_TRAVEL = 0.4; // seconds (of the sound) for a ring to reach the walls
const SLOW = 2; // the rings run at half speed
const SAMPLE_RT = 0.8; // the sample room's RT60, for a tap

export const ECHO = {
  // The reading: { rt60, method, rangeDb } or { why: "noisy" | "short" }.
  result: null,
  sample: true, // the reading is the sample room's
  listening: false, // a clap was heard; its decay is still being measured
  // The rings' clock: when they started (the player's time) and the
  // sound's level (0..1, dB above −60 over 60) at a time after the clap.
  start: null,
  level: null,
  lastClaps: 0,
  lastDecay: 0,
  mic: null,
};

export const echoState = () => ({
  result: ECHO.result && { ...ECHO.result, curve: undefined },
  sample: ECHO.sample,
  listening: ECHO.listening,
});

// The sample room: an exponential decay of the sound's energy.
const sampleLevel = (rt) => (t) => Math.max(0, 1 - t / rt);

// A live clap's level at time t after it, from the energy the microphone
// measured (hops of `hop` seconds), smoothed over about 20 ms.
function micLevel(energy, hop) {
  let peak = 1e-12;
  for (let i = 0; i < Math.min(energy.length, 12); i++) peak = Math.max(peak, energy[i]);
  return (t) => {
    const i = Math.round(t / hop);
    if (i >= energy.length) return energy.done ? 0 : null; // not heard yet
    let s = 0;
    let c = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(energy.length - 1, i + 2); j++) {
      s += energy[j];
      c++;
    }
    const db = 10 * Math.log10(Math.max(1e-14, s / c / peak));
    return Math.max(0, Math.min(1, 1 + db / 60));
  };
}

export function echoText() {
  const r = ECHO.result;
  if (ECHO.listening) return { big: "…", small: "Listening to the room" };
  if (!r) return { big: "Clap", small: "Clap once, sharply" };
  if (r.rt60) return { big: `${r.rt60.toFixed(2)} s`, small: ECHO.sample ? "RT60, a sample room" : `RT60 (${r.method})` }; // prettier-ignore
  return { big: "Too noisy", small: "Clap louder, or try a quieter moment" };
}

function echoStatus() {
  if (!live.on("mic")) return "";
  const r = ECHO.result;
  if (ECHO.listening) return "Heard a clap. Listening to the room ring…";
  if (!r || ECHO.sample) return "Listening. Clap once, sharply, and wait a moment.";
  if (r.rt60) {
    const feel = r.rt60 < 0.4 ? "a dry room (soft furnishings, like a living room)" : r.rt60 < 1 ? "an ordinary room" : r.rt60 < 2 ? "a lively room (bare walls, a hall)" : "a very echoey space"; // prettier-ignore
    return `RT60 ${r.rt60.toFixed(2)} s: the room takes that long to fade by 60 dB, ${feel}. Measured by ${r.method}, the clap ${Math.round(r.rangeDb)} dB above the background.`; // prettier-ignore
  }
  return `Too noisy to measure: the clap stood only ${Math.round(r.rangeDb ?? 0)} dB above the background, and it needs about 25. Clap louder, or try when it's quieter.`; // prettier-ignore
}

// Follows the microphone (read on each frame, so nothing is missed while
// the toy builds): a new clap starts the rings from the level the
// microphone hears; its measurement gives the number.
function followMic(time) {
  const mic = live.mic;
  if (!mic) {
    ECHO.listening = false;
    return;
  }
  if (ECHO.mic !== mic) {
    ECHO.mic = mic;
    ECHO.lastClaps = mic.claps;
    ECHO.lastDecay = mic.lastDecay?.n ?? 0;
  }
  if (mic.claps > ECHO.lastClaps) {
    ECHO.lastClaps = mic.claps;
    ECHO.listening = true;
    if (mic.decay) {
      ECHO.energy = mic.decay.energy;
      ECHO.level = micLevel(ECHO.energy, mic.hop / mic.rate);
    } else {
      ECHO.energy = null;
      ECHO.level = sampleLevel(ECHO.result?.rt60 || SAMPLE_RT);
    }
    ECHO.start = time;
  }
  const d = mic.lastDecay;
  if (d && d.n !== ECHO.lastDecay && d.n === mic.claps) {
    ECHO.lastDecay = d.n;
    ECHO.listening = false;
    ECHO.sample = false;
    ECHO.result = d.ok ? d : { why: d.why, rangeDb: d.rangeDb };
    if (ECHO.energy) ECHO.energy.done = true;
  }
}

const ROOM_ECHO = {
  alive: () => live.on("mic") || ECHO.start !== null,
  density: 1,
  turntable: false,
  controls: [{ key: "clap", label: "Clap in the sample room", type: "pulse", ease: 3.2 }],
  action: { key: "clap", label: "Clap in the sample room", quiet: ["clap"] },
  input: {
    title: "Your room",
    fileButton: false,
    live: [{ kind: "mic", status: echoStatus, rebuild: false }],
    note: "Tap “Use my microphone”, then clap once, sharply, and keep still for two seconds. The page listens to the clap fade away and measures the reverberation time: how long the room takes to go 60 dB quieter. Headphones off; a quiet moment works best.",
    shown: () => (live.on("mic") ? "" : "A tap claps in a sample room (0.8 s)."),
  },
  screen: {
    width: 512,
    height: 160,
    version: () => `${echoText().big}|${echoText().small}`,
    draw(g) {
      const { big, small } = echoText();
      g.fillStyle = "#101418";
      g.fillRect(0, 0, 512, 160);
      g.fillStyle = "#ffe9a8";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = "bold 76px ui-sans-serif, system-ui, sans-serif";
      g.fillText(big, 256, 66);
      g.fillStyle = "#9fb2c4";
      g.font = "bold 30px ui-sans-serif, system-ui, sans-serif";
      g.fillText(small, 256, 128);
    },
  },
  drive(t, c, out, info) {
    const time = info.time ?? t;
    // The microphone: a clap heard starts the rings from what it measures.
    followMic(time);
    // A tap: the sample room (or the last room measured) claps.
    const tap = c.clap ?? 0;
    if (tap > 0.999 && ECHO.tapWas <= 0.999) {
      const rt = ECHO.result?.rt60 || SAMPLE_RT;
      ECHO.level = sampleLevel(rt);
      ECHO.start = time;
      if (!ECHO.result) {
        ECHO.result = { rt60: SAMPLE_RT, method: "sample" };
        ECHO.sample = true;
      }
      // Its sound: a hand clap that rings as long as the room (not while
      // the microphone listens, so the room isn't measured on our sound).
      if (!live.on("mic")) out.cues.push({ voice: "clap", f: 1400, decay: 1 + rt * 4.2, vol: 0.8 });
    }
    ECHO.tapWas = tap;
    // A pulse that runs out ends the sample's rings (the rest pose).
    let vt = ECHO.start === null ? null : (time - ECHO.start) / SLOW; // seconds of the sound
    if (vt !== null && ECHO.level && tap <= 0 && !ECHO.energy) vt = null;
    let wall = 0;
    for (let r = 0; r < RINGS; r++) out.parts[`ring${r}`] = { visible: 0 };
    if (vt !== null && ECHO.level) {
      let any = false;
      // The newest rings first; each part shows the newest ring on it.
      const newest = Math.floor(vt / RING_GAP);
      for (let g = newest; g >= Math.max(0, newest - RINGS + 1); g--) {
        const tau = g * RING_GAP;
        const L = ECHO.level(tau);
        if (L === null) {
          any = true; // still being heard
          continue;
        }
        const age = (vt - tau) / RING_TRAVEL;
        if (L < 0.02 || age < 0 || age > 1) continue;
        any = true;
        const s = 0.03 + 0.74 * age; // to the walls
        // Bright and warm near the clap's peak, dim and cool as it fades.
        const col = mix("#7fb6ff", "#fff0b0", L);
        const fade = age < 0.85 ? 1 : 1 - smoothstep(0.85, 1, age);
        out.parts[`ring${g % RINGS}`] = { visible: fade > 0.02 ? 1 : 0, scale: s, tint: col, glow: 0.35 + 0.65 * L, bright: 0.25 + 1.1 * L * fade }; // prettier-ignore
        if (age > 0.9) wall = Math.max(wall, L * (1 - smoothstep(0.9, 1, age) * 0.5));
      }
      if (!any && (ECHO.energy?.done || !ECHO.energy)) {
        ECHO.start = null;
        ECHO.energy = null;
      }
    }
    out.parts.walls = wall > 0.01 ? { tint: "#ffe6a0", glow: 0.35 * wall } : {};
    out.parts.clap = { tint: "#fff3c0", glow: vt !== null && vt < 0.12 ? 1 - vt / 0.12 : 0 };
  },
  build(k) {
    ECHO.start = null;
    ECHO.energy = null;
    ECHO.tapWas = 0;
    ECHO.listening = false;
    // The floor: warm boards along x, a soft light from the front.
    const floorN = Math.round(Math.sqrt(k.count * 0.22));
    sheet(k, {
      cols: floorN,
      rows: floorN,
      size: ((2 * ROOM) / floorN) * 1.5,
      n: [0, 1, 0],
      at: (a, b) => [(a - 0.5) * 2 * ROOM, 0, (b - 0.5) * 2 * ROOM],
      color: (a, b) => {
        const board = Math.floor(b * 14);
        const tone = 0.86 + 0.12 * Math.sin(board * 12.9898) * Math.sin(board * 4.1);
        const grain = 0.04 * Math.sin(a * 60 + board * 7);
        return shade(mix("#8a5a34", "#b07a48", 0.4 + 0.4 * b), tone + grain);
      },
    });
    // Three walls, pale plaster, with a skirting board.
    const walls = k.part("walls");
    const wallN = Math.round(Math.sqrt(k.count * 0.07));
    const wall = (at, n) =>
      sheet(k, {
        cols: wallN * 2,
        rows: Math.max(4, Math.round(wallN * 0.6)),
        size: ((2 * ROOM) / (wallN * 2)) * 1.5,
        n,
        at,
        part: walls,
        color: (a, b) => (b > 0.9 ? "#e8e2d6" : shade("#d9d2c4", 0.92 + 0.08 * b)),
      });
    wall((a, b) => [(a - 0.5) * 2 * ROOM, WALL_H * (1 - b), -ROOM], [0, 0, 1]);
    wall((a, b) => [-ROOM, WALL_H * (1 - b), (a - 0.5) * 2 * ROOM], [1, 0, 0]);
    wall((a, b) => [ROOM, WALL_H * (1 - b), (a - 0.5) * 2 * ROOM], [-1, 0, 0]);
    // The reading: a dark panel on the back wall, its splats colored from
    // the toy's screen (the number).
    const pw = 2.3;
    const ph = pw * (160 / 512);
    const pcols = 260;
    const prows = Math.round(pcols * (ph / pw));
    const panel = [];
    for (let j = 0; j < prows; j++)
      for (let i = 0; i < pcols; i++) {
        const u = (i + 0.5) / pcols;
        const v = (j + 0.5) / prows;
        panel.push({ p: [(u - 0.5) * pw, WALL_H * 0.55 - (v - 0.5) * ph, -ROOM + 0.02], n: [0, 0, 1], flat: 0.03, size: ((pw / pcols) * 1.5) / 0.01, color: "#101418", kind: "screen", params: [u, v], opacity: 1, pattern: false }); // prettier-ignore
      }
    k.cloud({ share: panel.length / k.count, pattern: false }, (rand, i) => panel[i] || null);
    // The clap: a small bright mark where the sound starts.
    const clap = k.part("clap", { pivot: [0, 0.02, 0] });
    k.add(k.sphere(0.06), { pos: [0, 0.06, 0], color: "#fff3c0", part: clap, share: 0.004 });
    // The rings: each a thin circle of splats on the floor about the clap,
    // grown from nothing to the walls by its part's scale.
    const per = 220;
    for (let r = 0; r < RINGS; r++) {
      const ring = k.part(`ring${r}`, { pivot: [0, 0.015, 0] });
      const pts = [];
      for (let i = 0; i < per; i++) {
        const a = (i / per) * TAU;
        pts.push({ p: [1.9 * Math.cos(a), 0.015, 1.9 * Math.sin(a)], n: [0, 1, 0], flat: 0.2, size: 2.4, color: "#ffe9a8", part: ring, opacity: 1, pattern: false }); // prettier-ignore
      }
      k.cloud({ share: per / k.count, pattern: false }, (rand, i) => pts[i] || null);
    }
    k.reach([0, WALL_H + 0.1, ROOM]);
  },
};

// ---- The live view (the splat mirror, Photo to 3D) --------------------------------------
// A picture of relief splats facing the viewer: `cols` by `rows`, `width`
// wide, rising toward the viewer by up to `lift` where the depth says it is
// near. Its canvas (the recipe's screen) holds the colors and the depth.

async function readBytes(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return new Uint8Array(await fs.readFile(url));
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error("Could not load the sample picture.");
  return new Uint8Array(await r.arrayBuffer());
}

const SPLAT_MIRROR = {
  alive: () => live.on("camera"),
  density: 1,
  turntable: false,
  options: [
    { key: "depth", label: "Depth", type: "slider", min: 0, max: 1, step: 0.05, default: 0.6 },
  ],
  controls: [{ key: "flat", label: "Flatten the picture", type: "toggle", default: 0, ease: 1.4 }],
  action: { key: "flat", label: "Flatten or raise the depth" },
  input: {
    title: "Your camera",
    fileButton: false,
    live: [{ kind: "camera", status: mirrorStatus }],
    note: `Tap “Use my camera” and the mirror shows you in splats. The depth model (about 27 MB, loaded the first time) then works out how near each part is, many times a second, and the picture rises into a relief you can turn.`,
  },
  credits: [
    {
      label: "Splat mirror",
      title: "Still Life with Cheese (the picture before the camera is on)",
      source: "https://commons.wikimedia.org/wiki/File:Still_Life_with_Cheese_MET_DT1989.jpg",
      author: "Antoine Vollon (Metropolitan Museum of Art Open Access)",
      license: "CC0 1.0",
      licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    },
  ],
  screen: mirrorScreen,
  async prepare() {
    if (!MIRROR.still) {
      const [jpg, dep] = await Promise.all([
        readBytes("../../assets/toys/photo-3d/still-life.jpg"),
        readBytes("../../assets/toys/photo-3d/still-life.depth"),
      ]);
      MIRROR.still = { photo: await decodePhoto(jpg), depth: unpackDepth(dep) };
    }
  },
  drive(t, c, out) {
    MIRROR.gain = clamp(MIRROR.depth * (1 - (c.flat ?? 0)), 0, 1);
    // The picture sways a little as the depth rises, so the relief shows.
    const r = 1 - (c.flat ?? 0);
    out.body = {
      quat: quatAxisAngle([0, 1, 0], 0.25 * Math.sin(TAU * r) * Math.sin(Math.PI * r) ** 0.5),
    };
  },
  build(k, o) {
    MIRROR.depth = o.depth ?? 0.6;
    const { height } = buildMirror(k, { width: 2, lift: 0.9 });
    // A dark frame round the picture, like a mirror's.
    const f = 0.07;
    const w = 1 + f;
    const h = height / 2 + f;
    const frame = (x, y, sx, sy) =>
      k.add(k.box(sx, sy, 0.06), {
        pos: [x, y, -0.03],
        color: (cc) => shade("#2b2f36", 0.8 + 0.3 * Math.abs(cc.n[2])),
        share: 0.01,
        even: true,
      });
    frame(0, h - f / 2, 2 * w, f);
    frame(0, -h + f / 2, 2 * w, f);
    frame(-w + f / 2, 0, f, 2 * h);
    frame(w - f / 2, 0, f, 2 * h);
    k.reach([0, 0, 0.9]);
    k.data = { mirror: { cols: MIRROR.cols, rows: MIRROR.rows, live: !!MIRROR.cam } };
  },
};

export const RECIPES = {
  "room-echo": ROOM_ECHO,
  "splat-mirror": SPLAT_MIRROR,
};
