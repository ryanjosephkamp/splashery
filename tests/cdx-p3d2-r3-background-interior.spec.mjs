import { test, expect } from "@playwright/test";
import { backgroundImage } from "../src/photo3d/background.js";

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });

test("hidden pixels use far-side interior colors instead of repeating source edge antialiasing", () => {
  const w = 32,
    h = 32,
    data = new Uint8Array(w * h * 4),
    d = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      data.set(
        [...(x < 16 ? [224, 48, 24] : x === 16 ? [124, 60, 104] : [24, 72, 184]), 255],
        (y * w + x) * 4,
      );
      d[y * w + x] = x < 16 ? 0.8 : 0.2;
    }
  const b = backgroundImage({ w, h, data }, d, w, h, 0.78);
  expect(Array.from(b.rgba.slice((16 * w + 10) * 4, (16 * w + 10) * 4 + 4))).toEqual([
    24, 72, 184, 255,
  ]);
  expect(Array.from(b.rgba.slice((16 * w + 16) * 4, (16 * w + 16) * 4 + 4))).toEqual([
    124, 60, 104, 255,
  ]);
});

test("a far region narrower than the interior guard still provides an eligible donor", () => {
  const w = 32,
    h = 32,
    data = new Uint8Array(w * h * 4),
    d = new Float32Array(w * h).fill(0.8);
  for (let i = 0; i < w * h; i++) data.set([224, 48, 24, 255], i * 4);
  d[16 * w + 16] = 0.2;
  data.set([24, 72, 184, 255], (16 * w + 16) * 4);
  const b = backgroundImage({ w, h, data }, d, w, h, 0.78);
  expect(Array.from(b.rgba.slice((16 * w + 10) * 4, (16 * w + 10) * 4 + 4))).toEqual([
    24, 72, 184, 255,
  ]);
});

test("a broad far region cannot replace a nearby narrow far patch with another color", () => {
  const w = 80,
    h = 64,
    data = new Uint8Array(w * h * 4),
    d = new Float32Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      d[y * w + x] = x <= 10 || x === 40 ? 0 : 0.8;
      data.set(
        [...(x <= 10 ? [24, 72, 184] : x === 40 ? [24, 184, 72] : [224, 48, 24]), 255],
        (y * w + x) * 4,
      );
    }
  const b = backgroundImage({ w, h, data }, d, w, h, 0.78);
  expect(Array.from(b.rgba.slice((32 * w + 41) * 4, (32 * w + 41) * 4 + 4))).toEqual([
    24, 184, 72, 255,
  ]);
});

test("the filled background draws far interior colors behind a source antialiasing edge", async ({
  page,
}) => {
  test.setTimeout(240000);
  await page.goto("/?renderer=webgl2&profile=low&adapt=off&labs=1");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  const colors = await page.evaluate(async () => {
    const { player: pl, app } = window.__splashery;
    const { ReliefMesh } = await import("/src/live/relief-mesh.js");
    const { backgroundImage } = await import("/src/photo3d/background.js");
    const { Vec3 } = await import("/src/pc.js");
    pl.setPaused(true);
    pl.idle.weight = 0;
    app.setLook({ ground: "none" });
    pl.stage.toy.entity.gsplat.enabled = false;
    pl.stage.setFixedSize([
      Math.round(390 * pl.stage.pixelRatio()),
      Math.round(844 * pl.stage.pixelRatio()),
    ]);
    const w = 32,
      h = 32,
      data = new Uint8Array(w * h * 4),
      d = new Float32Array(w * h),
      band = new Uint8Array(w * h);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        data.set(
          [...(x < 16 ? [224, 48, 24] : x === 16 ? [124, 60, 104] : [24, 72, 184]), 255],
          (y * w + x) * 4,
        );
        d[y * w + x] = x < 16 ? 0.8 : 0.2;
        band[y * w + x] = x < 16 ? 3 : 0;
      }
    const b = backgroundImage({ w, h, data }, d, w, h, 0.78),
      m = new ReliefMesh(pl.stage, { cols: w, rows: h });
    try {
      m.setColor({ w, h, data });
      m.setDepth({ w, h, data: Uint8Array.from(d, (v) => Math.round(v * 255)) });
      m.set({
        width: 1,
        height: 1,
        lift: 0.78,
        base: 0.5,
        backOffset: -0.012,
        morph: [0, 0, 0, 0],
        layers: 0,
        reach: b.reach,
      });
      m.setPieces({ depth: d, band, gx: w, gy: h });
      m.setBackground({ ...b, soft: { w, h, data: new Uint8Array(w * h).fill(51) } });
      m.show(true);
      m.miS.visible = false;
      const colors = [];
      for (const [yaw, pitch] of [
        [-30, 0],
        [30, 0],
        [0, -30],
        [0, 30],
      ]) {
        pl.camera.cur = {
          ...pl.camera.home,
          yaw: (yaw * Math.PI) / 180,
          pitch: (pitch * Math.PI) / 180,
        };
        pl.camera.tgt = { ...pl.camera.cur };
        pl.stage.setCameraPose(pl.camera.pose());
        await pl.stage.captureFrame();
        const frame = await pl.stage.captureFrame();
        const p = pl.stage.cameraEntity.camera.camera.worldToScreen(
          new Vec3(10.5 / 32 - 0.5, 0.5 - 16.5 / 32, 0.78 * (0.2 - 0.5) - 0.012),
          frame.width,
          frame.height,
        );
        colors.push(
          Array.from(
            frame.getContext("2d").getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data,
          ),
        );
      }
      return colors;
    } finally {
      m.destroy();
    }
  });
  for (const color of colors) expect(color).toEqual([24, 72, 184, 255]);
  expect(errors).toEqual([]);
});
