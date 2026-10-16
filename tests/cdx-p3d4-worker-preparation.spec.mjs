import { test, expect } from "@playwright/test";

test("worker preparation preserves the full result and an obsolete color token falls back to the new picture", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const result = await page.evaluate(async () => {
    const worker = new Worker("/src/photo3d/build-worker.js", { type: "module" }),
      pending = new Map();
    let id = 0;
    worker.onmessage = ({ data }) => {
      const p = pending.get(data.id);
      if (!p) return;
      pending.delete(data.id);
      if (data.error) p.reject(new Error(data.error));
      else p.resolve(data.result || data);
    };
    const send = (data) =>
      new Promise((resolve, reject) => {
        const key = ++id;
        pending.set(key, { resolve, reject });
        worker.postMessage({ ...data, id: key });
      });
    const photo = {
        w: 96,
        h: 80,
        data: Uint8Array.from({ length: 96 * 80 * 4 }, (_, i) =>
          i % 4 === 3 ? 255 : (Math.imul(i + 11, 1664525) >>> 13) & 255,
        ),
      },
      depth = {
        w: 28,
        h: 28,
        d: Float32Array.from({ length: 784 }, (_, i) => 1 + Math.sin(i * 0.13)),
      },
      options = { count: 2500, depth: 1, keepFlat: true, bitmap: false };
    const differences = (a, b, path = "") => {
      if (ArrayBuffer.isView(a)) {
        if (
          a.constructor !== b.constructor ||
          a.length !== b.length ||
          a.some((v, i) => v !== b[i])
        )
          return [path];
        return [];
      }
      if (a && typeof a === "object")
        return Object.keys(a).flatMap((k) => differences(a[k], b[k], path + "." + k));
      return a === b ? [] : [path];
    };
    try {
      const warm = await send({
        type: "colors",
        photo,
        options: { count: 2500, depthWidth: 28, depthHeight: 28 },
      });
      const cached = await send({
          photo,
          depth,
          options: { ...options, colorKey: warm.id },
          cells: 1500,
        }),
        direct = await send({ photo, depth, options, cells: 1500 });
      const newer = { ...photo, data: Uint8Array.from(photo.data, (v) => 255 - v) };
      await send({
        type: "colors",
        photo: newer,
        options: { count: 2500, depthWidth: 28, depthHeight: 28 },
      });
      const stale = await send({
        photo,
        depth,
        options: { ...options, colorKey: warm.id },
        cells: 1500,
      });
      return {
        ready: warm.precomputed,
        cached: differences(cached, direct),
        stale: differences(stale, direct),
      };
    } finally {
      worker.terminate();
    }
  });
  expect(result).toEqual({ ready: true, cached: [], stale: [] });
});
