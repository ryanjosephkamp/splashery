// node concepts/one-splat/verify.mjs
//
// Exhaustive checks for fit.js, on point sets with the shapes letters have
// (bars, rings, diagonals, dust) and on the degenerate ones (a line, a grid,
// one point).
//
// 1. Every split conserves mass, mean and covariance (law of total covariance).
// 2. Every node's stored moments equal a brute-force recomputation from the
//    points it owns.
// 3. Every split is a median split along the principal axis: nothing in the
//    lower half projects past anything in the upper half, and the halves
//    differ in size by at most one.
// 4. Every level covers the whole set once, with no empty node.
// 5. eig() and covariance() undo each other.
// 6. The worst split checkTree() reports is the worst one, and it is where
//    checkTree() says it is.
// 7. The conservation holds however a set is divided, not only at the median:
//    straight cuts at any angle and position, and divisions with no shape at
//    all, where every point goes either way at random.

import assert from 'node:assert/strict';
import { buildTree, checkTree, checkSplit, moments, node, eig, covariance, PIXEL } from './fit.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHAPES = {
  bar: (u, v) => [u * 900, v * 40],
  ring: (u, v) => [Math.cos(u * 6.2831853) * (200 + v * 30), Math.sin(u * 6.2831853) * (200 + v * 30)],
  diagonal: (u, v) => [u * 500 + v * 30, u * 500 - v * 30],
  dust: (u, v) => [u * 1000, v * 1000],
  islands: (u, v) => [(u < 0.5 ? 0 : 800) + v * 60, ((u * 977) % 1) * 60],
  line: (u) => [Math.floor(u * 300) + 0.5, 0.5],
  grid: (u, v, i) => [(i % 64) + 0.5, Math.floor(i / 64) + 0.5],
  point: () => [3.5, 7.5],
};

let trees = 0;
let splits = 0;
let nodes = 0;
let worst = 0;

for (const [name, at] of Object.entries(SHAPES)) {
  for (const count of [1, 2, 3, 7, 64, 1000, 4096, 50000]) {
    for (const maxLevel of [0, 1, 5, 14]) {
      const rand = mulberry32(count * 31 + maxLevel);
      const xs = new Float32Array(count);
      const ys = new Float32Array(count);
      for (let i = 0; i < count; i += 1) [xs[i], ys[i]] = at(rand(), rand(), i);
      const tree = buildTree(xs, ys, maxLevel);
      const label = `${name} n=${count} L=${maxLevel}`;

      const check = checkTree(tree);
      assert.equal(check.splits, tree.size / 2 - 1, `${label}: split count`);
      assert.ok(check.worst < 1e-9, `${label}: residual ${check.worst}`);
      worst = Math.max(worst, check.worst);
      splits += check.splits;
      trees += 1;

      let worstHere = 0;
      let whereHere = 0;
      for (let i = 1; i < tree.size / 2; i += 1) {
        const { residual } = checkSplit(node(tree, i), node(tree, 2 * i), node(tree, 2 * i + 1));
        if (!whereHere || residual > worstHere) {
          worstHere = residual;
          whereHere = i;
        }
      }
      assert.equal(check.worst, worstHere, `${label}: worst residual`);
      assert.equal(check.at, whereHere, `${label}: where the worst residual is`);

      for (let i = 1; i < tree.size; i += 1) {
        const s = tree.lo[i];
        const e = tree.hi[i];
        const n = e - s;
        assert.ok(n > 0, `${label}: node ${i} is empty`);
        assert.equal(tree.n[i], n, `${label}: count at node ${i}`);
        let ux = 0;
        let uy = 0;
        for (let k = s; k < e; k += 1) {
          ux += xs[tree.idx[k]];
          uy += ys[tree.idx[k]];
        }
        ux /= n;
        uy /= n;
        let a = 0;
        let b = 0;
        let c = 0;
        for (let k = s; k < e; k += 1) {
          const dx = xs[tree.idx[k]] - ux;
          const dy = ys[tree.idx[k]] - uy;
          a += dx * dx;
          b += dx * dy;
          c += dy * dy;
        }
        a = a / n + PIXEL;
        c = c / n + PIXEL;
        b /= n;
        const scale = a + c;
        assert.ok(Math.abs(tree.mx[i] - ux) <= 1e-9 * Math.sqrt(scale), `${label}: mean x at ${i}`);
        assert.ok(Math.abs(tree.my[i] - uy) <= 1e-9 * Math.sqrt(scale), `${label}: mean y at ${i}`);
        assert.ok(Math.abs(tree.a[i] - a) <= 1e-9 * scale, `${label}: a at ${i}`);
        assert.ok(Math.abs(tree.b[i] - b) <= 1e-9 * scale, `${label}: b at ${i}`);
        assert.ok(Math.abs(tree.c[i] - c) <= 1e-9 * scale, `${label}: c at ${i}`);
        nodes += 1;

        if (2 * i + 1 < tree.size) {
          const l = 2 * i;
          const r = l + 1;
          assert.equal(tree.lo[l], s, `${label}: left start at ${i}`);
          assert.equal(tree.hi[l], tree.lo[r], `${label}: halves meet at ${i}`);
          assert.equal(tree.hi[r], e, `${label}: right end at ${i}`);
          assert.ok(Math.abs(tree.n[l] - tree.n[r]) <= 1, `${label}: balance at ${i}`);
          const theta = 0.5 * Math.atan2(2 * tree.b[i], tree.a[i] - tree.c[i]);
          const vx = Math.cos(theta);
          const vy = Math.sin(theta);
          const proj = (k) =>
            Math.fround((xs[tree.idx[k]] - tree.mx[i]) * vx + (ys[tree.idx[k]] - tree.my[i]) * vy);
          let maxLeft = -Infinity;
          let minRight = Infinity;
          for (let k = tree.lo[l]; k < tree.hi[l]; k += 1) maxLeft = Math.max(maxLeft, proj(k));
          for (let k = tree.lo[r]; k < tree.hi[r]; k += 1) minRight = Math.min(minRight, proj(k));
          assert.ok(maxLeft <= minRight, `${label}: split order at ${i}`);
        }
      }

      for (let level = 0; level <= tree.levels; level += 1) {
        const seen = new Uint8Array(count);
        for (let i = 2 ** level; i < 2 ** (level + 1); i += 1) {
          for (let k = tree.lo[i]; k < tree.hi[i]; k += 1) seen[tree.idx[k]] += 1;
        }
        assert.ok(seen.every((v) => v === 1), `${label}: level ${level} is not a partition`);
      }
    }
  }
}

let divisions = 0;
let worstDivision = 0;
for (const [name, at] of Object.entries(SHAPES)) {
  for (const count of [2, 3, 7, 64, 1000, 4096, 50000]) {
    const rand = mulberry32(count * 131 + name.length);
    const xs = new Float32Array(count);
    const ys = new Float32Array(count);
    const all = new Uint32Array(count);
    for (let i = 0; i < count; i += 1) {
      [xs[i], ys[i]] = at(rand(), rand(), i);
      all[i] = i;
    }
    const whole = moments(xs, ys, all, 0, count);
    const order = new Uint32Array(count);
    for (let trial = 0; trial < 200; trial += 1) {
      // Even trials cut straight through a point of the set, at any angle.
      // Odd trials send each point either way at random.
      const angle = rand() * Math.PI;
      const vx = Math.cos(angle);
      const vy = Math.sin(angle);
      const through = Math.floor(rand() * count);
      const threshold = xs[through] * vx + ys[through] * vy;
      const share = rand();
      let first = 0;
      let last = count;
      for (let i = 0; i < count; i += 1) {
        const before = trial % 2 ? rand() < share : xs[i] * vx + ys[i] * vy < threshold;
        if (before) {
          order[first] = i;
          first += 1;
        } else {
          last -= 1;
          order[last] = i;
        }
      }
      first = Math.min(Math.max(first, 1), count - 1); // neither half may be empty
      const left = moments(xs, ys, order, 0, first);
      const right = moments(xs, ys, order, first, count);
      const { residual, sum } = checkSplit(whole, left, right);
      assert.equal(sum.n, count, `${name} n=${count}: division ${trial} loses points`);
      assert.ok(residual < 1e-9, `${name} n=${count}: division ${trial} residual ${residual}`);
      worstDivision = Math.max(worstDivision, residual);
      divisions += 1;
    }
  }
}

let round = 0;
for (let s1 = 0.5; s1 <= 300; s1 *= 1.7) {
  for (let s2 = 0.25; s2 < s1 * 0.99; s2 *= 1.9) {
    for (let deg = -89; deg <= 89; deg += 7) {
      const theta = (deg * Math.PI) / 180;
      const { a, b, c } = covariance(s1, s2, theta);
      const e = eig(a, b, c);
      assert.ok(Math.abs(Math.sqrt(e.l1) - s1) < 1e-9 * s1, 'major axis');
      assert.ok(Math.abs(Math.sqrt(e.l2) - s2) < 1e-6 * s1, 'minor axis');
      assert.ok(Math.abs(e.theta - theta) < 1e-6, 'angle');
      round += 1;
    }
  }
}

console.log(`${trees} trees, ${splits.toLocaleString('en-US')} splits conserve mass, mean and covariance`);
console.log(`worst residual ${worst.toExponential(2)}`);
console.log(`${nodes.toLocaleString('en-US')} nodes match a brute-force recomputation`);
console.log(`${divisions.toLocaleString('en-US')} other divisions (straight cuts and random ones) conserve them too, worst residual ${worstDivision.toExponential(2)}`);
console.log(`${round} covariance round trips`);
