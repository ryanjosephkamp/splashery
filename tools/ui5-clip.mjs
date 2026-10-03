#!/usr/bin/env node
// Lane UI r5: records the lane's review clips (page flows, not one tap) with
// Playwright's video recorder, then turns each into an MP4 with ffmpeg
// (imageio-ffmpeg's). A white dot shows the finger.
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   node tools/ui5-clip.mjs <out-dir> [clip names...]
//
// Clips: gallery-390, gallery-1440, rotation-390, songbar-390, model-390, record-390.

import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const [outDir, ...only] = process.argv.slice(2);
if (!outDir) throw new Error("Usage: node tools/ui5-clip.mjs <out-dir> [clip names...]");
fs.mkdirSync(outDir, { recursive: true });
const ffmpeg = execFileSync("python3", ["-c", "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"]).toString().trim(); // prettier-ignore

const PHONE = { width: 390, height: 844 };
const DESK = { width: 1440, height: 900 };
const wait = (page, s) => page.waitForTimeout(s * 1000);

async function pick(page, id) {
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id, id, { timeout: 120_000 }); // prettier-ignore
  await page.evaluate(() => window.__splashery.player.camera.setTurntable(false));
}

async function tapAt(page, x, y) {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await wait(page, 0.12);
  await page.mouse.up();
}

async function tapEl(page, sel) {
  const b = await page.locator(sel).boundingBox();
  await tapAt(page, b.x + b.width / 2, b.y + b.height / 2);
}

async function drag(page, x0, y0, x1, y1, steps = 14) {
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await wait(page, 0.04);
  }
  await page.mouse.up();
}

async function openRealModel(page) {
  const dir = process.env.UI5_MODEL_DIR;
  if (!dir) throw new Error("Set UI5_MODEL_DIR to a folder with a glTF and its files.");
  const files = [];
  const walk = (d) =>
    fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f);
      else if (/\.(gltf|glb|bin|jpe?g|png|webp|obj|mtl|stl)$/i.test(e.name)) files.push(f);
    });
  walk(dir);
  await pick(page, "model-splats");
  await wait(page, 1.5);
  const phone = page.viewportSize().width < 700;
  if (phone) await page.click("#sheet-toggle");
  await wait(page, 1);
  await page.locator("#toy-input-file").setInputFiles(files);
  const main = path
    .basename(files.find((f) => /\.(gltf|glb|obj|stl)$/i.test(f)))
    .replace(/\.[^.]+$/, "");
  await page.waitForFunction((n) => window.__splashery.player.proc?.ctx?.kit?.data?.model?.name === n, main, { timeout: 300_000 }); // prettier-ignore
  await wait(page, 0.5);
  await page.evaluate(() => document.getElementById("toy-input")?.scrollIntoView({ block: "center" })); // prettier-ignore
  await wait(page, 2.5);
  if (phone) await page.click("#sheet-toggle");
  await wait(page, 1.5);
  const b = await page.locator("#stage").boundingBox();
  await drag(
    page,
    b.x + b.width * 0.15,
    b.y + b.height * 0.5,
    b.x + b.width * 0.85,
    b.y + b.height * 0.5,
    30,
  );
  await wait(page, 2);
}

const CLIPS = {
  async "gallery-390"(page) {
    await wait(page, 1.5);
    for (let i = 0; i < 14; i++) {
      await page.evaluate(() => (document.getElementById("shelf-chips").scrollLeft += 100));
      await wait(page, 0.08);
    }
    await wait(page, 1);
    await tapEl(page, "#gallery-open");
    await wait(page, 2.5);
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => (document.getElementById("shelf").scrollTop += 50));
      await wait(page, 0.08);
    }
    await wait(page, 1);
    await tapEl(page, "#gallery-open");
    await wait(page, 2);
    console.log("gallery-390 ends with:", await page.evaluate(() => document.body.className));
  },
  async "gallery-1440"(page) {
    await wait(page, 1.5);
    await tapEl(page, "#gallery-open");
    await wait(page, 2.5);
    await tapEl(page, ".toy-card[data-toy='earth']");
    await wait(page, 3);
  },
  async "rotation-390"(page) {
    for (const id of ["book", "umbrella", "xylophone", "upright-piano"]) {
      await pick(page, id);
      await wait(page, 1.5);
      const b = await page.locator("#stage").boundingBox();
      const x = b.x + b.width * 0.1;
      await drag(page, x, b.y + b.height * 0.25, x + 30, b.y + b.height * 0.25 + 170);
      await wait(page, 1.2);
      await drag(page, x, b.y + b.height * 0.55, x + 20, b.y + b.height * 0.55 - 230);
      await wait(page, 1.2);
    }
  },
  async "songbar-390"(page) {
    for (const id of [
      "grand-piano",
      "upright-piano",
      "harpsichord",
      "electronic-keyboard",
      "chess-set",
    ]) {
      await pick(page, id);
      await wait(page, 2.5);
    }
    await pick(page, "grand-piano");
    await wait(page, 1);
    await tapEl(page, "#game-play");
    await wait(page, 5);
  },
  async "model-390"(page) {
    await pick(page, "model-splats");
    await wait(page, 2);
    await page.click("#sheet-toggle");
    await wait(page, 1);
    const file = path.resolve("test-results/ui5-3m.glb");
    if (!fs.existsSync(file)) execFileSync("node", ["tools/ui5-big-model.mjs", file, "3000000"]);
    await page.locator("#toy-input-file").setInputFiles(file);
    await page.waitForFunction(() => window.__splashery.player.proc?.ctx?.kit?.data?.model?.name === "ui5-3m", null, { timeout: 300_000 }); // prettier-ignore
    await wait(page, 2);
    await page.locator("#toy-input").scrollIntoViewIfNeeded();
    await wait(page, 2);
    await page.click("#sheet-toggle");
    await wait(page, 1);
    await page.evaluate(() => window.__splashery.app.act());
    await wait(page, 4);
  },
  // A real model, every file of it (UI5_MODEL_DIR: a downloaded glTF with its
  // .bin and textures, e.g. a Poly Haven scan; not kept in the repository).
  async "model-real-390"(page) {
    await openRealModel(page);
  },
  async "model-real-1440"(page) {
    await openRealModel(page);
  },
  async "record-390"(page) {
    await pick(page, "toy-piano");
    await page.evaluate(() => window.__splashery.app.sound.setEnabled(true));
    await wait(page, 1.5);
    await tapEl(page, "#sheet-toggle");
    await wait(page, 0.8);
    await tapEl(page, "#tab-share");
    await wait(page, 1);
    await page.locator("#record-row").scrollIntoViewIfNeeded();
    await wait(page, 1);
    await tapEl(page, "#record-start");
    await wait(page, 1);
    const b = await page.locator("#stage").boundingBox();
    await drag(
      page,
      b.x + b.width * 0.12,
      b.y + b.height * 0.42,
      b.x + b.width * 0.12,
      b.y + b.height * 0.85,
    );
    await wait(page, 0.5);
    await page.evaluate(() => window.__splashery.app.act());
    await wait(page, 4);
    await tapEl(page, "#rec-stop");
    await page.locator("#rec-save").waitFor({ state: "visible", timeout: 20_000 });
    await wait(page, 4);
    const download = page.waitForEvent("download");
    await tapEl(page, "#rec-save");
    // What Record saved, as its own clip.
    const d = await download;
    const saved = path.join(outDir, `.${d.suggestedFilename()}`);
    await d.saveAs(saved);
    execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-i", saved, "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-r", "30", "-c:v", "libx264", "-crf", "24", "-c:a", "aac", path.join(outDir, "ui5-record-output.mp4")]); // prettier-ignore
    fs.rmSync(saved);
    await wait(page, 3);
  },
};

const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/opt/pw-browsers/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
for (const [name, run] of Object.entries(CLIPS)) {
  if (only.length && !only.includes(name)) continue;
  const size = name.endsWith("1440") ? DESK : PHONE;
  const phone = size === PHONE;
  const tmp = fs.mkdtempSync(path.join(outDir, `.${name}-`));
  const ctx = await browser.newContext({ viewport: size, hasTouch: phone, isMobile: phone, acceptDownloads: true, recordVideo: { dir: tmp, size } }); // prettier-ignore
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(name, "ERR", e.message));
  await page.goto(
    `${base}?renderer=webgl2&profile=${name.startsWith("model-real") ? "high" : "weak"}`,
  );
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  // The finger: a white dot where the pointer is down.
  await page.addStyleTag({ content: "#ui5-dot{position:fixed;z-index:99;width:30px;height:30px;margin:-15px 0 0 -15px;border-radius:50%;background:rgba(255,255,255,.85);border:2px solid rgba(0,0,0,.45);pointer-events:none;display:none}" }); // prettier-ignore
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.id = "ui5-dot";
    document.body.append(d);
    const at = (e) => Object.assign(d.style, { left: `${e.clientX}px`, top: `${e.clientY}px` });
    addEventListener("pointerdown", (e) => (at(e), (d.style.display = "block")), true);
    addEventListener("pointermove", at, true);
    addEventListener("pointerup", () => setTimeout(() => (d.style.display = "none"), 150), true);
  });
  const t0 = Date.now();
  await run(page);
  await ctx.close();
  const webm = fs.readdirSync(tmp).find((f) => f.endsWith(".webm"));
  const out = path.join(outDir, `ui5-${name}.mp4`);
  // The page's load is cut (the clip starts when the flow does).
  const skip = Math.max(0, (Date.now() - t0) / 1000);
  execFileSync(ffmpeg, ["-y", "-loglevel", "error", "-sseof", `-${skip.toFixed(2)}`, "-i", path.join(tmp, webm), "-movflags", "+faststart", "-pix_fmt", "yuv420p", "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:v", "libx264", "-crf", "24", out]); // prettier-ignore
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(out, `${(fs.statSync(out).size / 1e6).toFixed(2)} MB`);
}
await browser.close();
