// The math behind the manual's demos, with no page in it, so tests/man3-2.spec.mjs can check it
// against the real reader (src/equation.js, through src/packs/splat-equation.js) and against hand
// calculations. The demos' drawing code is in demos.js.

export const TAU = Math.PI * 2;

// ---- Covariance (Level 1) ------------------------------------------------------------------
// A 2D covariance from two sizes and a turn: Sigma = R S S^T R^T with S = diag(s1, s2).
export function covFromSizes(s1, s2, thetaRad) {
  const c = Math.cos(thetaRad);
  const s = Math.sin(thetaRad);
  return {
    a: s1 * s1 * c * c + s2 * s2 * s * s,
    b: (s1 * s1 - s2 * s2) * s * c,
    c: s1 * s1 * s * s + s2 * s2 * c * c,
  };
}

// The facts about a symmetric 2x2 matrix [[a, b], [b, c]]: determinant, eigenvalues (the squared
// sizes along its own axes), the angle of the first axis, and whether it is a valid covariance
// (positive definite: a > 0 and det > 0).
export function covFacts({ a, b, c }) {
  const det = a * c - b * b;
  const tr = a + c;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc;
  const l2 = tr / 2 - disc;
  const valid = a > 1e-6 && det > 1e-8;
  const angle = Math.abs(b) < 1e-12 ? (a >= c ? 0 : Math.PI / 2) : Math.atan2(l1 - a, b);
  return { det, l1, l2, valid, angle, flat: Math.abs(det) <= 1e-8 };
}

// The weight at an offset (px, py) from the center: exp(-1/2 d^T Sigma^-1 d). Zero where the
// matrix cannot be inverted.
export function covWeight({ a, b, c }, px, py) {
  const det = a * c - b * b;
  if (!det) return 0;
  const q = (c * px * px - 2 * b * px * py + a * py * py) / det;
  return Number.isFinite(q) ? Math.exp(-0.5 * q) : 0;
}

// ---- Smoothstep (Level 2) ---------------------------------------------------------------------
export const smoothstep = (x) => {
  const g = Math.min(1, Math.max(0, x));
  return g * g * (3 - 2 * g);
};

// ---- Moments of t (Level 3) -------------------------------------------------------------------
// The shapes of the moments demo: where a splat at angle u is at time t (radius r, angle a).
export function momentPos(kind, u, t) {
  let r = 1;
  let a = u;
  if (kind === "turn") a = u + t;
  if (kind === "breathe") r = 1 + 0.25 * Math.sin(t);
  if (kind === "wave") r = 1 + 0.18 * Math.sin(3 * u - t);
  if (kind === "jump") r = 0.7 + 0.5 * (t / TAU);
  if (kind === "half") r = 1 + 0.35 * Math.sin(t / 2);
  return [r * Math.cos(a), r * Math.sin(a)];
}

// Where the toy puts a splat at fraction tf of the cycle when it stores K moments: the straight
// line between the copy at moment j and the copy at moment j + 1 (the morph).
export function morphPos(kind, u, tf, K) {
  const f = tf * K;
  const j = Math.min(K - 1, Math.floor(f));
  const w = f - j;
  const a = momentPos(kind, u, (TAU * j) / K);
  const b = momentPos(kind, u, (TAU * (j + 1)) / K);
  return [a[0] + (b[0] - a[0]) * w, a[1] + (b[1] - a[1]) * w];
}

// The most a turning ring dips inward between moments: half way between two moments a point is on
// the chord, cos(pi / K) of the way out.
export const worstDip = (K) => 1 - Math.cos(Math.PI / K);

// The points the toy keeps per copy on the weakest device: floor(0.98 x budget / K).
export const pointsPerCopy = (budget, K) => Math.floor((0.98 * budget) / K);

// ---- The reader (Level 3): the real reader's rules, with a tree ---------------------------
const FUNCS = [
  "arcsin", "arccos", "arctan", "asin", "acos", "atan", "sinh", "cosh", "tanh", "sqrt", "sin", "cos", "tan",
  "exp", "log10", "log", "ln", "abs", "floor", "min", "max",
]; // prettier-ignore
const FN = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
  arcsin: Math.asin, arccos: Math.acos, arctan: Math.atan, sinh: Math.sinh, cosh: Math.cosh,
  tanh: Math.tanh, sqrt: Math.sqrt, exp: Math.exp, log: Math.log, ln: Math.log, log10: Math.log10,
  abs: Math.abs, floor: Math.floor, min: Math.min, max: Math.max,
}; // prettier-ignore
const VARS = ["u", "v", "t", "pi", "e"];
const NAMES = [...FUNCS, ...VARS].sort((p, q) => q.length - p.length);
export const MAX_LENGTH = 120;
const HINT = "Try something like cos(u)·sin(v).";

// The symbols people paste in, turned into plain ones (as the real reader does).
function normalize(text) {
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  return String(text)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => `^${[...m].map((d) => SUP.indexOf(d)).join("")}`)
    .normalize("NFKC")
    .replace(/[−–—]/g, "-")
    .replace(/[×·⋅∙*]{1,2}/g, (m) => (m === "**" ? "^" : "*"))
    .replace(/[÷∕]/g, "/")
    .replace(/√/g, "sqrt")
    .replace(/π/g, "pi")
    .toLowerCase();
}

function tokenize(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)/.exec(src.slice(i));
      if (!m) throw new Error(`the number at “${src.slice(i, i + 6)}” is not one I can read.`);
      if (src[i + m[0].length] === ".")
        throw new Error(`the number “${src.slice(i, i + m[0].length + 2)}” has two points.`);
      out.push({ k: "num", v: Number(m[0]), s: m[0] });
      i += m[0].length;
      continue;
    }
    if (/[a-z]/.test(ch)) {
      // A run of letters (and digits after them, for log10) is split into known names, longest
      // first. Digits after a name are a number (u2 is u times 2), except log10.
      const run = /^[a-z][a-z0-9]*/.exec(src.slice(i))[0];
      let j = 0;
      while (j < run.length) {
        const rest = run.slice(j);
        if (/^[0-9]/.test(rest)) {
          const d = /^[0-9]+/.exec(rest)[0];
          out.push({ k: "num", v: Number(d), s: d });
          j += d.length;
          continue;
        }
        const name = NAMES.find((n) => rest.startsWith(n));
        if (!name) throw new Error(`I don't know “${/^[a-z]+/.exec(rest)[0]}”. ${HINT}`);
        out.push(FUNCS.includes(name) ? { k: "fn", v: name } : { k: "var", v: name });
        j += name.length;
      }
      i += run.length;
      continue;
    }
    if ("+-*/^(),|=".includes(ch)) {
      out.push({ k: ch });
      i++;
      continue;
    }
    // [ ] and { } are brackets too.
    if (ch === "[" || ch === "{") {
      out.push({ k: "(" });
      i++;
      continue;
    }
    if (ch === "]" || ch === "}") {
      out.push({ k: ")" });
      i++;
      continue;
    }
    throw new Error(`I can't use the sign “${ch}”. ${HINT}`);
  }
  return out;
}

// Parses an expression into a tree. Leaves are { leaf, kind }; nodes are { op, kids, ... }.
export function parseExpr(text) {
  const src = normalize(text);
  if (src.length > MAX_LENGTH) throw new Error(`it is over ${MAX_LENGTH} characters.`);
  const toks = tokenize(src);
  if (!toks.length) throw new Error(`there is nothing to draw. ${HINT}`);
  let p = 0;
  const peek = () => toks[p];
  const is = (k) => peek()?.k === k;
  const startsAtom = () => {
    const t = peek();
    return !!t && (t.k === "num" || t.k === "var" || t.k === "fn" || t.k === "(");
  };
  function expr(inAbs = false) {
    let n = term(inAbs);
    while (is("+") || is("-")) {
      const op = toks[p++].k;
      n = { op, kids: [n, term(inAbs)] };
    }
    return n;
  }
  function term(inAbs) {
    let n = unary(inAbs);
    for (;;) {
      if (is("*") || is("/")) {
        const op = toks[p++].k;
        n = { op: op === "*" ? "×" : "÷", kids: [n, unary(inAbs)] };
      } else if (startsAtom() || (is("|") && !inAbs)) {
        n = { op: "×", implied: true, kids: [n, power(inAbs)] };
      } else return n;
    }
  }
  function unary(inAbs) {
    if (is("-")) {
      p++;
      return { op: "negate", kids: [unary(inAbs)] };
    }
    if (is("+")) {
      p++;
      return unary(inAbs);
    }
    return power(inAbs);
  }
  function power(inAbs) {
    const base = atom(inAbs);
    if (is("^")) {
      p++;
      return { op: "^", kids: [base, unary(inAbs)] };
    }
    return base;
  }
  // A function's input without brackets: a short product of numbers, names and bracketed groups,
  // each with an optional power. It stops at the next function (sin u cos u).
  function bareArg(inAbs) {
    const one = () => {
      const t = peek();
      if (!t || !(t.k === "num" || t.k === "var" || t.k === "(")) return null;
      return power(inAbs);
    };
    let f = one();
    if (!f) throw new Error("a function is missing what it works on, like sin(u).");
    for (;;) {
      const t = peek();
      if (!t || !(t.k === "num" || t.k === "var")) break;
      f = { op: "×", implied: true, kids: [f, one()] };
    }
    return f;
  }
  function atom(inAbs) {
    const t = toks[p++];
    if (!t) throw new Error("it stops too soon. Is something missing at the end?");
    if (t.k === "num") return { leaf: t.s, val: t.v, kind: "number" };
    if (t.k === "var")
      return { leaf: t.v, kind: t.v === "pi" || t.v === "e" ? "constant" : "variable" };
    if (t.k === "fn") {
      if (is("(")) {
        p++;
        const args = [expr()];
        while (is(",")) {
          p++;
          args.push(expr());
        }
        if (!is(")")) throw new Error("check the brackets: one is missing its partner.");
        p++;
        const two = t.v === "min" || t.v === "max";
        if (!two && args.length !== 1) throw new Error(`${t.v} takes one value, like ${t.v}(u).`);
        if (two && args.length < 2)
          throw new Error(`${t.v} needs two values or more, like ${t.v}(u, 1).`);
        return { op: t.v, fn: true, kids: args };
      }
      if (t.v === "min" || t.v === "max")
        throw new Error(`${t.v} needs brackets, like ${t.v}(u, 1).`);
      return { op: t.v, fn: true, bare: true, kids: [bareArg(inAbs)] };
    }
    if (t.k === "(") {
      const n = expr();
      if (!is(")")) throw new Error("check the brackets: one is missing its partner.");
      p++;
      return { op: "( )", kids: [n] };
    }
    if (t.k === "|" && !inAbs) {
      const n = expr(true);
      if (!is("|")) throw new Error("check the | signs: each one needs a partner.");
      p++;
      return { op: "abs", fn: true, bars: true, kids: [n] };
    }
    if (t.k === ")") throw new Error("check the brackets: one is missing its partner.");
    if (t.k === "=") throw new Error("it has an = sign in the wrong place.");
    if (t.k === ",") throw new Error("it has a comma in the wrong place.");
    throw new Error(`the “${t.k}” sign needs a number or letter on both sides.`);
  }
  const tree = expr();
  if (p < toks.length) {
    const t = toks[p];
    if (t.k === ")") throw new Error("check the brackets: one is missing its partner.");
    if (t.k === "|") throw new Error("check the | signs: each one needs a partner.");
    if (t.k === ",") throw new Error("it has a comma in the wrong place.");
    throw new Error("it has something it can't place.");
  }
  return tree;
}

export function evalTree(n, env) {
  if (n.leaf !== undefined) {
    if (n.val !== undefined) return n.val;
    if (n.leaf === "pi") return Math.PI;
    if (n.leaf === "e") return Math.E;
    return env[n.leaf];
  }
  const k = n.kids.map((c) => evalTree(c, env));
  switch (n.op) {
    case "+": return k[0] + k[1];
    case "-": return k[0] - k[1];
    case "×": return k[0] * k[1];
    case "÷": return k[0] / k[1];
    case "^": return Math.pow(k[0], k[1]);
    case "negate": return -k[0];
    case "( )": return k[0];
    default: return FN[n.op](...k);
  }
} // prettier-ignore

// The expression with every grouping written out: the order the reader works things out in.
export function grouped(n, top = true) {
  if (n.leaf !== undefined) return n.leaf;
  if (n.op === "( )") return grouped(n.kids[0], top);
  if (n.fn) return `${n.op}(${n.kids.map((c) => grouped(c, true)).join(", ")})`;
  const k = n.kids.map((c) => grouped(c, false));
  const s = n.op === "negate" ? `−${k[0]}` : `${k[0]} ${n.op === "-" ? "−" : n.op} ${k[1]}`;
  return top ? s : `(${s})`;
}
