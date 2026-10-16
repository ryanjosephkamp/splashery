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
    window.__detailOriginalWorker = OriginalWorker;
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
  await page.evaluate(async () => {
    window.Worker = window.__detailOriginalWorker;
    const { app, qrCraft } = window.__splashery;
    delete qrCraft.detailBudgetMs;
    await app.setToyOptions({ fidelity: "detail", text: "https://example.org/resumed-detail" });
  });
  await page.waitForFunction(() => {
    const { app, qrCraft } = window.__splashery,
      p = qrCraft.picture();
    return (
      !app.busy &&
      !p.checking &&
      p.woven?.fidelity === "detail" &&
      p.check?.stress?.ok &&
      !app.player.stage.coverDepth
    );
  });
  expect(
    await page.evaluate(() => {
      const p = window.__splashery.qrCraft.picture();
      return { notice: p.notice, fallback: p.fallback };
    }),
  ).toEqual({ notice: "", fallback: null });
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
          stageOK: p.check?.stage?.every((s) => s.ok) || false,
        };
      });
      expect(state).toMatchObject({ fidelity: "standard", text });
      expect(state.checkedSizes).toEqual([8, 4]);
      expect(state.stageOK).toBe(true);
      expect(state.hasToy).toBe(true);
      expect(state.notice).toMatch(/Most detail.*Standard/);
      expect(Date.now() - started).toBeLessThan(35000);
    });

// Standard may finish after the detail decision; its recorded elapsed time
// establishes the 20-second bound independently of the final stage scan.
for (const shape of ["square", "circle"])
  test(`A near-limit ${shape} link leaves Most detail within its bound and actually scans`, async ({
    page,
  }) => {
    test.setTimeout(120000);
    await open(page);
    const limit = Number(await page.locator("#qrc-text").getAttribute("maxlength"));
    expect(limit).toBe(300);
    const prefix = "https://example.org/?q=";
    const text = prefix + "a".repeat(limit - 1 - prefix.length);
    expect(text).toHaveLength(limit - 1);
    await page.evaluate(
      ({ text, shape }) => {
        const { app } = window.__splashery;
        window.__nearLimitStarted = performance.now();
        window.__nearLimitRequest = app.setToyOptions({
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
        window.__nearLimitRequest.catch(() => {});
      },
      { text, shape },
    );
    await page.waitForFunction(
      (text) => {
        const p = window.__splashery.qrCraft.picture();
        return (
          p.fallback?.text === text ||
          (p.options?.text === text &&
            p.woven?.fidelity === "detail" &&
            p.check?.stress?.ok === true &&
            !p.checking)
        );
      },
      text,
      { timeout: 60000 },
    );
    const decision = await page.evaluate(() => {
      const p = window.__splashery.qrCraft.picture();
      return { fallback: p.fallback, elapsed: performance.now() - window.__nearLimitStarted };
    });
    expect(decision.fallback?.elapsedMs ?? decision.elapsed).toBeLessThan(20000);
    await page.waitForFunction(
      (text) => {
        const { app, qrCraft } = window.__splashery,
          p = qrCraft.picture();
        return (
          !app.busy &&
          p.options?.text === text &&
          !p.checking &&
          (p.check?.stage?.length === 2 || p.error?.includes("Standard could not build")) &&
          !app.player.stage.coverDepth
        );
      },
      text,
      { timeout: 35000 },
    );
    const result = await page.evaluate(async () => {
      await window.__nearLimitRequest;
      const { app, qrCraft } = window.__splashery,
        p = qrCraft.picture();
      const { shapeHalf } = await import("/src/qr/circle.js");
      return {
        text: p.woven?.code.text,
        fidelity: p.options.fidelity,
        check: p.check,
        notice: p.notice,
        error: p.error,
        shot: qrCraft.lastShot(),
        modules: p.woven ? 2 * (shapeHalf(p.woven.code, p.options.shape) + 1) : null,
        cover: app.player.stage.coverDepth,
        version: p.woven?.code.version,
      };
    });
    if (result.shot)
      await test.info().attach("near-limit-code", {
        body: Buffer.from(result.shot.split(",")[1], "base64"),
        contentType: "image/png",
      });
    expect(result.text).toBe(text);
    expect(result.check?.text).toBe(text);
    expect(result.check?.ok).toBe(true);
    expect(result.check.stage.map((s) => ({ ppm: s.ppm, ok: s.ok }))).toEqual([
      { ppm: 8, ok: true },
      { ppm: 4, ok: true },
    ]);
    expect(result.cover).toBe(0);
    if (decision.fallback) {
      expect(result.fidelity).toBe("standard");
      expect(result.notice).toMatch(/Most detail.*Standard/);
    }
    const { PNG } = await import("pngjs");
    const { read } = await import("../tools/qrc-picture.mjs");
    const { readZxingCpp } = await import("../tools/qrs-study/readers.mjs");
    const { resize } = await import("../tools/qr-scan-lab/sim.mjs");
    const { gaussBlur } = await import("../src/qr-craft/picture.js");
    const png = PNG.sync.read(Buffer.from(result.shot.split(",")[1], "base64"));
    for (const ppm of [8, 4]) {
      const sampled = resize(png, Math.round(result.modules * ppm));
      for (const blur of [0, 0.2, 0.3]) {
        const image = { ...sampled, data: new Uint8ClampedArray(sampled.data) };
        if (blur) gaussBlur(image.data, image.width, image.height, blur * ppm);
        expect(read(image.data, image.width, image.height), `jsQR ${ppm} ppm blur ${blur}`).toBe(
          text,
        );
        expect(await readZxingCpp(image), `zxing-cpp ${ppm} ppm blur ${blur}`).toBe(text);
      }
    }
  });

test("An impossible plain Standard fallback clears the old payload and releases its cover", async ({
  page,
}) => {
  await open(page);
  const text = "https://example.org/?q=" + "a".repeat(277);
  await page.evaluate(async (text) => {
    const { RECIPES } = await import("/src/packs/qr-craft.js");
    const recipe = RECIPES["qr-picture"],
      original = recipe.splatLimit;
    recipe.splatLimit = (options, budget) =>
      options.simpleFallback ? 1000 : original.call(recipe, options, budget);
    await window.__splashery.app.setToyOptions({
      text,
      picture: "ai-farm",
      shape: "circle",
      fidelity: "detail",
      style: "color",
      level: "H",
      size: "more",
    });
  }, text);
  await page.waitForFunction(
    (text) => {
      const { app, qrCraft } = window.__splashery,
        p = qrCraft.picture();
      return (
        !app.busy &&
        p.options?.text === text &&
        p.error?.includes("Standard could not build") &&
        !app.player.stage.coverDepth
      );
    },
    text,
    { timeout: 15000 },
  );
  expect(
    await page.evaluate(() => {
      const { app, qrCraft } = window.__splashery,
        p = qrCraft.picture();
      return {
        woven: p.woven,
        check: p.check,
        hasToy: !!app.player.stage.toy,
        checking: p.checking,
        cover: app.player.stage.coverDepth,
      };
    }),
  ).toEqual({ woven: null, check: null, hasToy: false, checking: false, cover: 0 });
});

test("Choosing Color after a plain fallback restores the picture and requested code size", async ({
  page,
}) => {
  await open(page);
  await page.evaluate(async () => {
    await window.__splashery.app.setToyOptions({
      text: "https://example.org/picture-again",
      picture: "ai-farm",
      shape: "square",
      fidelity: "standard",
      style: "color",
      size: "fit",
      level: "H",
      simpleFallback: true,
    });
  });
  const state = await page.evaluate(() => {
    const p = window.__splashery.qrCraft.picture();
    return {
      version: p.woven.code.version,
      hasPictureColor: p.woven.cells.some((value) => value > 0.15 && value < 0.9),
    };
  });
  expect(state.version).toBeLessThan(18);
  expect(state.hasPictureColor).toBe(true);
});
