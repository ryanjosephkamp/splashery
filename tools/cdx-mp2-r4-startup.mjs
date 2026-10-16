// Selection to the first actual postrender of the requested Sharp picture.
// Fresh page and worker per case; phone emulation is CDP, not physical hardware.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import { GRAPHICS_LAUNCH } from "./cdx-mp2-render.mjs";
import { R4_CASES } from "./cdx-mp2-r4-cases.mjs";
import { PHONE, option, snapshot, routeCode, caseInputHashes } from "./cdx-mp2-r4-harness.mjs";

const baseline = option("baseline"),
  out = option("out", "work/r4-startup.json");
const { code, sourceHash } = await snapshot(baseline);
const file = "src/packs/photo-sharp.js";
let body = code
  .get(file)
  .toString()
  .replace(
    "function fillClip(m, src) {",
    "function fillClip(m, src) { window.__r4Owners?.set(m,src.clip || src.moving.clip);",
  );
if (baseline)
  body = body.replace(
    "else if (clip.audio?.url && typeof document",
    "else if (clip.audio?.url && !/\\.mp3(?:$|[?#])/i.test(clip.audio.url) && typeof document",
  );
code.set(file, Buffer.from(body));
const report = {
  sourceHash,
  baseline: baseline || null,
  baselineSourceCorrection: baseline ? "MP3 guard only; long samples use main's upload path" : null,
  measuredAt: new Date().toISOString(),
  cpuRate: 4,
  phone: PHONE,
  workerThrottled: false,
  protocol:
    "Selection to first actual submitted 3D front surface. Opening the toy starts before observer module imports, including their preparation overhead in both versions; other clips start from the already open default toy. Fresh browser context per repeat",
  results: [],
};
await fs.mkdir(path.dirname(out), { recursive: true });
const save = () => fs.writeFile(out, JSON.stringify(report, null, 2) + "\n");
const browser = await chromium.launch(GRAPHICS_LAUNCH);
try {
  report.browser = browser.version();
  for (const item of R4_CASES) {
    if (option("ids") && !option("ids").split(",").includes(item.id)) continue;
    for (let repeat = 0; repeat < Number(option("repeats", "3")); repeat++) {
      const context = await browser.newContext(PHONE),
        page = await context.newPage(),
        errors = [];
      page.setDefaultTimeout(600000);
      page.on("pageerror", (e) => errors.push(e.message));
      await routeCode(context, code);
      try {
        await (
          await context.newCDPSession(page)
        ).send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await page.goto(
          `${process.env.SPLASHERY_URL || "http://127.0.0.1:4173/"}?renderer=webgl2&adapt=off&profile=low&labs=1`,
        );
        await page.waitForSelector("body[data-ready='true']");
        await page.evaluate(async () => {
          window.__r4ColdSelectionStart = performance.now();
          window.__r4Moving = await import("/src/packs/moving-photo.js");
          window.__r4Owners = new WeakMap();
          const { ReliefMesh } = await import("/src/live/relief-mesh.js"),
            original = ReliefMesh.prototype.setColor;
          ReliefMesh.prototype.setColor = function (...args) {
            window.__r4Mesh = this;
            return original.apply(this, args);
          };
          const device = window.__splashery.player.stage.device,
            draw = device.draw;
          device.draw = function (primitive, indexBuffer, ...rest) {
            const result = draw.call(this, primitive, indexBuffer, ...rest),
              mesh = window.__r4Mesh;
            if (
              this.shaderValid &&
              primitive.count > 0 &&
              indexBuffer === mesh?.surface.mesh.indexBuffer[0]
            )
              window.__r4Submitted = {
                mesh,
                clip: window.__r4Owners.get(mesh),
                at: performance.now(),
                indices: primitive.count,
              };
            return result;
          };
        });
        const upload = !!item.upload || !!(baseline && item.long);
        if (item.id !== "sample") {
          await page.evaluate(() => window.__splashery.app.chooseToy("moving-photo-3d"));
          await page.waitForFunction(
            () => window.__psv?.state().on && !window.__splashery.player.loading,
          );
        }
        await page.evaluate(
          ({ item, upload }) => {
            const { player } = window.__splashery;
            window.__r4Start =
              item.id === "sample" ? window.__r4ColdSelectionStart : performance.now();
            window.__r4First = null;
            window.__r4Submitted = null;
            const draw = () => {
              const mesh = window.__r4Mesh,
                c = mesh && window.__r4Owners.get(mesh);
              const right =
                c &&
                (upload
                  ? c.name ===
                    item.source
                      .split("/")
                      .at(-1)
                      .replace(/\.[^.]+$/, "")
                  : c.sample === item.id);
              const color = mesh?.color?.getSource(),
                nativeReady =
                  ArrayBuffer.isView(color) || !!color?.getContext || color?.videoWidth > 0;
              const submitted = window.__r4Submitted;
              const estimatedDepth = c?.long ? c.depth?.ready > 0 : !!c?.near?.[0];
              if (
                right &&
                estimatedDepth &&
                mesh.visible &&
                nativeReady &&
                window.__psv.state().on &&
                submitted?.mesh === mesh &&
                submitted.clip === c
              ) {
                window.__r4First = {
                  ms: performance.now() - window.__r4Start,
                  clip: c.name,
                  sample: c.sample,
                  picture: [mesh.color.width, mesh.color.height],
                  depth: [mesh.depth.width, mesh.depth.height],
                  submittedMs: submitted.at - window.__r4Start,
                  submittedIndices: submitted.indices,
                };
                player.stage.app.off("postrender", draw);
              }
            };
            player.stage.app.on("postrender", draw);
          },
          { item, upload },
        );
        // Do not await the complete build: the preview is the first result.
        if (upload) await page.setInputFiles("#toy-input-file", item.source);
        else if (item.id === "sample")
          await page.evaluate(() => {
            void window.__splashery.app.chooseToy("moving-photo-3d");
          });
        else
          await page.evaluate((id) => {
            void window.__splashery.app.setToyOptions({ clip: id });
          }, item.id);
        await page.waitForFunction(() => !!window.__r4First, null, { timeout: 600000 });
        const result = {
          id: item.id,
          repeat,
          path: upload ? "upload" : "sample",
          inputHashes: await caseInputHashes(item, upload ? "upload" : "sample", code),
          ...(await page.evaluate(() => window.__r4First)),
          errors,
        };
        report.results.push(result);
        console.log(JSON.stringify(result));
      } catch (error) {
        report.results.push({ id: item.id, repeat, error: error.message, errors });
        console.log(JSON.stringify(report.results.at(-1)));
      } finally {
        await context.close();
        await save();
      }
    }
  }
} finally {
  await browser.close();
  await save();
}
if (report.results.some((r) => r.error || r.errors.length)) process.exitCode = 1;
