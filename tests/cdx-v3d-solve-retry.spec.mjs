import { test, expect } from "@playwright/test";

// Run the real Session before/after the solver boundary. Only the reconstruction is simulated;
// this verifies frame ownership and retry behavior, not camera-solving quality or GPU timing.
test.use({
  launchOptions: {
    executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
    args: ["--disable-gpu"],
  },
});

async function fixture(page) {
  await page.route("**/vendor/splatjs/src/sfm/sfm.js", (route) =>
    route.fulfill({
      contentType: "text/javascript",
      body: `export async function runSfM(frames) {
        if (frames.some(f => !f.gray)) throw new Error("retry lost its feature pictures");
        globalThis.solvedCalls = (globalThis.solvedCalls || 0) + 1;
        const n = globalThis.solvedCalls === 1 ? 2 : 3;
        return { cams: Array.from({length:n}, (_,imgIdx)=>({imgIdx})), points:[],
          k1: globalThis.distortion || 0, k2:0, fFeat:4 };
      }`,
    }),
  );
  await page.goto("/tests/fixtures/v3d/");
}

test("a rejected two-camera solve preserves original pictures for the relaxed retry", async ({
  page,
}) => {
  await fixture(page);
  const result = await page.evaluate(async () => {
    const { Session } = await import("/vendor/splatjs/src/session.js");
    const session = new Session({ lowMem: true });
    session.gpu = { owned: false };
    const frames = Array.from({ length: 3 }, (_, i) => ({
      tw: 4,
      th: 4,
      fw: 4,
      fh: 4,
      gray: Float32Array.from({ length: 16 }, (_, k) => k + i),
      rgb: Float32Array.from({ length: 48 }, (_, k) => (k + i) / 64),
    }));
    session.useFrames(frames);
    const original = frames.map((f) => ({ gray: f.gray, rgb: f.rgb, bytes: Array.from(f.rgb) }));
    globalThis.distortion = 0.1;
    let rejected = "";
    try {
      await session.solve({ minCameras: 3 });
    } catch (error) {
      rejected = error.message;
    }
    const retained = frames.every(
      (f, i) =>
        f.gray === original[i].gray &&
        f.rgb === original[i].rgb &&
        Array.from(f.rgb).every((v, k) => v === original[i].bytes[k]),
    );
    const noRejectedRecon = session.recon === null;
    globalThis.distortion = 0;
    let retry, retryError;
    try {
      retry = await session.solve({ minCameras: 3, siftPeak: 0.5 });
    } catch (error) {
      retryError = error.message;
    }
    return {
      rejected,
      retained,
      noRejectedRecon,
      retryCameras: retry?.cams.length,
      retryError,
      releasedAfterAcceptance: frames.every((f) => f.gray === null),
    };
  });
  expect(result.rejected).toMatch(/only 2.*3.*camera/i);
  expect(result.retained).toBe(true);
  expect(result.noRejectedRecon).toBe(true);
  expect(result.retryError).toBeUndefined();
  expect(result.retryCameras).toBe(3);
  expect(result.releasedAfterAcceptance).toBe(true);
});

test("omitting the camera minimum preserves the existing two-view session contract", async ({
  page,
}) => {
  await fixture(page);
  const result = await page.evaluate(async () => {
    const { Session } = await import("/vendor/splatjs/src/session.js");
    const session = new Session({ lowMem: true });
    session.gpu = { owned: false };
    const frames = Array.from({ length: 3 }, () => ({ gray: new Float32Array(4) }));
    session.useFrames(frames);
    const recon = await session.solve();
    return { cameras: recon.cams.length, released: frames.every((f) => f.gray === null) };
  });
  expect(result).toEqual({ cameras: 2, released: true });
});

test("invalid camera minima fail before starting the solver", async ({ page }) => {
  await fixture(page);
  const result = await page.evaluate(async () => {
    const { Session } = await import("/vendor/splatjs/src/session.js");
    const errors = [];
    for (const minCameras of [0, 1, -1, 2.5, NaN, Infinity, "3"]) {
      const session = new Session();
      session.gpu = { owned: false };
      session.useFrames([{ gray: new Float32Array(4) }]);
      try {
        await session.solve({ minCameras });
        errors.push(null);
      } catch (error) {
        errors.push(error.message);
      }
    }
    return { errors, calls: globalThis.solvedCalls || 0 };
  });
  expect(result.calls).toBe(0);
  expect(result.errors).toHaveLength(7);
  for (const error of result.errors) expect(error).toMatch(/minCameras/);
});
