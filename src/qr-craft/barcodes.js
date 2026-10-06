// Lane QR craft: barcodes drawn by our own code: Code 128 (ISO/IEC 15417)
// and EAN-13 and UPC-A (ISO/IEC 15420, GS1 General Specifications). Each
// encoder returns the bars as a list of module widths, bar first, plus the
// quiet zones the standards ask for, so the toy and the tests draw exactly
// the same thing. docs/evidence/barcodes.json has the tables, the
// check digit arithmetic and the reference values the tests use.
//
// A symbol: { kind, text (what it holds), human (the line printed under it),
//   widths: [bar, space, bar, …] in modules, modules (the sum), quiet:
//   [left, right] in modules, check (the check digit or check symbol value),
//   values (Code 128: the symbol values, start to check) }.

// ---- Code 128 ------------------------------------------------------------------------------

// The 107 patterns (values 0..106), each as bar/space widths in modules: six
// elements adding up to 11, the stop pattern seven adding up to 13.
// prettier-ignore
export const C128 = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];
const START = { A: 103, B: 104, C: 105 };
const STOP = 106;
const CODE = { A: 101, B: 100, C: 99 }; // "switch to code set …" from another set

const isDigit = (ch) => ch >= 48 && ch <= 57;
// How many digits run from position i.
function digitRun(cs, i) {
  let n = 0;
  while (i + n < cs.length && isDigit(cs[i + n])) n++;
  return n;
}

// The symbol values for `text` (ASCII 0..127): code set C for runs of digits
// (four or more at the start or the end, six or more in the middle, as the
// standard's Annex E suggests for the shortest symbol), B for printable
// characters and lower case, A for control characters.
export function code128Values(text) {
  const cs = Array.from(String(text), (c) => c.codePointAt(0));
  if (!cs.length) throw new Error("Type something for the barcode to hold.");
  const bad = cs.find((c) => c > 127);
  if (bad !== undefined)
    throw new Error(`Code 128 holds plain ASCII only; “${String.fromCodePoint(bad)}” isn't.`);
  const vals = [];
  let set = null;
  const setFor = (c) => (c < 32 ? "A" : c >= 96 ? "B" : null); // null: A or B
  const valueIn = (s, c) => (s === "A" ? (c < 32 ? c + 64 : c - 32) : c - 32);
  let i = 0;
  while (i < cs.length) {
    const run = digitRun(cs, i);
    const atStart = i === 0;
    const toEnd = i + run === cs.length;
    const wantC = run >= 2 && (run === cs.length ? run % 2 === 0 || run >= 4 : atStart || toEnd ? run >= 4 : run >= 6); // prettier-ignore
    if (set !== "C" && wantC) {
      // An odd run: its first digit goes in A or B, the rest in C (at the
      // start, the first digit leads; in the middle and at the end too).
      if (run % 2 === 1) {
        if (!set) {
          set = "B";
          vals.push(START.B);
        }
        vals.push(valueIn(set, cs[i]));
        i++;
      }
      vals.push(set ? CODE.C : START.C);
      set = "C";
      continue;
    }
    if (set === "C") {
      if (run >= 2) {
        vals.push((cs[i] - 48) * 10 + (cs[i + 1] - 48));
        i += 2;
        continue;
      }
      // Leave C for the next character's set.
      const want = setFor(cs[i]) || "B";
      vals.push(CODE[want]);
      set = want;
      continue;
    }
    const need = setFor(cs[i]);
    if (!set) {
      // Start in the set the next characters need most.
      let s = "B";
      for (let j = i; j < cs.length; j++) {
        const n = setFor(cs[j]);
        if (n) {
          s = n;
          break;
        }
      }
      set = s;
      vals.push(START[s]);
      continue;
    }
    if (need && need !== set) {
      vals.push(CODE[need]);
      set = need;
      continue;
    }
    vals.push(valueIn(set, cs[i]));
    i++;
  }
  const check = code128Check(vals);
  return { values: [...vals, check], check };
}

// The check symbol: the start value plus each value times its position,
// modulo 103.
export function code128Check(vals) {
  let sum = vals[0];
  for (let j = 1; j < vals.length; j++) sum += vals[j] * j;
  return sum % 103;
}

const widthsOf = (vals) => vals.flatMap((v) => Array.from(C128[v], Number));

export function code128(text) {
  const { values, check } = code128Values(text);
  const widths = widthsOf([...values, STOP]);
  const human = String(text).replace(/[\x00-\x1f\x7f]/g, "·");
  return { kind: "code128", text: String(text), human, widths, modules: widths.reduce((a, b) => a + b, 0), quiet: [10, 10], check, values }; // prettier-ignore
}

// ---- EAN-13 and UPC-A -----------------------------------------------------------------------

// Each digit's seven modules in set L (odd parity, left half); set R is L
// inverted; set G is R reversed.
// prettier-ignore
export const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
export const EAN_R = EAN_L.map((p) => Array.from(p, (b) => (b === "1" ? "0" : "1")).join(""));
export const EAN_G = EAN_R.map((p) => Array.from(p).reverse().join(""));
// The first digit sets the left half's pattern of L and G.
// prettier-ignore
export const EAN_PARITY = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

// The GS1 check digit: from the right, weights 3, 1, 3, 1, … over the digits
// before it; the check makes the sum a multiple of 10.
export function gs1Check(digits) {
  let sum = 0;
  const d = String(digits);
  for (let i = 0; i < d.length; i++) sum += Number(d[d.length - 1 - i]) * (i % 2 === 0 ? 3 : 1);
  return (10 - (sum % 10)) % 10;
}

function digitsOnly(text, n, name) {
  const s = String(text).replace(/[\s-]/g, "");
  if (!/^\d+$/.test(s)) throw new Error(`${name} holds digits only.`);
  if (s.length === n) return { body: s, given: null };
  if (s.length === n + 1) return { body: s.slice(0, n), given: Number(s[n]) };
  throw new Error(`${name} holds ${n} digits (and its check digit, which the toy works out).`);
}

// The 95 modules of an EAN-13 symbol for 13 digits, as a string of 0 and 1.
export function eanBits(d13) {
  const parity = EAN_PARITY[Number(d13[0])];
  let bits = "101";
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === "L" ? EAN_L : EAN_G)[Number(d13[i])];
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += EAN_R[Number(d13[i])];
  return bits + "101";
}
// Runs of equal bits, starting with a bar (EAN symbols start with one).
export function runs(bits) {
  const out = [];
  let n = 1;
  for (let i = 1; i <= bits.length; i++) {
    if (i < bits.length && bits[i] === bits[i - 1]) n++;
    else {
      out.push(n);
      n = 1;
    }
  }
  return out;
}

// 12 digits (or 13 with a check digit, which must be right).
export function ean13(text) {
  const { body, given } = digitsOnly(text, 12, "EAN-13");
  const check = gs1Check(body);
  if (given !== null && given !== check)
    throw new Error(`That check digit is ${given}, but ${body} needs ${check}.`);
  const d = body + check;
  const bits = eanBits(d);
  const widths = runs(bits);
  return { kind: "ean13", text: d, human: `${d[0]} ${d.slice(1, 7)} ${d.slice(7)}`, widths, bits, modules: 95, quiet: [11, 7], check }; // prettier-ignore
}

// UPC-A is EAN-13 with a leading 0: 11 digits (or 12 with the check digit).
export function upcA(text) {
  const { body, given } = digitsOnly(text, 11, "UPC-A");
  const check = gs1Check(body);
  if (given !== null && given !== check)
    throw new Error(`That check digit is ${given}, but ${body} needs ${check}.`);
  const d = body + check;
  const bits = eanBits("0" + d);
  const widths = runs(bits);
  return { kind: "upca", text: d, human: `${d[0]} ${d.slice(1, 6)} ${d.slice(6, 11)} ${d[11]}`, widths, bits, modules: 95, quiet: [9, 9], check }; // prettier-ignore
}

// Which modules are guard bars (drawn longer, as printed symbols do): EAN-13
// and UPC-A's start, middle and end guards, and UPC-A's first and last digit.
export function guardModules(sym) {
  const g = new Uint8Array(sym.modules);
  if (sym.kind !== "ean13" && sym.kind !== "upca") return g;
  const mark = (a, b) => g.fill(1, a, b);
  mark(0, 3);
  mark(45, 50);
  mark(92, 95);
  if (sym.kind === "upca") {
    mark(3, 10);
    mark(85, 92);
  }
  return g;
}

// A symbol's bars as dark spans [x0, x1) in modules from its left edge
// (without the quiet zone).
export function barSpans(sym) {
  const out = [];
  let x = 0;
  sym.widths.forEach((w, i) => {
    if (i % 2 === 0) out.push([x, x + w]);
    x += w;
  });
  return out;
}

// A linear symbol as an RGBA picture: `px` pixels a module, `h` modules tall,
// with its quiet zones and `pad` modules of white above and below.
export function rasterLinear(sym, px = 3, h = 40, pad = 6) {
  const W = (sym.modules + sym.quiet[0] + sym.quiet[1]) * px;
  const H = (h + 2 * pad) * px;
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  for (const [a, b] of barSpans(sym))
    for (let y = pad * px; y < (pad + h) * px; y++)
      for (let x = (sym.quiet[0] + a) * px; x < (sym.quiet[0] + b) * px; x++) {
        const o = (y * W + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = 0;
      }
  return { data, width: W, height: H };
}

// A 2D symbol's modules (Uint8Array rows × cols, 1 dark) as an RGBA picture.
export function raster2D(m, px = 6, quiet = 2) {
  const W = (m.cols + 2 * quiet) * px;
  const H = (m.rows + 2 * quiet) * px;
  const data = new Uint8ClampedArray(W * H * 4).fill(255);
  for (let r = 0; r < m.rows; r++)
    for (let c = 0; c < m.cols; c++) {
      if (!m.dark[r * m.cols + c]) continue;
      for (let y = (r + quiet) * px; y < (r + quiet + 1) * px; y++)
        for (let x = (c + quiet) * px; x < (c + quiet + 1) * px; x++) {
          const o = (y * W + x) * 4;
          data[o] = data[o + 1] = data[o + 2] = 0;
        }
    }
  return { data, width: W, height: H };
}
