// Operator round: payload-independent pictures, five links, production encoder and decoder.
import fs from "node:fs";
import { PNG } from "pngjs";
import { load, read, OPTIONS, detail, properties } from "./cdx-pics-qr.mjs";
import { makeWoven, checkWoven, rasterize, measure } from "../src/qr-craft/picture.js";
import { LINKS } from "./cdx-pics-links.mjs";

export function pictureTrials(pic) {
  return LINKS.map((text) => {
    const woven = makeWoven(pic, { ...OPTIONS, text }, read);
    const scans = checkWoven(woven, read).sizes.map((s) => ({ trial: s.id, ok: s.text === text }));
    for (const [trial, pixels, blur] of [
      ["phone-330", 330, 0.2],
      ["print-900", 900, 0.2],
      ["phone-soft-focus", 330, 0.3],
    ]) {
      const p = rasterize(woven, pixels / (woven.code.size + 8), { blur });
      scans.push({ trial, pixels: p.width, blur, ok: read(p.data, p.width, p.height) === text });
    }
    return {
      text,
      characters: text.length,
      version: woven.code.version,
      margin: woven.margin,
      ...detail(pic, woven),
      moduleContrast: measure(woven).module,
      scans,
      // Qualification uses the toy's own two layout checks, then actual rendered pixels.
      // Fixed-pixel CPU rasters are extra simulations; they are not the splat renderer.
      eligible: scans.slice(0, 2).every((s) => s.ok),
    };
  });
}

if (process.argv[1]?.endsWith("cdx-pics-review.mjs")) {
  const directory = "docs/audits/sample-pictures-2026-10/";
  const history = JSON.parse(fs.readFileSync(directory + "qr-scores.json"));
  const manifest = JSON.parse(fs.readFileSync("tools/cdx-pics-qr-ai-prompts.json"));
  const originalSubjects = new Set([
    "cdx-qr-3-2",
    "cdx-qr-8-7",
    "cdx-qr-print-3-6",
    "cdx-qr-print-5-2",
    "cdx-qr-print-5-6",
    "cdx-qr-print-8-2",
  ]);
  const subjects = history
    .filter((r) => originalSubjects.has(r.id))
    .map((r) => ({
      id: r.id,
      label: r.label,
      ai: false,
      file: fs.existsSync(`assets/toys/qr-picture/codex/${r.id}.jpg`)
        ? `assets/toys/qr-picture/codex/${r.id}.jpg`
        : `.cache/cdx-pics/qr/${r.id}.jpg`,
    }));
  subjects.push(
    ...manifest
      .filter((r) => fs.existsSync(`.cache/cdx-pics/round2/ai/${r.id}.jpg`))
      .map((r) => ({ ...r, ai: true, file: `.cache/cdx-pics/round2/ai/${r.id}.jpg` })),
  );
  // Resume measured candidates; remove this file for a complete new measurement.
  const scoreFile = directory + "qr-review-scores.json";
  const rows = fs.existsSync(scoreFile) ? JSON.parse(fs.readFileSync(scoreFile)) : [];
  fs.mkdirSync(".cache/cdx-pics/round2/phone", { recursive: true });
  for (const r of subjects) {
    if (rows.some((row) => row.id === r.id)) continue;
    const pic = load(r.file),
      links = pictureTrials(pic);
    const row = {
      ...r,
      links,
      properties: properties(pic),
      score: Math.min(...links.map((s) => s.score)),
      meanScore: links.reduce((sum, s) => sum + s.score, 0) / links.length,
      rasterEligible: links.every((s) => s.eligible),
      kept: false,
    };
    rows.push(row);
    const w = makeWoven(pic, OPTIONS, read),
      p = rasterize(w, 330 / (w.code.size + 8));
    fs.writeFileSync(
      `.cache/cdx-pics/round2/phone/${r.id}.png`,
      PNG.sync.write({
        width: p.width,
        height: p.height,
        data: Buffer.from(p.data),
      }),
    );
    fs.writeFileSync(directory + "qr-review-scores.json", JSON.stringify(rows, null, 2) + "\n");
    console.log(
      `${r.id}: ${row.score.toFixed(2)}, ${links.filter((s) => s.eligible).length}/5 links`,
    );
  }
}
