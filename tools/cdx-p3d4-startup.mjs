// Real file-input change -> completed first custom Sharp frame. No mocked depth.
import fs from "node:fs";
import crypto from "node:crypto";
import { fingerprintR4, renderFilesR4 } from "./cdx-p3d4-common.mjs";
import { chromium } from "@playwright/test";
import config from "../playwright.config.mjs";
const opt = (n, fallback) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? fallback; // prettier-ignore
const browser = await chromium.launch(config.use.launchOptions);
try {
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
  });
  if (opt("model", ""))
    await page.route("**/depth-anything-v2-small/model_quantized.onnx", (route) =>
      route.fulfill({
        body: fs.readFileSync(opt("model")),
        contentType: "application/octet-stream",
      }),
    );
  await page.addInitScript(() => {
    const Base = window.Worker;
    window.__workerTimes = [];
    window.Worker = class extends Base {
      constructor(url, options) {
        super(url, options);
        const pending = new Map();
        const original = this.postMessage;
        this.postMessage = function (message, ...rest) {
          pending.set(message.id, {
            start: performance.now(),
            worker: String(url),
            type: message.type,
            modelUrl: message.options?.modelUrl,
            positionTableUrl: message.options?.positionTableUrl,
          });
          return original.call(this, message, ...rest);
        };
        this.addEventListener("message", ({ data }) => {
          if (data.type === "status") return;
          const entry = pending.get(data.id);
          if (!entry) return;
          window.__workerTimes.push({
            ...entry,
            ms: performance.now() - entry.start,
            inferenceMs: data.ms,
            phases: data.phases,
          });
          pending.delete(data.id);
        });
      }
    };
  });
  const url = opt("url", "http://127.0.0.1:4174/");
  const build = await fingerprintR4(url),
    methodHash = crypto
      .createHash("sha256")
      .update(fs.readFileSync(new URL(import.meta.url)))
      .digest("hex"),
    modelOverride = opt("model", "") || null,
    modelHash = crypto
      .createHash("sha256")
      .update(
        fs.readFileSync(modelOverride || "vendor/depth-anything-v2-small/model_quantized.onnx"),
      )
      .digest("hex");
  await page.goto(`${url}?renderer=webgl2&profile=low&adapt=off&labs=1`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  await page.evaluate(async () => {
    const { app, player: pl } = window.__splashery;
    await app.chooseToy("photo-3d");
    pl.idle.weight = 0;
    pl.opts.idleDelay = 1e9;
    pl.stage.setFixedSize([585, 1266]);
    for (let i = 0; i < 3; i++) await pl.stage.captureFrame();
    pl.setPaused(true);
    window.__steps = [];
    const wrap = (object, name, label) => {
      const original = object[name];
      object[name] = function (...args) {
        const start = performance.now();
        try {
          return original.apply(this, args);
        } finally {
          window.__steps.push({ label, start, ms: performance.now() - start });
        }
      };
    };
    const { Kit } = await import("/src/kit.js");
    const { ReliefMesh } = await import("/src/live/relief-mesh.js");
    for (const name of ["emitCloud", "fit", "encodeMorphs", "encodeReliefs"])
      wrap(Kit.prototype, name, `Kit.${name}`);
    for (const name of ["setColor", "setDepth", "setPieces", "setBackground"])
      wrap(ReliefMesh.prototype, name, `Sharp.${name}`);
    wrap(pl.stage, "setToy", "Stage.setToy");
    wrap(pl, "makeContainer", "Player.makeContainer");
  });
  const results = [];
  for (let run = 0; run < Number(opt("runs", 3)); run++) {
    await page.evaluate(() => {
      const pl = window.__splashery.player;
      const previous = pl.proc.ctx.kit.data.photo.uid;
      window.__first3d = null;
      document.addEventListener(
        "change",
        (event) => {
          if (event.target.id !== "toy-input-file") return;
          const start = performance.now();
          window.__pickStart = start;
          let completing = false;
          const rendered = () => {
            if (
              pl.loading ||
              !pl.proc?.ctx?.kit?.data?.photo?.custom ||
              pl.proc.ctx.kit.data.photo.uid === previous ||
              !window.__psv.state().on
            )
              return;
            const cover = document.querySelector("[aria-label='Photo preview']"),
              rect = cover?.getBoundingClientRect();
            if (completing || (rect?.width > 0 && rect?.height > 0)) return;
            completing = true;
            pl.stage.app.off("postrender", rendered);
            observer.disconnect();
            const gl = pl.stage.device.gl,
              fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            gl.flush();
            const check = () => {
              const status = gl.clientWaitSync(fence, 0, 0);
              if (status === gl.WAIT_FAILED) throw new Error("First-frame fence failed.");
              if (status === gl.TIMEOUT_EXPIRED) return setTimeout(check, 0);
              gl.deleteSync(fence);
              window.__first3d = {
                start,
                totalMs: performance.now() - start,
                sharp: window.__psv.state(),
                backgroundPending: !!pl.proc.ctx.kit.data.photo.backgroundPending,
                workers: window.__workerTimes.filter((e) => e.start >= start),
                steps: window.__steps.filter((e) => e.start >= start),
              };
              pl.setPaused(true);
            };
            check();
          };
          const observer = new MutationObserver(rendered);
          observer.observe(document.body, { childList: true, subtree: true });
          pl.setPaused(false);
          pl.stage.app.on("postrender", rendered);
        },
        { capture: true, once: true },
      );
    });
    await page
      .locator("#toy-input-file")
      .setInputFiles(opt("file", "assets/toys/photo-3d/forest.jpg"));
    await page.waitForFunction(() => !!window.__first3d, null, { timeout: 240000 });
    const row = await page.evaluate(() => window.__first3d);
    if (row.backgroundPending) {
      await page.waitForFunction(
        () => !window.__splashery.player.proc.ctx.kit.data.photo.backgroundPending,
        null,
        { timeout: 240000 },
      );
      row.refinementReadyMs = await page.evaluate(() => performance.now() - window.__pickStart);
    } else row.refinementReadyMs = row.totalMs;
    row.backgroundFill = await page.evaluate(
      () => window.__splashery.player.proc.ctx.kit.data.photo.backgroundFill || null,
    );
    row.workers = await page.evaluate(
      (start) => window.__workerTimes.filter((e) => e.start >= start),
      row.start,
    );
    const depthWorker = row.workers.find((e) => e.type === "photo");
    row.depthModel = {
      url:
        depthWorker?.modelUrl ||
        new URL("vendor/depth-anything-v2-small/model_quantized.onnx", url).href,
      sha256: depthWorker?.positionTableUrl
        ? build.files["vendor/photo-depth-position/model.onnx"]
        : modelHash,
      positionTableSha256: depthWorker?.positionTableUrl
        ? build.files["vendor/photo-depth-position/positions.bin"]
        : null,
    };
    results.push({ run, ...row });
    fs.writeFileSync(
      opt("out", ".cache/photo-3d-r4/startup-checkpoint.json"),
      JSON.stringify(
        {
          browser: browser.version(),
          url,
          build,
          methodHash,
          modelOverride,
          modelHash,
          viewport: [390, 844],
          deviceScaleFactor: 3,
          results,
        },
        null,
        2,
      ),
    );
    console.log(
      JSON.stringify({
        run,
        totalMs: row.totalMs,
        refinementReadyMs: row.refinementReadyMs,
        backgroundFill: row.backgroundFill,
        workers: row.workers,
      }),
    );
  }
} finally {
  await browser.close();
}
