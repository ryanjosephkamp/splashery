#!/usr/bin/env node
// Trains the convolutional network toy's small CNN (lane AI) on the UCI
// "Optical Recognition of Handwritten Digits" set (E. Alpaydin and C. Kaynak,
// 1998; CC BY 4.0, https://archive.ics.uci.edu/dataset/80): 8 x 8 digits,
// each pixel 0..16. Plain JavaScript, no dependencies, seeded, so it trains
// the same everywhere.
//
//   mkdir -p .cache/digits && cd .cache/digits
//   curl -L -o d.zip "https://archive.ics.uci.edu/static/public/80/optical+recognition+of+handwritten+digits.zip"
//   unzip d.zip && cd ../..
//   node tools/cnn-train.mjs
//
// The network: conv 3 x 3 (4 filters, padding 1) + ReLU, 2 x 2 max pool,
// conv 3 x 3 (8 filters, padding 1) + ReLU, 2 x 2 max pool, then a dense
// layer to the 10 digits (softmax). Writes src/packs/computing-cnn.js: the
// weights, one sample digit of each class from the test set, and the test
// accuracy.

import fs from "node:fs";

const read = (f) =>
  fs
    .readFileSync(f, "utf8")
    .trim()
    .split("\n")
    .map((l) => l.split(",").map(Number))
    .map((v) => ({ x: v.slice(0, 64).map((p) => p / 16), y: v[64] }));
const train = read(".cache/digits/optdigits.tra");
const test = read(".cache/digits/optdigits.tes");

let seed = 12345;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());

// Shapes: images are [channels][y][x] flattened as c * S * S + y * S + x.
const C1 = 4;
const C2 = 8;
const net = {
  w1: Array.from({ length: C1 * 9 }, () => gauss() * Math.sqrt(2 / 9)),
  b1: new Array(C1).fill(0),
  w2: Array.from({ length: C2 * C1 * 9 }, () => gauss() * Math.sqrt(2 / (9 * C1))),
  b2: new Array(C2).fill(0),
  w3: Array.from({ length: 10 * C2 * 4 }, () => gauss() * Math.sqrt(1 / (C2 * 4))),
  b3: new Array(10).fill(0),
};

function conv(inp, cin, S, w, b, cout) {
  const out = new Float64Array(cout * S * S);
  for (let o = 0; o < cout; o++)
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        let v = b[o];
        for (let c = 0; c < cin; c++)
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const yy = y + dy;
              const xx = x + dx;
              if (yy < 0 || xx < 0 || yy >= S || xx >= S) continue;
              v += w[((o * cin + c) * 3 + dy + 1) * 3 + dx + 1] * inp[c * S * S + yy * S + xx];
            }
        out[o * S * S + y * S + x] = v;
      }
  return out;
}
const relu = (a) => a.map((v) => (v > 0 ? v : 0));
function pool(inp, c, S) {
  const H = S / 2;
  const out = new Float64Array(c * H * H);
  const arg = new Int32Array(c * H * H);
  for (let k = 0; k < c; k++)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < H; x++) {
        let best = -Infinity;
        let bi = 0;
        for (let dy = 0; dy < 2; dy++)
          for (let dx = 0; dx < 2; dx++) {
            const i = k * S * S + (2 * y + dy) * S + 2 * x + dx;
            if (inp[i] > best) ((best = inp[i]), (bi = i));
          }
        out[k * H * H + y * H + x] = best;
        arg[k * H * H + y * H + x] = bi;
      }
  return { out, arg };
}
function forward(x) {
  const z1 = conv(x, 1, 8, net.w1, net.b1, C1);
  const a1 = relu(z1);
  const p1 = pool(a1, C1, 8);
  const z2 = conv(p1.out, C1, 4, net.w2, net.b2, C2);
  const a2 = relu(z2);
  const p2 = pool(a2, C2, 4);
  const z3 = new Float64Array(10);
  for (let o = 0; o < 10; o++) {
    let v = net.b3[o];
    for (let i = 0; i < C2 * 4; i++) v += net.w3[o * C2 * 4 + i] * p2.out[i];
    z3[o] = v;
  }
  const m = Math.max(...z3);
  const e = z3.map((v) => Math.exp(v - m));
  const s = e.reduce((a, b) => a + b, 0);
  return { z1, a1, p1, z2, a2, p2, prob: e.map((v) => v / s) };
}
// The gradient of the conv's input and weights, given the output gradient.
function convBack(inp, cin, S, w, cout, g, gw, gb) {
  const gi = new Float64Array(cin * S * S);
  for (let o = 0; o < cout; o++)
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const go = g[o * S * S + y * S + x];
        if (!go) continue;
        gb[o] += go;
        for (let c = 0; c < cin; c++)
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              const yy = y + dy;
              const xx = x + dx;
              if (yy < 0 || xx < 0 || yy >= S || xx >= S) continue;
              const wi = ((o * cin + c) * 3 + dy + 1) * 3 + dx + 1;
              gw[wi] += go * inp[c * S * S + yy * S + xx];
              gi[c * S * S + yy * S + xx] += go * w[wi];
            }
      }
  return gi;
}
function step(batch, lr) {
  const g = Object.fromEntries(
    Object.entries(net).map(([k, v]) => [k, new Float64Array(v.length)]),
  );
  for (const { x, y } of batch) {
    const f = forward(x);
    const g3 = f.prob.map((p, i) => p - (i === y ? 1 : 0));
    const gp2 = new Float64Array(C2 * 4);
    for (let o = 0; o < 10; o++) {
      g.b3[o] += g3[o];
      for (let i = 0; i < C2 * 4; i++) {
        g.w3[o * C2 * 4 + i] += g3[o] * f.p2.out[i];
        gp2[i] += g3[o] * net.w3[o * C2 * 4 + i];
      }
    }
    const ga2 = new Float64Array(C2 * 16);
    f.p2.arg.forEach((ai, i) => (ga2[ai] += gp2[i]));
    const gz2 = ga2.map((v, i) => (f.z2[i] > 0 ? v : 0));
    const gp1 = convBack(f.p1.out, C1, 4, net.w2, C2, gz2, g.w2, g.b2);
    const ga1 = new Float64Array(C1 * 64);
    f.p1.arg.forEach((ai, i) => (ga1[ai] += gp1[i]));
    const gz1 = ga1.map((v, i) => (f.z1[i] > 0 ? v : 0));
    convBack(x, 1, 8, net.w1, C1, gz1, g.w1, g.b1);
  }
  for (const k of Object.keys(net))
    for (let i = 0; i < net[k].length; i++) net[k][i] -= (lr * g[k][i]) / batch.length;
}
const accuracy = (set) => set.filter((d) => forward(d.x).prob.indexOf(Math.max(...forward(d.x).prob)) === d.y).length / set.length; // prettier-ignore

const order = train.map((_, i) => i);
for (let epoch = 0; epoch < 25; epoch++) {
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const lr = 0.08 * Math.pow(0.9, epoch);
  for (let i = 0; i < order.length; i += 16)
    step(
      order.slice(i, i + 16).map((j) => train[j]),
      lr,
    );
  if (epoch % 5 === 4)
    console.log(`epoch ${epoch + 1}: test accuracy ${(accuracy(test) * 100).toFixed(1)}%`);
}
const acc = accuracy(test);
// One well-recognized sample of each digit from the test set.
const samples = [];
for (let d = 0; d < 10; d++) {
  const s = test.find((t) => t.y === d && forward(t.x).prob[d] > 0.9);
  samples.push(s.x.map((v) => Math.round(v * 16)));
}
const round = (a) => Array.from(a, (v) => Math.round(v * 1e4) / 1e4);
const out = `// Generated by tools/cnn-train.mjs; do not edit. The convolutional network
// toy's small CNN, trained on the UCI Optical Recognition of Handwritten
// Digits set (E. Alpaydin and C. Kaynak, 1998; CC BY 4.0). Test accuracy:
// ${(acc * 100).toFixed(1)}% on its 1,797 test digits.

export const CNN_NET = ${JSON.stringify(Object.fromEntries(Object.entries(net).map(([k, v]) => [k, round(v)])))};
export const CNN_ACCURACY = ${acc.toFixed(4)};
// One test digit of each class (0 to 9), 8 x 8 pixels, 0..16.
export const CNN_SAMPLES = ${JSON.stringify(samples)};
`;
fs.writeFileSync("src/packs/computing-cnn.js", out);
console.log(`test accuracy ${(acc * 100).toFixed(1)}% -> src/packs/computing-cnn.js`);
