#!/usr/bin/env node
// Deterministic phone-size rest and mid-tap stills, plus optional CPU profiles.
// --ids=a,b --out=.cache/phone-speed/visual-before --url=http://127.0.0.1:4173/
// Compare: --compare=.cache/phone-speed/visual-before (writes scores.json).
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { TOYS } from "../src/toys.js";
import { imageMetrics } from "./cdx-v3d-clarity-metrics.mjs";
import { installFirstFrameProbe } from "./pages/phone-speed-metrics.js";
import { installHybridFirstFrameProbe } from "./pages/phone-speed-hybrid.js";

const args = process.argv.slice(2);
const opt = (k, d = "") => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const ids = opt("ids").split(",").filter(Boolean);
if (!ids.length) throw new Error("Pass --ids=a,b.");
if (ids.includes("moving-photo-3d"))
  throw new Error("Live clip stills require a controlled media clock; this protocol omits them.");
const out = path.resolve(opt("out", ".cache/phone-speed/visuals"));
const base = opt("url", "http://127.0.0.1:4173/");
await fs.mkdir(out, { recursive: true });
const protocol = {
  toolSHA256: createHash("sha256")
    .update(await fs.readFile(new URL(import.meta.url)))
    .digest("hex"),
  hybridSHA256: createHash("sha256")
    .update(await fs.readFile(new URL("./pages/phone-speed-hybrid.js", import.meta.url)))
    .digest("hex"),
  sceneSeed: 103,
  wallTime: "2026-10-17T12:00:00Z",
  restSeconds: 0.5,
  stepHz: 60,
  settleDraws: 3,
  calendarOnly: true,
  completedDraws: true,
  synchronousReadback: true,
  nativeComparisonWidth: 1170,
};
const references = opt("compare")
  ? JSON.parse(await fs.readFile(path.join(opt("compare"), "scores.json"), "utf8"))
  : null;
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const rows = [];
try {
  for (const id of ids) {
    const toy = TOYS.find((t) => t.id === id);
    if (!toy) throw new Error(`Unknown toy ${id}`);
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      colorScheme: "light",
      reducedMotion: "no-preference",
      timezoneId: "UTC",
    });
    await context.addInitScript(() => localStorage.setItem("splashery.turntable", "off"));
    await context.addInitScript(installFirstFrameProbe);
    await context.addInitScript(installHybridFirstFrameProbe);
    await context.addInitScript(
      ({ wallTime }) => {
        const NativeDate = Date;
        const fixed = NativeDate.parse(wallTime);
        const fixedNow = () => fixed;
        window.Date = new Proxy(NativeDate, {
          construct(target, args, newTarget) {
            return Reflect.construct(target, args.length ? args : [fixed], newTarget);
          },
          apply() {
            return new NativeDate(fixed).toString();
          },
          get(target, key, receiver) {
            return key === "now" ? fixedNow : Reflect.get(target, key, receiver);
          },
        });
      },
      { wallTime: protocol.wallTime },
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const cdp = await context.newCDPSession(page);
    if (args.includes("--profile")) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.start");
    }
    const url = new URL(base);
    url.search = new URLSearchParams({
      renderer: "webgl2",
      profile: "weak",
      labs: "1",
      adapt: "off",
      "first-toy": id,
    });
    try {
      await page.goto(url.href);
      await page.waitForFunction(
        () => window.__splashery?.ready && window.__phoneSpeedFirstView,
        null,
        { timeout: 120000 },
      );
      if (args.includes("--profile")) {
        const { profile } = await cdp.send("Profiler.stop");
        await fs.writeFile(path.join(out, `${id}.cpuprofile`), JSON.stringify(profile));
      }
      const images = await page.evaluate(async (id) => {
        const { app, player } = window.__splashery;
        app.sound.setEnabled(false);
        player.opts.idleDelay = 1e9;
        player.idle.weight = 0;
        player.scene.seed = 103;
        app.setAutoplay({ turntable: false });
        const stage = player.stage;
        // A canvas copy can remain queued. Complete each real draw so the
        // software GPU cannot accumulate a backlog during controlled steps.
        stage.app.on("postrender", () => window.__phoneSpeedCompleteDraw(stage.device.gl));
        const handlers = stage.updateHandlers.splice(0);
        let pending = 0;
        let diagnosisActive = null;
        stage.updateHandlers.push(() => {
          const dt = pending;
          pending = 0;
          const start = performance.now();
          for (const h of handlers) h(dt);
          diagnosisActive?.updatesMs.push(performance.now() - start);
        });
        // Rebuild with the clock already controlled, resetting recipe-owned
        // state through its normal prepare/build path on both revisions.
        const resetClocks = () => {
          player.time = 0;
          player.motion.kitClock = { t: 0, last: null, rate: 1 };
          player.motion.moveClock = { t: 0, last: null, rate: 1 };
        };
        const rebuild = async () => {
          resetClocks();
          await app.chooseToy(id);
          resetClocks();
        };
        await rebuild();
        const home = () => {
          // Replay flight is the video's tap effect. Let its normal camera
          // driver follow the controlled time instead of forcing an orbit pose.
          if (id === "video-3d") return;
          player.camera.cur = { ...player.camera.home };
          player.camera.tgt = { ...player.camera.home };
          player.camera.vel.yaw = player.camera.vel.pitch = 0;
        };
        const step = async (dt) => {
          home();
          if (player.fluids || player.arcade || player.pictures || player.screen) {
            pending = dt;
            await stage.captureFrame();
            pending = 0;
          } else {
            // Advance every CPU state step, but draw only the compared pose.
            // These recipes have no separately ticking simulation or texture.
            for (const h of handlers) h(dt);
          }
        };
        for (let i = 0; i < 30; i++) await step(1 / 60);
        const shot = async () => {
          home();
          // Wait for completed draws, giving the view sorter time to settle.
          await stage.captureFrame();
          await stage.captureFrame();
          const height = Math.round((390 * player.canvas.height) / player.canvas.width);
          const canvas = await stage.captureFrame(390, height);
          return canvas.toDataURL("image/png");
        };
        await shot();
        // Causal evidence, separate from timed runs: count writes and actual
        // primary-surface work draws while the exact rest pose is unchanged.
        const component = stage.toy.entity.gsplat;
        const setParameter = component.setParameter;
        const undo = [];
        const diagnosis = { uniformWrites: 0, workDraws: 0, updatesMs: [], completedDraws: 0 };
        let completed = 0;
        const countDraw = () => {
          if (stage.device._drawCallsPerFrame > 0) completed++;
        };
        stage.app.on("postrender", countDraw);
        component.setParameter = function (...args) {
          diagnosis.uniformWrites++;
          return setParameter.apply(this, args);
        };
        try {
          diagnosisActive = diagnosis;
          for (const camera of stage.app.renderer.gsplatDirector.camerasMap.values()) {
            for (const layer of camera.layersMap.values()) {
              const pass = layer.gsplatManager.world.workBuffer.renderPass;
              const render = pass.renderSplat;
              pass.renderSplat = function (...args) {
                if (args[0].node === stage.toy.entity) diagnosis.workDraws++;
                return render.apply(this, args);
              };
              undo.push(() => {
                pass.renderSplat = render;
              });
            }
          }
          for (let i = 0; i < 3; i++) {
            await stage.captureFrame();
          }
          diagnosis.completedDraws = completed;
          const idleDraws = diagnosis.workDraws;
          const idleWrites = diagnosis.uniformWrites;
          const idleUpdates = diagnosis.updatesMs.length;
          for (let i = 0; i < 3; i++) {
            player.camera.cur.yaw += 0.05;
            player.camera.tgt.yaw = player.camera.cur.yaw;
            await stage.captureFrame();
          }
          diagnosis.orbitCompletedDraws = completed - diagnosis.completedDraws;
          diagnosis.orbitWorkDraws = diagnosis.workDraws - idleDraws;
          diagnosis.workDraws = idleDraws;
          diagnosis.orbitUniformWrites = diagnosis.uniformWrites - idleWrites;
          diagnosis.uniformWrites = idleWrites;
          diagnosis.orbitUpdatesMs = diagnosis.updatesMs.splice(idleUpdates);
          home();
        } finally {
          diagnosisActive = null;
          stage.app.off("postrender", countDraw);
          component.setParameter = setParameter;
          for (const restore of undo) restore();
        }
        diagnosis.shBands = stage.toy.resource.gsplatData?.shBands ?? null;
        diagnosis.clockDriven = player.proc?.ctx?.shaderClock ?? false;
        diagnosis.addonSplats = stage.toy.addon?.resource.numSplats ?? 0;
        // Start both compared poses from a fresh recipe after the diagnostic
        // orbit, so neither its view sorting nor its state enters the stills.
        await rebuild();
        for (let i = 0; i < 30; i++) await step(1 / 60);
        const rest = await shot();
        const nativeShot = async () => {
          const height = Math.round(
            (1170 * player.canvas.clientHeight) / player.canvas.clientWidth,
          );
          return (await stage.captureFrame(1170, height)).toDataURL("image/png");
        };
        const restNative = await nativeShot();
        const clockState = () => {
          const state = {
            kit: player.motion.kitClock,
            move: player.motion.moveClock,
            time: player.time,
          };
          if (id === "video-3d") {
            const flight = player.motion.ctx?.kit?.data?.flight?.state;
            state.flight = flight && {
              active: flight.active,
              clock: flight.clock,
              time: flight.time ?? null,
              pausedAt: flight.pausedAt,
              done: flight.done,
              offset: flight.off,
            };
            state.view = {
              camera: player.camera.getState(),
              target: player.camera.target,
              fov: stage.cameraEntity.camera.fov,
              horizontalFov: stage.cameraEntity.camera.horizontalFov,
            };
          }
          return structuredClone(state);
        };
        const clocks = { rest: clockState() };
        player.act(null);
        const ctl = player.toyInfo.recipe?.controls?.find(
          (c) => c.key === player.toyInfo.recipe?.action?.key,
        );
        const midTapSeconds = ctl ? Math.min(1.5, Math.max(0.15, (ctl.ease ?? 0.8) * 0.5)) : 0.3;
        const steps = Math.max(1, Math.round(midTapSeconds * 60));
        for (let i = 0; i < steps; i++) await step(midTapSeconds / steps);
        const tap = await shot();
        const tapNative = await nativeShot();
        clocks.tap = clockState();
        return {
          rest,
          tap,
          native: { rest: restNative, tap: tapNative },
          midTapSeconds,
          sceneSeed: player.scene.seed,
          splats: player.toyInfo.splats,
          canvas: [player.canvas.width, player.canvas.height],
          camera: player.camera.getState(),
          controls: { ...player.motion.state },
          diagnosis,
          clocks,
        };
      }, id);
      const row = { id, ...images, errors };
      if (references) {
        const reference = references.rows.find((r) => r.id === id);
        row.referenceError = reference?.error ?? null;
        row.referenceErrors = reference?.errors ?? [];
        row.referenceCanvas = reference?.canvas ?? null;
        row.referenceSplats = reference?.splats ?? null;
        if (!reference || row.referenceError || row.referenceErrors.length)
          throw new Error("The original visual capture is missing or contains runtime errors.");
        if (
          references.browser !== browser.version() ||
          JSON.stringify(references.protocol) !== JSON.stringify(protocol) ||
          JSON.stringify(reference.clocks) !== JSON.stringify(row.clocks)
        )
          throw new Error(
            "Visual comparison requires identical browser, protocol, and controlled clock states.",
          );
      }
      for (const pose of ["rest", "tap"]) {
        const bytes = Buffer.from(images[pose].split(",")[1], "base64");
        const file = `${id}-${pose}.png`;
        await fs.writeFile(path.join(out, file), bytes);
        delete row[pose];
        if (opt("compare")) {
          const reference = PNG.sync.read(await fs.readFile(path.join(opt("compare"), file)));
          const image = PNG.sync.read(bytes);
          row[pose] = imageMetrics(image, reference);
          const diff = new PNG({ width: image.width, height: image.height });
          for (let i = 0; i < image.data.length; i += 4) {
            for (let k = 0; k < 3; k++)
              diff.data[i + k] = Math.min(
                255,
                8 * Math.abs(image.data[i + k] - reference.data[i + k]),
              );
            diff.data[i + 3] = 255;
          }
          await fs.writeFile(path.join(out, `${id}-${pose}-diff8x.png`), PNG.sync.write(diff));
        }
        const nativeBytes = Buffer.from(images.native[pose].split(",")[1], "base64");
        const nativeFile = `${id}-${pose}-native.png`;
        await fs.writeFile(path.join(out, nativeFile), nativeBytes);
        const nativeImage = PNG.sync.read(nativeBytes);
        row.native[pose] = { width: nativeImage.width, height: nativeImage.height };
        if (references) {
          const reference = PNG.sync.read(await fs.readFile(path.join(opt("compare"), nativeFile)));
          Object.assign(row.native[pose], imageMetrics(nativeImage, reference));
        }
      }
      await page.screenshot({ path: path.join(out, `${id}-phone.png`), scale: "device" });
      rows.push(row);
      console.log(
        `${id}: ${row.rest ? `SSIM ${row.rest.ssim.toFixed(6)}/${row.tap.ssim.toFixed(6)}` : "captured"}`,
      );
    } catch (e) {
      rows.push({ id, error: e.message, errors });
      console.log(`${id}: ${e.message}`);
    }
    await fs.writeFile(
      path.join(out, "scores.json"),
      JSON.stringify(
        {
          source: opt(
            "source",
            execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
          ),
          browser: browser.version(),
          protocol,
          measuredAt: new Date().toISOString(),
          rows,
        },
        null,
        2,
      ),
    );
    await context.close();
  }
} finally {
  await browser.close();
}
