#!/usr/bin/env node
// Measure the installed model through the real pack, cleanup, kit, camera controller, and Stage.
// <scratch> <id> <phone|desktop>. Default page background is deliberately retained.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { imageMetrics } from "./cdx-v3d-clarity-metrics.mjs";
const [scratch, id, tier] = process.argv.slice(2);
if (!["phone", "desktop"].includes(tier)) throw new Error("Choose phone or desktop.");
const folder = path.resolve(scratch, id),
  ledger = JSON.parse(fs.readFileSync(path.resolve(scratch, "ledger.json")));
const record = ledger.samples.find((s) => s.id === id),
  fixed = JSON.parse(fs.readFileSync(path.join(folder, "main.json")));
const size = fixed.cams[0],
  scale = ledger.side / Math.max(size.w, size.h),
  width = Math.round(size.w * scale),
  height = Math.round(size.h * scale);
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4175/";
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
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}?labs=1&renderer=webgl2&profile=${tier === "phone" ? "low" : "high"}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
  const model = await page.evaluate(
    async ({ id, tier, width, height }) => {
      globalThis.__v3dPhone = tier === "phone";
      const { app, player } = window.__splashery;
      await app.chooseToy("video-3d");
      await app.setToyOptions({ source: id, navigation: "walk" });
      player.opts.idleDelay = 1e9;
      player.idle.weight = 0;
      player.camera.turntable = false;
      player.stage.setFixedSize([width, height]);
      if (player.stage.sharp?.adapt !== "off" || player.stage.reduced)
        throw new Error("The production recipe must keep full resolution without a URL override.");
      const meta = await (await fetch(`/assets/toys/video-3d/${id}.json`)).json();
      const manifest = await (
        await fetch(`/assets/toys/video-3d/${id}-baked/manifest.json`)
      ).json();
      const actual = manifest.tiers.find((t) => t.role === tier);
      if (!actual || player.proc.ctx.kit.data.video.stats.exportedSplats !== actual.splats)
        throw new Error("Auto did not select the intended fitted tier.");
      return {
        sourcePlySha256: actual.sourcePlySha256,
        files: actual.files,
        kernel: player.stage.kernel || "gaussian",
        info: player.proc.ctx.kit.data.video,
        metadata: tier === "desktop" ? meta.desktop : meta,
      };
    },
    { id, tier, width, height },
  );
  const frames = [];
  for (const index of record.heldOut) {
    const data = await page.evaluate(
      async (index) => {
        const { player } = window.__splashery,
          stage = player.stage;
        const k = player.proc.ctx.kit,
          walk = k.data.walk;
        // The installed model's own solved pose at this same frozen photograph, including a new
        // COLMAP coordinate system where present. No image alignment or image crop is applied.
        const p = k.data.flight.path.at(window.__productionTimes[index]);
        walk.resumeAt(p);
        for (let i = 0; i < 8; i++) await stage.captureFrame();
        const canvas = await stage.captureFrame();
        return canvas.toDataURL("image/png");
      },
      await page.evaluate(
        ({ times, index }) => {
          window.__productionTimes = times;
          return index;
        },
        { times: model.metadata.cams.map((c) => c.time), index },
      ),
    );
    const bytes = Buffer.from(data.split(",")[1], "base64");
    const referenceBytes = fs.readFileSync(path.join(folder, "frames", fixed.cams[index].frame));
    const sha256 = (data) => createHash("sha256").update(data).digest("hex");
    if (sha256(referenceBytes) !== fixed.cams[index].frameSha256)
      throw new Error("The frozen reference photograph changed.");
    fs.writeFileSync(path.join(folder, `production-${tier}-${index}.png`), bytes);
    frames.push({
      index,
      referenceSha256: sha256(referenceBytes),
      renderSha256: sha256(bytes),
      ...imageMetrics(PNG.sync.read(bytes), PNG.sync.read(referenceBytes)),
    });
    console.log(`${id} production ${tier} ${index}`);
  }
  if (errors.length) throw new Error(errors.join("\n"));
  const mean = Object.fromEntries(
    ["psnr", "ssim", "laplacian"].map((k) => [
      k,
      frames.reduce((s, f) => s + f[k], 0) / frames.length,
    ]),
  );
  const result = {
    id,
    tier,
    sourcePlySha256: model.sourcePlySha256,
    files: model.files,
    kernel: model.kernel,
    info: model.info,
    renderer:
      "actual production pack and Stage; default page background; exact frozen times; 960px",
    frames,
    mean,
  };
  fs.writeFileSync(
    path.join(folder, `production-${tier}-scores.json`),
    JSON.stringify(result, null, 2) + "\n",
  );
  console.log(JSON.stringify({ id, tier, mean }));
} finally {
  await browser.close();
}
