import { test, expect } from "@playwright/test";
import { makeWoven } from "../src/qr-craft/picture.js";
import { validateDetail, cancelDetailChecks } from "../src/qr-craft/scan-pool.js";

test("Model retries remember distinct failures and every accepted model still runs the full matrix", async () => {
  const original = globalThis.Worker;
  const calls = [[], [], [], [], []];
  let phase = 1;
  const failureA = { ppm: 8, blur: 0.2, view: 2 };
  const failureB = { ppm: 4, blur: 0.3, view: 5 };
  const same = (a, b) => a.ppm === b.ppm && a.blur === b.blur && a.view === b.view;
  cancelDetailChecks();
  globalThis.Worker = class {
    postMessage(job) {
      if (job.dual)
        calls[phase].push(job.frames.map(({ ppm, blur, view }) => ({ ppm, blur, view })));
      const target = phase === 2 ? failureB : phase === 4 ? null : failureA;
      const failed = job.dual && target && job.frames.find((frame) => same(frame, target));
      queueMicrotask(() =>
        this.onmessage({
          data: {
            id: job.id,
            result: failed
              ? { ok: false, ppm: failed.ppm, blur: failed.blur, view: failed.view }
              : { ok: true },
          },
        }),
      );
    }
    terminate() {}
  };
  try {
    const picture = { w: 24, h: 24, data: new Float32Array(24 * 24 * 3).fill(0.5) };
    const w = makeWoven(picture, {
      text: "https://example.org/retry",
      fidelity: "detail",
      shape: "circle",
      level: "H",
      size: "fit",
      style: "color",
      center: "small",
      contrast: 0.5,
      preferContinuous: true,
      texture: "tiles",
      channel: "weighted",
    });
    const read = () => w.code.text;
    expect(await validateDetail(w, picture, "circle", read)).toMatchObject({
      ok: false,
      ...failureA,
    });
    phase = 2;
    expect(await validateDetail(w, picture, "circle", read)).toMatchObject({
      ok: false,
      ...failureB,
    });
    phase = 3;
    expect(await validateDetail(w, picture, "circle", read)).toMatchObject({
      ok: false,
      ...failureA,
    });
    expect(calls[3].every((frames) => frames.length === 1)).toBe(true);
    expect(calls[3].flat().some((frame) => same(frame, failureA))).toBe(true);
    phase = 4;
    expect(await validateDetail(w, picture, "circle", read)).toMatchObject({ ok: true });
    const complete = calls[4].filter((frames) => frames.length > 1).flat();
    expect(new Set(complete.map(({ ppm, blur, view }) => `${ppm}/${blur}/${view}`)).size).toBe(24);
  } finally {
    cancelDetailChecks();
    globalThis.Worker = original;
  }
});
