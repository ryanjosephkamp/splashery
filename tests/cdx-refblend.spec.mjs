import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PNG } from "pngjs";

const root = process.cwd();
let dir;
test.beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), "refblend-test-"));
});
test.afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});
const pack = () => ({
  schema: 1,
  id: "cabinet",
  name: "Cabinet",
  images: [{ file: "front.png", view: "front", mask: "mask.png" }],
  budget: { minutes: 30, quality: "good" },
  license: { images: "private" },
  moves: [{ part: "door", how: "hinge", axis: "y", amount: 95 }],
});
async function fixture(p = pack()) {
  const png = new PNG({ width: 4, height: 4 });
  png.data.fill(255);
  await fs.writeFile(path.join(dir, "front.png"), PNG.sync.write(png));
  await fs.writeFile(path.join(dir, "mask.png"), PNG.sync.write(png));
  await fs.writeFile(path.join(dir, "pack.json"), JSON.stringify(p));
}

test("pack contract accepts task 113 and strips truth metadata before modeling", async () => {
  await fixture({ ...pack(), truth: { model: "/secret/truth.glb" } });
  const { readPack } = await import("../tools/refblend/contract.mjs");
  const p = await readPack(dir);
  expect(p.id).toBe("cabinet");
  expect(p.truth).toBeUndefined();
  expect(p.images[0].file).toBe("front.png");
});

test("pack contract rejects traversal, symlinks, duplicate moves, and invalid budgets", async () => {
  const { readPack } = await import("../tools/refblend/contract.mjs");
  for (const p of [
    { ...pack(), images: [{ file: "../outside.png", view: "front" }] },
    { ...pack(), id: undefined },
    { ...pack(), id: 123 },
    { ...pack(), moves: [{ how: "hinge" }] },
    { ...pack(), budget: { minutes: -1, quality: "good" } },
    { ...pack(), moves: [...pack().moves, ...pack().moves] },
    { ...pack(), moves: [{ part: "../door", how: "hinge" }] },
    { ...pack(), images: [{ file: "front.png", view: "front", camera: { distance: 0 } }] },
  ]) {
    await fixture(p);
    await expect(readPack(dir)).rejects.toThrow();
  }
  await fixture();
  await fs.unlink(path.join(dir, "front.png"));
  await fs.symlink(path.join(root, "package.json"), path.join(dir, "front.png"));
  await expect(readPack(dir)).rejects.toThrow(/outside|symlink/i);
});

test("fallback scorer distinguishes a matching silhouette from the wrong box", async () => {
  const { silhouetteIoU, scoreLite } = await import("../tools/refblend/score-lite.mjs");
  expect(silhouetteIoU([1, 0, 1, 0], [1, 0, 1, 0])).toBe(1);
  expect(silhouetteIoU([1, 0, 1, 0], [0, 1, 0, 1])).toBe(0);
  expect(silhouetteIoU([0, 0], [0, 0])).toBe(0);
  await fixture();
  await fs.mkdir(path.join(dir, "renders"));
  await fs.copyFile(path.join(dir, "front.png"), path.join(dir, "renders/000.png"));
  const p = pack();
  p.name = '<script>alert("x")</script>';
  const s = await scoreLite(dir, dir, p);
  expect(s.overall.silhouetteIoU).toBe(100);
  expect(await fs.readFile(path.join(dir, "report.html"), "utf8")).not.toContain("<script>");
});

test("result contract requires rigid parts, finite pivots, and phone/desktop budgets", async () => {
  const { validateResult } = await import("../tools/refblend/contract.mjs");
  const r = {
    schema: 1,
    pack: "cabinet",
    builder: "blender",
    minutes: 1,
    status: "complete",
    coordinates: "normalized-y-up",
    mesh: "result.glb",
    splat: "result.ply",
    tiers: {
      phone: { splats: 90000, file: "phone/result.ply" },
      desktop: { splats: 300000, file: "result.ply" },
    },
    parts: [{ name: "door", file: "parts/door.ply", pivot: [0, 0, 0], motion: pack().moves[0] }],
  };
  expect(validateResult(r, pack())).toEqual(r);
  expect(() => validateResult({ ...r, parts: [] }, pack())).toThrow(/door/);
  expect(() =>
    validateResult({ ...r, parts: [{ ...r.parts[0], pivot: [NaN, 0, 0] }] }, pack()),
  ).toThrow(/pivot/);
});

test("wrapper validates arguments and packs without Blender installed", async () => {
  await fixture();
  await fs.writeFile(path.join(dir, "model.py"), "pass\n");
  const run = (...args) =>
    spawnSync(process.execPath, ["tools/refbuild-blender.mjs", ...args], {
      cwd: root,
      encoding: "utf8",
    });
  expect(run("--help").status).toBe(0);
  const { parseArgs } = await import("../tools/refbuild-blender.mjs");
  for (const seed of [-1, 4294967296])
    expect(() => parseArgs([dir, path.join(dir, "model.py"), `--seed=${seed}`])).toThrow(/seed/);
  expect(run(dir, path.join(dir, "model.py"), "--minutes=NaN").status).toBe(1);
  const missing = run(
    dir,
    path.join(dir, "model.py"),
    "--blender=/missing/blender",
    `--out=${dir}/out`,
  );
  expect(missing.status).toBe(1);
  expect(missing.stderr).toMatch(/Blender|blender/);
  await expect(fs.stat(path.join(dir, "out/result.json"))).rejects.toThrow();
});

test("hard deadline terminates a child and its descendants without Blender", async () => {
  const { runCommand } = await import("../tools/refblend/process.mjs");
  const start = Date.now();
  await expect(
    runCommand(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
      deadline: Date.now() + 100,
      log: path.join(dir, "log"),
    }),
  ).rejects.toThrow(/budget|deadline/i);
  expect(Date.now() - start).toBeLessThan(3000);
});

test("real Blender export, scoring, aligned splats, and rigid pivot (skips only when Blender is absent)", async () => {
  const blender = process.env.BLENDER_BIN;
  test.skip(!blender, "Blender-only integration; all wrapper and format tests run without Blender");
  await fixture();
  await fs.writeFile(
    path.join(dir, "model.py"),
    `assert __name__ == "__main__"\nfrom refblend import *\nbox("body", (1, .6, 1), (0, 0, .5), bevel=.02, material=material("green metal", "metal", (.2,.5,.2)))\nbox("red", (.35, .05, .8), (-.25, -.33, .5), bevel=.01, material=material("red", "plastic", (1,0,0)))\nbox("blue", (.35, .05, .8), (.25, -.33, .5), bevel=.01, material=material("blue", "plastic", (0,0,1)))\nmoving_part("door", ["red","blue"], (0, -.33, .5))\nbox("knob", (.2,.2,.2), (.8,0,.8))\nmoving_part("knob", ["knob"], (.8,0,.8))\nwith open(${JSON.stringify(path.join(dir, "model.py"))}, "a") as source: source.write("# concurrent edit\\n")\n`,
  );
  const r = spawnSync(
    process.execPath,
    [
      "tools/refbuild-blender.mjs",
      dir,
      path.join(dir, "model.py"),
      "--minutes=3",
      `--out=${dir}/out`,
      "--size=32",
      "--samples=1",
      "--bake-size=128",
      "--phone=100",
      "--desktop=200",
    ],
    { cwd: root, env: process.env, encoding: "utf8", timeout: 180000 },
  );
  expect(r.status, r.stderr + r.stdout).toBe(0);
  const result = JSON.parse(await fs.readFile(path.join(dir, "out/result.json")));
  expect(result.parts[0].motion.how).toBe("hinge");
  expect(result.parts[0].pivot.every(Number.isFinite)).toBe(true);
  expect(result.tiers.phone.splats).toBe(100);
  const { geometry } = await import("../tools/refblend/splats.mjs");
  const whole = await geometry(path.join(dir, "out/result.glb"));
  const body = await geometry(path.join(dir, "out/static.glb"));
  const door = await geometry(path.join(dir, "out/parts/door.glb"));
  expect(body.area + door.area).toBeCloseTo(whole.area, 4);
  const { createHash } = await import("node:crypto");
  const digest = async (file) =>
    createHash("sha256")
      .update(await fs.readFile(file))
      .digest("hex");
  expect(result.provenance.modelSha256).toBe(await digest(path.join(dir, "out/model.py")));
  expect(result.provenance.modelSha256).not.toBe(await digest(path.join(dir, "model.py")));

  const ply = await fs.readFile(path.join(dir, "out/static.ply"));
  const dataStart = ply.indexOf("end_header\n") + 11;
  const count = Number(
    ply
      .subarray(0, dataStart)
      .toString()
      .match(/element vertex (\d+)/)[1],
  );
  let meanGreen = 0;
  for (let i = 0; i < count; i++)
    meanGreen += ply.readFloatLE(dataStart + (i * 17 + 7) * 4) / count;
  expect(meanGreen).toBeGreaterThan(-0.5);
  // Two joined pieces retain distinct colors despite their overlapping source UVs.
  const partPly = await fs.readFile(path.join(dir, "out/parts/door.ply"));
  const partStart = partPly.indexOf("end_header\n") + 11;
  const splitX = -result.normalization.centerMeters[0] / result.normalization.radiusMeters;
  const colors = [
    { sum: 0, count: 0 },
    { sum: 0, count: 0 },
  ];
  for (let at = partStart; at < partPly.length; at += 17 * 4) {
    const red = partPly.readFloatLE(at + 6 * 4),
      blue = partPly.readFloatLE(at + 8 * 4);
    const side = partPly.readFloatLE(at) < splitX ? 0 : 1;
    const difference = (red - blue) * (side === 0 ? 1 : -1);
    colors[side].sum += difference;
    colors[side].count++;
  }
  for (const c of colors) {
    expect(c.count).toBeGreaterThan(5);
    expect(c.sum / c.count).toBeGreaterThan(1.5);
  }
  for (const f of [
    "result.glb",
    "result.ply",
    "static.ply",
    "parts/door.ply",
    "phone/parts/door.ply",
    "score.json",
    "report.html",
  ])
    expect((await fs.stat(path.join(dir, "out", f))).size).toBeGreaterThan(0);
});

test("rigid motion uses the recorded axis and scales slide meters into toy units", async () => {
  const { pose } = await import("../tools/refblend/motion.mjs");
  expect(pose({ how: "hinge", axis: "y", amount: 90 }, 0.5, 2).rotation).toEqual([0, 90, 0]);
  expect(pose({ how: "slide", axis: "x", amount: 0.4 }, 0.5, 2).translation[0]).toBeCloseTo(0.2);
  expect(pose({ how: "bounce", axis: "y", amount: 0.1 }, 0, 1).translation).toEqual([0, 0, 0]);
});

test("installer remains opt-in and rejects a tampered cached archive", async () => {
  const invoke = (...args) =>
    spawnSync("bash", ["tools/refblend/setup.sh", ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, REFBLEND_CACHE: dir },
    });
  expect(invoke().status).toBe(2);
  await fs.writeFile(path.join(dir, "blender-4.5.3-linux-x64.tar.xz"), "tampered");
  const r = invoke("--blender");
  expect(r.status).toBe(1);
  expect(r.stderr).toContain("SHA-256 mismatch");
});

test("part PLY positions and splat scales are restored to the whole model's coordinates", async () => {
  const { alignPly } = await import("../tools/refblend/splats.mjs");
  const names = ["x", "y", "z", "scale_0", "scale_1", "scale_2"];
  const head = Buffer.from(
    `ply\nformat binary_little_endian 1.0\nelement vertex 1\n${names.map((p) => `property float ${p}`).join("\n")}\nend_header\n`,
  );
  const data = Buffer.alloc(24);
  [1, 0, -1, 0, 0, 0].forEach((v, i) => data.writeFloatLE(v, i * 4));
  const bytes = alignPly(
    Buffer.concat([head, data]),
    { center: [3, 4, 5], radius: 2 },
    { center: [1, 2, 3], radius: 4 },
  );
  expect([0, 1, 2].map((i) => bytes.readFloatLE(head.length + i * 4))).toEqual([1, 0.5, 0]);
  expect(bytes.readFloatLE(head.length + 12)).toBeCloseTo(Math.log(0.5));
});

test("local preview confines file reads and serves result metadata without Blender", async () => {
  const { startPreview } = await import("../tools/refblend/preview.mjs");
  await fs.writeFile(path.join(dir, "result.json"), JSON.stringify({ pack: "test" }));
  await fs.symlink(path.join(root, "package.json"), path.join(dir, "outside.json"));
  const { server, url } = await startPreview(dir);
  try {
    expect((await fetch(url)).status).toBe(200);
    expect((await (await fetch(url + "result/result.json")).json()).pack).toBe("test");
    expect((await fetch(url + "result/outside.json")).status).toBe(404);
    expect((await fetch(url + "result/%2e%2e%2fpackage.json")).status).toBe(404);
    expect((await fetch(url + "preview/contract.mjs")).status).toBe(404);
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("real Blender kit generates closed solids for curved and soft helpers (skips only when Blender is absent)", async () => {
  test.skip(!process.env.BLENDER_BIN, "Blender-only physical geometry checks");
  const gray = new PNG({ width: 4, height: 4 });
  for (let i = 0; i < 16; i++) gray.data.set([128, 128, 128, 255], i * 4);
  await fs.writeFile(path.join(dir, "gray.png"), PNG.sync.write(gray));
  const r = spawnSync(
    process.env.BLENDER_BIN,
    [
      "--background",
      "--factory-startup",
      "--python-exit-code",
      "1",
      "--python",
      "tests/cdx-refblend-kit.py",
      "--",
      path.join(dir, "gray.png"),
    ],
    { cwd: root, encoding: "utf8", timeout: 60000 },
  );
  expect(r.status, r.stdout + r.stderr).toBe(0);
  const v = spawnSync(
    process.env.BLENDER_BIN,
    [
      "--background",
      "--python-exit-code",
      "1",
      "--python",
      "tools/refblend/truth-score.py",
      "--",
      "--self-test",
    ],
    { cwd: root, encoding: "utf8", timeout: 60000 },
  );
  expect(v.status, v.stdout + v.stderr).toBe(0);
});

test("budget stops a looping model without publishing a complete result (skips only when Blender is absent)", async () => {
  test.skip(!process.env.BLENDER_BIN, "Blender-only model timeout");
  await fixture();
  await fs.writeFile(path.join(dir, "loop.py"), "while True: pass\n");
  const start = Date.now();
  const r = spawnSync(
    process.execPath,
    [
      "tools/refbuild-blender.mjs",
      dir,
      path.join(dir, "loop.py"),
      "--minutes=.01",
      `--out=${dir}/out`,
    ],
    { cwd: root, encoding: "utf8", env: process.env, timeout: 5000 },
  );
  expect(r.status).toBe(1);
  expect(r.stderr).toMatch(/budget|deadline/);
  expect(Date.now() - start).toBeLessThan(3000);
  await expect(fs.stat(path.join(dir, "out/result.json"))).rejects.toThrow();
});

test("truth factory preserves instanced source geometry (skips only when Blender is absent)", async () => {
  test.skip(!process.env.BLENDER_BIN, "Blender-only truth factory instance normalization");
  const r = spawnSync(
    process.env.BLENDER_BIN,
    [
      "--background",
      "--factory-startup",
      "--python-exit-code",
      "1",
      "--python",
      "tests/cdx-refblend-truth.py",
      "--",
      dir,
    ],
    { cwd: root, encoding: "utf8", timeout: 60000 },
  );
  expect(r.status, r.stdout + r.stderr).toBe(0);
});

test("installer resolves symlinks before enforcing the external-cache rule", async () => {
  const bin = path.join(dir, "bin");
  await fs.mkdir(bin);
  await fs.writeFile(path.join(bin, "curl"), "#!/bin/sh\nexit 93\n", { mode: 0o755 });
  await fs.symlink(root, path.join(dir, "repo-link"));
  const r = spawnSync("bash", ["tools/refblend/setup.sh", "--blender"], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      REFBLEND_CACHE: path.join(dir, "repo-link"),
      PATH: bin + path.delimiter + process.env.PATH,
    },
  });
  expect(r.status, r.stderr).toBe(2);
  expect(r.stderr).toContain("outside the repository");
});
