import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { PNG } from "pngjs";
import { serve } from "../tools/studio-truth/server.mjs";

const root = new URL("./fixtures/truth/", import.meta.url);

test("all 12 committed stills have complete calibrated depth, masks, and verified asset records", async () => {
  const assets = JSON.parse(await fs.readFile(new URL("assets.json", root), "utf8"));
  const manifest = JSON.parse(await fs.readFile(new URL("manifest.json", root), "utf8"));
  assert.equal(manifest.scenes.length, 12);
  assert.equal(new Set(manifest.scenes.map((s) => s.id)).size, 12);
  assert.equal(manifest.license, "CC0-1.0");
  let bytes = 0;
  for (const file of assets.files) {
    const data = await fs.readFile(new URL(file.path, root));
    assert.equal(data.length, file.bytes, file.path);
    assert.equal(createHash("sha256").update(data).digest("hex"), file.sha256, file.path);
    bytes += data.length;
  }
  assert.equal(bytes, assets.total_bytes);
  assert.ok(bytes < 40_000_000);
  for (const scene of manifest.scenes) {
    const folder = new URL(`${scene.id}/still/`, root);
    const poses = JSON.parse(await fs.readFile(new URL("poses.json", folder), "utf8"));
    assert.equal(poses.frames.length, 1);
    const pose = poses.frames[0];
    assert.deepEqual([pose.width, pose.height], [1280, 720]);
    assert.equal(pose.K[0][2], 640);
    assert.equal(pose.K[1][2], 360);
    const z = gunzipSync(await fs.readFile(new URL(pose.depth, folder)));
    const mask = PNG.sync.read(await fs.readFile(new URL(pose.mask, folder)));
    assert.equal(z.length, 1280 * 720 * 4);
    for (let i = 0; i < 1280 * 720; i++) {
      const flag = mask.data[i * 4],
        value = z.readFloatLE(i * 4);
      assert.ok([0, 1, 3].includes(flag));
      assert.ok(flag === 0 ? Number.isNaN(value) : Number.isFinite(value) && value > 0);
    }
  }
});

test("the evidence server serves video ranges and denies private paths and symlinks", async () => {
  const folder = await fs.mkdtemp(path.join(os.tmpdir(), "studio-truth-"));
  let server;
  try {
    const site = path.join(folder, "site"),
      fixtures = path.join(folder, "fixtures");
    await fs.mkdir(site);
    await fs.mkdir(fixtures);
    await fs.mkdir(path.join(site, ".private"));
    await fs.writeFile(path.join(site, "index.html"), "OK");
    await fs.writeFile(path.join(site, ".private", "context"), "must not serve");
    await fs.writeFile(path.join(fixtures, "clip.mp4"), "0123456789");
    await fs.symlink(path.join(fixtures, "clip.mp4"), path.join(site, "outside.mp4"));
    server = await serve(site, fixtures);
    assert.equal(await (await fetch(server.url)).text(), "OK");
    const response = await fetch(server.url + "/__truth/clip.mp4", {
      headers: { Range: "bytes=3-6" },
    });
    assert.equal(response.status, 206);
    assert.equal(await response.text(), "3456");
    assert.equal(response.headers.get("content-range"), "bytes 3-6/10");
    assert.equal((await fetch(server.url + "/.private/context")).status, 404);
    assert.equal((await fetch(server.url + "/outside.mp4")).status, 404);
    assert.equal(
      (await fetch(server.url + "/__truth/clip.mp4", { headers: { Range: "bytes=30-40" } })).status,
      416,
    );
  } finally {
    await server?.close();
    await fs.rm(folder, { recursive: true, force: true });
  }
});
