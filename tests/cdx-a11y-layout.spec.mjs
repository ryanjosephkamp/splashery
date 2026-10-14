import { test, expect } from "@playwright/test";

test.use({ actionTimeout: 10_000 });

async function open(page, width, height) {
  await page.setViewportSize({ width, height });
  await page.goto("/?renderer=webgl2&profile=weak&labs=0");
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

// A small set of axe-style rules, using browser semantics and computed geometry.
// Associated labels are part of a control's effective pointer target.
async function violations(page) {
  return page.evaluate(() => {
    const errors = [];
    const controls = document.querySelectorAll(
      "button, input:not([type=file]):not([type=hidden]), select, textarea, .toy-keyboard > summary, a.button, a.open-link",
    );
    const named = (e) =>
      e.getAttribute("aria-label") ||
      (e.getAttribute("aria-labelledby") || "")
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent || "")
        .join(" ")
        .trim() ||
      Array.from(e.labels || [])
        .map((l) => l.textContent)
        .join(" ")
        .trim() ||
      e.textContent.trim() ||
      e.title;
    for (const e of controls) {
      if (!e.checkVisibility() || e.disabled) continue;
      const id = e.id || e.textContent.trim();
      if (!named(e)) errors.push(`${id}: missing accessible name`);
      const label = e.labels?.[0];
      const r = (label || e).getBoundingClientRect();
      if (r.width < 43.9 || r.height < 43.9)
        errors.push(`${id}: target ${r.width.toFixed(1)} × ${r.height.toFixed(1)}`);
      if (e.getAttribute("aria-controls"))
        for (const ref of e.getAttribute("aria-controls").split(/\s+/))
          if (!document.getElementById(ref))
            errors.push(`${id}: missing controlled element ${ref}`);
    }
    for (const e of document.querySelectorAll(".toy-card span, .tools button, .group h2")) {
      if (
        e.checkVisibility() &&
        (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)
      )
        errors.push(`${e.textContent}: clipped text`);
    }
    const ids = Array.from(document.querySelectorAll("[id]"), (e) => e.id);
    if (new Set(ids).size !== ids.length) errors.push("duplicate IDs");
    return errors;
  });
}

for (const [name, width, height] of [
  ["phone", 390, 844],
  ["desktop", 1440, 900],
  ["desktop at 200% zoom", 720, 450],
]) {
  test(`${name}: names, target sizes, and text fit in all six panes`, async ({ page }) => {
    await open(page, width, height);
    expect(await violations(page)).toEqual([]);
    if (width <= 760) await page.locator("#sheet-toggle").click();
    for (const tab of ["play", "tools", "look", "make", "share", "about"]) {
      await page.locator(`#tab-${tab}`).click();
      expect(await violations(page), tab).toEqual([]);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  });
}

for (const theme of ["light", "dark"]) {
  test(`${theme}: text, boundaries, and keyboard focus have AA contrast`, async ({ page }) => {
    await open(page, 390, 844);
    await page.evaluate((theme) => {
      document.documentElement.dataset.theme = theme;
    }, theme);
    const ratios = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      const rgb = (name) =>
        css
          .getPropertyValue(name)
          .trim()
          .slice(1)
          .match(/../g)
          .map((v) => parseInt(v, 16) / 255);
      const lum = (name) =>
        rgb(name)
          .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
          .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
      const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
      return [
        ratio("--ink", "--page"),
        ratio("--muted", "--page"),
        ratio("--faint", "--page"),
        ratio("--accent", "--page"),
        ratio("--accent-ink", "--accent"),
        ratio("--line-strong", "--page"),
      ];
    });
    for (const ratio of ratios.slice(0, 5)) expect(ratio).toBeGreaterThanOrEqual(4.5);
    expect(ratios[5]).toBeGreaterThanOrEqual(3);
    await page.locator("#stage-zoom-in").focus();
    await page.keyboard.press("Tab");
    const focus = await page.locator("#stage-zoom-out").evaluate((e) => ({
      visible: e.matches(":focus-visible"),
      outline: getComputedStyle(e).outlineStyle,
      width: getComputedStyle(e).outlineWidth,
    }));
    expect(focus).toEqual({ visible: true, outline: "solid", width: "2px" });
  });
}

test("changing reduced motion stops automatic movement immediately", async ({ page }) => {
  await open(page, 1440, 900);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() => page.evaluate(() => window.__splashery.player.reducedMotion), { timeout: 3000 })
    .toBe(true);
  const motion = await page.evaluate(() => {
    const p = window.__splashery.player;
    return {
      allowed: p.motionAllowed,
      alive: p.effectiveMotion().alive,
      turntable: p.camera.turntable,
    };
  });
  expect(motion).toMatchObject({ allowed: false, alive: false, turntable: false });
  await expect(page.locator("#turntable-toggle")).toBeDisabled();
});

test("recording and the flag dialog preserve keyboard focus", async ({ page }) => {
  await open(page, 390, 844);
  await page.locator("#flag-toggle").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#flag-global")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#flag-pop")).toBeHidden();
  await expect(page.locator("#flag-toggle")).toBeFocused();
  await page.locator("#sheet-toggle").click();
  await page.locator("#tab-share").click();
  await page.locator("#record-start").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#rec-stop")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#rec-save")).toBeVisible();
});

test("the link dialog closes with Escape and restores its opener", async ({ page }) => {
  await open(page, 390, 844);
  await page.locator("#stage").focus();
  await page.evaluate(() => window.__splashery.app.ui.confirmLink("https://example.com/"));
  await expect(page.getByRole("dialog", { name: "Open a link" })).toBeVisible();
  await expect(page.locator("#link-confirm-open")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("#link-confirm-cancel")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Open a link" })).toBeHidden();
  await expect(page.locator("#stage")).toBeFocused({ timeout: 3000 });
});

test("focus mode hides the brand and Escape returns to its control", async ({ page }) => {
  await open(page, 390, 844);
  await page.locator("#focus-toggle").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#focus-exit")).toBeFocused();
  await expect(page.locator(".brand")).toBeHidden({ timeout: 3000 });
  await page.keyboard.press("Escape");
  await expect(page.locator("#focus-toggle")).toBeFocused();
  await expect(page.locator(".brand")).toBeVisible();
});

test("zoom controls are hidden when graphics are unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (kind.includes("webgl")) return null;
      return getContext.call(this, kind, ...args);
    };
  });
  await open(page, 390, 844);
  await expect(page.locator("#fallback")).toBeVisible();
  await expect(page.locator("#stage-zoom")).toBeHidden({ timeout: 3000 });
});
