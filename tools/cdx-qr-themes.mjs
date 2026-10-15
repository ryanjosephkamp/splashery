// Task 58: reproducible artwork generation and production-layout screening.
// Run --generate, --screen [theme], then cdx-qr-themes-browser.mjs and --select.
import fs from "node:fs";
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { artwork, candidates, THEMES } from "./cdx-qr-themes-art.mjs";
import { LINKS } from "./cdx-qr-themes-links.mjs";
import { passedMatrix, reusableMatrix } from "./cdx-qr-themes-evidence.mjs";
import { load, read, OPTIONS, detail, properties } from "./cdx-pics-qr.mjs";
import { makeWoven, checkWoven, rasterize } from "../src/qr-craft/picture.js";

export const CACHE = ".cache/qr-themes";
export const EVIDENCE = "docs/audits/qr-theme-packs-2026-10";
export const FILES = "assets/toys/qr-picture/themes";
export const hash = (file) => createHash("sha256").update(fs.readFileSync(file)).digest("hex");
export function layoutTrials(pic, links = LINKS) {
  return links.map((text) => {
    const w = makeWoven(pic, { ...OPTIONS, text }, read);
    return {
      text,
      characters: text.length,
      version: w.code.version,
      margin: w.margin,
      ...detail(pic, w),
      scans: checkWoven(w, read).sizes.map(({ id, ok }) => ({ trial: id, ok })),
    };
  });
}
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
if (process.argv[1]?.endsWith("cdx-qr-themes.mjs")) {
  fs.mkdirSync(CACHE, { recursive: true });
  fs.mkdirSync(EVIDENCE, { recursive: true });
}
if (process.argv.includes("--generate")) {
  const browser = await chromium.launch({
    executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage();
  for (const row of candidates()) {
    const svg = artwork(row);
    const jpg = await page.evaluate(async (svg) => {
      const image = new Image();
      image.src = "data:image/svg+xml;base64," + btoa(svg);
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 960;
      canvas.getContext("2d").drawImage(image, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.88).split(",")[1];
    }, svg);
    fs.writeFileSync(`${CACHE}/${row.id}.jpg`, Buffer.from(jpg, "base64"));
  }
  await browser.close();
  console.log(`Generated ${candidates().length} original 960px JPEGs.`);
}
if (process.argv.includes("--screen")) {
  const theme = process.argv[process.argv.indexOf("--screen") + 1];
  for (const [id] of THEMES.filter(([id]) => !theme || id === theme)) {
    const out = `${EVIDENCE}/layout-${id}.json`;
    const rows = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out)) : [];
    for (const r of candidates().filter((r) => r.theme === id)) {
      const file = `${CACHE}/${r.id}.jpg`,
        sha256 = hash(file);
      if (
        rows.some(
          (row) => row.id === r.id && row.sha256 === sha256 && reusableMatrix(row, "layout"),
        )
      )
        continue;
      const pic = load(file),
        links = layoutTrials(pic);
      const row = {
        ...r,
        sha256,
        properties: properties(pic),
        links,
        score: Math.min(...links.map((s) => s.score)),
        eligible: passedMatrix({ links }, "layout"),
      };
      const old = rows.findIndex((row) => row.id === r.id);
      if (old >= 0) rows.splice(old, 1);
      rows.push(row);
      write(out, rows);
      const w = makeWoven(pic, OPTIONS, read),
        p = rasterize(w, 330 / (w.code.size + 8));
      fs.writeFileSync(
        `${CACHE}/${r.id}-layout.png`,
        PNG.sync.write({ width: p.width, height: p.height, data: Buffer.from(p.data) }),
      );
      console.log(
        `${r.id}: detail ${row.score.toFixed(3)}, ${links.filter((s) => s.scans.every((s) => s.ok)).length}/${LINKS.length} layout links`,
      );
    }
  }
}
if (process.argv.includes("--select")) {
  const all = [],
    retained = [];
  fs.mkdirSync(FILES, { recursive: true });
  for (const [theme] of THEMES) {
    const layout = JSON.parse(fs.readFileSync(`${EVIDENCE}/layout-${theme}.json`));
    const browser = JSON.parse(fs.readFileSync(`${EVIDENCE}/browser-${theme}.json`));
    const eligible = layout
      .filter(
        (r) =>
          r.eligible &&
          passedMatrix(r, "layout") &&
          hash(`${CACHE}/${r.id}.jpg`) === r.sha256 &&
          browser.some(
            (b) =>
              b.id === r.id && b.sha256 === r.sha256 && b.eligible && passedMatrix(b, "browser"),
          ),
      )
      .sort((a, b) => b.score - a.score);
    // One variant per subject keeps the pack diverse; scores break ties.
    const subjects = new Set(),
      kept = [];
    for (const row of eligible)
      if (!subjects.has(row.motif)) {
        subjects.add(row.motif);
        kept.push(row);
      }
    if (kept.length < 8)
      throw Error(`${theme}: only ${kept.length} distinct fully scan-qualified subjects`);
    for (const r of layout) {
      const keep = kept.slice(0, 8).some((k) => k.id === r.id);
      const rendered = browser.find((b) => b.id === r.id);
      const qualifiedVariant = eligible.find((b) => b.motif === r.motif && b.score > r.score);
      all.push({
        id: r.id,
        theme,
        name: r.name,
        score: r.score,
        kept: keep,
        reason: keep
          ? "Passed every qualifying scan; highest worst-link detail among distinct subjects."
          : !r.eligible
            ? "Production layout scan failed."
            : rendered && !rendered.eligible
              ? "Rendered scan failed."
              : rendered
                ? "Passed scanning, but lower worst-link detail or another variant of the same subject retained."
                : qualifiedVariant
                  ? `Not rendered: higher-ranked variant ${qualifiedVariant.id} of this subject already passed.`
                  : "Not rendered: eight higher-ranked distinct subjects already passed.",
      });
      if (keep) {
        const file = `${FILES}/${r.id}.jpg`;
        retained.push({
          id: r.id,
          label: r.name,
          group: r.group,
          theme,
          file,
          score: r.score,
          author: "Made by Ryan with Codex (GPT-6)",
          page: "https://github.com/ryanjosephkamp/splashery/blob/main/tools/cdx-qr-themes-art.mjs",
          license: "CC0 1.0",
          madeByCode: true,
        });
      }
    }
  }
  // All six packs must qualify before shipping files or shared lists change.
  for (const s of retained) fs.copyFileSync(`${CACHE}/${s.id}.jpg`, s.file);
  const files = new Set(retained.map((s) => s.file.split("/").at(-1)));
  for (const file of fs.readdirSync(FILES))
    if (file.startsWith("cdx-theme-") && file.endsWith(".jpg") && !files.has(file))
      fs.unlinkSync(`${FILES}/${file}`);
  write(`${EVIDENCE}/selection.json`, all);
  fs.writeFileSync(
    "src/qr-craft/theme-pictures.js",
    "// Task 58: original CC0 artwork; JPEGs load only when selected.\nexport const THEME_PICTURES = " +
      JSON.stringify(retained, null, 2) +
      ";\n",
  );
  const registry = JSON.parse(fs.readFileSync("tools/assets.json"));
  registry.pictureQrSamples = registry.pictureQrSamples.filter(
    (r) => !r.id.startsWith("cdx-theme-"),
  );
  for (const s of retained)
    registry.pictureQrSamples.push({
      ...s,
      name: s.label,
      toy: "qr-picture",
      checked: "October 14, 2026",
      sha256: hash(s.file),
      testedLinks: LINKS,
      sourceNote:
        "Original SVG illustration generated by tools/cdx-qr-themes-art.mjs and rasterized by Chromium 151.0.7922.173 to a 960×960 JPEG, quality 88. No source image uses a payload or QR grid. Fictional artwork, never a real capture or scientific data.",
      note: "Code-made; CC0 1.0. Ten links at default H correction, contrast 0.5, small center, color style, and More detail. Phone and print-focus checks use actual production splat renders; print focus is a camera simulation, not a physical print.",
    });
  write("tools/assets.json", registry);
  console.log(`Kept ${retained.length} of ${all.length} candidates.`);
}
