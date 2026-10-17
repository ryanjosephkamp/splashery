// Run the task and its unchanged smoke/help checks with sandboxed Chromium.
// The shared configuration is preserved; replace its graphics launch flags.
import { defineConfig } from "@playwright/test";
import base from "../../../playwright.config.mjs";
import { fileURLToPath } from "node:url";

export default defineConfig({
  ...base,
  testDir: fileURLToPath(new URL("../../", import.meta.url)),
  outputDir: process.env.SPLASHERY_COMPAT_RESULTS || "/tmp/splashery-compat-results",
  workers: 1,
  retries: 0,
  webServer: {
    ...base.webServer,
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
  },
  use: {
    ...base.use,
    launchOptions: {
      executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
      chromiumSandbox: true,
      args: [],
      ignoreDefaultArgs: ["--unsafely-disable-devtools-self-xss-warnings"],
    },
  },
});
