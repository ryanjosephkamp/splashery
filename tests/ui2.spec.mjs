// Lane UI r2: Home Screen manifest and icons. Other cases are in ui2-*.spec.mjs.
import { test, expect } from "@playwright/test";
import fs from "node:fs";

test("the Home Screen manifest is valid, with its icons", async ({ page }) => {
  const m = JSON.parse(
    fs.readFileSync(new URL("../manifest.webmanifest", import.meta.url), "utf8"),
  );
  expect(m.name).toBe("Splashery");
  expect(m.display).toBe("standalone");
  const sizes = m.icons.map((i) => i.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
  for (const icon of m.icons) {
    const file = new URL(`../${icon.src}`, import.meta.url);
    const buf = fs.readFileSync(file);
    expect(buf.subarray(1, 4).toString()).toBe("PNG");
    const [w, h] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    expect(`${w}x${h}`).toBe(icon.sizes);
  }
  await page.goto("/");
  await expect(page.locator("link[rel='manifest']")).toHaveAttribute(
    "href",
    "./manifest.webmanifest",
  );
  await expect(page.locator("meta[name='apple-mobile-web-app-capable']")).toHaveAttribute("content", "yes"); // prettier-ignore
  const res = await page.request.get("/manifest.webmanifest");
  expect(res.ok()).toBe(true);
});
