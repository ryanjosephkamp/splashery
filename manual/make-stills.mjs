// Takes the print stills of the manual's second set of live demos (manual/img/demo-*.png). The PDF
// cannot run a demo, so it prints one of these in its place. Needs the site served locally:
//
//   python3 -m http.server 4173 --bind 127.0.0.1 &
//   SPLASHERY_CHROMIUM=/opt/pw-browsers/chromium node manual/make-stills.mjs
//
// Each demo is put in a state that shows what it does, in the light theme (the PDF is light).

import { chromium } from "playwright";

const BASE = process.env.MANUAL_URL || "http://127.0.0.1:4173/manual/";
const STILLS = {
  "grammar-railroad": ["demo-railroad.png", async (p) => { await p.selectOption("#rr-start", "x"); await p.click("#rr-walk"); }],
  "gaussian-3d": ["demo-gaussian.png", async () => {}],
  "splat-numbers": ["demo-numbers.png", async (p) => { await p.fill("#sn-s1", "0.65"); await p.fill("#sn-ty", "60"); }],
  "bell-1d-to-3d": ["demo-bell.png", async (p) => { await p.click("#bl-d2"); }],
  projection: ["demo-projection.png", async (p) => { await p.fill("#pj-d", "3"); }],
  "sort-blend": ["demo-blend.png", async (p) => { await p.click("#bd-reverse"); }],
  "windmill-parts": ["demo-windmill.png", async (p) => { await p.click('#demo-windmill .code-line[data-lit="sails"]'); await p.fill("#wm-angle", "25"); }],
  "uv-torus": ["demo-uvtorus.png", async (p) => { await p.fill("#ut-progress", "0.6"); }],
  "program-fields": ["demo-fields.png", async (p) => { await p.fill("#pf-f-hue", "u/(2pi)"); await p.waitForTimeout(600); }],
}; // prettier-ignore

const browser = await chromium.launch({ executablePath: process.env.SPLASHERY_CHROMIUM });
const page = await browser.newPage({
  viewport: { width: 1200, height: 1000 },
  deviceScaleFactor: 1.25,
  colorScheme: "light",
});
await page.goto(BASE);
await page.waitForLoadState("load");
// The sticky contents bar would sit on top of the pictures.
await page.addStyleTag({ content: ".outline { display: none !important; }" });
for (const [demo, [file, setup]] of Object.entries(STILLS)) {
  const sec = page.locator(`section.demo-live[data-demo="${demo}"]`);
  await sec.scrollIntoViewIfNeeded();
  await setup(page);
  // An <input type=range> filled by script needs an input event for the demo to redraw.
  await page.evaluate((d) => document.querySelectorAll(`section[data-demo="${d}"] input`).forEach((i) => i.dispatchEvent(new Event("input", { bubbles: true }))), demo); // prettier-ignore
  await page.waitForTimeout(500);
  await sec.screenshot({ path: new URL(`./img/${file}`, import.meta.url).pathname });
  console.log(file);
}
await browser.close();
