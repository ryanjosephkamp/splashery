// Lane QR lab r2, the study of splat QR codes: is the software rasterizer
// right? It renders the QR code toy's own splats (src/qr/build.js,
// buildCode) two ways and compares them:
//   engine  the real app (PlayCanvas 2.22.3 through Splashery's stage, in
//           Chromium with SwiftShader WebGL2), through the toy's test hook
//           window.__splashery.qr (scan view, and its camera turned 20°);
//   ours    the same splats through raster.mjs, with the toy's scan-view
//           camera (38° field of view, the quiet zone plus one module filling
//           the picture).
// Needs `python3 -m http.server 4173 --bind 127.0.0.1` from the repository
// and SPLASHERY_CHROMIUM. Writes engine.csv and side-by-side pictures in
// engine/.
import fs from "node:fs";
import path from "node:path";
import { toySource } from "../qr-scan-lab/toy-source.mjs";
import { applyCondition, newImage } from "../qr-scan-lab/sim.mjs";
import { encodeQR, QUIET } from "../../src/qr/encode.js";
import { buildCode } from "../../src/qr/build.js";
import { render, toPNG, fromPNG } from "./raster.mjs";
import { readAll, READERS } from "./readers.mjs";
import { TEXTS, CONDITIONS, toCSV } from "./core.mjs";

const PX = 512;
const gray = (d, i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];

// The best match of `b` to `a` over small shifts and scales about the
// center: { mae (mean absolute gray difference, 0..255), corr, dx, dy, s }.
function align(a, b) {
  const W = a.width;
  let best = null;
  for (const s of [0.98, 0.99, 1, 1.01, 1.02])
    for (let dy = -3; dy <= 3; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        let sum = 0;
        let n = 0;
        let sa = 0;
        let sb = 0;
        let saa = 0;
        let sbb = 0;
        let sab = 0;
        for (let y = 8; y < W - 8; y += 2)
          for (let x = 8; x < W - 8; x += 2) {
            const bx = Math.round((x - W / 2) * s + W / 2 + dx);
            const by = Math.round((y - W / 2) * s + W / 2 + dy);
            if (bx < 0 || by < 0 || bx >= W || by >= W) continue;
            const ga = gray(a.data, (y * W + x) * 4);
            const gb = gray(b.data, (by * W + bx) * 4);
            sum += Math.abs(ga - gb);
            sa += ga;
            sb += gb;
            saa += ga * ga;
            sbb += gb * gb;
            sab += ga * gb;
            n++;
          }
        const mae = sum / n;
        const corr = (sab / n - (sa / n) * (sb / n)) / Math.sqrt((saa / n - (sa / n) ** 2) * (sbb / n - (sb / n) ** 2)); // prettier-ignore
        if (!best || mae < best.mae) best = { mae, corr, dx, dy, s };
      }
  return best;
}

function sideBySide(a, b) {
  const out = newImage(a.width * 2 + 8, a.height, [128, 128, 128]);
  for (let y = 0; y < a.height; y++) {
    out.data.set(a.data.subarray(y * a.width * 4, (y + 1) * a.width * 4), y * out.width * 4);
    out.data.set(b.data.subarray(y * b.width * 4, (y + 1) * b.width * 4), (y * out.width + a.width + 8) * 4); // prettier-ignore
  }
  return out;
}

export async function runEngine(out) {
  const dir = path.join(out, "engine");
  fs.mkdirSync(dir, { recursive: true });
  const src = await toySource({ opt: (n, d) => ({ px: String(PX), "cam-styles": "none", viewport: "600" })[n] ?? d }); // prettier-ignore
  const page = src.page;
  const rows = [];
  try {
    for (const [tid, text] of Object.entries(TEXTS))
      for (const yaw of [0, 20]) {
        const info = await page.evaluate(async ({ text }) => {
          const qr = window.__splashery.qr;
          qr.autoCheck = false;
          await qr.set({ style: "classic", text, ecc: "M" });
          await qr.check();
          return qr.info();
        }, { text }); // prettier-ignore
        const b64 = await page.evaluate(
          async ({ yaw, px }) => {
            const { app, qr } = window.__splashery;
            return app.withCapture([px, px], async () => {
              const pose = { ...qr.scanPose(1), yaw: (yaw * Math.PI) / 180 };
              const shot = await app.player.renderAt(app.player.time, pose);
              return shot.toDataURL("image/png").split(",")[1];
            });
          },
          { yaw, px: PX },
        );
        const engine = fromPNG(Buffer.from(b64, "base64"));
        // Ours: the same splats, the same camera.
        const code = encodeQR(text, "M");
        const built = buildCode(code, info.options);
        const half = code.size / 2 + QUIET + 1;
        const t = Math.tan((19 * Math.PI) / 180);
        // The camera orbits a point 0.3 modules behind the code's face.
        const Daim = half / t + 0.3;
        const th = (yaw * Math.PI) / 180;
        // Turning the camera about the aim point = turning the code the
        // other way about it; render() turns about the origin, so move the
        // splats so the aim point is the origin first.
        const splats = built.splats.map((s) => ({ ...s, p: [s.p[0], s.p[1], s.p[2] + 0.3] }));
        const ours = render(splats, { width: PX, height: PX, focal: PX / 2 / t, dist: Daim, yaw: -yaw }, { backdrop: sampleCorner(engine) }); // prettier-ignore
        const al = align(engine, ours);
        fs.writeFileSync(path.join(dir, `${tid}-yaw${yaw}.png`), toPNG(sideBySide(engine, ours)));
        const row = { text: tid, version: info.version, yaw, splats: built.splats.length, perModule: built.perModule, mae: Math.round(al.mae * 10) / 10, corr: Math.round(al.corr * 1000) / 1000, shift: `${al.dx},${al.dy}`, scale: al.s }; // prettier-ignore
        for (const [name, img] of [
          ["engine", engine],
          ["ours", ours],
        ]) {
          const got = await readAll(img);
          for (const r of READERS) row[`${name}_${r}`] = got[r] === text ? 1 : 0;
          // And a phone-like photo of each.
          const ph = applyCondition(
            img,
            half * 2,
            CONDITIONS.find((c) => c.id === "phone"),
            7,
          );
          const gp = await readAll(ph);
          for (const r of READERS) row[`${name}_phone_${r}`] = gp[r] === text ? 1 : 0;
        }
        rows.push(row);
        console.log(`  engine ${tid} yaw ${yaw}: mae ${row.mae}, corr ${row.corr}`);
      }
  } finally {
    await src.close();
  }
  const cols = Object.keys(rows[0]);
  fs.writeFileSync(path.join(out, "engine.csv"), toCSV(rows, cols));
  return rows;
}

const sampleCorner = (img) => [img.data[0], img.data[1], img.data[2]];
