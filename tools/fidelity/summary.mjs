#!/usr/bin/env node
// Lane Fidelity: one Markdown table from a run of tools/fidelity/run-orrery.sh: per part, its
// training views and time, and for each packed file its splats, size, PSNR and SSIM on the
// held-out views (from tools/fidelity/measure.mjs).
//
//   node tools/fidelity/summary.mjs ~/splashery-fidelity/orrery

import fs from "node:fs";
import path from "node:path";

const work = process.argv[2];
if (!work) throw new Error("Usage: node tools/fidelity/summary.mjs <work dir>");
const read = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);
const info = read(path.join(work, "data/parts.json"));
const seconds = Object.fromEntries(
  (fs.existsSync(path.join(work, "trained/seconds.txt"))
    ? fs.readFileSync(path.join(work, "trained/seconds.txt"), "utf8").trim().split("\n")
    : []
  ).map((l) => l.split(" ")),
);
const names = [...info.parts.map((p) => p.name), "whole"];
const mb = (b) => (b / 1048576).toFixed(2);
const lines = [
  "| Part | Render (s) | Train (s) | File | Splats | MB | PSNR (dB) | SSIM |",
  "| --- | --- | --- | --- | --- | --- | --- | --- |",
];
const sum = { full: [0, 0], lite: [0, 0] };
for (const name of names) {
  const d = info.datasets?.[name];
  const render = d ? d.seconds.train + d.seconds.test : "";
  const kinds = name === "whole" ? ["", "-nosh"] : ["", "-lite", "-sh"];
  kinds.forEach((k, i) => {
    const m = read(path.join(work, "measure", `${name}${k}`, "measure.json"));
    if (!m) return;
    const total = name === "whole" ? null : k === "" ? sum.full : k === "-lite" ? sum.lite : null;
    if (total) {
      total[0] += m.splats;
      total[1] += m.bytes;
    }
    lines.push(
      `| ${i ? "" : name} | ${i ? "" : render} | ${i ? "" : (seconds[name] ?? "")} | ${m.file} | ${m.splats} | ${mb(m.bytes)} | ${m.psnr.toFixed(2)} | ${m.ssim.toFixed(4)} |`,
    );
  });
}
lines.push("");
lines.push(`Parts toy, full: ${sum.full[0]} splats, ${mb(sum.full[1])} MB.`);
lines.push(`Parts toy, lite: ${sum.lite[0]} splats, ${mb(sum.lite[1])} MB.`);
console.log(lines.join("\n"));
