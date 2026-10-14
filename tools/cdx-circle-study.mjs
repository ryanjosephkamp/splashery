// Test-only quiet-zone study. No decoder dependency enters the application.
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { encodeQR } from "../src/qr/encode.js";
import { circleLayout } from "../src/qr/circle.js";
import { blur, capture, resize } from "./qr-scan-lab/sim.mjs";
import { readZxing } from "./qr-scan-lab/readers.mjs";

const m = { exports: {} };
new Function(
  "module",
  "exports",
  fs.readFileSync(new URL("../vendor/jsqr/jsQR.js", import.meta.url), "utf8"),
)(m, m.exports);
const jsQR = m.exports.default || m.exports;
export const readDirect = (img) => ({
  jsqr:
    jsQR(new Uint8ClampedArray(img.data), img.width, img.height, {
      inversionAttempts: "dontInvert",
    })?.data ?? null,
  zxing: readZxing(img),
});

const turn = (img) => {
  const data = new Uint8ClampedArray(img.data.length);
  for (let y = 0; y < img.height; y++)
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 4;
      data.set(img.data.subarray(i, i + 4), (x * img.height + img.height - 1 - y) * 4);
    }
  return { width: img.height, height: img.width, data };
};

// Both readers detect the complete frame. Retry orientation and sampling
// when detection fails; no cropping, finder coordinates, or known text hints.
export function readBoth(img) {
  const result = readDirect(img);
  if (result.jsqr !== null && result.zxing !== null) return result;
  for (const scale of [1, 0.875, 1.125, 1.5]) {
    let frame = scale === 1 ? img : resize(img, Math.round(img.width * scale));
    for (let angle = 0; angle < 4; angle++) {
      if (scale !== 1 || angle !== 0) {
        if (result.jsqr === null)
          result.jsqr =
            jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" })
              ?.data ?? null;
        if (result.zxing === null) result.zxing = readZxing(frame);
        if (result.jsqr !== null && result.zxing !== null) return result;
      }
      frame = turn(frame);
    }
  }
  return result;
}

export const LINKS = Array.from(
  { length: 20 },
  (_, i) =>
    `https://example.org/${["a", "gallery", "notes", "workshop"][i % 4]}/${i + 1}${i ? `?q=${"circle".repeat(i)}&page=${i}` : ""}`,
);

export function rasterCircle(code, quiet, width, decoration = true, round = false) {
  const layout = circleLayout(code, quiet);
  const total = 2 * (layout.half + 1);
  const data = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let py = 0; py < width; py++)
    for (let px = 0; px < width; px++) {
      const x = ((px + 0.5) / width - 0.5) * total;
      const y = (0.5 - (py + 0.5) / width) * total;
      const r = Math.floor(code.size / 2 - y);
      const c = Math.floor(x + code.size / 2);
      const rr = Math.hypot(x, y);
      const real = r >= 0 && c >= 0 && r < code.size && c < code.size;
      const dc = x - (c - code.size / 2 + 0.5);
      const dr = y - (code.size / 2 - r - 0.5);
      const dot = decoration && layout.dark(r, c) && (!round || Math.hypot(dc, dr) <= 0.44);
      const dark =
        (real && code.dark[r * code.size + c]) ||
        dot ||
        (decoration && rr <= layout.half && rr >= layout.half - 0.65);
      if (dark) {
        const i = (py * width + px) * 4;
        data[i] = data[i + 1] = data[i + 2] = 20;
      }
    }
  return { width, height: width, data, modules: total };
}

export async function study() {
  const rows = [];
  const failures = [];
  for (const quiet of [1, 2, 3, 4]) {
    const row = {
      quiet,
      trials: 0,
      jsqr: 0,
      zxing: 0,
      both: 0,
      directJsqr: 0,
      directZxing: 0,
      bySize: {},
    };
    for (const ecc of ["L", "M", "Q", "H"])
      for (const [index, text] of LINKS.entries()) {
        const code = encodeQR(text, ecc, { boost: false });
        for (const [size, width] of [
          ["phone", 390],
          ["print", 600],
        ]) {
          const clean = rasterCircle(code, quiet, width);
          const ppm = width / clean.modules;
          const tilted = capture(clean, {
            modules: clean.modules,
            modulePx: ppm,
            yaw: 8,
            pitch: 12,
            roll: 5,
            margin: 0,
            backdrop: [255, 255, 255],
          });
          const conditions = [
            ["clean", clean],
            ["blur", blur(clean, 0.12 * ppm)],
            ["perspective", tilted],
            ["both", blur(tilted, 0.12 * ppm)],
          ];
          const counts = (row.bySize[size] ||= { trials: 0, jsqr: 0, zxing: 0 });
          for (const [condition, img] of conditions) {
            const result = readBoth(img);
            const direct = readDirect(img);
            if (direct.jsqr === text) row.directJsqr++;
            if (direct.zxing === text) row.directZxing++;
            row.trials++;
            counts.trials++;
            for (const decoder of ["jsqr", "zxing"])
              if (result[decoder] === text) {
                row[decoder]++;
                counts[decoder]++;
              }
            if (result.jsqr === text && result.zxing === text) row.both++;
            else
              failures.push({
                quiet,
                ecc,
                index,
                size,
                condition,
                jsqr: result.jsqr === text,
                zxing: result.zxing === text,
              });
          }
        }
      }
    rows.push(row);
    console.log(JSON.stringify(row));
  }
  const selected = rows.find((r) => r.quiet >= 2 && r.both === r.trials)?.quiet ?? null;
  return {
    date: "October 13, 2026",
    links: LINKS,
    decoders: { jsqr: "vendored jsQR 1.4.0", zxing: "@zxing/library 0.21.3" },
    sizes: { phone: 390, print: "600 px, 2 inches at 300 dpi" },
    blur: "Gaussian sigma = 0.12 module",
    perspective: { yaw: 8, pitch: 12, roll: 5 },
    rows,
    selected,
    failures,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await study();
  const out = process.argv[2] || "docs/audits/circular-qr-2026-10-study.json";
  fs.writeFileSync(out, JSON.stringify(result, null, 2) + "\n");
  console.log(`Selected quiet zone: ${result.selected ?? "none passed"}`);
}
