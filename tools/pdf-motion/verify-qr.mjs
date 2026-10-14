import fs from "node:fs";
import { PNG } from "pngjs";
import jsQR from "jsqr";

const file = "docs/audits/pdf-motion-2026-10/qr-poster.png";
const png = PNG.sync.read(fs.readFileSync(file));
const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
const expected = "https://ryanjosephkamp.github.io/splashery/embed/?toy=grapes";
if (code?.data !== expected)
  throw new Error("PDF's rendered QR code did not decode to the live grapes toy.");
fs.writeFileSync(
  "docs/audits/pdf-motion-2026-10/qr-check.json",
  JSON.stringify(
    {
      source: file,
      decoder: "jsqr 1.4.0",
      width: png.width,
      height: png.height,
      decoded: code.data,
      passed: true,
    },
    null,
    2,
  ) + "\n",
);
console.log(`QR raster decoded: ${code.data}`);
