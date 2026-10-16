import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chromium } from "@playwright/test";
import { GRAPHICS_LAUNCH, openRender, renderFrame } from "../tools/cdx-mp2-render.mjs";
import { routeCode } from "../tools/cdx-mp2-r4-harness.mjs";
import { stabilityMetrics } from "../tools/cdx-stability-measure.mjs";
import { surfaceMetrics } from "../tools/cdx-mp2-measure.mjs";
import { SAMPLES } from "../src/packs/moving-photo.js";

const out = "work/r4-calibration-review";
await fs.mkdir(out, { recursive: true });
const expected = JSON.parse(await fs.readFile("work/r4-operator-score-source.json", "utf8"));
const before = JSON.parse(await fs.readFile("work/r4-operator-source.json", "utf8"));
const currentRevision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
execFileSync("git", ["diff", "--quiet", "--", "src/packs/moving-photo.js"]);
const sha = (b) => createHash("sha256").update(b).digest("hex");
const snapshots = {};
for (const version of ["before", "after"]) {
  const code = new Map(),
    hash = createHash("sha256");
  for (const { file } of before.files) {
    const bytes =
      version === "before"
        ? execFileSync("git", ["show", `1299a32b:${file}`], { maxBuffer: 128 << 20 })
        : await fs.readFile(file);
    code.set(file, bytes);
    hash.update(file + "\0").update(bytes);
  }
  const sourceHash = hash.digest("hex");
  if (sourceHash !== (version === "before" ? before.sourceHash : expected.sourceHash))
    throw new Error("Source changed");
  snapshots[version] = {
    code,
    sourceHash,
    revision: version === "before" ? "1299a32bf8c7937586593d8b2dea0530f9306cdb" : currentRevision,
  };
}
const manifest = {
  integrationMain: "0b6f4bf26c6ca0d523dd8839ff1b1e1c33fb0bd1",
  note: "Phone low and desktop mid profiles at fixed original source clocks, not a live frame-rate measurement. Both versions use the identical corrected reconstruction and current UI. Six-second videos show all 96 source pictures. The pixel oracle samples eight poses per version. Raw source snapshots and all-depth metrics remain separate.",
  cases: [],
};
for (const tier of ["low", "mid"])
  for (const id of ["bridge", "dragon"]) {
    const item = SAMPLES.find((s) => s.id === id),
      input = `.cache/cdx-mp2/sources/${id}.webm`,
      inputHash = sha(await fs.readFile(input));
    const key = id + "-" + tier;
    const record = {
      id,
      key,
      tier,
      title: item.title,
      author: item.author,
      source: item.source,
      license: item.license,
      licenseUrl: item.licenseUrl,
      licenseSource: `https://${id === "bridge" ? "mango" : "durian"}.blender.org/sharing/`,
      licenseChecked: "October 16, 2026",
      changes:
        "The same corrected six-second reconstruction is shown as a 3D relief before and after calibration selection, at fixed source clocks.",
      input,
      inputSha256: inputHash,
      versions: [],
    };
    for (const version of ["before", "after"]) {
      const folder = path.join(out, key, version);
      await fs.mkdir(folder, { recursive: true });
      const browser = await chromium.launch(GRAPHICS_LAUNCH),
        errors = [];
      try {
        const context = await browser.newContext({
          viewport: tier === "low" ? { width: 390, height: 844 } : { width: 1440, height: 900 },
          deviceScaleFactor: 1,
        });
        await routeCode(context, snapshots[version].code);
        const page = await context.newPage();
        page.on("pageerror", (e) => errors.push(e.message));
        await openRender(page, {
          id,
          source: input,
          upload: true,
          tier,
          renderer: "webgl2",
          stepped: true,
        });
        const metrics = await page.evaluate(
          ({ jitter, surface }) => {
            const c = window.__mp3.MOVING.clip;
            return {
              ...(0, eval)(`(${jitter})`)(c.near, c.colors),
              ...(0, eval)(`(${surface})`)(c.near, c.w, c.h),
              frames: c.n,
              normalization: c.refinement?.normalization,
              scores: c.refinement?.scores,
            };
          },
          { jitter: stabilityMetrics.toString(), surface: surfaceMetrics.toString() },
        );
        const rows = [];
        for (let f = 0; f < 96; f++) {
          const time = (f + 0.25) / 16,
            oracle = f % 12 === 0;
          const row = await renderFrame(page, time, {
            yaw: 0.18 + 0.1 * Math.sin((2 * Math.PI * f) / 96),
            measure: oracle,
            pictureOnly: true,
            frame: false,
            sourceWitness: true,
            verifyDepth: oracle,
            displayedDepth: true,
          });
          const bytes = Buffer.from(row.picture.split(",")[1], "base64");
          delete row.picture;
          await fs.writeFile(path.join(folder, String(f).padStart(5, "0") + ".png"), bytes);
          rows.push({ frame: f, ...row, pngSha256: sha(bytes), pixelOracle: oracle });
        }
        const result = {
          version,
          browser: browser.version(),
          sourceHash: snapshots[version].sourceHash,
          revision: snapshots[version].revision,
          metrics,
          rows,
          errors,
        };
        await fs.writeFile(
          path.join(folder, "report.json"),
          JSON.stringify(result, null, 2) + "\n",
        );
        record.versions.push(result);
        console.log(
          JSON.stringify({
            id,
            tier,
            version,
            metrics,
            frames: rows.length,
            oracle: rows
              .filter((r) => r.pixelOracle)
              .map((r) => ({ time: r.time, holes: r.holes, specks: r.edgeSpecks })),
            errors,
          }),
        );
        if (errors.length) throw new Error("Browser errors");
        if (version === "after" && rows.some((r) => r.pixelOracle && (r.holes || r.edgeSpecks)))
          throw new Error("New picture defect");
      } finally {
        await browser.close();
      }
    }
    if (sha(await fs.readFile(input)) !== inputHash) throw new Error("Input changed");
    manifest.cases.push(record);
    await fs.writeFile(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  }
console.log("All browser captures complete; encoding can now run separately.");
