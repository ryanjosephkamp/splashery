import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { readers } from "../tools/qr-scan-lab/readers.mjs";
import { RECIPES } from "../src/packs/qr-lab.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

async function open(page, id) {
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction(
    (id) => window.__splashery.app.player.toyInfo?.id === id && !window.__splashery.app.busy,
    id,
    { timeout: 60_000 },
  );
  await page.evaluate(() => (window.__splashery.qrLab.autoCheck = false));
}

test("anatomy starts with the highlighted part popping out", () => {
  expect(RECIPES["qr-anatomy"].options.find((o) => o.key === "pop").default).toBe(true);
});

// A held real GPU frame: sample inside each finder's solid 3 × 3 center,
// including every row boundary, where a white line cannot be QR data.
async function finderPixels(page, id, size) {
  return page.evaluate(
    async ({ id, size }) => {
      const { app } = window.__splashery;
      const p = app.player;
      p.opts.idleDelay = 1e9;
      p.idle.weight = 0;
      p.frozen = true;
      if (id === "qr-three") p.motion.setControl("apart", 0.5, { snap: true });
      const N =
        id === "qr-three"
          ? window.__splashery.qrLab.three().rgb.size
          : window.__splashery.qrLab.anatomy().steps.size;
      return app.withCapture(size, async () => {
        const image = await p.renderAt(p.time, window.__splashery.qrLab.frontPose(N / 2 + 4, 1.2));
        const g = image.getContext("2d", { willReadFrequently: true });
        const data = g.getImageData(0, 0, image.width, image.height).data;
        const pc = await import("/src/pc.js");
        const cam = p.stage.cameraEntity.camera;
        const vp = new pc.Mat4().mul2(cam.projectionMatrix, cam.viewMatrix);
        const fit = p.motion.ctx.transform;
        const values = [];
        const count = id === "qr-three" ? 3 : 1;
        for (let ch = 0; ch < count; ch++) {
          const off =
            id === "qr-three"
              ? [
                  (ch - 1) * 1.05 * (N + 9.5),
                  ch === 1 ? 0.02 * (N + 9.5) : 0,
                  -3 * (N + 9.5) - 0.5 - [2, 0, 1][ch],
                ]
              : [0, 0, 0.14];
          const pixels = [];
          for (let row = 2.15; row < 3.85; row += 0.08)
            for (let col = 2.15; col < 3.85; col += 0.08) {
              const point = [col - N / 2 + 0.5 + off[0], N / 2 - 0.5 - row + off[1], off[2]];
              const world = point.map((v, i) => (v - fit.center[i]) * fit.scale);
              const q = vp.transformVec4(new pc.Vec4(...world, 1), new pc.Vec4());
              const x = Math.floor(((q.x / q.w) * 0.5 + 0.5) * image.width);
              const y = Math.floor((1 - ((q.y / q.w) * 0.5 + 0.5)) * image.height);
              const at = (y * image.width + x) * 4;
              pixels.push(Array.from(data.slice(at, at + 3)));
            }
          values.push(pixels);
        }
        return values;
      });
    },
    { id, size },
  );
}

test("RGB finder centers have no horizontal white seams at phone and desktop size", async ({
  page,
}) => {
  await open(page, "qr-three");
  for (const size of [
    [390, 844],
    [1440, 900],
  ]) {
    const values = await finderPixels(page, "qr-three", size);
    for (let ch = 0; ch < values.length; ch++) {
      const low = values[ch].map((c) => Math.min(...c));
      const p95 = low.slice().sort((a, b) => a - b)[Math.floor(low.length * 0.95)];
      expect(
        p95,
        `channel ${ch}, ${size.join("x")}: white mixing inside a solid finder`,
      ).toBeLessThan(50);
    }
  }
});

test("anatomy and damage lab offer the circular sticker view", () => {
  for (const id of ["qr-anatomy", "qr-damage"])
    expect(RECIPES[id].options.find((o) => o.key === "shape")?.choices.map((o) => o.id)).toEqual([
      "square",
      "circle",
    ]);
});

async function captureCircle(page, id, size) {
  const url = await page.evaluate(
    async ({ id, size }) => {
      const { app } = window.__splashery;
      const q = window.__splashery.qrLab;
      const half = id === "qr-anatomy" ? q.anatomy().circle.half : q.damage().layout.half;
      app.player.opts.idleDelay = 1e9;
      app.player.idle.weight = 0;
      return app.withCapture(size, async () => {
        const image = await app.player.renderAt(app.player.time, q.frontPose(half, 1.5));
        return image.toDataURL("image/png");
      });
    },
    { id, size },
  );
  const png = PNG.sync.read(Buffer.from(url.split(",")[1], "base64"));
  return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
}

test("anatomy's circle scans and explains its separate decoration beside the quiet zone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, "qr-anatomy");
  await page.evaluate(() =>
    window.__splashery.app.player.switchTo({
      options: {
        shape: "circle",
        view: "encode",
        step: "done",
        text: "https://example.org/anatomy",
        level: "M",
      },
    }),
  );
  const image = await captureCircle(page, "qr-anatomy", [390, 844]);
  for (const [name, read] of Object.entries(readers))
    expect(read(image), name).toBe("https://example.org/anatomy");
  const legend = page.locator("#qrs-circle-legend");
  await expect(legend).toContainText("decoration: carries no data");
  await expect(legend).toContainText("Quiet zone: clear margin");
});

test("erasing circular decoration leaves every decoded bit intact; covering a finder breaks the read", async ({
  page,
}) => {
  await open(page, "qr-damage");
  await page.evaluate(() =>
    window.__splashery.app.player.switchTo({
      options: { shape: "circle", damage: "", text: "https://example.org/damage", level: "M" },
    }),
  );
  for (const erased of [false, true]) {
    await page.evaluate(
      (decorationDamage) =>
        window.__splashery.app.player.switchTo({ options: { decorationDamage } }),
      erased,
    );
    const image = await captureCircle(page, "qr-damage", [390, 844]);
    for (const [name, read] of Object.entries(readers))
      expect(read(image), `${name}, erased=${erased}`).toBe("https://example.org/damage");
    const check = await page.evaluate(() => window.__splashery.qrLab.checkDamage());
    expect(check.codes[0].analysis.wrong).toEqual([]);
  }
  await page.evaluate(() =>
    window.__splashery.app.player.switchTo({ options: { damage: "sticker:0.45:finder:1" } }),
  );
  const image = await captureCircle(page, "qr-damage", [390, 844]);
  expect(readers.jsqr(image)).toBe(null);
  const check = await page.evaluate(() => window.__splashery.qrLab.checkDamage());
  expect(check.codes[0].analysis.wrong.length).toBeGreaterThan(0);
});

// Different RGB colors may share a dark channel. Their horizontal edge
// must remain dark in that channel, rather than exposing the white card.
async function joinedSeams(page, size) {
  return page.evaluate(async (size) => {
    const { app } = window.__splashery;
    const p = app.player;
    p.frozen = true;
    p.motion.setControl("apart", 0, { snap: true });
    const { size: N, colors } = window.__splashery.qrLab.three().rgb;
    return app.withCapture(size, async () => {
      const image = await p.renderAt(p.time, window.__splashery.qrLab.frontPose(N / 2 + 4, 1.2));
      const data = image.getContext("2d").getImageData(0, 0, image.width, image.height).data;
      const pc = await import("/src/pc.js");
      const cam = p.stage.cameraEntity.camera;
      const vp = new pc.Mat4().mul2(cam.projectionMatrix, cam.viewMatrix);
      const fit = p.motion.ctx.transform;
      const values = [];
      for (let row = 1; row < N - 2; row++)
        for (let col = 1; col < N - 1; col++) {
          const a = (row * N + col) * 3,
            b = ((row + 1) * N + col) * 3;
          if ([0, 1, 2].every((ch) => colors[a + ch] === colors[b + ch])) continue;
          const world = [col - N / 2 + 0.5, N / 2 - row - 1, 0.14].map(
            (v, i) => (v - fit.center[i]) * fit.scale,
          );
          const q = vp.transformVec4(new pc.Vec4(...world, 1), new pc.Vec4());
          const x = Math.floor(((q.x / q.w) * 0.5 + 0.5) * image.width),
            y = Math.floor((1 - ((q.y / q.w) * 0.5 + 0.5)) * image.height);
          const at = (y * image.width + x) * 4;
          for (let ch = 0; ch < 3; ch++)
            if (!colors[a + ch] && !colors[b + ch]) values.push(data[at + ch]);
        }
      return values.sort((a, b) => a - b);
    });
  }, size);
}

test("joined RGB row boundaries keep the channels shared by both colors dark", async ({ page }) => {
  await open(page, "qr-three");
  for (const size of [
    [390, 844],
    [1440, 900],
  ]) {
    const values = await joinedSeams(page, size);
    const p95 = values[Math.floor(values.length * 0.95)];
    expect(p95).toBeLessThan(80);
  }
});
