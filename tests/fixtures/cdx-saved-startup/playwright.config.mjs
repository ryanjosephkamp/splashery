import { defineConfig } from "@playwright/test";
import base from "../../../playwright.config.mjs";
import { fileURLToPath } from "node:url";

export default defineConfig({
  ...base,
  testDir: fileURLToPath(new URL("../../", import.meta.url)),
  outputDir: process.env.SPLASHERY_STARTUP_RESULTS || "/tmp/splashery-startup-results",
  workers: 1,
  retries: 0,
  webServer: {
    command: "python3 -m http.server 4174 --bind 127.0.0.1",
    url: "http://127.0.0.1:4174",
    cwd: fileURLToPath(new URL("../../../", import.meta.url)),
    reuseExistingServer: false,
  },
  use: {
    ...base.use,
    baseURL: "http://127.0.0.1:4174",
    trace: "retain-on-failure",
    launchOptions: {
      executablePath: process.env.SPLASHERY_CHROMIUM || undefined,
      chromiumSandbox: true,
      args: [],
      ignoreDefaultArgs: ["--unsafely-disable-devtools-self-xss-warnings"],
    },
  },
});
