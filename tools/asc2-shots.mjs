// Lane ASCII r2: the lab page's screenshots at 390 by 844 and 1440 by 900, with the toy picker.
//   node tools/asc2-shots.mjs   (the server must be running on port 4173)
import { chromium } from "@playwright/test";
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
});
try {
  for (const [w, h] of [
    [390, 844],
    [1440, 900],
  ]) {
    // prettier-ignore
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(new URL("ascii-lab.html", base).href);
    await page.waitForSelector("body[data-ready='true']");
    await page.selectOption("#preset", "pizza");
    await page.screenshot({ path: `tests/screenshots/asc2-lab-${w}x${h}.png` });
    await page.close();
  }
} finally {
  await browser.close();
}
