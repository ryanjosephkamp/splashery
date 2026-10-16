#!/usr/bin/env node
// MIT. Made by Ryan with Codex (GPT-6). Diagnose setup allocations, without scoring or training.
// node tools/v3d-memory.mjs <local-video> <new-output.json> [--url=http://127.0.0.1:4179/]
// Each fresh browser runs real Phone-safe extraction, solving, and seeding. One setting changes
// per probe. These stopped setup probes cannot replace native full-bake benchmark outcomes.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { benchmarkLaunchArgs, servedSourceFingerprint } from "./v3d-bench.mjs";

const args = process.argv.slice(2);
const [input, output] = args.filter((arg) => !arg.startsWith("--"));
if (!input || !output || fs.existsSync(output))
  throw new Error("Supply a local video and an output JSON path that does not exist.");
const url = args.find((arg) => arg.startsWith("--url="))?.slice(6) || "http://127.0.0.1:4179/";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const bytes = fs.readFileSync(input);
const receipt = {
  started: new Date().toISOString(),
  notice:
    "Setup allocation probes, stopped before training; no quality or complete-bake claims. RSS sums browser descendants and can count shared pages more than once. Software emulation, not physical-phone RAM.",
  input: { name: path.basename(input), bytes: bytes.length, sha256: hash(bytes) },
  toolSha256: hash(fs.readFileSync(import.meta.filename)),
  source: await servedSourceFingerprint(url),
  probes: [],
};
fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true });
const save = () => fs.writeFileSync(output, JSON.stringify(receipt, null, 2) + "\n");
save();

function rssTree(root) {
  const rows = [];
  for (const pid of fs.readdirSync("/proc").filter((id) => /^\d+$/.test(id))) {
    try {
      const status = fs.readFileSync(`/proc/${pid}/status`, "utf8");
      rows.push({
        pid: Number(pid),
        parent: Number(status.match(/^PPid:\s+(\d+)/m)?.[1]),
        bytes: Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] || 0) * 1024,
      });
    } catch {
      /* A process can exit during the sample. */
    }
  }
  const owned = new Set([root]);
  for (let changed = true; changed; ) {
    changed = false;
    for (const row of rows)
      if (owned.has(row.parent) && !owned.has(row.pid)) {
        owned.add(row.pid);
        changed = true;
      }
  }
  return rows.filter((row) => owned.has(row.pid)).reduce((sum, row) => sum + row.bytes, 0);
}

for (let repeat = 1; repeat <= 2; repeat++) {
  for (const variant of ["unchanged", "tile16", "no-background", "no-surface"]) {
    const server = await chromium.launchServer({
      executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
      args: benchmarkLaunchArgs("swiftshader"),
    });
    const browser = await chromium.connect(server.wsEndpoint());
    const probe = {
      repeat,
      variant,
      started: new Date().toISOString(),
      peakRssBytes: 0,
      consoleErrors: [],
    };
    let timer;
    try {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        isMobile: true,
      });
      const page = await context.newPage();
      page.on("pageerror", (error) => probe.consoleErrors.push(error.message));
      await page.exposeFunction("memoryCheckpoint", (data) => {
        probe.seed = { ...data, rssBytes: rssTree(server.process().pid) };
      });
      await page.route("**/vendor/splatjs/src/session.js", async (route) => {
        const response = await route.fetch();
        const source = await response.text();
        const needle = "return new Session(opts);";
        if (source.split(needle).length !== 2)
          throw new Error("Session observer boundary changed.");
        await route.fulfill({
          response,
          body: source.replace(
            needle,
            "const s = new Session(opts); globalThis.observeMemory(s); return s;",
          ),
        });
      });
      if (variant === "no-surface")
        await page.route("**/src/video3d/surface-seed.js", (route) =>
          route.fulfill({
            contentType: "text/javascript",
            body: "export const surfaceSeed=()=>({n:0,data:new Float32Array(0)});",
          }),
        );
      await page.goto(new URL("tests/fixtures/v3d/", url).href);
      timer = setInterval(() => {
        probe.peakRssBytes = Math.max(probe.peakRssBytes, rssTree(server.process().pid));
      }, 100);
      probe.result = await page.evaluate(
        async ({ base64, variant }) => {
          const allocations = [];
          const create = GPUDevice.prototype.createBuffer;
          GPUDevice.prototype.createBuffer = function (descriptor) {
            const buffer = create.call(this, descriptor);
            allocations.push({
              label: descriptor.label || "",
              bytes: descriptor.size,
              usage: descriptor.usage,
            });
            return buffer;
          };
          globalThis.observeMemory = (session) => {
            if (variant === "tile16") session.opts.trainer.tileSize = 16;
            if (variant === "no-background") session.opts.trainer.fitBackground = false;
            const seed = session.seed.bind(session);
            session.seed = async (...args) => {
              const model = await seed(...args);
              const trainer = session.trainer;
              await trainer.device.queue.onSubmittedWorkDone();
              await globalThis.memoryCheckpoint({
                allocations,
                tileSize: trainer.tileSize,
                entriesCap: trainer.entriesCap,
                maxPixels: trainer.maxPixels,
                maxTiles: trainer.maxTiles,
                cap: trainer.cap,
                splats: trainer.n,
                surfacePoints: model.appendedSeedCount || 0,
                cameras: trainer.camMeta.map(({ w, h }) => ({ w, h })),
                adapter: session.gpu.info,
                limits: {
                  maxStorageBufferBindingSize: trainer.device.limits.maxStorageBufferBindingSize,
                  maxBufferSize: trainer.device.limits.maxBufferSize,
                },
              });
              return model;
            };
          };
          const file = new File(
            [Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))],
            "probe.mp4",
            { type: "video/mp4" },
          );
          const { videoTo3D } = await import("/src/video3d/run.js");
          try {
            await videoTo3D(file, {
              tier: "phone",
              length: 10,
              rate: 3,
              onProgress(event) {
                if (event.stage === "train") throw new Error("MEMORY_SETUP_COMPLETE");
              },
            });
            throw new Error("Probe unexpectedly trained a model.");
          } catch (error) {
            if (error.message !== "MEMORY_SETUP_COMPLETE") throw error;
            return { stoppedBeforeTraining: true };
          }
        },
        { base64: bytes.toString("base64"), variant },
      );
      if (!probe.seed || probe.consoleErrors.length)
        throw new Error("Probe did not reach a clean seed checkpoint.");
      probe.seed.totalAllocatedBytes = probe.seed.allocations.reduce(
        (sum, allocation) => sum + allocation.bytes,
        0,
      );
      console.log(
        JSON.stringify({
          repeat,
          variant,
          rssMiB: probe.seed.rssBytes / 1048576,
          allocatedMiB: probe.seed.totalAllocatedBytes / 1048576,
        }),
      );
    } catch (error) {
      probe.error = error.message;
      throw error;
    } finally {
      clearInterval(timer);
      probe.finished = new Date().toISOString();
      receipt.probes.push(probe);
      save();
      await browser.close();
      await server.close();
    }
  }
}
receipt.finished = new Date().toISOString();
save();
