// MIT. Download boundaries and manifest selection, without the network or Blender.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { localName, selectModel, prepareModel } from "../../blender-views.mjs";

test("only recorded CC0 Poly Haven assets without logos are selected", () => {
  assert.equal(selectModel("rubber-duck-real").source, "polyhaven:rubber_duck_toy");
  for (const id of ["missing", "armillary-sphere", "vintage-camera", "boombox"])
    assert.throws(() => selectModel(id));
});

test("external dependencies cannot escape the pinned model directory", () => {
  assert.equal(localName("textures/albedo.jpg"), "textures/albedo.jpg");
  for (const uri of [
    "../escape.bin",
    "%2e%2e/escape.bin",
    "/tmp/escape.bin",
    "https://example.com/a",
    "textures\\a.jpg",
    "textures/%2e%2e/a.jpg",
  ])
    assert.throws(() => localName(uri));
});

test("a corrupt cached model fails before importing or fetching dependencies", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "blender-model-"));
  try {
    fs.mkdirSync(path.join(dir, "rubber-duck-real"));
    fs.writeFileSync(
      path.join(dir, "rubber-duck-real/rubber_duck_toy.gltf"),
      "corrupt cached bytes",
    );
    await assert.rejects(prepareModel("rubber-duck-real", dir), /SHA-256 mismatch/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
