// Lane Math: unit checks for the equation reader (no browser), then the
// new maths toys and the two fixes in the app.

import { test, expect } from "@playwright/test";
import { compile, readCurve, readSurface, EquationError, MAX_LENGTH } from "../src/equation.js";

const ev = (text, vals = {}, allowed) =>
  compile(text, allowed || ["x", "y", "t", "r", "θ", "a", "b"]).f({
    x: 0,
    y: 0,
    t: 0,
    r: 0,
    θ: 0,
    a: 1,
    b: 1,
    ...vals,
  });
const close = (v, want) => expect(Math.abs(v - want)).toBeLessThan(1e-9);
const fails = (fn, match) => {
  let err = null;
  try {
    fn();
  } catch (e) {
    err = e;
  }
  expect(err, "expected an error").not.toBeNull();
  expect(err).toBeInstanceOf(EquationError);
  expect(err.message.startsWith("That can't be drawn: ")).toBe(true);
  if (match) expect(err.message).toMatch(match);
};

test.describe("equation reader", () => {
  test("arithmetic and precedence", () => {
    close(ev("1 + 2 * 3"), 7);
    close(ev("(1 + 2) * 3"), 9);
    close(ev("2^3^2"), 512);
    close(ev("-2^2"), -4);
    close(ev("2^-1"), 0.5);
    close(ev("10 / 4 / 5"), 0.5);
    close(ev("8 - 3 - 2"), 3);
    close(ev("--3"), 3);
    close(ev("+3"), 3);
    close(ev(".5 + 1.25"), 1.75);
    close(ev("2 ** 3"), 8);
    close(ev("[1 + 1] * {2}"), 4);
  });

  test("unicode signs from phones", () => {
    close(ev("6 × 7"), 42);
    close(ev("6 · 7"), 42);
    close(ev("9 ÷ 3"), 3);
    close(ev("5 − 2"), 3);
    close(ev("x²", { x: 3 }), 9);
    close(ev("x³", { x: 2 }), 8);
    close(ev("x⁴ − x²", { x: 2 }), 12);
    close(ev("2¹⁰"), 1024);
    close(ev("y⁵", { y: 2 }), 32);
    close(ev("√4"), 2);
    close(ev("√(x+5)", { x: 4 }), 3);
    close(ev("π"), Math.PI);
    close(ev("cos θ", { θ: Math.PI }), -1);
    close(ev("cos theta", { θ: Math.PI }), -1);
  });

  test("implicit multiplication", () => {
    close(ev("2x", { x: 3 }), 6);
    close(ev("3sin(x)", { x: Math.PI / 2 }), 3);
    close(ev("2(x+1)", { x: 1 }), 4);
    close(ev("(x+1)(x-1)", { x: 3 }), 8);
    close(ev("x y", { x: 3, y: 4 }), 12);
    close(ev("xy", { x: 3, y: 4 }), 12);
    close(ev("ab", { a: 2, b: 5 }), 10);
    close(ev("2pi"), 2 * Math.PI);
    close(ev("2x^2", { x: 3 }), 18);
    close(ev("1/2x", { x: 4 }), 2); // read left to right: (1/2)·x
    close(ev("x2", { x: 4 }), 8);
    close(ev("2|x|", { x: -3 }), 6);
  });

  test("functions, with and without brackets", () => {
    close(ev("sin x", { x: Math.PI / 2 }), 1);
    close(ev("sin 2x", { x: Math.PI / 4 }), 1);
    close(ev("sin x cos x", { x: 0.3 }), Math.sin(0.3) * Math.cos(0.3));
    close(ev("sin x^2", { x: 1.2 }), Math.sin(1.44));
    close(ev("sin(x)^2", { x: 1.2 }), Math.sin(1.2) ** 2);
    close(ev("sinx", { x: 0.4 }), Math.sin(0.4));
    close(ev("tan(x)", { x: 0.3 }), Math.tan(0.3));
    close(ev("asin(0.5)"), Math.asin(0.5));
    close(ev("acos(0.5)"), Math.acos(0.5));
    close(ev("atan(2)"), Math.atan(2));
    close(ev("arctan(2)"), Math.atan(2));
    close(ev("sinh(1)+cosh(1)+tanh(1)"), Math.sinh(1) + Math.cosh(1) + Math.tanh(1));
    close(ev("exp(1)"), Math.E);
    close(ev("log(e)"), 1);
    close(ev("ln(e^2)"), 2);
    close(ev("log10(1000)"), 3);
    close(ev("sqrt(16)"), 4);
    close(ev("abs(-3)"), 3);
    close(ev("|-3|"), 3);
    close(ev("floor(2.7)"), 2);
    close(ev("floor(-2.2)"), -3);
    close(ev("min(3, 1, 2)"), 1);
    close(ev("max(3, 1, 2)"), 3);
    close(ev("e"), Math.E);
    close(ev("exp x", { x: 2 }), Math.exp(2));
    close(ev("abs(sin(x))", { x: -1 }), Math.sin(1));
  });

  test("off the real line gives non-finite values, not errors", () => {
    expect(ev("1/x", { x: 0 })).toBe(Infinity);
    expect(Number.isNaN(ev("log(x)", { x: -1 }))).toBe(true);
    expect(Number.isNaN(ev("sqrt(x)", { x: -4 }))).toBe(true);
    expect(Number.isNaN(ev("asin(2)"))).toBe(true);
    expect(Number.isNaN(ev("0/0"))).toBe(true);
    expect(ev("exp(1000)")).toBe(Infinity);
  });

  test("the plotters' forms", () => {
    const y = readCurve("y = a·sin(b·x)");
    expect(y.kind).toBe("y");
    expect(y.usesA && y.usesB).toBe(true);
    close(y.y({ x: Math.PI / 2, a: 2, b: 1 }), 2);
    expect(readCurve("sin(x)").kind).toBe("y");
    expect(readCurve("f(x) = x^2").kind).toBe("y");
    expect(readCurve("Y = X").kind).toBe("y");
    const r = readCurve("r = 1 + cos θ");
    expect(r.kind).toBe("polar");
    close(r.r({ θ: 0, a: 1, b: 1 }), 2);
    expect(readCurve("r(θ) = a").usesA).toBe(true);
    const p = readCurve("x = cos(3t), y = sin(2t)");
    expect(p.kind).toBe("param");
    close(p.x({ t: 0, a: 1, b: 1 }), 1);
    close(p.y({ t: Math.PI / 4, a: 1, b: 1 }), 1);
    const q = readCurve("y = sin t; x = cos t");
    close(q.x({ t: 0 }), 1);
    close(q.y({ t: 0 }), 0);
    const pair = readCurve("(cos t, sin t)");
    expect(pair.kind).toBe("param");
    close(pair.x({ t: 0 }), 1);
    const s = readSurface("z = x² − y²");
    close(s.z({ x: 2, y: 1, a: 1, b: 1 }), 3);
    const sr = readSurface("sin(r)/r");
    close(sr.z({ x: 3, y: 4 }), Math.sin(5) / 5);
    const st = readSurface("z = cos(θ)");
    close(st.z({ x: 0, y: 2 }), Math.cos(Math.PI / 2));
    expect(readSurface("z = a x y").usesA).toBe(true);
  });

  test("each plotter only takes its own letters", () => {
    fails(() => readCurve("y = t"), /“t” can't be used here/);
    fails(() => readCurve("r = x"), /can't be used here/);
    fails(() => readCurve("x = cos x, y = sin t"), /can't be used here/);
    fails(() => readSurface("z = t"), /can't be used here/);
    fails(() => readCurve("q = x"), /start it with/);
    fails(() => readSurface("y = x"), /start it with z/);
  });

  test("bad input gives one friendly message", () => {
    fails(() => readCurve(""), /nothing to draw/);
    fails(() => readCurve("   "), /nothing to draw/);
    fails(() => readCurve("y = "), /nothing to draw|stops too soon/);
    fails(() => readCurve("y = sin(x"), /brackets/);
    fails(() => readCurve("y = sin x)"), /brackets/);
    fails(() => readCurve("y = )("), /brackets/);
    fails(() => readCurve("y = 2 +"), /stops too soon/);
    fails(() => readCurve("y = * 2"), /sign needs/);
    fails(() => readCurve("y = x = 2"), /more than one = sign/);
    fails(() => readCurve("y = 1..2"), /two points|can read/);
    fails(() => readCurve("y = 1.2.3"), /two points/);
    fails(() => readCurve("y = foo(x)"), /don't know “foo”/);
    fails(() => readCurve("y = sin"), /missing what it works on/);
    fails(() => readCurve("y = sin()"), /stops too soon|brackets|sign/);
    fails(() => readCurve("y = min(x)"), /two values/);
    fails(() => readCurve("y = max x"), /needs brackets/);
    fails(() => readCurve("y = sin(x, 2)"), /takes one value/);
    fails(() => readCurve("y = |x"), /partner/);
    fails(() => readCurve("y = x$"), /sign “\$”/);
    fails(() => readCurve("x = t, y = t, z = t"), /too many commas/);
    fails(() => readCurve("x = t, x = t"), /twice/);
    fails(() => readCurve("y = 3,"), /./);
    fails(() => readCurve("y = (,)"), /./);
  });

  test("hostile input stays harmless", () => {
    // Names that would reach JavaScript's globals or prototypes are unknown.
    for (const bad of [
      "constructor",
      "__proto__",
      "prototype",
      "window",
      "globalThis",
      "alert(1)",
      "Function('return 1')()",
      "eval(1)",
      "this",
      "toString",
      "valueOf",
      "hasOwnProperty(x)",
      "Math.sin(x)",
      "x.constructor",
      "`x`",
      "'x'",
      '"x"',
      "x; alert(1)",
      "<script>",
      "import('x')",
      "new Date()",
      "process.exit()",
    ]) {
      expect(() => readCurve(`y = ${bad}`), bad).toThrow(EquationError);
    }
    // Over-long text is refused before it is read.
    fails(() => readCurve("y = " + "x+".repeat(80) + "x"), new RegExp(`over ${MAX_LENGTH}`));
    // Deep nesting is refused, not a stack overflow.
    fails(() => readCurve("y = " + "(".repeat(50) + "x" + ")".repeat(50)), /brackets inside/);
    fails(() => readCurve("y = " + "-".repeat(100) + "x"), /brackets inside/);
    fails(() => readCurve("y = " + "2^".repeat(50) + "2"), /brackets inside/);
    fails(() => readCurve("y = " + "sin(".repeat(20) + "x" + ")".repeat(20)), /brackets inside/);
    fails(() => readCurve("y = sin sin x"), /missing what it works on/);
    // Odd characters are named, not crashed on.
    fails(() => readCurve("y = x\u0000"));
    fails(() => readCurve("y = 😀"));
    fails(() => readCurve("y = x # comment"));
    // Non-string input.
    fails(() => readCurve(null), /nothing to draw/);
    fails(() => readCurve(undefined), /nothing to draw/);
    expect(readCurve(42).kind).toBe("y");
    // Every value comes out as a number.
    const c = readCurve("y = sin(x)/x + log(x) + sqrt(-x) + tan(x)");
    for (const x of [-2, -1, 0, 1e-300, 1, 1e308]) expect(typeof c.y({ x, a: 1, b: 1 })).toBe("number"); // prettier-ignore
  });

  test("many random strings throw only EquationError", () => {
    const alphabet = "xytrθab0123456789.+-*/^()|,= sincotaglqrepmhfdw[]{}²√π×÷−";
    let seed = 12345;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
    for (let n = 0; n < 4000; n++) {
      const L = 1 + Math.floor(rand() * 30);
      let s = "";
      for (let i = 0; i < L; i++) s += alphabet[Math.floor(rand() * alphabet.length)];
      for (const read of [readCurve, readSurface]) {
        try {
          const out = read(s);
          const f = out.y || out.r || out.x || out.z;
          expect(typeof f({ x: 0.5, y: 0.5, t: 0.5, θ: 0.5, a: 1, b: 1 })).toBe("number");
        } catch (e) {
          if (!(e instanceof EquationError)) throw new Error(`${JSON.stringify(s)}: ${e}`);
        }
      }
    }
  });
});
