import fs from "node:fs";
import { chromium } from "@playwright/test";
const src = fs.readFileSync("tests/phf-engine.spec.mjs", "utf8");
let f = src.slice(src.indexOf("async function textMatch("), src.indexOf("async function open("));
f = f.replace(
  "const fd = frame.getContext",
  "window.__cdxTextFrame = frame; const fd = frame.getContext",
);
f = f.replace("return { ncc:", "return { rb, sb, ncc:");
const match = Function(`return (${f})`)();
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM,
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
await page.goto(
  `${process.env.SPLASHERY_URL || "http://127.0.0.1:4173/"}?renderer=webgl2&adapt=off&profile=mid&labs=1`,
);
await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
for (const detail of ["splats", "photo"]) {
  console.log(detail, await match(page, detail, true));
  const state = await page.evaluate(() => {
    const pl = window.__splashery.player;
    const c = pl.proc.ctx;
    return {
      camera: pl.camera.cur,
      tf: c.transform,
      count: c.buf.count,
      frame: window.__cdxTextFrame.toDataURL(),
      source: window.__phfPage.c.toDataURL(),
      uniforms: pl.motion.uniforms,
    };
  });
  fs.writeFileSync(
    `.cache/cdx-p3d2/text-${detail}.png`,
    Buffer.from(state.frame.split(",")[1], "base64"),
  );
  fs.writeFileSync(
    ".cache/cdx-p3d2/text-source.png",
    Buffer.from(state.source.split(",")[1], "base64"),
  );
  delete state.frame;
  delete state.source;
  console.log(state);
}
await browser.close();
