// Lane PDF lab (docs/handoff/PDFLab.md): Save as PDF from any toy.
// The PDF parses with the vendored PDF.js; its link and QR code (read back
// with the vendored jsQR from a render of the page) open this scene; the
// moving recording keeps within the size the dialog estimated; and the flip
// book really plays in PDF.js with its scripting on (pdfjs-dist, the same
// 6.3.289 as vendor/pdfjs/, the engine inside Firefox). Old links still load.

import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { PNG } from "pngjs";
import { decodeSceneHash, encodeSceneHash } from "../src/codec.js";
import { normalizeScene } from "../src/state.js";
import { buildToyPDF, buildCatalogPDF, estimateRecording } from "../src/pdf-export/pdf.js";
import { toyEntry, toyLink, SITE } from "../src/pdf-export/entry.js";

const APP = "/?renderer=webgl2&adapt=off&profile=mid&labs=1";
const FRAMES = "docs/audits/pdf-motion-2026-10/frames/";

const jsQR = (() => {
  const m = { exports: {} };
  new Function("module", "exports", fs.readFileSync("vendor/jsqr/jsQR.js", "utf8"))(m, m.exports);
  return m.exports.default || m.exports;
})();
const readPNG = (buf) => {
  const png = PNG.sync.read(buf);
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data ?? null;
};
const sceneOf = async (url) => normalizeScene(await decodeSceneHash(url.split("#s=")[1]));

// Reads a PDF in the page with the vendored PDF.js: its pages' text, links,
// form fields and a PNG of each page.
async function inspect(page, bytes, { scale = 2.5 } = {}) {
  const b64 = Buffer.from(bytes).toString("base64");
  const out = await page.evaluate(
    async ({ b64, scale }) => {
      const pdfjs = await import("/vendor/pdfjs/pdf.min.mjs");
      pdfjs.GlobalWorkerOptions.workerSrc = "/vendor/pdfjs/pdf.worker.min.mjs";
      const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const doc = await pdfjs.getDocument({ data }).promise;
      const pages = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const p = await doc.getPage(i);
        const text = (await p.getTextContent()).items.map((x) => x.str).join(" ");
        const annots = await p.getAnnotations();
        const vp = p.getViewport({ scale });
        const c = document.createElement("canvas");
        c.width = vp.width;
        c.height = vp.height;
        await p.render({ canvasContext: c.getContext("2d"), viewport: vp, annotationMode: pdfjs.AnnotationMode.ENABLE }).promise; // prettier-ignore
        pages.push({
          text,
          links: annots.filter((a) => a.subtype === "Link" && a.url).map((a) => a.url),
          fields: annots.filter((a) => a.fieldName).map((a) => ({ name: a.fieldName, hidden: !!a.hidden })), // prettier-ignore
          png: c.toDataURL("image/png"),
        });
      }
      return { count: doc.numPages, title: (await doc.getMetadata()).info.Title, pages };
    },
    { b64, scale },
  );
  for (const p of out.pages) p.png = Buffer.from(p.png.split(",")[1], "base64");
  return out;
}

async function openApp(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  return errors;
}

test("a toy's page made without the app: parses, says what the toy is, and its link and QR open it", async ({
  page,
}) => {
  // prettier-ignore
  await page.goto("/manifest.webmanifest");
  const still = { bytes: new Uint8Array(fs.readFileSync(`${FRAMES}frame-010.jpg`)), type: "jpeg" };
  const entry = await toyEntry("grapes", { still });
  expect(entry.url.startsWith(`${SITE}#s=`)).toBe(true);
  const scene = await sceneOf(entry.url);
  expect(scene.toy).toMatchObject({ kind: "builtin", id: "grapes" });
  const pdf = await inspect(page, await buildToyPDF(entry));
  expect(pdf.count).toBe(1);
  expect(pdf.title).toContain("Grapes");
  const p1 = pdf.pages[0];
  expect(p1.text).toContain("Grapes");
  expect(p1.text).toContain("How to play");
  expect(p1.text).toContain(entry.howTo.slice(0, 30));
  expect(p1.text).toContain("Credits and licenses");
  expect(p1.text).toContain("Open the live toy");
  expect(p1.links.length).toBeGreaterThan(0);
  expect(new Set(p1.links)).toEqual(new Set([entry.url]));
  expect(readPNG(p1.png)).toBe(entry.url);
  // A scan's credit and license show on its page.
  const strawberry = await toyEntry("strawberry", { still });
  const sp = await inspect(page, await buildToyPDF(strawberry), { scale: 1 });
  expect(sp.pages[0].text).toContain("Dany Bittel");
  expect(sp.pages[0].text).toContain("CC BY 4.0");
  expect(sp.pages[0].links).toContain("https://superspl.at/scene/84df8849");
});

test("a catalog: one page per toy, each with its own link", async ({ page }) => {
  await page.goto("/manifest.webmanifest");
  const still = { bytes: new Uint8Array(fs.readFileSync(`${FRAMES}frame-000.jpg`)), type: "jpeg" };
  const ids = ["grapes", "strawberry", "cactus"];
  const entries = await Promise.all(ids.map((id) => toyEntry(id, { still })));
  const pdf = await inspect(page, await buildCatalogPDF(entries), { scale: 1 });
  expect(pdf.count).toBe(ids.length);
  for (let i = 0; i < ids.length; i++) {
    expect(pdf.pages[i].links).toContain(await toyLink(ids[i]));
    expect(pdf.pages[i].text).toContain(entries[i].label);
  }
});

test("Save PDF in the app: the still's link and QR open this scene, as the camera is now", async ({
  page,
}) => {
  // prettier-ignore
  const errors = await openApp(page);
  await page.evaluate(() => window.__splashery.app.chooseToy("grapes"));
  await page.waitForTimeout(1500);
  // Turn the camera so the scene in the link is this one, not the toy's start.
  await page.evaluate(() => {
    const { player } = window.__splashery;
    const cam = player.camera.getState();
    player.camera.setState({ ...cam, yaw: cam.yaw + 0.7, distance: 5 }, { snap: true });
  });
  const res = await page.evaluate(async () => {
    const m = await import("/src/pdf-export/index.js");
    const { app, player } = window.__splashery;
    const out = await m.makeToyPDF(app, { mode: "still" });
    return { bytes: Array.from(out.bytes), url: out.entry.url, cam: player.camera.getState() };
  });
  expect(errors).toEqual([]);
  const scene = await sceneOf(res.url);
  expect(scene.toy).toMatchObject({ kind: "builtin", id: "grapes" });
  expect(scene.camera.yaw).toBeCloseTo(res.cam.yaw, 2);
  expect(scene.camera.distance).toBeCloseTo(5, 2);
  const pdf = await inspect(page, new Uint8Array(res.bytes));
  expect(pdf.count).toBe(1);
  expect(pdf.pages[0].links).toContain(res.url);
  expect(readPNG(pdf.pages[0].png)).toBe(res.url);
  expect(pdf.pages[0].text).toContain("Grapes");
});

test("the moving recording: one tap, its frames and size within the estimate", async ({ page }) => {
  const errors = await openApp(page);
  await page.evaluate(() => window.__splashery.app.chooseToy("grapes"));
  await page.waitForTimeout(1500);
  const opts = { size: 320, fps: 8, maxSeconds: 6 };
  const res = await page.evaluate(async (opts) => {
    const m = await import("/src/pdf-export/index.js");
    const { app } = window.__splashery;
    const still = await m.makeToyPDF(app, { mode: "still" });
    const est = await m.estimate(app, opts);
    const out = await m.makeToyPDF(app, { mode: "moving", ...opts });
    return {
      stillBytes: still.bytes.length,
      bytes: Array.from(out.bytes),
      est,
      frames: out.recording.frames.length,
      tapFrame: out.recording.tapFrame,
      settled: out.recording.settled,
      first: Array.from(out.recording.frames[0]),
      mid: Array.from(out.recording.frames[Math.floor(out.recording.frames.length / 3)]),
    };
  }, opts);
  expect(errors).toEqual([]);
  expect(res.frames).toBeGreaterThan(res.tapFrame + 4);
  expect(res.frames).toBeLessThanOrEqual(res.est.frames);
  expect(res.settled).toBe(true); // the grapes come back within 6 seconds
  expect(res.bytes.length).toBeLessThanOrEqual(res.stillBytes + res.est.bytes);
  // The recording moves: a frame during the tap is not the frame before it.
  expect(Buffer.from(res.mid).equals(Buffer.from(res.first))).toBe(false);
  const pdf = await inspect(page, new Uint8Array(res.bytes), { scale: 1 });
  expect(pdf.count).toBe(2);
  const frames = pdf.pages[1].fields.filter((f) => /^spf\d+$/.test(f.name));
  expect(frames.length).toBe(res.frames);
  expect(frames.filter((f) => !f.hidden).map((f) => f.name)).toEqual(["spf0"]);
  expect(pdf.pages[1].text).toContain("not the toy itself");
  expect(pdf.pages[1].text).toContain("desktop Firefox");
  expect(pdf.pages[1].links.length).toBeGreaterThan(0);
});

test("the estimate formula is an upper bound for frames as busy as 1.6 times the sample", () => {
  expect(estimateRecording({ frames: 40, sampleBytes: 10000 })).toBeGreaterThan(40 * 16000);
});

// ---- Playback in PDF.js with scripting (the engine inside Firefox) -------------------

const VIEWER = `<!doctype html><meta charset=utf-8>
<link rel=stylesheet href="/node_modules/pdfjs-dist/legacy/web/pdf_viewer.css">
<style>body{margin:0}#c{position:absolute;inset:0;overflow:auto}</style>
<div id=c><div id=viewer class=pdfViewer></div></div>
<script type=module>
const D = "/node_modules/pdfjs-dist/";
const lib = await import(D + "legacy/build/pdf.mjs");
globalThis.pdfjsLib = lib;
lib.GlobalWorkerOptions.workerSrc = D + "legacy/build/pdf.worker.mjs";
const V = await import(D + "legacy/web/pdf_viewer.mjs");
const eventBus = new V.EventBus();
const linkService = new V.PDFLinkService({ eventBus });
const scripting = new V.PDFScriptingManager({ eventBus, sandboxBundleSrc: D + "legacy/build/pdf.sandbox.mjs", wasmUrl: D + "wasm/" });
const viewer = new V.PDFViewer({ container: document.getElementById("c"), eventBus, linkService, scriptingManager: scripting });
linkService.setViewer(viewer); scripting.setViewer(viewer);
eventBus.on("sandboxcreated", () => { window.sandboxReady = true; });
eventBus.on("pagesinit", () => { viewer.currentScaleValue = "1"; window.pagesReady = true; });
window.openPdf = async (b64) => {
  const data = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const doc = await lib.getDocument({ data, enableScripting: true, wasmUrl: D + "wasm/" }).promise;
  viewer.setDocument(doc); linkService.setDocument(doc); await scripting.setDocument(doc);
  window.viewer = viewer;
};
window.loaded = true;
</script>`;

test("the flip book plays, pauses and steps in PDF.js with scripting on", async ({ page }) => {
  test.skip(!fs.existsSync("node_modules/pdfjs-dist/legacy/web/pdf_viewer.mjs"), "pdfjs-dist is not installed (npm ci)"); // prettier-ignore
  const frames = fs
    .readdirSync(FRAMES)
    .sort()
    .map((f) => new Uint8Array(fs.readFileSync(FRAMES + f)));
  const entry = await toyEntry("grapes", { still: { bytes: frames[10], type: "jpeg" } });
  const bytes = await buildToyPDF(entry, { recording: { frames, fps: 8, seconds: 5, size: 420 } });
  await page.route("**/__pdf-viewer.html", (r) => r.fulfill({ contentType: "text/html", body: VIEWER })); // prettier-ignore
  await page.setViewportSize({ width: 900, height: 1100 });
  await page.goto("/__pdf-viewer.html");
  await page.waitForFunction(() => window.loaded);
  await page.evaluate((b64) => window.openPdf(b64), Buffer.from(bytes).toString("base64"));
  await page.waitForFunction(() => window.pagesReady && window.sandboxReady);
  await page.evaluate(() => (window.viewer.currentPageNumber = 2));
  // The fields on page 2, by name.
  const ids = await page.evaluate(async () => {
    const a = await (await window.viewer.pdfDocument.getPage(2)).getAnnotations();
    return Object.fromEntries(a.filter((x) => x.fieldName).map((x) => [x.fieldName, x.id]));
  });
  const shown = () =>
    page.evaluate((ids) => {
      const vis = (id) => {
        const el = document.querySelector(`[data-annotation-id="${id}"]`);
        return el && !el.hidden && getComputedStyle(el).visibility !== "hidden";
      };
      return Object.keys(ids).filter((n) => /^spf\d+$/.test(n) && vis(ids[n]));
    }, ids);
  const count = () => page.evaluate((id) => document.querySelector(`[data-annotation-id="${id}"] input, [data-annotation-id="${id}"] textarea`)?.value ?? "", ids.spcount); // prettier-ignore
  const press = async (name) => {
    const box = await page.locator(`[data-annotation-id="${ids[name]}"]`).boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.up();
  };
  await expect.poll(shown, { timeout: 30_000 }).toEqual(["spf0"]);
  // Page 2's open action has run once the sandbox is up and the page is shown.
  await page.waitForTimeout(1000);
  // The sandbox sets the page up on opening it (the counter).
  await expect.poll(count, { timeout: 30_000 }).toBe("Picture 1 of 40");
  await press("spfwd");
  await expect.poll(shown).toEqual(["spf1"]);
  await expect.poll(count).toBe("Picture 2 of 40");
  await press("spback");
  await expect.poll(shown).toEqual(["spf0"]);
  await press("splast");
  await expect.poll(shown).toEqual(["spf39"]);
  await press("spfirst");
  await expect.poll(shown).toEqual(["spf0"]);
  // Play: the frames move on by themselves, one at a time.
  await press("spplay");
  await expect.poll(async () => Number((await shown())[0]?.slice(3) ?? 0)).toBeGreaterThan(4);
  expect((await shown()).length).toBe(1);
  await press("sppause");
  const held = await shown();
  await page.waitForTimeout(700);
  expect(await shown()).toEqual(held);
  // Tapping the picture plays it too.
  await press("sptap");
  await expect.poll(async () => (await shown())[0]).not.toBe(held[0]);
});

// ---- The dialog -------------------------------------------------------------------------

test("the dialog: still by default, an estimate for the recording, then a PDF saved", async ({
  page,
}) => {
  // prettier-ignore
  const errors = await openApp(page);
  await page.evaluate(() => window.__splashery.app.chooseToy("grapes"));
  await page.waitForTimeout(1000);
  await page.evaluate(() => delete window.showSaveFilePicker); // the download path
  await page.click("#tab-share");
  await page.click("#export-pdf");
  const dlg = page.locator("#pdfx");
  await expect(dlg).toBeVisible();
  await expect(dlg.locator("input[value=still]")).toBeChecked();
  await expect(dlg.locator("#pdfx-estimate")).toBeHidden();
  await dlg.locator("input[value=moving]").check();
  await expect(dlg.locator("#pdfx-estimate")).toContainText("at most");
  await dlg.locator("input[value=still]").check();
  const [download] = await Promise.all([page.waitForEvent("download"), dlg.locator("#pdfx-save").click()]); // prettier-ignore
  expect(download.suggestedFilename()).toBe("splashery-grapes.pdf");
  const bytes = fs.readFileSync(await download.path());
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  await expect(page.locator(".toast, #toast").first()).toContainText("PDF saved");
  expect(errors).toEqual([]);
});

// ---- Old links ----------------------------------------------------------------------------

test("old links still load: a version 2 scene link opens its toy", async ({ page }) => {
  const v2 = { app: "splashery", version: 2, seed: 5, toy: { kind: "builtin", id: "grapes" }, camera: { yaw: 1, pitch: 0.2, distance: 4 } }; // prettier-ignore
  const hash = await encodeSceneHash(v2);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${APP}#s=${hash}`);
  await page.waitForSelector("body[data-ready='true']", { timeout: 180_000 });
  await expect.poll(() => page.evaluate(() => window.__splashery.player.toyInfo?.id)).toBe("grapes"); // prettier-ignore
  expect(errors).toEqual([]);
});

// ---- Polish (October 5, 2026) ----------------------------------------------------------

test("polish: the still is 1440 px, rendered larger and brought down, and the frames too", async ({
  page,
}) => {
  // prettier-ignore
  const errors = await openApp(page);
  await page.evaluate(() => window.__splashery.app.chooseToy("grapes"));
  await page.waitForTimeout(1500);
  const res = await page.evaluate(async () => {
    const c = await import("/src/pdf-export/capture.js");
    const { app, player } = window.__splashery;
    const still = await c.captureStill(app);
    const cap = c.renderCap(player);
    const big = document.createElement("canvas");
    big.width = big.height = 840;
    const small = c.downscale(big, 420);
    return { w: still.width, ss: still.ss, cap, small: [small.width, small.height] };
  });
  expect(errors).toEqual([]);
  expect(res.w).toBe(1440);
  expect(res.ss).toBeCloseTo(Math.min(2, res.cap / 1440), 5);
  expect(res.ss).toBeGreaterThan(1);
  expect(res.small).toEqual([420, 420]);
});
