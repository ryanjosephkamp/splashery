// Bake the two licensed sample panoramas using the exact on-device pipeline.
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import { chromium } from "playwright";
import { packDepth } from "../src/pano3d/samples.js";
const port = Number(process.env.SPLASHERY_PORT) || 4173;
const base = `http://127.0.0.1:${port}`;
let server;
try {
  await fetch(base);
} catch {
  server = spawn(process.execPath, ["tools/cdx-mp2-server.mjs", String(port)], { stdio: "ignore" });
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(base);
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
  args: ["--no-sandbox"],
});
try {
  const page = await browser.newPage();
  await page.goto(base + "/docs/codex/107-step-inside-360.md");
  for (const id of ["room", "room2"]) {
    console.log(`Baking ${id}`);
    const result = await page.evaluate(async (id) => {
      const { loadSample } = await import("/src/pano3d/samples.js");
      const { createPanoramaClient } = await import("/src/pano3d/client.js");
      const item = await loadSample(id),
        client = createPanoramaClient();
      const result = await client.run(item.photo, (s) => console.log(s));
      return { ...result, depth: { ...result.depth, d: Array.from(result.depth.d) } };
    }, id);
    result.depth.d = Float32Array.from(result.depth.d);
    await fs.writeFile(`assets/toys/step-inside-360/${id}.depth`, packDepth(result.depth));
    await fs.mkdir(".cache/pano3d/evidence", { recursive: true });
    await fs.writeFile(
      `.cache/pano3d/evidence/${id}-alignment.json`,
      JSON.stringify(result.alignment, null, 2) + "\n",
    );
    console.log(id, result.alignment);
  }
} finally {
  await browser.close();
  server?.kill();
}
