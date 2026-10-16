// MIT. Made by Ryan with Codex (GPT-6). Real pipeline, simulated slow session stages.
import { test, expect } from "@playwright/test";

test.use({
  launchOptions: {
    executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
    args: ["--disable-gpu"],
  },
});

async function slowPipeline(page, { tier, stop = false, slowStage = "all" }) {
  await page.route("**/src/video3d/extract.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export const openVideo=async()=>({duration:8}), closeVideo=()=>{};
        export const grabFrames=async()=>[0,1,2].map(time=>({time,blob:new Blob(['picture'])}));`,
    }),
  );
  await page.route("**/vendor/splatjs/src/session.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export function createSession() {
        const events = new Map();
        const cam = imgIdx => ({imgIdx, R:[1,0,0,0,1,0,0,0,1], t:[0,0,0], f:4, w:4, h:4});
        const cams = [0,1,2].map(cam);
        const advance = (stage, ms) => {
          if (globalThis.slowStage === 'all' || globalThis.slowStage === stage) globalThis.slowNow += ms;
        };
        const s = {
          frames: [0,1,2].map(i=>({name:'frame_00'+i+'.jpg',fw:4,fh:4})),
          trainer: {iter:0,n:3,camMeta:cams}, view:{},
          on(name, fn) { const list=events.get(name)||[]; list.push(fn); events.set(name,list); },
          async load() { advance('decode', 61000); },
          async solve() { advance('path', 361000); return {cams,points:[]}; },
          async seed() { advance('seed', 91000); return {n:3,radius:1}; },
          start() {
            if (globalThis.stopSlowRun) { globalThis.slowController.abort(); return; }
            advance('train', 16*60000); this.trainer.iter=7000;
            queueMicrotask(()=>events.get('event').forEach(fn=>fn({kind:'train-complete'})));
          },
          async finish() {
            advance('finish', 61000);
            queueMicrotask(()=>events.get('event').forEach(fn=>fn({kind:'train-complete'})));
          },
          async fitBackground() { return {accepted:false,reason:'no-background-signal'}; },
          async exportPlyBlob() { advance('export', 61000); return new Blob(['saved model']); },
          dispose() { globalThis.slowDisposed=true; }
        }; return s;
      }`,
    }),
  );
  await page.goto("/tests/fixtures/v3d/");
  return page.evaluate(
    async ({ tier, stop, slowStage }) => {
      Object.defineProperty(navigator, "gpu", {
        configurable: true,
        value: { requestAdapter: async () => ({ info: { description: "test adapter" } }) },
      });
      globalThis.slowNow = 100;
      globalThis.stopSlowRun = stop;
      globalThis.slowStage = slowStage;
      globalThis.slowController = new AbortController();
      Object.defineProperty(performance, "now", { value: () => globalThis.slowNow });
      const originalTimer = globalThis.setTimeout;
      const timers = [];
      globalThis.setTimeout = (fn, ms, ...args) => {
        timers.push(ms);
        return originalTimer(fn, ms, ...args);
      };
      const { videoTo3D } = await import("/src/video3d/run.js");
      try {
        const result = await videoTo3D(new File(["video"], "clip.mp4"), {
          tier,
          signal: globalThis.slowController.signal,
        });
        return { stats: result.stats, timings: result.timings, timers, disposed: slowDisposed };
      } catch (error) {
        return { error: error.message, timers, disposed: slowDisposed };
      } finally {
        globalThis.setTimeout = originalTimer;
      }
    },
    { tier, stop, slowStage },
  );
}

for (const tier of ["low", "mid", "high", "max"]) {
  test(`${tier} keeps completed slow stages and trains beyond fifteen minutes`, async ({
    page,
  }) => {
    const result = await slowPipeline(page, { tier });
    expect(result.error).toBeUndefined();
    expect(result.stats.timeLimitMinutes).toBeNull();
    expect(result.stats.timedOut).toBe(false);
    expect(result.timings).toMatchObject({
      decode: 61,
      path: 361,
      seed: 91,
      train: 960,
      export: 61,
    });
    // Adapter discovery and the optional background fit stay bounded. No hard stage or
    // training timer may silently return to the non-phone pipeline.
    expect(result.timers).toEqual([10000, 60000]);
    expect(result.disposed).toBe(true);
  });
}

test("Stop on desktop still finishes and exports after a slow device fence", async ({ page }) => {
  const result = await slowPipeline(page, { tier: "high", stop: true });
  expect(result.error).toBeUndefined();
  expect(result.stats.stoppedEarly).toBe(true);
  expect(result.stats.timedOut).toBe(false);
  expect(result.timings.train).toBe(61);
  expect(result.timings.export).toBe(61);
  expect(result.disposed).toBe(true);
});

test("Phone-safe still rejects a decode that exceeds its deadline", async ({ page }) => {
  const result = await slowPipeline(page, { tier: "phone" });
  expect(result.error).toMatch(/decode.*in time.*shorter MP4/);
  expect(result.timers).toEqual([10000, 60000]);
  expect(result.disposed).toBe(true);
});

for (const [stage, message] of [
  ["path", /solve.*in time/],
  ["seed", /prepare.*in time/],
  ["export", /saving.*shorter/],
  ["finish", /finishing.*shorter/],
]) {
  test(`Phone-safe retains its ${stage} deadline`, async ({ page }) => {
    const result = await slowPipeline(page, {
      tier: "phone",
      slowStage: stage,
      stop: stage === "finish",
    });
    expect(result.error).toMatch(message);
    expect(result.disposed).toBe(true);
  });
}

test("Phone-safe retains its eight-minute training cap and stage timers", async ({ page }) => {
  const result = await slowPipeline(page, { tier: "phone", slowStage: "none" });
  expect(result.error).toBeUndefined();
  expect(result.stats.timeLimitMinutes).toBe(8);
  expect(result.timers).toEqual([10000, 60000, 180000, 90000, 480000, 60000, 60000]);
});
