// MIT. Made by Ryan with Codex (GPT-6). Real pipeline/session, simulated finishing I/O; no GPU.
import { test, expect } from "@playwright/test";

async function setup(page, mode) {
  await page.route("**/tests/fixtures/v3d/", (route) =>
    route.fulfill({ contentType: "text/html", body: "<!doctype html>" }),
  );
  await page.route("**/src/video3d/extract.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export const openVideo=async()=>({duration:1,width:16,height:16});
      export const grabFrames=async()=>[0,.3,.6].map(time=>({time,blob:new Blob(['photo'])}));
      export const closeVideo=()=>{};`,
    }),
  );
  await page.route("**/src/video3d/surface-seed.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: "export const surfaceSeed=()=>({n:0,data:new Float32Array(0)});",
    }),
  );
  await page.route("**/vendor/splatjs/src/session.js", async (route) => {
    const response = await route.fetch(),
      source = await response.text(),
      factory = "export function createSession(opts = {}) { return new Session(opts); }";
    expect(source.split(factory)).toHaveLength(2);
    await route.fulfill({
      response,
      body: source.replace(
        factory,
        "export function createSession(opts = {}) { return globalThis.makeRecoverySession(opts, Session); }",
      ),
    });
  });
  await page.goto("/tests/fixtures/v3d/");
  await page.clock.install();
  await page.evaluate((mode) => {
    Object.defineProperty(navigator, "gpu", {
      configurable: true,
      value: { requestAdapter: async () => ({ info: { description: "fixture adapter" } }) },
    });
    window.exportCalls = 0;
    window.cleanupCalls = 0;
    window.fitCleaned = false;
    window.makeRecoverySession = (opts, Session) => {
      const session = new Session(opts),
        R = [1, 0, 0, 0, 1, 0, 0, 0, 1],
        cameras = [0, 1, 2].map((imgIdx) => ({
          imgIdx,
          R,
          t: [imgIdx * 0.1, 0, 0],
          f: 12,
          w: 16,
          h: 16,
        }));
      session.load = async (files) => {
        session.frames = files.map((f) => ({ name: f.name, fw: 16, fh: 16 }));
      };
      session.solve = async () => ({ cams: cameras, points: [] });
      session.seed = async () => {
        session.holdout = 1;
        session.trainer = {
          camMeta: cameras,
          n: 3,
          iter: 7,
          dispose() {
            window.cleanupCalls++;
          },
          async fitBackground({ signal }) {
            window.fitSignal = signal;
            try {
              if (mode === "deadline") {
                await new Promise((_, reject) =>
                  signal.addEventListener(
                    "abort",
                    () => reject(new DOMException("Stopped", "AbortError")),
                    { once: true },
                  ),
                );
              }
              if (mode === "late")
                await new Promise((resolve) => (window.releaseLateFit = resolve));
              if (mode === "lost") session._lost = true;
              if (mode === "training-error")
                session._trainingFailure = {
                  trainer: session.trainer,
                  error: new Error("training failure"),
                };
              if (["failed", "lost", "training-error", "export-failed"].includes(mode))
                throw new Error("fit readback failed");
              return {
                accepted: ["accepted", "late"].includes(mode),
                reason: "fixture",
                rgb: [0.2, 0.3, 0.4],
              };
            } finally {
              window.fitCleaned = true;
            }
          },
        };
        return { n: 3, radius: 1 };
      };
      session.start = () =>
        queueMicrotask(() => session._em.emit("event", { kind: "train-complete" }));
      session.exportPlyBlob = () =>
        session._locked(async () => {
          if (!window.fitCleaned) throw new Error("Export raced the finishing readback");
          window.exportCalls++;
          if (mode === "export-failed") throw new Error("Model export failed");
          return new Blob([Uint8Array.of(0, 255, 17, 128, 3)]);
        });
      return session;
    };
    window.pendingBake = import("/src/video3d/run.js")
      .then(({ videoTo3D }) => videoTo3D(new File(["fixture"], "fixture.mp4"), { tier: "phone" }))
      .then(
        (r) => ({ ply: Array.from(r.ply), stats: r.stats, log: r.log }),
        (e) => ({ error: e.message }),
      )
      .then((result) => {
        window.bakeSettled = true;
        return result;
      });
  }, mode);
  await expect.poll(() => page.evaluate(() => !!window.fitSignal)).toBe(true);
}

for (const mode of ["failed", "deadline"]) {
  test(`optional background ${mode} keeps the completed model after releasing its readback`, async ({
    page,
  }) => {
    await setup(page, mode);
    if (mode === "deadline") await page.clock.runFor(60001);
    const r = await page.evaluate(() => window.pendingBake);
    expect(r.error).toBeUndefined();
    expect(r.ply).toEqual([0, 255, 17, 128, 3]);
    expect(r.stats.trainingBackground).toEqual([0, 0, 0]);
    expect(r.stats.renderBackground).toBeUndefined();
    expect(r.stats.backgroundFit.accepted).toBe(false);
    expect(r.stats.backgroundFit.reason).toBe("fit-unavailable");
    expect(r.log.join("\n")).toMatch(/background.*keeping.*trained model/i);
    expect(
      await page.evaluate(() => [window.exportCalls, window.cleanupCalls, window.fitCleaned]),
    ).toEqual([1, 1, true]);
    if (mode === "deadline") expect(await page.evaluate(() => window.fitSignal.aborted)).toBe(true);
  });
}

for (const mode of ["accepted", "rejected"]) {
  test(`a timely ${mode} background keeps its original validation decision`, async ({ page }) => {
    await setup(page, mode);
    const r = await page.evaluate(() => window.pendingBake);
    expect(r.error).toBeUndefined();
    expect(r.ply).toEqual([0, 255, 17, 128, 3]);
    expect(r.stats.backgroundFit.accepted).toBe(mode === "accepted");
    expect(r.stats.renderBackground).toEqual(mode === "accepted" ? [0.2, 0.3, 0.4] : undefined);
    expect(r.stats.trainingBackground).toEqual([0, 0, 0]);
    expect(await page.evaluate(() => [window.exportCalls, window.cleanupCalls])).toEqual([1, 1]);
  });
}

test("a late fit releases the export lock but cannot revive its discarded display color", async ({
  page,
}) => {
  await setup(page, "late");
  await page.clock.runFor(60001);
  expect(
    await page.evaluate(() => [window.exportCalls, window.fitCleaned, window.bakeSettled]),
  ).toEqual([0, false, undefined]);
  await page.evaluate(() => window.releaseLateFit());
  const r = await page.evaluate(() => window.pendingBake);
  expect(r.error).toBeUndefined();
  expect(r.ply).toEqual([0, 255, 17, 128, 3]);
  expect(r.stats.renderBackground).toBeUndefined();
  expect(r.stats.backgroundFit).toMatchObject({ accepted: false, reason: "fit-unavailable" });
  expect(
    await page.evaluate(() => [window.exportCalls, window.cleanupCalls, window.fitSignal.aborted]),
  ).toEqual([1, 1, true]);
});

test("optional fit recovery cannot turn a failed model export into success", async ({ page }) => {
  await setup(page, "export-failed");
  const r = await page.evaluate(() => window.pendingBake);
  expect(r.error).toBe("Model export failed");
  expect(r.ply).toBeUndefined();
  expect(await page.evaluate(() => [window.exportCalls, window.cleanupCalls])).toEqual([1, 1]);
});

for (const mode of ["lost", "training-error"]) {
  test(`background recovery cannot publish a model after ${mode}`, async ({ page }) => {
    await setup(page, mode);
    const r = await page.evaluate(() => window.pendingBake);
    expect(r.error).toMatch(/graphics card.*shorter stretch/i);
    expect(r.ply).toBeUndefined();
    expect(await page.evaluate(() => [window.exportCalls, window.cleanupCalls])).toEqual([0, 1]);
  });
}
