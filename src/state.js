// Scene state: defaults, seeded randomness, serialization and validation.
// Everything that is saved into a Splashery JSON file goes through here.

export const SCENE_VERSION = 1;
export const APP_NAME = "Splashery";
export const TAGLINE = "paint a planet";

export const TEMPLATE_NAMES = ["rocky", "icy", "gas", "plain"];
export const TEMPLATE_LABELS = {
  rocky: "Rocky",
  icy: "Icy",
  gas: "Gas giant",
  plain: "Plain",
};

export const RESOLUTIONS = [1024, 2048, 4096];

export const SWATCHES = [
  "#e63b2e",
  "#f2a93b",
  "#f5e663",
  "#2f9e6a",
  "#0b4f9c",
  "#7a3fb1",
  "#ffffff",
  "#111111",
];

export const DEFAULT_BRUSH = Object.freeze({
  size: 0.05, // geodesic radius in radians on the unit sphere
  color: "#e63b2e",
  wetness: 0.8,
  opacity: 1,
});

export const DEFAULT_PHYSICS = Object.freeze({
  dryTime: 4, // seconds for a full-thickness stamp to dry completely
  viscosity: 0.35, // 0 = watery, 1 = barely moves
});

export const DEFAULT_LIGHTING = Object.freeze({
  exposure: 0.95,
  keyIntensity: 2.6,
  keyAzimuth: -0.7, // radians around world Y
  keyElevation: 0.55, // radians above the horizon
  envIntensity: 0.55,
});

export const DEFAULT_CAMERA = Object.freeze({
  rotation: [0, 0, 0, 1], // ball orientation quaternion (x, y, z, w)
  distance: 3.2,
});

export const BRUSH_SIZE_MIN = 0.006;
export const BRUSH_SIZE_MAX = 0.28;

// Slider value 0..100 -> brush radius (radians), with more room at the small end.
export function sliderToBrushSize(v) {
  const t = Math.min(1, Math.max(0, v / 100));
  return BRUSH_SIZE_MIN + (BRUSH_SIZE_MAX - BRUSH_SIZE_MIN) * Math.pow(t, 1.7);
}

export function brushSizeToSlider(size) {
  const t = (size - BRUSH_SIZE_MIN) / (BRUSH_SIZE_MAX - BRUSH_SIZE_MIN);
  return Math.round(100 * Math.pow(Math.min(1, Math.max(0, t)), 1 / 1.7));
}

// Deterministic PRNG (mulberry32). Returns a function producing floats in [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  if (globalThis.crypto && crypto.getRandomValues) {
    const u = new Uint32Array(1);
    crypto.getRandomValues(u);
    return u[0] >>> 0;
  }
  return (Math.random() * 4294967296) >>> 0;
}

// Small string hash (FNV-1a) used to derive per-stroke seeds.
export function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createDefaultScene(overrides = {}) {
  return {
    version: SCENE_VERSION,
    createdAt: new Date().toISOString(),
    template: { name: "rocky", seed: randomSeed() },
    camera: { rotation: [...DEFAULT_CAMERA.rotation], distance: DEFAULT_CAMERA.distance },
    lighting: { ...DEFAULT_LIGHTING },
    brushDefaults: { ...DEFAULT_BRUSH },
    physics: { ...DEFAULT_PHYSICS },
    strokes: [],
    snapshotPNG: null,
    ...overrides,
  };
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

export function normalizeHex(color, fallback = DEFAULT_BRUSH.color) {
  if (typeof color !== "string") return fallback;
  let c = color.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(c)) c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
  return HEX_RE.test(c) ? c : fallback;
}

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function num(v, fallback, lo = -Infinity, hi = Infinity) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return clamp(n, lo, hi);
}

export function normalizeBrush(b) {
  const src = b && typeof b === "object" ? b : {};
  return {
    size: num(src.size, DEFAULT_BRUSH.size, BRUSH_SIZE_MIN, BRUSH_SIZE_MAX),
    color: normalizeHex(src.color),
    wetness: num(src.wetness, DEFAULT_BRUSH.wetness, 0, 1),
    opacity: num(src.opacity, DEFAULT_BRUSH.opacity, 0.02, 1),
  };
}

export function normalizePhysics(p) {
  const src = p && typeof p === "object" ? p : {};
  return {
    dryTime: num(src.dryTime, DEFAULT_PHYSICS.dryTime, 0.5, 30),
    viscosity: num(src.viscosity, DEFAULT_PHYSICS.viscosity, 0, 1),
  };
}

export function normalizeLighting(l) {
  const src = l && typeof l === "object" ? l : {};
  return {
    exposure: num(src.exposure, DEFAULT_LIGHTING.exposure, 0.2, 3),
    keyIntensity: num(src.keyIntensity, DEFAULT_LIGHTING.keyIntensity, 0, 8),
    keyAzimuth: num(src.keyAzimuth, DEFAULT_LIGHTING.keyAzimuth, -Math.PI, Math.PI),
    keyElevation: num(src.keyElevation, DEFAULT_LIGHTING.keyElevation, -1.2, 1.5),
    envIntensity: num(src.envIntensity, DEFAULT_LIGHTING.envIntensity, 0, 3),
  };
}

export function normalizeCamera(c) {
  const src = c && typeof c === "object" ? c : {};
  let q =
    Array.isArray(src.rotation) && src.rotation.length === 4 ? src.rotation.map(Number) : null;
  if (!q || q.some((v) => !Number.isFinite(v))) q = [...DEFAULT_CAMERA.rotation];
  const len = Math.hypot(q[0], q[1], q[2], q[3]) || 1;
  q = q.map((v) => v / len);
  return { rotation: q, distance: num(src.distance, DEFAULT_CAMERA.distance, 1.01, 1e6) };
}

// Strokes are stored grouped: one entry per pointer stroke with its brush
// settings, and a list of events [timeMs, u, v, splashFlag].
export function normalizeStrokes(strokes) {
  if (!Array.isArray(strokes)) return [];
  const out = [];
  for (const s of strokes) {
    if (!s || typeof s !== "object" || !Array.isArray(s.points)) continue;
    const brush = normalizeBrush(s);
    const points = [];
    for (const p of s.points) {
      if (!Array.isArray(p) || p.length < 3) continue;
      const t = num(p[0], 0, 0, 1e9);
      let u = num(p[1], NaN);
      const v = num(p[2], NaN);
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue;
      if (u < 0 || u >= 1) u = ((u % 1) + 1) % 1;
      points.push([Math.round(t), round(u, 4), round(clamp(v, 0, 1), 4), p[3] ? 1 : 0]);
    }
    const stroke = { ...brush, points };
    if (Array.isArray(s.g) && s.g.length === 3 && s.g.every((x) => Number.isFinite(Number(x)))) {
      stroke.g = s.g.map((x) => round(Number(x), 3));
    }
    if (points.length) out.push(stroke);
  }
  return out;
}

// Validates an imported object and returns a clean scene. Throws on garbage.
export function normalizeScene(obj) {
  if (!obj || typeof obj !== "object") throw new Error("Not a Splashery scene file.");
  const version = num(obj.version, NaN);
  if (!Number.isFinite(version)) throw new Error("Missing scene version.");
  if (version > SCENE_VERSION) {
    throw new Error(`This scene was made with a newer Splashery (version ${version}).`);
  }
  const t = obj.template && typeof obj.template === "object" ? obj.template : {};
  const name = TEMPLATE_NAMES.includes(t.name) ? t.name : "rocky";
  const seed = num(t.seed, 1, 0, 4294967295) >>> 0;
  const snapshot =
    typeof obj.snapshotPNG === "string" && obj.snapshotPNG.startsWith("data:image/png")
      ? obj.snapshotPNG
      : null;
  return {
    version: SCENE_VERSION,
    createdAt: typeof obj.createdAt === "string" ? obj.createdAt : new Date().toISOString(),
    template: { name, seed },
    camera: normalizeCamera(obj.camera),
    lighting: normalizeLighting(obj.lighting),
    brushDefaults: normalizeBrush(obj.brushDefaults),
    physics: normalizePhysics(obj.physics),
    strokes: normalizeStrokes(obj.strokes),
    snapshotPNG: snapshot,
  };
}

// Rounds floats for compact JSON.
export function round(v, digits = 4) {
  const m = Math.pow(10, digits);
  return Math.round(v * m) / m;
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
