// MIT. Independent JS sort is the ordering oracle; no GPU or runtime edits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { HEAP_SORT_SRC, heapSortSegment, comparePairs, segmentCapacity } from './heapsort.mjs';
let randomState = 0x5a88c0de;
const random = () => { randomState ^= randomState << 13; randomState ^= randomState >>> 17; randomState ^= randomState << 5; return randomState >>> 0; };
const counts = [0, 1, 2, 3, 7, 16, 17, 31, 32, 33, 255, 256, 257, 1023, 1024, 1025, 2047, 2048, 2049, 3001, 4095, 4096, 4097];
for (let i = 0; i < 180; i++) counts.push(random() % 4200);
let cases = 0, checkedPairs = 0;
for (const count of counts) for (let pattern = 0; pattern < 5; pattern++) {
  const capacity = segmentCapacity(count), base = 11, entries = new Uint32Array((base + capacity + 13) * 2);
  entries.fill(0xcafebabe);
  const pairs = Array.from({ length: count }, (_, i) => pattern === 0 ? [random(), random()] : pattern === 1 ? [Math.floor(i / 3), count - i] : pattern === 2 ? [count - i, i] : pattern === 3 ? [0x80000000, random() % 7] : [[0, 0x7fffffff, 0x80000000, 0xffffffff][i % 4], [0xffffffff, 0, 0x80000000][i % 3]]);
  for (let i = 0; i < count; i++) entries.set(pairs[i], 2 * (base + i));
  const expected = entries.slice(), sorted = pairs.map(p => p.slice()).sort(comparePairs);
  for (let i = 0; i < count; i++) expected.set(sorted[i], 2 * (base + i));
  expected.fill(0xffffffff, 2 * (base + count), 2 * (base + capacity));
  heapSortSegment(entries, base, count, capacity);
  assert.deepEqual(entries, expected, `count=${count}, pattern=${pattern}`);
  cases++; checkedPairs += count;
}
// Neighbor segments, including empty and singleton, must remain disjoint.
const counts2 = [0, 1, 2, 2049, 0, 7, 4097, 1], capacities = counts2.map(segmentCapacity), starts = [0];
for (const c of capacities) starts.push(starts.at(-1) + c);
const entries = Uint32Array.from({ length: (starts.at(-1) + 9) * 2 }, random), expected = entries.slice();
for (let t = 0; t < counts2.length; t++) {
  const pairs = Array.from({ length: counts2[t] }, (_, i) => Array.from(entries.slice(2 * (starts[t] + i), 2 * (starts[t] + i + 1)))).sort(comparePairs);
  for (let i = 0; i < pairs.length; i++) expected.set(pairs[i], 2 * (starts[t] + i));
  expected.fill(0xffffffff, 2 * (starts[t] + counts2[t]), 2 * starts[t + 1]);
  heapSortSegment(entries, starts[t], counts2[t], capacities[t]);
}
assert.deepEqual(entries, expected);
assert.throws(() => heapSortSegment(new Uint32Array(4), 0, 3, 2), /Invalid/);
const report = { status: 'passed', cases: cases + 1, checkedPairs, patterns: ['random u32', 'equal-depth/reverse-id ties', 'reversed depth', 'duplicate pairs', 'signed-boundary/sentinel keys'], counts, neighborSegments: counts2, checkedSentinelPadding: true, checkedPrefixSuffixCanaries: true, shaderSha256: createHash('sha256').update(HEAP_SORT_SRC).digest('hex'), note: 'CPU mirror property checks are not GPU shader execution proof.' };
fs.writeFileSync(new URL('./cpu-proof.json', import.meta.url), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
fs.writeFileSync(new URL('./heapsort.wgsl', import.meta.url), HEAP_SORT_SRC, { flag: 'wx' });
console.log(JSON.stringify({ ...report, counts: undefined }, null, 2));
