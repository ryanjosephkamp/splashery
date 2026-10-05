import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { TURING, DIFFERENCE, ENIGMA, BOMBE } from "../src/packs/computing-history.js";
import { CNN_NET, CNN_SAMPLES, CNN_ACCURACY } from "../src/packs/computing-cnn.js";
import { FIELDS } from "../src/packs/lab.js";
import { fitSplats } from "../src/packs/splat-fit.js";
import { CurlField, Liquid, LIQUIDS, sdf } from "../src/fluids/sim.js";

const root = new URL("../", import.meta.url);
const read = (p) => fs.readFile(new URL(p, root), "utf8");

// Expose private calculations in memory. The production file stays untouched;
// relative imports and asset URLs still refer to the original source file.
async function inspectModule(path, names, transform = (s) => s) {
  const url = new URL(path, root);
  let source = transform(await fs.readFile(url, "utf8"));
  source = source.replace(
    /from\s+(["'])(\.[^"']+)\1/g,
    (_, q, p) => `from ${q}${new URL(p, url).href}${q}`,
  );
  source = source.replaceAll("import.meta.url", JSON.stringify(url.href));
  return import(
    `data:text/javascript;base64,${Buffer.from(`${source}\nexport { ${names} };`).toString("base64")}`
  );
}

let ai;
test.beforeAll(async () => {
  ai = await inspectModule(
    "src/packs/computing.js",
    "PERC, percLevel, XOR, xorCase, MLP, makeNet, netSizes, CNN, RNN, RNN_GATES, TF, TFC, LOOP, DIFF, diffStep, GD, WORDS, loadWords, analogy, wvLayout, SORT, cnnForward",
  );
});

function random(seed = 16) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

// Independent sorting references. These operate on their own array; neither
// the production steps nor production comparison results feed the reference.
function referenceSort(input, name) {
  const a = [...input],
    steps = [],
    comparisons = [];
  const cmp = (x, y, op) => {
    comparisons.push([x, y, op]);
    return op === ">" ? x > y : op === "<" ? x < y : x <= y;
  };
  const exchange = (i, j) => {
    if (i === j) return;
    const value = a[i];
    a[i] = a[j];
    a[j] = value;
    steps.push([...a]);
  };
  const insert = (gap) => {
    for (let end = gap; end < a.length; ++end) {
      let at = end;
      while (at >= gap) {
        if (!cmp(a[at - gap], a[at], ">")) break;
        exchange(at - gap, at);
        at -= gap;
      }
    }
  };
  switch (name) {
    case "bubble":
      for (let pass = 0; pass < a.length - 1; pass++)
        for (let j = 0; j < a.length - pass - 1; j++)
          if (cmp(a[j], a[j + 1], ">")) exchange(j, j + 1);
      break;
    case "quick": {
      const partition = (left, right) => {
        let boundary = left - 1;
        for (let scan = left; scan !== right; ++scan)
          if (cmp(a[scan], a[right], "<")) exchange(++boundary, scan);
        exchange(boundary + 1, right);
        return boundary + 1;
      };
      const pending = [[0, a.length - 1]];
      while (pending.length) {
        const [left, right] = pending.pop();
        if (left >= right) continue;
        const pivot = partition(left, right);
        pending.push([pivot + 1, right], [left, pivot - 1]);
      }
      break;
    }
    case "insertion":
      insert(1);
      break;
    case "shell":
      [4, 2, 1].forEach(insert);
      break;
    case "selection":
      for (let dest = 0; dest + 1 < a.length; ++dest) {
        let smallest = dest;
        for (let scan = dest + 1; scan < a.length; ++scan)
          if (cmp(a[scan], a[smallest], "<")) smallest = scan;
        exchange(dest, smallest);
      }
      break;
    case "cocktail":
      for (let pass = 0; pass < Math.floor(a.length / 2); ++pass) {
        for (let j = pass; j < a.length - pass - 1; ++j)
          if (cmp(a[j], a[j + 1], ">")) exchange(j, j + 1);
        for (let j = a.length - pass - 2; j > pass; --j)
          if (cmp(a[j - 1], a[j], ">")) exchange(j - 1, j);
      }
      break;
    case "heap": {
      const sink = (node, size) => {
        let largest = node;
        for (const child of [2 * node + 1, 2 * node + 2])
          if (child < size && cmp(a[child], a[largest], ">")) largest = child;
        if (largest !== node) {
          exchange(node, largest);
          sink(largest, size);
        }
      };
      for (let node = Math.floor(a.length / 2); node-- > 0; ) sink(node, a.length);
      for (let size = a.length; --size > 0; ) {
        exchange(0, size);
        sink(0, size);
      }
      break;
    }
    case "merge":
      for (let width = 1; width < a.length; width *= 2)
        for (let base = 0; base < a.length; base += 2 * width) {
          const left = a.slice(base, base + width);
          const right = a.slice(base + width, base + 2 * width);
          let li = 0,
            ri = 0,
            dest = base;
          while (li < left.length && ri < right.length) {
            if (cmp(left[li], right[ri], "<=")) {
              li++;
              dest++;
            } else {
              const rightAt = dest + left.length - li;
              const value = a[rightAt];
              for (let j = rightAt; j > dest; --j) a[j] = a[j - 1];
              a[dest++] = value;
              ri++;
              steps.push([...a]);
            }
          }
        }
      break;
    default:
      throw new Error(name);
  }
  return { a, steps, comparisons };
}

function permutations(a) {
  return a.length
    ? a.flatMap((v, i) => permutations(a.filter((_, j) => j !== i)).map((p) => [v, ...p]))
    : [[]];
}

test("sorting: eight independent traces, 384 edge, exhaustive and random inputs", async () => {
  const text = await read("src/packs/computing.js");
  const block = text.slice(text.indexOf("const SORT ="), text.indexOf("// The half adder:"));
  expect(block.match(/const start = \[5, 2, 7, 0, 6, 3, 1, 4\];/g)).toHaveLength(1);
  let sites = 0;
  const instrumented = block
    .replace("const start = [5, 2, 7, 0, 6, 3, 1, 4];", "const start = input.slice();")
    .replace(/(a\[[^\]]+\])\s*(<=|>|<)\s*(a\[[^\]]+\]|p\b)/g, (_, x, op, y) => {
      sites++;
      return `compare(${x}, ${y}, '${op}')`;
    });
  expect(sites).toBe(10);
  const execute = new Function("input", "compare", `${instrumented}\nreturn SORT;`);
  const rng = random();
  const inputs = [
    [],
    [0],
    [1, 0],
    [0, 1],
    Array(8).fill(3),
    [3, 1, 3, -2, 0, -2],
    [0, 1, 2, 3, 4, 5, 6, 7],
    [7, 6, 5, 4, 3, 2, 1, 0],
    ...permutations([0, 1, 2, 3, 4]),
  ];
  for (let k = 0; k < 256; k++)
    inputs.push(Array.from({ length: Math.floor(rng() * 33) }, () => Math.floor(rng() * 31) - 15));
  expect(inputs).toHaveLength(384);
  const algorithms = Object.keys(ai.SORT.steps);
  for (const input of inputs) {
    const comparisons = [];
    const actual = execute(input, (x, y, op) => {
      comparisons.push([x, y, op]);
      return op === ">" ? x > y : op === "<" ? x < y : x <= y;
    });
    const expectedComparisons = [];
    for (const name of algorithms) {
      const ref = referenceSort(input, name);
      expect(actual.steps[name], `${name}, ${input}`).toEqual(ref.steps);
      expect(ref.a).toEqual([...input].sort((a, b) => a - b));
      expectedComparisons.push(...ref.comparisons);
    }
    expect(comparisons).toEqual(expectedComparisons);
  }
  for (const name of algorithms)
    expect(ai.SORT.steps[name]).toEqual(referenceSort(ai.SORT.start, name).steps);
});

const segments = [
  "abcdef",
  "bc",
  "abdeg",
  "abcdg",
  "bcfg",
  "acdfg",
  "acdefg",
  "abc",
  "abcdefg",
  "abcdfg",
];
function digit(tokens, base) {
  const lit = [..."abcdefg"].filter((_, i) => tokens[base + i]?.visible === 1).join("");
  return lit ? segments.indexOf(lit) : 0;
}
function output() {
  return { parts: {}, tokens: [], cues: [] };
}

test("sorting: the actual display counts every recorded swap or merge move", () => {
  for (const steps of Object.values(ai.SORT.steps)) {
    const dt = Math.min(0.34, 3.6 / steps.length);
    for (let i = 1; i <= steps.length; i++) {
      const out = output(),
        s = 0.25 + (i - 0.5) * dt;
      ai.RECIPES["sorting-machine"].drive(0, { go: 1 - s / 5 }, out, { data: { steps } });
      expect(digit(out.tokens, 8) * 10 + digit(out.tokens, 15)).toBe(i);
    }
  }
});

// Independent Enigma: string lookup and inverse string search, rather than
// the production's numeric wiring and inverse arrays. Museum wiring tables:
// https://www.cryptomuseum.com/crypto/enigma/wiring.htm
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const rotorData = {
  I: ["EKMFLGDQVZNTOWYHXUSPAIBRCJ", "Q"],
  II: ["AJDKSIRUXBLHWTMCQGZNPYFVOE", "E"],
  III: ["BDFHJLCPRTXVZNYEIWGAKMUSQO", "V"],
  IV: ["ESOVPZJAYQUIRHXLNFTGKDCMWB", "J"],
  V: ["VZBRGITYUPSDNHLXAWMJQOFECK", "Z"],
};
const wrap = (n) => (n + 260) % 26;
function referenceEnigma(
  text,
  { rotors = ["I", "II", "III"], rings = [0, 0, 0], plugs = "" } = {},
  start = [0, 0, 0],
) {
  const p = [...start],
    positions = [],
    results = [];
  const plug = (ch) => {
    for (const pair of plugs.split(" ")) {
      if (pair[0] === ch) return pair[1];
      if (pair[1] === ch) return pair[0];
    }
    return ch;
  };
  for (const input of text) {
    const middleTurn = alphabet[p[1]] === rotorData[rotors[1]][1];
    const fastTurn = alphabet[p[2]] === rotorData[rotors[2]][1];
    if (middleTurn) p[0] = wrap(p[0] + 1);
    if (middleTurn || fastTurn) p[1] = wrap(p[1] + 1);
    p[2] = wrap(p[2] + 1);
    positions.push([...p]);
    let letter = plug(input);
    for (const i of [2, 1, 0]) {
      const at = wrap(alphabet.indexOf(letter) + p[i] - rings[i]);
      letter = alphabet[wrap(alphabet.indexOf(rotorData[rotors[i]][0][at]) - p[i] + rings[i])];
    }
    letter = "YRUHQSLDPXNGOKMIEBFZCWVJAT"[alphabet.indexOf(letter)];
    for (const i of [0, 1, 2]) {
      const at = alphabet[wrap(alphabet.indexOf(letter) + p[i] - rings[i])];
      letter = alphabet[wrap(rotorData[rotors[i]][0].indexOf(at) - p[i] + rings[i])];
    }
    results.push(plug(letter));
  }
  return { text: results.join(""), positions };
}
const encipher = (text, settings = {}, start = [0, 0, 0]) =>
  ENIGMA.machine(settings)
    .type(text, start)
    .map((e) => alphabet[e.lamp])
    .join("");

test("Enigma: published vectors and museum double-step sequence", () => {
  expect(encipher("AAAAA", { plugs: "" })).toBe("BDZGO");
  expect(encipher("HELLOWORLD", { plugs: "" })).toBe("ILBDAAMTAZ");
  const settings = { rotors: ["III", "II", "I"], plugs: "" };
  const actual = ENIGMA.machine(settings).type("AAAAAA", [10, 3, 14]);
  expect(actual.map((e) => e.pos.map((i) => alphabet[i]).join(""))).toEqual([
    "KDP",
    "KDQ",
    "KER",
    "LFS",
    "LFT",
    "LFU",
  ]);
  expect(actual.map((e) => e.pos)).toEqual(
    referenceEnigma("AAAAAA", settings, [10, 3, 14]).positions,
  );
});

test("Enigma: all rotor orders, nonzero rings, plugboards, 384 independent messages", () => {
  const rng = random(1940);
  for (const rotors of permutations(["I", "II", "III"]))
    for (let k = 0; k < 64; k++) {
      const settings = {
        rotors,
        rings: Array.from({ length: 3 }, () => Math.floor(rng() * 26)),
        plugs: k % 2 ? "AR GK OX" : "AV BS CG DL FU HZ IN KM OW RX",
      };
      const start = Array.from({ length: 3 }, () => Math.floor(rng() * 26));
      const text = Array.from({ length: 100 }, () => alphabet[Math.floor(rng() * 26)]).join("");
      const run = ENIGMA.machine(settings).type(text, start),
        ref = referenceEnigma(text, settings, start);
      expect(run.map((e) => e.pos)).toEqual(ref.positions);
      const coded = run.map((e) => alphabet[e.lamp]).join("");
      expect(coded).toBe(ref.text);
      expect(encipher(coded, settings, start)).toBe(text);
      expect([...coded].every((ch, i) => ch !== text[i])).toBe(true);
    }
});

test("Enigma: published historical-message procedure, proposed IV/V extension only", () => {
  // Py-Enigma's guide publishes an example based on Cryptocellar's wartime
  // procedure. IV and V are intentionally only in this independent reference.
  // https://py-enigma.readthedocs.io/en/latest/guide.html
  const settings = {
    rotors: ["II", "IV", "V"],
    rings: [1, 20, 11],
    plugs: "AV BS CG DL FU HZ IN KM OW RX",
  };
  expect(referenceEnigma("KCH", settings, [22, 23, 2]).text).toBe("BLA");
  expect(referenceEnigma("NIBLFMYMLLUFWCASCSSNVHAZ", settings, [1, 11, 0]).text).toBe(
    "THEXRUSSIANSXAREXCOMINGX",
  );
  // Published wartime message, republished with its settings and plaintext:
  // https://github.com/gremmie/enigma/blob/master/enigma/tests/test_enigma.py
  const ciphertext =
    "EDPUD NRGYS ZRCXN UYTPO MRMBO FKTBZ REZKM LXLVE FGUEY SIOZV EQMIK UBPMM YLKLT TDEIS MDICA GYKUA CTCDO MOHWX MUUIA UBSTS LRNBZ SZWNR FXWFY SSXJZ VIJHI DISHP RKLKA YUPAD TXQSP INQMA TLPIF SVKDA SCTAC DPBOP VHJK".replaceAll(
      " ",
      "",
    );
  const plaintext =
    "AUFKL XABTE ILUNG XVONX KURTI NOWAX KURTI NOWAX NORDW ESTLX SEBEZ XSEBE ZXUAF FLIEG ERSTR ASZER IQTUN GXDUB ROWKI XDUBR OWKIX OPOTS CHKAX OPOTS CHKAX UMXEI NSAQT DREIN ULLXU HRANG ETRET ENXAN GRIFF XINFX RGTX".replaceAll(
      " ",
      "",
    );
  expect(referenceEnigma(ciphertext, settings, [1, 11, 0]).text).toBe(plaintext);
});

test("Turing: all 4096 supported integers add one; busy beavers match independent rule traces", () => {
  for (let n = 0; n < 4096; n++) {
    const result = TURING.run(TURING.PROGRAMS.add, TURING.tape(n.toString(2)));
    const positions = Object.keys(result.tape)
      .map(Number)
      .sort((a, b) => a - b);
    const bits = positions.map((p) => result.tape[p]).join("");
    expect(result.halted).toBe(true);
    expect(parseInt(bits, 2)).toBe(n + 1);
  }
  for (const [id, ones, count] of [
    ["bb2", 4, 6],
    ["bb3", 6, 13],
  ]) {
    const rules = TURING.PROGRAMS[id].rules,
      memory = new Map(),
      expected = [];
    let state = "A",
      head = 0;
    while (state !== "H") {
      const symbol = memory.get(head) || 0,
        rule = rules[state][symbol];
      expected.push([head, state, symbol, ...rule]);
      memory.set(head, rule[0]);
      head += rule[1];
      state = rule[2];
    }
    const got = TURING.run(TURING.PROGRAMS[id], {});
    expect(got.steps.map((s) => [s.cell, s.state, s.read, s.write, s.move, s.next])).toEqual(
      expected,
    );
    expect(got.steps).toHaveLength(count);
    expect(Object.values(got.tape).reduce((a, b) => a + b, 0)).toBe(ones);
  }
});

test("difference engine: 128 polynomials, wrap and every decimal carry", () => {
  const rng = random(1849);
  for (let j = 0; j < 128; j++) {
    const c = Array.from({ length: 4 }, () => Math.floor(rng() * 19) - 9);
    const f = (x) => c.reduce((s, v, i) => s + v * x ** i, 0),
      start = j % 21;
    const expr = c.map((v, i) => `(${v})*x^${i}`).join("+");
    const parsed = DIFFERENCE.read(expr, start);
    let st = DIFFERENCE.setup(parsed.f, start);
    for (let turn = 0; turn < 32; turn++) {
      expect(((st.v % 100000) + 100000) % 100000).toBe(
        ((f(start + turn) % 100000) + 100000) % 100000,
      );
      const result = DIFFERENCE.turn(st);
      for (const phase of result.phases)
        for (const a of Object.values(phase.adds)) {
          const digits = a.from.map((v, i) => (v + a.steps[i]) % 10);
          for (const at of a.carries) digits[at] = (digits[at] + 1) % 10;
          expect(digits.reduce((s, v, i) => s + v * 10 ** i, 0)).toBe(a.result);
        }
      st = result.next;
    }
  }
  expect(() => DIFFERENCE.read("x^4")).toThrow();
  // Eight sampled values cannot establish an expression's degree.
  const impostor = DIFFERENCE.read("x^2+(x-1)(x-2)(x-3)(x-4)(x-5)(x-6)(x-7)(x-8)");
  let next = DIFFERENCE.setup(impostor.f, 1);
  for (let i = 0; i < 8; i++) next = DIFFERENCE.turn(next).next;
  expect(next.v).toBe(81);
  expect(impostor.f(9)).toBe(40401);
});

test("Bombe: known-plugboard search and first matching setting, including ambiguous cribs", () => {
  for (const msg of ["WEATHERREPORT", "HELLOWORLD", "AAAAA", "A"]) {
    const actual = BOMBE.crack(msg);
    let first = null;
    for (let i = 0; i < 17576; i++) {
      const pos = [Math.floor(i / 676), Math.floor(i / 26) % 26, i % 26];
      if (
        referenceEnigma(actual.crib, { plugs: "AR GK OX" }, pos).text ===
        actual.coded.slice(0, actual.crib.length)
      ) {
        first = { i, pos };
        break;
      }
    }
    expect(actual.found).toEqual(first);
    expect(actual.plain).toBe(referenceEnigma(actual.coded, { plugs: "AR GK OX" }, first.pos).text);
    expect(actual.plain).toBe(msg);
  }
  const short = BOMBE.crack("A");
  let matches = 0;
  for (let i = 0; i < 17576; i++) {
    const position = [Math.floor(i / 676), Math.floor(i / 26) % 26, i % 26];
    if (referenceEnigma("A", { plugs: "AR GK OX" }, position).text === short.coded) matches++;
  }
  expect(matches).toBeGreaterThan(1);
});

test("perceptron and multilayer perceptron: threshold sums, learning example and XOR", () => {
  const { PERC } = ai;
  expect(ai.percLevel(PERC.before) * PERC.max).toBeCloseTo(0.35, 12);
  expect(ai.percLevel(PERC.after) * PERC.max).toBeCloseTo(1.35, 12);
  expect(PERC.after).toEqual(PERC.before.map((w, i) => w + 0.5 * PERC.inputs[i]));
  for (const input of ai.XOR.cases) {
    const got = ai.xorCase(input);
    expect(got.h).toEqual([Number(Boolean(input[0] || input[1])), Number(!(input[0] && input[1]))]);
    expect(got.y).toBe(input[0] ^ input[1]);
  }
});

test("neural network: every supported size has the independent sigmoid forward pass", () => {
  for (let inputs = 2; inputs <= 4; inputs++)
    for (let outputs = 1; outputs <= 3; outputs++)
      for (let layers = 1; layers <= 3; layers++)
        for (let neurons = 2; neurons <= 5; neurons++) {
          const net = ai.makeNet(ai.netSizes({ inputs, outputs, layers, neurons }));
          expect(net.sizes.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(14);
          for (let l = 0; l < net.acts.length - 1; l++)
            for (let j = 0; j < net.acts[l + 1].length; j++) {
              const bias = net.sizes.join() === "3,4,2" ? (l === 0 ? -0.6 : -0.8) : -0.4;
              const z = net.wires
                .filter((w) => w.l === l && w.b === j)
                .reduce((s, w) => s + w.w * net.acts[l][w.a], bias);
              expect(net.acts[l + 1][j]).toBeCloseTo(1 / (1 + Math.exp(-z)), 12);
            }
        }
});

// Independent tensor-shaped CNN, different indexing and matrix loops from
// the flat production implementation. The learned constants are its input.
function referenceCnn(px) {
  const conv = (maps, weights, biases) =>
    biases.map((bias, o) =>
      maps[0].map((row, y) =>
        row.map((_, x) => {
          let sum = bias;
          maps.forEach((map, c) => {
            for (let ky = 0; ky < 3; ky++)
              for (let kx = 0; kx < 3; kx++)
                sum +=
                  (map[y + ky - 1]?.[x + kx - 1] || 0) *
                  weights[o * maps.length * 9 + c * 9 + ky * 3 + kx];
          });
          return Math.max(0, sum);
        }),
      ),
    );
  const pool = (maps) =>
    maps.map((map) =>
      Array.from({ length: map.length / 2 }, (_, y) =>
        Array.from({ length: map.length / 2 }, (_, x) =>
          Math.max(
            map[2 * y][2 * x],
            map[2 * y][2 * x + 1],
            map[2 * y + 1][2 * x],
            map[2 * y + 1][2 * x + 1],
          ),
        ),
      ),
    );
  const x = [Array.from({ length: 8 }, (_, i) => px.slice(i * 8, i * 8 + 8).map((v) => v / 16))];
  const c1 = conv(x, CNN_NET.w1, CNN_NET.b1),
    p1 = pool(c1),
    c2 = conv(p1, CNN_NET.w2, CNN_NET.b2),
    p2 = pool(c2);
  const features = p2.flat(2);
  const logits = CNN_NET.b3.map((b, i) =>
    CNN_NET.w3.slice(i * 32, i * 32 + 32).reduce((s, w, j) => s + w * features[j], b),
  );
  const exponent = logits.map((v) => Math.exp(v - Math.max(...logits))),
    sum = exponent.reduce((a, b) => a + b, 0);
  return {
    c1: c1.flat(2),
    p1: p1.flat(2),
    c2: c2.flat(2),
    p2: features,
    prob: exponent.map((v) => v / sum),
  };
}

test("CNN: actual drawing inference agrees at every layer for samples and 64 random drawings", () => {
  const rng = random(1998);
  const inputs = [
    ...CNN_SAMPLES,
    ...Array.from({ length: 64 }, () => Array.from({ length: 64 }, () => Math.floor(rng() * 17))),
  ];
  for (const px of inputs) {
    const actual = ai.cnnForward(px),
      ref = referenceCnn(px);
    for (const key of Object.keys(ref)) {
      expect(actual[key].length).toBe(ref[key].length);
      const error = Math.max(...actual[key].map((v, i) => Math.abs(v - ref[key][i])));
      expect(error, key).toBeLessThan(1e-10);
    }
  }
  expect(CNN_SAMPLES.map((px) => ai.cnnForward(px).digit)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  const { img } = ai.CNN,
    kernel = [
      [-0.5, -0.5, 1],
      [-0.5, 1, -0.5],
      [1, -0.5, -0.5],
    ],
    map = [];
  expect(ai.CNN.scores).toEqual([0.08, 0.3, 0.14, 0.22, 0.12, 0.09, 0.06, 1, 0.18, 0.34]);
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 5; x++)
      map.push(
        Math.max(
          0,
          kernel.flat().reduce((s, w, k) => s + w * img[y + Math.floor(k / 3)][x + (k % 3)], 0),
        ),
      );
  const normalized = map.map((v) => v / Math.max(...map));
  expect(ai.CNN.fmap).toEqual(normalized);
  for (let y = 0; y < 3; y++)
    for (let x = 0; x < 3; x++) {
      const cells = [];
      for (let dy = 0; dy < 2; dy++)
        for (let dx = 0; dx < 2; dx++)
          if (2 * y + dy < 5 && 2 * x + dx < 5)
            cells.push(normalized[(2 * y + dy) * 5 + 2 * x + dx]);
      expect(ai.CNN.pool[y * 3 + x]).toBe(Math.max(...cells));
    }
});

// UCI test-set fixture is inserted below, packed as 64 pixel bytes and one
// label byte per row, compressed with zlib. Attribution: Alpaydin and
// Kaynak, UCI, CC BY 4.0, https://doi.org/10.24432/C50P49
// https://archive.ics.uci.edu/dataset/80/optical+recognition+of+handwritten+digits
const UCI_TEST =
  "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";
test("CNN: reproduce the displayed 97.0 percent on all 1797 UCI test digits", () => {
  const data = inflateSync(Buffer.from(UCI_TEST, "base64"));
  expect(data.length).toBe(1797 * 65);
  expect(createHash("sha256").update(data).digest("hex")).toBe(
    "68aea062d35a127749050fa0e52dca09d6569ac08092c925610e0954e172dde2",
  );
  let correct = 0;
  for (let i = 0; i < 1797; i++)
    if (ai.cnnForward(Array.from(data.subarray(i * 65, i * 65 + 64))).digit === data[i * 65 + 64])
      correct++;
  expect(correct).toBe(1743);
  expect(correct / 1797).toBeCloseTo(CNN_ACCURACY, 4);
});

test("RNN, transformer and looped transformer: diagram outputs are prepared, not learned", () => {
  expect(ai.RNN.words).toEqual(["THE", "CAT", "SAT"]);
  expect(ai.RNN_GATES.map((g) => g.label)).toEqual(["F", "I", "O"]);
  expect(ai.RNN.orbColors).toHaveLength(4);
  expect(ai.TF.next).toBe("MAT");
  expect(ai.TF.heads.flat(2).some(([from, to]) => to > from)).toBe(true);
  expect(ai.TFC.encBoxes.map((b) => b.icon)).toEqual(["⁞", "◉", "+", "»", "+"]);
  expect(ai.TFC.decBoxes.map((b) => b.icon)).toEqual(["⁞", "◒", "+", "◉", "+", "»", "+", "╱", "▥"]);
  expect(ai.LOOP.marks).toEqual(["3", "+", "4", "=", "7"]);
  for (let i = 0; i < 5; i++)
    expect(ai.LOOP.levels[i][3].flat().every((v) => v === 0 || v === 1)).toBe(true);
});

test("diffusion: ten prepared morph stages count from 50 to zero in fives", () => {
  for (let n = 0; n <= 10; n++) {
    const s = n === 0 ? 0.1 : 0.2 + (n - 0.5) * 0.3,
      st = ai.diffStep(s),
      out = output();
    expect(st.n).toBe(n);
    expect(st.w).toBeCloseTo(1 - (1 - n / 10) ** 1.6, 12);
    ai.RECIPES["diffusion-model"].drive(0, { go: 1 - s / 5 }, out, { data: { view: "poster" } });
    expect(digit(out.tokens, 0) * 10 + digit(out.tokens, 7)).toBe(50 - 5 * n);
  }
});

test("gradient descent: paths match analytic gradients, momentum and boundary clipping", () => {
  const rates = { low: [0.035, 0.3], good: [0.17, 0.5], high: [0.95, 0] };
  const gradient = (x, z) => {
    const d = x - 0.3;
    return [d + 15 * d * Math.exp((-d * d) / 0.04) + 0.25 * Math.cos(5 * x), 1.4 * z];
  };
  for (const [name, [eta, beta]] of Object.entries(rates)) {
    let x = -0.85,
      z = 0.45,
      vx = 0,
      vz = 0;
    for (const p of ai.GD.paths[name]) {
      // Central differences approximate the analytic gradient. Even the
      // largest-rate path stays within 6e-6 of the analytic trajectory.
      expect(Math.abs(p[0] - x)).toBeLessThan(6e-6);
      expect(Math.abs(p[2] - z)).toBeLessThan(6e-6);
      expect(Math.abs(p[1] - (ai.GD.f(x, z) * 0.62 + 0.085))).toBeLessThan(6e-6);
      const [gx, gz] = gradient(x, z);
      vx = beta * vx - eta * gx;
      vz = beta * vz - eta * gz;
      x = Math.max(-0.95, Math.min(0.95, x + vx));
      z = Math.max(-0.95, Math.min(0.95, z + vz));
    }
  }
  expect(ai.GD.paths.good).toHaveLength(22);
});

test("word vectors: real 50-dimensional data, independent analogy rankings and 3D parallelogram", async () => {
  await ai.loadWords();
  const { WORDS } = ai;
  expect(WORDS.list).toHaveLength(24000);
  expect(WORDS.vec.length).toBe(24000 * 50);
  const vector = (word) =>
    Array.from(WORDS.vec.slice(WORDS.index.get(word) * 50, WORDS.index.get(word) * 50 + 50));
  const norms = WORDS.list.map((word) => Math.hypot(...vector(word)));
  expect(Math.min(...norms)).toBeGreaterThan(0.991);
  expect(Math.max(...norms)).toBeLessThan(1.009);
  const queries = [
    ["king", "man", "woman"],
    ["paris", "france", "italy"],
    ["big", "bigger", "small"],
    ["walking", "walk", "swim"],
  ];
  for (const [a, b, c] of queries) {
    const [va, vb, vc] = [a, b, c].map(vector),
      q = va.map((v, i) => v - vb[i] + vc[i]),
      norm = Math.hypot(...q);
    const ranked = WORDS.list
      .slice(0, 10000)
      .filter((w) => ![a, b, c].includes(w))
      .map((word) => ({ word, score: vector(word).reduce((s, v, i) => s + (v * q[i]) / norm, 0) }))
      .sort((a, b) => b.score - a.score);
    const actual = ai.analogy(a, b, c);
    expect(actual.answer).toBe(ranked[0].word);
    expect(actual.runner).toBe(ranked[1].word);
    expect(actual.score).toBeCloseTo(ranked[0].score, 7);
    const { at } = ai.wvLayout(a, b, c);
    at.sum.forEach((v, i) => expect(v).toBeCloseTo(at.a[i] - at.b[i] + at.c[i], 12));
  }
  expect(ai.analogy("king", "man", "woman").answer).toBe("queen");
  // Source-vector fixture from Stanford's official glove.6B.50d.txt goes here.
  const sourceVectors = {
    man: [
      -0.094386, 0.43007, -0.17224, -0.45529, 1.6447, 0.40335, -0.37263, 0.25071, -0.10588, 0.10778,
      -0.10848, 0.15181, -0.65396, 0.55054, 0.59591, -0.46278, 0.11847, 0.64448, -0.70948, 0.23947,
      -0.82905, 1.272, 0.033021, 0.2935, 0.3911, -2.8094, -0.70745, 0.4106, 0.3894, -0.2913, 2.6124,
      -0.34576, -0.16832, 0.25154, 0.31216, 0.31639, 0.12539, -0.012646, 0.22297, -0.56585,
      -0.086264, 0.62549, -0.0576, 0.29375, 0.66005, -0.53115, -0.48233, -0.97925, 0.53135,
      -0.11725,
    ],
    king: [
      0.50451, 0.68607, -0.59517, -0.022801, 0.60046, -0.13498, -0.08813, 0.47377, -0.61798,
      -0.31012, -0.076666, 1.493, -0.034189, -0.98173, 0.68229, 0.81722, -0.51874, -0.31503,
      -0.55809, 0.66421, 0.1961, -0.13495, -0.11476, -0.30344, 0.41177, -2.223, -1.0756, -1.0783,
      -0.34354, 0.33505, 1.9927, -0.04234, -0.64319, 0.71125, 0.49159, 0.16754, 0.34344, -0.25663,
      -0.8523, 0.1661, 0.40102, 1.1685, -1.0137, -0.21585, -0.15155, 0.78321, -0.91241, -1.6106,
      -0.64426, -0.51042,
    ],
    woman: [
      -0.18153, 0.64827, -0.5821, -0.49451, 1.5415, 1.345, -0.43305, 0.58059, 0.35556, -0.25184,
      0.20254, -0.71643, 0.3061, 0.56127, 0.83928, -0.38085, -0.90875, 0.43326, -0.014436, 0.23725,
      -0.53799, 1.7773, -0.066433, 0.69795, 0.69291, -2.6739, -0.76805, 0.33929, 0.19695, -0.35245,
      2.292, -0.27411, -0.30169, 0.00085286, 0.16923, 0.091433, -0.02361, 0.036236, 0.34488,
      -0.83947, -0.25174, 0.42123, 0.48616, 0.022325, 0.5576, -0.85223, -0.23073, -1.3138, 0.48764,
      -0.10467,
    ],
    paris: [
      0.76989, 1.181, -1.1299, -0.74725, -0.5969, -1.0518, -0.46552, 0.27009, -0.99243, -0.04864,
      0.28642, -0.75261, -1.0566, -0.19205, 0.572, -0.24391, -0.36054, -0.70876, -0.91951, -0.27024,
      1.5131, 1.0313, -0.55713, 0.52952, -0.71494, -1.0949, -0.60565, 0.31329, -0.44488, 0.55915,
      2.1429, 0.43389, -0.5529, -0.24261, -0.43679, -0.96014, 0.25828, 0.79385, 0.37132, 0.49623,
      0.84359, -0.25875, 1.5616, -1.1199, 0.091676, 0.076675, -0.45084, -0.86104, 0.97599, -0.35615,
    ],
  };
  for (const [word, raw] of Object.entries(sourceVectors)) {
    const norm = Math.hypot(...raw),
      expected = raw.map((v) => Math.fround((Math.round((v / norm) * 127) || 0) / 127));
    expect(vector(word)).toEqual(expected);
  }
});

test("Gaussian fit: independently rendered pixel loss and finite-difference gradients", async () => {
  expect((await inspectModule("src/packs/splatting.js", "FIT_N")).FIT_N).toBe(2400);
  const job = {
    w: 12,
    h: 12,
    n: 2,
    steps: 0,
    keys: [0],
    background: [0.9, 0.8, 0.7],
    pixels: new Uint8ClampedArray(12 * 12 * 4).fill(100),
  };
  const initial = fitSplats(job),
    k = initial.keys[0],
    render = initial.render();
  let loss = 0;
  for (let y = 0; y < 12; y++)
    for (let x = 0; x < 12; x++) {
      let transmission = 1;
      const color = [0, 0, 0];
      for (let i = 0; i < 2; i++) {
        const dx = x + 0.5 - k.x[i],
          dy = y + 0.5 - k.y[i],
          cs = Math.cos(k.angle[i]),
          sn = Math.sin(k.angle[i]);
        const q = ((cs * dx + sn * dy) / k.sx[i]) ** 2 + ((-sn * dx + cs * dy) / k.sy[i]) ** 2;
        if (q >= 8) continue;
        const alpha = (k.a[i] * (Math.exp(-q / 2) - Math.exp(-4))) / (1 - Math.exp(-4));
        if (alpha < 1 / 255) continue;
        [k.r[i], k.g[i], k.b[i]].forEach(
          (v, j) => (color[j] += transmission * Math.min(0.99, alpha) * v),
        );
        transmission *= 1 - Math.min(0.99, alpha);
      }
      color.forEach((v, j) => {
        const expected = v + transmission * job.background[j];
        expect(render.color[(y * 12 + x) * 3 + j]).toBeCloseTo(expected, 6);
        loss += (expected - 100 / 255) ** 2;
      });
    }
  expect(k.loss).toBeCloseTo(loss / 144, 6);
  const probe = await inspectModule("src/packs/splat-fit.js", "", (s) =>
    s.replace(
      "  const out = { w, h, n, keys: [] };",
      "  return { evaluate(p) { prm.set(p); const loss = pass(true); return { loss, gradient: Array.from(grad) }; } };\n  const out = { w, h, n, keys: [] };",
    ),
  );
  const params = [
    6.12,
    5.81,
    Math.log(1.7),
    Math.log(1.2),
    0.4,
    0.42,
    0.53,
    0.66,
    0.2,
    3.22,
    3.71,
    Math.log(1.3),
    Math.log(1.8),
    -0.3,
    0.32,
    0.63,
    0.46,
    -0.1,
  ];
  const evalFit = probe.fitSplats(job),
    baseline = evalFit.evaluate(params),
    epsilon = 0.002;
  for (let j = 0; j < params.length; j++) {
    const plus = [...params],
      minus = [...params];
    plus[j] += epsilon;
    minus[j] -= epsilon;
    const numerical = (evalFit.evaluate(plus).loss - evalFit.evaluate(minus).loss) / (2 * epsilon);
    expect(baseline.gradient[j], `parameter ${j}`).toBeCloseTo(numerical, 4);
  }
  const fitted = fitSplats({ ...job, n: 16, steps: 40, keys: [0, 40] });
  expect(fitted.keys[1].loss).toBeLessThan(fitted.keys[0].loss);
});

test("Gaussian one-splat view: parameter-error decay and forced final snap", async () => {
  const module = await inspectModule("src/packs/splatting.js", "ONE, oneLeft");
  for (const rate of Object.values(module.ONE.rate))
    for (let n = 0; n < 24; n++)
      expect(module.oneLeft(0.1 + (0.82 * n) / 24, rate)).toBeCloseTo((1 - rate) ** n, 10);
  expect(module.oneLeft(1, 0.24)).toBe(0);
});

test("Gaussian sorting view: distance ordering can disagree with camera depth", async () => {
  const module = await inspectModule("src/packs/splatting.js", "SORT, buildSorting", (s) =>
    s.replace("  const per = SORT.bead;", "  return { pts, order };\n  const per = SORT.bead;"),
  );
  const { pts, order } = module.buildSorting({ seed: 16 }),
    camera = module.SORT.cam;
  const length = Math.hypot(...camera),
    forward = camera.map((v) => -v / length);
  const depth = (i) => pts[i].p.reduce((sum, v, j) => sum + (v - camera[j]) * forward[j], 0);
  expect(order.every((i, j) => j === 0 || pts[order[j - 1]].d >= pts[i].d)).toBe(true);
  expect(order.some((i, j) => j > 0 && depth(order[j - 1]) < depth(i))).toBe(true);
});

test("splat fields: four-wave formula and closed torus-knot flow", async () => {
  const { knotPoint } = await inspectModule("src/packs/lab.js", "knotPoint");
  const waves = [
      [0.9, 0.09, 1, 0],
      [0.55, 0.08, 0.8, 0.6],
      [0.33, 0.07, 0.2, -0.98],
      [0.21, 0.05, -0.7, 0.71],
    ],
    tau = 2 * Math.PI;
  for (let i = 0; i < 100; i++) {
    const u = (i + 0.5) / 100,
      v = (i * 0.37) % 1,
      t = i / 10,
      x = Math.sqrt(u) * Math.cos(tau * v),
      z = Math.sqrt(u) * Math.sin(tau * v),
      expected = [x, 0, z];
    for (const [length, steep, dx, dz] of waves) {
      const k = tau / length,
        phase = k * (dx * x + dz * z) - Math.sqrt(9.8 * k) * 0.35 * t,
        A = steep / k;
      expected[0] += dx * A * Math.cos(phase) * 0.8;
      expected[1] += A * Math.sin(phase);
      expected[2] += dz * A * Math.cos(phase) * 0.8;
    }
    FIELDS.ocean(u, v, t).forEach((n, j) => expect(n).toBeCloseTo(expected[j], 12));
    FIELDS.knot(u, v, t).forEach((n, j) =>
      expect(n).toBeCloseTo(FIELDS.knot(u, v, t + 1 / 0.03)[j], 9),
    );
    const theta = tau * (u + 0.03 * t),
      radius = 2 + Math.cos(3 * theta);
    const center = [
      0.3 * radius * Math.cos(2 * theta),
      -0.3 * Math.sin(3 * theta),
      0.3 * radius * Math.sin(2 * theta),
    ];
    // Midpoints across opposite cross-section angles recover the centerline.
    const a = knotPoint(u + 0.03 * t, v, 0.5),
      b = knotPoint(u + 0.03 * t, (v + 0.5) % 1, 0.5);
    a.forEach((n, j) => expect((n + b[j]) / 2).toBeCloseTo(center[j], 10));
    expect(FIELDS.galaxy(u, v, t).every(Number.isFinite)).toBe(true);
  }
});

test("Fluid lab: presets, collider distances, curl divergence and actual tap controls", async () => {
  expect(LIQUIDS.water.viscosity).toBeLessThan(LIQUIDS.honey.viscosity);
  expect(LIQUIDS.honey.viscosity).toBeLessThan(LIQUIDS.lava.viscosity);
  expect(sdf({ type: "floor", y: 0 }, 0, 1, 0)).toBe(1);
  const curl = new CurlField(16),
    h = 1e-4;
  for (const p of [
    [0, 0, 0],
    [0.3, 0.8, -0.2],
    [1, 2, 3],
  ]) {
    let divergence = 0;
    for (let axis = 0; axis < 3; axis++) {
      const plus = [...p],
        minus = [...p];
      plus[axis] += h;
      minus[axis] -= h;
      const a = [...curl.at(...plus, 0.7)],
        b = [...curl.at(...minus, 0.7)];
      divergence += (a[axis] - b[axis]) / (2 * h);
    }
    expect(Math.abs(divergence)).toBeLessThan(1e-6);
  }
  const { RECIPES } = await import("../src/packs/fluid-lab.js"),
    recipe = RECIPES["fluid-lab"];
  const drive = (scene, s, n = 1) => {
    const out = output();
    recipe.drive(0, { go: 1 - s / 5 }, out, { data: { scene, pour: 2.4 }, tap: { n } });
    return out;
  };
  expect(drive("glass", 0.5, 1).fluid.liquid.on).toBe(true);
  expect(drive("glass", 0.5, 3).fluid.liquid.drain).toBe(0.55);
  expect(drive("glass", 1.5, 3).fluid.liquid.on).toBe(true);
  expect(drive("candle", 1).fluid.flame.on).toBe(false);
  expect(drive("candle", 3.5).fluid.flame.on).toBe(true);
  expect(drive("cup", 1.1).fluid.steam.wind[0]).toBeCloseTo(1.4, 12);
});

test("Fluid lab: kernel constants, isolated gravity and independent neighbor smoothing", () => {
  for (const preset of ["water", "honey", "lava"]) {
    const liquid = new Liquid(
      { name: "evidence", preset },
      { cap: 2, spacing: 0.1, gravity: [0, -9.8, 0], seed: 16 },
    );
    const h = 0.18;
    expect(liquid.K.poly6).toBeCloseTo(315 / (64 * Math.PI * h ** 9), 3);
    expect(liquid.K.spiky).toBeCloseTo(-45 / (Math.PI * h ** 6), 3);
    liquid.n = 1;
    liquid.pos[1] = 1;
    liquid.step(0.01);
    expect(liquid.pos[1]).toBeCloseTo(1 - 9.8 * 0.01 ** 2, 6);
    expect(liquid.vel[1]).toBeCloseTo(-9.8 * 0.01, 5);
    liquid.n = 2;
    liquid.pos.set([0, 0, 0, 0.1, 0, 0]);
    liquid.vel.set([1, 0, 0, -1, 0, 0]);
    liquid.neighbors(2);
    const viscosity = LIQUIDS[preset].viscosity,
      a = 1 - Math.exp(-0.01 * (4 + 900 * viscosity ** 2));
    const passes = viscosity > 0.5 ? 3 : viscosity > 0.2 ? 2 : 1;
    let expected = 1;
    for (let p = 0; p < passes; p++) expected = Math.fround(expected * (1 - 2 * a));
    liquid.viscous(2, 0.01);
    expect(liquid.vel[0]).toBeCloseTo(expected, 6);
    expect(liquid.vel[3]).toBeCloseTo(-expected, 6);
  }
});

test("half adder: actual fixed animation gives carry 1, sum 0, then resets", () => {
  const out = output();
  ai.RECIPES["half-adder"].drive(0, { go: 1 - 2.5 / 3.5 }, out);
  expect(out.parts.lampA.visible).toBe(1);
  expect(out.parts.lampB.visible).toBe(1);
  expect(out.parts.sumLamp.visible).toBe(0);
  expect(out.parts.carryLamp.visible).toBe(1);
  ai.RECIPES["half-adder"].drive(0, { go: 0 }, out);
  expect(out.parts.carryLamp.visible).toBe(0);
});

test("browser: production half-adder output agrees with the arithmetic", async ({ page }) => {
  await page.goto("/manual/");
  const actual = await page.evaluate(async () => {
    const { RECIPES } = await import("/src/packs/computing.js");
    const out = { parts: {}, tokens: [], cues: [] };
    RECIPES["half-adder"].drive(0, { go: 1 - 2.5 / 3.5 }, out);
    return { sum: out.parts.sumLamp.visible, carry: out.parts.carryLamp.visible };
  });
  expect(actual).toEqual({ sum: 0, carry: 1 });
});

test("evidence: exact schema, complete shelf inventory, source and test locations resolve", async () => {
  const { TOYS } = await import("../src/toys.js");
  const toys = TOYS.filter((t) => ["computing", "lab"].includes(t.category));
  expect(toys).toHaveLength(19);
  for (const toy of toys) {
    const evidence = JSON.parse(await read(`docs/evidence/${toy.id}.json`));
    expect(Object.keys(evidence).sort()).toEqual(
      ["toy", "checked", "summary", "claims", "simplified", "fixes"].sort(),
    );
    expect(evidence.toy).toBe(toy.id);
    expect(evidence.checked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(evidence.claims.length).toBeGreaterThan(0);
    for (const repair of evidence.fixes) {
      expect(Object.keys(repair).sort()).toEqual(["what", "where", "status"].sort());
      expect(repair.status).toMatch(/^(proposed|fixed in #\d+)$/);
    }
    for (const claim of evidence.claims) {
      expect(Object.keys(claim).sort()).toEqual(
        ["claim", "how", "where", "sources", "verdict", "test", "note"].sort(),
      );
      expect(["correct", "close", "simplified", "wrong", "unverified"]).toContain(claim.verdict);
      if (claim.verdict !== "unverified") expect(claim.sources.length).toBeGreaterThan(0);
      for (const source of claim.sources) {
        expect(Object.keys(source).sort()).toEqual(["title", "publisher", "url", "says"].sort());
        expect(source.url).toMatch(/^https:\/\//);
      }
      for (const location of [claim.where, claim.test].filter(Boolean)) {
        const [path, line] = location.split(":");
        const lines = (await read(path)).split("\n");
        expect(Number(line)).toBeGreaterThan(0);
        expect(Number(line)).toBeLessThanOrEqual(lines.length);
        if (path.startsWith("tests/")) expect(lines[Number(line) - 1]).toMatch(/^test\(/);
      }
      if (claim.verdict === "wrong") expect(evidence.fixes.length).toBeGreaterThan(0);
      if (claim.verdict === "simplified") expect(evidence.simplified.length).toBeGreaterThan(0);
    }
    // Required test filenames are location metadata, not checker identity.
    const prose = JSON.stringify(evidence, (key, value) =>
      ["where", "test"].includes(key) ? undefined : value,
    );
    expect(prose).not.toMatch(/\b(Codex|Claude|GPT|agent|Playwright)\b/i);
  }
});
