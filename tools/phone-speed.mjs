#!/usr/bin/env node
// Serve first: node tools/cdx-mp2-server.mjs 4173
// SPLASHERY_CHROMIUM=/usr/bin/chromium node tools/phone-speed.mjs --out=.cache/phone-speed/before
// --ids=a,b --runs=3 --duration=2500 --url=http://127.0.0.1:4173/ --resume
// --source=<served commit> for a separate frozen server; --retry-errors archives failed attempts.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import os from "node:os";
import { createHash } from "node:crypto";
import { TOYS } from "../src/toys.js";
import { installFirstFrameProbe, rankSlowest } from "./pages/phone-speed-metrics.js";
import { installHybridFirstFrameProbe } from "./pages/phone-speed-hybrid.js";

const args = process.argv.slice(2);
const opt = (key, fallback) =>
  args.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3) ?? fallback;
const base = opt("url", "http://127.0.0.1:4173/");
const out = path.resolve(opt("out", ".cache/phone-speed/before"));
const durationMs = Number(opt("duration", 2500));
const runs = Number(opt("runs", 1));
const ids = opt("ids", "").split(",").filter(Boolean);
const toys = ids.length
  ? ids.map(
      (id) =>
        TOYS.find((t) => t.id === id) ||
        (() => {
          throw new Error(`Unknown toy ${id}`);
        })(),
    )
  : TOYS;
if (!(Number.isFinite(durationMs) && durationMs >= 250 && Number.isInteger(runs) && runs >= 1))
  throw new Error("Invalid duration or run count.");
let stopping = false;
process.on("SIGTERM", () => {
  stopping = true;
});
process.on("SIGINT", () => {
  stopping = true;
});
await fs.mkdir(out, { recursive: true });
await fs.rm(path.join(out, "paused.json"), { force: true });
await fs.rm(path.join(out, "active.json"), { force: true });
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const measurementSHA256 = sha256(
  await fs.readFile(new URL("./pages/phone-speed-metrics.js", import.meta.url)),
);
const hybridSHA256 = sha256(
  await fs.readFile(new URL("./pages/phone-speed-hybrid.js", import.meta.url)),
);
const measurementResponse = await fetch(new URL("tools/pages/phone-speed-metrics.js", base));
if (
  !measurementResponse.ok ||
  sha256(Buffer.from(await measurementResponse.arrayBuffer())) !== measurementSHA256
)
  throw new Error("The served measurement module does not match this tool's protocol.");
const hybridResponse = await fetch(new URL("tools/pages/phone-speed-hybrid.js", base));
if (!hybridResponse.ok || sha256(Buffer.from(await hybridResponse.arrayBuffer())) !== hybridSHA256)
  throw new Error("The served hybrid module does not match this tool's protocol.");
const launchArgs = [
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
  "--enable-webgl",
  "--enable-precise-memory-info",
];
const browser = await chromium.launch({
  handleSIGINT: false,
  handleSIGTERM: false,
  executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
  args: launchArgs,
});
try {
  const metadata = {
    url: base,
    toolSource: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
    source: opt("source", execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim()),
    dirty: execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" }).trim(),
    started: new Date().toISOString(),
    browser: browser.version(),
    launchArgs,
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    durationMs,
    runs,
    measurementSHA256,
    hybridSHA256,
    runnerSHA256: sha256(await fs.readFile(new URL(import.meta.url))),
    host: {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      cpu: os.cpus()[0]?.model,
    },
    method:
      "Fresh context, normal app, cold cache, no network/CPU throttle, weak tier, adaptation off. First view includes synchronous default-framebuffer pixel readback after the first-toy-frame signal; frame intervals are actual postrender draws completed by readPixels, with forced rendering. Audio off; one real action after the idle window. Heap is a live JS heap snapshot, not total process/GPU memory. Local HTTP transfer is not public-site compressed transfer.",
  };
  const methodFile = path.join(out, "method.json");
  if (args.includes("--resume")) {
    const previous = JSON.parse(await fs.readFile(methodFile, "utf8"));
    const previousProtocol =
      previous.measurementSHA256 ??
      sha256(
        execFileSync("git", ["show", `${previous.source}:tools/pages/phone-speed-metrics.js`]),
      );
    if (
      previous.source !== metadata.source ||
      previous.durationMs !== durationMs ||
      previous.browser !== metadata.browser ||
      previousProtocol !== measurementSHA256 ||
      (previous.hybridSHA256 && previous.hybridSHA256 !== hybridSHA256) ||
      (previous.url && previous.url !== base)
    ) {
      throw new Error(
        "Resume requires the same source, URL, browser, duration, and measurement protocol.",
      );
    }
    await fs.writeFile(
      path.join(out, `resume-${Date.now()}.json`),
      JSON.stringify(metadata, null, 2),
    );
  } else await fs.writeFile(methodFile, JSON.stringify(metadata, null, 2));
  const rows = [];
  screening: for (let run = 0; run < runs; run++)
    for (const toy of toys) {
      if (stopping) break screening;
      const file = path.join(out, `${toy.id}-${run}.json`);
      if (args.includes("--resume")) {
        try {
          const previous = JSON.parse(await fs.readFile(file, "utf8"));
          if (!(previous.error || previous.errors?.length) || !args.includes("--retry-errors")) {
            rows.push(previous);
            continue;
          }
          await fs.mkdir(path.join(out, "history"), { recursive: true });
          await fs.copyFile(file, path.join(out, "history", `${toy.id}-${run}-${Date.now()}.json`));
        } catch {}
      }
      // Touch <out>/pause to pause between toys; remove it to continue. No
      // measured browser context exists while paused. SIGTERM finishes this toy.
      let paused = false;
      while (
        await fs.access(path.join(out, "pause")).then(
          () => true,
          () => false,
        )
      ) {
        if (!paused) {
          await fs.writeFile(
            path.join(out, "paused.json"),
            JSON.stringify(
              { next: toy.id, run, at: new Date().toISOString(), contextOpen: false },
              null,
              2,
            ),
          );
          paused = true;
        }
        if (stopping) break screening;
        await new Promise((r) => setTimeout(r, 1000));
      }
      await fs.rm(path.join(out, "paused.json"), { force: true });
      const context = await browser.newContext({
        viewport: metadata.viewport,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        colorScheme: "light",
        reducedMotion: "no-preference",
      });
      await context.addInitScript(installFirstFrameProbe);
      await context.addInitScript(installHybridFirstFrameProbe);
      const page = await context.newPage();
      await fs.writeFile(
        path.join(out, "active.json"),
        JSON.stringify(
          { id: toy.id, run, at: new Date().toISOString(), contextOpen: true },
          null,
          2,
        ),
      );
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      let row;
      const start = Date.now();
      try {
        const url = new URL(base);
        url.search = new URLSearchParams({
          renderer: "webgl2",
          profile: "weak",
          labs: "1",
          adapt: "off",
          "first-toy": toy.id,
        });
        await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 120000 });
        await page.waitForFunction(
          () => {
            if (window.__phoneSpeedFirstViewError)
              throw new Error(window.__phoneSpeedFirstViewError);
            return window.__splashery?.ready && window.__phoneSpeedFirstView;
          },
          null,
          { timeout: 120000 },
        );
        row = await page.evaluate(
          async ({ base, durationMs }) => {
            const { measurePhoneToy } = await import(
              new URL("tools/pages/phone-speed-hybrid.js", base).href
            );
            return measurePhoneToy(window, { durationMs });
          },
          { base, durationMs },
        );
        if (row.id !== toy.id) throw new Error(`Opened ${row.id}, expected ${toy.id}`);
        row.firstViewProbe = await page.evaluate(
          () => window.__phoneSpeedFirstView.path || "loaded-splat-signal",
        );
        const cdp = await context.newCDPSession(page);
        row.heap = await cdp.send("Runtime.getHeapUsage");
      } catch (e) {
        row = { id: toy.id, error: e.message };
      }
      Object.assign(row, {
        run,
        label: toy.label,
        kind: toy.kind,
        pack: toy.pack || null,
        labs: !!toy.labs,
        errors,
        wallMs: Date.now() - start,
        measuredAt: new Date().toISOString(),
        source: metadata.source,
      });
      rows.push(row);
      await fs.writeFile(file, JSON.stringify(row, null, 2));
      await fs.writeFile(path.join(out, "summary.json"), JSON.stringify(rows, null, 2));
      console.log(
        `${rows.length}/${toys.length * runs} ${toy.id}: ${row.error || `${row.firstViewMs.toFixed(0)}ms open, ${row.idle.median.toFixed(1)}/${row.tap.median.toFixed(1)}ms idle/tap`}`,
      );
      await context.close();
      await fs.rm(path.join(out, "active.json"), { force: true });
    }
  await fs.writeFile(path.join(out, "summary.json"), JSON.stringify(rows, null, 2));
  await fs.writeFile(path.join(out, "slowest.json"), JSON.stringify(rankSlowest(rows), null, 2));
} finally {
  await browser.close();
  await fs.rm(path.join(out, "active.json"), { force: true });
}
