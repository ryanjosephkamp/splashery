// Lane ASCII r2: the legibility check for the ASCII lab's toy list. Captures
// each candidate in src/ascii-capture/toys.json through the lab page (one
// fresh job each, at 96 columns, mono, the same GIF a person gets), decodes the
// GIF and scores its text area:
//
//   fill    how much of the frame the subject covers: the share of character
//           cells that carry ink, and how far the subject spans the grid
//   edge    contrast after the character map: the mean luminance step between
//           neighboring cells where one of them carries ink
//   motion  the share of cells that change from one frame to the next after
//           the tap (frames 4 to 39)
//
//   node tools/asc2-check.mjs [--ids=a,b] [--workers=3] [--gifs=<dir>]
//        [--apply] [--sheets=<dir>] [--report=<file>] [--calibrate]
//
// --apply writes each toy's scores and verdict into toys.json (`check`), which
// is what the lab lists; --sheets writes a contact sheet of each shelf's passing
// toys' first frames; --calibrate also runs the three approved presets. The
// server must be running (python3 -m http.server 4173 --bind 127.0.0.1).
// SPLASHERY_CHROMIUM picks the browser.

import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import { GifReader } from "../vendor/omggif/omggif.js";

// The thresholds (set from the three approved presets, docs/audits/ascii-capture-2026-10/README.md).
export const LIMITS = {
  fillMin: 0.1, // inked cells, share of the grid, in the first frame
  fillMax: 0.9, // above this the subject runs off the frame
  spanMin: 0.45, // the subject spans this much of the grid's width or height
  edgeMin: 0.02,
  motionMin: 0.0015,
};

const CELL_W = 6; // the GIF's character cell: bold 10 px monospace, 12 px lines
const CELL_H = 12;
const BACK = 17;

const args = process.argv.slice(2);
const opt = (name, d) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? d; // prettier-ignore
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const ROOT = new URL("../", import.meta.url);
const LIST = new URL("src/ascii-capture/toys.json", ROOT);

// The GIF's comment block (src/ascii-capture/gif.js puts it before the first image).
function readComment(bytes) {
  let i = 13 + (bytes[10] & 0x80 ? 3 * 2 ** ((bytes[10] & 7) + 1) : 0);
  if (bytes[i] !== 0x21 || bytes[i + 1] !== 0xfe) throw new Error("no comment block");
  i += 2;
  const parts = [];
  for (let len; (len = bytes[i]); i += len + 1) parts.push(bytes.subarray(i + 1, i + 1 + len));
  return new TextDecoder().decode(Buffer.concat(parts));
}

// Scores a decoded GIF: frames of RGBA, with the grid read from the credit comment.
export function scoreGif(bytes) {
  const reader = new GifReader(bytes);
  const meta = JSON.parse(readComment(bytes));
  const { columns, rows } = meta.settings;
  const w = reader.width;
  const buf = new Uint8Array(w * reader.height * 4);
  const grids = [];
  for (let f = 0; f < reader.numFrames(); f++) {
    reader.decodeAndBlitFrameRGBA(f, buf);
    const grid = new Float32Array(columns * rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < columns; c++) {
        let sum = 0;
        for (let y = 0; y < CELL_H; y++)
          for (let x = 0; x < CELL_W; x++) {
            const i = ((8 + r * CELL_H + y) * w + 8 + c * CELL_W + x) * 4;
            sum += 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2];
          }
        grid[r * columns + c] = Math.max(0, sum / (CELL_W * CELL_H) - BACK) / (255 - BACK);
      }
    grids.push(grid);
  }
  const INK = 0.02;
  const first = grids[0];
  let inked = 0;
  let [x0, x1, y0, y1] = [columns, -1, rows, -1];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++)
      if (first[r * columns + c] > INK) {
        inked++;
        x0 = Math.min(x0, c);
        x1 = Math.max(x1, c);
        y0 = Math.min(y0, r);
        y1 = Math.max(y1, r);
      }
  const fill = inked / (columns * rows);
  const span = inked ? Math.max((x1 - x0 + 1) / columns, (y1 - y0 + 1) / rows) : 0;
  // Edge contrast: the mean step between neighboring cells where either is inked.
  let steps = 0;
  let n = 0;
  const g = grids[Math.min(grids.length - 1, 12)];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const v = g[r * columns + c];
      for (const [dr, dc] of [
        [0, 1],
        [1, 0],
      ]) {
        // prettier-ignore
        if (r + dr >= rows || c + dc >= columns) continue;
        const u = g[(r + dr) * columns + c + dc];
        if (v > INK || u > INK) {
          steps += Math.abs(v - u);
          n++;
        }
      }
    }
  const edge = n ? steps / n : 0;
  // Motion: the share of cells that change by a visible step, frame to frame, after the tap.
  let changed = 0;
  let pairs = 0;
  for (let f = 4; f < grids.length; f++) {
    let k = 0;
    for (let i = 0; i < grids[f].length; i++) if (Math.abs(grids[f][i] - grids[f - 1][i]) > 0.08) k++; // prettier-ignore
    changed += k / grids[f].length;
    pairs++;
  }
  const motion = pairs ? changed / pairs : 0;
  const round = (v) => Math.round(v * 1000) / 1000;
  return { columns, rows, frames: grids.length, fill: round(fill), span: round(span), edge: round(edge), motion: round(motion), grids, width: w, height: reader.height }; // prettier-ignore
}

export function verdict(s) {
  const why = [];
  if (s.fill < LIMITS.fillMin) why.push(`subject fills only ${Math.round(s.fill * 100)}% of the frame`); // prettier-ignore
  if (s.fill > LIMITS.fillMax) why.push(`subject fills ${Math.round(s.fill * 100)}% of the frame, so it runs off the edges`); // prettier-ignore
  if (s.span < LIMITS.spanMin) why.push(`subject spans only ${Math.round(s.span * 100)}% of the grid`); // prettier-ignore
  if (s.edge < LIMITS.edgeMin) why.push(`edge contrast ${s.edge} is below ${LIMITS.edgeMin}`);
  if (s.motion < LIMITS.motionMin) why.push(`motion ${s.motion} is below ${LIMITS.motionMin}`);
  return why;
}

async function capture(browser, id, gifDir) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }); // prettier-ignore
  const page = await context.newPage();
  try {
    await page.goto(new URL("ascii-lab.html?all=1&profile=high&deadline=180", base).href);
    await page.waitForSelector("body[data-ready='true']");
    await page.selectOption("#preset", id);
    await page.selectOption("#columns", "96");
    await page.locator("#color").setChecked(false);
    await page.click("#capture");
    await page.waitForFunction(() => ["done", "failed"].includes(document.body.dataset.state), null, { timeout: 240_000 }); // prettier-ignore
    if ((await page.getAttribute("body", "data-state")) !== "done")
      throw new Error(await page.textContent("#status"));
    const pending = page.waitForEvent("download");
    await page.click("#download");
    const file = await pending;
    const out = path.join(gifDir, `${id}.gif`);
    await file.saveAs(out);
    return await fs.readFile(out);
  } finally {
    await context.close();
  }
}

// A contact sheet: each toy's first frame (the text area only), four to a row.
async function sheet(browser, items, file) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const tiles = items.map(({ id, label, s }) => {
    const { columns, rows, grids } = s;
    return { id, label, columns, rows, cells: Array.from(grids[0], (v) => Math.round(v * 255)) };
  });
  await page.setContent(`<body style="margin:0;background:#111"><canvas id=c></canvas></body>`);
  await page.evaluate((tiles) => {
    const per = 4;
    const tw = 288;
    const th = 154;
    const c = document.getElementById("c");
    c.width = per * tw;
    c.height = Math.ceil(tiles.length / per) * (th + 18);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, c.width, c.height);
    tiles.forEach((t, i) => {
      const x = (i % per) * tw;
      const y = Math.floor(i / per) * (th + 18);
      const cw = (tw - 8) / t.columns;
      const ch = (th - 4) / t.rows;
      for (let r = 0; r < t.rows; r++)
        for (let k = 0; k < t.columns; k++) {
          const v = t.cells[r * t.columns + k];
          if (v < 6) continue;
          ctx.fillStyle = `rgb(${v + 17},${v + 17},${v + 17})`;
          ctx.fillRect(x + 4 + k * cw, y + 2 + r * ch, Math.ceil(cw), Math.ceil(ch));
        }
      ctx.fillStyle = "#ddd";
      ctx.font = "12px sans-serif";
      ctx.fillText(t.label, x + 6, y + th + 12);
    });
  }, tiles);
  await page.locator("#c").screenshot({ path: file });
  await page.close();
}

async function main() {
  const list = JSON.parse(await fs.readFile(LIST, "utf8"));
  const wanted = opt("ids", "") ? opt("ids", "").split(",") : null;
  const jobs = list.toys.filter((t) => !wanted || wanted.includes(t.id)).map((t) => ({ id: t.id, label: t.label, shelf: t.shelf })); // prettier-ignore
  if (args.includes("--calibrate"))
    for (const [
      id,
      label,
    ] of [["grapes", "Grapes"], ["orange", "Whole orange"], ["strawberry", "Strawberry"]]) // prettier-ignore
      jobs.push({ id, label, shelf: "original" });
  const gifDir = opt("gifs", "asc2-gifs");
  await fs.mkdir(gifDir, { recursive: true });
  const results = new Map();
  const workers = Number(opt("workers", "3"));
  const queue = jobs.slice();
  const launch = () =>
    chromium.launch({
      executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
    });
  await Promise.all(
    Array.from({ length: workers }, async () => {
      const browser = await launch();
      try {
        for (let job; (job = queue.shift()); ) {
          const cached = args.includes("--reuse") && (await fs.readFile(path.join(gifDir, `${job.id}.gif`)).catch(() => null)); // prettier-ignore
          try {
            const bytes = cached || (await capture(browser, job.id, gifDir));
            const s = scoreGif(new Uint8Array(bytes));
            const why = verdict(s);
            results.set(job.id, { ...job, s, why });
            console.log(`${why.length ? "FAIL" : "pass"} ${job.id} fill=${s.fill} span=${s.span} edge=${s.edge} motion=${s.motion}${why.length ? " :: " + why.join("; ") : ""}`); // prettier-ignore
          } catch (err) {
            results.set(job.id, { ...job, s: null, why: [`the capture failed: ${err.message}`] });
            console.log(`FAIL ${job.id} :: ${err.message}`);
          }
        }
      } finally {
        await browser.close();
      }
    }),
  );
  const report = [...results.values()].map(({ id, shelf, s, why }) => ({
    id,
    shelf,
    pass: why.length === 0,
    fill: s?.fill,
    span: s?.span,
    edge: s?.edge,
    motion: s?.motion,
    why, // prettier-ignore
  }));
  if (opt("report", "")) await fs.writeFile(opt("report", ""), JSON.stringify({ limits: LIMITS, toys: report }, null, 2) + "\n"); // prettier-ignore
  if (args.includes("--apply")) {
    for (const t of list.toys) {
      const r = report.find((x) => x.id === t.id);
      if (r) t.check = r.pass ? { pass: true, fill: r.fill, span: r.span, edge: r.edge, motion: r.motion } : { pass: false, why: r.why.join("; ") }; // prettier-ignore
    }
    await fs.writeFile(LIST, JSON.stringify(list, null, 2) + "\n");
  }
  if (opt("sheets", "")) {
    await fs.mkdir(opt("sheets", ""), { recursive: true });
    const browser = await launch();
    try {
      for (const shelf of list.shelves) {
        const items = [...results.values()].filter((r) => r.shelf === shelf.id && r.s && !r.why.length); // prettier-ignore
        if (items.length) await sheet(browser, items, path.join(opt("sheets", ""), `sheet-${shelf.id}.png`)); // prettier-ignore
      }
    } finally {
      await browser.close();
    }
  }
  const failed = report.filter((r) => !r.pass);
  console.log(`\n${report.length - failed.length} pass, ${failed.length} fail`);
  for (const r of failed) console.log(`  ${r.id}: ${r.why.join("; ")}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
