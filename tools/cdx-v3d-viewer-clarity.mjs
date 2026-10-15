#!/usr/bin/env node
// Isolate the production PlayCanvas stage at the same pose/intrinsics as the native ruler.
// <scratch> <id> <bake-name> [--kernel=gaussian|sharp] [--legacy]
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { imageMetrics } from "./cdx-v3d-clarity-metrics.mjs";
const [scratch, id, name, ...args] = process.argv.slice(2);
const folder = path.resolve(scratch, id);
const cameraFile = path.join(folder, `${name}.json`);
const meta = JSON.parse(
  fs.readFileSync(fs.existsSync(cameraFile) ? cameraFile : path.join(folder, "main.json")),
);
const ledger = JSON.parse(fs.readFileSync(path.resolve(scratch, "ledger.json"))),
  record = ledger.samples.find((s) => s.id === id);
const base = (process.env.SPLASHERY_URL || "http://127.0.0.1:4175").replace(/\/$/, "");
const kernel = args.find((a) => a.startsWith("--kernel="))?.split("=")[1] || "gaussian",
  legacy = args.includes("--legacy");
const camera = meta.cams[0],
  s = ledger.side / Math.max(camera.w, camera.h),
  width = Math.round(camera.w * s),
  height = Math.round(camera.h * s);
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
try {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.route(`${base}/__viewer-clarity.html`, (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<style>html,body{margin:0}canvas{display:block;width:100vw;height:100vh}</style><canvas id="view"></canvas>',
    }),
  );
  await page.route(`${base}/__viewer-clarity.ply`, (r) =>
    r.fulfill({ path: path.join(folder, `${name}.ply`), contentType: "application/octet-stream" }),
  );
  await page.goto(`${base}/__viewer-clarity.html`);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.evaluate(
    async ({ width, height, kernel, legacy }) => {
      const [{ Stage }, { readPlyHeader, decimatePly, resourceFromProps }] = await Promise.all([
        import("/src/stage.js"),
        import("/src/loaders.js"),
      ]);
      const stage = await Stage.create(document.getElementById("view"), {
        prefer: "webgl2",
        adaptive: false,
        pixelRatio: 1,
      });
      stage.setFixedSize([width, height]);
      stage.setClearColor([0, 0, 0], 1);
      stage.setKernel(kernel);
      if (!legacy)
        stage.setSharpness({
          cull: { minPixelSize: 0, minContribution: 0 },
          dpr: 1,
          adapt: "off",
          aa: false,
        });
      const bytes = new Uint8Array(await (await fetch("/__viewer-clarity.ply")).arrayBuffer());
      const h = readPlyHeader(bytes),
        table = decimatePly(bytes, h, h.count, 7);
      stage.setToy({ resource: resourceFromProps(stage, table), owned: true });
      stage.setUniforms({
        uSpClock: [0, 1, 1, 0],
        uSpBodyQ: [0, 0, 0, 1],
        uSpToy: [0, 0, 0, 1000],
      });
      window.__viewerClarity = stage;
    },
    { width, height, kernel, legacy },
  );
  const frames = [];
  for (const index of record.heldOut) {
    const c = meta.cams[index];
    await page.evaluate(
      async ({ c, width, height }) => {
        const pc = await import("/src/pc.js"),
          stage = window.__viewerClarity;
        const R = c.R,
          p = [0, 1, 2].map((k) => -(R[k] * c.t[0] + R[k + 3] * c.t[1] + R[k + 6] * c.t[2]));
        const m = new pc.Mat4();
        m.set([R[0], R[1], R[2], 0, -R[3], -R[4], -R[5], 0, -R[6], -R[7], -R[8], 0, 0, 0, 0, 1]);
        const q = new pc.Quat().setFromMat4(m);
        stage.setCameraPose({ position: p, rotation: [q.x, q.y, q.z, q.w] });
        const fx = (c.f * width) / c.w,
          fy = ((c.fy ?? c.f) * height) / c.h,
          cx = ((c.cx ?? c.w / 2) * width) / c.w,
          cy = ((c.cy ?? c.h / 2) * height) / c.h;
        stage.cameraEntity.camera.calculateProjection = (out) => {
          const near = 0.02,
            far = 200;
          out.set([
            (2 * fx) / width,
            0,
            0,
            0,
            0,
            (2 * fy) / height,
            0,
            0,
            1 - (2 * cx) / width,
            (2 * cy) / height - 1,
            (far + near) / (near - far),
            -1,
            0,
            0,
            (2 * far * near) / (near - far),
            0,
          ]);
        };
        for (let i = 0; i < 8; i++) {
          stage.requestRender();
          await stage.captureFrame();
        }
      },
      { c, width, height },
    );
    const file = path.join(folder, `viewer-${name}-${kernel}-${index}.png`);
    await page.locator("#view").screenshot({ path: file });
    frames.push({
      index,
      ...imageMetrics(
        PNG.sync.read(fs.readFileSync(file)),
        PNG.sync.read(fs.readFileSync(path.join(folder, "frames", c.frame))),
      ),
    });
    console.log(`${id} viewer ${kernel} ${index}`);
  }
  if (errors.length) throw new Error(errors.join("\n"));
  const mean = Object.fromEntries(
    ["psnr", "ssim", "laplacian"].map((k) => [
      k,
      frames.reduce((sum, f) => sum + f[k], 0) / frames.length,
    ]),
  );
  fs.writeFileSync(
    path.join(folder, `viewer-${name}-${kernel}.json`),
    JSON.stringify(
      {
        frames,
        mean,
        kernel,
        legacy,
        renderer: "production Stage/PlayCanvas WebGL2; raw PLY; exact camera; full resolution",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ id, mean }));
} finally {
  await browser.close();
}
