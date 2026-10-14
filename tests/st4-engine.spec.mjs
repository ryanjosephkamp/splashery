// Engine: share, embed and element links name the project's root, wherever the page that makes
// them sits (lane Site r4). The front door moves the Playground to playground/; its share link,
// its iframe snippet and its element snippet must still name the root, not playground/.

import { test, expect } from "@playwright/test";

const ORIGIN = `http://127.0.0.1:${Number(process.env.SPLASHERY_PORT) || 4173}`;

test("links made for a page in a folder of its own still name the project's root", async ({
  page,
}) => {
  // prettier-ignore
  // A page two folders down (served by the test), importing the app's own module.
  await page.route(`${ORIGIN}/deep/folder/`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><title>deep</title>
      <script type="importmap">{ "imports": { "gifenc": "/vendor/gifenc/gifenc.esm.js" } }</script>
      <script type="module">
        import * as x from "/src/exports.js";
        window.__links = {
          base: x.appBaseURL(),
          share: x.shareURL("abc"),
          iframe: x.iframeSnippet("abc"),
          element: x.elementSnippet("abc"),
          baseURI: document.baseURI,
        };
      </script>`,
    }),
  );
  await page.goto(`${ORIGIN}/deep/folder/`);
  await page.waitForFunction(() => window.__links);
  const l = await page.evaluate(() => window.__links);
  expect(l.baseURI).toBe(`${ORIGIN}/deep/folder/`);
  expect(l.base).toBe(`${ORIGIN}/`);
  expect(l.share).toBe(`${ORIGIN}/#s=abc`);
  expect(l.iframe).toContain(`src="${ORIGIN}/embed/#s=abc"`);
  expect(l.element).toContain(`src="${ORIGIN}/src/element.js"`);
});

test("the app at the root makes the same links it always did", async ({ page }) => {
  await page.goto(`${ORIGIN}/?renderer=webgl2&profile=weak`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  const l = await page.evaluate(async () => {
    const x = await import("/src/exports.js");
    return { base: x.appBaseURL(), share: x.shareURL("abc") };
  });
  expect(l.base).toBe(`${ORIGIN}/`);
  expect(l.share).toBe(`${ORIGIN}/#s=abc`);
});
