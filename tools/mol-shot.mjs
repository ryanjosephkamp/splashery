import { chromium } from "@playwright/test";
const [w, h] = (process.env.SIZE || "390x844").split("x").map(Number);
const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const page = await browser.newPage({ viewport: { width: w, height: h } });
page.on("pageerror", (e) => console.error("page error:", e.message));
page.on("console", (m) => {
  if (m.type() === "error") console.error("console:", m.text());
});
await page.goto(`${process.env.SPLASHERY_URL || "http://127.0.0.1:4173/"}?renderer=webgl2&profile=high&adapt=off&labs=1`);
await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
const specs = process.argv.slice(2);
for (const spec of specs) {
  const [name, ...kv] = spec.split(",");
  await page.evaluate(
    async ({ kv }) => {
      const { app } = window.__splashery;
      if (app.player.scene.toy?.id !== "molecule-viewer") await app.chooseToy("molecule-viewer");
      const o = Object.fromEntries(kv.map((s) => s.split("=")));
      if (Object.keys(o).length) await app.setToyOptions(o);
    },
    { kv },
  );
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${process.env.OUT || ".cache/mol"}/${name}.png` });
  console.log(
    name,
    await page.evaluate(() => document.querySelector(".input-shown")?.textContent?.slice(0, 300)),
  );
}
await browser.close();
