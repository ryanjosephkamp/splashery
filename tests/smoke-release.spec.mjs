// Task 101: independent smoke groups can run on separate suite shards.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";
import { makePly, makeSplat, makeSpz } from "./fixtures.mjs";
import { TOYS, CATEGORIES, searchToys } from "../src/toys.js";
import { encodeSceneHash } from "../src/codec.js";

import {
  SHOTS,
  ORIGIN,
  WEBGL,
  NO_WEBGPU,
  watchConsole,
  loadApp,
  waitForToy,
  cameraStill,
  countDifferentPixels,
  inkPixels,
} from "./smoke-helpers.mjs";

// Task 91 release checks use explicit labs settings so hidden toys cannot count as results.
const FEATURED_IDS =
  `photo-3d moving-photo-3d video-3d powers-of-ten laptop electronic-keyboard electron-microscope ripple-tank cryoem-map galaxy-box smlm-microscope thermal-ellipsoids longtail volume-viewer qr-picture qr-damage qr-code model-splats chladni-cell chladni-plate song-landscape photo-album your-book enigma-machine turing-machine word-vectors gaussian-splatting gradient-descent cnn splat-equation hypercube lorenz chess-set puzzle-cube newtons-cradle lava-lamp real-elements molecule-viewer orbital-atlas unit-cells crystal-lattice protein molecule atom dna-to-protein solar-orbits real-galaxies star-systems nearby-stars real-mercury real-venus real-earth real-mars basketball knot blob torus knight-horse bmx-bike cave-lioness grape blueberry bee strawberry`.split(
    " ",
  );
const SHELF_ORDER =
  `Studio|Pictures and pages|AI and computing|Science|Space|Math|Atoms|Photoreal|Lab|Shapes|Arcade|Toys|Balls|Imaging|Earth and maps|Music|Open me|Nature|Weather & fire|Food|Gems|Body|Tiny world|Clothing|Medieval|Animals|Holidays|Vehicles|Landmarks`.split(
    "|",
  );
const RELEASE_URL = "/?renderer=webgl2&profile=weak&labs=0&first-toy=cactus";

function overlaps(a, b) {
  return (
    a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1
  );
}

test.describe("Playground release UI", () => {
  test.use({ reducedMotion: "reduce" });

  test("a shared scene wins over the first-toy pin", async ({ page }) => {
    const hash = await encodeSceneHash({
      app: "splashery",
      version: 3,
      toy: { kind: "builtin", id: "blob" },
      autoplay: { turntable: false },
    });
    await loadApp(page, `${RELEASE_URL}#s=${hash}`);
    expect(await page.evaluate(() => window.__splashery.player.scene.toy.id)).toBe("blob");
    // A malformed link keeps its previous cactus fallback, even with a different pin.
    await loadApp(page, `${RELEASE_URL.replace("first-toy=cactus", "first-toy=blob")}#s=invalid`);
    expect(await page.evaluate(() => window.__splashery.player.scene.toy.id)).toBe("cactus");
  });

  test("an embed without a toy keeps the cactus default", async ({ page }) => {
    await page.goto("/embed/?renderer=webgl2&profile=weak&first-toy=blob");
    await page.waitForFunction(() => window.__splashery?.ready, null, { timeout: 180_000 });
    expect(await page.evaluate(() => window.__splashery.player.scene.toy.id)).toBe("cactus");
  });

  test("search counts only toys on the public shelf", async ({ page }) => {
    await loadApp(page, RELEASE_URL);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator("#shelf-search").fill("QR");
    await expect(page.locator("#shelf .toy-card")).toHaveCount(0);
    await expect(page.locator("#shelf-empty")).toHaveText("No toys match “QR”.");
    await page.locator("#shelf-search").press("Enter");
    expect(await page.evaluate(() => window.__splashery.player.scene.toy.id)).toBe("cactus");
    await page.locator("#shelf-search").fill("strawberry");
    await expect(page.locator("#shelf .toy-card")).toHaveCount(1);
    await expect(page.locator("#shelf-empty")).toHaveText("");
  });

  for (const labs of [0, 1]) {
    test(`Featured and All keep the owner's order with labs=${labs}`, async ({ page }) => {
      await loadApp(page, `${RELEASE_URL}&labs=${labs}`.replace("&labs=0", ""));
      const available = TOYS.filter((t) => labs || !t.labs);
      const labels = SHELF_ORDER.filter((label) =>
        available.some((t) => {
          // Use the catalog's category names to allow labs-only shelves to hide.
          return t.category === CATEGORIES.find((c) => c.label === label)?.id;
        }),
      );
      expect(
        await page
          .locator("#shelf-chips button")
          .evaluateAll((buttons) => buttons.map((b) => b.textContent.trim())),
      ).toEqual(["", "Surprise me", "All", "Featured", ...labels]);
      expect(CATEGORIES.some((c) => c.id === "featured")).toBe(false);
      const all = labels.flatMap((label) =>
        available
          .filter((t) => t.category === CATEGORIES.find((c) => c.label === label).id)
          .map((t) => t.id),
      );
      expect(
        await page
          .locator("#shelf .toy-card")
          .evaluateAll((cards) => cards.map((c) => c.dataset.toy)),
      ).toEqual(all);
      await page.locator("[data-category='featured']").click();
      await expect(page.locator("[data-category='featured']")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      const expected = FEATURED_IDS.filter((id) => available.some((t) => t.id === id));
      expect(
        await page
          .locator("#shelf .toy-card")
          .evaluateAll((cards) => cards.map((c) => c.dataset.toy)),
      ).toEqual(expected);
      await page.locator("#shelf-surprise").click();
      await expect
        .poll(() => page.evaluate(() => window.__splashery.player.scene.toy.id))
        .not.toBe("cactus");
      expect(expected).toContain(await page.evaluate(() => window.__splashery.player.scene.toy.id));
    });

    test(`a fresh visit opens a Featured toy with labs=${labs}`, async ({ page }) => {
      await loadApp(page, `/?renderer=webgl2&profile=weak&labs=${labs}&first-toy=featured`);
      const id = await page.evaluate(() => window.__splashery.player.scene.toy.id);
      expect(FEATURED_IDS).toContain(id);
      if (!labs) expect(TOYS.find((t) => t.id === id).labs).not.toBe(true);
    });
  }

  for (const [width, height] of [
    [390, 844],
    [1440, 900],
    [320, 568],
    [844, 390],
    [1280, 742],
  ]) {
    test(`controls and shelf cards fit at ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await loadApp(page, RELEASE_URL);
      const layout = () =>
        page.evaluate(() => {
          const rect = (e) => {
            const { top, right, bottom, left, width, height } = e.getBoundingClientRect();
            return { top, right, bottom, left, width, height };
          };
          const visible = (e) => e.checkVisibility();
          return {
            buttons: [
              ...document.querySelectorAll(
                ".view-button, .sound-toggle, .help-toggle, .hands-button, .stage-zoom button",
              ),
            ]
              .filter(visible)
              .map((e) => ({ id: e.id, ...rect(e) })),
            stage: rect(document.getElementById("stage")),
            panel: rect(document.getElementById("panel")),
            status: visible(document.getElementById("toy-status"))
              ? rect(document.getElementById("toy-status"))
              : null,
            brand: visible(document.querySelector(".brand"))
              ? rect(document.querySelector(".brand"))
              : null,
            tools: [...document.querySelectorAll("#tools button")].map(rect),
            toolBox: rect(document.getElementById("tools")),
            toolbar: rect(document.querySelector(".toolbar")),
            dock: rect(document.querySelector(".dock")),
          };
        });
      const check = async () => {
        const m = await layout();
        for (const [i, a] of m.buttons.entries()) {
          expect(a.left, a.id).toBeGreaterThanOrEqual(0);
          expect(a.right, a.id).toBeLessThanOrEqual(width);
          expect(a.top, a.id).toBeGreaterThanOrEqual(0);
          expect(a.bottom, a.id).toBeLessThanOrEqual(height);
          expect(a.width, a.id).toBeGreaterThanOrEqual(44);
          expect(a.height, a.id).toBeGreaterThanOrEqual(44);
          for (const b of m.buttons.slice(i + 1))
            expect(overlaps(a, b), `${a.id} / ${b.id}`).toBe(false);
          if (m.status) expect(overlaps(a, m.status), `${a.id} / caption`).toBe(false);
          if (m.brand) expect(overlaps(a, m.brand), `${a.id} / brand`).toBe(false);
        }
        for (const t of m.tools) {
          expect(t.left).toBeGreaterThanOrEqual(m.toolBox.left);
          expect(t.right).toBeLessThanOrEqual(m.toolBox.right);
          expect(t.top).toBeGreaterThanOrEqual(m.toolbar.top);
          expect(t.bottom).toBeLessThanOrEqual(m.toolbar.bottom);
          expect(t.bottom).toBeLessThanOrEqual(m.dock.bottom + 1);
          expect(t.width).toBeGreaterThanOrEqual(44);
          expect(t.height).toBeGreaterThanOrEqual(44);
        }
        if (width <= 760) {
          if (m.status) expect(m.stage.top).toBeGreaterThanOrEqual(m.status.bottom);
          expect(m.stage.bottom).toBeLessThanOrEqual(m.panel.top + 1);
        }
      };
      await check();
      if (width <= 760) await page.locator("#sheet-handle").click();
      // Check each card's contents and neighboring rows, including below the fold.
      const badCards = await page.locator("#shelf .toy-card").evaluateAll((cards) =>
        cards
          .filter((card, i) => {
            const a = card.getBoundingClientRect();
            const name = card.querySelector(".toy-card-name").getBoundingClientRect();
            const img = card.querySelector("img, .thumb").getBoundingClientRect();
            const next = cards
              .slice(i + 1)
              .find((b) => b.getBoundingClientRect().top > a.top + 1)
              ?.getBoundingClientRect();
            return (
              name.bottom > a.bottom + 1 ||
              name.top < img.bottom - 1 ||
              (next && next.top < a.bottom - 1)
            );
          })
          .map((c) => c.dataset.toy),
      );
      expect(badCards).toEqual([]);
      if (width <= 760) {
        await page.locator("#sheet-toggle").click();
        await expect(
          page.locator(".view-button:visible, .sound-toggle:visible, .help-toggle:visible"),
        ).toHaveCount(0);
        await check();
      }
    });
  }
});
