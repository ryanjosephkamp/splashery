// GPU-completed frames, with no screenshot readbacks in the timed interval.
import fs from "node:fs";
import crypto from "node:crypto";
import { chromium } from "@playwright/test";
import config from "../playwright.config.mjs";
import { inputs, screens, openR3, selectR3 } from "./cdx-p3d2-r3-common.mjs";
const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const url = opt("url", "http://127.0.0.1:4175/");
const build = JSON.parse(fs.readFileSync(".cache/cdx-p3d2/r3/builds.json"))[opt("build", "after")];
if (!build) throw new Error("Record the immutable browser build before timing it.");
for (const [file, hash] of Object.entries(build.files)) {
  const response = await fetch(new URL(file, url));
  if (!response.ok) throw new Error(`Cannot read browser source: ${file}`);
  const actual = crypto
    .createHash("sha256")
    .update(Buffer.from(await response.arrayBuffer()))
    .digest("hex");
  if (actual !== hash) throw new Error(`Timing browser source changed: ${file}`);
}
const browser = await chromium.launch(config.use.launchOptions);
try {
  const rows = [];
  for (const name of opt("screens", "phone,desktop").split(",")) {
    const { width, height, deviceScaleFactor: dpr, profile } = screens[name];
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
    await openR3(page, url, screens[name]);
    const selected = opt("samples", "forest,dot-dragonfly,spiral-stairs");
    for (const entry of inputs().filter(
      (s) => selected === "all" || selected.split(",").includes(s.id),
    )) {
      await selectR3(page, entry, 1, "sharp");
      const id = entry.id;
      const row = await page.evaluate(
        async ({ id, width, height }) => {
          const { app, player: pl } = window.__splashery;
          pl.idle.weight = 0;
          pl.opts.idleDelay = 1e9;
          pl.motion.setControl("flat", 0, { snap: true });
          pl.motion.setControl("layers", 0, { snap: true });
          pl.setPaused(true);
          app.setLook({ ground: "none" });
          const ratio = pl.stage.pixelRatio();
          pl.stage.setFixedSize([Math.round(width * ratio), Math.round(height * ratio)]);
          pl.stage.canvas.style.width = `${width}px`;
          pl.stage.canvas.style.height = `${height}px`;
          const times = [];
          const drawCounts = [];
          let renders = 0;
          const rendered = () => renders++;
          pl.stage.app.on("postrender", rendered);
          for (let i = 0; i < 150; i++) {
            pl.camera.cur = {
              ...pl.camera.home,
              yaw: 0.52 * Math.sin(i / 24),
              pitch: 0.52 * Math.cos(i / 31),
            };
            pl.camera.tgt = { ...pl.camera.cur };
            pl.stage.setCameraPose(pl.camera.pose());
            pl.toyInfo.recipe.drive(0, { flat: 0, layers: 0 }, { parts: {} });
            pl.stage.aliveUntil = 0;
            const before = renders;
            const start = performance.now();
            await new Promise((resolve) => {
              pl.stage.app.once("postrender", resolve);
              pl.stage.app.renderNextFrame = true;
            });
            pl.stage.aliveUntil = 0;
            pl.stage.app.renderNextFrame = false;
            const gl = pl.stage.device.gl;
            if (!gl?.fenceSync) throw new Error("A WebGL2 completion fence is required.");
            const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            gl.flush();
            await new Promise((resolve, reject) => {
              const check = () => {
                const state = gl.clientWaitSync(fence, 0, 0);
                if (state === gl.WAIT_FAILED) {
                  gl.deleteSync(fence);
                  reject(new Error("The GPU completion fence failed."));
                } else if (state === gl.ALREADY_SIGNALED || state === gl.CONDITION_SATISFIED) {
                  gl.deleteSync(fence);
                  resolve();
                } else setTimeout(check, 0);
              };
              check();
            });
            if (i >= 30) {
              drawCounts.push(renders - before);
              times.push(performance.now() - start);
            }
          }
          pl.stage.app.off("postrender", rendered);
          const sorted = [...times].sort((a, b) => a - b);
          const q = (p) => sorted[Math.floor(p * (sorted.length - 1))];
          const gl = pl.stage.device.gl;
          const debug = gl.getExtension("WEBGL_debug_renderer_info");
          return {
            id,
            gpu: debug
              ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)
              : gl.getParameter(gl.RENDERER),
            dpr: devicePixelRatio,
            ratio,
            buffer: [pl.stage.canvas.width, pl.stage.canvas.height],
            frames: times.length,
            renders,
            drawCounts,
            meanMs: times.reduce((a, b) => a + b, 0) / times.length,
            medianMs: q(0.5),
            p95Ms: q(0.95),
            p99Ms: q(0.99),
            times,
            fps: 1000 / (times.reduce((a, b) => a + b, 0) / times.length),
            sharp: window.__psv.state(),
          };
        },
        { id, width, height },
      );
      rows.push({ name, width, height, profile, ...row });
      console.log(JSON.stringify({ ...row, times: undefined }));
      fs.writeFileSync(
        opt("out", ".cache/cdx-p3d2/r3/frame.json"),
        JSON.stringify(
          {
            browser: browser.version(),
            url,
            build,
            renderer: process.env.SPLASHERY_GL || "swiftshader",
            method:
              "Completed pose cadence: request renderNextFrame with keep-alive cleared, postrender then WebGL2 fence with asynchronous timer polling; 30 warmup + 120 measured requests. Record additional asynchronous draws rather than treating them as requested poses. Includes scheduling/polling overhead.",
            rows,
          },
          null,
          2,
        ),
      );
    }
    await page.close();
  }
} finally {
  await browser.close();
}
