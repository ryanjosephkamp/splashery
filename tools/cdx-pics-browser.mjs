// Task 54: production browser eligibility, including the unfiltered 900-pixel splat export.
// Run after the raster sweep, before final selection. Uses the toy's own local-file path.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { read, TEXT } from "./cdx-pics-qr.mjs";
import { resize } from "./qr-scan-lab/sim.mjs";
const directory = "docs/audits/sample-pictures-2026-10";
const candidates = JSON.parse(fs.readFileSync(directory + "/qr-scores.json"));
const rows = fs.existsSync(directory + "/qr-browser-scores.json")
  ? JSON.parse(fs.readFileSync(directory + "/qr-browser-scores.json"))
  : [];
fs.mkdirSync(".cache/cdx-pics/browser", { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
page.on("pageerror", (e) => console.error(e.message));
await page.goto("http://127.0.0.1:4173/?renderer=webgl2&adapt=off&profile=mid&labs=1");
await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
await page.evaluate(async () => {
  await import("/src/packs/qr-craft.js");
  window.__splashery.qrCraft.autoCheck = false;
  await window.__splashery.app.chooseToy("qr-picture");
});
for (const r of candidates.filter((r) => r.eligible)) {
  if (rows.some((x) => x.id === r.id)) continue;
  const result = await page.evaluate(async ({ id, label }) => {
    const { RECIPES } = await import("/src/packs/qr-craft.js");
    const blob = await (await fetch(`/.cache/cdx-pics/qr/${id}.jpg`)).blob();
    await RECIPES["qr-picture"].input.read(
      "",
      label,
      new File([blob], id + ".jpg", { type: "image/jpeg" }),
    );
    await window.__splashery.app.setToyOptions({ picture: "own" });
    const q = window.__splashery.qrCraft;
    const check = await q.checkPicture();
    // Same renderFront protocol as savePNG, without its unrelated busy wait or download.
    // The decoded RGBA output was byte-identical to savePNG on the failing reference.
    const a = window.__splashery.app,
      w = q.picture().woven,
      kit = a.player.proc.ctx.kit;
    const half = w.code.size / 2 + 4;
    const pose = {
      yaw: 0,
      pitch: 0,
      roll: 0,
      distance:
        (half * kit.transform.scale) /
        Math.tan((19 * Math.PI) / 180) /
        (a.player.camera.radius || 1),
    };
    const canvas = await a.withCapture([900, 900], async () => {
      await a.player.renderAt(a.player.time, pose);
      await new Promise((r) => setTimeout(r, 80));
      const shot = await a.player.renderAt(a.player.time, pose);
      const c = document.createElement("canvas");
      c.width = c.height = 900;
      c.getContext("2d").drawImage(shot, 0, 0, 900, 900);
      return c;
    });
    const png = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!png) throw Error("No PNG for " + id);
    return {
      options: q.picture().options,
      check,
      bytes: Array.from(new Uint8Array(await png.arrayBuffer())),
    };
  }, r);
  const png = PNG.sync.read(Buffer.from(result.bytes));
  const phone = resize(png, 330);
  const printText = read(png.data, png.width, png.height),
    phoneText = read(phone.data, phone.width, phone.height);
  const row = {
    id: r.id,
    options: result.options,
    method: "renderFront protocol; reference RGBA identity verified",
    layout: result.check.sizes.map((s) => ({ ppm: s.ppm, ok: s.ok })),
    stage: result.check.stage,
    stageError: result.check.stageError || null,
    phone330: phoneText === TEXT,
    print900: printText === TEXT,
    printPixels: png.width,
    exportSha256: createHash("sha256").update(Buffer.from(result.bytes)).digest("hex"),
  };
  row.eligible =
    result.check.ok && row.stage?.every((s) => s.text === TEXT) && row.phone330 && row.print900;
  rows.push(row);
  fs.writeFileSync(`.cache/cdx-pics/browser/${r.id}.png`, Buffer.from(result.bytes));
  fs.writeFileSync(directory + "/qr-browser-scores.json", JSON.stringify(rows, null, 2) + "\n");
  console.log(
    `${r.id}: stage ${row.stage?.every((s) => s.ok)}, phone ${row.phone330}, print ${row.print900}, eligible ${rows.filter((x) => x.eligible).length}/${rows.length}`,
  );
}
await browser.close();
console.log(`Browser-qualified ${rows.filter((x) => x.eligible).length}/${rows.length}.`);
