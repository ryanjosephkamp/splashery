#!/usr/bin/env node
// Task 84: paired real Share-dialog exports; run before and after an export change.
// Keep the static server on the build being measured. See the audit for commands.
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { PNG } from "pngjs";
import { openRoute, decodePNG, phonePNG, PAYLOAD, drawn } from "./adv-route.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = path.resolve(root, process.env.ADV_SHARE_OUT || ".cache/advisor-share-masks");
const phase = process.env.ADV_SHARE_PHASE || "after";
if (!["before", "after"].includes(phase))
  throw new Error("ADV_SHARE_PHASE must be before or after.");
const count = Number(process.env.ADV_SHARE_COUNT || 50);
if (!Number.isInteger(count) || count < 50) throw new Error("Measure at least 50 exports.");
const base = process.env.SPLASHERY_URL || "http://127.0.0.1:4173/";
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const writeJSON = (name, value) =>
  fs.writeFile(path.join(out, name), JSON.stringify(value, null, 2) + "\n");
await fs.mkdir(out, { recursive: true });
let inputs = phase === "after" ? JSON.parse(await fs.readFile(path.join(out, "inputs.json"))) : [];
if (phase === "after" && inputs.length !== count)
  throw new Error("Baseline inputs must match the export count.");
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  headless: true,
  args: [
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
  ],
});
const records = [];
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await openRoute(page, "qr-code", base);
  await page.evaluate((text) => window.__splashery.qr.set({ text }), PAYLOAD);
  await drawn(page);
  const environment = {
    buildCommit: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    dirty: !!execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim(),
    browser: browser.version(),
    phase,
    count,
    base,
    startedAt: new Date().toISOString(),
  };
  for (let i = 0; i < count; i++) {
    // Freeze only the exported scene input, so both builds encode identical real
    // app exports. Each before scene retains its actual app.exportScene timestamp.
    if (phase === "before") {
      inputs.push(await page.evaluate(() => window.__splashery.app.exportScene()));
      await writeJSON("inputs.json", inputs);
    }
    const scene = inputs[i];
    const shared = await page.evaluate(async (scene) => {
      const { openShareQR } = await import("/src/qr/share.js");
      const app = Object.create(window.__splashery.app);
      app.exportScene = () => scene;
      return openShareQR(app);
    }, scene);
    if (!shared.ok) throw new Error(`Export ${i} cannot encode its scene.`);
    const start = Date.now();
    const download = page.waitForEvent("download");
    await page.locator("#sqr-save").click();
    const file = await download;
    const native = await fs.readFile(await file.path());
    const exportMs = Date.now() - start;
    const phone = await phonePNG(page, native);
    const actualExport = await page.evaluate(
      async () => (await import("/src/qr/share.js")).SHARE.last,
    );
    const code = await page.evaluate(async (url) => {
      const made = (await import("/src/qr/share-code.js")).shareCode(url);
      return { version: made.code.version, defaultMask: made.code.mask, level: made.level };
    }, shared.url);
    const images = {};
    for (const [size, bytes] of [
      ["native", native],
      ["phone", phone],
    ]) {
      const decoded = await decodePNG(page, bytes); // No geometry hints, for either reader.
      const image = PNG.sync.read(bytes);
      if (image.width !== (size === "native" ? 1130 : 390) || image.width !== image.height)
        throw new Error(`Export ${i} did not have the required ${size} dimensions.`);
      const filename = `${phase}-${String(i).padStart(2, "0")}-${size}.png`;
      await fs.writeFile(path.join(out, filename), bytes);
      images[size] = {
        file: filename,
        width: image.width,
        height: image.height,
        bytes: bytes.length,
        sha256: sha(bytes),
        decoded,
        exact: { jsqr: decoded.jsqr === shared.url, zxing: decoded.zxing === shared.url },
      };
    }
    const record = {
      i,
      createdAt: scene.createdAt,
      sceneSha256: sha(JSON.stringify(scene)),
      payload: shared.url,
      characters: shared.url.length,
      ...code,
      export: actualExport.export || null,
      exportMs,
      images,
    };
    records.push(record);
    await writeJSON(`${phase}-records.json`, records);
    console.log(
      JSON.stringify({
        i,
        createdAt: record.createdAt,
        mask: record.export?.mask ?? code.defaultMask,
        native: images.native.exact,
        phone: images.phone.exact,
        exportMs,
      }),
    );
    await page.locator("#sqr-close").click();
  }
  if (new Set(inputs.map((s) => s.createdAt)).size !== count)
    throw new Error("Timestamps are not unique.");
  const normalized = inputs.map(({ createdAt, ...s }) => JSON.stringify(s));
  if (new Set(normalized).size !== 1) throw new Error("Scenes differ beyond createdAt.");
  const totals = Object.fromEntries(
    ["native", "phone"].map((size) => [
      size,
      Object.fromEntries(
        ["jsqr", "zxing"].map((reader) => [
          reader,
          records.filter((r) => r.images[size].exact[reader]).length,
        ]),
      ),
    ]),
  );
  await writeJSON(`${phase}-summary.json`, {
    environment,
    totals,
    errors,
    records: `${phase}-records.json`,
  });
  if (errors.length) throw new Error("Browser errors were recorded.");
  console.log(JSON.stringify({ phase, totals, errors }));
} finally {
  await browser.close();
}
