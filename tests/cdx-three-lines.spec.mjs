// Task 72: render the real RGB toy with the GPU path that produced white bands.
// QR72_BACKEND optionally selects a supported ANGLE backend. No security flags.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.use({
  launchOptions: {
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    chromiumSandbox: true,
    ignoreDefaultArgs: [
      "--enable-unsafe-swiftshader",
      "--unsafely-disable-devtools-self-xss-warnings",
    ],
    args: process.env.QR72_BACKEND
      ? ["--use-gl=angle", `--use-angle=${process.env.QR72_BACKEND}`]
      : [],
  },
});

const renderer = process.env.QR72_RENDERER || "webgpu";
const precision = process.env.QR72_PRECISION || "highp";
const evidence = process.env.QR72_EVIDENCE;
const sizes = process.env.QR72_MATRIX
  ? [
      [390, 844, 1],
      [391, 843, 2.625],
      [393, 845, 3.5],
      [1440, 900, 1],
    ]
  : [[391, 843, 2.625]];

for (const [width, height, dpr] of sizes) {
  test(`RGB row coverage: ${renderer}, ${precision}, ${width}x${height}, DPR ${dpr}`, async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: dpr,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.addInitScript((precision) => {
      window.__qr72Demoted = 0;
      const proto = WebGL2RenderingContext.prototype;
      const original = proto.shaderSource;
      proto.shaderSource = function (shader, source) {
        if (precision === "mediump" && /splat/i.test(source)) {
          const next = source.replace(/precision highp float/g, "precision mediump float");
          if (next !== source) window.__qr72Demoted++;
          source = next;
        }
        return original.call(this, shader, source);
      };
    }, precision);
    // A pending integration can be tested without editing another PR's file.
    if (process.env.QR72_INTEGRATION) {
      await page.route("**/src/stage.js", async (route) => {
        const response = await route.fetch();
        let body = await response.text();
        body = `import { updateTokenBounds } from './token-bounds.js';\n` + body;
        const needle =
          "setUniforms(u) {\n    const g = this.toy?.entity.gsplat;\n    if (!g) return;";
        if (!body.includes(needle)) throw new Error("Stage integration target changed");
        body = body.replace(
          needle,
          needle +
            "\n    if (this.device.isWebGPU && this.toy.kit) updateTokenBounds(this.toy.resource, u['uSpTokens[0]'], g);",
        );
        await route.fulfill({ response, body });
      });
    }
    try {
      await page.goto(`/?renderer=${renderer}&adapt=off&profile=mid&labs=1`);
      await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
      await page.evaluate(() => window.__splashery.app.chooseToy("qr-three"));
      await page.waitForFunction(
        () => window.__splashery.player.toyInfo?.id === "qr-three" && !window.__splashery.app.busy,
      );
      const device = await page.evaluate(() => {
        const p = window.__splashery.player;
        const gl = p.stage.device.gl;
        const ext = gl?.getExtension("WEBGL_debug_renderer_info");
        return {
          type: p.stage.deviceType,
          renderer: gl
            ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)
            : p.stage.device.adapter?.info?.description || "WebGPU",
          mediumBits: gl?.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.MEDIUM_FLOAT).precision,
          demotedShaders: window.__qr72Demoted,
        };
      });
      // A fallback must not count as proof of the WebGPU defect being fixed.
      if (renderer === "webgpu" && device.type !== "webgpu") {
        test.skip(true, "No working WebGPU adapter; WebGL2 fallback is not proof of this fix.");
      }
      expect(device.type).toBe(renderer);
      if (precision === "mediump") expect(device.demotedShaders).toBeGreaterThan(0);
      await page.evaluate(async () => {
        const p = window.__splashery.player;
        p.opts.idleDelay = 1e9;
        p.idle.weight = 0;
        const s = p.stage;
        const handlers = s.updateHandlers.slice();
        const box = { pending: 0 };
        s.updateHandlers.length = 0;
        s.updateHandlers.push(() => {
          const dt = box.pending;
          box.pending = 0;
          for (const h of handlers) h(dt);
        });
        const N = window.__splashery.qrLab.three().rgb.size;
        const pose = window.__splashery.qrLab.frontPose(N / 2 + 4, 4);
        window.__qr72Step = async (secs) => {
          for (let t = 0; t < secs - 1e-6; t += 0.1) {
            box.pending = 0.1;
            p.camera.cur = { ...pose };
            p.camera.tgt = { ...pose };
            await s.captureFrame();
          }
          for (let i = 0; i < 3; i++) await s.captureFrame();
        };
        await window.__qr72Step(0.2);
      });
      const results = [];
      for (const state of ["together", "apart", "returned"]) {
        if (state === "apart") {
          await page.evaluate(() => window.__splashery.player.act());
          await page.evaluate(() => window.__qr72Step(2.1));
        } else if (state === "returned") await page.evaluate(() => window.__qr72Step(3));
        const measured = await page.evaluate(
          async ([state, capture]) => {
            const p = window.__splashery.player;
            const s = p.stage;
            const frame = await s.captureFrame();
            const pixels = frame
              .getContext("2d")
              .getImageData(0, 0, frame.width, frame.height).data;
            const sx = frame.width / s.canvas.clientWidth;
            const sy = frame.height / s.canvas.clientHeight;
            const rgb = window.__splashery.qrLab.three().rgb;
            const N = rgb.size;
            const tf = p.motion.ctx.transform;
            const points = [];
            const z0 = [-2.5, -0.5, -1.5];
            for (let ch = 0; ch < 3; ch++) {
              const modules = rgb.codes[ch].modules;
              const apart = state === "apart";
              const offset = apart ? p.motion.out.tokens[ch + 1].offset : [0, 0, 0];
              const project = (x, y) => {
                const z = apart ? z0[ch] + 0.01 : 0.01;
                const local = [x + offset[0], y + offset[1], z + offset[2]].map(
                  (v, i) => (v - tf.center[i]) * tf.scale,
                );
                const screen = s.toScreen(s.modelToWorld(local));
                return [screen[0] * sx, screen[1] * sy];
              };
              const read = (screen) => {
                const x = Math.round(screen[0]);
                const y = Math.round(screen[1]);
                if (x < 0 || y < 0 || x >= frame.width || y >= frame.height)
                  throw new Error("QR sample is off screen");
                const i = (y * frame.width + x) * 4;
                return apart ? Math.min(...pixels.slice(i, i + 3)) : pixels[i + ch];
              };
              // Both neighboring modules are dark in this channel. Their shared
              // edge must stay dark, including different RGB colors when together.
              for (let row = 0; row < N - 1; row++)
                for (let col = 0; col < N; col++) {
                  const i = row * N + col;
                  if (!modules[i] || !modules[i + N]) continue;
                  for (const dx of [-0.2, 0, 0.2]) {
                    const at = project(col - N / 2 + 0.5 + dx, N / 2 - row - 1);
                    points.push({ ch, row, col, brightness: read(at) });
                  }
                }
            }
            points.sort((a, b) => a.brightness - b.brightness);
            const bright = points.filter((p) => p.brightness > 180);
            return {
              image: capture ? frame.toDataURL("image/png") : null,
              state,
              canvas: [frame.width, frame.height],
              samples: points.length,
              max: points.at(-1).brightness,
              p95: points[Math.floor(points.length * 0.95)].brightness,
              bright: bright.length,
              worst: points.slice(-8),
            };
          },
          [state, !!evidence],
        );

        if (evidence) {
          fs.mkdirSync(evidence, { recursive: true });
          fs.writeFileSync(
            path.join(
              evidence,
              `${renderer}-${precision}-${width}x${height}-dpr${dpr}-${state}.png`,
            ),
            Buffer.from(measured.image.split(",")[1], "base64"),
          );
          if (process.env.QR72_FULL_PAGE)
            await page.screenshot({
              path: path.join(
                evidence,
                `${renderer}-${precision}-${width}x${height}-dpr${dpr}-${state}-page.png`,
              ),
            });
        }
        delete measured.image;
        results.push(measured);
      }
      const report = { device, viewport: [width, height], dpr, results, errors };
      await testInfo.attach("row-coverage", {
        body: JSON.stringify(report, null, 2),
        contentType: "application/json",
      });
      console.log(JSON.stringify(report));
      if (evidence)
        fs.writeFileSync(
          path.join(evidence, `${renderer}-${precision}-${width}x${height}-dpr${dpr}.json`),
          JSON.stringify(report, null, 2),
        );
      expect(errors).toEqual([]);
      for (const r of results) {
        expect(r.samples).toBeGreaterThan(1000);
        expect(r.bright, JSON.stringify(r)).toBe(0);
      }
    } finally {
      await context.close();
    }
  });
}
