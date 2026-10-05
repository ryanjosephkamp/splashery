// Lane Computing r2: the proof that the sorting machine is right. Every step
// of every algorithm (each comparison, each swap or move and the arrangement
// after it) is checked against reference code written separately here, on
// every arrangement of up to 6 values, on random lists with and without
// equal values, and on the edge cases (empty, one value, sorted, reversed,
// all equal). Then the toy itself: the counter it shows, where its pieces
// stand after each step in every view, that solid pieces never pass through
// each other, and that each comparison and swap sounds once, in the
// algorithm's own voice, at the bars' notes.

import { test, expect } from "@playwright/test";
import { buildRecipe } from "../src/kit.js";
import { RECIPES, SORTING } from "../src/packs/computing.js";
import { VOICES } from "../src/voices.js";

const { run, ALGOS, VOICES: SORT_VOICES, SORT, VIEWS, RING } = SORTING;

// ---- Reference code ------------------------------------------------------------------
// Each algorithm as a textbook writes it, on its own list, writing down the
// pair of values each comparison looks at and the list after each change.
// It shares nothing with the toy's code (src/packs/computing.js, sortRun).
function reference(algo, input) {
  const a = [...input];
  const log = { compared: [], frames: [] };
  const greater = (x, y) => {
    log.compared.push([x, y]);
    return x > y;
  };
  const exchange = (i, j) => {
    if (i === j) return;
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
    log.frames.push([...a]);
  };
  const n = a.length;
  if (algo === "bubble") {
    let end = n - 1;
    while (end > 0) {
      for (let i = 0; i < end; i++) if (greater(a[i], a[i + 1])) exchange(i, i + 1);
      end--;
    }
  } else if (algo === "quick") {
    // Lomuto's partition; the left part first, with an explicit stack.
    const stack = [[0, n - 1]];
    while (stack.length) {
      const [lo, hi] = stack.pop();
      if (lo >= hi) continue;
      const pivot = a[hi];
      let store = lo;
      for (let j = lo; j < hi; j++) {
        log.compared.push([a[j], pivot]);
        if (a[j] < pivot) exchange(store++, j);
      }
      exchange(store, hi);
      stack.push([store + 1, hi], [lo, store - 1]);
    }
  } else if (algo === "merge") {
    // Bottom-up merge sort that merges in place by rotation: when the right
    // run's head is smaller, it is lifted out and put in front of the left
    // run's head (the left run's bars shift one place over).
    for (let width = 1; width < n; width *= 2)
      for (let left = 0; left + width < n; left += 2 * width) {
        let l = left;
        let r = left + width;
        const end = Math.min(left + 2 * width, n);
        while (l < r && r < end) {
          if (greater(a[l], a[r])) {
            const v = a[r];
            for (let q = r; q > l; q--) a[q] = a[q - 1];
            a[l] = v;
            log.frames.push([...a]);
            r++;
          }
          l++;
        }
      }
  } else if (algo === "insertion") {
    for (let i = 1; i < n; i++) {
      let j = i;
      while (j > 0 && greater(a[j - 1], a[j])) {
        exchange(j - 1, j);
        j--;
      }
    }
  } else if (algo === "selection") {
    for (let i = 0; i + 1 < n; i++) {
      let min = i;
      for (let j = i + 1; j < n; j++) {
        log.compared.push([a[j], a[min]]);
        if (a[j] < a[min]) min = j;
      }
      exchange(i, min);
    }
  } else if (algo === "cocktail") {
    let lo = 0;
    let hi = n - 1;
    while (lo < hi) {
      for (let i = lo; i < hi; i++) if (greater(a[i], a[i + 1])) exchange(i, i + 1);
      hi--;
      for (let i = hi; i > lo; i--) if (greater(a[i - 1], a[i])) exchange(i - 1, i);
      lo++;
    }
  } else if (algo === "shell") {
    for (const gap of [4, 2, 1])
      for (let i = gap; i < n; i++) {
        let j = i;
        while (j >= gap && greater(a[j - gap], a[j])) {
          exchange(j - gap, j);
          j -= gap;
        }
      }
  } else if (algo === "heap") {
    // Sift-down written recursively (the toy's is a loop).
    const siftDown = (i, size) => {
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      let big = i;
      if (l < size && greater(a[l], a[big])) big = l;
      if (r < size && greater(a[r], a[big])) big = r;
      if (big !== i) {
        exchange(i, big);
        siftDown(big, size);
      }
    };
    for (let i = (n >> 1) - 1; i >= 0; i--) siftDown(i, n);
    for (let size = n - 1; size > 0; size--) {
      exchange(0, size);
      siftDown(0, size);
    }
  } else throw new Error(algo);
  return { ...log, sorted: a };
}

// Pairs out of order: the swaps bubble, insertion and cocktail sort make.
const inversions = (a) => {
  let k = 0;
  for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) k++;
  return k;
};

function* permutations(list) {
  if (list.length <= 1) {
    yield list.slice();
    return;
  }
  for (let i = 0; i < list.length; i++)
    for (const p of permutations([...list.slice(0, i), ...list.slice(i + 1)]))
      yield [list[i], ...p];
}

// A seeded random source, so a failure can be repeated.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function inputs() {
  const out = [[], [1], [5, 2, 7, 0, 6, 3, 1, 4]];
  for (let n = 2; n <= 6; n++) for (const p of permutations([...Array(n).keys()])) out.push(p);
  for (const n of [2, 7, 8, 13, 16, 31, 40]) {
    const up = [...Array(n).keys()];
    out.push(
      up,
      up.slice().reverse(),
      Array(n).fill(3),
      up.map((v) => v % 2),
    );
  }
  const rand = rng(20261005);
  for (let k = 0; k < 400; k++) {
    const n = Math.floor(rand() * 41);
    const range = k % 2 ? 4 : 1000; // with and without many equal values
    out.push(Array.from({ length: n }, () => Math.floor(rand() * range)));
  }
  return out;
}

test("every step of every algorithm matches the reference code", () => {
  const all = inputs();
  expect(all.length).toBeGreaterThan(1300);
  for (const algo of ALGOS) {
    for (const input of all) {
      const got = run(algo, input);
      const ref = reference(algo, input);
      const tag = `${algo} [${input.join(",")}]`;
      // The same comparisons, of the same values, in the same order.
      const compared = got.events.filter((e) => e.op === "compare").map((e) => e.vals);
      expect(compared, tag).toEqual(ref.compared);
      expect(got.compares, tag).toBe(ref.compared.length);
      // The same arrangement after every swap or move.
      expect(got.frames, tag).toEqual(ref.frames);
      expect(got.swaps, tag).toBe(ref.frames.length);
      // Sorted, and the same values.
      const sorted = input.slice().sort((x, y) => x - y);
      expect(got.sorted, tag).toEqual(sorted);
      expect(ref.sorted, tag).toEqual(sorted);
      // Each recorded swap or move turns the arrangement before it into the
      // one after it, and nothing else changes.
      let now = input.slice();
      let f = 0;
      for (const e of got.events) {
        if (e.op === "compare") {
          expect([now[e.i], now[e.j]], tag).toEqual(e.vals);
          continue;
        }
        if (e.op === "swap") {
          expect([now[e.i], now[e.j]], tag).toEqual(e.vals);
          [now[e.i], now[e.j]] = [now[e.j], now[e.i]];
        } else {
          expect(algo, tag).toBe("merge");
          expect(e.j, tag).toBeLessThan(e.i);
          const [v] = now.splice(e.i, 1);
          now.splice(e.j, 0, v);
        }
        expect(now, tag).toEqual(got.frames[f++]);
      }
      expect(f, tag).toBe(got.frames.length);
    }
  }
});

test("the counts agree with what is known about each algorithm", () => {
  for (const input of inputs()) {
    const n = input.length;
    const half = (n * (n - 1)) / 2;
    const inv = inversions(input);
    const r = Object.fromEntries(ALGOS.map((a) => [a, run(a, input)]));
    // Bubble, insertion and cocktail sort swap only neighbors that are out
    // of order: one swap per inversion. So does merge sort, a move across
    // k bars putting k inversions right... counted as one move here, so its
    // moves are at most the inversions.
    expect(r.bubble.swaps).toBe(inv);
    expect(r.insertion.swaps).toBe(inv);
    expect(r.cocktail.swaps).toBe(inv);
    expect(r.merge.swaps).toBeLessThanOrEqual(inv);
    // Bubble sort and selection sort compare every pair once.
    expect(r.bubble.compares).toBe(half);
    expect(r.selection.compares).toBe(half);
    // Insertion sort: one comparison per inversion, plus at most one that
    // stops each bar.
    expect(r.insertion.compares).toBeGreaterThanOrEqual(inv);
    expect(r.insertion.compares).toBeLessThanOrEqual(inv + Math.max(0, n - 1));
    // Selection sort swaps at most n - 1 times.
    expect(r.selection.swaps).toBeLessThanOrEqual(Math.max(0, n - 1));
    // Already sorted: nothing to swap or move (heap sort still builds its
    // heap, quicksort still compares).
    if (inv === 0)
      for (const a of ["bubble", "merge", "insertion", "selection", "cocktail", "shell"])
        expect(r[a].swaps, a).toBe(0);
  }
});

test("the toy's eight bars: the same steps as the reference, and its counts", () => {
  // These are the counts the machine shows on its counter for the bars
  // 5 2 7 0 6 3 1 4, from the reference code (for the evidence file).
  const counts = {};
  for (const algo of ALGOS) {
    const ref = reference(algo, SORT.start);
    expect(SORT.steps[algo], algo).toEqual(ref.frames);
    counts[algo] = [ref.frames.length, ref.compared.length];
  }
  expect(counts).toEqual({
    bubble: [16, 28],
    quick: [10, 17],
    merge: [10, 14],
    insertion: [16, 22],
    selection: [6, 28],
    cocktail: [16, 25],
    shell: [10, 21],
    heap: [18, 28],
  });
});

// ---- The toy -------------------------------------------------------------------------

function build(options = {}) {
  const r = RECIPES["sorting-machine"];
  const opts = Object.fromEntries((r.options || []).map((o) => [o.key, o.default]));
  Object.assign(opts, options);
  const it = buildRecipe(r, { seed: 5, count: 6000, options: opts }, () => {});
  let b = it.next();
  while (!b.done) b = it.next();
  return b.value.kit;
}

// Plays one tap at `fps` frames a second; returns every frame's output.
function play(kit, fps = 60) {
  const r = RECIPES["sorting-machine"];
  const frames = [];
  for (let s = 0; s <= 5; s += 1 / fps) {
    const out = { parts: {}, glow: [1, 1, 1, 0], amount: 1, cues: [], fx: {}, tokens: null };
    r.drive(s, { go: Math.max(0.0004, 1 - s / 5) }, out, { time: s, R: 1, tap: { n: 1 }, data: kit.data }); // prettier-ignore
    frames.push({ s, out });
  }
  return frames;
}

const SEGS = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"]; // prettier-ignore
const digit = (tokens, at) => {
  const lit = "abcdefg"
    .split("")
    .filter((_, i) => tokens[at + i].visible)
    .join("");
  return lit ? SEGS.indexOf(lit) : -1;
};
const counter = (tokens) => Math.max(0, digit(tokens, 8)) * 10 + digit(tokens, 15);

test("the counter shows every swap or move, and every view follows the steps", () => {
  for (const view of Object.keys(VIEWS))
    for (const algo of ALGOS) {
      const kit = build({ algo, view });
      expect(kit.data.view).toBe(view);
      const steps = SORT.steps[algo];
      const n = steps.length;
      const dt = Math.min(0.34, (SORT.t1 - SORT.t0) / n);
      const frames = play(kit);
      const at = (s) => frames.reduce((best, f) => (Math.abs(f.s - s) < Math.abs(best.s - s) ? f : best)); // prettier-ignore
      const V = VIEWS[view];
      // After each step (the pieces have landed, just before the next one
      // starts), each piece stands where that step's arrangement puts it,
      // and the counter shows the steps so far.
      for (let i = 1; i <= n; i++) {
        const f = at(SORT.t0 + i * dt - 0.02).out;
        expect(counter(f.tokens), `${view} ${algo} step ${i}`).toBe(i);
        for (let v = 0; v < 8; v++) {
          const home = V.at(v, SORT.start.indexOf(v));
          const want = V.at(v, steps[i - 1].indexOf(v));
          const got = f.tokens[v].offset.map((d, j) => d + home[j]);
          for (let j = 0; j < 3; j++) expect(got[j]).toBeCloseTo(want[j], 3);
        }
      }
      // At rest before and after: the counter reads 0 and every piece is home.
      const end = frames[frames.length - 1].out;
      expect(counter(end.tokens)).toBe(0);
      for (let v = 0; v < 8; v++) for (const d of end.tokens[v].offset) expect(d).toBeCloseTo(0, 3);
    }
});

// Where every piece is at time s, in the view's own place.
const places = (view, f) =>
  f.tokens.slice(0, 8).map((t, v) => {
    const home = VIEWS[view].at(v, SORT.start.indexOf(v));
    return t.offset.map((d, j) => d + home[j]);
  });

test("crates and pucks are solid: none passes through another, at any moment", () => {
  for (const algo of ALGOS) {
    // Crates: cubes as big as their values, standing on the plinth.
    let frames = play(build({ algo, view: "crates" }), 120);
    const size = (v) => 0.1 + 0.02 * v;
    for (const { s, out } of frames) {
      const p = places("crates", out);
      for (let a = 0; a < 8; a++)
        for (let b = a + 1; b < 8; b++) {
          const reach = (size(a) + size(b)) / 2;
          const ya = p[a][1] + size(a) / 2;
          const yb = p[b][1] + size(b) / 2;
          const apart = Math.abs(p[a][0] - p[b][0]) >= reach - 1e-6 || Math.abs(p[a][2] - p[b][2]) >= reach - 1e-6 || Math.abs(ya - yb) >= reach - 1e-6; // prettier-ignore
          expect(apart, `crates ${algo} ${a}/${b} at ${s.toFixed(3)} s`).toBe(true);
        }
    }
    // Pucks: upright cylinders on the turntable.
    frames = play(build({ algo, view: "ring" }), 120);
    const { puck, h } = RING;
    for (const { s, out } of frames) {
      const p = places("ring", out);
      for (let a = 0; a < 8; a++)
        for (let b = a + 1; b < 8; b++) {
          const apart = Math.hypot(p[a][0] - p[b][0], p[a][2] - p[b][2]) >= 2 * puck - 1e-6 || Math.abs(p[a][1] - p[b][1]) >= h - 1e-6; // prettier-ignore
          expect(apart, `ring ${algo} ${a}/${b} at ${s.toFixed(3)} s`).toBe(true);
        }
    }
  }
});

test("each comparison and each swap sounds once, in the algorithm's own voice", () => {
  const voices = new Set();
  for (const algo of ALGOS) {
    const kit = build({ algo });
    const steps = run(algo, SORT.start);
    const frames = play(kit, 30);
    const notes = frames.flatMap((f) => (f.out.cues || []).flat());
    const sv = SORT_VOICES[algo];
    voices.add(sv.voice);
    expect(VOICES[sv.voice], algo).toBeTruthy();
    for (const spec of notes) expect(spec.voice, algo).toBe(sv.voice);
    const name = (v) => `${"CDEFGABC"[v]}${4 + sv.up + (v === 7 ? 1 : 0)}`;
    // Comparisons: soft, the two compared bars' notes together.
    const soft = notes.filter((x) => String(x.notes).includes("+"));
    expect(
      soft.map((x) => x.notes),
      algo,
    ).toEqual(
      steps.events.filter((e) => e.op === "compare").map((e) => `${name(e.vals[0])}+${name(e.vals[1])}`), // prettier-ignore
    );
    // Swaps (or moves): loud, the note of the bar that moves right (or the
    // bar that moves), one each.
    const loud = notes.filter((x) => !String(x.notes).includes("+") && !String(x.notes).includes(" ")); // prettier-ignore
    expect(
      loud.map((x) => x.notes),
      algo,
    ).toEqual(
      steps.events
        .filter((e) => e.op !== "compare")
        .map((e) => name(e.op === "move" ? e.vals[0] : Math.max(...e.vals))),
    );
    for (const x of soft) expect(x.vol).toBeLessThan(loud[0].vol);
    // Then the sorted bars' scale, once.
    expect(notes.filter((x) => String(x.notes).includes(" ")).length, algo).toBe(1);
    // Cues come at most every 60 ms (the site drops closer ones).
    const sent = frames.filter((f) => f.out.cues?.length).map((f) => f.s);
    for (let i = 1; i < sent.length; i++) expect(sent[i] - sent[i - 1]).toBeGreaterThan(0.06);
  }
  // Eight algorithms, eight voices; the tap itself is quiet.
  expect(voices.size).toBe(8);
  expect(RECIPES["sorting-machine"].action.quiet).toEqual(["go"]);
});
