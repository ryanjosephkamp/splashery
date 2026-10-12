#!/usr/bin/env node
// Public stills for the eight originally reported outliers; keep render pixels intact.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { ALL_SAMPLES } from "../src/packs/photo-3d.js";

const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const root = opt("root", ".cache/cdx-p3d2");
const current = opt("after", "review-r2/final");
const out = opt("out", "docs/audits/photo-3d-r2");
const read = (f) => JSON.parse(fs.readFileSync(path.join(root, f)));
const originalFile = path.join(root, "review-r2/original-outliers.json");
const original = JSON.parse(
  fs.readFileSync(
    fs.existsSync(originalFile)
      ? originalFile
      : "docs/audits/photo-3d-r2/original-eight-poses.json",
  ),
).map((r) => ({ ...r, after: r.originalAfter ?? r.after }));
const buildFile = path.join(root, "review-r2/build.json");
const build = JSON.parse(
  fs.readFileSync(fs.existsSync(buildFile) ? buildFile : "docs/audits/photo-3d-r2/build.json"),
);
for (const [file, hash] of Object.entries(build.files))
  if (createHash("sha256").update(fs.readFileSync(file)).digest("hex") !== hash)
    throw new Error(`Source differs from the evidence build: ${file}`);
const after = read(`${current}/rows.json`);
const before = read("evidence/before.json");
const key = (r) => [r.id, r.view, r.depth, r.angle, r.direction].join(":");
const byPose = new Map(after.map((r) => [key(r), r]));
fs.mkdirSync(out, { recursive: true });
const rows = original.map((r) => {
  const a = byPose.get(key(r));
  if (!a) throw new Error(`Missing current outlier pose: ${key(r)}`);
  return { ...r, after: a.holes, originalAfter: r.after, renderFile: a.file };
});
const browser = await chromium.launch({ executablePath: process.env.SPLASHERY_CHROMIUM });
try {
  const page = await browser.newPage();
  for (const r of rows) {
    const file = `${r.id}-${r.depth}-${r.view}-20-${r.direction}.png`;
    const source = fs.readFileSync(path.join(root, current, r.renderFile));
    const image = await page.evaluate(
      async ({ r, src }) => {
        const c = document.createElement("canvas");
        c.width = 390;
        c.height = 844 + 76;
        const g = c.getContext("2d");
        g.fillStyle = "#fff";
        g.fillRect(0, 0, c.width, c.height);
        g.fillStyle = "#111";
        g.font = "14px sans-serif";
        g.fillText(
          `${r.id} · ${r.view === "splats" ? "Fine Splats (hybrid)" : "Sharp picture"}`,
          8,
          19,
          374,
        );
        g.fillText(
          `${r.id.startsWith("dot-") ? "AI-made Studio · " : ""}Depth ${r.depth} · ${r.direction} 20°`,
          8,
          40,
          374,
        );
        g.fillText(`Clear holes: baseline ${r.before} → current ${r.after}`, 8, 62, 374);
        const img = new Image();
        img.src = src;
        await img.decode();
        g.drawImage(img, 0, 76);
        return c.toDataURL("image/png");
      },
      { r, src: `data:image/png;base64,${source.toString("base64")}` },
    );
    fs.writeFileSync(path.join(out, file), Buffer.from(image.split(",")[1], "base64"));
    r.still = file;
  }
} finally {
  await browser.close();
}
const zero = before.filter((r) => r.angle === 20 && r.holes === 0);
const columns = ["id", "view", "depth", "angle", "direction", "holes"];
fs.writeFileSync(
  path.join(out, "zero-baseline-poses.csv"),
  [columns.join(","), ...zero.map((r) => columns.map((k) => r[k]).join(","))].join("\n") + "\n",
);
fs.writeFileSync(path.join(out, "original-eight-poses.json"), JSON.stringify(rows, null, 2) + "\n");
fs.writeFileSync(path.join(out, "build.json"), JSON.stringify(build, null, 2) + "\n");
fs.copyFileSync(
  path.join(root, "evidence/summary.json"),
  path.join(out, "measurement-summary.json"),
);
const measuredColumns = [
  "id",
  "view",
  "depth",
  "angle",
  "direction",
  "holes",
  "tears",
  "backing",
  "area",
];
fs.writeFileSync(
  path.join(out, "measurements.csv"),
  [
    ["capture", ...measuredColumns].join(","),
    ...[
      ["before", before],
      ["after", after],
    ].flatMap(([capture, measured]) =>
      measured.map((r) => [capture, ...measuredColumns.map((k) => r[k])].join(",")),
    ),
  ].join("\n") + "\n",
);
let table =
  "| Sample | View | Depth | Turn | Baseline holes | Original after | Current after | Still |\n| --- | --- | ---: | --- | ---: | ---: | ---: | --- |\n";
for (const r of rows)
  table += `| ${r.id}${r.id.startsWith("dot-") ? " (AI-made Studio)" : ""} | ${r.view === "splats" ? "Fine Splats (hybrid)" : "Sharp picture"} | ${r.depth} | ${r.direction} 20° | ${r.before} | ${r.originalAfter} | ${r.after} | [View](photo-3d-r2/${r.still}) |\n`;
fs.writeFileSync(path.join(root, "review-r2/outliers-table.md"), table);
const samples = new Set([...rows.map((r) => r.id), "forest", "spiral-stairs", "dot-castle"]);
const assets = read("evidence/asset-records.json");
const media = fs
  .readdirSync(out)
  .filter((f) => /\.(mp4|png)$/.test(f))
  .map((f) => ({
    file: f,
    sha256: createHash("sha256")
      .update(fs.readFileSync(path.join(out, f)))
      .digest("hex"),
    changed: f.endsWith(".mp4")
      ? "Concatenated the existing Sharp and Fine renderer clips; captions are unchanged."
      : "Added an identifying caption above the unresampled 390×844 renderer frame.",
  }));
fs.writeFileSync(
  path.join(out, "media-credits.json"),
  JSON.stringify(
    {
      madeBy: "Ryan with Codex (GPT-6)",
      originalWorkLicense: "CC0",
      sourceImagesUnchanged: true,
      samples: ALL_SAMPLES.filter((s) => samples.has(s.id)),
      existingAssetRecords: assets,
      media,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({ stills: rows.length, zeroBaselinePoses: zero.length, media: media.length }),
);
