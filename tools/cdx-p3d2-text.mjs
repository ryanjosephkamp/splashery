#!/usr/bin/env node
// Run the unchanged engine text metric and retain its real renderer frames.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";
import config from "../playwright.config.mjs";

export function engineTextFixture(font = "") {
  const spec = fs.readFileSync("tests/phf-engine.spec.mjs", "utf8");
  const start = spec.indexOf("async function textMatch(");
  let source = spec.slice(start, spec.indexOf("\nasync function open(", start));
  if (font)
    source = source.replace(
      'g.font = "15px sans-serif";',
      `g.font = ${JSON.stringify(`15px ${font}`)};`,
    );
  const result =
    "return { ncc: ab / Math.sqrt(aa * bb), n: xs.length, photo: !!st.photo, toyPhoto: !!st.toy?.photo, device: st.deviceType };";
  if (!source.includes(result))
    throw new Error("The engine text fixture changed; review its metric.");
  source = source.replace(
    result,
    "return { ncc: ab / Math.sqrt(aa * bb), n: xs.length, photo: !!st.photo, toyPhoto: !!st.toy?.photo, device: st.deviceType, frame: frame.toDataURL(), original: c.toDataURL(), rb, sb, camera: player.camera.cur, info: player.proc.ctx.kit.data.photo };",
  );
  return new Function(`return (${source})`)();
}

async function main() {
  const opt = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.slice(n.length + 3) ?? d;
  const out = opt("out", ".cache/cdx-p3d2/text-review/current");
  const renderer = opt("renderer", "webgl2");
  const fonts = opt("fonts", "sans-serif,Noto Sans,DejaVu Sans").split(",");
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch(config.use.launchOptions);
  try {
    const rows = [],
      errors = [];
    for (const font of fonts) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        `${opt("url", "http://127.0.0.1:4176/")}?renderer=${renderer}&adapt=off&profile=mid&labs=1`,
      );
      await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
      const fixture = engineTextFixture(font === "sans-serif" ? "" : font);
      for (const detail of ["splats", "photo"]) {
        const r = await fixture(page, detail, renderer === "webgl2");
        const prefix = `${font.replaceAll(" ", "-")}-${detail}`;
        for (const name of ["frame", "original"]) {
          fs.writeFileSync(
            path.join(out, `${prefix}-${name}.png`),
            Buffer.from(r[name].split(",")[1], "base64"),
          );
          delete r[name];
        }
        rows.push({ font, detail, ...r });
        console.log(JSON.stringify(rows.at(-1)));
      }
      await page.close();
    }
    fs.writeFileSync(
      path.join(out, "results.json"),
      JSON.stringify({ browser: browser.version(), renderer, rows, errors }, null, 2) + "\n",
    );
    if (errors.length) throw new Error(errors.join("\n"));
  } finally {
    await browser.close();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  await main();
