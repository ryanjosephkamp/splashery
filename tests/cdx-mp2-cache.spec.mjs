import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { unpackSampleDepth } from "../src/packs/moving-photo.js";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
// The reviewed 421ec876 caches, before compression. These cover every depth
// byte of every source frame, beyond the existing changing-frame assertion.
const original = {
  bunny: "35a28dad3862207772d1af8dc153bb7782c3ba7e3dd1bb506ad06f028ca30038",
  sintel: "8416f05db894338d612cffe70a15fb304331e18f6855460cb090f7febf5b1844",
  elephants: "af8fbc9a87ee119ecaed3d16dafaed0acdde2ccd7fdd29e72b8ad14e5933d64f",
  tears: "c9151c3b37f5eb8bb4550d3fe9d74099cea1135234bdfb4b7494aacf2273f834",
};
for (const [stem, hash] of Object.entries(original))
  test(`${stem}: browser and Node restore every reviewed depth byte`, async ({ page }) => {
    const file = `assets/toys/moving-photo-3d/${stem}-long.mp2depth`,
      packed = await fs.readFile(file),
      decoded = await unpackSampleDepth(packed);
    expect(sha(decoded)).toBe(hash);
    expect(packed.length).toBeLessThan(decoded.length / 2);
    expect(await unpackSampleDepth(decoded)).toBe(decoded);
    await page.goto("/LICENSES.md");
    const browserHash = await page.evaluate(async (file) => {
      const { unpackSampleDepth } = await import("/src/packs/moving-photo.js"),
        packed = new Uint8Array(await (await fetch(`/${file}`)).arrayBuffer()),
        decoded = await unpackSampleDepth(packed),
        digest = new Uint8Array(await crypto.subtle.digest("SHA-256", decoded));
      return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }, file);
    expect(browserHash).toBe(hash);
  });

test("damaged gzip cannot silently become a depth answer", async ({ page }) => {
  const packed = gzipSync(new Uint8Array(100).fill(123));
  packed[packed.length - 5] ^= 1;
  await expect(unpackSampleDepth(packed)).rejects.toThrow();
  await page.goto("/LICENSES.md");
  const message = await page.evaluate(
    async (data) => {
      const { unpackSampleDepth } = await import("/src/packs/moving-photo.js");
      try {
        await unpackSampleDepth(new Uint8Array(data));
        return "accepted damaged data";
      } catch {
        return "rejected";
      }
    },
    [...packed],
  );
  expect(message).toBe("rejected");
});
