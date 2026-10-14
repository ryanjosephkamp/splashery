// Lane QR craft: opens one of the lane's toys in Chromium, applies options,
// optionally fires a control and waits, and saves a screenshot of the page.
//   node tools/qrc-shot.mjs <toy> [--opts='{"contrast":0.3}'] [--size=390x844]
//     [--fire=turn] [--wait=3000] [--out=file.png] [--eval='js returning JSON']
// The local server must be running (python3 -m http.server 4173 --bind 127.0.0.1).
import { chromium } from "@playwright/test";

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const toy = process.argv[2];
const [W, H] = arg("size", "390x844").split("x").map(Number);
const opts = JSON.parse(arg("opts", "{}"));
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/opt/pw-browsers/chromium",
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: Number(arg("dpr", "1")) }); // prettier-ignore
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
await page.goto(`http://127.0.0.1:${process.env.SPLASHERY_PORT || 4173}/?renderer=webgl2&adapt=off&profile=mid&labs=1`); // prettier-ignore
await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
await page.evaluate((id) => window.__splashery.app.chooseToy(id), toy);
await page.waitForFunction((id) => window.__splashery.app.player.toyInfo?.id === id && !window.__splashery.app.busy, toy, { timeout: 120_000 }); // prettier-ignore
if (Object.keys(opts).length) {
  await page.evaluate((o) => window.__splashery.app.player.switchTo({ options: o }), opts);
  await page.waitForFunction(() => !window.__splashery.app.busy, null, { timeout: 120_000 });
}
await page.waitForTimeout(Number(arg("settle", "2500")));
if (arg("fire")) {
  await page.evaluate((k) => {
    const p = window.__splashery.app.player;
    p.motion.act(p.time, null, { key: k });
    p.stage.requestRender();
  }, arg("fire"));
}
await page.waitForTimeout(Number(arg("wait", "500")));
const ev = arg("eval");
if (ev) console.log(JSON.stringify(await page.evaluate(`(async () => (${ev}))()`), null, 1));
await page.screenshot({ path: arg("out", "/tmp/claude-0/qrc-shot.png") });
if (errors.length) console.log("errors:", errors.slice(0, 8).join("\n"));
await browser.close();
