// MIT. Decode and area-resample exactly as the production photo path does.
// Shared RGB tensors prevent native decoder/rounding differences from ranking models.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { localServer } from "./p3df/browser.mjs";
const root = path.resolve(".cache/photo-3d-next"),
  folder = path.join(root, "production-inputs");
fs.mkdirSync(folder, { recursive: true });
const inputs = JSON.parse(fs.readFileSync(path.join(root, "depth-inputs.json"))),
  server = await localServer(inputs),
  browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  });
const result = {
  browser: browser.version(),
  side: 518,
  preprocess:
    "production decodePhoto and resampleArea; HWC Float32 RGB in [0,1], before model-specific normalization",
  complete: false,
  rows: [],
};
try {
  const page = await browser.newPage();
  await page.route("**/input-harness", (r) =>
    r.fulfill({
      body: "<!doctype html><title>Local input preparation</title>",
      contentType: "text/html",
    }),
  );
  await page.goto(server.url + "input-harness");
  for (const entry of inputs) {
    const file = path.join(folder, entry.id + ".f32"),
      meta = path.join(folder, entry.id + ".json"),
      photoSha256 = createHash("sha256").update(fs.readFileSync(entry.file)).digest("hex");
    let row;
    if (fs.existsSync(meta) && fs.existsSync(file)) {
      row = JSON.parse(fs.readFileSync(meta));
      if (
        row.photoSha256 !== photoSha256 ||
        createHash("sha256").update(fs.readFileSync(file)).digest("hex") !== row.rgbSha256
      )
        throw new Error("Cached production input changed");
    } else {
      const value = await page.evaluate(async (url) => {
        const { decodePhoto } = await import("/src/packs/photo-3d.js"),
          { modelSize, resampleArea } = await import("/src/photo3d/pixels.js");
        const photo = await decodePhoto(await (await fetch(url)).blob()),
          { dw: w, dh: h } = modelSize(photo.w, photo.h, 518),
          rgb = resampleArea(photo, w, h),
          bytes = new Uint8Array(rgb.buffer);
        let text = "";
        for (let i = 0; i < bytes.length; i += 32768)
          text += String.fromCharCode(...bytes.subarray(i, i + 32768));
        return { w, h, source: [photo.w, photo.h], base64: btoa(text) };
      }, server.inputUrl(entry));
      const bytes = Buffer.from(value.base64, "base64");
      if (bytes.length !== value.w * value.h * 3 * 4) throw new Error("Incomplete RGB tensor");
      fs.writeFileSync(file + ".tmp", bytes);
      fs.renameSync(file + ".tmp", file);
      row = {
        id: entry.id,
        w: value.w,
        h: value.h,
        source: value.source,
        photoSha256,
        rgbSha256: createHash("sha256").update(bytes).digest("hex"),
      };
      fs.writeFileSync(meta + ".tmp", JSON.stringify(row));
      fs.renameSync(meta + ".tmp", meta);
    }
    result.rows.push(row);
    fs.writeFileSync(path.join(folder, "inputs.json"), JSON.stringify(result));
    console.log(entry.id, valueOrSize(row));
  }
  result.complete = true;
} finally {
  fs.writeFileSync(path.join(folder, "inputs.json"), JSON.stringify(result));
  await browser.close();
  await server.close();
}
function valueOrSize(row) {
  return `${row.w}x${row.h}`;
}
