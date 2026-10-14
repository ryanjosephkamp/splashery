// Codex task 78c: Ryan Kamp's Overprint forms, through the Splashery kit.
// Only centers move on the GPU. A form change snapshots the cloud where it
// is now, including an unfinished flight or push, then flies to new targets.
// No portfolio renderer, font, or QR encoder is shipped here.
import { BITMAP } from "../font.js";
import { quatFromTo, quatEuler, quatRotate } from "../kit.js";
import { PRESETS, compileProgram } from "./splat-equation.js";

const TAU = 2 * Math.PI;
const GOLD = 0.6180339887498949;
const R2 = [0.7548776662466927, 0.5698402909980532];
const R3 = [0.8191725133961645, 0.6710436067037893, 0.5497004779019703];
const frac = (x) => x - Math.floor(x);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => ((x = clamp(x)), x * x * (3 - 2 * x));
export const FLIGHT_SECONDS = 1.8;
export const FORMS = [
  { id: "word", label: "Word" },
  { id: "lorenz", label: "Lorenz attractor" },
  { id: "klein", label: "Klein bottle" },
  { id: "gyroid", label: "Gyroid" },
  { id: "loop", label: "Loop" },
  { id: "qr", label: "QR code" },
];
const formOf = (o) => (FORMS.some((f) => f.id === o.form) ? o.form : "word");
const unit = (v) => {
  const r = Math.hypot(...v) || 1;
  return v.map((x) => x / r);
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; // prettier-ignore
export const wordOf = (value) => String(value || "SPLATS").normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9 .,'!?-]/g, "?")
  .trim().slice(0, 24) || "SPLATS"; // prettier-ignore

let encodeQR;
const codes = new Map();
let live = null; // only the last driven browser instance, never a Node build
const textOf = (o) => String(o.qrText || "Splashery");

function blank(n) {
  return { pos: new Float32Array(n * 3), direction: new Float32Array(n * 3),
    radius: new Float32Array(n), ink: new Uint8Array(n), flat: false }; // prettier-ignore
}

// The same fixed framing for every form; a switch does not zoom the camera.
function finish(out) {
  const { pos } = out;
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let j = 0; j < pos.length; j++) {
    lo[j % 3] = Math.min(lo[j % 3], pos[j]);
    hi[j % 3] = Math.max(hi[j % 3], pos[j]);
  }
  const mid = lo.map((x, a) => (x + hi[a]) / 2);
  let radius = 0;
  for (let j = 0; j < pos.length; j += 3)
    radius = Math.max(radius, Math.hypot(pos[j] - mid[0], pos[j + 1] - mid[1], pos[j + 2] - mid[2])); // prettier-ignore
  const scale = 0.82 / (radius || 1);
  out.transform = { center: mid, scale };
  for (let j = 0; j < pos.length; j++) pos[j] = (pos[j] - mid[j % 3]) * scale;
  for (let i = 0; i < out.radius.length; i++) out.radius[i] *= scale;
  return out;
}

function word(n, o) {
  const out = blank(n);
  out.flat = true;
  const cells = [];
  // Long words wrap, so they still read on a phone. Use the site's own font.
  const text = wordOf(o.word);
  const lines = text.match(/.{1,8}/g);
  lines.forEach((line, row) => {
    for (let ch = 0; ch < line.length; ch++) {
      const glyph = BITMAP[line[ch]];
      if (!glyph) continue;
      for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++)
        if ((glyph[y] >> (4 - x)) & 1) cells.push([ch * 6 + x - line.length * 3, row * 10 + y]); // prettier-ignore
    }
  });
  for (let i = 0; i < n; i++) {
    const cell = cells[i % cells.length];
    const j = Math.floor(i / cells.length) + 1;
    out.pos.set([cell[0] + frac(j * R2[0]), -cell[1] - frac(j * R2[1]), 0], i * 3);
    out.direction.set([0, 0, 1], i * 3);
    out.radius[i] = 0.7 * Math.sqrt(cells.length / n);
    out.ink[i] = cell[0] > 0 ? 1 : 0;
  }
  return finish(out);
}

// Overprint's RK4 Lorenz path, with a fixed integration step independent of
// the display budget. Selecting a few points must not destabilize the ODE.
let lorenzPath;
export function lorenzDerivative([x, y, z]) {
  return [10 * (y - x), x * (28 - z) - y, x * y - (8 / 3) * z];
}
function pathForLorenz() {
  if (lorenzPath) return lorenzPath;
  const steps = 18000;
  const path = new Float32Array(steps * 3);
  let p = [0.6, 0.1, 0.2];
  const dt = 0.007;
  for (let j = -800; j < steps; j++) {
    const a = lorenzDerivative(p);
    const b = lorenzDerivative(p.map((x, i) => x + (a[i] * dt) / 2));
    const c = lorenzDerivative(p.map((x, i) => x + (b[i] * dt) / 2));
    const d = lorenzDerivative(p.map((x, i) => x + c[i] * dt));
    p = p.map((x, i) => x + (dt * (a[i] + 2 * b[i] + 2 * c[i] + d[i])) / 6);
    if (j >= 0) path.set(p, j * 3);
  }
  return (lorenzPath = path);
}
function lorenz(n) {
  const out = blank(n);
  const path = pathForLorenz();
  const steps = path.length / 3;
  for (let i = 0; i < n; i++) {
    const j = Math.floor(frac((i + 1) * GOLD) * steps) * 3;
    const [x, y, z] = path.subarray(j, j + 3);
    const [dx, dy, dz] = lorenzDerivative([x, y, z]);
    out.pos.set([x, z, -y], i * 3);
    out.direction.set(unit([dx, dz, -dy]), i * 3);
    out.radius[i] = 0.12 * Math.sqrt(12000 / n);
    out.ink[i] = x > 0 ? 1 : 0;
  }
  return finish(out);
}

// Reuse the existing safe Splat equation preset at t = 0, rather than
// introducing a second copy of the figure-eight immersion's equations.
const kleinProgram = compileProgram(PRESETS.find((p) => p.id === "klein"));
export function kleinPoint(u, v) {
  const vars = { θ: u, y: v, t: 0 };
  return [kleinProgram.x.f(vars), kleinProgram.y.f(vars), kleinProgram.z.f(vars)];
}
function klein(n) {
  const out = blank(n);
  out.flat = true;
  // Show the immersion's opening in the shared face-on camera; the word,
  // loop, and QR code still face the viewer without a camera jump.
  const turn = quatEuler(65, 25, 0);
  for (let i = 0; i < n; i++) {
    const u = frac((i + 1) * R2[0]) * TAU;
    const v = frac((i + 1) * R2[1]) * TAU;
    const p = kleinPoint(u, v);
    const du = kleinPoint(u + 0.001, v).map((x, a) => x - p[a]);
    const dv = kleinPoint(u, v + 0.001).map((x, a) => x - p[a]);
    out.pos.set(quatRotate(turn, p), i * 3);
    out.direction.set(quatRotate(turn, unit(cross(du, dv))), i * 3);
    out.radius[i] = 0.08 * Math.sqrt(12000 / n);
    out.ink[i] = Math.floor((v / TAU) * 12) % 4 === 0 ? 1 : 0;
  }
  return finish(out);
}

export function gyroidField(x, y, z) {
  return Math.sin(x) * Math.cos(y) + Math.sin(y) * Math.cos(z) + Math.sin(z) * Math.cos(x);
}
function gyroid(n) {
  const out = blank(n);
  out.flat = true;
  const half = 2 * Math.PI;
  let i = 0;
  for (let j = 1; i < n && j < n * 40; j++) {
    const p = R3.map((a) => (frac(j * a) * 2 - 1) * half);
    if (Math.hypot(...p) > half) continue;
    let gradient;
    for (let step = 0; step < 8; step++) {
      const [x, y, z] = p;
      gradient = [Math.cos(x) * Math.cos(y) - Math.sin(z) * Math.sin(x),
        Math.cos(y) * Math.cos(z) - Math.sin(x) * Math.sin(y),
        Math.cos(z) * Math.cos(x) - Math.sin(y) * Math.sin(z)]; // prettier-ignore
      const f = gyroidField(x, y, z);
      if (Math.abs(f) < 0.0001) break;
      const s = f / (gradient.reduce((sum, x) => sum + x * x, 0) + 1e-6);
      for (let a = 0; a < 3; a++) p[a] -= gradient[a] * s;
    }
    if (Math.hypot(...p) > half || Math.abs(gyroidField(...p)) > 0.0001) continue;
    out.pos.set(p, i * 3);
    out.direction.set(unit(gradient), i * 3);
    out.radius[i] = half * Math.sqrt((2.06 * half) / n) * 0.52;
    out.ink[i] = gradient.reduce((s, x, a) => s + x * p[a], 0) > 0 ? 0 : 1;
    i++;
  }
  if (i !== n) throw new Error("The gyroid did not converge. Try a lower detail budget.");
  return finish(out);
}

function loop(n) {
  const out = blank(n);
  out.flat = true;
  const r = 0.36;
  for (let i = 0; i < n; i++) {
    const pick = frac((i + 1) * R2[0]);
    const along = frac((i + 1) * R2[1]);
    let x, y;
    if (pick < 0.5) {
      const a = along * TAU;
      const d = r * Math.sqrt(pick / 0.5);
      x = 1.5 + Math.cos(a) * d;
      y = Math.sin(a) * d;
      out.ink[i] = 1;
    } else if (pick < 0.7) {
      const share = (pick - 0.5) * 10;
      const a = along * TAU;
      const d = r * (1 + (frac(share) - 0.5) * 0.12);
      x = (share < 1 ? -1.5 : 0) + Math.cos(a) * d;
      y = Math.sin(a) * d;
    } else if (pick < 0.8) {
      const share = (pick - 0.7) * 20;
      x = (share < 1 ? -1.5 : 0) + r + 0.04 + (1.5 - 2 * r - 0.08) * along;
      y = (frac(share) - 0.5) * 0.04;
    } else {
      const a = along * Math.PI;
      x = -0.75 + Math.cos(a) * 0.75;
      y = r + 0.1 + Math.sin(a) * 0.6;
      out.ink[i] = 1;
    }
    out.pos.set([x, y, 0], i * 3);
    out.direction.set([0, 0, 1], i * 3);
    out.radius[i] = Math.sqrt((Math.PI * r * r) / (n * 0.5)) * 0.75;
  }
  return finish(out);
}

function qr(n, o) {
  const code = codes.get(textOf(o));
  if (!code) throw new Error("Pick the QR form before building it.");
  const out = blank(n);
  out.flat = true;
  out.code = code;
  const side = code.size + 8; // four quiet modules on every side
  const cells = side * side;
  const width = 1.16;
  const cell = width / side;
  for (let i = 0; i < n; i++) {
    const id = i % cells;
    const row = Math.floor(id / side);
    const col = id % side;
    const j = Math.floor(i / cells);
    const count = Math.floor(n / cells) + (id < n % cells ? 1 : 0);
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const y = Math.floor(j / cols);
    const rowCols = Math.min(cols, count - y * cols);
    out.pos.set([(col + (j % cols + 0.5) / rowCols) * cell - width / 2,
      width / 2 - (row + (y + 0.5) / rows) * cell, 0], i * 3); // prettier-ignore
    out.direction.set([0, 0, 1], i * 3);
    out.radius[i] = (cell / Math.min(cols, rows)) * 0.62;
    out.ink[i] = row >= 4 && col >= 4 && row < side - 4 && col < side - 4
      && code.dark[(row - 4) * code.size + col - 4] ? 1 : 0; // prettier-ignore
  }
  return out;
}

export function makeForm(form, n, o = {}) {
  return ({ word, lorenz, klein, gyroid, loop, qr }[form] || word)(n, o);
}

// Each splat gets its own flight direction, rather than bending the whole
// surface. Integer arithmetic matches the work-buffer programs exactly.
function hash(i) {
  let h = (Math.imul(i, 747796405) + 2891336453) >>> 0;
  h = Math.imul((h >>> ((h >>> 28) + 4)) ^ h, 277803737) >>> 0;
  return ((h >>> 22) ^ h) >>> 0;
}
const scatterDirection = (i) => [7, 11, 13].map((a) => (hash(i + a) / 4294967296) * 2 - 1);

// Centers in recipe units. This also snapshots an interrupted flight at
// the next build; it is not an all-splats CPU update on every frame.
export function posePoint(data, i) {
  const p = Array.from(data.form.pos.subarray(i * 3, i * 3 + 3));
  if (data.from) for (let a = 0; a < 3; a++) p[a] += (data.from[i * 3 + a] - p[a]) * data.remaining;
  const direction = scatterDirection(i);
  for (let a = 0; a < 3; a++) p[a] += direction[a] * data.scatter * 0.22;
  const push = data.push;
  const d = p.map((x, a) => x - push.at[a]);
  const weight = Math.exp(-d.reduce((s, x) => s + x * x, 0) / 0.16);
  for (let a = 0; a < 3; a++) p[a] += push.delta[a] * weight * (data.strength ?? 0.7);
  return p;
}

// The kit already carries a packed, fitted morph offset in splatAnim.
// Read it in the usual work-buffer hooks, and use two existing token
// uniforms for the pointer's position and displacement. No engine changes.
export function morphModifier(fit) {
  const scale = fit.scale.toFixed(8);
  const glsl = `
uniform vec4 uSpClock;
uniform vec4 uSpMorph;
uniform vec4 uSpTokens[96];
const float SM_S = ${scale};
float smHash(uint i) {
  uint h = i * 747796405u + 2891336453u;
  h = ((h >> ((h >> 28u) + 4u)) ^ h) * 277803737u;
  return float((h >> 22u) ^ h) / 4294967296.0;
}
void modifySplatCenter(inout vec3 center) {
  vec4 a = loadSplatAnim();
  float x = floor(a.z / 4096.0);
  float y = a.z - x * 4096.0;
  float z = mod(a.w, 4096.0);
  center += (vec3(x,y,z) - 2048.0) / 1024.0 * uSpMorph.x;
  vec3 p = center / SM_S;
  uint i = splat.index;
  p += (vec3(smHash(i+7u), smHash(i+11u), smHash(i+13u)) * 2.0 - 1.0) * uSpMorph.y * 0.22;
  center = p * SM_S;
  vec3 d = (center - uSpTokens[0].xyz) / SM_S;
  center += uSpTokens[2].xyz * exp(-dot(d,d) / 0.16);
}
void modifySplatRotationScale(vec3 originalCenter, vec3 modifiedCenter, inout vec4 rotation, inout vec3 scale) {
  scale *= uSpClock.y;
}
void modifySplatColor(vec3 center, inout vec4 color) {
  color.rgb *= uSpClock.z;
}`;
  const wgsl = `
uniform uSpClock: vec4f;
uniform uSpMorph: vec4f;
uniform uSpTokens: array<vec4f, 96>;
const SM_S: f32 = ${scale};
fn smHash(i: u32) -> f32 {
  var h = i * 747796405u + 2891336453u;
  h = ((h >> ((h >> 28u) + 4u)) ^ h) * 277803737u;
  return f32((h >> 22u) ^ h) / 4294967296.0;
}
fn modifySplatCenter(center: ptr<function, vec3f>) {
  let a = loadSplatAnim();
  let x = floor(a.z / 4096.0);
  let y = a.z - x * 4096.0;
  let z = a.w - floor(a.w / 4096.0) * 4096.0;
  *center += (vec3f(x,y,z) - vec3f(2048.0)) / 1024.0 * uniform.uSpMorph.x;
  var p = *center / SM_S;
  let i = splat.index;
  p += (vec3f(smHash(i+7u), smHash(i+11u), smHash(i+13u)) * 2.0 - vec3f(1.0)) * uniform.uSpMorph.y * 0.22;
  *center = p * SM_S;
  let d = (*center - uniform.uSpTokens[0].xyz) / SM_S;
  *center += uniform.uSpTokens[2].xyz * exp(-dot(d,d) / 0.16);
}
fn modifySplatRotationScale(originalCenter: vec3f, modifiedCenter: vec3f, rotation: ptr<function, vec4f>, scale: ptr<function, vec3f>) {
  *scale *= uniform.uSpClock.y;
}
fn modifySplatColor(center: vec3f, color: ptr<function, vec4f>) {
  *color = vec4f((*color).rgb * uniform.uSpClock.z, (*color).a);
}`;
  return { glsl, wgsl };
}

const inkColor = (second) => (second ? [0.98, 0.31, 0.15] : [0.035, 0.4, 0.43]);
function colorAt(form, i, twoInk) {
  if (form.code) return form.ink[i] ? [0.035, 0.075, 0.08] : [0.99, 0.98, 0.95];
  if (twoInk) return inkColor(form.ink[i]);
  const u = clamp(form.pos[i * 3] / 1.64 + 0.5);
  const normal = form.direction.subarray(i * 3, i * 3 + 3);
  const light = form.flat
    ? 0.66 + 0.34 * Math.abs(normal[0] * 0.42 + normal[1] * 0.8 + normal[2] * 0.43)
    : 1;
  return [0.12 + 0.74 * u, 0.62 - 0.36 * u, 0.78 - 0.15 * u].map((x) => x * light);
}

export const RECIPES = {
  "shape-morph": {
    alive: true,
    turntable: false,
    kernel: "sharp",
    density: 0.12, // 7,200 on low, 16,800 on mid, and 24,000 on high/max
    options: [
      { key: "form", label: "Form", type: "select", default: "word", choices: FORMS },
      { key: "word", label: "Word", type: "text", default: "SPLATS", maxLength: 24 },
      {
        key: "qrText",
        label: "QR text (up to 42 bytes)",
        type: "text",
        default: "Splashery",
        maxLength: 42,
      },
      { key: "twoInk", label: "Two-ink print", type: "switch", default: false },
    ],
    controls: [
      { key: "scatter", label: "Scatter and re-form", type: "pulse", ease: 2.4, pausable: false },
      { key: "push", label: "Push strength", type: "slider", default: 0.7 },
    ],
    action: { key: "scatter", label: "Scatter and re-form" },
    // Fetch nothing for the other five forms, including when QR text changes.
    async prepare(o) {
      if (formOf(o) !== "qr") return;
      const text = textOf(o);
      if (new TextEncoder().encode(text).length > 42)
        throw new Error("Use up to 42 bytes of QR text so the form stays readable on a phone.");
      if (!encodeQR) ({ encodeQR } = await import("../qr/encode.js"));
      if (!codes.has(text)) {
        if (codes.size >= 8) codes.delete(codes.keys().next().value);
        codes.set(text, encodeQR(text, "M", { boost: false }));
      }
    },
    gpuField: (o, fit) => morphModifier(fit),
    drag: {
      plane: "view",
      at: () => !!live,
      start(p) {
        if (!live) return;
        live.push = { at: p.slice(), delta: [0, 0, 0], held: true, released: null };
      },
      move(p) {
        if (!live?.push.held) return;
        const d = p.map((x, a) => x - live.push.at[a]);
        const len = Math.hypot(...d);
        live.push.delta = d.map((x) => x * Math.min(1, 0.55 / (len || 1)));
        // Keep a completed drag from also firing the tap action on release.
        return { control: "push", value: live.strength };
      },
      end() {
        if (!live) return;
        live.push.held = false;
        live.push.released = live.t;
        live.push.from = live.push.delta.slice();
      },
    },
    drive(t, c, out, info) {
      const data = info?.data;
      if (!data?.form) return;
      if (data.start === null) data.start = t;
      data.t = t;
      data.remaining = data.from ? 1 - smooth((t - data.start) / FLIGHT_SECONDS) : 0;
      data.scatter = Math.sin(Math.PI * clamp(c.scatter || 0));
      data.strength = c.push ?? 0.7;
      if (typeof window !== "undefined") live = data;
      const push = data.push;
      if (!push.held && push.released !== null) {
        const seconds = Math.max(0, t - push.released);
        const factor = seconds < 1.6 ? Math.exp(-4.5 * seconds) * Math.cos(19 * seconds) : 0;
        push.delta = push.from.map((x) => x * factor);
      }
      out.morph = [data.remaining, data.scatter, 0, 0];
      out.tokens = [
        { offset: push.at, visible: 0 },
        { offset: push.delta.map((x) => x * data.strength), visible: 0 },
      ];
    },
    build(k, o) {
      const n = Math.max(1, Math.min(24000, k.count));
      const form = makeForm(formOf(o), n, o);
      let from = null;
      if (
        typeof window !== "undefined" &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches &&
        window.__splashery?.player?.scene.motion.alive !== false &&
        live?.form.pos.length === n * 3
      ) {
        from = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) from.set(posePoint(live, i), i * 3);
      }
      k.data = { form, from, remaining: from ? 1 : 0, scatter: 0, start: null, t: 0,
        push: { at: [0, 0, 0], delta: [0, 0, 0], held: false, released: null },
        tapBox: { min: [-0.84, -0.84, -0.1], max: [0.84, 0.84, 0.1] } }; // prettier-ignore
      k.fitMorphs = false;
      // Frame the cloud's push and scatter as well as its resting forms.
      for (const a of [0, 1, 2])
        for (const s of [-1, 1]) {
          const p = [0, 0, 0];
          p[a] = s * 1.25;
          k.reach(p);
        }
      k.cloud({ share: n / k.count, jitter: 0, pattern: false }, (_, i) => {
        const r = form.radius[i];
        const dir = Array.from(form.direction.subarray(i * 3, i * 3 + 3));
        return {
          p: Array.from(form.pos.subarray(i * 3, i * 3 + 3)),
          to: from
            ? Array.from(from.subarray(i * 3, i * 3 + 3))
            : [form.pos[i * 3], form.pos[i * 3 + 1], form.pos[i * 3 + 2]],
          scales: form.flat ? [r, r, r * 0.25] : [r * 2.6, r, r],
          quat: quatFromTo(form.flat ? [0, 0, 1] : [1, 0, 0], dir),
          color: colorAt(form, i, !!o.twoInk),
          opacity: 1,
        };
      });
    },
  },
};
