// The world file (worlds/<id>/world.json): reading it and filling in every
// default, so the rest of the engine can trust its shape. The format is in
// docs/WORLDS.md. Pure JavaScript.

export const WORLD_VERSION = 1;

export const DEFAULT_COLORS = {
  sky: "#6fb3e6",
  horizon: "#dcefff",
  sand: "#e6d3a0",
  wetSand: "#b9a578",
  seabed: "#8fa98e",
  grass: "#6fa84a",
  grassLight: "#9ccc5c",
  grassDark: "#3f7a33",
  grassDry: "#a8a650",
  rock: "#8c8781",
  rockDark: "#5f5b57",
  snow: "#f3f6fb",
  water: "#1f6f9e",
  shallow: "#4fc2c4",
  foam: "#f4fbff",
  cloud: "#ffffff",
  accent: "#1f6f8b",
};

const num = (v, d, lo = -Infinity, hi = Infinity) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
};
const pair = (v, d) =>
  Array.isArray(v) && v.length >= 2 ? [num(v[0], d[0]), num(v[1], d[1])] : d.slice();
const text = (v, d = "") => (typeof v === "string" ? v : d);
const hex = (v, d) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);

export function normalizeTerrain(t = {}) {
  const radius = Array.isArray(t.radius) ? pair(t.radius, [36, 36]) : [num(t.radius, 36, 4), num(t.radius, 36, 4)]; // prettier-ignore
  return {
    shape: t.shape === "flat" ? "flat" : "island",
    size: num(t.size, 160, 32, 1024),
    chunk: num(t.chunk, 8, 4, 64),
    center: pair(t.center, [0, 0]),
    radius,
    height: num(t.height, 8, 0, 200),
    base: num(t.base, 1, -50, 200),
    roughness: num(t.roughness, 0.5, 0, 1),
    coast: num(t.coast, 0.35, 0, 1),
    seaDepth: num(t.seaDepth, 6, 0.5, 100),
    beachHeight: num(t.beachHeight, 0.7, 0, 10),
    beach: num(t.beach, 1.3, 0, 20),
    waterLevel: num(t.waterLevel, 0, -100, 100),
    clearDepth: num(t.clearDepth, 2.6, 0.2, 50),
    rockSlope: num(t.rockSlope, 0.8, 0.1, 5),
    snowLine: num(t.snowLine, 1000, -100, 10000),
    hills: (Array.isArray(t.hills) ? t.hills : []).map((h) => ({
      at: pair(h.at, [0, 0]),
      radius: num(h.radius, 8, 0.5, 500),
      height: num(h.height, 3, -100, 200),
    })),
    flatten: (Array.isArray(t.flatten) ? t.flatten : []).map((f) => ({
      at: pair(f.at, [0, 0]),
      radius: num(f.radius, 4, 0.5, 100),
    })),
  };
}

function normalizeCollider(c) {
  if (c === false || c === "none") return false;
  if (!c || typeof c !== "object") return null; // the prop type's default
  const shape = ["box", "sphere", "capsule"].includes(c.shape) ? c.shape : "capsule";
  return {
    shape,
    radius: num(c.radius, 0.5, 0.01, 100),
    size: pair(c.size, [1, 1]),
    height: num(c.height, 2, 0.01, 200),
    offset: pair(c.offset, [0, 0]),
  };
}

export function normalizeProp(p = {}, i = 0) {
  return {
    id: text(p.id, `prop-${i}`),
    type: text(p.type, "boulder"),
    at: pair(p.at, [0, 0]),
    lift: num(p.lift, 0, -50, 50),
    y: p.y === undefined || p.y === null ? null : num(p.y, 0, -500, 500),
    size: num(p.size, 1, 0.05, 200),
    turn: num(p.turn, 0),
    tilt: num(p.tilt, 0, -45, 45),
    seed: num(p.seed, i + 1, 0, 4294967295) >>> 0,
    detail: num(p.detail, 1, 0.25, 3),
    options: p.options && typeof p.options === "object" ? { ...p.options } : {},
    collider: normalizeCollider(p.collider),
  };
}

export function normalizeLandmark(l = {}, i = 0) {
  const link = l.link && typeof l.link === "object" ? l.link : null;
  const pic = l.picture && typeof l.picture === "object" ? l.picture : null;
  return {
    id: text(l.id, `landmark-${i}`),
    title: text(l.title, `Place ${i + 1}`),
    words: text(l.words),
    link: link && typeof link.href === "string" ? { href: link.href, label: text(link.label, "Open") } : null, // prettier-ignore
    picture: pic && typeof pic.src === "string" ? { src: pic.src, alt: text(pic.alt) } : null,
    at: pair(l.at, [0, 0]),
    facing: num(l.facing, 0),
    radius: num(l.radius, 3.2, 0.5, 50),
    sign: l.sign === false ? false : text(l.sign, "post"),
    label: text(l.label, text(l.title, "")).toUpperCase().slice(0, 14),
  };
}

// Scatter: many copies of one prop type spread over a kind of ground.
export function normalizeScatter(s = {}, i = 0) {
  return {
    type: text(s.type, "boulder"),
    count: num(s.count, 8, 0, 2000) | 0,
    on: ["grass", "sand", "rock", "snow", "any"].includes(s.on) ? s.on : "grass",
    size: pair(s.size, [0.8, 1.2]),
    seed: num(s.seed, 100 + i, 0, 4294967295) >>> 0,
    within: s.within ? { at: pair(s.within.at, [0, 0]), radius: num(s.within.radius, 20, 1, 1000) } : null, // prettier-ignore
    spacing: num(s.spacing, 2, 0, 100),
    options: s.options && typeof s.options === "object" ? { ...s.options } : {},
  };
}

const rgb01 = (v, d) => {
  const h = hex(v, d);
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
};

// How a world is drawn (docs/WORLDS.md, "Rendering"): "splats" (everything
// is splats) or "hybrid" (lit models for the ground, water, sky and signs;
// splats for the rest). ?render= overrides it.
export const RENDER_MODES = ["splats", "hybrid"];

// The sun, shadows, haze and grade (both modes). Colors are sRGB.
export function normalizeLight(l = {}, colors = DEFAULT_COLORS) {
  const sun = l.sun && typeof l.sun === "object" ? l.sun : {};
  return {
    sun: { azimuth: num(sun.azimuth, 232, -360, 720), elevation: num(sun.elevation, 48, 5, 90) },
    sunColor: rgb01(l.sunColor, "#fff3df"),
    sunIntensity: num(l.sunIntensity, 0.95, 0, 10),
    shadow: num(l.shadow, 0.42, 0, 1),
    haze: num(l.haze, 0.0045, 0, 0.1),
    hazeColor: rgb01(l.hazeColor, colors.horizon),
    exposure: num(l.exposure, 1, 0.1, 4),
    ambient: rgb01(l.ambient, "#000000"),
  };
}

export function normalizeWorld(w = {}) {
  const colors = { ...DEFAULT_COLORS };
  for (const k in w.colors || {}) if (k in colors) colors[k] = hex(w.colors[k], colors[k]);
  const spawn = w.spawn && typeof w.spawn === "object" ? w.spawn : {};
  return {
    version: WORLD_VERSION,
    id: text(w.id, "world"),
    title: text(w.title, "A world"),
    welcome: text(w.welcome),
    enter: text(w.enter, "Enter"),
    credit: text(w.credit),
    seed: num(w.seed, 1, 0, 4294967295) >>> 0,
    colors,
    terrain: normalizeTerrain(w.terrain),
    water: w.water === false ? false : true,
    render: RENDER_MODES.includes(w.render) ? w.render : "splats",
    light: normalizeLight(w.light && typeof w.light === "object" ? w.light : {}, colors),
    sky: { clouds: num(w.sky?.clouds, 0.5, 0, 1) },
    spawn: { at: pair(spawn.at, [0, 0]), facing: num(spawn.facing, 0) },
    character: {
      shirt: hex(w.character?.shirt, "#e0533d"),
      trousers: hex(w.character?.trousers, "#35507a"),
      skin: hex(w.character?.skin, "#c98e6a"),
      hair: hex(w.character?.hair, "#3a2a1e"),
      shoes: hex(w.character?.shoes, "#2e2e33"),
      // "splats" (the kit-built character) or "mesh" (a lit, skinned model).
      model: w.character?.model === "mesh" ? "mesh" : "splats",
    },
    props: (Array.isArray(w.props) ? w.props : []).map(normalizeProp),
    scatter: (Array.isArray(w.scatter) ? w.scatter : []).map(normalizeScatter),
    landmarks: (Array.isArray(w.landmarks) ? w.landmarks : []).map(normalizeLandmark),
  };
}

export async function loadWorld(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load the world file (${res.status}).`);
  return normalizeWorld(await res.json());
}
