// A small, safe equation reader for the plotters (the graph plotter and the
// surface plotter). It reads what people type (y = a·sin(bx), r = 1 + cos θ,
// x = cos 3t, y = sin 2t, z = x² − y²) into a tree of plain functions: no
// eval, no Function, no lookups by name at run time. Only the names in the
// tables below exist, so typed text can do nothing but arithmetic.
//
// Supported: numbers, the variables each plotter allows (x, y, t, r, θ),
// the parameters a and b, + − × ÷ ^ (and * / ** · ² ³), brackets, |x| for
// abs, implicit multiplication where it is clear (2x, 3sin(x), x y, 2(x+1),
// (x+1)(x−1)), a function without brackets on a simple product (sin x,
// sin 2x, cos θ), and the functions sin, cos, tan, asin, acos, atan, sinh,
// cosh, tanh, exp, log (natural; ln too), log10, sqrt, abs, floor, min and
// max, and the constants pi (π) and e.
//
// Values off the real line (a log of a negative number, a division by zero)
// come out as NaN or ±Infinity, and the plotters break the curve there.

export const MAX_LENGTH = 120;
const MAX_DEPTH = 32;
const MAX_NODES = 400;

// One plain message for anything that can't be read: the reason, then what
// to try. Shown under the input box; the toy keeps its last good curve.
export class EquationError extends Error {
  constructor(reason) {
    super(`That can't be drawn: ${reason}`);
    this.name = "EquationError";
    this.reason = reason;
  }
}

const FUNCS = {
  sin: [1, Math.sin],
  cos: [1, Math.cos],
  tan: [1, Math.tan],
  asin: [1, Math.asin],
  acos: [1, Math.acos],
  atan: [1, Math.atan],
  arcsin: [1, Math.asin],
  arccos: [1, Math.acos],
  arctan: [1, Math.atan],
  sinh: [1, Math.sinh],
  cosh: [1, Math.cosh],
  tanh: [1, Math.tanh],
  exp: [1, Math.exp],
  log: [1, Math.log],
  ln: [1, Math.log],
  log10: [1, Math.log10],
  sqrt: [1, Math.sqrt],
  abs: [1, Math.abs],
  floor: [1, Math.floor],
  min: [2, Math.min],
  max: [2, Math.max],
};
const CONSTS = { pi: Math.PI, e: Math.E };
// Words people type for the Greek letters.
const ALIASES = { theta: "θ", π: "pi" };
// Every name the tokenizer may split a run of letters into, longest first.
const ALL_VARS = ["x", "y", "t", "r", "θ", "a", "b"];
const NAMES = [...Object.keys(FUNCS), ...Object.keys(CONSTS), ...Object.keys(ALIASES), ...ALL_VARS] // prettier-ignore
  .sort((p, q) => q.length - p.length);

// ---- Tokens ------------------------------------------------------------------------

// Symbols people paste from phones and word processors, turned into the
// plain ones.
function normalize(text) {
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  return String(text)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => `^${[...m].map((d) => SUP.indexOf(d)).join("")}`)
    .normalize("NFKC")
    .replace(/[−–—]/g, "-")
    .replace(/[×·⋅∙*]{1,2}/g, (m) => (m === "**" ? "^" : "*"))
    .replace(/[÷∕]/g, "/")
    .replace(/√/g, "sqrt")
    .replace(/Θ|ϑ/g, "θ")
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
      if (!m) throw new EquationError(`the number at “${src.slice(i, i + 6)}” is not one I can read.`); // prettier-ignore
      if (src[i + m[0].length] === ".")
        throw new EquationError(`the number “${src.slice(i, i + m[0].length + 2)}” has two points.`); // prettier-ignore
      out.push({ t: "num", v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-zθ]/.test(ch)) {
      // A run of letters (and digits after them, for log10) is split into
      // known names, longest first: "xsin" is x · sin, "ab" is a · b.
      // Digits after a name are a number (x2 is x · 2), except log10.
      const run = /^[a-zθ][a-zθ0-9]*/.exec(src.slice(i))[0];
      let j = 0;
      while (j < run.length) {
        const rest = run.slice(j);
        if (/^[0-9]/.test(rest)) {
          const d = /^[0-9]+/.exec(rest)[0];
          out.push({ t: "num", v: Number(d) });
          j += d.length;
          continue;
        }
        const name = NAMES.find((n) => rest.startsWith(n));
        if (!name) {
          const bad = /^[a-zθ]+/.exec(rest)[0];
          throw new EquationError(`I don't know “${bad}”. ${HINT}`);
        }
        const nm = ALIASES[name] || name;
        out.push({ t: FUNCS[nm] ? "fn" : "name", v: nm });
        j += name.length;
      }
      i += run.length;
      continue;
    }
    if ("+-*/^(),|=".includes(ch)) {
      out.push({ t: ch });
      i++;
      continue;
    }
    if (ch === "[" || ch === "{") {
      out.push({ t: "(" });
      i++;
      continue;
    }
    if (ch === "]" || ch === "}") {
      out.push({ t: ")" });
      i++;
      continue;
    }
    throw new EquationError(`I can't use the sign “${ch}”. ${HINT}`);
  }
  return out;
}

const HINT = "Try something like y = a·sin(b·x).";

// ---- Parser ------------------------------------------------------------------------

// Nodes are small closures over plain values: evaluation is a walk through
// functions built here, taking one object of variable values.
function parse(tokens, allowed) {
  let pos = 0;
  let depth = 0;
  let nodes = 0;
  const used = new Set();
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];
  const is = (t) => peek()?.t === t;
  const expect = (t, what) => {
    if (!is(t)) throw new EquationError(what);
    pos++;
  };
  const node = (fn) => {
    if (++nodes > MAX_NODES) throw new EquationError("it is too long.");
    return fn;
  };
  const deeper = () => {
    if (++depth > MAX_DEPTH) throw new EquationError("it has too many brackets inside brackets.");
  };
  // Can the next token start a factor (for implicit multiplication)?
  const startsAtom = () => {
    const t = peek();
    return !!t && (t.t === "num" || t.t === "name" || t.t === "fn" || t.t === "(");
  };

  function expr(inAbs = false) {
    deeper();
    let left = term(inAbs);
    while (is("+") || is("-")) {
      const op = next().t;
      const right = term(inAbs);
      const l = left;
      left = node(op === "+" ? (v) => l(v) + right(v) : (v) => l(v) - right(v));
    }
    depth--;
    return left;
  }

  function term(inAbs) {
    let left = unary(inAbs);
    for (;;) {
      if (is("*") || is("/")) {
        const op = next().t;
        const right = unary(inAbs);
        const l = left;
        left = node(op === "*" ? (v) => l(v) * right(v) : (v) => l(v) / right(v));
      } else if (startsAtom() || (is("|") && !inAbs)) {
        // Implicit multiplication: 2x, 3sin(x), (x+1)(x-1), x y.
        const right = power(inAbs);
        const l = left;
        left = node((v) => l(v) * right(v));
      } else break;
    }
    return left;
  }

  function unary(inAbs) {
    if (is("-")) {
      next();
      deeper();
      const f = unary(inAbs);
      depth--;
      return node((v) => -f(v));
    }
    if (is("+")) {
      next();
      return unary(inAbs);
    }
    return power(inAbs);
  }

  // Right-associative: 2^3^2 is 2^9; -x^2 is -(x^2); 2^-1 works.
  function power(inAbs) {
    const base = atom(inAbs);
    if (is("^")) {
      next();
      deeper();
      const ex = unary(inAbs);
      depth--;
      return node((v) => Math.pow(base(v), ex(v)));
    }
    return base;
  }

  // A function's argument without brackets: a simple product of numbers,
  // names and bracketed groups, with an optional power (sin 2x, cos θ,
  // sin x^2 is sin(x^2)). It stops at the next function: sin x cos x.
  function bareArg(inAbs) {
    const one = () => {
      const t = peek();
      if (!t || !(t.t === "num" || t.t === "name" || t.t === "(")) return null;
      return power(inAbs);
    };
    let f = one();
    if (!f) throw new EquationError("a function is missing what it works on, like sin(x).");
    for (;;) {
      const t = peek();
      if (!t || !(t.t === "num" || t.t === "name")) break;
      const g = one();
      const l = f;
      f = node((v) => l(v) * g(v));
    }
    return f;
  }

  function atom(inAbs) {
    const t = next();
    if (!t) throw new EquationError("it stops too soon. Is something missing at the end?");
    if (t.t === "num") return node(() => t.v);
    if (t.t === "name") {
      if (t.v in CONSTS) {
        const c = CONSTS[t.v];
        return node(() => c);
      }
      if (!allowed.includes(t.v)) throw new EquationError(unknownVar(t.v, allowed));
      used.add(t.v);
      const k = t.v;
      return node((v) => v[k]);
    }
    if (t.t === "fn") {
      const [arity, fn] = FUNCS[t.v];
      deeper();
      let out;
      if (is("(")) {
        next();
        const args = [expr()];
        while (is(",")) {
          next();
          args.push(expr());
        }
        expect(")", "check the brackets: one is missing its partner.");
        if (arity === 1 && args.length !== 1)
          throw new EquationError(`${t.v} takes one value, like ${t.v}(x).`);
        if (arity === 2 && args.length < 2)
          throw new EquationError(`${t.v} needs two values or more, like ${t.v}(x, 1).`);
        if (arity === 1) {
          const [f] = args;
          out = node((v) => fn(f(v)));
        } else {
          out = node((v) => {
            let m = args[0](v);
            for (let i = 1; i < args.length; i++) m = fn(m, args[i](v));
            return m;
          });
        }
      } else {
        if (arity !== 1) throw new EquationError(`${t.v} needs brackets, like ${t.v}(x, 1).`);
        const f = bareArg(inAbs);
        out = node((v) => fn(f(v)));
      }
      depth--;
      return out;
    }
    if (t.t === "(") {
      const f = expr();
      expect(")", "check the brackets: one is missing its partner.");
      return f;
    }
    if (t.t === "|" && !inAbs) {
      const f = expr(true);
      expect("|", "check the | signs: each one needs a partner.");
      return node((v) => Math.abs(f(v)));
    }
    if (t.t === ")") throw new EquationError("check the brackets: one is missing its partner.");
    if (t.t === "=") throw new EquationError("it has an = sign in the wrong place.");
    if (t.t === ",") throw new EquationError("it has a comma in the wrong place.");
    throw new EquationError(`the “${t.t}” sign needs a number or letter on both sides.`);
  }

  const f = expr();
  if (pos < tokens.length) {
    const t = peek();
    if (t.t === ")") throw new EquationError("check the brackets: one is missing its partner.");
    if (t.t === "|") throw new EquationError("check the | signs: each one needs a partner.");
    if (t.t === ",") throw new EquationError("it has a comma in the wrong place.");
    if (t.t === "=") throw new EquationError("it has more than one = sign.");
    throw new EquationError(`something is out of place near “${t.t}”.`);
  }
  return { f, used };
}

function unknownVar(name, allowed) {
  const letters = allowed.filter((v) => v !== "a" && v !== "b").join(", ");
  return `“${name}” can't be used here. Use ${letters}, and a or b for the sliders.`;
}

// Reads one expression over the allowed variables. Returns
// { f(values) -> number, used: Set of the names it reads }.
export function compile(text, allowed = ["x", "a", "b"]) {
  const src = normalize(text);
  if (src.length > MAX_LENGTH) throw new EquationError(`it is over ${MAX_LENGTH} characters.`);
  const tokens = tokenize(src);
  if (!tokens.length) throw new EquationError(`there is nothing to draw. ${HINT}`);
  return parse(tokens, allowed);
}

// ---- The plotters' forms -----------------------------------------------------------

// Splits "lhs = rhs" (one = sign at most).
function sides(src) {
  const parts = src.split("=");
  if (parts.length > 2) throw new EquationError("it has more than one = sign.");
  if (parts.length === 1) return [null, parts[0]];
  return [parts[0].replace(/\s+/g, ""), parts[1]];
}

// Splits at top-level commas or semicolons (not inside brackets).
function topSplit(src) {
  const out = [];
  let level = 0;
  let from = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if ("([{".includes(ch)) level++;
    else if (")]}".includes(ch)) level--;
    else if ((ch === "," || ch === ";") && level === 0) {
      out.push(src.slice(from, i));
      from = i + 1;
    }
  }
  out.push(src.slice(from));
  return out;
}

const Y_LHS = ["y", "f(x)", "y(x)", "g(x)"];
const R_LHS = ["r", "r(θ)", "r(theta)", "ρ"];
const Z_LHS = ["z", "f(x,y)", "z(x,y)"];

// A curve for the graph plotter:
//   y = f(x) (or just f(x))         -> { kind: "y", y }
//   r = f(θ)                        -> { kind: "polar", r }
//   x = f(t), y = g(t) (or "(f, g)") -> { kind: "param", x, y }
// Each is a function of a values object ({ x, a, b } and so on).
export function readCurve(text) {
  const raw = String(text ?? "").trim();
  if (!raw) throw new EquationError(`there is nothing to draw. ${HINT}`);
  if (raw.length > MAX_LENGTH) throw new EquationError(`it is over ${MAX_LENGTH} characters.`);
  let src = normalize(raw).trim();
  // "(cos t, sin t)" is a parametric pair.
  const pair = /^\((.*)\)$/.exec(src);
  if (pair && topSplit(pair[1]).length === 2) src = topSplit(pair[1]).join(",");
  const pieces = topSplit(src);
  if (pieces.length > 2)
    throw new EquationError("it has too many commas. For x(t) and y(t) type x = …, y = ….");
  if (pieces.length === 2) {
    const got = {};
    pieces.forEach((p, i) => {
      let [lhs, rhs] = sides(p);
      if (lhs === "x(t)") lhs = "x";
      if (lhs === "y(t)") lhs = "y";
      if (lhs === null) lhs = i === 0 ? "x" : "y";
      if (lhs !== "x" && lhs !== "y")
        throw new EquationError("for a curve in t, type x = …, y = ….");
      if (got[lhs]) throw new EquationError(`it gives ${lhs} twice. Type x = …, y = ….`);
      got[lhs] = compile(rhs, ["t", "a", "b"]);
    });
    return {
      kind: "param",
      x: got.x.f,
      y: got.y.f,
      usesA: got.x.used.has("a") || got.y.used.has("a"),
      usesB: got.x.used.has("b") || got.y.used.has("b"),
    };
  }
  const [lhs, rhs] = sides(src);
  if (lhs !== null && R_LHS.includes(lhs)) {
    const c = compile(rhs, ["θ", "a", "b"]);
    return { kind: "polar", r: c.f, usesA: c.used.has("a"), usesB: c.used.has("b") };
  }
  if (lhs !== null && !Y_LHS.includes(lhs))
    throw new EquationError(
      "start it with y =, r = (a polar curve) or x = …, y = … (a curve in t).",
    );
  const c = compile(rhs, ["x", "a", "b"]);
  return { kind: "y", y: c.f, usesA: c.used.has("a"), usesB: c.used.has("b") };
}

// A surface for the surface plotter: z = f(x, y) (or just f(x, y)); r and
// θ are there too (the distance from the middle and the angle round it).
export function readSurface(text) {
  const raw = String(text ?? "").trim();
  if (!raw) throw new EquationError("there is nothing to draw. Try something like z = x² − y².");
  if (raw.length > MAX_LENGTH) throw new EquationError(`it is over ${MAX_LENGTH} characters.`);
  const src = normalize(raw).trim();
  const [lhs, rhs] = sides(src);
  if (lhs !== null && !Z_LHS.includes(lhs))
    throw new EquationError("start it with z =, like z = x² − y².");
  const c = compile(rhs, ["x", "y", "r", "θ", "a", "b"]);
  const needPolar = c.used.has("r") || c.used.has("θ");
  const f = needPolar
    ? (v) => {
        v.r = Math.hypot(v.x, v.y);
        v["θ"] = Math.atan2(v.y, v.x);
        return c.f(v);
      }
    : c.f;
  return { kind: "surface", z: f, usesA: c.used.has("a"), usesB: c.used.has("b") };
}

// Typed text as plain ASCII, the way it is kept (links keep only printable
// ASCII text): θ becomes theta, x² becomes x^2, × and · become *, and so on.
// One line, trimmed.
export function asciiEquation(text) {
  const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
  return String(text ?? "")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => `^${[...m].map((d) => SUP.indexOf(d)).join("")}`)
    .normalize("NFKC")
    .replace(/[−–—]/g, "-")
    .replace(/[×·⋅∙]/g, "*")
    .replace(/[÷∕]/g, "/")
    .replace(/√/g, "sqrt")
    .replace(/[θΘϑ]/g, "theta")
    .replace(/π/g, "pi")
    .replace(/\s+/g, " ")
    .trim();
}
