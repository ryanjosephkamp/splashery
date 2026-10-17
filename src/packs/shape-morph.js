// Codex task 78c: Ryan Kamp's Overprint forms, through the Splashery kit.
// Only centers move on the GPU. A form change snapshots the cloud where it
// is now, including an unfinished flight or push, then flies to new targets.
// No portfolio renderer, font, or QR encoder is shipped here.
// Lane PT1: a list of forms the person sets (shapes, any words or names with
// emoji, QR codes), in their order; a tap morphs to the next one, starting
// where the tap landed and spreading from there. Words come from the shared
// text module (src/text-splats.js).
// Lane PT3: every form wears the toy's own teal-to-pink ink (or the two
// inks): an emoji gives only its shape and its light and dark, and the QR
// code's dark and light modules are deep and pale shades of the ink. A
// morph pairs each splat with a place in the new form along a space-filling
// curve, so neighbors stay neighbors and the cloud flows as one sheet, and
// the cloud has more splats, sized to close each surface.
import { quatFromTo, quatEuler, quatRotate } from "../kit.js";
import { PRESETS, compileProgram } from "./splat-equation.js";
import { textSplats, cleanText, visibleCount, hasInk } from "../text-splats.js";

const TAU = 2 * Math.PI;
const GOLD = 0.6180339887498949;
const R2 = [0.7548776662466927, 0.5698402909980532];
const R3 = [0.8191725133961645, 0.6710436067037893, 0.5497004779019703];
const frac = (x) => x - Math.floor(x);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x) => ((x = clamp(x)), x * x * (3 - 2 * x));
export const FLIGHT_SECONDS = 1.8;
// A tap's morph leaves the tapped place first: each splat waits this many
// seconds for every unit it lies from the tap (the cloud is 1.64 across).
export const WAVE_SECONDS = 0.38;
export const FORMS = [
  { id: "word", label: "Word" },
  { id: "lorenz", label: "Lorenz attractor" },
  { id: "klein", label: "Klein bottle" },
  { id: "gyroid", label: "Gyroid" },
  { id: "loop", label: "Loop" },
  { id: "qr", label: "QR code" },
];
const formOf = (o) => (FORMS.some((f) => f.id === o.form) ? o.form : "word");
const SHAPES = FORMS.filter((f) => f.id !== "word" && f.id !== "qr");
export const MAX_FORMS = 16;
export const MOST_SPLATS = 200000;
const MAX_WORD = 24; // as the Word box's own limit
const unit = (v) => {
  const r = Math.hypot(...v) || 1;
  return v.map((x) => x / r);
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; // prettier-ignore
// Any typed text: letters of any script, digits, symbols, and emoji.
export const wordOf = (value) => {
  const text = cleanText(value, 200);
  return visibleCount(text) ? text : "SPLATS";
};

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
  // Long words wrap, so they still read on a phone. The device's own fonts.
  // A word that draws nothing (U+3164, a private-use code point) shows
  // SPLATS rather than collapsing the cloud to a point.
  let text = wordOf(o.word);
  if (!hasInk(text, { cols: 10 })) text = "SPLATS";
  const t = textSplats(text, { count: n, seed: 78, cols: 10, depth: 0, colorKey: "morph" });
  // An emoji's light and dark (0..1, its own colors' luminance; -1 for a
  // plain glyph), which the ink then shades. Its hues are not used.
  out.tone = new Float32Array(n).fill(-1);
  let colored = false;
  for (let i = 0; i < n; i++) {
    out.pos.set([t.pos[i * 3], t.pos[i * 3 + 1], 0], i * 3);
    out.direction.set([0, 0, 1], i * 3);
    out.radius[i] = t.sigma[i];
    out.ink[i] = t.pos[i * 3] > 0 ? 1 : 0;
    if (t.layout.glyphs[t.glyph[i]]?.color) {
      const [r, g, b] = t.col.subarray(i * 3, i * 3 + 3);
      // The text module bakes a front face's light (0.93) in; take it out.
      out.tone[i] = clamp((0.2126 * r + 0.7152 * g + 0.0722 * b) / 0.93);
      colored = true;
    }
  }
  if (!colored) out.tone = null;
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
    // Lane PT3: anywhere along the path, between its steps, so a large
    // cloud never stacks splats on the same step (that read as dashes).
    const at = frac((i + 1) * GOLD) * (steps - 1);
    const j = Math.floor(at) * 3;
    const f = at - Math.floor(at);
    const [x, y, z] = [0, 1, 2].map((a) => path[j + a] + (path[j + 3 + a] - path[j + a]) * f);
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
    out.radius[i] = 0.1 * Math.sqrt(12000 / n); // lane PT3: more overlap, less grain
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
    out.radius[i] = half * Math.sqrt((2.06 * half) / n) * 0.85; // lane PT3: more overlap, less grain
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
  const darkAt = (row, col) =>
    row >= 4 && col >= 4 && row < side - 4 && col < side - 4 && code.dark[(row - 4) * code.size + col - 4] ? 1 : 0; // prettier-ignore
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
    const fx = ((j % cols) + 0.5) / rowCols;
    const fy = (y + 0.5) / rows;
    out.pos.set([(col + fx) * cell - width / 2, width / 2 - (row + fy) * cell, 0], i * 3);
    out.direction.set([0, 0, 1], i * 3);
    const dark = darkAt(row, col);
    out.ink[i] = dark;
    // Lane PT3: modules as clean squares. A splat by a side where the next
    // module is the other shade shrinks to stay inside its own.
    let edge = Infinity;
    if (darkAt(row, col - 1) !== dark) edge = Math.min(edge, fx);
    if (darkAt(row, col + 1) !== dark) edge = Math.min(edge, 1 - fx);
    if (darkAt(row - 1, col) !== dark) edge = Math.min(edge, fy);
    if (darkAt(row + 1, col) !== dark) edge = Math.min(edge, 1 - fy);
    const r = (cell / Math.min(cols, rows)) * 0.75;
    out.radius[i] = Math.min(r, Math.max(r * 0.4, edge * cell * 0.5));
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
// How far splat i still has to fly (1 at the start, 0 home): the whole
// cloud at once, or (after a tap) a wave out from the tapped place.
export function remainingFor(data, i) {
  if (!data.from) return 0;
  const o = data.origin;
  if (!o) return data.remaining;
  const f = data.from;
  const d = Math.hypot(f[i * 3] - o[0], f[i * 3 + 1] - o[1], f[i * 3 + 2] - o[2]);
  return 1 - smooth((data.elapsed - d * WAVE_SECONDS) / FLIGHT_SECONDS);
}

export function posePoint(data, i) {
  const p = Array.from(data.form.pos.subarray(i * 3, i * 3 + 3));
  const left = remainingFor(data, i);
  if (data.from) for (let a = 0; a < 3; a++) p[a] += (data.from[i * 3 + a] - p[a]) * left;
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
float smLeft = 0.0;
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
  vec3 off = (vec3(x,y,z) - 2048.0) / 1024.0;
  float left = uSpMorph.x;
  if (uSpMorph.z > 0.5) {
    // A tap's wave: the flight starts later the further from the tap.
    float d = length((center + off) / SM_S - uSpTokens[4].xyz / SM_S);
    float u = clamp((uSpMorph.w - d * ${WAVE_SECONDS.toFixed(4)}) / ${FLIGHT_SECONDS.toFixed(4)}, 0.0, 1.0);
    left = 1.0 - u * u * (3.0 - 2.0 * u);
  }
  center += off * left;
  smLeft = length(off) > 1e-4 ? left : 0.0;
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
  // In flight, every splat wears the cloud's own teal-to-pink ink, and its
  // new form's colors come in as it lands.
  float u = clamp(center.x / SM_S / 1.64 + 0.5, 0.0, 1.0);
  vec3 ink = vec3(0.12 + 0.74 * u, 0.62 - 0.36 * u, 0.78 - 0.15 * u);
  color.rgb = mix(color.rgb, ink, smoothstep(0.0, 0.35, smLeft));
  color.rgb *= uSpClock.z;
}`;
  const wgsl = `
uniform uSpClock: vec4f;
uniform uSpMorph: vec4f;
uniform uSpTokens: array<vec4f, 96>;
const SM_S: f32 = ${scale};
var<private> smLeft: f32 = 0.0;
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
  let off = (vec3f(x,y,z) - vec3f(2048.0)) / 1024.0;
  var left = uniform.uSpMorph.x;
  if (uniform.uSpMorph.z > 0.5) {
    let d = length((*center + off) / SM_S - uniform.uSpTokens[4].xyz / SM_S);
    let u = clamp((uniform.uSpMorph.w - d * ${WAVE_SECONDS.toFixed(4)}) / ${FLIGHT_SECONDS.toFixed(4)}, 0.0, 1.0);
    left = 1.0 - u * u * (3.0 - 2.0 * u);
  }
  *center += off * left;
  smLeft = select(0.0, left, length(off) > 1e-4);
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
  let u = clamp(center.x / SM_S / 1.64 + 0.5, 0.0, 1.0);
  let ink = vec3f(0.12 + 0.74 * u, 0.62 - 0.36 * u, 0.78 - 0.15 * u);
  let rgb = mix((*color).rgb, ink, smoothstep(0.0, 0.35, smLeft));
  *color = vec4f(rgb * uniform.uSpClock.z, (*color).a);
}`;
  return { glsl, wgsl };
}

const inkColor = (second) => (second ? [0.98, 0.31, 0.15] : [0.035, 0.4, 0.43]);
// The toy's ink across the cloud: teal on the left to pink on the right
// (u 0..1), the same ink the cloud wears in flight (morphModifier).
export const inkAt = (u) => [0.12 + 0.74 * u, 0.62 - 0.36 * u, 0.78 - 0.15 * u];
// A shade of an ink, v 0 (deepest) to 1 (palest): darker below 0.6, then
// toward white, so an emoji's light and dark and a QR code's two kinds of
// module read in the toy's own colors.
export function shade(c, v) {
  if (v < 0.6) return c.map((x) => x * (0.16 + (0.84 * v) / 0.6));
  const k = ((v - 0.6) / 0.4) * 0.8;
  return c.map((x) => x + (1 - x) * k);
}
// The QR code's modules: deep and pale shades, far enough apart that the
// code still scans (tests/pt3.spec.mjs checks the contrast).
export const QR_DARK = 0.12;
export const QR_LIGHT = 1;
export function colorAt(form, i, twoInk) {
  const u = clamp(form.pos[i * 3] / 1.64 + 0.5);
  const tone = form.tone ? form.tone[i] : -1;
  if (form.code) {
    const dark = form.ink[i] === 1;
    if (twoInk) return shade(inkColor(!dark), dark ? 0.12 : QR_LIGHT);
    return shade(inkAt(u), dark ? QR_DARK : QR_LIGHT);
  }
  // An emoji: its shape and its light and dark, in the ink.
  if (tone >= 0) return shade(twoInk ? inkColor(tone > 0.5) : inkAt(u), 0.08 + 0.9 * tone);
  if (twoInk) return inkColor(form.ink[i]);
  const normal = form.direction.subarray(i * 3, i * 3 + 3);
  const light = form.flat
    ? 0.66 + 0.34 * Math.abs(normal[0] * 0.42 + normal[1] * 0.8 + normal[2] * 0.43)
    : 1;
  return inkAt(u).map((x) => x * light);
}

// ---- Pairing the old cloud with the new form -------------------------------------
// A splat flies to the place in the new form at the same rank along a 3D
// Hilbert curve through each cloud's own box: places close in one form go
// to places close in the other, so the morph flows as a sheet instead of a
// dust of crossing splats. Pure and deterministic.
const HILBERT_BITS = 10;
export function hilbertKey(x, y, z) {
  const X = [x, y, z];
  const top = 1 << (HILBERT_BITS - 1);
  for (let q = top; q > 1; q >>= 1) {
    const p = q - 1;
    for (let i = 0; i < 3; i++) {
      if (X[i] & q) X[0] ^= p;
      else {
        const t = (X[0] ^ X[i]) & p;
        X[0] ^= t;
        X[i] ^= t;
      }
    }
  }
  for (let i = 1; i < 3; i++) X[i] ^= X[i - 1];
  let t = 0;
  for (let q = top; q > 1; q >>= 1) if (X[2] & q) t ^= q - 1;
  for (let i = 0; i < 3; i++) X[i] ^= t;
  let key = 0;
  for (let b = HILBERT_BITS - 1; b >= 0; b--)
    for (let i = 0; i < 3; i++) key = key * 2 + ((X[i] >> b) & 1);
  return key;
}
// The cloud's indices in curve order.
export function curveOrder(pos, n) {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let j = 0; j < n * 3; j++) {
    lo[j % 3] = Math.min(lo[j % 3], pos[j]);
    hi[j % 3] = Math.max(hi[j % 3], pos[j]);
  }
  // One scale for all three axes, so a flat form stays flat on the curve.
  const span = Math.max(1e-6, ...hi.map((h, a) => h - lo[a]));
  const most = (1 << HILBERT_BITS) - 1;
  const cell = (v, a) => Math.min(most, Math.floor(((v - lo[a]) / span) * most));
  const key = new Float64Array(n);
  for (let i = 0; i < n; i++)
    key[i] = hilbertKey(cell(pos[i * 3], 0), cell(pos[i * 3 + 1], 1), cell(pos[i * 3 + 2], 2)) * n + i; // prettier-ignore
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  return order.sort((a, b) => key[a] - key[b]);
}
// Reorders the form in place so that splat i (now at from[i]) gets the
// form's place of the same curve rank.
export function pairForm(form, from, n) {
  const was = curveOrder(from, n);
  const to = curveOrder(form.pos, n);
  const pick = new Uint32Array(n);
  for (let r = 0; r < n; r++) pick[was[r]] = to[r];
  const moved = (a, k) => {
    if (!a) return a;
    const b = new a.constructor(a.length);
    for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) b[i * k + c] = a[pick[i] * k + c];
    return b;
  };
  form.pos = moved(form.pos, 3);
  form.direction = moved(form.direction, 3);
  form.radius = moved(form.radius, 1);
  form.ink = moved(form.ink, 1);
  form.tone = moved(form.tone, 1);
  return form;
}

// ---- The list of forms ------------------------------------------------------------
// Saved in the scene as `forms`, a JSON list of strings: a shape's id, "w:"
// and a word, or "q:" and a QR code's text. `at` is the one showing. The
// one showing is also what the Form, Word, and QR text boxes say, so they
// edit it in place (and older links, which have only those, open the
// six-form list at their form).

const SHAPE_IDS = SHAPES.map((f) => f.id);
const entryOf = (o) => {
  const form = formOf(o);
  return form === "word" ? `w:${wordOf(o.word)}` : form === "qr" ? `q:${textOf(o)}` : form;
};
const validEntry = (e) =>
  typeof e === "string" &&
  (SHAPE_IDS.includes(e) || ((e.startsWith("w:") || e.startsWith("q:")) && e.length > 2));

export function formList(o = {}) {
  let list = null;
  try {
    const parsed = JSON.parse(o.forms || "null");
    if (Array.isArray(parsed)) list = parsed.filter(validEntry).slice(0, MAX_FORMS);
  } catch {
    list = null;
  }
  const current = entryOf(o);
  if (!list?.length) {
    // The original six, with this link's word and QR text.
    list = [`w:${wordOf(o.word)}`, ...SHAPE_IDS, `q:${textOf(o)}`];
    const form = formOf(o);
    const at = list.findIndex((e) => (form === "word" ? e.startsWith("w:") : form === "qr" ? e.startsWith("q:") : e === form)); // prettier-ignore
    return { list, at: Math.max(0, at) };
  }
  const at = Math.max(0, Math.min(list.length - 1, Math.round(Number(o.at) || 0)));
  list[at] = current;
  return { list, at };
}

// The options that show entry `at` of `list`.
export function showForm(list, at) {
  const i = ((at % list.length) + list.length) % list.length;
  const e = list[i];
  const out = { forms: JSON.stringify(list), at: String(i) };
  if (e.startsWith("w:")) Object.assign(out, { form: "word", word: e.slice(2) });
  else if (e.startsWith("q:")) Object.assign(out, { form: "qr", qrText: e.slice(2) });
  else out.form = e;
  return out;
}

export function entryLabel(e) {
  if (e.startsWith("w:")) {
    const t = e.slice(2).replace(/\n/g, " ");
    return [...t].length > 12 ? `${[...t].slice(0, 11).join("")}…` : t;
  }
  if (e.startsWith("q:")) return "QR code";
  return { lorenz: "Lorenz", klein: "Klein bottle", gyroid: "Gyroid", loop: "Loop" }[e] || e;
}

let opts = {}; // the options of the last build in the browser
let origin = null; // where the tap that asked for the next form landed
const next = (o, point, step = 1) => {
  const { list, at } = formList(o);
  origin = point ? point.slice() : null;
  return { options: showForm(list, at + step), key: "morph" };
};

export const RECIPES = {
  "shape-morph": {
    alive: true,
    turntable: false,
    kernel: "sharp",
    // Lane PT3: 30,000 on low, 70,000 on mid, 100,000 on high, 140,000 on
    // max, and half the Splats slider's count (up to 200,000).
    density: 0.5,
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
      // Lane PT1: the list of forms and the one showing (see formList).
      { key: "forms", label: "Your forms", type: "text", default: "", hidden: true },
      { key: "at", label: "Showing", type: "text", default: "", hidden: true },
    ],
    controls: [
      { key: "morph", label: "Next form", type: "pulse", ease: 2.4, pausable: false },
      { key: "scatter", label: "Scatter and re-form", type: "pulse", ease: 2.4, pausable: false },
      { key: "push", label: "Push strength", type: "slider", default: 0.7 },
    ],
    // A tap (or Play) morphs to the next form in the list, from the tap.
    action: {
      key: "morph",
      label: "Next form",
      at: (point) => next(opts, point),
      play: () => next(opts, null),
    },
    // The list on the stage: a chip per form (tap one to go to it).
    toolbar: {
      label: "Your forms",
      items() {
        const { list, at } = formList(opts);
        return [
          { id: "scatter", text: "Scatter", label: "Scatter and re-form" },
          ...list.map((e, i) => ({
            id: `go-${i}`,
            text: entryLabel(e),
            label: `Morph to ${i + 1}: ${entryLabel(e)}`,
            pressed: i === at,
          })),
        ];
      },
      activate(id) {
        if (id === "scatter") return { key: "scatter" };
        const { list, at } = formList(opts);
        const i = Number(id.slice(3));
        if (!Number.isInteger(i) || i === at) return null;
        origin = null;
        return { options: showForm(list, i), key: "morph" };
      },
    },
    // The Toy tab's editor: add shapes, move and remove forms.
    keyboard: {
      label: "Edit your forms",
      items() {
        const { list } = formList(opts);
        const full = list.length >= MAX_FORMS;
        return [
          ...SHAPES.map((f) => ({ id: `add-${f.id}`, text: `+ ${f.label}`, label: `Add the ${f.label}`, disabled: full })), // prettier-ignore
          {
            id: "add-qr",
            text: "+ QR code",
            label: "Add a QR code of the QR text",
            disabled: full,
          },
          ...list.flatMap((e, i) => [
            { id: `up-${i}`, text: `↑ ${i + 1}. ${entryLabel(e)}`, label: `Move ${i + 1}, ${entryLabel(e)}, earlier`, disabled: i === 0 }, // prettier-ignore
            { id: `del-${i}`, text: `✕ ${i + 1}`, label: `Remove ${i + 1}, ${entryLabel(e)}`, disabled: list.length <= 1 }, // prettier-ignore
          ]),
        ];
      },
      status() {
        const { list, at } = formList(opts);
        return `${list.length} forms. Showing ${at + 1}: ${entryLabel(list[at])}.`;
      },
      activate(id) {
        const { list, at } = formList(opts);
        let show = at;
        if (id.startsWith("add-")) {
          if (list.length >= MAX_FORMS) return null;
          list.push(id === "add-qr" ? `q:${textOf(opts)}` : id.slice(4));
        } else if (id.startsWith("up-")) {
          const i = Number(id.slice(3));
          if (!(i > 0)) return null;
          [list[i - 1], list[i]] = [list[i], list[i - 1]];
          show = at === i ? i - 1 : at === i - 1 ? i : at;
        } else if (id.startsWith("del-")) {
          const i = Number(id.slice(4));
          if (list.length <= 1 || !(i >= 0)) return null;
          list.splice(i, 1);
          show = at > i ? at - 1 : Math.min(at, list.length - 1);
        } else return null;
        origin = null;
        return { options: showForm(list, show), key: "edit" };
      },
    },
    input: {
      title: "Add a word or name",
      placeholder: "Words, names, or emoji…",
      button: "Add",
      fileButton: false,
      note: "Each form you add joins the list, and the cloud morphs to it. A tap or Play morphs to the next form, starting where you tap. Pick a form on the stage to go straight to it. Add shapes or a QR code of the QR text, move forms earlier, or remove them under Edit your forms. Any language, digits, symbols, and emoji (flags and skin tones too) work, up to 24 characters.",
      async read(text) {
        const word = cleanText(text, 200);
        const n = visibleCount(word);
        if (!n) throw new Error("Type a word, a name, or an emoji first.");
        if (n > MAX_WORD)
          throw new Error(`Use up to ${MAX_WORD} letters, digits, symbols, or emoji.`);
        if (typeof document !== "undefined" && !hasInk(word, { cols: 10 }))
          throw new Error("Nothing in that text can be drawn here. Try letters, digits, or emoji.");
        const { list } = formList(opts);
        if (list.length >= MAX_FORMS) throw new Error(`The list holds up to ${MAX_FORMS} forms. Remove one first.`); // prettier-ignore
        list.push(`w:${word}`);
        origin = null;
        return showForm(list, list.length - 1);
      },
      shown() {
        const { list, at } = formList(opts);
        return `Showing ${at + 1} of ${list.length}: ${entryLabel(list[at])}`;
      },
    },
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
      data.elapsed = t - data.start;
      // The whole flight: with a tap's wave, it ends when the far side lands.
      const span = FLIGHT_SECONDS + (data.origin ? data.reach * WAVE_SECONDS : 0);
      data.remaining = data.from ? 1 - smooth(data.elapsed / span) : 0;
      data.scatter = Math.sin(Math.PI * clamp(c.scatter || 0));
      data.strength = c.push ?? 0.7;
      if (typeof window !== "undefined") live = data;
      const push = data.push;
      if (!push.held && push.released !== null) {
        const seconds = Math.max(0, t - push.released);
        const factor = seconds < 1.6 ? Math.exp(-4.5 * seconds) * Math.cos(19 * seconds) : 0;
        push.delta = push.from.map((x) => x * factor);
      }
      const wave = data.from && data.origin && data.remaining > 0;
      out.morph = [data.remaining, data.scatter, wave ? 1 : 0, wave ? data.elapsed : 0];
      out.tokens = [
        { offset: push.at, visible: 0 },
        { offset: push.delta.map((x) => x * data.strength), visible: 0 },
        { offset: data.origin || [0, 0, 0], visible: 0 },
      ];
    },
    build(k, o) {
      const n = Math.max(1, Math.min(MOST_SPLATS, k.count));
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
      if (from) pairForm(form, from, n);
      // A tap's wave starts at the tapped place (recipe units).
      const at = from && origin ? origin.slice() : null;
      origin = null;
      let reach = 0;
      if (at)
        for (let i = 0; i < n; i++)
          reach = Math.max(reach, Math.hypot(from[i * 3] - at[0], from[i * 3 + 1] - at[1], from[i * 3 + 2] - at[2])); // prettier-ignore
      if (typeof window !== "undefined") opts = { ...o };
      k.data = { form, from, origin: at, reach, elapsed: 0, remaining: from ? 1 : 0, scatter: 0, start: null, t: 0,
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
