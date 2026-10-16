// MIT. Made by Ryan with Codex (GPT-6). Exact matcher output and real event-loop cancellation.
import { test, expect } from "@playwright/test";
import { matchSift, matchSiftAsync } from "../vendor/splatjs/src/sfm/sift.js";

function descriptors(n, seed = 17) {
  return Uint8Array.from({ length: n * 128 }, () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed >>> 24;
  });
}

test("cooperative matching preserves every legacy match, tie, ratio, and input byte", async () => {
  for (const [nA, nB] of [
    [0, 0],
    [0, 1],
    [1, 0],
    [1, 1],
    [63, 65],
    [65, 129],
    [129, 131],
  ]) {
    for (const kind of ["random", "copies", "ties", "extremes"]) {
      const a = descriptors(nA),
        b = descriptors(nB, 91);
      if (kind === "copies")
        for (let i = 0; i < Math.min(nA, nB); i += 3)
          b.set(a.subarray(i * 128, (i + 1) * 128), i * 128);
      if (kind === "ties") {
        a.fill(42);
        b.fill(42);
      }
      if (kind === "extremes") {
        a.fill(0);
        b.fill(255);
      }
      const originalA = a.slice(),
        originalB = b.slice();
      for (const ratio of [0.5, 0.8, 1])
        expect(await matchSiftAsync(a, nA, b, nB, ratio)).toEqual(matchSift(a, nA, b, nB, ratio));
      expect(a).toEqual(originalA);
      expect(b).toEqual(originalB);
    }
  }
});

test("an already canceled match never reads a descriptor", async () => {
  const caller = new AbortController();
  caller.abort();
  const unreadable = new Proxy([], {
    get() {
      throw new Error("Canceled matching read an input");
    },
  });
  await expect(
    matchSiftAsync(unreadable, 100, unreadable, 100, 0.8, { signal: caller.signal }),
  ).rejects.toMatchObject({ name: "AbortError" });
});

test("a busy match yields to a timer and stops without publishing partial matches", async () => {
  const caller = new AbortController();
  const a = descriptors(1024),
    b = descriptors(1024, 91);
  let timerRan = false;
  const timer = setTimeout(() => {
    timerRan = true;
    caller.abort();
  }, 0);
  try {
    await expect(
      matchSiftAsync(a, 1024, b, 1024, 0.8, { signal: caller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(timerRan).toBe(true);
  } finally {
    clearTimeout(timer);
  }
});

test("cooperative CPU output equals actual WebGPU output across workgroup boundaries", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/v3d/");
  const result = await page.evaluate(async () => {
    const { matchSift, matchSiftAsync } = await import("/vendor/splatjs/src/sfm/sift.js");
    const { gpuMatchAll } = await import("/vendor/splatjs/src/sfm/gpumatch.js");
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) throw new Error("The matcher regression requires an actual WebGPU adapter");
    const device = await adapter.requestDevice();
    let seed = 17;
    const make = (n) => ({
      n,
      desc: Uint8Array.from({ length: n * 128 }, () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed >>> 24;
      }),
    });
    try {
      const feats = [make(1), make(63), make(65), make(129)];
      for (let f = 1; f < feats.length; f++)
        for (let i = 0; i < Math.min(feats[0].n, feats[f].n); i++)
          feats[f].desc.set(feats[0].desc.subarray(i * 128, (i + 1) * 128), i * 128);
      const pairs = [
        [0, 1],
        [1, 2],
        [2, 3],
        [0, 3],
      ];
      const gpu = await gpuMatchAll(feats, pairs, 0.8, () => {}, device, null, {
        maxPairsPerChunk: 2,
      });
      const cpu = await Promise.all(
        pairs.map(([i, j]) => matchSiftAsync(feats[i].desc, feats[i].n, feats[j].desc, feats[j].n)),
      );
      const legacy = pairs.map(([i, j]) =>
        matchSift(feats[i].desc, feats[i].n, feats[j].desc, feats[j].n),
      );
      return { gpu, cpu, legacy };
    } finally {
      device.destroy();
    }
  });
  expect(result.cpu).toEqual(result.legacy);
  expect(result.cpu).toEqual(result.gpu);
});

test("browser matching yields to an actual cancel timer before it can publish results", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/v3d/");
  const result = await page.evaluate(async () => {
    const { matchSiftAsync } = await import("/vendor/splatjs/src/sfm/sift.js");
    const caller = new AbortController();
    let seed = 17,
      timerRan = false,
      published = false,
      error = null;
    const make = () =>
      Uint8Array.from({ length: 1024 * 128 }, () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return seed >>> 24;
      });
    const a = make(),
      b = make();
    const timer = setTimeout(() => {
      timerRan = true;
      caller.abort();
    }, 0);
    try {
      await matchSiftAsync(a, 1024, b, 1024, 0.8, { signal: caller.signal });
      published = true;
    } catch (e) {
      error = e.name;
    } finally {
      clearTimeout(timer);
    }
    return { timerRan, published, error };
  });
  expect(result).toEqual({ timerRan: true, published: false, error: "AbortError" });
});
