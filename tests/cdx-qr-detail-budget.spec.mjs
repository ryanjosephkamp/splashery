import { test, expect } from "@playwright/test";

test("Canceling stalled detail workers aborts without restarting their checks locally", async () => {
  const { validateCapture, cancelDetailChecks } = await import("../src/qr-craft/scan-pool.js");
  const previous = globalThis.Worker;
  let terminated = 0,
    reads = 0,
    posted = 0;
  globalThis.Worker = class {
    postMessage() {
      posted++;
    }
    terminate() {
      terminated++;
    }
  };
  try {
    const image = { width: 64, height: 64, data: new Uint8ClampedArray(64 * 64 * 4).fill(255) };
    const work = validateCapture(image, 8, "cancel-me", () => {
      reads++;
      return "cancel-me";
    });
    const rejected = expect(work).rejects.toMatchObject({ name: "AbortError" });
    cancelDetailChecks();
    await rejected;
    expect(posted).toBe(4);
    expect(terminated).toBe(4);
    expect(reads).toBe(0);
  } finally {
    cancelDetailChecks();
    globalThis.Worker = previous;
  }
});

async function open(page) {
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "hardwareConcurrency", { get: () => 4 }),
  );
  await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async () => {
    await window.__splashery.app.chooseToy("qr-picture");
  });
}

test("A stalled Most detail worker falls back to Standard and cannot restore the unfinished code", async ({
  page,
}) => {
  await open(page);
  const text = "https://example.org/detail-time-budget";
  await page.evaluate((text) => {
    const { app, qrCraft } = window.__splashery;
    const OriginalWorker = window.Worker;
    window.__blockedDetailJobs = 0;
    window.Worker = class extends OriginalWorker {
      constructor(url, options) {
        super(url, options);
        if (String(url).includes("/qr-craft/scan-worker.js"))
          this.postMessage = () => window.__blockedDetailJobs++;
      }
    };
    qrCraft.detailBudgetMs = 800;
    window.__detailRequest = app.setToyOptions({
      text,
      picture: "ai-farm",
      shape: "square",
      fidelity: "detail",
      level: "H",
      size: "more",
      center: "small",
      contrast: 0.5,
      style: "color",
    });
    window.__detailRequest.catch(() => {});
  }, text);
  await page.waitForFunction(
    (text) => {
      const { app, qrCraft } = window.__splashery,
        p = qrCraft.picture();
      return (
        !app.busy &&
        p.options?.text === text &&
        p.options.fidelity === "standard" &&
        p.woven?.fidelity !== "detail" &&
        !p.checking &&
        p.check?.stage?.length === 2 &&
        !app.player.stage.coverDepth
      );
    },
    text,
    { timeout: 12000 },
  );
  const state = await page.evaluate(async () => {
    await window.__detailRequest;
    await new Promise((resolve) => setTimeout(resolve, 200));
    const p = window.__splashery.qrCraft.picture();
    return {
      fidelity: p.options.fidelity,
      text: p.woven.code.text,
      notice: p.notice,
      blocked: window.__blockedDetailJobs,
    };
  });
  expect(state).toMatchObject({ fidelity: "standard", text });
  expect(state.blocked).toBeGreaterThan(0);
  expect(state.notice).toMatch(/Most detail.*Standard/);
});

test("A replaced stalled detail request releases its workers without replacing the new toy", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(() => {
    const { app, qrCraft } = window.__splashery;
    const OriginalWorker = window.Worker;
    window.__blockedDetailJobs = 0;
    window.__terminatedDetailWorkers = 0;
    window.Worker = class extends OriginalWorker {
      constructor(url, options) {
        super(url, options);
        this.detail = String(url).includes("/qr-craft/scan-worker.js");
        if (this.detail) this.postMessage = () => window.__blockedDetailJobs++;
      }
      terminate() {
        if (this.detail) window.__terminatedDetailWorkers++;
        super.terminate();
      }
    };
    qrCraft.detailBudgetMs = 1500;
    app.setToyOptions({ text: "https://example.org/replaced", fidelity: "detail" }).finally(() => {
      window.__oldDetailFinished = true;
    });
  });
  await page.waitForFunction(() => window.__blockedDetailJobs > 0);
  await page.evaluate(() => {
    window.__splashery.app.chooseToy("qr-code").finally(() => {
      window.__newToyFinished = true;
    });
  });
  await page.waitForFunction(
    () =>
      window.__oldDetailFinished &&
      window.__newToyFinished &&
      window.__terminatedDetailWorkers > 0 &&
      !window.__splashery.app.busy,
    null,
    { timeout: 8000 },
  );
  expect(await page.evaluate(() => window.__splashery.app.player.toyInfo.id)).toBe("qr-code");
});

for (const length of [170, 270])
  for (const shape of ["square", "circle"])
    test(`A ${length}-character ${shape} link selects the bounded Standard fallback`, async ({
      page,
    }) => {
      test.setTimeout(90000);
      await open(page);
      const prefix = "https://example.org/?q=",
        text = prefix + "a".repeat(length - prefix.length);
      const started = Date.now();
      await page.evaluate(
        async ({ text, shape }) => {
          await window.__splashery.app.setToyOptions({
            text,
            shape,
            picture: "ai-farm",
            fidelity: "detail",
            level: "H",
            size: "more",
            center: "small",
            contrast: 0.5,
            style: "color",
          });
        },
        { text, shape },
      );
      await page.waitForFunction(
        (text) => {
          const { app, qrCraft } = window.__splashery,
            p = qrCraft.picture();
          return (
            !app.busy &&
            p.options?.text === text &&
            p.options.fidelity === "standard" &&
            !p.checking &&
            (p.check?.stage?.length === 2 || p.error?.includes("Standard could not build")) &&
            !app.player.stage.coverDepth
          );
        },
        text,
        { timeout: 35000 },
      );
      const state = await page.evaluate(() => {
        const p = window.__splashery.qrCraft.picture();
        return {
          fidelity: p.options.fidelity,
          text: p.woven?.code.text || p.options.text,
          notice: p.notice,
          error: p.error,
          hasToy: !!window.__splashery.app.player.stage.toy,
          checkedSizes: p.check?.stage?.map((s) => s.ppm) || [],
        };
      });
      expect(state).toMatchObject({ fidelity: "standard", text });
      if (shape === "square") expect(state.checkedSizes).toEqual([8, 4]);
      else
        expect(state).toMatchObject({
          hasToy: false,
          error: "Standard could not build this code on this device. Try Square or a shorter text.",
        });
      expect(state.notice).toMatch(/Most detail.*Standard/);
      expect(Date.now() - started).toBeLessThan(35000);
    });
