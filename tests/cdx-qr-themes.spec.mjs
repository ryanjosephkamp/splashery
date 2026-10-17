// Task 58: the original assets, real picker, production layout, and browser exports.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import { SAMPLES } from "../src/qr-craft/samples.js";
import { THEMES, candidates, artwork } from "../tools/cdx-qr-themes-art.mjs";
import { LINKS } from "../tools/cdx-qr-themes-links.mjs";
import {
  passedMatrix,
  reusableMatrix,
  requirePassedMatrix,
} from "../tools/cdx-qr-themes-evidence.mjs";
import { layoutTrials, EVIDENCE } from "../tools/cdx-qr-themes.mjs";
import { load } from "../tools/cdx-pics-qr.mjs";
import { capturePicture } from "../tools/cdx-qr-themes-capture.mjs";
import { renderedTrials } from "../tools/cdx-pics-review-browser.mjs";
const PICTURES = SAMPLES.filter((s) => s.id.startsWith("cdx-theme-"));
const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";

test("six diverse theme packs have complete CC0 records and ten-link evidence", async () => {
  expect(PICTURES).toHaveLength(48);
  expect(SAMPLES[0].id).toBe("ai-farm");
  expect(new Set(SAMPLES.map((s) => s.id)).size).toBe(SAMPLES.length);
  expect(new Set(LINKS).size).toBe(10);
  expect(LINKS.some((s) => s.startsWith("http://"))).toBe(true);
  expect(LINKS.some((s) => s.includes("?"))).toBe(true);
  expect(Math.max(...LINKS.map((s) => s.length))).toBeGreaterThan(150);
  expect(candidates().length).toBeGreaterThanOrEqual(120);
  const registry = JSON.parse(fs.readFileSync("tools/assets.json"));
  const selection = JSON.parse(fs.readFileSync(`${EVIDENCE}/selection.json`));
  expect(selection).toHaveLength(candidates().length);
  expect(
    selection
      .filter((r) => r.kept)
      .map((r) => r.id)
      .sort(),
  ).toEqual(PICTURES.map((r) => r.id).sort());
  for (const [theme, group] of THEMES) {
    const pictures = PICTURES.filter((s) => s.theme === theme);
    expect(pictures).toHaveLength(8);
    expect(new Set(pictures.map((s) => s.id.split("-").at(-2))).size).toBe(8);
    const layout = JSON.parse(fs.readFileSync(`${EVIDENCE}/layout-${theme}.json`));
    const browser = JSON.parse(fs.readFileSync(`${EVIDENCE}/browser-${theme}.json`));
    expect(layout).toHaveLength(candidates().filter((s) => s.theme === theme).length);
    for (const s of pictures) {
      const record = registry.pictureQrSamples.find((r) => r.id === s.id);
      const sha = createHash("sha256").update(fs.readFileSync(s.file)).digest("hex");
      expect(s.group).toBe(group);
      expect(s.label).toContain("code-made");
      expect(s.author).toContain("Made by Ryan with Codex (GPT-6)");
      expect(s.license).toBe("CC0 1.0");
      expect(record.sha256).toBe(sha);
      expect(record.testedLinks).toEqual(LINKS);
      expect(record.checked).toBe("October 14, 2026");
      expect(record.madeByCode).toBe(true);
      expect(record.ai).toBeFalsy();
      if (theme === "space-art") expect(s.label).toContain("imaginary art");
      const l = layout.find((r) => r.id === s.id),
        b = browser.find((r) => r.id === s.id);
      expect(l.sha256).toBe(sha);
      expect(b.sha256).toBe(sha);
      expect(l.links.map((r) => r.text)).toEqual(LINKS);
      expect(b.links.map((r) => r.text)).toEqual(LINKS);
      expect(requirePassedMatrix(l, "layout")).toBe("20/20");
      expect(requirePassedMatrix(b, "browser")).toBe("40/40");
      expect(s.score).toBeCloseTo(Math.min(...l.links.map((r) => r.score)), 6);
    }
  }
});

test("cached scan evidence rejects missing trials, stale payloads, and false eligibility", () => {
  const original = JSON.parse(fs.readFileSync(`${EVIDENCE}/browser-seasons.json`)).find(
    (r) => r.eligible,
  );
  expect(passedMatrix(original, "browser")).toBe(true);
  for (const corrupt of [
    (r) => r.links.pop(),
    (r) => r.links[0].scans.pop(),
    (r) => (r.links[0].scans = []),
    (r) => (r.links[0].scans[1].trial = "phone-330"),
    (r) => (r.links[0].text = "https://example.com/stale"),
    (r) => (r.links[0].scans[0].ok = false),
    (r) => (r.links[0].options.level = "L"),
  ]) {
    const row = structuredClone(original);
    corrupt(row);
    expect(passedMatrix(row, "browser")).toBe(false);
    expect(reusableMatrix(row, "browser")).toBe(false);
    expect(() => requirePassedMatrix(row, "browser")).toThrow();
  }
});

test("artwork is deterministic and contains no embedded QR or remote resources", () => {
  for (const c of candidates()) {
    expect(artwork(c)).toBe(artwork({ ...c, text: LINKS.at(-1) }));
    expect(artwork(c).replace('xmlns="http://www.w3.org/2000/svg"', "")).not.toMatch(
      /<text|<image|href=|https?:\/\//g,
    );
  }
});

for (const s of PICTURES)
  test(`${s.id}: all ten links scan through the production layout`, () => {
    const links = layoutTrials(load(s.file));
    expect(links.map((r) => r.text)).toEqual(LINKS);
    expect(links.flatMap((r) => r.scans.filter((t) => !t.ok))).toEqual([]);
  });

for (const [theme, group] of THEMES)
  test(`${group}: selected backgrounds scan in the browser and load only on selection`, async ({
    page,
  }) => {
    test.setTimeout(600000);
    const requests = [],
      errors = [];
    page.on("request", (r) => requests.push(r.url()));
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    expect(requests.filter((s) => s.includes("/qr-picture/themes/"))).toEqual([]);
    await page.evaluate(async () => {
      await import("/src/packs/qr-craft.js");
      window.__splashery.qrCraft.autoCheck = false;
      await window.__splashery.app.chooseToy("qr-picture");
      // Lane PIC2: Picture QR now opens at the lowest contrast and the biggest code; with the
      // automatic check off, this test keeps the settings it was recorded at (tests/pic2.spec.mjs
      // checks the new defaults with the check on).
      await window.__splashery.app.setToyOptions({ contrast: 0.5, size: "more" });
    });
    expect(requests.filter((s) => s.includes("/qr-picture/themes/"))).toEqual([]);
    if (await page.locator("#sheet-toggle").isVisible()) {
      if ((await page.locator("#sheet-toggle").getAttribute("aria-expanded")) === "false")
        await page.locator("#sheet-toggle").click();
    }
    await page.locator("#tab-play").click();
    const select = page
      .locator("select")
      .filter({ has: page.locator(`optgroup[label="${group}"]`) });
    await expect(select).toHaveCount(1);
    await expect(select.locator("optgroup")).toHaveCount(6);
    await expect(select.locator(`optgroup[label="${group}"] option`)).toHaveCount(8);
    for (const s of PICTURES.filter((s) => s.theme === theme)) {
      const before = requests.filter((u) => u.includes("/qr-picture/themes/")).length;
      await select.selectOption(s.id);
      await page.waitForFunction(
        (id) =>
          !window.__splashery.app.busy &&
          window.__splashery.qrCraft.picture().options?.picture === id,
        s.id,
      );
      const added = requests.filter((u) => u.includes("/qr-picture/themes/")).slice(before);
      expect(added).toHaveLength(1);
      expect(added[0]).toContain(s.file);
      await expect(select.locator("option:checked")).toContainText("code-made");
      await expect(page.locator("#credits")).toContainText(s.author);
      await expect(page.locator("#credits")).toContainText("CC0 1.0");
      const ck = await page.evaluate(() => window.__splashery.qrCraft.checkPicture());
      expect(ck.ok).toBe(true);
      expect(ck.stage.every((r) => r.ok)).toBe(true);
      // Schemes, short/long payloads, and queries; the complete ten-link matrix is above.
      for (const text of [LINKS[0], LINKS[3], LINKS.at(-1)]) {
        await page.evaluate((text) => window.__splashery.app.setToyOptions({ text }), text);
        const shot = await capturePicture(page, 900);
        expect(shot.text).toBe(text);
        expect(shot.options.level).toBe("H");
        expect(shot.options.contrast).toBe(0.5);
        expect(shot.options.center).toBe("small");
        expect(shot.options.style).toBe("color");
        expect(shot.options.size).toBe("more");
        const png = PNG.sync.read(Buffer.from(shot.bytes));
        expect(
          renderedTrials(png, shot.codeSize, text, { rawDiagnostic: false }).scans.filter(
            (r) => !r.ok,
          ),
          `${s.id}: ${text}`,
        ).toEqual([]);
      }
    }
    const exported = await page.evaluate(async () => {
      const q = window.__splashery.qrCraft;
      return {
        bytes: Array.from(new Uint8Array(await (await q.savePNG(900)).arrayBuffer())),
        size: q.picture().woven.code.size,
      };
    });
    const png = PNG.sync.read(Buffer.from(exported.bytes));
    expect(png.width).toBe(900);
    const sameCamera = await capturePicture(page, 900);
    const samePixels = PNG.sync.read(Buffer.from(sameCamera.bytes));
    expect(
      Buffer.compare(png.data, samePixels.data),
      "screening pixels match the production PNG export",
    ).toBe(0);
    expect(
      renderedTrials(png, exported.size, LINKS.at(-1), { rawDiagnostic: false }).eligible,
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      391,
    );
    expect(errors).toEqual([]);
  });

for (const [width, height] of [
  [390, 844],
  [1440, 900],
])
  test(`theme picker fits ${width}×${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto(APP);
    await page.waitForSelector("body[data-ready='true']", { timeout: 180000 });
    await page.evaluate(async () => {
      await import("/src/packs/qr-craft.js");
      window.__splashery.qrCraft.autoCheck = false;
      await window.__splashery.app.chooseToy("qr-picture");
    });
    const s = PICTURES.find((s) => s.theme === (width < 500 ? "ocean" : "space-art"));
    await page.evaluate((id) => window.__splashery.app.setToyOptions({ picture: id }), s.id);
    await page.waitForFunction(
      (id) =>
        !window.__splashery.app.busy &&
        window.__splashery.qrCraft.picture().options?.picture === id,
      s.id,
    );
    if (
      width < 500 &&
      (await page.locator("#sheet-toggle").getAttribute("aria-expanded")) === "false"
    )
      await page.locator("#sheet-toggle").click();
    await page.locator("#tab-play").click();
    await expect(page.locator("option:checked").filter({ hasText: "code-made" })).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width + 1,
    );
    await page.screenshot({ path: `tests/screenshots/cdx-qr-themes-${width}x${height}.png` });
  });
