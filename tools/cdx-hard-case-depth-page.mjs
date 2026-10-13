// Preload only for tools/dsm-depth.mjs. Its inference needs a local origin, not the opening toy.
// Keep the actual dsm-depth code, photo decoder, depth worker, model, and output unchanged.
import { chromium } from "@playwright/test";
const launch = chromium.launch.bind(chromium);
chromium.launch = async (options) => {
  const browser = await launch(options);
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async (options) => {
    const page = await newPage(options);
    await page.route("**/index.html?labs=1", (route) =>
      route.fulfill({
        contentType: "text/html",
        body: "<!doctype html><title>Sample depth build</title>",
      }),
    );
    return page;
  };
  return browser;
};
