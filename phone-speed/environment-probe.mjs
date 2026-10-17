import fs from "node:fs/promises";
import os from "node:os";
import { chromium } from "@playwright/test";

if (await fs.access(".cache/phone-speed/before/active.json").then(() => true, () => false))
  throw new Error("Do not probe GL alongside an active timing context.");
const method = JSON.parse(await fs.readFile(".cache/phone-speed/before/method.json", "utf8"));
const browser = await chromium.launch({
  executablePath: process.env.SPLASHERY_CHROMIUM,
  args: method.launchArgs,
});
let webgl;
try {
  const page = await browser.newPage();
  webgl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      version: gl.getParameter(gl.VERSION),
      shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION),
      vendor: info ? gl.getParameter(info.UNMASKED_VENDOR_WEBGL) : null,
      renderer: info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : null,
    };
  });
} finally {
  await browser.close();
}
const result = {
  measuredAt: new Date().toISOString(),
  node: process.version,
  platform: os.platform(),
  kernel: os.release(),
  architecture: os.arch(),
  cpu: os.cpus()[0].model,
  logicalCPUs: os.cpus().length,
  cpuQuota: (await fs.readFile("/sys/fs/cgroup/cpu.max", "utf8")).trim(),
  memoryLimit: (await fs.readFile("/sys/fs/cgroup/memory.max", "utf8")).trim(),
  browser: method.browser,
  launchArgs: method.launchArgs,
  webgl,
};
if (!/swiftshader/i.test(webgl.renderer)) throw new Error("Unexpected GL renderer.");
await fs.writeFile(".cache/phone-speed/environment.json", JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
