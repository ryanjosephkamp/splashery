#!/usr/bin/env node
// Collect registered renders without modifying or resampling their pixels.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { ALL_SAMPLES } from "../src/packs/photo-3d.js";
const opt = (n, d) => process.argv.find((x) => x.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
const root = opt("root", ".cache/cdx-p3d2");
const out = path.join(root, "evidence");
fs.mkdirSync(out, { recursive: true });
const read = (dir) =>
  JSON.parse(fs.readFileSync(path.join(root, dir, "rows.json"))).map((r) => ({
    ...r,
    directory: dir,
  }));
const backingBefore = read("backing-before");
const key = (r) => [r.id, r.view, r.depth, r.angle, r.direction].join(":");
const backingByPose = new Map(backingBefore.map((r) => [key(r), r]));
const before = [...read("before"), ...read("before-extra")].map((r) => {
  const b = backingByPose.get(key(r));
  if (b) return { ...r, backing: b.backing, backingRuns: b.backingRuns };
  return r.view === "splats" ? { ...r, backing: null, backingRuns: null } : r;
});
const final20 = read("final20");
if (final20.length !== 864 || backingBefore.length !== 432)
  throw new Error("Incomplete current 20-degree sweep or backing baseline.");
// Final ordering and handoff fixes do not alter the relief topology. Use the
// fresh sweep for the acceptance angle; keep earlier 10/30-degree sensitivity
// captures with their source directories so the provenance remains explicit.
const after = [
  ...read("final")
    .filter((r) => r.angle !== 20)
    .map((r) => (r.view === "splats" ? { ...r, backing: null, backingRuns: null } : r)),
  ...(fs.existsSync(path.join(root, "final-tail", "rows.json")) ? read("final-tail") : []),
  ...final20,
];
if (before.length !== 2592 || after.length !== 2592)
  throw new Error(`Incomplete sweep: ${before.length}/${after.length}; need 2592 each.`);
for (const rows of [before, after]) {
  if (new Set(rows.map(key)).size !== rows.length) throw new Error("Duplicate measurement poses.");
  for (const sample of ALL_SAMPLES)
    for (const view of ["sharp", "splats"])
      for (const depth of [0.2, 0.5, 1])
        for (const angle of [10, 20, 30])
          for (const direction of ["left", "right", "up", "down"])
            if (!rows.some((r) => key(r) === key({ id: sample.id, view, depth, angle, direction })))
              throw new Error(`Missing pose: ${sample.id}/${view}/${depth}/${angle}/${direction}`);
}
const summary = [];
for (const sample of ALL_SAMPLES)
  for (const view of ["sharp", "splats"]) {
    const totals = [before, after].map((rows) =>
      rows
        .filter((r) => r.id === sample.id && r.view === view && r.angle === 20)
        .reduce(
          (a, r) => ({
            holes: a.holes + r.holes,
            tears: a.tears + r.tears,
            backing: a.backing + r.backing,
          }),
          { holes: 0, tears: 0, backing: 0 },
        ),
    );
    const [b, a] = totals;
    summary.push({
      id: sample.id,
      label: sample.label,
      view,
      before: b,
      after: a,
      reduction: b.holes ? 100 * (1 - a.holes / b.holes) : null,
      pass: a.holes <= b.holes * 0.2 && a.tears <= b.tears * 0.2,
    });
  }
fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(out, "before.json"), JSON.stringify(before, null, 2));
fs.writeFileSync(path.join(out, "after.json"), JSON.stringify(after, null, 2));
fs.writeFileSync(path.join(out, "samples-and-credits.json"), JSON.stringify(ALL_SAMPLES, null, 2));
const records = JSON.parse(fs.readFileSync("tools/assets.json")).photoSamples.map((r) => ({
  ...r,
  sha256: createHash("sha256").update(fs.readFileSync(r.file)).digest("hex"),
  depthSha256: createHash("sha256").update(fs.readFileSync(r.depth)).digest("hex"),
  evidenceChange:
    "Rendered the existing photo/depth in both views; source files are unchanged. Captions identify AI-made Studio samples and the Fine Splats hybrid.",
}));
fs.writeFileSync(path.join(out, "asset-records.json"), JSON.stringify(records, null, 2));
const columns = ["id", "view", "depth", "angle", "direction", "holes", "tears", "backing", "area"];
for (const [name, rows] of [
  ["before", before],
  ["after", after],
])
  fs.writeFileSync(
    path.join(out, `${name}.csv`),
    [columns.join(","), ...rows.map((r) => columns.map((c) => r[c]).join(","))].join("\n") + "\n",
  );
let table =
  "| Sample | Sharp clear holes | Splats clear holes | Sharp tear pixels | Splats elongated splats |\n| --- | ---: | ---: | ---: | ---: |\n";
for (const s of ALL_SAMPLES) {
  const a = summary.find((r) => r.id === s.id && r.view === "sharp"),
    b = summary.find((r) => r.id === s.id && r.view === "splats");
  table += `| ${s.id}${s.id.startsWith("dot-") ? " (AI-made Studio)" : ""} | ${a.before.holes} → ${a.after.holes} | ${b.before.holes} → ${b.after.holes} | ${a.before.tears} → ${a.after.tears} | ${b.before.tears} → ${b.after.tears} |\n`;
}
fs.writeFileSync(path.join(out, "table.md"), table);
let backingTable =
  "| Sample | Sharp backing exposure | Splats backing exposure |\n| --- | ---: | ---: |\n";
for (const sample of ALL_SAMPLES) {
  const s = summary.find((r) => r.id === sample.id && r.view === "sharp");
  const g = summary.find((r) => r.id === sample.id && r.view === "splats");
  backingTable += `| ${sample.id} | ${s.before.backing} → ${s.after.backing} | ${g.before.backing} → ${g.after.backing} |\n`;
}
fs.writeFileSync(path.join(out, "backing-table.md"), backingTable);
const beforeByPose = new Map(before.map((r) => [key(r), r]));
const poseOutliers = after.filter(
  (r) => r.angle === 20 && r.holes > beforeByPose.get(key(r)).holes * 0.2,
);
fs.writeFileSync(path.join(out, "pose-outliers.json"), JSON.stringify(poseOutliers, null, 2));
const angles = [10, 20, 30].map((angle) => ({
  angle,
  totals: [before, after].map((rows) =>
    rows
      .filter((r) => r.angle === angle)
      .reduce((a, r) => ({ holes: a.holes + r.holes, tears: a.tears + r.tears }), {
        holes: 0,
        tears: 0,
      }),
  ),
}));
fs.writeFileSync(path.join(out, "angles.json"), JSON.stringify(angles, null, 2));
const browser = await chromium.launch({ executablePath: process.env.SPLASHERY_CHROMIUM });
try {
  const page = await browser.newPage();
  const worstViews = (rows) =>
    ["sharp", "splats"].flatMap((view) =>
      rows
        .filter((r) => r.view === view)
        .sort((a, b) => b.holes + b.tears - a.holes - a.tears)
        .slice(0, 6),
    );
  const baselineWorst = worstViews(before);
  const afterByPose = new Map(after.map((r) => [key(r), r]));
  for (const [name, worst] of [
    ["before", baselineWorst],
    ["after-baseline", baselineWorst.map((r) => afterByPose.get(key(r)))],
    ["after", worstViews(after)],
  ]) {
    const images = worst.map((r) => ({
      ...r,
      image: `data:image/png;base64,${fs.readFileSync(path.join(root, r.directory, r.file)).toString("base64")}`,
    }));
    const image = await page.evaluate(async (rows) => {
      const c = document.createElement("canvas");
      c.width = 390 * 4;
      c.height = (844 + 66) * 3;
      const g = c.getContext("2d");
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      for (let k = 0; k < rows.length; k++) {
        const r = rows[k],
          x = (k % 4) * 390,
          y = Math.floor(k / 4) * (844 + 66);
        g.fillStyle = "#111";
        g.font = "16px sans-serif";
        g.fillText(
          `${r.id} · ${r.view === "splats" && r.directory.startsWith("final") ? "Fine Splats (hybrid)" : r.view}`,
          x + 8,
          y + 18,
          374,
        );
        g.fillText(
          `${r.id.startsWith("dot-") ? "AI-made Studio · " : ""}Depth ${r.depth} · ${r.direction} ${r.angle}°`,
          x + 8,
          y + 38,
          374,
        );
        g.fillText(`Clear holes ${r.holes} · tears ${r.tears}`, x + 8, y + 58, 374);
        const i = new Image();
        i.src = r.image;
        await i.decode();
        g.drawImage(i, x, y + 66);
      }
      return c.toDataURL("image/png");
    }, images);
    fs.writeFileSync(
      path.join(out, `${name}-worst.png`),
      Buffer.from(image.split(",")[1], "base64"),
    );
    fs.writeFileSync(path.join(out, `${name}-worst.json`), JSON.stringify(worst, null, 2));
  }
} finally {
  await browser.close();
}
console.log(
  JSON.stringify(
    {
      renders: before.length + after.length,
      passed: summary.filter((r) => r.pass).length,
      total: summary.length,
      failures: summary.filter((r) => !r.pass),
    },
    null,
    2,
  ),
);
