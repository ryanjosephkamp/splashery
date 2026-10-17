// Freeze the exact browser-decoded 640px inputs used by the toy, without opening a scene.
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { SAMPLES } from "../../src/qr-craft/samples.js";
export const SOURCE_DIRECTORY = ".cache/picture-qr-fidelity/review/sources";
export function loadBrowserSource(id) {
  const png = PNG.sync.read(fs.readFileSync(`${SOURCE_DIRECTORY}/${id}.png`)),
    data = new Float32Array(png.width * png.height * 3);
  for (let i = 0; i < png.width * png.height; i++)
    for (let ch = 0; ch < 3; ch++) data[i * 3 + ch] = png.data[i * 4 + ch] / 255;
  return { w: png.width, h: png.height, data };
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const browser = await chromium.launch({
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto("http://127.0.0.1:4173/tools/picture-qr-fidelity/");
  fs.mkdirSync(SOURCE_DIRECTORY, { recursive: true });
  for (const picture of [
    ...SAMPLES,
    ...JSON.parse(fs.readFileSync("tools/picture-qr-fidelity/corpus.json")),
  ]) {
    const file = `${SOURCE_DIRECTORY}/${picture.id}.png`;
    if (fs.existsSync(file)) continue;
    const source = await page.evaluate(async (picture) => {
      const bmp = await createImageBitmap(await (await fetch("/" + picture.file)).blob()),
        f = Math.min(1, 640 / Math.max(bmp.width, bmp.height)),
        c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(bmp.width * f));
      c.height = Math.max(1, Math.round(bmp.height * f));
      c.getContext("2d", { willReadFrequently: true }).drawImage(bmp, 0, 0, c.width, c.height);
      bmp.close();
      return c.toDataURL("image/png");
    }, picture);
    fs.writeFileSync(file, Buffer.from(source.split(",")[1], "base64"));
    console.log(picture.id);
  }
  await browser.close();
}
