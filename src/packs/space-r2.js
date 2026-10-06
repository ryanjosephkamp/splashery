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
import { loadWorld, decodeJpeg } from "../space/maps.js";
import { GALAXIES } from "../space/galaxies.js";
import { parseModel, prepareModel, sampleSurface, SPLAT_FLAT } from "./studio-models-core.js";
import { decodeImage } from "./studio-models.js";
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

function worldRecipe(ids, extra = {}) {
  // One world, or a choice of several (the Toy tab's World).
  const list = [].concat(ids);
  const pick = (o) => (list.includes(o?.world) ? o.world : list[0]);
  const def = worldById(list[0]);
  const relief = list.some((id) => worldById(id).maps.height);
  return {
    // Polish round: the labs sharp kernel and twice the tier's splats (capped
    // by the tier), most of the extra going to the feature close-ups.
    kernel: "sharp",
    density: 2,
    alive: true,
    turntable: false,
    options: [
      ...(list.length > 1
        ? [
            {
              key: "world",
              label: "World",
              type: "select",
              default: list[0],
              choices: list.map((id) => ({
                id,
                label: worldById(id).name.replace(/^the /, "The "),
              })),
            },
          ]
        : []),
      ...(relief
        ? [
            {
              key: "relief",
              label: "Relief",
              type: "select",
              default: extra.relief ?? "10",
              choices: RELIEF,
            },
          ]
        : []),
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
    note: `${extra.note || ""} ${relief ? "Real elevation and color maps; the relief and the turning are scaled as chosen above" : "Real maps (no elevation map exists for these, so the ground is smooth); the turning is scaled as chosen above"}, and the sun can be moved.`.trim(), // prettier-ignore
    credits: list.flatMap((id) => worldById(id).credits.map((c) => (list.length > 1 ? { ...c, label: `${worldById(id).name}: ${c.label.toLowerCase()}` } : c))), // prettier-ignore
    // A double-tap isn't taken (the view resets as on other toys); having
    // focus lets the drive glide the view to a feature (out.view).
    focus: () => false,
    async prepare(o) {
      const id = pick(o);
      if (!LOADED.has(id)) LOADED.set(id, await loadWorld(id));
    },
    gpuField(options, fit) {
      const id = pick(options);
      const d = worldById(id);
      return worldModifier({
        hstep: (BUILT.get(id)?.hstep ?? 1e-5) * (fit?.scale ?? 1),
        air: d.atmosphere ? hex(d.atmosphere.color) : [0.6, 0.75, 1],
        night: hex(extra.nightColor || "#ffc070"),
      });
    },
    drive(t, c, out, info) {
      const m = mem(c);
      const data = info?.data || {};
      const dt = m.t === undefined ? 0 : Math.max(0, Math.min(0.25, t - m.t));
      m.t = t;
      // (It starts with its best-known face toward the viewer.)
      m.spin ??= -(data.face ?? 0) * DEG;
      const turn = TURNS[data.turn] || TURNS.hour;
      const flying = c.fly > 0;
      // The world's own turn (prograde: east toward the viewer's right).
      const day = data.dayHours || def.dayHours;
      if (!flying) m.spin += (dt * turn.rate * TAU) / (day * 3600);
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
      const id = pick(o);
      const W = LOADED.get(id);
      if (!W) throw new Error(`The maps of ${worldById(id).name} haven't loaded.`);
      buildWorld(k, W, o, { ...extra, ...(extra.per?.[id] || {}) });
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
    patches: patches.length ? 0.42 : 0,
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
    // Just above the mean ground (tall mountains rise through it).
    const r0 = 1 + 0.002;
    const sz = Math.sqrt((4 * Math.PI) / n) * 0.55;
    for (let i = 0; i < n; i++) {
      const d = shell[i];
      const r = r0 + air.thickness * ((i * 0.618034) % 1);
      splats.push({ p: [d[0] * r, d[1] * r, d[2] * r], h: 0, n: d, color: [1, 1, 1], size: sz, type: WORLD_TYPE.air, w: 0, opacity: air.strength, flat: 1 }); // prettier-ignore
    }
  }
  // Each feature's name, lying on the ground below it (shown during a fly).
  const flyTo = [];
  patches.forEach((pt, idx) => {
    const f = pt.feature;
    const d = dirOf(f.lat, f.lon);
    const rf = radius(f.lat, f.lon);
    // The view: a square round the feature, a little wider than the feature
    // (or most of its patch, for a small one).
    const featureView = (1.5 * (f.km || 0)) / def.radiusKm;
    const view = Math.min(1.2, Math.max(2 * Math.sin(pt.window.r * DEG * 0.62), featureView)) * rf;
    flyTo.push({ id: f.id, name: f.name, lat: f.lat, lon: f.lon, r: rf, size: view });
    const text = labelText(f);
    const east = unit(cross([0, 1, 0], d));
    const north = cross(d, east);
    const px = (view * 0.55) / Math.max(66, text.length * 6); // (short names no bigger than 11 letters' worth)
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
    // Above the highest ground under the name at the close-up's
    // exaggeration (×2 at most), stored where it shows during the fly: the
    // feature turned to face +z, east to the right and north up.
    let lift = rf;
    for (const [sx, sy] of dots) {
      const v = unit([d[0] + east[0] * sx + north[0] * sy, d[1] + east[1] * sx + north[1] * sy, d[2] + east[2] * sx + north[2] * sy]); // prettier-ignore
      lift = Math.max(lift, 1 + Math.min(E, 2) * (radius(Math.asin(v[1]) / DEG, Math.atan2(v[0], v[2]) / DEG) - 1)); // prettier-ignore
    }
    lift += 0.001 + view * 0.06;
    for (const [sx, sy] of dots)
      splats.push({
        p: [sx, sy, lift],
        h: 0,
        n: [0, 0, 1],
        color: [1, 1, 1],
        size: px * 0.62,
        type: WORLD_TYPE.label,
        w: idx,
        opacity: 1,
      });
  });

  // Hand the splats to the kit, exactly as built (no size jitter).
  const R = Math.max(1 + E * (maxR - 1), air ? 1 + air.thickness + 0.003 : 0);
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
    dayHours: def.dayHours,
    face: def.face ?? 0,
    relief: W.def.maps.height ? E : 1,
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
  "real-moons": worldRecipe(["io", "europa", "ganymede", "callisto", "titan"], {
    turn: "day",
    note: "The big moons of Jupiter and Saturn, from the Voyager, Galileo and Cassini spacecraft.",
    per: { io: { bright: 1.25 }, europa: { bright: 1.05 }, ganymede: { bright: 1.15 }, callisto: { bright: 1.5 }, titan: { bright: 1.2 } }, // prettier-ignore
  }),
  "real-small-worlds": worldRecipe(["pluto", "ceres", "vesta"], {
    relief: "1",
    turn: "hour",
    note: "Pluto from New Horizons, and Ceres and Vesta from Dawn.",
    per: { pluto: { bright: 1.1 }, ceres: { bright: 1.6 }, vesta: { bright: 1.3 } },
  }),
};

// ---- Stars near the Sun -------------------------------------------------------------------

const STARS = { data: null };
async function readJson(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    return JSON.parse(await fs.readFile(url, "utf8"));
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${rel.split("/").pop()}.`);
  return r.json();
}

// A star's color from its temperature: a blackbody's color in sRGB, from
// Tanner Helland's fit to Mitchell Charity's blackbody table (good to a few
// percent between 1,000 and 40,000 K).
export function starColor(teff) {
  const t = Math.max(1000, Math.min(40000, teff || 5800)) / 100;
  let r;
  let g;
  let b;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * Math.pow(t - 60, -0.1332047592);
    g = 288.1221695283 * Math.pow(t - 60, -0.0755148492);
    b = 255;
  }
  const c = (v) => Math.max(0, Math.min(255, v)) / 255;
  return [c(r), c(g), c(b)];
}

// The stars a tap flies to, in turn (names as the data file has them).
const STAR_TOUR = [
  // (Proxima Centauri, the nearest star, sits right beside Alpha Centauri A
  // and B at this scale: it is their small third star.)
  { name: "Rigil Kentaurus", label: "ALPHA CENTAURI" },
  { name: "Sirius", label: "SIRIUS" },
  { name: "Barnard's Star", label: "BARNARD'S STAR" },
  { name: "Vega", label: "VEGA" },
  { name: "Arcturus", label: "ARCTURUS" },
];
const LY_PER_PC = 3.26156;
const STAR_FLY = 8;
const STAR_R = 20; // parsecs to the edge

const starsRecipe = {
  // Polish round: the labs sharp kernel for crisper stars and lines.
  kernel: "sharp",
  alive: true,
  turntable: true,
  controls: [{ key: "fly", label: "Fly to a star", type: "pulse", ease: STAR_FLY }],
  action: { key: "fly", label: "Fly to the next star and back" },
  options: [
    {
      key: "size",
      label: "Star sizes",
      type: "select",
      default: "bright",
      choices: [
        { id: "bright", label: "By brightness" },
        { id: "same", label: "All the same" },
      ],
    },
  ],
  note: "Stars within 65 light-years of the Sun, where Gaia measured them; the brightest few, which Gaia cannot measure, from Hipparcos. Colors from their temperatures; sizes show brightness, not the stars' real sizes.",
  credits: [
    {
      label: "Stars",
      title: "Gaia Catalogue of Nearby Stars (Gaia Collaboration, Smart et al. 2021, A&A 649, A6)",
      source: "https://vizier.cds.unistra.fr/viz-bin/VizieR?-source=J/A+A/649/A6",
      author: "ESA/Gaia/DPAC",
      license: "CC BY-SA 3.0 IGO",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0/igo/",
    },
    {
      label: "The brightest stars and star names",
      title: "HYG database v4.4",
      source: "https://codeberg.org/astronexus/hyg",
      author: "David Nash (astronexus)",
      license: "CC BY-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
    },
  ],
  focus: () => false,
  async prepare() {
    STARS.data ||= await readJson("../../assets/toys/nearby-stars/stars.json");
  },
  drive(t, c, out, info) {
    const m = mem(c);
    const data = info?.data || {};
    const tour = data.tour || [];
    const fire = c.fly > (m.lastFly ?? 0) + 0.02;
    m.lastFly = c.fly;
    if (fire && tour.length) m.n = (m.n ?? -1) + 1;
    const pick = tour.length ? (m.n ?? 0) % tour.length : -1;
    tour.forEach((_, i) => (out.parts[`label${i}`] = { visible: 0 }));
    out.parts.plane = { visible: 1 };
    out.view = { key: "home" };
    if (c.fly > 0 && pick >= 0) {
      const s = progress(c.fly) * STAR_FLY;
      const st = tour[pick];
      if (s > 0.2 && s < STAR_FLY - 1.6) {
        out.view = { key: `star${m.n}`, center: st.p, size: [0.22, 0.22] };
        const fade = Math.min(band(s, 1.0, 1.5), 1 - band(s, STAR_FLY - 2.4, STAR_FLY - 1.8));
        out.parts[`label${pick}`] = { visible: fade };
        // (Seen edge on from the side, the plane's rings would be a line.)
        out.parts.plane = { visible: 1 - Math.min(band(s, 0.2, 0.8), 1 - band(s, STAR_FLY - 1.8, STAR_FLY - 1.2)) }; // prettier-ignore
      }
    }
  },
  build(k, o) {
    const D = STARS.data;
    if (!D) throw new Error("The stars haven't loaded.");
    const same = o.size === "same";
    const list = D.stars;
    const sizeOf = (absG) =>
      same ? 1 : Math.max(0.45, Math.min(4.5, Math.pow(10, -0.1 * (absG - 5))));
    // Each star: a bright core and, for the brighter ones, a faint glow.
    const base = 0.006;
    const core = [];
    for (const st of list) {
      const p = [st[0] / STAR_R, st[2] / STAR_R, -st[1] / STAR_R];
      core.push({ p, s: sizeOf(st[3]), c: starColor(st[4]), name: st[6] });
    }
    core.push({ p: [0, 0, 0], s: same ? 1 : 1.0, c: starColor(5772), name: "Sun" });
    k.cloud({ count: (core.length * 160000) / k.count + 1, jitter: 0 }, (_r, i) => {
      const s = core[i];
      if (!s) return null;
      const z = base * s.s;
      return { p: s.p, scales: [z, z, z], color: s.c, opacity: 0.97 };
    });
    const glow = core.filter((s) => s.s > 1.2 || s.name === "Sun");
    k.cloud({ count: (glow.length * 160000) / k.count + 1, jitter: 0, pattern: false }, (_r, i) => {
      const s = glow[i];
      if (!s) return null;
      const z = base * s.s * 3;
      return { p: s.p, scales: [z, z, z], color: s.c, opacity: 0.18 };
    });
    // The Galactic plane: faint rings 5, 10, 15 and 20 parsecs from the Sun
    // (16, 33, 49 and 65 light-years), and a cross toward the Galaxy's center.
    const ring = [];
    for (const r of [5, 10, 15, 20]) {
      const n = Math.round(80 * r);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        ring.push({ p: [(r / STAR_R) * Math.cos(a), 0, (r / STAR_R) * Math.sin(a)], dir: [-Math.sin(a), 0, Math.cos(a)], len: (TAU * r) / STAR_R / n }); // prettier-ignore
      }
    }
    for (let i = 0; i < 200; i++) {
      const x = -1 + (i + 0.5) / 100;
      ring.push({ p: [x, 0, 0], dir: [1, 0, 0], len: 0.01 });
    }
    const plane = k.part("plane");
    k.cloud(
      { count: (ring.length * 160000) / k.count + 1, jitter: 0, pattern: false, part: plane },
      (_r, i) => {
        const e = ring[i];
        if (!e) return null;
        return { p: e.p, scales: [e.len * 0.45, 0.0012, 0.0012], quat: discQuatAlong(e.dir), color: [0.35, 0.45, 0.65], opacity: 0.5 }; // prettier-ignore
      },
    );
    // The names a fly shows, each a part (hidden until its fly), lying in
    // the view's plane under the star.
    const tour = [];
    for (const t of STAR_TOUR) {
      const st = core.find((s) => s.name === t.name);
      if (!st) continue;
      const i = tour.length;
      const dist = Math.hypot(...st.p) * STAR_R * LY_PER_PC;
      const text = `${t.label} ${dist.toFixed(1)} LY`;
      tour.push({ name: t.name, p: st.p, ly: dist });
      const part = k.part(`label${i}`);
      const px = (0.22 * 0.8) / (text.length * 6);
      const dots = [];
      // A thin ring round the star, then its name below it.
      for (let a = 0; a < 48; a++) dots.push([0.018 * Math.cos((a / 48) * TAU), 0.018 * Math.sin((a / 48) * TAU), true]); // prettier-ignore
      text.split("").forEach((ch, ci) => {
        const g = BITMAP[ch];
        if (!g) return;
        for (let gy = 0; gy < 7; gy++)
          for (let gx = 0; gx < 5; gx++)
            if ((g[gy] >> (4 - gx)) & 1) dots.push([(ci * 6 + gx - (text.length * 6 - 1) / 2) * px, -0.05 - gy * px]); // prettier-ignore
      });
      // White letters on a dark shadow, readable on a light or dark background.
      k.cloud(
        { count: (2 * dots.length * 160000) / k.count + 1, jitter: 0, part, pattern: false },
        (_r, j) => {
          const d = dots[j % dots.length];
          if (j >= 2 * dots.length) return null;
          const shadow = j < dots.length;
          const o = shadow ? px * 0.35 : 0;
          const z = px * (shadow ? 0.9 : 0.6) * (d[2] ? 0.5 : 1);
          return { p: [st.p[0] + d[0] + o, st.p[1] + d[1] - o, st.p[2] + (shadow ? 0.008 : 0.01)], scales: [z, z, z], color: shadow ? [0.04, 0.06, 0.12] : d[2] ? [1, 0.85, 0.4] : [1, 1, 1], opacity: 0.95 }; // prettier-ignore
        },
      );
    }
    for (const s of [[1.02, 0, 0], [-1.02, 0, 0], [0, 1.02, 0], [0, -1.02, 0], [0, 0, 1.02], [0, 0, -1.02]]) k.reach(s); // prettier-ignore
    k.data = { tour, stars: core.length };
  },
};

// A turn that lays a splat's x axis along dir.
function discQuatAlong(dir) {
  const a = unit(dir);
  const w = 1 + a[0];
  if (w < 1e-6) return [0, 0, 1, 0];
  const l = Math.hypot(0, -a[2], a[1], w);
  return [0, -a[2] / l, a[1] / l, w / l];
}

RECIPES["nearby-stars"] = starsRecipe;

// ---- Real galaxies -------------------------------------------------------------------------

const GAL_PICS = new Map();
async function readBytes(rel) {
  const url = new URL(rel, import.meta.url);
  if (url.protocol === "file:") {
    const fs = await import("node:fs/promises");
    const b = await fs.readFile(url);
    return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${rel.split("/").pop()}.`);
  return new Uint8Array(await r.arrayBuffer());
}
const GAL_TURN = 7;
// The guessed thickness: the disk's exponential scale height, as a share of
// the galaxy's radius (a scale height about an eighth of the disk's scale
// length, which is about a third of the radius pictured).
const DISK_HEIGHT = 0.035;

const galaxyRecipe = {
  // Polish round: the labs sharp kernel and twice the tier's splats (capped
  // by the tier) for crisper edges.
  kernel: "sharp",
  density: 2,
  alive: true,
  turntable: false,
  options: [
    {
      key: "galaxy",
      label: "Galaxy",
      type: "select",
      default: "m51",
      choices: GALAXIES.map((g) => ({ id: g.id, label: g.name })),
    },
  ],
  controls: [{ key: "turn", label: "Turn it edge on", type: "pulse", ease: GAL_TURN }],
  action: { key: "turn", label: "Turn it edge on and back" },
  note: "Every color is where the telescope's picture puts it; only the depth is a guess (a thin disk and a round bulge), which a tap shows by turning the galaxy edge on.",
  credits: GALAXIES.map((g) => ({
    label: g.name,
    title: `${g.name}, ${g.page.split("/").filter(Boolean).pop()}`,
    source: g.page,
    author: g.credit,
    license: "CC BY 4.0",
    licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
  })),
  async prepare(o) {
    const id = GALAXIES.some((g) => g.id === o?.galaxy) ? o.galaxy : "m51";
    if (!GAL_PICS.has(id)) GAL_PICS.set(id, await decodeJpeg(await readBytes(`../../assets/toys/real-galaxies/${id}.jpg`))); // prettier-ignore
  },
  drive(t, c, out) {
    const p = progress(c.turn);
    const a = c.turn > 0 ? ease(band(p, 0, 0.35)) * (1 - ease(band(p, 0.7, 1))) : 0;
    out.parts.disk = { angle: -a * 88 * DEG };
  },
  build(k, o) {
    const def = GALAXIES.find((g) => g.id === o.galaxy) || GALAXIES[0];
    const img = GAL_PICS.get(def.id);
    if (!img) throw new Error("The galaxy hasn't loaded.");
    const { w, h, rgb } = img;
    // Brightness above the sky, raised a little so the arms get the splats.
    const lum = new Float32Array(w * h);
    for (let k2 = 0; k2 < w * h; k2++) lum[k2] = (0.3 * rgb[k2 * 3] + 0.59 * rgb[k2 * 3 + 1] + 0.11 * rgb[k2 * 3 + 2]) / 255; // prettier-ignore
    const sorted = Array.from(lum).sort((a, b) => a - b);
    const sky = sorted[Math.floor(sorted.length * 0.05)];
    const weight = new Float64Array(w * h);
    let total = 0;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const x = ((i + 0.5) / w) * 2 - 1;
        const y = ((j + 0.5) / h) * 2 - 1;
        const r = Math.hypot(x, y);
        const v = r > 1 ? 0 : Math.pow(Math.max(0, lum[j * w + i] - sky - 0.01), 0.6) * (1 - smooth01((r - 0.92) / 0.08)); // prettier-ignore
        weight[j * w + i] = v;
        total += v;
      }
    const cdf = new Float64Array(w * h);
    let acc = 0;
    for (let q = 0; q < w * h; q++) cdf[q] = acc += weight[q] / total;
    const N = Math.floor(k.count * 0.97);
    const pix = 2 / w;
    const rand = k.rand;
    const disk = k.part("disk", { pivot: [0, 0, 0], axis: [1, 0, 0] });
    let q = 0;
    k.cloud({ count: (N * 160000) / k.count, jitter: 0, part: disk }, (_r, i) => {
      const u = (i + rand()) / N;
      while (q < cdf.length - 1 && cdf[q] < u) q++;
      const px = q % w;
      const py = Math.floor(q / w);
      const x = ((px + rand()) / w) * 2 - 1;
      const y = 1 - ((py + rand()) / h) * 2;
      const r = Math.hypot(x, y);
      // The guess: a round bulge in the middle, a thin disk elsewhere.
      const g = def.bulge;
      const gauss = (rand() + rand() + rand() + rand() - 2) * 1.73;
      const lap = (rand() < 0.5 ? -1 : 1) * Math.log(1 / Math.max(1e-6, rand()));
      const z =
        r < g
          ? gauss * 0.45 * Math.sqrt(g * g - r * r) + lap * DISK_HEIGHT * 0.5
          : lap * DISK_HEIGHT;
      const expected = (N * weight[q]) / total;
      // (No bigger than 4 pixels, so the sparse outskirts stay fine dust, not blobs.)
      const sz = Math.min(4, Math.max(0.5, 1 / Math.sqrt(Math.max(expected, 1e-3)))) * pix * 1.05;
      const c = q * 3;
      // Faint light is drawn see-through, so the dark sky between the arms
      // stays dark; the picture's last fifth fades out, so no edge shows.
      const fade = 1 - smooth01((r - 0.78) / 0.22);
      const op = Math.min(0.9, Math.max(0.06, (lum[q] - sky) * 2.6)) * fade;
      // (Flat in the disk, so it stays thin seen edge on; round in the bulge.)
      const flat = r < g ? 0.7 : 0.25;
      return { p: [x, y, z], scales: [sz, sz, sz * flat], color: [rgb[c] / 255, rgb[c + 1] / 255, rgb[c + 2] / 255], opacity: op }; // prettier-ignore
    });
    for (const s of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]]) k.reach(s); // prettier-ignore
    k.data = { galaxy: def.id };
  },
};
const smooth01 = (x) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

RECIPES["real-galaxies"] = galaxyRecipe;

// ---- Real star systems ---------------------------------------------------------------------

const SYS = { data: null };
const SYS_TURN = 7;
const SYS_SPEEDS = [
  { id: "1", label: "A day each second" },
  { id: "10", label: "10 days each second" },
  { id: "100", label: "100 days each second" },
];
// Planets of unknown color, by size: rocky, mini-Neptune, giant.
const sizeColor = (re) => (re < 1.6 ? [0.62, 0.55, 0.5] : re < 4 ? [0.52, 0.68, 0.82] : [0.82, 0.72, 0.56]); // prettier-ignore
const SOLAR_COLORS = { Mercury: [0.62, 0.6, 0.58], Venus: [0.9, 0.82, 0.62], Earth: [0.35, 0.55, 0.85], Mars: [0.8, 0.45, 0.28] }; // prettier-ignore

const systemsRecipe = {
  // Polish round: the labs sharp kernel for crisper stars and lines.
  kernel: "sharp",
  alive: true,
  // focus lets the drive glide the view to the side (out.view).
  focus: () => false,
  turntable: false,
  options: [
    {
      key: "system",
      label: "System",
      type: "select",
      default: "trappist-1",
      choices: [
        { id: "trappist-1", label: "TRAPPIST-1" },
        { id: "toi-178", label: "TOI-178" },
        { id: "55-cnc", label: "55 Cancri" },
        { id: "inner-solar-system", label: "The inner Solar System" },
      ],
    },
    { key: "speed", label: "Speed", type: "select", default: "1", choices: SYS_SPEEDS },
    {
      key: "spacing",
      label: "Distances",
      type: "select",
      default: "true",
      choices: [
        { id: "true", label: "To scale" },
        { id: "spread", label: "Spread out (not to scale)" },
      ],
    },
  ],
  controls: [{ key: "edge", label: "See it from Earth", type: "pulse", ease: SYS_TURN }],
  action: { key: "edge", label: "Turn it to the view from Earth and back" },
  note: "Real planetary systems from the NASA Exoplanet Archive: the orbits' sizes and periods are measured; the star and the planets are drawn much larger than the orbits' scale, and the planets' colors are not known (they show their size class).",
  credits: [
    {
      label: "Planets",
      title: "NASA Exoplanet Archive, Planetary Systems Composite Parameters",
      source: "https://exoplanetarchive.ipac.caltech.edu/",
      author: "NASA Exoplanet Science Institute (Caltech/IPAC)",
      license: "CC0 (NASA mission data)",
      licenseUrl: "https://science.data.nasa.gov/about/license",
    },
  ],
  async prepare() {
    SYS.data ||= await readJson("../../assets/toys/star-systems/systems.json");
  },
  drive(t, c, out, info) {
    const m = mem(c);
    const d = info?.data;
    if (!d) return;
    const dt = m.t === undefined ? 0 : Math.max(0, Math.min(0.25, t - m.t));
    m.t = t;
    m.days = (m.days ?? 0) + dt * d.speed;
    out.tokens = d.planets.map((p) => {
      const a = p.phase + (TAU * m.days) / p.period;
      return { base: [p.r, 0, 0], offset: [p.r * Math.cos(a) - p.r, 0, -p.r * Math.sin(a)] };
    });
    // Sort the planets again now and then where they are.
    if (t - (m.sorted ?? -1) > 0.4) {
      m.sorted = t;
      out.resort = true;
    }
    // Seen from Earth: these systems were found because their planets pass
    // in front of their stars, so we see their orbits almost edge on.
    const p = progress(c.edge);
    // The view glides to the side, level with the orbits, and back.
    out.view = { key: "home" };
    if (c.edge > 0 && p > 0.02 && p < 0.72)
      out.view = { key: "edge", center: [0, 0, 0], size: [2.2, 2.2] };
  },
  build(k, o) {
    const D = SYS.data;
    if (!D) throw new Error("The systems haven't loaded.");
    const sys = D.systems.find((x) => x.id === o.system) || D.systems[0];
    const amax = Math.max(...sys.planets.map((p) => p.aAU));
    const spread = o.spacing === "spread";
    const rOf = (a) => (spread ? Math.sqrt(a / amax) : a / amax);
    const maxRe = Math.max(...sys.planets.map((p) => p.radiusEarth || 1));
    // The biggest planet drawn 0.035 across the system's radius; the star
    // at least 0.05 (both far larger than to scale).
    const k1 = 0.035 / maxRe;
    const starR = Math.max(0.05, Math.min(0.12, (sys.star.radiusSun * 0.00465) / amax));
    const golden = Math.PI * (3 - Math.sqrt(5));
    const sphere = (n, i) => {
      const y = 1 - (2 * (i + 0.5)) / n;
      const rr = Math.sqrt(1 - y * y);
      return [rr * Math.cos(golden * i), y, rr * Math.sin(golden * i)];
    };
    // The star: a glowing ball in its temperature's color.
    const sc = starColor(sys.star.teff);
    k.cloud({ count: (2500 * 160000) / k.count, jitter: 0, pattern: false }, (_r, i) => {
      const d = sphere(2500, i);
      return { p: d.map((v) => v * starR), scales: [starR * 0.12, starR * 0.12, starR * 0.12], color: sc, opacity: 0.95 }; // prettier-ignore
    });
    k.cloud({ count: (400 * 160000) / k.count, jitter: 0, pattern: false }, (rand) => {
      const u = randDir3(rand);
      const r = starR * (1.1 + 0.8 * rand());
      return { p: u.map((v) => v * r), scales: [starR * 0.3, starR * 0.3, starR * 0.3], color: sc, opacity: 0.12 }; // prettier-ignore
    });
    // The orbits: thin circles.
    const planets = [];
    sys.planets.forEach((pl, i) => {
      const r = rOf(pl.aAU);
      const n = Math.round(260 * Math.max(0.3, r));
      k.cloud({ count: (n * 160000) / k.count + 1, jitter: 0, pattern: false }, (_r, j) => {
        if (j >= n) return null;
        const a = (j / n) * TAU;
        return { p: [r * Math.cos(a), 0, r * Math.sin(a)], scales: [(TAU * r) / n * 0.5, 0.0015, 0.0015], quat: discQuatAlong([-Math.sin(a), 0, Math.cos(a)]), color: [0.4, 0.5, 0.7], opacity: 0.45 }; // prettier-ignore
      });
      // The planet, a small ball (token i), built at angle 0.
      const pr = Math.max(0.006, (pl.radiusEarth || 1) * k1);
      const col = SOLAR_COLORS[pl.name] || sizeColor(pl.radiusEarth || 1);
      const N = 180;
      k.cloud({ count: (N * 160000) / k.count + 1, jitter: 0, pattern: false }, (_r, j) => {
        if (j >= N) return null;
        const d = sphere(N, j);
        const lit = 0.55 + 0.45 * Math.max(0, -d[0]);
        return { p: [r + d[0] * pr, d[1] * pr, d[2] * pr], scales: [pr * 0.3, pr * 0.3, pr * 0.3], color: col.map((v) => v * lit), opacity: 0.97, kind: "token", params: [i, 0] }; // prettier-ignore
      });
      planets.push({ name: pl.name, r, period: pl.periodDays, phase: (i * 2.399963) % TAU, radiusEarth: pl.radiusEarth }); // prettier-ignore
    });
    for (const s of [[1.05, 0, 0], [-1.05, 0, 0], [0, 0, 1.05], [0, 0, -1.05], [0, 0.2, 0], [0, -0.2, 0]]) k.reach(s); // prettier-ignore
    k.data = { system: sys.id, planets, speed: Number(o.speed) || 1 };
  },
};
const randDir3 = (rand) => {
  const z = rand() * 2 - 1;
  const a = rand() * TAU;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), z, r * Math.sin(a)];
};

RECIPES["star-systems"] = systemsRecipe;

// ---- Rockets -------------------------------------------------------------------------------

const ROCKET = { prep: null };
const STAGE_SECS = 12;
// The Saturn V's pieces by height, as shares of the model's height from the
// bottom (measured on the model: where its width steps): the S-IC first
// stage, the ring between it and the S-II, the S-II second stage, the S-IVB
// third stage with the instrument unit, the spacecraft (its adapter, the
// service module and the command module) and the launch escape tower.
const SATURN_V = [
  { part: "s1", to: 0.383 },
  { part: "ring", to: 0.43 },
  { part: "s2", to: 0.61 },
  { part: "s3", to: 0.8 },
  { part: "csm", to: 0.895 },
  { part: "les", to: 1.01 },
];
// What falls away when, on the toy's clock (seconds after the tap), in the
// order of a real flight (Apollo 11: the S-IC at 2 min 40 s, the ring at
// 3 min 12 s, the escape tower just after, the S-II at 9 min 8 s, the
// spacecraft from the S-IVB about 3 h 25 min after launch).
const STAGING = [
  { part: "s1", at: 1.3, fall: 1 },
  { part: "ring", at: 2.3, fall: 1 },
  { part: "les", at: 2.8, fall: -1 },
  { part: "s2", at: 5.3, fall: 1 },
  { part: "s3", at: 8.2, fall: 0.25 },
];
// Which engines burn when: [plume part, from, to].
const BURNS = [
  ["plume1", 0, 1.3],
  ["plume2", 1.45, 5.3],
  ["plume3", 5.45, 7.6],
];

const rocketRecipe = {
  // Polish round: the labs sharp kernel and twice the tier's splats (capped
  // by the tier) for crisper edges.
  kernel: "sharp",
  density: 2,
  alive: true,
  turntable: true,
  controls: [{ key: "launch", label: "Stage it", type: "pulse", ease: STAGE_SECS }],
  action: { key: "launch", label: "Fire the stages in order" },
  note: "NASA's model of the Saturn V. A tap fires its stages in the order of a real flight, much faster: the first stage, the ring below the second, the escape tower, the second stage, then the spacecraft leaves the third stage.",
  credits: [
    {
      label: "Model",
      title: "Saturn V (NASA 3D Resources)",
      source: "https://science.nasa.gov/3d-resources/saturn-v/",
      author: "NASA (Michael D. Carbajal)",
      license: "NASA 3D Resources, used under NASA's media guidelines",
      licenseUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
    },
  ],
  async prepare() {
    if (!ROCKET.prep) {
      const bytes = await readBytes("../../assets/toys/real-rockets/saturn-v.glb");
      ROCKET.prep = await prepareModel(parseModel(bytes, "saturn-v.glb"), { decodeImage });
    }
  },
  drive(t, c, out) {
    const m = mem(c);
    const on = c.launch > 0;
    const s = on ? progress(c.launch) * STAGE_SECS : 0;
    const was = m.s ?? 0;
    m.s = s;
    const crossed = (x) => on && was < x && s >= x;
    const back = band(s, STAGE_SECS - 1.0, STAGE_SECS - 0.2);
    for (const st of STAGING) {
      if (crossed(st.at)) out.cues.push({ voice: "thud", f: 90, decay: 0.6, vol: 0.6 });
      const dt = on ? Math.max(0, s - st.at) : 0;
      let off = [0, 0, 0];
      let angle = 0;
      let vis = 1;
      if (dt > 0 && back <= 0) {
        if (st.fall > 0) {
          off = [0.04 * dt * st.fall, -st.fall * (0.06 * dt + 0.22 * dt * dt), 0];
          angle = 0.12 * dt * st.fall;
          vis = 1 - band(dt, 1.6 / st.fall, 2.6 / st.fall);
        } else {
          // The escape tower fires its own motor, up and away.
          off = [0.25 * dt, 0.3 * dt + 0.4 * dt * dt, 0];
          angle = -0.4 * dt;
          vis = 1 - band(dt, 1.0, 1.8);
        }
      }
      if (back > 0) vis = back;
      out.parts[st.part] = { offset: off, angle, visible: vis };
    }
    // Follow the climbing vehicle: as each stage drops, the whole toy glides
    // down so what is still flying stays in the middle of the view (the
    // middle of the stack that is left, as a share of the rocket's height;
    // the toy is fit to about 1.9 tall).
    const mid = (from, to) => (from + to) / 2;
    const follow = [
      [1.3, mid(0.383, 1.01)],
      [2.8, mid(0.43, 0.895)],
      [5.3, mid(0.61, 0.895)],
      [8.2, mid(0.8, 0.895)],
    ];
    let fc = 0.5;
    for (const [at, f] of follow) fc += (f - fc) * ease(band(s, at + 0.2, at + 1.4));
    // (Home again before the stages fade back in.)
    const home = ease(band(s, STAGE_SECS - 1.7, STAGE_SECS - 1.0));
    const glide = on ? -(fc - 0.5) * 1.9 * 0.85 * (1 - home) : 0;
    out.body = { offset: [0, glide, 0] };
    // The spacecraft pulls away from the third stage at the end.
    const sep = on && back <= 0 ? Math.max(0, s - 8.2) : 0;
    out.parts.csm = { offset: [0, 0.05 * sep, 0] };
    out.parts.les = out.parts.les || {};
    for (const [plume, a, b] of BURNS) {
      const lit = on ? band(s, a, a + 0.15) * (1 - band(s, b - 0.1, b)) : 0;
      const flick = 1 + 0.08 * Math.sin(t * 37 + a * 5) + 0.05 * Math.sin(t * 61);
      const ride =
        plume === "plume1" ? out.parts.s1 : plume === "plume2" ? out.parts.s2 : out.parts.s3;
      out.parts[plume] = {
        scale: lit > 0 ? flick : 0.001,
        visible: lit,
        offset: ride?.offset,
        angle: ride?.angle,
      };
    }
  },
  build(k) {
    const prep = ROCKET.prep;
    if (!prep) throw new Error("The rocket hasn't loaded.");
    const S = sampleSurface(prep, Math.floor(k.count * 0.9), { seed: 1, up: "y" });
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < S.n; i++) {
      lo = Math.min(lo, S.pos[i * 3 + 1]);
      hi = Math.max(hi, S.pos[i * 3 + 1]);
    }
    const H = hi - lo;
    const yAt = (f) => lo + f * H;
    // Each piece turns about the middle of its own bottom.
    const parts = {};
    let from = 0;
    for (const st of SATURN_V) {
      parts[st.part] = k.part(st.part, { pivot: [0, yAt((from + Math.min(1, st.to)) / 2), 0], axis: [0, 0, 1] }); // prettier-ignore
      from = st.to;
    }
    const pieceOf = (y) => {
      const f = (y - lo) / H;
      for (const st of SATURN_V) if (f < st.to) return parts[st.part];
      return parts.les;
    };
    k.cloud({ count: (S.n * 160000) / k.count + 1, jitter: 0 }, (_r, i) => {
      if (i >= S.n) return null;
      const n = [S.nrm[i * 3], S.nrm[i * 3 + 1], S.nrm[i * 3 + 2]];
      const sg = S.sigma[i];
      const y = S.pos[i * 3 + 1];
      return {
        p: [S.pos[i * 3], y, S.pos[i * 3 + 2]],
        scales: [sg, sg, sg * SPLAT_FLAT],
        quat: discQuat(n),
        color: paint(S.rgb[i * 3], S.rgb[i * 3 + 1], S.rgb[i * 3 + 2]),
        opacity: 0.98,
        part: pieceOf(y),
      };
    });
    // The engines' flames: a glowing cone under each stage (hidden until it burns).
    const plumes = [
      ["plume1", 0, 0.16, 0.42, 0],
      ["plume2", 0.383, 0.12, 0.28, 0],
      ["plume3", 0.61, 0.045, 0.18, 0],
    ];
    for (const [name, f, w, len] of plumes) {
      const y0 = yAt(f);
      const part = k.part(name, { pivot: [0, y0, 0], axis: [0, 0, 1] });
      k.cloud({ share: 0.025, jitter: 0, part, pattern: false }, (rand) => {
        const u = Math.pow(rand(), 0.7);
        const r = w * (1 - 0.55 * u) * Math.sqrt(rand());
        const a = rand() * TAU;
        const y = y0 - 0.01 - u * len;
        const hot = 1 - u;
        return {
          p: [r * Math.cos(a), y, r * Math.sin(a)],
          dir: [0, 1, 0],
          stretch: 3,
          size: 1.2,
          color: [1, 0.55 + 0.4 * hot, 0.15 + 0.6 * hot * hot],
          opacity: 0.35 + 0.4 * hot,
        };
      });
    }
    k.data = { pieces: SATURN_V.map((s) => s.part) };
  },
};

// The model paints the band round its first stage's flags navy blue; the
// real stage there is white (photos of every Saturn V), so navy is drawn as
// the white of the rest, with the model's baked shading kept.
function paint(r, g, b) {
  if (b > 0.18 && b > 2.2 * r && b > 2.2 * g) {
    const l = Math.min(1, b / 0.42);
    return [0.93 * l, 0.93 * l, 0.92 * l];
  }
  return [r, g, b];
}

RECIPES["saturn-v"] = rocketRecipe;

// ---- More rockets: the SLS and the Space Shuttle (NASA 3D Resources) ----------------------
// Built like the Saturn V, from NASA's models cut into their pieces by
// tools/sp2-rockets.mjs: each piece is a material in the model (its name).
// A spec: the model file, which piece each material belongs to (a piece
// named with "*" is split in two by the side it is on, left and right, so a
// pair of boosters falls away to both sides), when each piece goes
// (seconds after the tap) and how, which engines burn when, and where the
// view's middle goes once a piece has gone.

const STACKS = new Map();

// Painted detail for the rockets (stackRecipe's spec.paint). A thin ring
// round a piece at height h0 (as a share of the piece's height), w wide.
const ring = (h, h0, w) => Math.abs(h - h0) < w / 2;
// Vertical ribs in a band: k of them round the piece, each a share `on` of
// its pitch.
const ribbed = (c, k, on) => (c.turn * k) % 1 < on;

function stackRecipe(spec) {
  return {
    kernel: "sharp",
    density: 2,
    // (Labs: the small splats kept and a 3x phone's full resolution, as the
    // other photoreal toys have.)
    render: { cull: "low", dpr: "native" },
    // The view fits the whole rocket on any screen (out.view, below): tall
    // and thin, it would otherwise be framed by its width on a phone and
    // stand small in the middle.
    focus: () => false,
    alive: true,
    turntable: true,
    controls: [{ key: "launch", label: "Stage it", type: "pulse", ease: STAGE_SECS }],
    action: { key: "launch", label: "Fire the stages in order" },
    note: spec.note,
    credits: [
      {
        label: "Model",
        title: `${spec.title} (NASA 3D Resources)`,
        source: spec.source,
        author: spec.author,
        license: "NASA 3D Resources, used under NASA's media guidelines",
        licenseUrl: "https://www.nasa.gov/nasa-brand-center/images-and-media/",
      },
    ],
    async prepare() {
      if (!STACKS.has(spec.file)) {
        const bytes = await readBytes(`../../assets/toys/real-rockets/${spec.file}`);
        STACKS.set(spec.file, await prepareModel(parseModel(bytes, spec.file), { decodeImage }));
      }
    },
    drive(t, c, out, info) {
      const d = info?.data;
      if (!d) return;
      out.view = { key: "stack", center: [0, (d.bottom + d.top) / 2, 0], size: [d.width * 1.2, (d.top - d.bottom) * 1.06] }; // prettier-ignore
      const m = mem(c);
      const on = c.launch > 0;
      const s = on ? progress(c.launch) * STAGE_SECS : 0;
      const was = m.s ?? 0;
      m.s = s;
      const back = band(s, STAGE_SECS - 1.0, STAGE_SECS - 0.2);
      for (const st of spec.staging) {
        if (on && was < st.at && s >= st.at)
          out.cues.push({ voice: "thud", f: 90, decay: 0.6, vol: 0.6 });
        const dt = on && back <= 0 ? Math.max(0, s - st.at) : 0;
        for (const side of st.part.endsWith("*") ? [-1, 1] : [0]) {
          const name = side ? `${st.part.slice(0, -1)}${side < 0 ? "L" : "R"}` : st.part;
          let off = [0, 0, 0];
          let angle = 0;
          let vis = 1;
          if (dt > 0) {
            const [ax, ay, az] = st.away;
            // Pushed away, then falling (or, for an escape tower, flying off).
            off = [ax * dt * (side || 1), ay * dt - st.fall * 0.22 * dt * dt, az * dt];
            // (A pair tilts outward: its top away from the middle.)
            angle = st.spin * dt * (side ? -side : 1);
            vis = 1 - band(dt, st.fade, st.fade + 1);
          }
          if (back > 0) vis = back;
          out.parts[name] = { offset: off, angle, visible: vis };
        }
      }
      // The view follows what is still flying (as the Saturn V's does).
      let fc = 0.5;
      for (const [at, f] of spec.follow) fc += (f - fc) * ease(band(s, at + 0.2, at + 1.4));
      const home = ease(band(s, STAGE_SECS - 1.7, STAGE_SECS - 1.0));
      const span = d.top - d.bottom;
      out.body = { offset: [0, on ? -(d.bottom + fc * span) * 0.85 * (1 - home) : 0, 0] };
      for (const [plume, a, b] of spec.burns) {
        const lit = on ? band(s, a, a + 0.15) * (1 - band(s, b - 0.1, b)) : 0;
        const flick = 1 + 0.08 * Math.sin(t * 37 + a * 5) + 0.05 * Math.sin(t * 61);
        const ride = out.parts[d.plumes[plume]?.rides];
        out.parts[plume] = { scale: lit > 0 ? flick : 0.001, visible: lit, offset: ride?.offset, angle: ride?.angle }; // prettier-ignore
      }
    },
    build(k) {
      const prep = STACKS.get(spec.file);
      if (!prep) throw new Error("The rocket hasn't loaded.");
      // (spec.weightBy: a piece of fine detail, such as the orbiter, gets more
      // of the splats, so they are smaller and closer there; the plain tanks
      // and boosters fewer.)
      let sp = prep;
      if (spec.weightBy) {
        const weight = prep.weight.slice();
        const by = prep.materials.map((mt) => spec.weightBy[mt.name] ?? 1);
        for (let t = 0; t < prep.nt; t++) weight[t] *= by[prep.mat[t]];
        sp = { ...prep, weight };
      }
      const S = sampleSurface(sp, Math.floor(k.count * (spec.share ?? 0.92)), { seed: 1, up: "y" });
      const names = prep.materials.map((mt) => spec.pieces[mt.name] ?? spec.pieces.default);
      // Each splat's piece and material, worked out once (a pair's piece by
      // its side).
      const sideNames = names.map((p) => (p.endsWith("*") ? [`${p.slice(0, -1)}L`, `${p.slice(0, -1)}R`] : [p, p])); // prettier-ignore
      const matNames = prep.materials.map((mt) => mt.name);
      const pieceOf = new Array(S.n);
      const matOfI = new Array(S.n);
      for (let i = 0; i < S.n; i++) {
        const m = prep.mat[S.triangle[i]];
        pieceOf[i] = sideNames[m][S.pos[i * 3] < 0 ? 0 : 1];
        matOfI[i] = matNames[m];
      }
      const pieceAt = (i) => pieceOf[i];
      // Each piece's box, for its pivot and for the engines' flames.
      const box = new Map();
      let bottom = Infinity;
      let top = -Infinity;
      let width = 0;
      for (let i = 0; i < S.n; i++) {
        width = Math.max(width, 2 * Math.abs(S.pos[i * 3]));
        const p = pieceAt(i);
        const x = S.pos[i * 3];
        const y = S.pos[i * 3 + 1];
        const z = S.pos[i * 3 + 2];
        const b = box.get(p) || { lo: [x, y, z], hi: [x, y, z], n: 0 };
        b.lo = [Math.min(b.lo[0], x), Math.min(b.lo[1], y), Math.min(b.lo[2], z)];
        b.hi = [Math.max(b.hi[0], x), Math.max(b.hi[1], y), Math.max(b.hi[2], z)];
        b.n++;
        box.set(p, b);
        bottom = Math.min(bottom, y);
        top = Math.max(top, y);
      }
      const mid = (b) => b.lo.map((v, i) => (v + b.hi[i]) / 2);
      const parts = {};
      for (const [p, b] of box) parts[p] = k.part(p, { pivot: [mid(b)[0], b.lo[1], mid(b)[2]], axis: spec.axis?.[p.replace(/[LR]$/, "*")] ?? spec.axis?.[p] ?? [0, 0, 1] }); // prettier-ignore
      // Smooth shading on the round tanks and boosters (spec.smooth): their
      // ribs and stringers are far finer than a splat and light as blotches,
      // so a splat whose face leans away from the cylinder takes the shade
      // of the smooth splats at its angle round the piece's axis.
      const rgb = S.rgb.slice();
      for (const name of spec.smooth ?? []) {
        for (const p of name.endsWith("*")
          ? [`${name.slice(0, -1)}L`, `${name.slice(0, -1)}R`]
          : [name]) {
          const b = box.get(p);
          if (!b) continue;
          const [cx, , cz] = mid(b);
          const N = 96;
          const sum = new Float64Array(N * 4);
          const lean = new Uint8Array(S.n);
          // (Only the piece's own material: not its engines.)
          const own = name.replace("*", "");
          for (let i = 0; i < S.n; i++) {
            if (pieceOf[i] !== p || matOfI[i] !== own) continue;
            const dx = S.pos[i * 3] - cx;
            const dz = S.pos[i * 3 + 2] - cz;
            const r = Math.hypot(dx, dz) || 1;
            const radial = (S.nrm[i * 3] * dx + S.nrm[i * 3 + 2] * dz) / r;
            const k2 = Math.floor(((Math.atan2(dz, dx) / TAU + 1) % 1) * N);
            if (radial > 0.97) {
              for (let c = 0; c < 3; c++) sum[k2 * 4 + c] += S.rgb[i * 3 + c];
              sum[k2 * 4 + 3]++;
            } else lean[i] = 1 + k2;
          }
          for (let i = 0; i < S.n; i++) {
            const k2 = lean[i] - 1;
            if (k2 < 0 || !sum[k2 * 4 + 3]) continue;
            for (let c = 0; c < 3; c++) rgb[i * 3 + c] = sum[k2 * 4 + c] / sum[k2 * 4 + 3];
          }
        }
      }
      const matOf = (i) => matOfI[i];
      // Painted detail (spec.paint): the real vehicles' seams, joints, ribs
      // and panel lines, drawn crisply where the model has none. Each splat gets
      // its piece, material, height within the piece (0 at its bottom, 1 at
      // its top), turn round the piece's axis (0..1) and normal, and returns
      // a brightness factor (or nothing).
      const baseOf = Object.fromEntries([...box.keys()].map((p) => [p, p.replace(/[LR]$/, "")]));
      if (spec.paint)
        for (let i = 0; i < S.n; i++) {
          const piece = pieceAt(i);
          const b = box.get(piece);
          const [cx, , cz] = mid(b);
          const x = S.pos[i * 3];
          const y = S.pos[i * 3 + 1];
          const z = S.pos[i * 3 + 2];
          const f = spec.paint({
            piece: baseOf[piece],
            mat: matOf(i),
            x,
            y,
            z,
            h: (y - b.lo[1]) / (b.hi[1] - b.lo[1] || 1),
            turn: (Math.atan2(z - cz, x - cx) / TAU + 1) % 1,
            n: [S.nrm[i * 3], S.nrm[i * 3 + 1], S.nrm[i * 3 + 2]],
            box: b,
          });
          // (A color, or a brightness factor.)
          if (Array.isArray(f)) for (let c = 0; c < 3; c++) rgb[i * 3 + c] = f[c];
          else if (f != null)
            for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.min(1, rgb[i * 3 + c] * f);
        }
      k.cloud({ count: (S.n * 160000) / k.count + 1, jitter: 0 }, (_r, i) => {
        if (i >= S.n) return null;
        const n = [S.nrm[i * 3], S.nrm[i * 3 + 1], S.nrm[i * 3 + 2]];
        const sg = S.sigma[i] * (spec.sigmaBy?.[matOf(i)] ?? spec.sigma ?? 1);
        return {
          p: [S.pos[i * 3], S.pos[i * 3 + 1], S.pos[i * 3 + 2]],
          scales: [sg, sg, sg * SPLAT_FLAT],
          quat: discQuat(n),
          color: [rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]],
          opacity: 0.98,
          part: parts[pieceAt(i)],
        };
      });
      // Anything a spec adds (a piece the model hides, such as Orion's capsule).
      spec.extra?.(k, { parts, box, bottom, top });
      // The engines' flames: a glowing cone under each burning piece, at the
      // bottom of the piece named (or of its engines), as wide as asked.
      const plumes = {};
      for (const [name, at, w, len, rides] of spec.plumes) {
        const b = box.get(at);
        if (!b) continue;
        const c = mid(b);
        const y0 = b.lo[1];
        const width = w * (b.hi[0] - b.lo[0]);
        const part = k.part(name, { pivot: [c[0], y0, c[2]], axis: [0, 0, 1] });
        plumes[name] = { rides };
        k.cloud({ share: 0.012, jitter: 0, part, pattern: false }, (rand) => {
          const u = Math.pow(rand(), 0.7);
          const r = width * (1 - 0.55 * u) * Math.sqrt(rand());
          const a = rand() * TAU;
          const hot = 1 - u;
          return {
            p: [c[0] + r * Math.cos(a), y0 - 0.01 - u * len, c[2] + r * Math.sin(a)],
            dir: [0, 1, 0],
            stretch: 3,
            size: 1.2,
            color: [1, 0.55 + 0.4 * hot, 0.15 + 0.6 * hot * hot],
            opacity: 0.35 + 0.4 * hot,
          };
        });
      }
      k.data = { pieces: [...box.keys()], bottom, top, width, plumes };
    },
  };
}

// The Space Launch System (Block 1, as Artemis I flew on November 16, 2022):
// its two boosters go after about two minutes (NASA: they "operate for about
// two minutes"), then the launch abort system; the core stage goes at orbit,
// about 8½ minutes in; the upper stage (the ICPS) then burns for the Moon
// (89 minutes after liftoff), and Orion leaves it. Orion's crew module, under
// the abort system's fairing in the model, is drawn here as a plain cone.
RECIPES.sls = stackRecipe({
  file: "sls.glb",
  sigma: 0.8,
  smooth: ["core", "srb*"],
  title: "Space Launch System (SLS)",
  source: "https://science.nasa.gov/3d-resources/space-launch-system-sls/",
  author: "NASA",
  note: "NASA's model of the Space Launch System, colored as it flew on Artemis I. A tap fires its stages in the order of the flight, much faster: the boosters, the abort tower, the core stage, then Orion leaves the upper stage.",
  pieces: { engine: "core", nozzle: "srb*", core: "core", srb: "srb*", icps: "icps", orion: "orion", las: "las", default: "core" }, // prettier-ignore
  axis: { "srb*": [0, 0, 1], core: [1, 0, 0], icps: [1, 0, 0] },
  // The core stage's welds, its intertank's ribs (where the model is ribbed)
  // and the boosters' segment joints, as on Artemis I (no logos).
  paint(c) {
    if (c.mat === "core") {
      // (The intertank: where the model's core is ribbed, 0.60 to 0.70 of
      // its height, measured on the model.)
      if (c.h > 0.603 && c.h < 0.7) return ribbed(c, 36, 0.4) ? 0.82 : 1.03;
      if (ring(c.h, 0.603, 0.005) || ring(c.h, 0.7, 0.005)) return 0.62;
      if (ring(c.h, 0.13, 0.006) || ring(c.h, 0.4, 0.004) || ring(c.h, 0.905, 0.006)) return 0.7;
      return null;
    }
    if (c.mat === "srb") {
      for (const h0 of [0.085, 0.24, 0.395, 0.55, 0.705, 0.84])
        if (ring(c.h, h0, 0.007)) return 0.66;
    }
    return null;
  },
  staging: [
    { part: "srb*", at: 1.4, away: [0.12, 0.02, 0], fall: 1, spin: 0.35, fade: 1.7 },
    { part: "las", at: 2.3, away: [0.05, 0.45, 0], fall: -1.2, spin: -0.3, fade: 1.0 },
    { part: "core", at: 5.0, away: [0, -0.02, 0], fall: 1, spin: 0.1, fade: 2.0 },
    { part: "icps", at: 8.2, away: [0, -0.02, 0], fall: 0.25, spin: 0.08, fade: 2.6 },
  ],
  plumes: [
    ["flameCore", "core", 0.32, 0.3, "core"],
    ["flameL", "srbL", 0.55, 0.42, "srbL"],
    ["flameR", "srbR", 0.55, 0.42, "srbR"],
    ["flameUpper", "icps", 0.25, 0.14, "icps"],
  ],
  burns: [
    ["flameL", 0, 1.4],
    ["flameR", 0, 1.4],
    ["flameCore", 0, 4.9],
    ["flameUpper", 5.3, 7.4],
  ],
  // (Shares of the stack's height, measured on the model.)
  follow: [
    [5.0, 0.8],
    [8.2, 0.82],
  ],
  extra(k, { parts, box }) {
    // Orion's crew module: a cone from the service module's top, inside the
    // abort system's fairing, so it shows once the fairing has gone.
    const o = box.get("orion");
    const l = box.get("las");
    if (!o || !l) return;
    const y0 = o.hi[1];
    const r0 = (o.hi[0] - o.lo[0]) * 0.44;
    const h = (l.hi[1] - l.lo[1]) * 0.22;
    const cx = (o.lo[0] + o.hi[0]) / 2;
    const cz = (o.lo[2] + o.hi[2]) / 2;
    k.cloud({ share: 0.006, jitter: 0, part: parts.orion }, (rand) => {
      const v = rand();
      const r = r0 * (1 - 0.62 * v);
      const a = rand() * TAU;
      const n = [Math.cos(a) * 0.85, 0.5, Math.sin(a) * 0.85];
      return { p: [cx + r * Math.cos(a), y0 + v * h, cz + r * Math.sin(a)], quat: discQuat(n), size: 0.9, color: [0.82, 0.83, 0.85], opacity: 0.98 }; // prettier-ignore
    });
  },
});

// The Space Shuttle: its two boosters go at 2 min 4 s, the external tank at
// 8 min 50 s after the main engines stop, and the orbiter goes on with its
// small maneuvering engines.
RECIPES["space-shuttle"] = stackRecipe({
  file: "space-shuttle.glb",
  sigma: 0.9,
  sigmaBy: { orbiter: 1, belly: 0.8, window: 0.85 },
  weightBy: { orbiter: 2.2, belly: 2.2, window: 2.2 },
  // (A little under the usual share, to keep its build under 1.5 s.)
  share: 0.84,
  smooth: ["et", "srb*"],
  title: "Space Shuttle (A)",
  source: "https://science.nasa.gov/3d-resources/space-shuttle-a/",
  author: "NASA (Michael D. Carbajal)",
  note: "NASA's model of the Space Shuttle at launch. A tap fires its stages in the order of a flight, much faster: the two boosters, then the external tank, and the orbiter flies on.",
  pieces: { srb: "srb*", et: "et", orbiter: "orbiter", belly: "orbiter", window: "orbiter", engine: "orbiter", default: "orbiter" }, // prettier-ignore
  axis: { "srb*": [0, 0, 1], et: [1, 0, 0] },
  // The tank's intertank ribs and joints, the boosters' segment joints and
  // the seam down the orbiter's payload-bay doors (no logos).
  paint(c) {
    if (c.mat === "et") {
      // (The struts that hold the orbiter stand off the tank: light gray,
      // not orange.)
      // (The tank's axis: half its width in from its back, since the struts
      // stretch its box toward the orbiter.)
      const radius = (c.box.hi[0] - c.box.lo[0]) / 2;
      const cx = (c.box.lo[0] + c.box.hi[0]) / 2;
      const cz = c.box.lo[2] + radius;
      if (Math.hypot(c.x - cx, c.z - cz) > radius * 1.06) return [0.78, 0.78, 0.76];
      // (The intertank, between the hydrogen tank, 29.5 m of the tank's
      // 46.9, and the oxygen tank: the model has no ribs, so they are drawn.)
      if (c.h > 0.64 && c.h < 0.76) return ribbed(c, 36, 0.4) ? 0.82 : 1.03;
      if (ring(c.h, 0.64, 0.005) || ring(c.h, 0.76, 0.005)) return 0.66;
      return null;
    }
    if (c.mat === "srb") {
      for (const h0 of [0.09, 0.25, 0.41, 0.57, 0.73]) if (ring(c.h, h0, 0.008)) return 0.66;
      return null;
    }
    // (The seam down the middle of the payload-bay doors, on top.)
    if (c.mat === "orbiter" && c.n[2] > 0.6 && Math.abs(c.x) < 0.0035 && c.h > 0.2 && c.h < 0.72)
      return 0.62;
    return null;
  },
  staging: [
    { part: "srb*", at: 2.0, away: [0.12, 0.02, 0], fall: 1, spin: 0.35, fade: 1.7 },
    { part: "et", at: 6.6, away: [0, -0.03, -0.08], fall: 0.6, spin: -0.15, fade: 2.6 },
  ],
  plumes: [
    ["flameMain", "orbiter", 0.2, 0.26, "orbiter"],
    ["flameL", "srbL", 0.55, 0.45, "srbL"],
    ["flameR", "srbR", 0.55, 0.45, "srbR"],
    ["flameOms", "orbiter", 0.08, 0.08, "orbiter"],
  ],
  burns: [
    ["flameL", 0, 2.0],
    ["flameR", 0, 2.0],
    ["flameMain", 0, 6.4],
    ["flameOms", 7.2, 8.8],
  ],
  follow: [[6.6, 0.42]],
});

// For other packs: every real world's id.
export const REAL_WORLDS = WORLDS.map((w) => w.id);
