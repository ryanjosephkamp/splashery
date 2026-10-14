import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { gaussiansToPly } from "../vendor/splatjs/src/io/ply.js";
import { readBakedScene } from "../src/video3d/baked.js";
import { readSplatPly } from "../src/video3d/ply.js";
import { compactGaussianPly } from "../tools/cdx-v3d-clarity-ply.mjs";

test("the compact fallback preserves every Gaussian and stays within the Mac handoff buffer", () => {
  const original = fs.readFileSync("assets/toys/video-3d/poltsamaa.ply");
  const compact = compactGaussianPly(original);
  expect(compact.length).toBeLessThan(4_000_000);
  expect(readSplatPly(compact)).toEqual(readSplatPly(original));
  expect(compactGaussianPly(compact)).toEqual(compact);
});

test("registration requires measured compressed models and preserves independent phone and desktop tiers", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cdx-v3d-register-"));
  const scratch = path.join(root, "scratch"),
    folder = path.join(scratch, "adjara");
  const run = (tool, args) =>
    execFileSync(process.execPath, [path.resolve("tools", tool), ...args], {
      cwd: root,
      stdio: "pipe",
    });
  const hash = (b) => createHash("sha256").update(b).digest("hex");
  const write = (f, value) => fs.writeFileSync(f, JSON.stringify(value));
  try {
    fs.mkdirSync(folder, { recursive: true });
    for (const dir of ["tools", "src/video3d", "assets/toys/video-3d/adjara-baked/assets"])
      fs.mkdirSync(path.join(root, dir), { recursive: true });
    write(path.join(root, "tools/assets.json"), { videoSamples: [{ id: "adjara", files: {} }] });
    write(path.join(scratch, "main-scores.json"), {
      results: [{ id: "adjara", mean: { ssim: 0.4, laplacian: 0.001 } }],
    });
    const cams = [
      { time: 0, R: [1, 0, 0, 0, 1, 0, 0, 0, 1], t: [0, 0, 0], w: 960, h: 540, f: 800 },
    ];
    for (const [name, n, side] of [
      ["phone", 2000, 640],
      ["desktop", 80000, 960],
    ]) {
      const data = new Float32Array(n * 16);
      for (let i = 0; i < n; i++)
        data.set(
          [
            (i % 100) / 100,
            (i % 71) / 71,
            2 + (i % 31) / 31,
            -4,
            -4,
            -4,
            1,
            0,
            0,
            0,
            -0.5,
            0,
            0.5,
            1,
            0,
            0,
          ],
          i * 16,
        );
      const ply = new Uint8Array(await gaussiansToPly(data, n, null, 0, "sigmoid").arrayBuffer());
      fs.writeFileSync(path.join(folder, name + ".ply"), ply);
      write(path.join(folder, name + ".json"), {
        cams,
        stats: { exportedSplats: n },
        bake: { exportTrainSide: side },
        continuation: { sourceOrigin: { fullCaptureSha256: "fixture" } },
      });
      if (name === "phone") {
        const file = path.join(folder, name + ".json"),
          original = fs.readFileSync(file);
        const mismatch = JSON.parse(original);
        mismatch.stats.exportedSplats = 1000;
        write(file, mismatch);
        expect(() => run("cdx-v3d-clarity-pack.mjs", [scratch, "adjara", name])).toThrow(
          /Metadata count differs/,
        );
        fs.writeFileSync(file, original);
      }
      write(path.join(scratch, name + "-scores.json"), {
        results: [{ id: "adjara", plySha256: hash(ply), mean: { ssim: 0.5, laplacian: 0.002 } }],
      });
      run("cdx-v3d-clarity-pack.mjs", [scratch, "adjara", name]);
      write(path.join(scratch, name + "-packed-scores.json"), {
        results: [
          {
            id: "adjara",
            plySha256: hash(fs.readFileSync(path.join(folder, name + "-packed.ply"))),
            mean: { ssim: 0.49, laplacian: 0.0019 },
          },
        ],
      });
    }
    const measured = path.join(scratch, "phone-packed-scores.json");
    const original = fs.readFileSync(measured);
    const rejected = JSON.parse(original);
    rejected.results[0].mean.ssim = 0.44;
    write(measured, rejected);
    expect(() =>
      run("cdx-v3d-clarity-register.mjs", [scratch, "adjara", "phone", "desktop"]),
    ).toThrow(/Both actual raw and compressed tiers/);
    expect(fs.existsSync(path.join(root, "assets/toys/video-3d/adjara.ply"))).toBe(false);
    fs.writeFileSync(measured, original);
    run("cdx-v3d-clarity-register.mjs", [scratch, "adjara", "phone", "desktop"]);
    const base = path.join(root, "assets/toys/video-3d/adjara"),
      manifestFile = base + "-baked/manifest.json";
    const manifest = JSON.parse(fs.readFileSync(manifestFile));
    expect(manifest.tiers.map((t) => [t.role, t.splats, t.trainingSide])).toEqual([
      ["phone", 2000, 640],
      ["desktop", 80000, 960],
    ]);
    const phone = await readBakedScene(pathToFileURL(manifestFile), 60000),
      desktop = await readBakedScene(pathToFileURL(manifestFile), 224000);
    const declaredDefault = await readBakedScene(pathToFileURL(manifestFile));
    expect([declaredDefault.count, declaredDefault.tierRole]).toEqual([2000, "phone"]);
    expect([phone.count, phone.tierRole, desktop.count, desktop.tierRole]).toEqual([
      2000,
      "phone",
      80000,
      "desktop",
    ]);
    const meta = JSON.parse(fs.readFileSync(base + ".json"));
    expect(meta.bake.exportTrainSide).toBe(640);
    expect(meta.desktop.bake.exportTrainSide).toBe(960);
    expect(meta.cams).toEqual(meta.desktop.cams);
    const record = JSON.parse(fs.readFileSync(path.join(root, "tools/assets.json")))
      .videoSamples[0];
    expect(record.baked.sourcePlySha256).toBe(hash(fs.readFileSync(base + ".ply")));
    expect(record.baked.trainedPlySha256).toBe(
      hash(fs.readFileSync(path.join(folder, "phone.ply"))),
    );
    for (const [file, declared] of Object.entries(record.baked.files))
      expect(hash(fs.readFileSync(path.join(root, file))), file).toBe(declared.sha256);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
