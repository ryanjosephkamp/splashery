// Rebuild the audit's depth figures and numerical quality proxies from local benchmark outputs.
import fs from "node:fs/promises";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { normalizeDepth } from "../src/packs/photo-3d-core.js";
const ids = ["forest", "street", "still-life"];
const groups = [
  "before",
  "fp16",
  "q4f16",
  "da3",
  "video",
  "video-518",
  "side-196",
  "side-294",
  "side-392",
];
const evidence = "src/depth/evidence";
await fs.mkdir(evidence, { recursive: true });
const manifests = {};
for (const g of groups)
  manifests[g] = JSON.parse(await fs.readFile(`.cache/cdx-depth/${g}/timings.json`, "utf8"));
const data = {};
for (const g of groups) {
  data[g] = {};
  for (const id of ids) {
    const row = g.startsWith("video")
      ? manifests[g].rows.find((r) => r.id === id)
      : manifests[g].profiles[0].rows.find((r) => r.id === id);
    const bytes = await fs.readFile(
      `.cache/cdx-depth/${g}/${g.startsWith("video") ? `${id}-0` : `1x-${id}`}.f32`,
    );
    const raw = new Float32Array(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    );
    const d = normalizeDepth(raw);
    const [w, h] = row.output;
    const png = new PNG({ width: w, height: h });
    for (let i = 0; i < d.length; i++) {
      const v = Math.round(d[i] * 255);
      png.data.set([v, v, v, 255], i * 4);
    }
    const pngPath = `.cache/cdx-depth/${g}/${id}-normalized.png`;
    await fs.writeFile(pngPath, PNG.sync.write(png));
    data[g][id] = { w, h, d, raw, pngPath };
  }
}
function at(map, x, y) {
  const u = Math.max(0, Math.min(map.w - 1, x * map.w - 0.5)),
    v = Math.max(0, Math.min(map.h - 1, y * map.h - 0.5));
  const x0 = Math.floor(u),
    y0 = Math.floor(v),
    x1 = Math.min(map.w - 1, x0 + 1),
    y1 = Math.min(map.h - 1, y0 + 1);
  const a = u - x0,
    b = v - y0;
  return (
    ((1 - a) * map.d[y0 * map.w + x0] + a * map.d[y0 * map.w + x1]) * (1 - b) +
    ((1 - a) * map.d[y1 * map.w + x0] + a * map.d[y1 * map.w + x1]) * b
  );
}
function metrics(ref, map) {
  let mae = 0,
    edges = 0,
    edgeRef = 0,
    rough = 0;
  for (let y = 1; y < 63; y++)
    for (let x = 1; x < 95; x++) {
      const u = (x + 0.5) / 96,
        v = (y + 0.5) / 64,
        d = at(map, u, v),
        r = at(ref, u, v);
      mae += Math.abs(d - r);
      edges += Math.abs(d - at(map, u - 1 / 96, v)) + Math.abs(d - at(map, u, v - 1 / 64));
      edgeRef += Math.abs(r - at(ref, u - 1 / 96, v)) + Math.abs(r - at(ref, u, v - 1 / 64));
      // Second difference within the road's lower-center rectangle, a planarity proxy (not truth).
      if (u > 0.3 && u < 0.7 && v > 0.7 && v < 0.95)
        rough += Math.abs(at(map, u - 1 / 96, v) - 2 * d + at(map, u + 1 / 96, v));
    }
  return { mae: mae / (62 * 94), edgeRatio: edges / edgeRef, roadCurvature: rough / (38 * 16) };
}
const quality = {};
for (const g of groups)
  quality[g] = Object.fromEntries(ids.map((id) => [id, metrics(data.before[id], data[g][id])]));
await fs.writeFile(".cache/cdx-depth/quality.json", JSON.stringify(quality, null, 2) + "\n");
const b = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
const p = await b.newPage({ viewport: { width: 1200, height: 900 }, deviceScaleFactor: 1 });
await p.goto("http://127.0.0.1:4173/tests/");
for (const [name, cols] of [
  ["models", ["before", "fp16", "q4f16", "da3", "video-518"]],
  ["sizes", ["before", "side-392", "side-294", "side-196"]],
]) {
  await p.setContent(
    `<style>body{margin:0;padding:24px;background:#f7f5f0;color:#19212a;font:16px system-ui}table{width:100%;table-layout:fixed;border-collapse:collapse}th{padding:10px}td{padding:8px;text-align:center}img{width:100%;height:180px;object-fit:contain;background:#131820}caption{text-align:left;font-size:23px;font-weight:600;padding:0 0 12px}.note{font-size:13px;color:#4b5660}</style><table><caption>Relative inverse depth: ${name === "models" ? "candidate models" : "input sizes"}</caption><tr><th>Sample</th>${cols.map((g) => `<th>${g === "before" ? "V2 int8 · 518" : g.startsWith("video") ? `Video V2 · ${g === "video-518" ? 518 : 196}` : g}</th>`).join("")}</tr>${ids.map((id) => `<tr><th>${id}</th>${cols.map((g) => `<td><img src="http://127.0.0.1:4173/${data[g][id].pngPath}" alt="${g} depth of ${id}"></td>`).join("")}</tr>`).join("")}</table><p class="note">White is nearer. Each map uses its own 2nd–98th percentile. These are model guesses, not measured geometry. Video V2 uses a padded 32-frame context in a native CPU research run.</p>`,
  );
  await p.locator("img").evaluateAll((imgs) => Promise.all(imgs.map((i) => i.decode())));
  await p.screenshot({ path: `${evidence}/${name}.png`, fullPage: true });
}
await b.close();
// Commit small metadata, not model binaries or the large float maps.
const capture = {};
for (const g of [
  "before",
  "after",
  "fp16",
  "q4f16",
  "da3",
  "video",
  "video-518",
  "side-196",
  "side-294",
  "side-392",
])
  capture[g] = JSON.parse(await fs.readFile(`.cache/cdx-depth/${g}/timings.json`, "utf8"));
for (const g of ["fp16-all", "q4f16-all", "da3-all", "video-518"])
  capture[g] = JSON.parse(await fs.readFile(`.cache/cdx-depth/${g}/timings.json`, "utf8"));
capture.quality = quality;
for (const [key, file] of [
  ["capabilities", "capabilities.json"],
  ["clips", "clips.json"],
  ["frames", "frames.json"],
  ["temporal", "temporal.json"],
])
  capture[key] = JSON.parse(await fs.readFile(`.cache/cdx-depth/${file}`, "utf8"));
await fs.writeFile(`${evidence}/measurements.json`, JSON.stringify(capture, null, 2) + "\n");
console.log(quality);
