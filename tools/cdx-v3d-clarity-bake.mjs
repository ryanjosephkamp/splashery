#!/usr/bin/env node
// MIT. Offline Splat.js continuation on the frozen task-55 inputs. Never imported by the site.
// cdx-v3d-clarity-bake.mjs <scratch> <id> [--steps=1500] [--seconds=5400]
// [--splats=120000] [--input=main] [--output=candidate] [--ssim=0.2]
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";

const [scratchArg, id, ...args] = process.argv.slice(2);
if (!scratchArg || !id) throw new Error("Usage: cdx-v3d-clarity-bake.mjs <scratch> <id> [options]");
const value = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const folder = path.resolve(scratchArg, id),
  input = value("input", "main"),
  output = value("output", "candidate");
const steps = Number(value("steps", 1500)),
  seconds = Number(value("seconds", 5400));
const maxSplats = Number(value("splats", 120000)),
  ssim = Number(value("ssim", 0.2));
const patch = Number(value("patch", 0));
if (patch && (!Number.isInteger(patch) || patch < 64 || patch > 512))
  throw new Error("Patch size must be 64–512 pixels.");
for (const suffix of [".ply", ".json"])
  if (fs.existsSync(path.join(folder, output + suffix)))
    throw new Error("Refusing to overwrite a bake.");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const metadata = JSON.parse(fs.readFileSync(path.join(folder, "main.json")));
const inputMeta = JSON.parse(fs.readFileSync(path.join(folder, `${input}.json`)));
const source = JSON.parse(fs.readFileSync(path.resolve(scratchArg, "ledger.json"))).samples.find(
  (s) => s.id === id,
);
for (const c of metadata.cams)
  if (hash(fs.readFileSync(path.join(folder, "frames", c.frame))) !== c.frameSha256)
    throw new Error("Changed frozen frame.");
const base = (process.env.SPLASHERY_URL || "http://127.0.0.1:4175").replace(/\/$/, "");
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: [
    "--no-sandbox",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-webgpu",
    "--enable-features=Vulkan,WebGPU",
    "--use-webgpu-adapter=swiftshader",
    "--use-vulkan=swiftshader",
  ],
});
const started = Date.now();
try {
  const page = await browser.newPage();
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type()) || m.text().startsWith("[clarity]"))
      console.log(`${Math.round((Date.now() - started) / 1000)}s ${m.text()}`);
  });
  page.on("pageerror", (e) => console.error(e));
  await page.route(`${base}/__clarity-bake.html`, (r) =>
    r.fulfill({ contentType: "text/html", body: "<title>Offline clarity bake</title>" }),
  );
  await page.route(`${base}/__clarity-input.ply`, (r) =>
    r.fulfill({ path: path.join(folder, `${input}.ply`), contentType: "application/octet-stream" }),
  );
  await page.route(`${base}/__clarity-frame/*`, (r) =>
    r.fulfill({
      path: path.join(folder, "frames", path.basename(new URL(r.request().url()).pathname)),
      contentType: "image/png",
    }),
  );
  await page.goto(`${base}/__clarity-bake.html`);
  process.on("SIGUSR2", () => page.evaluate(() => window.__clarityStop?.()).catch(() => {}));
  const result = await page.evaluate(
    async ({ metadata, inputMeta, steps, seconds, maxSplats, ssim, patch }) => {
      const [
        { createSession, camPosition },
        { readPlyHeader, decimatePly },
        { unbakeOpacityCompensation },
      ] = await Promise.all([
        import("/vendor/splatjs/src/session.js"),
        import("/src/loaders.js"),
        import("/vendor/splatjs/src/io/ply.js"),
      ]);
      const bytes = new Uint8Array(await (await fetch("/__clarity-input.ply")).arrayBuffer());
      const h = readPlyHeader(bytes),
        t = decimatePly(bytes, h, h.count, 7),
        col = Object.fromEntries(t.props.map((p) => [p.name, p.storage]));
      const data = new Float32Array(t.count * 16);
      for (let i = 0; i < t.count; i++)
        data.set(
          [
            col.x[i],
            col.y[i],
            col.z[i],
            col.scale_0[i],
            col.scale_1[i],
            col.scale_2[i],
            col.rot_0[i],
            col.rot_1[i],
            col.rot_2[i],
            col.rot_3[i],
            col.f_dc_0[i],
            col.f_dc_1[i],
            col.f_dc_2[i],
            col.opacity[i],
            0,
            0,
          ],
          i * 16,
        );
      let cams = metadata.cams.map((c, imgIdx) => ({ ...c, imgIdx }));
      const exportCam = inputMeta.bake?.exportCam0 || inputMeta.exportCam0;
      const original = inputMeta.cams.filter((c) => c.poseSource !== "interpolated legacy cameras");
      const inputSide = inputMeta.stats?.trainSide || inputMeta.bake?.exportTrainSide || 640;
      const sourceFocal =
        exportCam?.f ||
        original[0].f * Math.min(1, inputSide / Math.max(original[0].w, original[0].h));
      const exportPositions = inputMeta.exportCameras?.length ? inputMeta.exportCameras : original;
      const restored = unbakeOpacityCompensation(
        data,
        t.count,
        sourceFocal,
        Float32Array.from(exportPositions.flatMap(camPosition)),
        0.1,
      );
      const { requestTrainingDevice } = await import("/tools/cdx-v3d-clarity-gpu.mjs");
      const device = await requestTrainingDevice();
      const gpuErrors = [];
      device.addEventListener("uncapturederror", (event) => {
        gpuErrors.push(event.error.message);
        console.error(`[clarity] GPU error: ${event.error.message}`);
      });
      const session = createSession({
        device,
        maxIters: steps,
        itersPerFrame: 2,
        fenceRing: 1,
        refineStart: 100,
        refineEvery: maxSplats > t.count ? 150 : 1e9,
        maxViewW: 960,
        maxViewH: 960,
        evalHoldEvery: 1e9,
        holdout: -1,
        lossCams: (c) => !c.heldOut,
        frames: { trainMaxDim: 960, featMaxDim: 800 },
        trainer: {
          maxSplats,
          capMult: 2,
          shDeg: 0,
          dilate: 0.1,
          ssimWeight: ssim,
          growUntil: Math.round(steps * 0.75),
          growFrac: 0.25,
          seed: 55,
          posLrScale: 0.1,
          opacityReg: 0.001,
        },
      });
      const log = [];
      session.on("log", (m) => {
        log.push(m);
        console.log(`[clarity] ${m}`);
      });
      let files = await Promise.all(
        cams.map(
          async (c) =>
            new File([await (await fetch(`/__clarity-frame/${c.frame}`)).blob()], c.frame, {
              type: "image/png",
            }),
        ),
      );
      if (patch) {
        const windows = [],
          inputs = [];
        for (const [i, c] of cams.entries()) {
          if (c.heldOut) {
            windows.push(c);
            inputs.push(files[i]);
            continue;
          }
          const bitmap = await createImageBitmap(files[i]);
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = patch;
          const g = canvas.getContext("2d");
          for (let y = 0; y < 3; y++)
            for (let x = 0; x < 3; x++) {
              const left = Math.round(((bitmap.width - patch) * x) / 2),
                top = Math.round(((bitmap.height - patch) * y) / 2);
              g.drawImage(bitmap, left, top, patch, patch, 0, 0, patch, patch);
              const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
              inputs.push(new File([blob], `${i}-${x}-${y}.png`, { type: "image/png" }));
              const sx = bitmap.width / c.w,
                sy = bitmap.height / c.h;
              windows.push({
                ...c,
                crop: true,
                parentFrame: i,
                cropRect: [left, top, patch, patch],
                nativeSize: [bitmap.width, bitmap.height],
                w: patch,
                h: patch,
                f: c.f * sx,
                fy: (c.fy ?? c.f) * sy,
                cx: (c.cx ?? c.w / 2) * sx - left,
                cy: (c.cy ?? c.h / 2) * sy - top,
              });
            }
          bitmap.close();
        }
        cams = windows.map((c, imgIdx) => ({ ...c, imgIdx }));
        files = inputs;
        console.log(
          `[clarity] ${cams.length} native-pixel windows from 960px frames; patch ${patch}; held-out frames have no windows`,
        );
      }
      await session.load(files);
      const internal = cams.map((c, i) => {
        const f = session.frames[i],
          ratio = f.tw / f.fw;
        return {
          ...c,
          f: (c.f * f.fw) / c.w,
          fy: ((c.fy ?? c.f) * f.th) / c.h / ratio,
          cx: ((c.cx ?? c.w / 2) * f.fw) / c.w,
          cy: ((c.cy ?? c.h / 2) * f.th) / c.h / ratio,
          w: f.fw,
          h: f.fh,
        };
      });
      session.useReconstruction({ cams: internal, points: [] });
      await session.seedFrom({ data: restored, n: t.count, shK: 0, dc: "sh" }, { sceneRadius: 10 });
      const held = cams.flatMap((c, i) => (c.heldOut ? [i] : []));
      if (!held.length || held.some((i) => !session.trainer.excluded.has(i)))
        throw new Error("Evaluation frames entered the training loss.");
      const sizes = session.trainer.camMeta.map((c) => ({
        w: c.w,
        h: c.h,
        f: c.f,
        fy: c.fy,
        cx: c.cx,
        cy: c.cy,
      }));
      if (!patch && sizes.some((c) => Math.max(c.w, c.h) !== 960))
        throw new Error("Training below 960 pixels.");
      let last = 0;
      session.on("metrics", (m) => {
        if (m.iter - last >= 20 || m.iter >= steps) {
          console.log(
            `[clarity] ${m.iter}/${steps}; ${m.splats} splats; PSNR ${m.psnrTrain ?? "pending"}`,
          );
          last = m.iter;
        }
      });
      let timedOut = false;
      const trainStarted = performance.now();
      await new Promise((resolve, reject) => {
        let timer,
          ended = false;
        const end = () => {
          if (!ended) {
            ended = true;
            clearTimeout(timer);
            resolve();
          }
        };
        session.on("event", (e) => {
          if (e.kind === "train-complete" || e.kind === "device-lost") end();
        });
        window.__clarityStop = () => session.finish().then(end, reject);
        timer = setTimeout(() => {
          timedOut = true;
          window.__clarityStop();
        }, seconds * 1000);
        session.start();
      });
      if (session.deviceLost) throw new Error("Software WebGPU device lost.");
      await session.trainer.device.queue.onSubmittedWorkDone();
      if (gpuErrors.length) throw new Error(gpuErrors.join("\n"));
      const output = new Uint8Array(await (await session.exportPlyBlob()).arrayBuffer());
      const exportCameras = session.trainer.camMeta.map((c) => ({
        ...c,
        R: Array.from(c.R),
        t: Array.from(c.t),
      }));
      let binary = "";
      for (let i = 0; i < output.length; i += 0x8000)
        binary += String.fromCharCode(...output.subarray(i, i + 0x8000));
      const trained = {
        patch,
        nativeFrameSide: 960,
        steps: session.trainer.iter,
        timedOut,
        seconds: (performance.now() - trainStarted) / 1000,
        inputCount: t.count,
        outputCount: readPlyHeader(output).count,
        ssimWeight: ssim,
        sizes,
        heldOut: held,
        excluded: Array.from(session.trainer.excluded),
        exportCam0: exportCameras[0],
        exportCameras,
        poseSource: "recorded plus interpolated legacy cameras; no new SfM solve",
        sourceFocal,
      };
      session.dispose();
      device.destroy();
      return { ply: btoa(binary), trained, log };
    },
    { metadata, inputMeta, steps, seconds, maxSplats, ssim, patch },
  );
  const out = path.join(folder, output);
  fs.writeFileSync(`${out}.ply`, Buffer.from(result.ply, "base64"));
  const record = {
    ...metadata,
    exportCam0: result.trained.exportCam0,
    exportCameras: result.trained.exportCameras,
    stats: {
      ...metadata.stats,
      frames: metadata.cams.length,
      iters: result.trained.steps,
      trainSide: 960,
      splats: result.trained.outputCount,
      stoppedEarly: result.trained.steps < steps,
    },
    bake: {
      ...metadata.bake,
      backend: "Splat.js/software WebGPU",
      source,
      exportCam0: result.trained.exportCam0,
      exportTrainSide: 960,
      clarity: result.trained,
      warmStartSha256: hash(fs.readFileSync(path.join(folder, `${input}.ply`))),
    },
    log: result.log,
  };
  fs.writeFileSync(`${out}.json`, JSON.stringify(record, null, 2) + "\n");
  console.log(
    JSON.stringify({ id, output, ...result.trained, exportCameras: undefined, sizes: undefined }),
  );
} finally {
  await browser.close();
}
