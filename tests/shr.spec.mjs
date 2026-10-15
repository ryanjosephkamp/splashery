// Share lane (October 15, 2026): the tab order (Toy, Share, Tools, Look, Make,
// then the (i) tab) and its arrow keys; Clap to tap at the bottom of the Tools
// tab (labs); the Share tab laid out for a phone first, with nothing cut off,
// overlapping or scrolling sideways; and the preview sheet after Record (play
// it back, then Save, Share, Record again, or Discard, which asks first and
// frees the recording).

import { test, expect } from "@playwright/test";

const DESK = { viewport: { width: 1440, height: 900 } };
const PHONE = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const SIZES = [
  ["390x844", PHONE],
  ["1440x900", DESK],
];
const SHOTS = new URL("./screenshots/", import.meta.url);
const shot = (name) => new URL(name, SHOTS).pathname;

const ORDER = ["play", "share", "tools", "look", "make", "about"];

async function open(page, { labs = false } = {}) {
  await page.goto(`/?renderer=webgl2&profile=weak&labs=${labs ? 1 : 0}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
}

async function pick(page, id) {
  await page.evaluate((id) => window.__splashery.app.chooseToy(id), id);
  await page.waitForFunction((id) => window.__splashery.player.toyInfo?.id === id, id, { timeout: 120_000 }); // prettier-ignore
}

// The panel's tabs: on a phone they are in the sheet, opened first.
async function showTab(page, name) {
  if (await page.locator("#sheet-toggle").isVisible()) {
    if (!(await page.locator("body").evaluate((b) => b.classList.contains("sheet-open"))))
      await page.click("#sheet-toggle");
  }
  await page.click(`#tab-${name}`);
  await expect(page.locator(`#pane-${name}`)).toBeVisible();
}

function watchErrors(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

// Every visible control in a pane: inside the pane's width, not overlapping
// another, and the pane and the page never scroll sideways.
async function layoutProblems(page, pane) {
  return page.evaluate((pane) => {
    const root = document.getElementById(pane);
    const panes = document.getElementById("panes");
    const box = panes.getBoundingClientRect();
    const out = [];
    if (panes.scrollWidth > panes.clientWidth + 1) out.push(`panes scroll sideways (${panes.scrollWidth} > ${panes.clientWidth})`); // prettier-ignore
    if (document.documentElement.scrollWidth > innerWidth + 1)
      out.push("the page scrolls sideways");
    const els =
      [...root.querySelectorAll("button, select, textarea, input:not([type=file]), .file-button")] // prettier-ignore
        .filter((el) => el.offsetParent && !el.closest(".file-button input"))
        .filter((el) => !(el.matches("button") && el.closest(".file-button")));
    const rects = els.map((el) => ({ el, r: el.getBoundingClientRect() }));
    const name = (el) => el.id || el.textContent.trim().slice(0, 20) || el.tagName;
    for (const { el, r } of rects) {
      if (r.width < 8 || r.height < 8) out.push(`${name(el)} is squeezed`);
      if (r.left < box.left - 0.5 || r.right > box.right + 0.5) out.push(`${name(el)} is cut off`);
      if (el.scrollWidth > el.clientWidth + 2 && el.tagName === "BUTTON") out.push(`${name(el)}'s text is cut off`); // prettier-ignore
      if (el.tagName === "SELECT") {
        // The chosen option's words fit beside the arrow (about 24 px).
        const g = document.createElement("canvas").getContext("2d");
        const cs = getComputedStyle(el);
        g.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const text = g.measureText(el.selectedOptions[0]?.text || "").width;
        const room = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 20; // prettier-ignore
        if (text > room) out.push(`${name(el)}'s choice is cut off`);
      }
    }
    for (let i = 0; i < rects.length; i++)
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i].r;
        const b = rects[j].r;
        if (rects[i].el.contains(rects[j].el) || rects[j].el.contains(rects[i].el)) continue;
        const x = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (x > 1 && y > 1) out.push(`${name(rects[i].el)} overlaps ${name(rects[j].el)}`);
      }
    return out;
  }, pane);
}

for (const [size, use] of SIZES) {
  test.describe(size, () => {
    test.use(use);

    test("the tabs go Toy, Share, Tools, Look, Make, then (i), and the arrow keys follow", async ({
      page,
    }) => {
      const errors = watchErrors(page);
      await open(page);
      await showTab(page, "play");
      const ids = await page.$$eval("#tabs [role=tab]", (t) => t.map((b) => b.id.slice(4)));
      expect(ids).toEqual(ORDER);
      // On screen too: left to right, in one row.
      const boxes = await page.$$eval("#tabs [role=tab]", (t) => t.map((b) => b.getBoundingClientRect().toJSON())); // prettier-ignore
      for (let i = 1; i < boxes.length; i++) {
        expect(boxes[i].left).toBeGreaterThanOrEqual(boxes[i - 1].right - 1);
        expect(Math.abs(boxes[i].top - boxes[0].top)).toBeLessThan(2);
      }
      await expect(page.locator("#tab-play")).toHaveText("Toy");
      await expect(page.locator("#tab-share")).toHaveText("Share");
      // The arrow keys walk the same order and wrap; Home and End jump.
      await page.focus("#tab-play");
      const selected = () => page.$eval("#tabs [aria-selected=true]", (b) => b.id.slice(4));
      const focused = () => page.evaluate(() => document.activeElement.id.slice(4));
      for (const name of [...ORDER.slice(1), ORDER[0]]) {
        await page.keyboard.press("ArrowRight");
        expect(await selected()).toBe(name);
        expect(await focused()).toBe(name);
        await expect(page.locator(`#pane-${name}`)).toBeVisible();
      }
      await page.keyboard.press("ArrowLeft");
      expect(await selected()).toBe("about");
      await page.keyboard.press("ArrowLeft");
      expect(await selected()).toBe("make");
      await page.keyboard.press("Home");
      expect(await selected()).toBe("play");
      await page.keyboard.press("End");
      expect(await selected()).toBe("about");
      // Only the selected tab is in the Tab order.
      const stops = await page.$$eval("#tabs [role=tab]", (t) => t.filter((b) => b.tabIndex === 0).length); // prettier-ignore
      expect(stops).toBe(1);
      expect(errors).toEqual([]);
    });

    test("the Share tab: Record first, then a clip and a picture, the link and the scene file, PDF, and the web page; nothing cut off or overlapping", async ({
      page,
    }) => {
      const errors = watchErrors(page);
      await open(page, { labs: true });
      await showTab(page, "share");
      const sections = await page.$$eval("#pane-share > section", (s) => s.map((x) => x.id));
      expect(sections).toEqual(["record-group", "media-group", "share-group", "pdf-row", "embed-group"]); // prettier-ignore
      // Record is the tab's first control and its main button, with its line.
      const first = await page.$eval("#pane-share", (p) => p.querySelector("button, select, input").id); // prettier-ignore
      expect(first).toBe("record-start");
      await expect(page.locator("#record-start")).toHaveClass(/primary/);
      await expect(page.locator("#record-note")).toContainText("You play, it records, with sound");
      // Save a clip: Video and GIF behind one switch, each with one Save button under its settings.
      const order = await page.$$eval("#media-group > [id]:not(h2)", (s) => s.map((x) => x.id));
      expect(order).toEqual(["clip-kind", "webm-block", "gif-block", "png-row"]);
      await expect(page.locator("#clip-kind [data-clip=video]")).toHaveAttribute("aria-pressed", "true"); // prettier-ignore
      await expect(page.locator("#webm-seconds")).toBeVisible();
      await expect(page.locator("#gif-size")).toBeHidden();
      const under = async (settings, button) => {
        const s = await page.locator(settings).boundingBox();
        const b = await page.locator(button).boundingBox();
        expect(b.y).toBeGreaterThanOrEqual(s.y + s.height - 1);
      };
      await under("#webm-row", "#export-webm");
      expect(await layoutProblems(page, "pane-share")).toEqual([]);
      await page.screenshot({ path: shot(`shr-share-${size}.png`) });
      await page.click("#clip-kind [data-clip=gif]");
      await expect(page.locator("#clip-kind [data-clip=gif]")).toHaveAttribute("aria-pressed", "true"); // prettier-ignore
      await expect(page.locator("#webm-seconds")).toBeHidden();
      for (const id of ["gif-kind", "gif-frames", "gif-size", "export-gif"])
        await expect(page.locator(`#${id}`)).toBeVisible();
      // The GIF's settings in one row, even with the longest choice of each.
      await page.evaluate(() => {
        for (const s of document.querySelectorAll("#gif-row select")) {
          const long = [...s.options].sort((a, b) => b.text.length - a.text.length)[0];
          s.dataset.was = s.value;
          s.value = long.value;
        }
      });
      expect(await layoutProblems(page, "pane-share")).toEqual([]);
      await page.evaluate(() => {
        for (const s of document.querySelectorAll("#gif-row select")) s.value = s.dataset.was;
      });
      const tops = await page.$$eval("#gif-row select", (s) => s.map((x) => Math.round(x.getBoundingClientRect().top))); // prettier-ignore
      expect(new Set(tops).size).toBe(1);
      await under("#gif-row", "#export-gif");
      expect(await layoutProblems(page, "pane-share")).toEqual([]);
      await page.locator("#media-group").screenshot({ path: shot(`shr-share-gif-${size}.png`) });
      // Link and scene file, in plain words, with what a scene file holds.
      await expect(page.locator("#export-json")).toHaveText("Save scene");
      await expect(page.locator("#share-group .file-button")).toHaveText("Open a scene");
      await expect(page.locator("#scene-note")).toContainText("A scene file keeps the toy, its settings, the look, any paint, and the camera"); // prettier-ignore
      await expect(page.locator("#scene-note")).toContainText("A photo or file you opened yourself isn't inside it"); // prettier-ignore
      await expect(page.locator("#share-qr")).toBeVisible(); // labs
      await expect(page.locator("#export-pdf")).toBeVisible(); // labs
      // The ids Codex task 89 fills keep their names.
      for (const id of ["gif-kind", "gif-frames", "gif-size", "webm-seconds", "record-start", "import-json"]) // prettier-ignore
        await expect(page.locator(`#${id}`)).toHaveCount(1);
      // Scrolled to the end, the last controls are still whole and reachable.
      await page.locator("#element-copy").scrollIntoViewIfNeeded();
      await expect(page.locator("#element-copy")).toBeInViewport();
      expect(await layoutProblems(page, "pane-share")).toEqual([]);
      await page.screenshot({ path: shot(`shr-share-end-${size}.png`) });
      expect(errors).toEqual([]);
    });

    test("the preview sheet after Stop plays the take; Discard asks first and frees it; Save still saves", async ({
      page,
    }) => {
      const errors = watchErrors(page);
      await open(page);
      await pick(page, "donut");
      await showTab(page, "share");
      const take = async (ms = 2500) => {
        await page.click("#record-start");
        await expect(page.locator("#rec-pill")).toBeVisible();
        await page.waitForTimeout(ms);
        await page.click("#rec-stop");
        await expect(page.locator("#rec-preview")).toBeVisible({ timeout: 30_000 });
      };
      await take();
      // A dialog with a name, for a screen reader, and the keyboard is inside it.
      const sheet = page.getByRole("dialog", { name: "Your recording" });
      await expect(sheet).toBeVisible();
      await expect(page.locator("#rec-pill")).toBeHidden();
      expect(await page.evaluate(() => document.activeElement.id)).toBe("rec-save");
      // A video player with the take, about as long as the take.
      const v = await page.waitForFunction(
        () => {
          const v = document.getElementById("rec-video");
          return v.readyState >= 1 && Number.isFinite(v.duration) && v.duration > 0
            ? { d: v.duration, src: v.currentSrc, controls: v.controls, s: window.__splashery.app.recorded?.seconds } // prettier-ignore
            : null;
        },
        null,
        { timeout: 30_000 },
      );
      const got = await v.jsonValue();
      expect(got.controls).toBe(true);
      expect(got.src).toMatch(/^blob:/);
      expect(got.s).toBeGreaterThan(1.5);
      expect(Math.abs(got.d - got.s)).toBeLessThan(1.2);
      // It plays (muted here, so the browser lets it start without a tap).
      await page.evaluate(() => {
        const v = document.getElementById("rec-video");
        v.muted = true;
        v.currentTime = 0;
        return v.play();
      });
      await page.waitForFunction(() => document.getElementById("rec-video").currentTime > 0.2, null, { timeout: 20_000 }); // prettier-ignore
      await page.evaluate(() => document.getElementById("rec-video").pause());
      // The whole sheet is on screen, and its buttons are whole and apart.
      const vp = page.viewportSize();
      const b = await sheet.boundingBox();
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(vp.width + 0.5);
      expect(b.y + b.height).toBeLessThanOrEqual(vp.height + 0.5);
      for (const id of ["rec-save", "rec-again", "rec-discard", "rec-close"]) {
        await expect(page.locator(`#${id}`)).toBeInViewport({ ratio: 1 });
      }
      await page.screenshot({ path: shot(`shr-preview-${size}.png`) });
      // The keys stay in the sheet: Tab moves among its controls.
      // (After its last control a modal dialog hands Tab to the browser, then back to itself.)
      const at = () => page.evaluate(() => document.activeElement.id);
      await page.keyboard.press("Tab");
      expect(await at()).toBe("rec-again");
      await page.keyboard.press("Tab");
      expect(await at()).toBe("rec-discard");
      // Back through the player (its own controls are stops inside it) to Close.
      const seen = [];
      for (let i = 0; i < 12 && (await at()) !== "rec-close"; i++) {
        await page.keyboard.press("Shift+Tab");
        seen.push(await at());
      }
      expect(seen).toContain("rec-video");
      expect(seen.at(-1)).toBe("rec-close");
      // And they don't reach the toy: P would poke it, R reset the view.
      await page.evaluate(() => {
        window.__acts = 0;
        const { app } = window.__splashery;
        for (const k of ["pokeRandom", "resetCamera"]) {
          const f = app[k].bind(app);
          app[k] = () => (window.__acts++, f());
        }
      });
      await page.keyboard.press("p");
      await page.keyboard.press("r");
      expect(await page.evaluate(() => window.__acts)).toBe(0);
      // Discard asks first; "Keep it" keeps it.
      await page.click("#rec-discard");
      await expect(page.locator("#rec-confirm")).toBeVisible();
      await expect(page.locator("#rec-confirm")).toContainText("Discard this recording?");
      await expect(page.locator("#rec-actions")).toBeHidden();
      await page.screenshot({ path: shot(`shr-preview-discard-${size}.png`) });
      await page.click("#rec-confirm-no");
      await expect(page.locator("#rec-confirm")).toBeHidden();
      await expect(sheet).toBeVisible();
      // Escape asks too, and a second Escape backs out of the question.
      await page.keyboard.press("Escape");
      await expect(page.locator("#rec-confirm")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator("#rec-confirm")).toBeHidden();
      await expect(sheet).toBeVisible();
      // Discard, yes: the sheet closes and lets go of the recording.
      const url = await page.evaluate(() => document.getElementById("rec-video").src.split("#")[0]); // prettier-ignore
      await page.click("#rec-discard");
      await page.click("#rec-confirm-yes");
      await expect(sheet).toBeHidden();
      const freed = await page.evaluate(async (url) => {
        const v = document.getElementById("rec-video");
        let revoked = false;
        try {
          await fetch(url);
        } catch {
          revoked = true;
        }
        return { recorded: window.__splashery.app.recorded, src: v.getAttribute("src"), revoked }; // prettier-ignore
      }, url);
      expect(freed).toEqual({ recorded: null, src: null, revoked: true });
      await expect(page.locator("#rec-pill")).toBeHidden();
      // Another take: Save still saves, and then Close closes without asking.
      await showTab(page, "share");
      await take(1500);
      const name = await page.evaluate(() => window.__splashery.app.recorded.name);
      expect(name).toMatch(/^splashery-\d{8}-\d{6}\.(mp4|webm)$/);
      const download = page.waitForEvent("download");
      await page.click("#rec-save");
      const d = await download;
      expect(d.suggestedFilename()).toBe(name);
      await page.click("#rec-close");
      await expect(sheet).toBeHidden();
      expect(await page.evaluate(() => window.__splashery.app.recorded)).toBe(null);
      expect(errors).toEqual([]);
    });
  });
}

test.describe("Clap to tap", () => {
  test.use(DESK);

  test("with labs on, it is at the bottom of the Tools tab, not on the Toy tab, and asks for nothing until switched on", async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.addInitScript(() => {
      window.__mic = 0;
      const md = navigator.mediaDevices;
      if (md?.getUserMedia) {
        const real = md.getUserMedia.bind(md);
        md.getUserMedia = (c) => (window.__mic++, real(c));
      }
    });
    await open(page, { labs: true });
    await page.waitForSelector("#clap-to-tap", { state: "attached" });
    await expect(page.locator("#pane-play #clap-to-tap")).toHaveCount(0);
    await expect(page.locator("#pane-play #live-group")).toHaveCount(0);
    await showTab(page, "tools");
    const last = await page.$eval("#pane-tools", (p) => p.lastElementChild.id);
    expect(last).toBe("live-group");
    await expect(page.locator("#live-group")).toContainText("Clap to tap (labs)");
    await expect(page.locator("#clap-to-tap")).toBeVisible();
    await expect(page.locator("#clap-to-tap")).not.toBeChecked();
    await page.locator("#live-group").scrollIntoViewIfNeeded();
    await page.screenshot({ path: shot("shr-clap-1440x900.png") });
    expect(await page.evaluate(() => window.__mic)).toBe(0);
    await expect(page.locator("#live-indicator")).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("with labs off, it isn't anywhere", async ({ page }) => {
    await open(page);
    await page.waitForTimeout(500);
    await expect(page.locator("#clap-to-tap")).toHaveCount(0);
    await expect(page.locator("#live-group")).toHaveCount(0);
  });
});
