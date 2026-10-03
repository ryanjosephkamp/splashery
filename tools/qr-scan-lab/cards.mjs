#!/usr/bin/env node
// Makes the Effect review cards' grid images: for each style (preset colors, level M, the
// 43-character URL), the hardest simulated captures it still passes, hardest first, read by both
// readers. Writes tools/qr-scan-lab/cards/qrl-<style>.png (4 x 2 tiles) and cards.json (the
// conditions each tile shows).
//   SPLASHERY_CHROMIUM=... node tools/qr-scan-lab/cards.mjs   (the toy's server on port 4173)
import fs from "node:fs";
import { PNG } from "pngjs";
import { applyCondition, conditions } from "./sim.mjs";
import { readers, invertedReaders } from "./readers.mjs";
import { toySource, TOY_STYLES } from "./toy-source.mjs";

const TEXT = "https://ryanjosephkamp.github.io/splashery/";
const HARDEST_FIRST = ["hard", "mod2", "tilt35", "jpeg15", "blur35", "mod3", "phone", "light60", "persp", "mod4", "jpeg30", "blur20", "tilt28", "light30", "tilt20", "blur10", "mod5", "jpeg60", "mod6", "tilt10", "mod12", "front"]; // prettier-ignore
const out = "tools/qr-scan-lab/cards";
fs.mkdirSync(out, { recursive: true });
const src = await toySource({ opt: (n, d) => ({ "cam-styles": "none" })[n] ?? d });
const byId = Object.fromEntries(conditions().map((c) => [c.id, c]));
const summary = {};
for (const style of TOY_STYLES) {
  const r = await src.render({ style, ec: "M", scheme: "preset" }, TEXT);
  const set = style === "neon" ? invertedReaders : readers;
  const passed = [];
  for (const id of HARDEST_FIRST) {
    const img = applyCondition(r.img, r.modules, byId[id]);
    if (Object.values(set).every((read) => read(img) === TEXT)) passed.push({ id, img });
  }
  const tiles = passed.slice(0, 8);
  const cell = 220;
  const png = new PNG({ width: 4 * cell, height: 2 * cell });
  png.data.fill(30);
  tiles.forEach((t, i) => {
    const ox = (i % 4) * cell;
    const oy = Math.floor(i / 4) * cell;
    const k = Math.max(t.img.width, t.img.height) / (cell - 8);
    for (let y = 4; y < cell - 4; y++)
      for (let x = 4; x < cell - 4; x++) {
        const sx = Math.floor((x - 4) * k);
        const sy = Math.floor((y - 4) * k);
        if (sx >= t.img.width || sy >= t.img.height) continue;
        const o = ((oy + y) * png.width + ox + x) * 4;
        const p = (sy * t.img.width + sx) * 4;
        png.data.set([t.img.data[p], t.img.data[p + 1], t.img.data[p + 2], 255], o);
      }
  });
  fs.writeFileSync(`${out}/qrl-${style}.png`, PNG.sync.write(png));
  summary[style] = { shown: tiles.map((t) => t.id), failed: HARDEST_FIRST.filter((id) => !passed.some((p) => p.id === id)) }; // prettier-ignore
  console.error(style, JSON.stringify(summary[style]));
}
fs.writeFileSync(`${out}/cards.json`, JSON.stringify(summary, null, 1));
await src.close();
