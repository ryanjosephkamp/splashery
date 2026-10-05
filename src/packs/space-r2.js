// Space r2 pack (lane Space r2, labs): real worlds from NASA, USGS and NOAA
// maps. Each world is a ball of splats laid on its real elevation map and
// colored from its real color map (src/space/maps.js), turned and lit by
// the sun on the graphics chip (src/space/field.js). A tap flies close to
// one of its named features and back.
//
// The maps are cut by tools/sp2-maps.mjs; the worlds' data (sizes, days,
// features, sources) are in src/space/worlds.js.

import { quatFromTo, fibonacciSphere } from "../kit.js";
import { BITMAP } from "../font.js";
import { WORLDS, worldById } from "../space/worlds.js";
import { loadWorld } from "../space/maps.js";
import {
  WORLD_TYPE,
  worldPart,
  packNormal,
  packExtra,
  worldModifier,
  worldQuat,
} from "../space/field.js";

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const ease = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
const band = (x, a, b) => clamp01((x - a) / (b - a));
const progress = (v) => (v > 0 ? 1 - v : 1);
const unit = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

// A direction from latitude and longitude (degrees): longitude 0 faces +z
// (the viewer), east is +x, north +y.
export function dirOf(lat, lon) {
  const a = lat * DEG;
  const b = lon * DEG;
  return [Math.cos(a) * Math.sin(b), Math.sin(a), Math.cos(a) * Math.cos(b)];
}

// Per-toy memory for drive(), keyed by the control state object.
const MEM = new WeakMap();
function mem(c) {
  let m = MEM.get(c);
  if (!m) MEM.set(c, (m = {}));
  return m;
}

// How fast a world turns: simulated seconds per real second.
const TURNS = {
  still: { label: "Stopped", rate: 0 },
  hour: { label: "3,600× real speed (an hour a second)", rate: 3600 },
  day: { label: "86,400× real speed (a day a second)", rate: 86400 },
};
const RELIEF = [
  { id: "1", label: "True height" },
  { id: "5", label: "×5 (exaggerated)" },
  { id: "10", label: "×10 (exaggerated)" },
  { id: "20", label: "×20 (exaggerated)" },
  { id: "40", label: "×40 (exaggerated)" },
];

// The fly to a feature, in seconds: turn it to the middle, glide in, look,
// glide out, turn back.
const FLY = 10;

// How far above its place a feature's name is stored (recipe units).
const LABEL_UP = 0.04;

// How close up a fly is at time s: 0 far, 1 close.
const closeUp = (s) => ease(band(s, 1.0, 2.2)) * (1 - ease(band(s, FLY - 2.6, FLY - 1.4)));

// Loaded worlds (prepare), by id.
const LOADED = new Map();
// What the last build of each world left for its GPU program (its height step).
const BUILT = new Map();

// A feature's name in the 5 × 7 font's letters.
const labelText = (f) =>
  (f.label || f.name)
    .toUpperCase()
    .replace(/[^A-Z0-9 .,'!?-]/g, "")
    .trim();

// ---- The recipe for a world ---------------------------------------------------------------

function worldRecipe(id, extra = {}) {
  const def = worldById(id);
  const features = def.features || [];
  return {
    alive: true,
    turntable: false,
    options: [
      {
        key: "relief",
        label: "Relief",
        type: "select",
        default: extra.relief ?? "10",
        choices: RELIEF,
      },
      {
        key: "turn",
        label: "Turning",
        type: "select",
        default: extra.turn ?? "hour",
        choices: Object.entries(TURNS).map(([k, v]) => ({ id: k, label: v.label })),
      },
      ...(extra.options || []),
    ],
    controls: [
      { key: "sun", label: "Sun", type: "slider", default: 0.33 },
      { key: "fly", label: "Fly to a feature", type: "pulse", ease: FLY },
    ],
    action: { key: "fly", label: "Fly to a feature and back" },
    note: `${extra.note || ""} Real elevation and color maps; the relief and the turning are scaled as chosen above, and the sun can be moved.`.trim(), // prettier-ignore
    credits: def.credits,
    // A double-tap isn't taken (the view resets as on other toys); having
    // focus lets the drive glide the view to a feature (out.view).
    focus: () => false,
    async prepare() {
      if (!LOADED.has(id)) LOADED.set(id, await loadWorld(id));
    },
    gpuField(options, fit) {
      return worldModifier({
        hstep: (BUILT.get(id)?.hstep ?? 1e-5) * (fit?.scale ?? 1),
        labelUp: LABEL_UP * (fit?.scale ?? 1),
        air: def.atmosphere ? hex(def.atmosphere.color) : [0.6, 0.75, 1],
        night: hex(extra.nightColor || "#ffc070"),
      });
    },
    drive(t, c, out, info) {
      const m = mem(c);
      const data = info?.data || {};
      const dt = m.t === undefined ? 0 : Math.max(0, Math.min(0.25, t - m.t));
      m.t = t;
      m.spin ??= 0;
      const turn = TURNS[data.turn] || TURNS.hour;
      const flying = c.fly > 0;
      // The world's own turn (prograde: east toward the viewer's right).
      if (!flying) m.spin += (dt * turn.rate * TAU) / (def.dayHours * 3600);
      let spin = m.spin;
      let tilt = 0;
      let label = -1;
      // The fly: a new tap picks the next feature in turn.
      const fire = c.fly > (m.lastFly ?? 0) + 0.02;
      m.lastFly = c.fly;
      if (fire && data.features?.length) {
        m.n = (m.n ?? -1) + 1;
        m.pick = m.n % data.features.length;
        m.from = m.spin;
      }
      const f = data.features?.[m.pick];
      if (flying && f) {
        const s = progress(c.fly) * FLY;
        // Turn so the feature faces the viewer (+z), the shortest way round.
        let goal = -f.lon * DEG;
        goal += TAU * Math.round((m.from - goal) / TAU);
        const into = ease(band(s, 0, 1.6));
        const back = ease(band(s, FLY - 1.8, FLY - 0.2));
        spin = m.from + (goal - m.from) * into;
        tilt = f.lat * DEG * into * (1 - back);
        m.spin = spin;
        if (s > 1.2 && s < FLY - 2.4) {
          out.view = { key: `fly${m.n}`, center: [0, 0, f.r], size: [f.size, f.size] };
          const fade = Math.min(band(s, 2.2, 2.8), 1 - band(s, FLY - 3.2, FLY - 2.6));
          if (fade > 0) label = m.pick + Math.min(0.99, fade * 0.5 + 0.001);
        } else out.view = { key: "home" };
      } else out.view = { key: "home" };
      // The sun: its bearing round the world from the slider, a little above
      // the equator.
      const az = (c.sun - 0.5) * TAU;
      const el = 12 * DEG;
      out.glow = [
        Math.sin(az) * Math.cos(el),
        Math.sin(el),
        Math.cos(az) * Math.cos(el),
        data.bright ?? 1.1,
      ];
      out.morph = [spin, tilt, data.ambient ?? 0.03, data.night ?? 0];
      // The relief's exaggeration: as chosen, eased down to at most ×2 close
      // up (steep, tall ground hides what is round it there).
      const E = data.relief ?? 1;
      out.amount = E + (Math.min(E, 2) - E) * (flying && f ? closeUp(progress(c.fly) * FLY) : 0);
      out.press = label;
      // (No re-sort: the far side is hidden, so the near side of a ball sorts
      // well enough in its built pose; sorting it again where it is turned
      // hid a feature's name under the ground close up, October 5, 2026.)
    },
    build(k, o) {
      const W = LOADED.get(id);
      if (!W) throw new Error(`The maps of ${def.name} haven't loaded.`);
      buildWorld(k, W, o, extra);
    },
  };
}

// ---- Building a world ---------------------------------------------------------------------

function buildWorld(k, W, o, extra) {
  const def = W.def;
  // Built at true height; the GPU program lifts the ground by the relief's
  // exaggeration (the drive's amount), which the fit and the frame allow for.
  const E = Number(o.relief) || 1;
  const Rm = def.radiusKm * 1000;
  const N = k.count;
  const heightAt = extra.height
    ? (lat, lon) => extra.height(W.height(lat, lon), lat, lon, o)
    : (lat, lon) => W.height(lat, lon);
  const radius = (lat, lon) => 1 + heightAt(lat, lon) / Rm;
  const patches = W.patches;
  const air = def.atmosphere;
  const shares = {
    air: air ? 0.07 : 0,
    patches: patches.length ? 0.3 : 0,
    labels: 0.012 * patches.length,
  };
  const nGround = Math.floor(N * (1 - shares.air - shares.patches - shares.labels));
  // The caps that the patches cover (angular radius, radians), round each feature.
  const caps = patches.map((p) => ({
    dir: dirOf(p.feature.lat, p.feature.lon),
    r: p.window.r * DEG * 0.98,
    p,
  }));
  const capFrac = caps.reduce((s, c) => s + (1 - Math.cos(c.r)) / 2, 0);
  const nGlobal = Math.round(nGround / Math.max(0.2, 1 - capFrac));
  const spacingG = Math.sqrt((4 * Math.PI) / nGlobal);
  const splats = [];
  let maxR = 1;
  const night = extra.nightLights ? (lat, lon) => 255 * Math.min(1, W.night(lat, lon) * 1.3) : null;

  // One splat of ground at a direction, with the splats' spacing there.
  const ground = (d, spacing) => {
    const sl = Math.max(-1, Math.min(1, d[1]));
    const la = Math.asin(sl);
    const lo = Math.atan2(d[0], d[2]);
    const lat = la / DEG;
    const lon = lo / DEG;
    const r = radius(lat, lon);
    // The ground's normal, from the heights a splat's spacing away: the
    // radius's slope east and north (per radian of arc) tips it.
    const dl = Math.max(spacing * 1.1, 0.0004);
    const cl = Math.max(0.05, Math.cos(la));
    const dre = (radius(lat, lon + dl / cl / DEG) - radius(lat, lon - dl / cl / DEG)) / (2 * dl);
    const drn = (radius(Math.min(90, lat + dl / DEG), lon) - radius(Math.max(-90, lat - dl / DEG), lon)) / (2 * dl); // prettier-ignore
    const so = Math.sin(lo);
    const co = Math.cos(lo);
    // east = (cos lon, 0, −sin lon); north = (−sin lat sin lon, cos lat, −sin lat cos lon)
    let nx = d[0] * r - dre * co + drn * sl * so;
    let ny = d[1] * r - drn * cl;
    let nz = d[2] * r + dre * so + drn * sl * co;
    const nl = Math.hypot(nx, ny, nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    if (nx * d[0] + ny * d[1] + nz * d[2] < 0.2) ((nx = d[0]), (ny = d[1]), (nz = d[2]));
    const col = W.color(lat, lon);
    if (r > maxR) maxR = r;
    splats.push({
      p: [d[0] * r, d[1] * r, d[2] * r],
      h: r - 1,
      n: [nx, ny, nz],
      color: [col[0], col[1], col[2]],
      size: spacing * 0.68,
      type: WORLD_TYPE.ground,
      w: night ? night(lat, lon) : 0,
    });
  };

  // The whole globe, evenly (a golden spiral), leaving out the caps.
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < nGlobal; i++) {
    const y = 1 - (2 * (i + 0.5)) / nGlobal;
    const rr = Math.sqrt(1 - y * y);
    const d = [rr * Math.cos(golden * i), y, rr * Math.sin(golden * i)];
    let inCap = false;
    for (const c of caps) if (d[0] * c.dir[0] + d[1] * c.dir[1] + d[2] * c.dir[2] > Math.cos(c.r)) inCap = true; // prettier-ignore
    if (!inCap) ground(d, spacingG);
  }
  // Each cap, denser, from its sharper patch maps.
  const perPatch = patches.length ? Math.floor((N * shares.patches) / patches.length) : 0;
  for (const c of caps) {
    const area = TAU * (1 - Math.cos(c.r));
    const sp = Math.sqrt(area / perPatch);
    const q = quatFromTo([0, 1, 0], c.dir);
    const lo = Math.cos(c.r);
    for (let i = 0; i < perPatch; i++) {
      const y = 1 - ((1 - lo) * (i + 0.5)) / perPatch;
      const rr = Math.sqrt(Math.max(0, 1 - y * y));
      const a = i * 2.399963229728653;
      const v = rotate(q, [rr * Math.cos(a), y, rr * Math.sin(a)]);
      // Splats near the cap's edge grow toward the globe's spacing, so the
      // seam closes.
      const edge = clamp01((Math.acos(Math.min(1, y)) / c.r - 0.85) / 0.15);
      ground(v, sp + (spacingG - sp) * edge * 0.6);
    }
  }
  // The atmosphere's rim: a thin shell just above the ground.
  if (air) {
    const n = Math.floor(N * shares.air);
    const shell = fibonacciSphere(n);
    const r0 = maxR + 0.002 / E;
    const sz = Math.sqrt((4 * Math.PI) / n) * 0.55;
    for (let i = 0; i < n; i++) {
      const d = shell[i];
      const r = r0 + air.thickness * ((i * 0.618034) % 1);
      splats.push({ p: [d[0] * r, d[1] * r, d[2] * r], h: maxR - 1, n: d, color: [1, 1, 1], size: sz, type: WORLD_TYPE.air, w: 0, opacity: air.strength, flat: 1 }); // prettier-ignore
    }
  }
  // Each feature's name, lying on the ground below it (shown during a fly).
  const flyTo = [];
  patches.forEach((pt, idx) => {
    const f = pt.feature;
    const d = dirOf(f.lat, f.lon);
    const rf = radius(f.lat, f.lon);
    // The view: a square round the feature, a little smaller than its patch.
    const view = 2 * Math.sin(pt.window.r * DEG * 0.62) * rf;
    flyTo.push({ id: f.id, name: f.name, lat: f.lat, lon: f.lon, r: rf, size: view });
    const text = labelText(f);
    const east = unit(cross([0, 1, 0], d));
    const north = cross(d, east);
    const px = Math.min(view * 0.8, view * 1.4 * 0.5) / Math.max(12, text.length * 6);
    const across = text.length * 6 - 1;
    const top = view * 0.4;
    const dots = [];
    for (let ci = 0; ci < text.length; ci++) {
      const g = BITMAP[text[ci]];
      if (!g) continue;
      for (let gy = 0; gy < 7; gy++)
        for (let gx = 0; gx < 5; gx++)
          if ((g[gy] >> (4 - gx)) & 1) dots.push([(ci * 6 + gx - across / 2) * px, top - gy * px]);
    }
    // Above the highest ground under the name.
    let lift = rf;
    for (const [sx, sy] of dots) {
      const v = unit([d[0] + east[0] * sx + north[0] * sy, d[1] + east[1] * sx + north[1] * sy, d[2] + east[2] * sx + north[2] * sy]); // prettier-ignore
      lift = Math.max(lift, radius(Math.asin(v[1]) / DEG, Math.atan2(v[0], v[2]) / DEG));
    }
    lift += 0.001 + view * 0.06;
    for (const [sx, sy] of dots)
      splats.push({
        // Stored LABEL_UP higher (see src/space/field.js).
        p: [d[0] * (lift + LABEL_UP) + east[0] * sx + north[0] * sy, d[1] * (lift + LABEL_UP) + east[1] * sx + north[1] * sy, d[2] * (lift + LABEL_UP) + east[2] * sx + north[2] * sy], // prettier-ignore
        h: lift - 1,
        n: d,
        color: [1, 1, 1],
        size: px * 0.62,
        type: WORLD_TYPE.label,
        w: idx,
        opacity: 1,
      });
  });

  // Hand the splats to the kit, exactly as built (no size jitter).
  const R = 1 + E * (maxR - 1) + (air ? air.thickness + 0.003 : 0);
  for (const s of [[R, 0, 0], [-R, 0, 0], [0, R, 0], [0, -R, 0], [0, 0, R], [0, 0, -R]]) k.reach(s); // prettier-ignore
  // Heights in steps the program reads back (16 bits either side of 0).
  let hmax = 1e-6;
  for (const s of splats) hmax = Math.max(hmax, Math.abs(s.h));
  const hstep = hmax / 32000;
  BUILT.set(def.id, { hstep });
  k.cloud({ count: (splats.length * 160000) / N + 1, jitter: 0 }, (_rand, i) => {
    const s = splats[i];
    if (!s) return null;
    const flat = s.flat ?? 0.18;
    return {
      p: s.p,
      scales: [s.size, s.size, s.size * flat],
      quat: discQuat(s.n),
      color: s.color,
      opacity: Math.min(0.99, s.opacity ?? 0.99),
      part: worldPart(s.type),
      params: [packNormal(s.n), packExtra(s.h / hstep, s.w)],
    };
  });
  k.data = {
    relief: E,
    features: flyTo,
    turn: o.turn,
    ambient: extra.ambient ?? 0.03,
    bright: extra.bright ?? 1.1,
    night: night ? 1 : 0,
  };
}

// The turn whose x, y and z axes go to the unit vectors a, b and c.
function quatFromAxes(a, b, c) {
  const tr = a[0] + b[1] + c[2];
  let q;
  if (tr > 0) {
    const t = Math.sqrt(tr + 1) * 2;
    q = [(b[2] - c[1]) / t, (c[0] - a[2]) / t, (a[1] - b[0]) / t, t / 4];
  } else if (a[0] > b[1] && a[0] > c[2]) {
    const t = Math.sqrt(1 + a[0] - b[1] - c[2]) * 2;
    q = [t / 4, (b[0] + a[1]) / t, (c[0] + a[2]) / t, (b[2] - c[1]) / t];
  } else if (b[1] > c[2]) {
    const t = Math.sqrt(1 + b[1] - a[0] - c[2]) * 2;
    q = [(b[0] + a[1]) / t, t / 4, (c[1] + b[2]) / t, (c[0] - a[2]) / t];
  } else {
    const t = Math.sqrt(1 + c[2] - a[0] - b[1]) * 2;
    q = [(c[0] + a[2]) / t, (c[1] + b[2]) / t, t / 4, (a[1] - b[0]) / t];
  }
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

// The turn that takes +z to n (n a unit vector).
function discQuat(n) {
  const w = 1 + n[2];
  if (w < 1e-6) return [1, 0, 0, 0];
  const l = Math.hypot(-n[1], n[0], w);
  return [-n[1] / l, n[0] / l, 0, w / l];
}

function rotate(q, v) {
  const [x, y, z, w] = q;
  const cx = y * v[2] - z * v[1] + w * v[0];
  const cy = z * v[0] - x * v[2] + w * v[1];
  const cz = x * v[1] - y * v[0] + w * v[2];
  return [v[0] + 2 * (y * cz - z * cy), v[1] + 2 * (z * cx - x * cz), v[2] + 2 * (x * cy - y * cx)];
}

// ---- The toys -----------------------------------------------------------------------------

export const RECIPES = {
  "real-moon": worldRecipe("moon", {
    relief: "10",
    turn: "day",
    note: "The Moon from the Lunar Reconnaissance Orbiter's camera and laser altimeter.",
  }),
  "real-mars": worldRecipe("mars", {
    bright: 1.3,
    relief: "10",
    turn: "hour",
    note: "Mars from the Viking orbiters' color mosaic and the Mars Global Surveyor's laser altimeter.",
  }),
  "real-earth": worldRecipe("earth", {
    bright: 1.7,
    relief: "20",
    turn: "hour",
    note: "Earth from NASA's Blue Marble and NOAA's ETOPO 2022 relief; the lights at night are NASA's Black Marble.",
    // The oceans lie at sea level (their floors are in the map too).
    height: (h) => Math.max(0, h),
    nightLights: true,
    nightColor: "#ffc46a",
    ambient: 0.02,
  }),
  "real-mercury": worldRecipe("mercury", {
    bright: 1.5,
    relief: "10",
    turn: "day",
    note: "Mercury from NASA's MESSENGER spacecraft (its colors stretched to show the rocks apart).",
  }),
  "real-venus": worldRecipe("venus", {
    relief: "10",
    turn: "day",
    note: "Venus's hidden surface from NASA's Magellan radar: radar brightness tinted orange, not what an eye would see.",
  }),
};

// For other packs: every real world's id.
export const REAL_WORLDS = WORLDS.map((w) => w.id);
