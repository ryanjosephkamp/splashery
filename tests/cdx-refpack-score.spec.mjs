import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { renderer } from "../tools/refpack-render.mjs";
import { plyFromKit } from "../tools/refpack-geometry.mjs";
import { pngBytes, maskImage } from "../tools/refpack-image.mjs";
import { writeResult } from "../tools/refbuild-kit.mjs";
import { scorePack } from "../tools/refpack-score.mjs";

test("real scorer repeats within 0.5 points and rejects a box for an open-legged chair", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "refpack-score-"));
  const shape = (size, pos) => ({ type: "box", size, pos, color: [0.55, 0.3, 0.12], part: "body" });
  const chair = {
    shapes: [
      shape([1.2, 0.12, 1], [0, 0, 0]),
      shape([1.2, 0.9, 0.12], [0, 0.5, -0.44]),
      ...[-0.5, 0.5].flatMap((x) => [-0.4, 0.4].map((z) => shape([0.12, 0.9, 0.12], [x, -0.5, z]))),
    ],
  };
  const wrong = { shapes: [shape([1.2, 1.9, 1], [0, 0, 0])] };
  const service = await renderer();
  try {
    fs.mkdirSync(path.join(dir, "images"));
    await service.load(plyFromKit(chair, 9000));
    const images = [];
    for (const [i, yaw] of [0, Math.PI / 2, Math.PI / 4].entries()) {
      const p = await service.render({ yaw, pitch: 0.1, fov: 38, distance: 4 }, 128, 128);
      const mask = Uint8Array.from({ length: 128 * 128 }, (_, j) => +(p.data[j * 4 + 3] >= 128));
      fs.writeFileSync(path.join(dir, `images/${i}.png`), pngBytes(p));
      fs.writeFileSync(path.join(dir, `images/${i}-mask.png`), pngBytes(maskImage(mask, 128, 128)));
      images.push({
        file: `images/${i}.png`,
        mask: `images/${i}-mask.png`,
        view: ["front", "right", "three-quarter"][i],
      });
    }
    const pack = {
      schema: 1,
      id: "known-chair",
      name: "Known chair",
      images,
      budget: { minutes: 1, quality: "good" },
      license: { images: "CC0-1.0" },
    };
    fs.writeFileSync(path.join(dir, "pack.json"), JSON.stringify(pack));
    const correctDir = path.join(dir, "correct"),
      wrongDir = path.join(dir, "wrong");
    await writeResult(correctDir, pack, chair, { minutes: 0.1 }, 9000);
    await writeResult(wrongDir, pack, wrong, { minutes: 0.1 }, 9000);
    const opts = { size: 128, cameraRounds: 1, renderService: service };
    const a = await scorePack(dir, correctDir, opts),
      b = await scorePack(dir, correctDir, opts),
      c = await scorePack(dir, wrongDir, opts);
    expect(a.overall.silhouetteIoU).toBeGreaterThan(0.85);
    expect(Math.abs(a.overall.score - b.overall.score)).toBeLessThanOrEqual(0.5);
    expect(a.overall.score - c.overall.score).toBeGreaterThan(15);
    fs.mkdirSync(".cache", { recursive: true });
    fs.writeFileSync(
      ".cache/refpack-known-pair.json",
      JSON.stringify(
        {
          correct: a.overall,
          wrong: c.overall,
          repeatDelta: Math.abs(a.overall.score - b.overall.score),
        },
        null,
        2,
      ),
    );
    expect(fs.readFileSync(path.join(correctDir, "report.html"), "utf8")).toContain(
      "data:image/png;base64,",
    );
  } finally {
    await service.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
