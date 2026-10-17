// Temporary task 114 fallback. Only silhouette IoU; never a substitute for task 113's full score.
import fs from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
export function silhouetteIoU(a, b) {
  if (a.length !== b.length) throw new Error("Mask sizes differ");
  let union = 0,
    intersection = 0;
  for (let i = 0; i < a.length; i++) {
    union += !!(a[i] || b[i]);
    intersection += !!(a[i] && b[i]);
  }
  return union ? intersection / union : 0;
}
export async function readImage(file) {
  const bytes = await fs.readFile(file);
  const p = bytes[0] === 137 ? PNG.sync.read(bytes) : jpeg.decode(bytes, { useTArray: true });
  return { width: p.width, height: p.height, data: p.data };
}
export function maskPixels(image, width, height, explicit = false) {
  const { data: d, width: w, height: h } = image;
  let alpha = false;
  for (let i = 3; i < d.length; i += 4)
    if (d[i] < 250) {
      alpha = true;
      break;
    }
  const bg = [0, 1, 2].map(
    (k) => (d[k] + d[(w - 1) * 4 + k] + d[(h - 1) * w * 4 + k] + d[(w * h - 1) * 4 + k]) / 4,
  );
  return Uint8Array.from({ length: width * height }, (_, i) => {
    const x = Math.min(w - 1, Math.floor(((i % width) * w) / width));
    const y = Math.min(h - 1, Math.floor((Math.floor(i / width) * h) / height));
    const at = (y * w + x) * 4;
    if (explicit === "alpha" || alpha) return d[at + 3] >= 128 ? 1 : 0;
    if (explicit) return (d[at] + d[at + 1] + d[at + 2]) / 3 >= 128 ? 1 : 0;
    return Math.hypot(...bg.map((v, k) => v - d[at + k])) > 35 ? 1 : 0;
  });
}
export async function scoreLite(packDir, out, pack) {
  const pictures = [];
  const uri = async (file) =>
    `data:image/${path.extname(file).toLowerCase() === ".png" ? "png" : "jpeg"};base64,${(await fs.readFile(file)).toString("base64")}`;
  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
    );
  const rows = [];
  for (const [i, img] of pack.images.entries()) {
    const renderFile = path.join(out, "renders", `${String(i).padStart(3, "0")}.png`);
    const render = await readImage(renderFile);
    const target = await readImage(path.join(packDir, img.mask || img.file));
    const a = maskPixels(target, render.width, render.height, !!img.mask);
    const b = maskPixels(render, render.width, render.height, "alpha");
    const score = silhouetteIoU(a, b) * 100;
    pictures.push({
      file: img.file,
      silhouetteIoU: score,
      maskMethod: img.mask ? "provided" : "corner-color-distance-35",
      camera: img.camera || "view-hint (unfitted)",
    });
    const diff = new PNG({ width: render.width, height: render.height });
    for (let j = 0; j < a.length; j++)
      diff.data.set(
        [a[j] && !b[j] ? 255 : 0, b[j] && !a[j] ? 255 : 0, a[j] && b[j] ? 200 : 0, 255],
        j * 4,
      );
    rows.push(
      `<section><h2>${esc(img.file)}: ${score.toFixed(2)}</h2><div><img alt="Reference" src="${await uri(path.join(packDir, img.file))}"><img alt="Model render" src="${await uri(renderFile)}"><img alt="Silhouette difference: red missing, green extra, blue overlap" src="data:image/png;base64,${PNG.sync.write(diff).toString("base64")}"></div></section>`,
    );
  }
  const score = {
    schema: 1,
    scorer: "refblend-score-lite",
    units: "0-100",
    overall: { silhouetteIoU: pictures.reduce((s, p) => s + p.silhouetteIoU, 0) / pictures.length },
    pictures,
    limitations: [
      "Silhouette only; no boundary, color, edge, Chamfer, or volume score",
      "View hints are not fitted cameras; supply images[].camera for calibrated scoring",
    ],
  };
  await fs.writeFile(path.join(out, "score.json"), JSON.stringify(score, null, 2) + "\n");
  await fs.writeFile(
    path.join(out, "report.html"),
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(pack.name)} comparison</title><style>body{font:16px system-ui;margin:24px;background:#eee}div{display:flex;flex-wrap:wrap}img{width:32%;min-width:180px;object-fit:contain;background:white}</style><h1>${esc(pack.name)}</h1><p>Fallback silhouette IoU: ${score.overall.silhouetteIoU.toFixed(2)}/100. ${esc(score.limitations.join(". "))}. Private pictures remain embedded in this local report.</p>${rows.join("\n")}`,
  );
  return score;
}
