// The scene document (schema version 3): defaults, validation and the
// compact form used in links. Everything saved to JSON goes through here.
// The shape is documented in docs/SCENE-SCHEMA.md. Version 2 files and
// links load unchanged: the fields version 3 added take their defaults.

import { normalizeGenerator } from "./generators.js";
import { EFFECTS, AXES, defaultEffects } from "./effects.js";
import { DEFAULT_CAMERA } from "./camera.js";
import { randomSeed } from "./noise.js";
import { DEFAULT_PATTERN, normalizePattern } from "./patterns.js";
import { DEFAULT_MOTION, MOVE_IDS } from "./motion.js";

export const SCENE_VERSION = 3;
export const APP_NAME = "Splashery";
export const TAGLINE = "splats you can play with";

export const IDLE_EFFECTS = [
  { id: "none", label: "Nothing" },
  { id: "breeze", label: "A gentle breeze" },
  { id: "pokes", label: "Little pokes" },
  { id: "twist", label: "A slow twist" },
  { id: "dissolve", label: "Dissolve and rebuild" },
];

export const DEFAULT_LOOK = Object.freeze({
  background: "page", // "page" | "transparent" | "#rrggbb"
  theme: "auto", // "auto" | "light" | "dark"
  accent: "auto", // "auto" | "#rrggbb"
  splatScale: 1,
  exposure: 1,
});

export const THEMES = {
  light: { page: "#ffffff", ink: "#111111", accent: "#0b4f9c" },
  dark: { page: "#101010", ink: "#f2f2f2", accent: "#b8ccff" },
};

export function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

export function round(v, digits = 4) {
  const m = Math.pow(10, digits);
  return Math.round(v * m) / m;
}

function num(v, fallback, lo = -Infinity, hi = Infinity) {
  const n = typeof v === "number" ? v : Number(v);
  if (v === null || v === "" || !Number.isFinite(n)) return fallback;
  return clamp(n, lo, hi);
}

const HEX_RE = /^#[0-9a-f]{6}$/i;

export function normalizeHex(color, fallback) {
  if (typeof color !== "string") return fallback;
  let c = color.trim().toLowerCase();
  if (/^#[0-9a-f]{3}$/.test(c)) c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
  return HEX_RE.test(c) ? c : fallback;
}

export function createScene(overrides = {}) {
  return {
    app: "splashery",
    version: SCENE_VERSION,
    createdAt: new Date().toISOString(),
    seed: randomSeed() % 1000000,
    toy: { kind: "builtin", id: "blob" },
    look: { ...DEFAULT_LOOK },
    effects: defaultEffects(),
    paint: { stamps: [] },
    camera: { ...DEFAULT_CAMERA },
    autoplay: { turntable: true, effect: "none" },
    pattern: structuredClone(DEFAULT_PATTERN),
    motion: structuredClone(DEFAULT_MOTION),
    ...overrides,
  };
}

export function normalizeLook(l) {
  const src = l && typeof l === "object" ? l : {};
  let background = DEFAULT_LOOK.background;
  if (src.background === "transparent" || src.background === "page") background = src.background;
  else background = normalizeHex(src.background, DEFAULT_LOOK.background);
  return {
    background,
    theme: ["auto", "light", "dark"].includes(src.theme) ? src.theme : "auto",
    accent: src.accent === "auto" ? "auto" : normalizeHex(src.accent, "auto"),
    splatScale: num(src.splatScale, 1, 0.3, 2.5),
    exposure: num(src.exposure, 1, 0.3, 2.5),
  };
}

export function normalizeEffects(fx) {
  const src = fx && typeof fx === "object" ? fx : {};
  const out = defaultEffects();
  for (const def of EFFECTS) {
    const e = src[def.id];
    if (!e || typeof e !== "object") continue;
    const o = out[def.id];
    o.on = def.kind === "ambient" ? !!e.on : false;
    for (const p of def.params) o[p.key] = num(e[p.key], p.value, p.min, p.max);
    if (def.axis) o.axis = AXES.includes(e.axis) ? e.axis : def.axis;
    if (def.id === "paint") o.color = normalizeHex(e.color, "#e63b2e");
  }
  // Drop and dissolve both move splats towards a target: never both.
  if (out.drop.on && out.dissolve.on) out.dissolve.on = false;
  return out;
}

export function normalizeCamera(c) {
  const src = c && typeof c === "object" ? c : {};
  return {
    yaw: num(src.yaw, DEFAULT_CAMERA.yaw, -10, 10),
    pitch: num(src.pitch, DEFAULT_CAMERA.pitch, -1.45, 1.45),
    roll: num(src.roll, 0, -Math.PI, Math.PI),
    distance: num(src.distance, DEFAULT_CAMERA.distance, 1.25, 10),
  };
}

export function normalizeStamps(stamps, limit = 4000) {
  if (!Array.isArray(stamps)) return [];
  const out = [];
  for (const s of stamps) {
    if (!Array.isArray(s) || s.length < 6) continue;
    const p = [0, 1, 2, 3].map((i) => num(s[i], NaN));
    if (p.some((v) => !Number.isFinite(v)) || p[3] <= 0) continue;
    const color = normalizeHex(s[4], null);
    if (!color) continue;
    out.push([
      round(p[0], 3),
      round(p[1], 3),
      round(p[2], 3),
      round(p[3], 3),
      color,
      round(num(s[5], 1, 0, 1), 2),
    ]);
    if (out.length >= limit) break;
  }
  return out;
}

export function normalizeClay(ops, limit = 2000) {
  if (!Array.isArray(ops)) return [];
  const out = [];
  for (const op of ops) {
    if (!Array.isArray(op) || (op[0] !== "a" && op[0] !== "e")) continue;
    const v = [1, 2, 3, 4].map((i) => num(op[i], NaN));
    if (v.some((x) => !Number.isFinite(x)) || v[3] <= 0) continue;
    out.push([
      op[0],
      round(v[0], 3),
      round(v[1], 3),
      round(v[2], 3),
      round(clamp(v[3], 0.005, 1), 3),
    ]);
    if (out.length >= limit) break;
  }
  return out;
}

const KEY_RE = /^[a-z][a-zA-Z0-9]{0,23}$/;
const WORD_RE = /^[a-z0-9-]{1,24}$/;
// The longest text a toy option can hold (a molecule read from a file).
export const TEXT_MAX = 24000;

// Recipe options for a kit toy: a few short values (numbers, switches,
// colours, words). The recipe itself checks their meaning when it builds.
export function normalizeOptions(o) {
  if (!o || typeof o !== "object" || Array.isArray(o)) return {};
  const out = {};
  for (const k of Object.keys(o).slice(0, 16)) {
    if (!KEY_RE.test(k)) continue;
    const v = o[k];
    if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = round(clamp(v, -1e6, 1e6), 4);
    else if (typeof v === "string" && (HEX_RE.test(v) || WORD_RE.test(v))) out[k] = v.toLowerCase();
    // Text as typed (a SMILES string, a molecule read from a file): printable
    // ASCII, kept as it is.
    else if (typeof v === "string" && v.length <= TEXT_MAX && /^[\x20-\x7e]*$/.test(v)) out[k] = v;
  }
  return out;
}

export function normalizeMotion(m) {
  const src = m && typeof m === "object" ? m : {};
  const controls = {};
  if (src.controls && typeof src.controls === "object") {
    for (const k of Object.keys(src.controls).slice(0, 16)) {
      const v = num(src.controls[k], NaN, 0, 1);
      if (KEY_RE.test(k) && Number.isFinite(v)) controls[k] = round(v, 3);
    }
  }
  return {
    alive: src.alive !== false,
    move: MOVE_IDS.includes(src.move) ? src.move : DEFAULT_MOTION.move,
    speed: num(src.speed, DEFAULT_MOTION.speed, 0, 1),
    controls,
  };
}

export function normalizeToy(t, profile) {
  const src = t && typeof t === "object" ? t : {};
  if (src.kind === "procedural") {
    return {
      kind: "procedural",
      id: typeof src.id === "string" ? src.id.slice(0, 40) : null,
      generator: normalizeGenerator(src.generator, profile),
      clay: normalizeClay(src.clay),
    };
  }
  if (src.kind === "file") {
    const f = src.file && typeof src.file === "object" ? src.file : {};
    return {
      kind: "file",
      file: {
        name: typeof f.name === "string" ? f.name.slice(0, 200) : "file",
        bytes: num(f.bytes, 0, 0, 1e12),
      },
      flip: !!src.flip,
    };
  }
  const out = { kind: "builtin", id: typeof src.id === "string" ? src.id.slice(0, 40) : "blob" };
  // Kit toys can carry options and clay; empty ones are left out.
  const options = normalizeOptions(src.options);
  if (Object.keys(options).length) out.options = options;
  const clay = normalizeClay(src.clay);
  if (clay.length) out.clay = clay;
  return out;
}

// Validates an imported object and returns a clean scene. Throws on garbage.
export function normalizeScene(obj, profile = "strong") {
  if (!obj || typeof obj !== "object") throw new Error("Not a Splashery scene file.");
  const version = num(obj.version, NaN);
  if (!Number.isFinite(version)) throw new Error("Missing scene version.");
  if (version === 1) {
    throw new Error(
      "This is a Splashery v1 planet scene. Splashery v2 plays with splat toys; open it on the v1 branch.",
    );
  }
  // Version 2 scenes are version 3 scenes without pattern and motion.
  if (version > SCENE_VERSION) {
    throw new Error(`This scene was made with a newer Splashery (version ${version}).`);
  }
  const autoplay = obj.autoplay && typeof obj.autoplay === "object" ? obj.autoplay : {};
  return {
    app: "splashery",
    version: SCENE_VERSION,
    createdAt:
      typeof obj.createdAt === "string" ? obj.createdAt.slice(0, 40) : new Date().toISOString(),
    seed: Math.round(num(obj.seed, 1, 0, 16777215)),
    toy: normalizeToy(obj.toy, profile),
    look: normalizeLook(obj.look),
    effects: normalizeEffects(obj.effects),
    paint: { stamps: normalizeStamps(obj.paint?.stamps) },
    camera: normalizeCamera(obj.camera),
    autoplay: {
      turntable: autoplay.turntable !== false,
      effect: IDLE_EFFECTS.some((e) => e.id === autoplay.effect) ? autoplay.effect : "none",
    },
    pattern: normalizePattern(obj.pattern, normalizeHex),
    motion: normalizeMotion(obj.motion),
  };
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatCount(n) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${Math.round(n / 1e3)}k`;
  return String(n);
}
