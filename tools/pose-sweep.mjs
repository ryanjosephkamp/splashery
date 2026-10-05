#!/usr/bin/env node
// Lane Any pose: every toy's tap, upright, on its side and upside down,
// measured (docs/audits/poses-2026-10.md).
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node tools/pose-sweep.mjs <out.json> [--size=128] [--kitfix] [--from=id] [--only=a,b] [--shelf=food] [--part=1/3]
//
// Each pose turns the whole toy about the camera's line of sight (a quarter
// turn: on its side; a half turn: upside down), through the point the camera
// looks at, as Hands-on poses a toy (Stage.setToyPose). Seen down that line,
// a toy whose effect works in its own frame looks exactly like the upright
// toy turned on the screen, frame for frame. So each posed frame is turned
// back on the screen and compared with the upright frame at the same moment
// after the tap: `err` is the mean color difference (0..255) where either
// frame shows the toy, less the same difference before the tap (`floor`,
// the rendering's own noise), and `move` is how far the upright frames
// moved from the one before the tap (how big the effect is). `rel` is err
// over move. --kitfix poses a kit toy's parts as main did before the Any
// pose engine change (poseKitUniforms), for the "before" sweep. Resumes:
// toys already in <out.json> are skipped.

import { chromium } from "@playwright/test";
import fs from "node:fs";

const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const args = process.argv.slice(2);
const opt = (name, def) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : def;
};
const [outFile] = args.filter((a) => !a.startsWith("--"));
if (!outFile) throw new Error("Usage: node tools/pose-sweep.mjs <out.json>");
const size = Number(opt("size", 128));
const kitfix = args.includes("--kitfix");
const only = opt("only", "") ? opt("only", "").split(",") : null;
const shelf = opt("shelf", "");
const from = opt("from", "");

const { TOYS } = await import("../src/toys.js");
let list = TOYS.filter((t) => (!only || only.includes(t.id)) && (!shelf || t.category === shelf));
if (from)
  list = list.slice(
    Math.max(
      0,
      list.findIndex((t) => t.id === from),
    ),
  );
const done = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : {};

const launch = () =>
  chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
  });
let browser = await launch();
let page = null;
const open = async () => {
  page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  page.on("pageerror", (e) => console.error("page error:", e.message));
  await page.goto(`${base}?renderer=webgl2&profile=mid&adapt=off`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
};
await open();

for (const toy of list) {
  if (done[toy.id]) continue;
  let r;
  try {
    r = await Promise.race([
      page.evaluate((o) => import("/tools/pose-measure.js").then((m) => m.measure(o)), { id: toy.id, size, kitfix }), // prettier-ignore
      new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 600_000)),
    ]);
  } catch (e) {
    r = { error: String(e.message || e).slice(0, 200) };
    await browser.close().catch(() => {});
    browser = await launch();
    await open();
  }
  done[toy.id] = { kind: toy.kind, shelf: toy.category, labs: !!toy.labs, ...r };
  fs.writeFileSync(outFile, JSON.stringify(done, null, 1));
  const s = (p) => (r[p] ? `${p} err ${r[p].err.toFixed(1)} rel ${r[p].rel.toFixed(2)}` : "");
  console.log(`${toy.id}: ${r.error || `${r.mode || "-"} move ${r.move?.toFixed(1)} ${s("side")} ${s("down")}`}`); // prettier-ignore
}
await browser.close();
