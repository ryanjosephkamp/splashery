import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { gzipSync } from "node:zlib";
import { MANUAL_PDF } from "../manual/pdf-edition.js";

test("the current content-addressed manual uses lossless compression", async ({ page }) => {
  const requests = [];
  page.on("request", (request) => requests.push(new URL(request.url()).pathname));
  await page.route(`**/manual/${MANUAL_PDF}.gz`, (route) =>
    route.fulfill({
      contentType: "application/gzip",
      body: gzipSync(fs.readFileSync(`manual/${MANUAL_PDF}`)),
    }),
  );
  await page.goto("/tools/");
  const result = await page.evaluate(async (file) => {
    const { openMedia } = await import("/src/media.js");
    const media = await openMedia(new URL(`/manual/${file}`, location.href).href, {
      profile: "high",
    });
    return { kind: media.kind, name: media.name, count: media.count };
  }, MANUAL_PDF);
  expect(result.kind).toBe("pdf");
  expect(result.count).toBeGreaterThan(100);
  expect(requests).toContain(`/manual/${MANUAL_PDF}.gz`);
  expect(requests).not.toContain(`/manual/${MANUAL_PDF}`);
});
