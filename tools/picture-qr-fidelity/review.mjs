// Assemble phone pairs for the separate, never-merged review branch.
import fs from "node:fs";
import path from "node:path";
import { SAMPLES } from "../../src/qr-craft/samples.js";
const arg = (key, fallback) =>
  process.argv.find((value) => value.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const root = ".cache/picture-qr-fidelity";
const out = arg("out", `${root}/review-export`);
const modes = { main: arg("main", "main-all"), detail: arg("detail", "detail-v4") };
const summary = JSON.parse(fs.readFileSync(arg("summary", `${root}/summary/summary.json`)));
const corpus = [
  ...SAMPLES,
  ...JSON.parse(fs.readFileSync("tools/picture-qr-fidelity/corpus.json")),
];
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[s],
  );
const f = (value) => (value == null ? "pending" : value.toFixed(4));
fs.mkdirSync(path.join(out, "images"), { recursive: true });
fs.mkdirSync(path.join(out, "pictures"), { recursive: true });
fs.mkdirSync(path.join(out, "sources"), { recursive: true });
const missing = [];
const sections = corpus
  .map((picture) => {
    const original = `${root}/review/sources/${picture.id}.png`;
    if (fs.existsSync(original))
      fs.copyFileSync(original, path.join(out, "sources", `${picture.id}.png`));
    else missing.push(original);
    const markdown = [
      `# ${picture.label}`,
      "",
      "[All pictures](../README.md)",
      "",
      `Source: [${picture.author || picture.label}](${picture.page}). Rendered by Ryan with Codex (GPT-6); source credits remain in [CREDITS](../../../../CREDITS.md).`,
      "",
      "Source pixels used by the measure. The toy takes a central crop; Circle uses a smaller central crop for its encoded square.",
      "",
      `<img src="../sources/${picture.id}.png" width="256" alt="Source picture">`,
      "",
    ];
    const shapes = ["square", "circle"]
      .map((shape) => {
        const score = summary.pictures.find((p) => p.picture === picture.id && p.shape === shape);
        markdown.push(
          `## ${shape === "square" ? "Square" : "Circle"}`,
          "",
          `Mean SSIM over ${score.matched}/10 payloads: phone ${f(score.scores.phone.main)} → ${f(score.scores.phone.detail)}; print ${f(score.scores.print.main)} → ${f(score.scores.print.detail)}.`,
          "",
          "| Main · Standard | Most detail |",
          "| --- | --- |",
          `| ![Standard](../images/main-${picture.id}-${shape}-0-390x844.png) | ![Most detail](../images/detail-${picture.id}-${shape}-0-390x844.png) |`,
          "",
        );
        const figures = Object.entries(modes)
          .map(([mode, directory]) => {
            const file = `${picture.id}-${shape}-0-390x844.png`;
            const source = `${root}/review/${directory}/${file}`;
            const target = `images/${mode}-${file}`;
            if (fs.existsSync(source)) fs.copyFileSync(source, path.join(out, target));
            else missing.push(source);
            return `<figure><figcaption>${mode === "main" ? "Main · Standard" : "Most detail"}</figcaption><img loading="lazy" width="390" height="844" src="${target}" alt="${escape(picture.label)} ${shape}, ${mode === "main" ? "Standard on main" : "Most detail"}"></figure>`;
          })
          .join("");
        return `<details open><summary>${shape === "square" ? "Square" : "Circle"} · mean SSIM gain across ${score.matched}/10 payloads: phone ${f(score.scores.phone.gain)}, print ${f(score.scores.print.gain)}</summary><div class="pair">${figures}</div></details>`;
      })
      .join("");
    fs.writeFileSync(path.join(out, "pictures", `${picture.id}.md`), markdown.join("\n"));
    return `<section id="${picture.id}"><h2>${escape(picture.label)} <small>${picture.id}</small></h2><figure><figcaption>Source pixels; the toy uses a central crop</figcaption><img loading="lazy" src="sources/${picture.id}.png" width="256" alt="Source ${escape(picture.label)}"></figure>${shapes}</section>`;
  })
  .join("\n");
if (missing.length && arg("partial", "0") !== "1")
  throw Error(`Missing ${missing.length} phone images; first: ${missing[0]}`);
const links = corpus.map((p) => `<a href="#${p.id}">${escape(p.label)}</a>`).join(" · ");
const clipsFile = path.join(out, "clips", "clips.json");
const clips = fs.existsSync(clipsFile) ? JSON.parse(fs.readFileSync(clipsFile)) : [];
const clipHtml = clips.length
  ? `<section><h2>Tap motion</h2><p>Each clip has a 0.4-second lead-in and 3.6 seconds of tap motion, captured at 390 pixels and 15 frames per second.</p>${clips.map((c) => `<p><a href="clips/${escape(c.file)}">Play ${escape(c.mode)} · ${escape(c.picture)} · ${escape(c.shape)}</a></p><a href="clips/${escape(c.file)}"><img style="max-width:100%;height:auto" src="clips/${escape(c.strip)}" alt="Eight frames of the ${escape(c.mode)} tap motion"></a>`).join("")}</section>`
  : "";
fs.writeFileSync(
  path.join(out, "index.html"),
  `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Picture QR fidelity review · Codex (GPT-6)</title>
<style>body{margin:24px;font:16px/1.5 system-ui,sans-serif;color:#20252b;background:#f4f5f6}main,header{max-width:1080px;margin:auto}h1{line-height:1.2}h2{margin-top:3rem}small{display:block;font-size:13px;font-weight:400;color:#59616a}nav{font-size:14px}a{color:#145f9e}details{margin:12px 0 28px}summary{cursor:pointer;padding:10px;background:white;border:1px solid #d9dce0;border-radius:8px}.pair{display:flex;gap:16px;overflow:auto;padding:12px 0}figure{margin:0;flex:0 0 390px}figcaption{font-weight:650;margin:0 0 8px}img{display:block;max-width:none;background:white;border:1px solid #d9dce0;border-radius:8px}section{scroll-margin-top:12px}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto}}</style>
<header><h1>Picture QR: Standard and Most detail</h1>
<p>Study and review renders made by Ryan with Codex (GPT-6). Source picture credits are preserved in the corpus manifest and CREDITS.</p>
<p>Phone screenshots at their original 390 × 844 size, with the same first fixed payload, picture, Low tier, and camera. Every picture has Square and Circle pairs. The complete encoded square, including function patterns, determines the primary score; Circle’s surrounding photo band is excluded.</p>
<p>Numbers are averages across all ten payloads. Each completed code is tested at 8 and 4 pixels per module, both blur levels, and six camera and brightness views with jsQR and zxing-cpp. The full report and individual results distinguish incomplete checks and failures. These pictures compare appearance; they are not timing evidence.</p>
<p>${summary.complete ? "The rendered comparison is complete." : "Work in progress: this export is incomplete."} <a href="summary.json">Machine-readable results</a> · <a href="../../../docs/audits/picture-qr-fidelity-2026-10.md">Audit</a></p>
<nav aria-label="Pictures">${links}</nav></header><main>${clipHtml}${sections}</main></html>\n`,
);
fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
fs.writeFileSync(
  path.join(out, "README.md"),
  `# Picture QR review · Codex (GPT-6)\n\nStudy and review renders made by Ryan with Codex (GPT-6). Source picture credits remain in [CREDITS](../../../CREDITS.md).\n\nThis branch is for review pictures and clips and is never merged. Each page below shows native 390×844 before-and-after pairs in Square and Circle, using the first fixed payload. Scores average all ten payloads. The code and full audit are on \`codex/picture-qr-fidelity\`. Open \`index.html\` through the repository’s local server for the complete gallery.\n\n${clips.length ? "## Tap motion\n\n" + clips.map((c) => `- [${c.mode} · ${c.picture} · ${c.shape}](clips/${c.file}) — [frame strip](clips/${c.strip})`).join("\n") + "\n\n" : ""}## Pictures\n\n${corpus.map((p) => `- [${p.label}](pictures/${p.id}.md)`).join("\n")}\n`,
);
if (fs.existsSync(path.join(out, "diagnostics", "README.md")))
  fs.appendFileSync(
    path.join(out, "README.md"),
    "\n## Retry diagnostics\n\n[Slow retry controls and original failed case](diagnostics/README.md).\n",
  );
console.log({ pictures: corpus.length, pairs: corpus.length * 2, missing: missing.length, out });
