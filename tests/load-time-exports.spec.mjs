// The GIF library should resolve only when a GIF export is requested.
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

test("ordinary exports defer GIF encoding, and the first GIF export still works", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "splashery-gif-import-"));
  const hook = path.join(dir, "hook.mjs");
  const trace = path.join(dir, "imports.txt");
  fs.writeFileSync(
    hook,
    `import fs from "node:fs";
    export async function resolve(specifier, context, nextResolve) {
    if (specifier === "gifenc") {
      fs.appendFileSync(${JSON.stringify(trace)}, "GIF_RESOLVED\\n");
      // Use the same vendored ES module as the browser's import map.
      return nextResolve(${JSON.stringify(new URL("../vendor/gifenc/gifenc.esm.js", import.meta.url).href)}, context);
    }
    return nextResolve(specifier, context);
  }`,
  );
  const source = `
    const { encodeGIF } = await import(${JSON.stringify(pathToFileURL(path.resolve("src/exports.js")).href)});
    const fs = await import("node:fs");
    fs.appendFileSync(${JSON.stringify(trace)}, "EXPORTS_READY\\n");
    const rgba = new Uint8ClampedArray(16 * 16 * 4);
    for (let i = 0; i < rgba.length; i += 4) { rgba[i] = 255; rgba[i + 3] = 255; }
    const blob = await encodeGIF({ frames: 2, size: 16, loopMs: 80,
      renderFrame: async () => ({ getContext: () => ({ getImageData: () => ({ data: rgba }) }) }) });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    console.log(JSON.stringify({ type: blob.type, signature: new TextDecoder().decode(bytes.subarray(0, 6)),
      width: bytes[6] | bytes[7] << 8, height: bytes[8] | bytes[9] << 8, bytes: bytes.length }));
  `;
  try {
    const output = execFileSync(
      process.execPath,
      ["--experimental-loader", hook, "--input-type=module", "-e", source],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    );
    const lines = fs.readFileSync(trace, "utf8").trim().split("\n");
    expect(lines.indexOf("GIF_RESOLVED")).toBeGreaterThan(lines.indexOf("EXPORTS_READY"));
    const gif = JSON.parse(output.trim());
    expect(gif.type).toBe("image/gif");
    expect(gif.signature).toBe("GIF89a");
    expect([gif.width, gif.height]).toEqual([16, 16]);
    expect(gif.bytes).toBeGreaterThan(50);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
