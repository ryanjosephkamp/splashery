import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import {
  configureFrozenProbes,
  frozenProbes,
  verifyFrozenProbes,
} from "../tools/cdx-p3d5-browser.mjs";

test("depth experiments retain original probes and reject changed inputs or reference evidence", () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "p3d5-probes-"));
  const entry = { id: "fixture", sha256: "photo", depthSha256: "depth" };
  const data = {
    field: { width: 2, height: 1, data: [32, 220] },
    thin: { anchors: [{ width: 1 }] },
    edges: [{ u: 0.5, v: 0.5 }],
    edgeCandidates: 4,
    edgeSupported: 1,
  };
  try {
    fs.mkdirSync(path.join(folder, "renders"));
    fs.writeFileSync(
      path.join(folder, "atlas.json"),
      JSON.stringify({
        complete: true,
        source: { sha256: "original" },
        inputs: [{ ...entry, profiles: { phone: { rows: [{}] } } }],
      }),
    );
    const file = path.join(folder, "renders/fixture-phone-anchors.json.gz");
    fs.writeFileSync(file, zlib.gzipSync(JSON.stringify(data)));
    configureFrozenProbes(folder);
    const old = frozenProbes(entry, "phone");
    expect(old.field).toEqual(data.field);
    // A candidate cannot mutate the reference field or select a new probe set.
    old.field.data[0] = 255;
    expect(frozenProbes(entry, "phone").field).toEqual(data.field);
    expect(() => frozenProbes({ ...entry, sha256: "different photo" }, "phone")).toThrow(
      /identical original input hashes/,
    );
    expect(() => frozenProbes(entry, "desktop")).toThrow(/Missing frozen profile/);
    expect(verifyFrozenProbes()).toHaveLength(1);
    fs.writeFileSync(file, zlib.gzipSync(JSON.stringify({ ...data, edges: [] })));
    expect(() => verifyFrozenProbes()).toThrow(/changed during capture/);
    expect(() => frozenProbes(entry, "phone")).toThrow(/source probe changed/);
  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
  }
});
