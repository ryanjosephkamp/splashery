import { test, expect } from "@playwright/test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { CAPTURES } from "../tools/cdx-v3d-sample-sources.mjs";
import { ORIGINAL_CAPTURES } from "../tools/cdx-v3d-mac-bake.mjs";

// These are packaging fixtures, not native solves or newly trained models.
function fixture(root, id) {
  const work = join(root, id);
  mkdirSync(join(work, "undistorted-text"), { recursive: true });
  const ply = readFileSync(`assets/toys/video-3d/${id}.ply`);
  const plySha256 = createHash("sha256").update(ply).digest("hex");
  const source = { ...CAPTURES.find((s) => s.id === id), ...ORIGINAL_CAPTURES[id] };
  const training = { iterations: 30000, settings: { keepCrs: true }, plySha256, fixture: true };
  const meta = {
    stats: { frames: 60, registered: 54, iters: 30000 },
    bake: { backend: "msplat/Metal", source, training, fixture: true },
  };
  const write = (file, value) => writeFileSync(join(work, file), JSON.stringify(value));
  writeFileSync(join(work, `${id}.ply`), ply);
  write(`${id}.json`, meta);
  write("training.json", training);
  write("preparation.json", { capture: source });
  write("solve.json", { fixture: true });
  write("cameras.json", { fixture: true });
  writeFileSync(join(work, "training.log"), "Packaging fixture; no Metal training ran.\n");
  writeFileSync(join(work, "extraction.log"), "Packaging fixture.\n");
  for (const file of ["cameras.txt", "images.txt", "points3D.txt"])
    writeFileSync(join(work, "undistorted-text", file), "# Packaging fixture\n");
  writeFileSync(join(work, "private-note.txt"), "Do not include unrelated files.\n");
  return work;
}

test("the Mac return archive contains the reviewed pair and run records with retained ShareAlike", async () => {
  const { bundleReturn } = await import("../tools/cdx-v3d-mac-bake.mjs");
  const root = mkdtempSync(join(tmpdir(), "cdx-v3d-return-"));
  try {
    const work = fixture(root, "poltsamaa");
    const archive = bundleReturn(work, "poltsamaa");
    const names = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" });
    expect(names).toContain("poltsamaa.ply\n");
    expect(names).toContain("poltsamaa.json\n");
    expect(names).toContain("training.log\n");
    expect(names).toContain("undistorted-text/cameras.txt\n");
    expect(names).not.toContain("private-note");
    expect(names).not.toContain("capture.webm");
    const meta = JSON.parse(execFileSync("tar", ["-xOzf", archive, "poltsamaa.json"]));
    expect(meta.bake.source.license).toBe("CC BY-SA 4.0");
    expect(meta.bake.source.author).toBe("Sillerkiil");
    const returnedPly = execFileSync("tar", ["-xOzf", archive, "poltsamaa.ply"], {
      maxBuffer: 4e6,
    });
    expect(createHash("sha256").update(returnedPly).digest("hex")).toBe(
      meta.bake.training.plySha256,
    );
    meta.bake.source.license = "CC0 1.0";
    writeFileSync(join(work, "poltsamaa.json"), JSON.stringify(meta));
    expect(() => bundleReturn(work, "poltsamaa")).toThrow(/license/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a changed PLY or unfinished bake cannot be packaged as a completed Mac return", async () => {
  const { bundleReturn } = await import("../tools/cdx-v3d-mac-bake.mjs");
  const root = mkdtempSync(join(tmpdir(), "cdx-v3d-return-"));
  try {
    const work = fixture(root, "lihula");
    const file = join(work, "training.json");
    const training = JSON.parse(readFileSync(file));
    writeFileSync(file, JSON.stringify({ ...training, iterations: 1000 }));
    expect(() => bundleReturn(work, "lihula")).toThrow(/30,000/);
    writeFileSync(file, JSON.stringify(training));
    writeFileSync(join(work, "lihula.ply"), "changed");
    expect(() => bundleReturn(work, "lihula")).toThrow(/PLY/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
