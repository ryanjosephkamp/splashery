// node concepts/specimen/verify.mjs
// The detail nobody asked for, checked exhaustively: every coarser splat on the page keeps the
// mass, center and covariance of the finer splats beneath it.

import { neuron, buildTree, moments, level, hodgkinHuxley, threshold, DEPTH } from './specimen.js';

const { leaves, parts } = neuron();
const tree = buildTree(leaves);
let worst = 0;
let checks = 0;
const far = (a, b) => {
  let d = Math.abs(a.w - b.w);
  for (let k = 0; k < 3; k += 1) d = Math.max(d, Math.abs(a.m[k] - b.m[k]));
  for (let k = 0; k < 6; k += 1) d = Math.max(d, Math.abs(a.S[k] - b.S[k]));
  return d;
};

if (leaves.length !== 2 ** DEPTH) throw new Error(`expected ${2 ** DEPTH} leaves, got ${leaves.length}`);

// 1. Every merged splat, against all the leaves underneath it.
const under = (i) => (i >= leaves.length ? [tree.nodes[i]] : [...under(2 * i), ...under(2 * i + 1)]);
for (let i = 1; i < leaves.length; i += 1) {
  worst = Math.max(worst, far(tree.nodes[i], moments(under(i))));
  checks += 1;
}
const merges = checks;

// 2. Every level, taken whole, against the finest.
const finest = moments(leaves);
for (let L = 0; L <= DEPTH; L += 1) {
  const here = level(tree, L);
  if (here.length !== 2 ** L) throw new Error(`level ${L} holds ${here.length} splats`);
  worst = Math.max(worst, far(moments(here), finest));
  checks += 1;
}

// 3. Every covariance is a real one: symmetric by construction, and positive definite.
// Every splat's four stain shares still add up to one.
for (let i = 1; i < tree.nodes.length; i += 1) {
  const [xx, yy, zz, xy, xz, yz] = tree.nodes[i].S;
  const det = xx * (yy * zz - yz * yz) - xy * (xy * zz - yz * xz) + xz * (xy * yz - yy * xz);
  if (!(xx > 0 && xx * yy - xy * xy > 0 && det > 0)) throw new Error(`node ${i} is not positive definite`);
  if (Math.abs(tree.nodes[i].k.reduce((a, b) => a + b, 0) - 1) > 1e-12) throw new Error(`node ${i} lost stain`);
  checks += 1;
}

if (worst > 1e-12) throw new Error(`moments drift by ${worst}`);

// 4. Every label picks out at least one splat, and no splat answers to two labels.
const answers = (part, s) => s.delay >= part.range[0] && s.delay <= part.range[1] && s.k.some((v, i) => v > 0 && part.mask[i]);
for (const part of parts) if (!leaves.some((s) => answers(part, s))) throw new Error(`nothing is labeled ${part.id}`);
for (const s of leaves) if (parts.filter((part) => answers(part, s)).length > 1) throw new Error('a splat has two labels');

// 5. The membrane rests, fires on the pulse the page uses, and does nothing much below threshold.
const hh = hodgkinHuxley();
const least = threshold();
if (!(hh.peak > 20 && hh.peak < 50 && hh.trough < -70 && hh.trough > -77)) throw new Error(`implausible spike: ${hh.peak}, ${hh.trough}`);
if (Math.abs(hodgkinHuxley({ current: 0 }).peak - -65) > 0.05) throw new Error('the membrane does not rest at −65 mV');
if (hodgkinHuxley({ current: least - 0.02 }).peak > 0) throw new Error('fires below its threshold');
if (hodgkinHuxley({ current: least }).peak < 0) throw new Error('does not fire at its threshold');

console.log(`ok · ${leaves.length} splats · ${merges} merges, ${DEPTH + 1} levels, ${checks} checks · largest drift ${worst.toExponential(2)}`);
console.log(`center ${finest.m.map((v) => v.toFixed(12)).join(', ')} · σ ${finest.S.slice(0, 3).map((v) => Math.sqrt(v).toFixed(6)).join(', ')}`);
console.log(`spike: rest ${hh.rest} mV, peak ${hh.peak.toFixed(1)} mV, undershoot ${hh.trough.toFixed(1)} mV, threshold ${least.toFixed(2)} µA/cm² for 1 ms`);
