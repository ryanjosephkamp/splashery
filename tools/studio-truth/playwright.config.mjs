import { defineConfig } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import base from "../../playwright.config.mjs";

// The repository's graphics overrides are deliberately replaced, not appended.
// This preserves assertions and uses Chromium's sandbox and default GPU policy.
const root = fileURLToPath(new URL("../../", import.meta.url));
export default defineConfig({
  ...base,
  testDir: path.join(root, "tests"),
  outputDir: path.join(root, ".cache/studio-truth/playwright"),
  workers: 1,
  use: {
    ...base.use,
    launchOptions: {
      executablePath: process.env.SPLASHERY_CHROMIUM || "/usr/bin/chromium",
      chromiumSandbox: true,
    },
  },
});
