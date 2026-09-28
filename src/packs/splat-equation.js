// Lane Manual: the splat equation toy. You program where every splat goes
// and what color it is, as equations in u, v and time t:
//
//   x = (2 + cos v)·cos u; y = sin v; z = (2 + cos v)·sin u
//   u = 0 .. 2pi; v = 0 .. 2pi; hue = v/(2pi); size = 0.06; count = 4000
//
// Each splat has its own (u, v): a grid over the two ranges (or scattered
// at random with spread = random), and the equations place it and color
// it. The equations are read by lane Math's safe reader (src/equation.js):
// no eval, no Function, 120 characters per field, so a link that carries
// them can only ever do arithmetic.
//
// Time moves the shape the way the graph and surface plotters bend with a
// (docs/handoff/Math.md, "Curves that bend in real time"): the program is
// built at twelve times t across one cycle (0 to 2π), copy j morphs exactly
// into copy j + 1 on channel 1, and drive() shows the copy for the moment.
// Each copy is built in its own pose, so it also sorts right there.
//
// The reader knows the variables x, y, t, r and θ, not u and v, so u and v
// are handed to it as θ and y (no name in its tables holds a u or a v, and
// a typed y or θ is turned away first), and its messages are translated
// back.

import { compile, asciiEquation, EquationError, MAX_LENGTH } from "../equation.js";

const TAU = Math.PI * 2;
const KNOTS = 12; // copies across one cycle of t (parts, so at most 14)
const COUNT_MIN = 100;
const COUNT_MAX = 10000;
const PLAY_SECS = 4;
const LIGHT = [0.42, 0.8, 0.43];

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const band = (x, a, b) => clamp01((x - a) / (b - a));
// Starts and ends still, at twice the average speed in the middle.
const glide = (x) => x - Math.sin(TAU * x) / TAU;
const since = (c, key, secs) => (c[key] > 0 ? (1 - c[key]) * secs : -1);

// ---- The presets ----------------------------------------------------------------------

// Each field is what someone could type; t runs from 0 to 2π in one cycle.
export const PRESETS = [
  {
    id: "sphere",
    label: "Sphere",
    x: "sin(v)cos(u + t)",
    y: "cos(v)",
    z: "sin(v)sin(u + t)",
    u: "0 .. 2pi",
    v: "0 .. pi",
    hue: "floor(6u/(2pi))/6 + 0.04",
    size: "0.035",
    count: "7000",
  },
  {
    id: "torus",
    label: "Torus",
    x: "(2 + cos(v + t))cos(u)",
    y: "sin(v + t)",
    z: "(2 + cos(v + t))sin(u)",
    u: "0 .. 2pi",
    v: "0 .. 2pi",
    hue: "v/(2pi)",
    size: "0.09",
    count: "6000",
  },
  {
    id: "mobius",
    label: "Möbius strip",
    x: "(1 + v cos((u + t)/2))cos(u + t)",
    y: "v sin((u + t)/2)",
    z: "(1 + v cos((u + t)/2))sin(u + t)",
    u: "0 .. 2pi",
    v: "-0.4 .. 0.4",
    hue: "u/(2pi)",
    size: "0.035",
    count: "4000",
  },
  {
    id: "seashell",
    label: "Seashell",
    x: "exp(0.1u)cos(u + t)(1.2 + cos v)",
    y: "exp(0.1u)(sin(v) - 2.4) + 3",
    z: "exp(0.1u)sin(u + t)(1.2 + cos v)",
    u: "0 .. 6pi",
    v: "0 .. 2pi",
    hue: "0.02 + 0.1u/(6pi) + 0.03cos(4u)",
    size: "0.14exp(0.1u)",
    count: "10000",
  },
  {
    id: "trefoil",
    label: "Trefoil knot",
    x: "(sin(u) + 2sin(2u))cos(t) - sin(3u)sin(t)",
    y: "cos(u) - 2cos(2u)",
    z: "-(sin(u) + 2sin(2u))sin(t) - sin(3u)cos(t)",
    u: "0 .. 2pi",
    v: "0 .. 1",
    hue: "u/(2pi)",
    size: "0.16",
    count: "2500",
  },
  {
    id: "wave",
    label: "Wave",
    x: "u",
    y: "0.45sin(2sqrt(u^2 + v^2) - t)",
    z: "v",
    u: "-3 .. 3",
    v: "-3 .. 3",
    hue: "0.58 - 0.07sin(2sqrt(u^2 + v^2) - t)",
    size: "0.07",
    count: "6000",
  },
  {
    id: "galaxy",
    label: "Spiral galaxy",
    x: "u^1.5 cos(pi floor(v) + 5u + 1.2(v - floor(v)) - t)",
    y: "0.06(1 - u)sin(91v + 37u)",
    z: "u^1.5 sin(pi floor(v) + 5u + 1.2(v - floor(v)) - t)",
    u: "0.02 .. 1",
    v: "0 .. 2",
    r: "0.55 + 0.45(1 - u)^2",
    g: "0.62 + 0.33(1 - u)^2",
    b: "1 - 0.45(1 - u)^3",
    size: "0.006 + 0.012(1 - u)^2",
    count: "10000",
    spread: "random",
  },
  {
    id: "klein",
    label: "Klein bottle (figure eight)",
    x: "(2 + cos(u/2)sin(v + t) - sin(u/2)sin(2v + 2t))cos(u)",
    y: "sin(u/2)sin(v + t) + cos(u/2)sin(2v + 2t)",
    z: "(2 + cos(u/2)sin(v + t) - sin(u/2)sin(2v + 2t))sin(u)",
    u: "0 .. 2pi",
    v: "0 .. 2pi",
    hue: "v/(2pi)",
    size: "0.13",
    count: "8000",
  },
];
const PRESET_BY_ID = Object.fromEntries(PRESETS.map((p) => [p.id, p]));

// The fields of a program, in the order they are shown.
export const FIELDS = ["x", "y", "z", "u", "v", "hue", "r", "g", "b", "size", "count", "spread"];
const EXPR_FIELDS = ["x", "y", "z", "hue", "r", "g", "b", "size"];

// ---- Reading a field --------------------------------------------------------------------

// The reader's own messages talk about x, y and θ; put u, v and t back.
function translate(err) {
  let msg = String(err?.message || err);
  msg = msg.replace(/“([^”]*)”/g, (_, s) => `“${s.replace(/θ/g, "u").replace(/y/g, "v")}”`);
  msg = msg.replace(/Use [^.]*and a or b for the sliders\./, "Use u, v and t.");
  msg = msg.replace(/Try something like y = a·sin\(b·x\)\./, "Try something like cos(u)·sin(v).");
  return msg;
}

// One expression in u, v and t (or, for a range end or the count, in none
// of them). Returns { f(vals), used } where vals is { θ: u, y: v, t }.
export function readExpr(text, allowed = ["u", "v", "t"]) {
  const src = String(text ?? "").trim();
  if (!src) throw new EquationError("it is empty.");
  if (src.length > MAX_LENGTH) throw new EquationError(`it is over ${MAX_LENGTH} characters.`);
  const low = asciiEquation(src).toLowerCase();
  const stray = /theta/.test(low) ? "θ" : /[xy]/.test(low.replace(/exp|max/g, "")) ? /y/.test(low) ? "y" : "x" : null; // prettier-ignore
  if (stray) {
    const vars = allowed.length ? `Use ${allowed.join(", ").replace(/, ([^,]*)$/, " and $1")}.` : "Use numbers only here."; // prettier-ignore
    throw new EquationError(`“${stray}” can't be used here. ${vars}`);
  }
  const mapped = low.replace(/u/g, "θ").replace(/v/g, "y");
  const names = allowed.map((n) => (n === "u" ? "θ" : n === "v" ? "y" : n));
  let c;
  try {
    c = compile(mapped, names);
  } catch (err) {
    if (!(err instanceof EquationError)) throw err;
    const e = new EquationError("x");
    e.message = translate(err);
    throw e;
  }
  return { f: c.f, used: { u: c.used.has("θ"), v: c.used.has("y"), t: c.used.has("t") } };
}

// "0 .. 2pi" (or "0 to 2pi", or "0, 2pi"): two numbers.
export function readRange(text) {
  const src = String(text ?? "").trim();
  const parts = src.split(/\s*(?:\.{2,3}|…|\bto\b|,)\s*/);
  if (parts.length !== 2 || !parts[0] || !parts[1])
    throw new EquationError("give it as two numbers, like 0 .. 2pi.");
  const [a, b] = parts.map((p) => readExpr(p, []).f({}));
  if (!Number.isFinite(a) || !Number.isFinite(b))
    throw new EquationError("its ends must be numbers.");
  if (a === b) throw new EquationError("its two ends are the same.");
  if (Math.abs(a) > 1e4 || Math.abs(b) > 1e4) throw new EquationError("its ends are too far out.");
  return [a, b];
}

function readCount(text) {
  const n = readExpr(text, []).f({});
  if (!Number.isFinite(n)) throw new EquationError("it must be a number.");
  return Math.round(Math.min(COUNT_MAX, Math.max(COUNT_MIN, n)));
}

function readSpread(text) {
  const s = String(text ?? "")
    .trim()
    .toLowerCase();
  if (s === "grid" || s === "random") return s;
  throw new EquationError("it is grid or random.");
}

// A whole program from its fields (strings). Returns the compiled program,
// or throws an Error with one line per field that can't be read.
export function compileProgram(fields) {
  const out = { fields: {} };
  const errors = [];
  const tryField = (name, fn) => {
    try {
      return fn();
    } catch (err) {
      if (!(err instanceof EquationError)) throw err;
      errors.push(`${name}: ${err.message}`);
      return null;
    }
  };
  for (const name of ["x", "y", "z"]) out[name] = tryField(name, () => readExpr(fields[name]));
  out.u = tryField("u", () => readRange(fields.u));
  out.v = tryField("v", () => readRange(fields.v || "0 .. 1"));
  if (fields.hue) out.hue = tryField("hue", () => readExpr(fields.hue));
  else
    for (const name of ["r", "g", "b"])
      out[name] = tryField(name, () => readExpr(fields[name] || "0.5"));
  out.size = tryField("size", () => readExpr(fields.size || "0.05"));
  out.count = tryField("count", () => readCount(fields.count || "4000"));
  out.spread = tryField("spread", () => readSpread(fields.spread || "grid"));
  if (errors.length) throw new Error(errors.join(" "));
  const used = (k) => EXPR_FIELDS.some((n) => out[n]?.used[k]);
  out.usesT = used("t");
  out.usesU = ["x", "y", "z"].some((n) => out[n].used.u);
  out.usesV = ["x", "y", "z"].some((n) => out[n].used.v);
  for (const name of FIELDS) if (fields[name]) out.fields[name] = String(fields[name]).trim();
  return out;
}

// ---- Typing a program ---------------------------------------------------------------------

const ALIASES = { "x(u,v,t)": "x", "y(u,v,t)": "y", "z(u,v,t)": "z", color: "hue", colour: "hue", red: "r", green: "g", blue: "b", splats: "count", n: "count" }; // prettier-ignore

// "x = cos u; y = sin u" (or one statement per line, from a file): the
// fields it sets. Unknown names and missing = signs are one message each.
export function readStatements(text) {
  const set = {};
  const errors = [];
  const lines = String(text ?? "")
    .split(/[\n;]/)
    .map((s) => s.replace(/#.*$/, "").trim())
    .filter(Boolean);
  if (!lines.length) throw new Error("There is nothing to read. Try x = cos(u); y = sin(u).");
  for (const line of lines) {
    const m = /^([a-zA-Z]+(?:\s*\([^)]*\))?)\s*=\s*(.*)$/.exec(line);
    if (!m) {
      errors.push(`“${line.slice(0, 24)}”: start it with a name and an = sign, like x = cos(u).`);
      continue;
    }
    let name = m[1].replace(/\s+/g, "").toLowerCase();
    name = ALIASES[name] || name.replace(/\(.*\)$/, "");
    if (!FIELDS.includes(name)) {
      errors.push(`“${m[1]}” is not a field. Use ${FIELDS.join(", ")}.`);
      continue;
    }
    set[name] = asciiEquation(m[2]);
  }
  if (errors.length) throw new Error(errors.join(" "));
  return set;
}

// The program a set of options describes: a preset, or your own fields.
function fieldsOf(o) {
  if (o.preset === "custom") {
    const f = {};
    for (const name of FIELDS) if (typeof o[name] === "string" && o[name]) f[name] = o[name];
    if (f.x && f.y && f.z && f.u) return { id: "custom", label: "Your program", fields: f };
  }
  const p = PRESET_BY_ID[o.preset] || PRESETS[0];
  const f = {};
  for (const name of FIELDS) if (p[name]) f[name] = p[name];
  return { id: p.id, label: p.label, fields: f };
}

// What is showing, for the panel: the program as someone would type it.
export function programText(fields) {
  return FIELDS.filter((n) => fields[n])
    .map((n) => `${n} = ${fields[n]}`)
    .join("; ");
}

const NOW = { label: "", fields: PRESETS[0] };

const INPUT = {
  title: "Your own splat program",
  placeholder: "x = cos(u)sin(v); y = cos(v); z = sin(u)sin(v)",
  button: "Splat it",
  fileButton: "Open a program file…",
  accept: ".txt",
  note: "Type one or more fields, split by ; (a file can put one on each line). x, y and z place each splat and can use u, v and t (t runs from 0 to 2pi as it plays). u = 0 .. 2pi and v = 0 .. pi set their ranges. Color is hue = … (0 to 1 goes once around the rainbow) or r, g and b (0 to 1). size = … is each splat's size, count = … how many (100 to 10,000), and spread = random scatters them. Fields you leave out keep what is showing. The Tinkerer's Manual has more.",
  async read(text) {
    const set = readStatements(text);
    const fields = { ...NOW.fields, ...set };
    // A hue replaces r, g and b, and any of r, g and b replaces the hue.
    if (set.hue) for (const ch of ["r", "g", "b"]) delete fields[ch];
    if (set.r || set.g || set.b) delete fields.hue;
    const prog = compileProgram(fields);
    const opts = { preset: "custom" };
    for (const name of FIELDS) opts[name] = prog.fields[name] || "";
    return opts;
  },
  shown: () => NOW.label,
};

// ---- Building ---------------------------------------------------------------------------

function hsl(h, s, l) {
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [f(0), f(8), f(4)];
}

const PROG_CACHE = new Map();
function programFor(o) {
  const pick = fieldsOf(o);
  const key = JSON.stringify(pick.fields);
  if (PROG_CACHE.has(key)) return { ...pick, prog: PROG_CACHE.get(key) };
  let prog;
  try {
    prog = compileProgram(pick.fields);
  } catch {
    return programFor({ preset: PRESETS[0].id });
  }
  if (PROG_CACHE.size > 20) PROG_CACHE.clear();
  PROG_CACHE.set(key, prog);
  return { ...pick, prog };
}

// The (u, v) of every splat: a grid spaced evenly over the shape (the side
// that is longer on the shape gets more rows), or scattered at random.
function params(prog, n, rand) {
  const [u0, u1] = prog.u;
  const [v0, v1] = prog.v;
  const out = [];
  if (prog.spread === "random") {
    for (let i = 0; i < n; i++) out.push([u0 + (u1 - u0) * rand(), prog.usesV ? v0 + (v1 - v0) * rand() : (v0 + v1) / 2]); // prettier-ignore
    return out;
  }
  if (!prog.usesV || !prog.usesU) {
    const along = prog.usesU || !prog.usesV;
    for (let i = 0; i < n; i++) {
      const f = (i + 0.5) / n;
      out.push(along ? [u0 + (u1 - u0) * f, (v0 + v1) / 2] : [(u0 + u1) / 2, v0 + (v1 - v0) * f]);
    }
    return out;
  }
  // How long the shape is along u and along v (at t = 0).
  const vals = { θ: 0, y: 0, t: 0 };
  const at = (u, v) => {
    vals.θ = u;
    vals.y = v;
    return [prog.x.f(vals), prog.y.f(vals), prog.z.f(vals)];
  };
  const G = 12;
  let lu = 0;
  let lv = 0;
  for (let i = 0; i <= G; i++)
    for (let j = 0; j < G; j++) {
      const a = (i + 0.5) / (G + 1);
      const b0 = j / G;
      const b1 = (j + 1) / G;
      const du = dist(at(u0 + (u1 - u0) * b0, v0 + (v1 - v0) * a), at(u0 + (u1 - u0) * b1, v0 + (v1 - v0) * a)); // prettier-ignore
      const dv = dist(at(u0 + (u1 - u0) * a, v0 + (v1 - v0) * b0), at(u0 + (u1 - u0) * a, v0 + (v1 - v0) * b1)); // prettier-ignore
      if (Number.isFinite(du)) lu += du;
      if (Number.isFinite(dv)) lv += dv;
    }
  const ratio = lu > 0 && lv > 0 ? Math.min(400, Math.max(1 / 400, lu / lv)) : 1;
  const nu = Math.max(2, Math.round(Math.sqrt(n * ratio)));
  const nv = Math.max(2, Math.round(n / nu));
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++)
      out.push([u0 + ((u1 - u0) * (i + 0.5)) / nu, v0 + ((v1 - v0) * (j + 0.5)) / nv]);
  return out;
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export const RECIPES = {
  "splat-equation": {
    alive: true,
    density: 2,
    options: [
      {
        key: "preset",
        label: "Program",
        type: "select",
        default: "torus",
        choices: [
          ...PRESETS.map((p) => ({ id: p.id, label: p.label })),
          { id: "custom", label: "Your own (below)" },
        ],
      },
      { key: "shade", label: "Light and shade", type: "switch", default: true },
      // Your own program, field by field (set from the panel, not shown).
      ...FIELDS.map((name) => ({ key: name, label: name, type: "text", default: "", hidden: true })), // prettier-ignore
    ],
    input: INPUT,
    controls: [
      { key: "t", label: "t", type: "slider", default: 0 },
      { key: "play", label: "Play", type: "pulse", ease: PLAY_SECS },
    ],
    action: { key: "play", label: "Play t" },
    // A tap plays one cycle of t (0 to 2π, 4 s): the shape moves through
    // its twelve copies, each morphing into the next. A program without t
    // clears and draws its splats again in order, one by one (3.4 s).
    drive(t, c, out, info) {
      const g = info?.data?.equation;
      if (!g) return;
      const e = since(c, "play", PLAY_SECS);
      const on = e >= 0;
      if (g.copies === 1) {
        out.morph = [on ? 1 - band(e, 0.25, 3.6) : 0, 0, 0, 0];
        return;
      }
      let u = clamp01(c.t ?? 0);
      if (on) u = (u + glide(clamp01(e / PLAY_SECS))) % 1;
      const pos = u * g.copies;
      let j = Math.min(g.copies - 1, Math.floor(pos));
      let frac = pos - j;
      // The last hundredth of a step shows the next copy instead (the same
      // shape), so a cycle ends on copy 0, the rest pose.
      if (frac > 0.99) {
        j = (j + 1) % g.copies;
        frac = 0;
      }
      for (let i = 0; i < g.copies; i++) out.parts[`t${i}`] = { visible: i === j ? 1 : 0 };
      out.morph = [0, frac, 0, 0];
    },
    build(k, o) {
      const { label, fields, prog } = programFor(o);
      NOW.label = `${label}: ${programText(fields)}`;
      NOW.fields = fields;
      const copies = prog.usesT ? KNOTS : 1;
      k.data = { equation: { copies } };
      const n = Math.max(1, Math.min(prog.count, Math.floor((k.count * 0.98) / copies)));
      const uv = params(prog, n, () => k.rand());
      const times = Array.from({ length: copies + 1 }, (_, j) => (TAU * j) / copies);
      // Where each splat is at each time (NaN where the equations have no
      // value), and how big the shape gets.
      const vals = { θ: 0, y: 0, t: 0 };
      const place = (u, v, t) => {
        vals.θ = u;
        vals.y = v;
        vals.t = t;
        return [prog.x.f(vals), prog.y.f(vals), prog.z.f(vals)];
      };
      const P = times.map((t) => uv.map(([u, v]) => place(u, v, t)));
      const reach = [];
      for (const row of P) for (const p of row) if (Number.isFinite(p[0] + p[1] + p[2])) reach.push(Math.hypot(...p)); // prettier-ignore
      reach.sort((a, b) => a - b);
      // Points far beyond the rest (an equation that shoots off to
      // infinity) are left out, so the shape still fills the view.
      const far = reach.length ? Math.max(1e-6, reach[Math.floor(reach.length * 0.98)] * 3) : 1;
      const ok = (p) => Number.isFinite(p[0] + p[1] + p[2]) && Math.hypot(...p) <= far;
      const surface = prog.usesU && prog.usesV && prog.spread === "grid";
      const [du, dv] = [(prog.u[1] - prog.u[0]) * 1e-3, (prog.v[1] - prog.v[0]) * 1e-3];
      for (let j = 0; j < copies; j++) {
        const t = times[j];
        const part = copies > 1 ? k.part(`t${j}`) : 0;
        k.cloud({ share: n / k.count, size: 1 }, (rand, i) => {
          const p = P[j][i];
          if (!p || !ok(p)) return null;
          const [u, v] = uv[i];
          vals.θ = u;
          vals.y = v;
          vals.t = t;
          let rgb;
          if (prog.hue) {
            const h = prog.hue.f(vals);
            rgb = Number.isFinite(h) ? hsl(((h % 1) + 1) % 1, 0.72, 0.56) : [0.5, 0.5, 0.5];
          } else rgb = ["r", "g", "b"].map((ch) => clamp01(prog[ch].f(vals) || 0));
          const s = prog.size.f(vals);
          const size = Number.isFinite(s) && s > 0 ? Math.min(s, far) : 0.05 * far;
          // The surface's normal, from its slopes along u and v.
          let nrm = null;
          if (surface) {
            const a = place(u + du, v, t);
            const b = place(u, v + dv, t);
            const pu = [a[0] - p[0], a[1] - p[1], a[2] - p[2]];
            const pv = [b[0] - p[0], b[1] - p[1], b[2] - p[2]];
            const cr = [pu[1] * pv[2] - pu[2] * pv[1], pu[2] * pv[0] - pu[0] * pv[2], pu[0] * pv[1] - pu[1] * pv[0]]; // prettier-ignore
            const l = Math.hypot(...cr);
            if (l > 0 && Number.isFinite(l)) nrm = [cr[0] / l, cr[1] / l, cr[2] / l];
          }
          if (o.shade !== false && nrm) {
            const d = Math.abs(nrm[0] * LIGHT[0] + nrm[1] * LIGHT[1] + nrm[2] * LIGHT[2]);
            const f = 0.62 + 0.48 * d;
            const sp = 0.18 * Math.pow(d, 24);
            rgb = rgb.map((x) => clamp01(x * f + sp));
          }
          const splat = { p, color: rgb, size: size / 0.01, opacity: 0.95, part };
          if (nrm) {
            splat.n = nrm;
            splat.flat = 0.45;
          }
          if (copies > 1) {
            const q = P[j + 1][i];
            splat.to = ok(q) ? q : p;
            splat.channel = 1;
          } else {
            splat.kind = "fade";
            splat.params = [1.002 - i / n, 0.02];
            splat.channel = 0;
          }
          return splat;
        });
      }
    },
  },
};
