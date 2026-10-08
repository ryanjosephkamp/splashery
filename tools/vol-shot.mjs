// Lane Volume viewer: screenshots of the Volume viewer with options (the server must be running).
//
//   SIZE=390x844 OUT=.cache/vol node tools/vol-shot.mjs name,source=gar,preset=bone,cut=0.5 …
//
// Each argument is a picture's name and the toy's options; cut=<0..1> places the cut plane (1:
// nothing cut), as a drag would. Tab=toy opens the Toy tab first (for pictures of the panel).
import fs from "node:fs";
import { chromium } from "@playwright/test";
const [w, h] = (process.env.SIZE || "390x844").split("x").map(Number);
const out = process.env.OUT || ".cache/vol";
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/opt/pw-browsers/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"], // prettier-ignore
});
const page = await browser.newPage({
  viewport: { width: w, height: h },
  deviceScaleFactor: Number(process.env.DPR || 2),
});
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.error("console:", m.text());
});
await page.goto(
  `${process.env.SPLASHERY_URL || "http://127.0.0.1:4173/"}?renderer=webgl2&profile=${process.env.PROFILE || "high"}&adapt=off&labs=1`, // prettier-ignore
);
await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
for (const spec of process.argv.slice(2)) {
  const [name, ...kv] = spec.split(",");
  const info = await page.evaluate(
    async ({ kv }) => {
      const { app } = window.__splashery;
      if (app.player.scene.toy?.id !== "volume-viewer") await app.chooseToy("volume-viewer");
      const o = Object.fromEntries(kv.map((s) => s.split("=")));
      const cut = o.cut;
      delete o.cut;
      const tab = o.tab;
      delete o.tab;
      for (const k of ["level", "width"]) if (k in o) o[k] = Number(o[k]);
      if ("slice" in o) o.slice = o.slice === "1" || o.slice === "true";
      const { VOLUME_STATE, describe, RECIPES } = await import("/src/packs/volume-viewer.js");
      const defaults = Object.fromEntries(RECIPES["volume-viewer"].options.filter((x) => !x.hidden).map((x) => [x.key, x.default])); // prettier-ignore
      await app.setToyOptions({ ...defaults, ...o });
      VOLUME_STATE.cut.at = cut === undefined ? 1 : Number(cut);
      if (tab) document.querySelector(`[data-tab='${tab}'], #tab-${tab}`)?.click();
      return describe();
    },
    { kv },
  );
  await page.waitForTimeout(Number(process.env.WAIT || 2500));
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, "|", info.replace(/\n/g, " | "));
}
await browser.close();
