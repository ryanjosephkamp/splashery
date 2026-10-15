// Task 87: metric calibration and a small real-product, offline gallery loop.
import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { runAudit, parseArgs } from "../tools/p3d-failures.mjs";
import { inventory } from "../tools/p3df/inputs.mjs";
import {
  referenceError,
  cueDepth,
  coverage,
  rasterQuads,
  severity,
} from "../tools/p3df/scoring.mjs";
import { streakR4, fringeR4 } from "../tools/p3df/artifacts.mjs";

test("reference-depth error holds out calibration pixels and detects reversed ordering", () => {
  const truth = Float32Array.from({ length: 240 }, (_, i) => 1 + i / 30),
    prediction = Float32Array.from(truth, (z) => 4 / z + 2),
    mask = new Uint8Array(240).fill(1);
  const correct = referenceError(prediction, truth, mask);
  expect(correct.absRel).toBeLessThan(0.000001);
  expect(correct.reversedFraction).toBe(0);
  const reversed = referenceError(
    Float32Array.from(prediction, (v) => -v),
    truth,
    mask,
  );
  expect(reversed.fitError).toContain("reversed");
  expect(reversed.reversedFraction).toBe(1);
  for (let i = 3; i < 240; i += 7) {
    mask[i] = 3;
    prediction[i] = 1e9;
  }
  expect(referenceError(prediction, truth, mask).absRel).toBeLessThan(0.000001);
});

test("T-junction warnings distinguish correct, reversed, flattened, and unsupported maps", () => {
  const w = 64,
    h = 64,
    data = new Uint8Array(w * h * 4),
    depth = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      data.set(
        y < 32 ? [230, 30, 30, 255] : x < 32 ? [20, 60, 210, 255] : [120, 190, 210, 255],
        (y * w + x) * 4,
      );
      depth[y * w + x] = y < 32 ? 220 : 30;
    }
  const photo = { width: w, height: h, data },
    field = { width: w, height: h, data: depth };
  const good = cueDepth(photo, field);
  expect(good.candidates).toBeGreaterThan(0);
  expect(good.flippedFraction).toBe(0);
  expect(
    cueDepth(photo, { ...field, data: Uint8Array.from(depth, (v) => 255 - v) }).flippedFraction,
  ).toBe(1);
  expect(cueDepth(photo, { ...field, data: depth.slice().fill(128) }).flattenedFraction).toBe(1);
  expect(cueDepth({ ...photo, data: data.slice().fill(128) }, field).flippedFraction).toBeNull();
});

test("directional streak excess penalizes extrusion against textured nearby controls", () => {
  const w = 128,
    h = 96,
    classes = new Uint8Array(w * h),
    data = new Uint8Array(w * h * 4);
  let seed = 52;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const v = x < 64 ? 128 + 90 * Math.sin(x * 0.6) : seed >>> 24;
      data.set([v, v, v, 255], i * 4);
      classes[i] = x < 64 ? 1 : 2;
    }
  const result = streakR4({ width: w, height: h, data }, classes);
  expect(result.directionalExcess).toBeGreaterThan(0.4);
  expect(result.revealed.texturedPixels).toBeGreaterThan(100);
  expect(
    streakR4({ width: w, height: h, data }, new Uint8Array(w * h)).directionalExcess,
  ).toBeNull();
});

test("reveal coverage counts actual unfilled mask pixels, with foreground excluded", () => {
  const quad = [
      [
        [0, 0, 1],
        [4, 0, 1],
        [4, 4, 1],
        [0, 4, 1],
      ],
    ],
    data = new Uint8Array(4 * 4 * 4),
    mask = { width: 4, height: 4, data };
  expect([...rasterQuads(quad, 4, 4)].reduce((a, b) => a + b, 0)).toBe(16);
  expect(coverage(mask, quad).holeFraction).toBe(1);
  for (let i = 0; i < 16; i++) data[i * 4 + 1] = 128;
  expect(coverage(mask, quad).holeFraction).toBe(0);
  for (let i = 0; i < 16; i++) data[i * 4 + 1] = 64;
  expect(coverage(mask, quad).holeFraction).toBeNull();
});

test("thin profiles penalize blur and record vanished parts separately", () => {
  const width = 64,
    height = 16,
    source = [],
    projected = [];
  for (let x = 20; x <= 44; x += 0.5) {
    source.push({ rgb: x >= 30 && x <= 34 ? [240, 240, 240] : [20, 20, 20] });
    projected.push([x, 8, 1]);
  }
  const anchor = { near: [240, 240, 240], far: [20, 20, 20], profile: source };
  const image = (blur) => {
    const data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const alpha =
          blur === null
            ? 0
            : blur
              ? Math.max(0, Math.min(1, (x - 27) / 5, (37 - x) / 5))
              : x >= 30 && x <= 34
                ? 1
                : 0;
        const v = 20 + 220 * alpha;
        data.set([v, v, v, 255], (y * width + x) * 4);
      }
    return { width, height, data };
  };
  const sharp = fringeR4(image(false), [projected], [anchor]);
  const blurred = fringeR4(image(true), [projected], [anchor]);
  expect(blurred.fringeMean).toBeGreaterThan(sharp.fringeMean);
  expect(fringeR4(image(null), [projected], [anchor]).missing).toBe(1);
  expect(severity({ fringe: { evaluated: 1, missing: 1 } })).toBeGreaterThan(1);
});

test("private inventory is local, narrow, and explicit about publication rights", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "p3df-private-"));
  try {
    fs.writeFileSync(path.join(folder, "owner photo.JPG"), "fixture");
    fs.writeFileSync(path.join(folder, "notes.txt"), "private");
    const rows = inventory({ input: folder });
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBeNull();
    expect(rows[0].license).toContain("not licensed for publication");
    expect(parseArgs(["--in", folder, "--out=/tmp/gallery"]).in).toBe(folder);
    expect(() => parseArgs(["--in", folder, "--manifest", "x.json"])).toThrow();
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

test("two real inputs render at the phone profile, score truth, and generate a safe offline gallery", async ({
  page,
}) => {
  test.setTimeout(180000);
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "p3df-browser-"));
  let server;
  try {
    const data = await runAudit({
      samples: "forest,truth-room",
      profiles: "phone",
      poses: [
        [0, 0],
        [20, 0],
      ],
      out: folder,
    });
    expect(data.coverage.completedProfiles).toBe(2);
    expect(data.coverage.completedPoses).toBe(4);
    expect(data.coverage.failedAttempts, JSON.stringify(data.attempts)).toBe(0);
    expect(data.complete).toBe(false);
    for (const row of data.inputs) {
      expect(row.profiles.phone.native).toEqual([585, 1266]);
      expect(row.profiles.phone.dpr).toBe(3);
      expect(row.profiles.phone.timing.first3dMs).toBeGreaterThan(0);
      expect(row.profiles.phone.externalRequests).toEqual([]);
      expect(row.profiles.phone.errors).toEqual([]);
      expect(row.profiles.phone.values.speed).toBeGreaterThan(0);
    }
    const truth = data.inputs.find((r) => r.kind === "truth").profiles.phone;
    expect(truth.rows[0].depth.scoredPixels).toBeGreaterThan(1000);
    expect(truth.rows[0].depth.fit.calibrationPixels).toBeLessThan(truth.rows[0].depth.pixels);
    const errors = [],
      network = [];
    page.on("pageerror", (e) => errors.push(e.message));
    // The managed browser blocks file:// by administrator policy. Serve the exact
    // same output on loopback, with no external resource or upload path.
    server = http.createServer((req, res) => {
      const file = path.resolve(
        folder,
        "." + new URL(req.url, "http://localhost").pathname.replace(/\/$/, "/index.html"),
      );
      if (!file.startsWith(folder + path.sep) || !fs.existsSync(file)) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader(
        "Content-Type",
        file.endsWith(".html")
          ? "text/html"
          : file.endsWith(".png")
            ? "image/png"
            : "application/octet-stream",
      );
      fs.createReadStream(file).pipe(res);
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const url = `http://127.0.0.1:${server.address().port}/`;
    page.on("request", (r) => {
      if (/^https?:/.test(r.url()) && new URL(r.url()).origin !== new URL(url).origin)
        network.push(r.url());
    });
    await page.goto(url);
    await expect(page).toHaveTitle("Photo to 3D · Failure atlas");
    await expect(page.locator("h1")).toHaveText("Where the picture breaks.");
    await expect(page.locator("article")).toHaveCount(2);
    await page.locator("#search").fill("Forest path");
    await expect(page.locator("article")).toHaveCount(1);
    await page.locator("#reset").click();
    await expect(page.locator("article")).toHaveCount(2);
    await page.locator("#failure").selectOption("errors");
    await expect(page.locator("#empty")).toBeVisible();
    await expect(page.locator("#count")).toContainText("0 of 2");
    await page.locator("#reset").click();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.locator("article summary").first().click();
    await expect(page.locator("article details").first()).toHaveAttribute("open", "");
    expect(errors).toEqual([]);
    expect(network).toEqual([]);
    await expect(
      runAudit({
        out: folder,
        resume: true,
        samples: "forest",
        profiles: "phone",
        poses: [[0, 0]],
      }),
    ).rejects.toThrow("settings changed");
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
