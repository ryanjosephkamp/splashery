import { test, expect } from "@playwright/test";

test("About galleries show local images, reject remote paths, and clear on the next toy", async ({
  page,
}) => {
  await page.goto("/?renderer=webgl2&profile=weak&labs=1&help=show");
  await page.waitForSelector("body[data-ready='true']");
  await page.evaluate(async () => {
    const { TOY_GALLERIES } = await import("/src/toy-help.js");
    TOY_GALLERIES.comet = [
      {
        label: "Reference images",
        caption: "Known score: 90/100",
        images: [
          { src: "assets/toys/cactus/thumb.webp", alt: "Local reference" },
          { src: "https://example.com/private.jpg", alt: "Remote image" },
          { src: "assets/../private.jpg", alt: "Escaping path" },
        ],
      },
    ];
    await window.__splashery.app.chooseToy("comet");
  });
  await page.click("#help-line-about");
  await expect(page.locator(".reference-gallery img")).toHaveCount(1);
  await expect(page.locator(".reference-gallery")).toContainText("Known score: 90/100");
  await expect(page.locator(".reference-gallery img")).toHaveAttribute("alt", "Local reference");
  await page.evaluate(() => window.__splashery.app.chooseToy("earth"));
  await expect(page.locator(".reference-gallery")).toHaveCount(0);
});
